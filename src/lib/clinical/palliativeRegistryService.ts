import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { LtcRegistryService } from './ltcRegistryService'
import {
  AUTO_SYNC_COOLDOWN_MS,
  normalizeRegistryDateToIso,
  getItemFiscalYear,
  lookupPatientByHn,
  type VisitRepItem,
  type PalliativeRegistryItem,
  type PalliativeSyncSummary,
  type ListRegistriesParams,
  type RegistryStats,
  type ColorCounts,
} from './palliative-registry/typesAndLookup'

export * from './palliative-registry/typesAndLookup'

export interface PalliativeGatewayAdapter {
  syncPalliativeWithHosxp: typeof apiGateway.app.syncPalliativeWithHosxp
  getPalliativeRawBundle: typeof apiGateway.app.getPalliativeRawBundle
  enrichPalliativeHns: typeof apiGateway.clinical.enrichPalliativeHns
}

const defaultPalliativeGateway: PalliativeGatewayAdapter = {
  syncPalliativeWithHosxp: (payload) => apiGateway.app.syncPalliativeWithHosxp(payload),
  getPalliativeRawBundle: () => apiGateway.app.getPalliativeRawBundle(),
  enrichPalliativeHns: (hns) => apiGateway.clinical.enrichPalliativeHns(hns),
}

export class PalliativeRegistryService {
  static lookupPatientByHn = lookupPatientByHn

  private static rcmCache: {
    repeclaimMap: Map<string, VisitRepItem[]>
    repdataMap: Map<string, VisitRepItem[]>
    clinicMemberMap: Map<string, string>
    anMap: Map<string, string>
    timestamp: number
  } | null = null

  private static get syncState(): {
    lastSyncAt: number
    lastSummary: PalliativeSyncSummary | null
    inFlight: Promise<PalliativeSyncSummary> | null
  } {
    const g = globalThis as unknown as {
      __palliativeRegistrySyncState?: {
        lastSyncAt: number
        lastSummary: PalliativeSyncSummary | null
        inFlight: Promise<PalliativeSyncSummary> | null
      }
    }
    if (!g.__palliativeRegistrySyncState) {
      g.__palliativeRegistrySyncState = {
        lastSyncAt: 0,
        lastSummary: null,
        inFlight: null,
      }
    }
    return g.__palliativeRegistrySyncState
  }

  public static invalidateCache() {
    PalliativeRegistryService.rcmCache = null
  }

  public static resetSyncState() {
    const state = PalliativeRegistryService.syncState
    state.lastSyncAt = 0
    state.lastSummary = null
    state.inFlight = null
  }

  /**
   * Synchronize HOSxP Clinic 47 members and historical ADP 30001 home visits via Gateway Named API.
   */
  static async syncFromHosxp(
    options: { force?: boolean; actor?: string } = {},
    gateway: Partial<PalliativeGatewayAdapter> = defaultPalliativeGateway
  ): Promise<PalliativeSyncSummary> {
    if (options.force) {
      LtcRegistryService.invalidateCache()
    }

    const gw: PalliativeGatewayAdapter = { ...defaultPalliativeGateway, ...gateway }
    const res = await gw.syncPalliativeWithHosxp({ actor: options.actor || 'hosxp_autosync' })
    const summary: PalliativeSyncSummary = {
      totalClinicMembers: Number(res?.totalClinicMembers || 0),
      insertedCount: Number(res?.insertedCount || 0),
      updatedCount: Number(res?.updatedCount || 0),
      visitsAddedCount: Number(res?.visitsAddedCount || 0),
      skippedLtcCount: Number(res?.skippedLtcCount || 0),
      syncedAt: String(res?.syncedAt || new Date().toISOString()),
      insertedItems: Array.isArray(res?.insertedItems) ? res.insertedItems : [],
      updatedItems: Array.isArray(res?.updatedItems) ? res.updatedItems : [],
      visitsAddedItems: Array.isArray(res?.visitsAddedItems) ? res.visitsAddedItems : [],
      skippedLtcItems: Array.isArray(res?.skippedLtcItems) ? res.skippedLtcItems : [],
    }

    if (summary.insertedCount > 0 || summary.updatedCount > 0 || summary.visitsAddedCount > 0) {
      PalliativeRegistryService.invalidateCache()
      try {
        await logAudit(
          'UPDATE',
          'palliative_care_registries',
          `Auto-synced Palliative registry from HOSxP clinic 47 (inserted: ${summary.insertedCount}, updated: ${summary.updatedCount}, visitsAdded: ${summary.visitsAddedCount}, skippedLtc: ${summary.skippedLtcCount})`
        )
      } catch (auditErr) {
        logger.error({ auditErr }, 'Failed to write audit log for HOSxP Palliative auto-sync')
      }
    }

    PalliativeRegistryService.syncState.lastSyncAt = Date.now()
    PalliativeRegistryService.syncState.lastSummary = summary

    return summary
  }

  /**
   * Ensures HOSxP Clinic 47 registry sync runs automatically with cooldown & single-flight deduplication.
   */
  static async ensureAutoSynced(
    options: { force?: boolean; actor?: string } = {},
    gateway: Partial<PalliativeGatewayAdapter> = defaultPalliativeGateway
  ): Promise<PalliativeSyncSummary | null> {
    const now = Date.now()
    const { lastSyncAt, lastSummary, inFlight } = PalliativeRegistryService.syncState

    if (!options.force && lastSummary && now - lastSyncAt < AUTO_SYNC_COOLDOWN_MS) {
      return lastSummary
    }

    if (inFlight) {
      if (!options.force) {
        return inFlight
      }
      await inFlight.catch(() => null)
    }

    const promise = PalliativeRegistryService.syncFromHosxp(options, gateway).finally(() => {
      PalliativeRegistryService.syncState.inFlight = null
    })
    PalliativeRegistryService.syncState.inFlight = promise
    return promise
  }

  private static async fetchEnrichmentMaps(
    hns: string[],
    gw: PalliativeGatewayAdapter
  ): Promise<{
    repeclaimMap: Map<string, VisitRepItem[]>
    repdataMap: Map<string, VisitRepItem[]>
    clinicMemberMap: Map<string, string>
    anMap: Map<string, string>
  }> {
    const repeclaimMap = new Map<string, VisitRepItem[]>()
    const repdataMap = new Map<string, VisitRepItem[]>()
    const clinicMemberMap = new Map<string, string>()
    const anMap = new Map<string, string>()

    if (hns.length === 0) {
      return { repeclaimMap, repdataMap, clinicMemberMap, anMap }
    }

    try {
      const enriched = await gw.enrichPalliativeHns(hns)
      for (const row of enriched?.anRows || []) {
        if (row.hn && row.an) anMap.set(String(row.hn).trim(), String(row.an).trim())
      }
      for (const row of enriched?.clinicMembers || []) {
        if (row.hn) clinicMemberMap.set(String(row.hn).trim(), String(row.regdate || ''))
      }
      for (const r of enriched?.repeclaimRows || []) {
        const key = `${String(r.hn || '').trim()}_${String(r.admdate || '').trim()}`
        const list = repeclaimMap.get(key) || []
        list.push({
          rep: String(r.rep || '').trim(),
          compensated: Number(r.compensated || 0),
          source: 'repeclaim',
        })
        repeclaimMap.set(key, list)
      }
      for (const r of enriched?.repdataRows || []) {
        const key = `${String(r.hn || '').trim()}_${String(r.admdate || '').trim()}`
        const list = repdataMap.get(key) || []
        const reason = [r.errorcode, r.remark].filter(Boolean).join(': ') || null
        list.push({
          rep: String(r.rep || '').trim(),
          compensated: Number(r.compensated || 0),
          reason,
          source: 'repdata',
        })
        repdataMap.set(key, list)
      }
    } catch (dbErr) {
      logger.warn({ dbErr }, 'Failed to batch fetch RCM compensations for palliative registries')
    }

    return { repeclaimMap, repdataMap, clinicMemberMap, anMap }
  }

  private static applyEnrichmentToItems(
    items: PalliativeRegistryItem[],
    maps: {
      repeclaimMap: Map<string, VisitRepItem[]>
      repdataMap: Map<string, VisitRepItem[]>
      clinicMemberMap: Map<string, string>
      anMap: Map<string, string>
    },
    ltcHnSet: Set<string>,
    resetUnmatchedRegistrationStatus: boolean
  ) {
    const { repeclaimMap, repdataMap, clinicMemberMap, anMap } = maps

    for (const item of items) {
      const hn = item.hn.trim()
      item.isLtc = ltcHnSet.has(hn) || ltcHnSet.has(hn.padStart(7, '0'))
      item.an = anMap.get(hn) || null
      if (clinicMemberMap.has(hn)) {
        item.registrationStatus = 'ดำเนินการเรียบร้อย'
        item.registeredDate = clinicMemberMap.get(hn) || item.registeredDate || null
      } else if (resetUnmatchedRegistrationStatus && clinicMemberMap.size > 0) {
        item.registrationStatus = 'ยังไม่ได้ดำเนินการ'
        item.registeredDate = null
      }

      if (!item.visits || item.visits.length === 0) {
        item.visits = []
        for (let v = 1; v <= 6; v++) {
          const vd = (item as unknown as Record<string, unknown>)[`visit${v}Date`]
          if (vd && String(vd).trim()) {
            item.visits.push({
              visitNo: v,
              visitDate: String(vd).trim(),
            })
          }
        }
      }

      for (let v = 1; v <= 6; v++) {
        const rec = item as unknown as Record<string, unknown>
        rec[`visit${v}RepItems`] = []
        rec[`visit${v}Rep`] = null
        rec[`visit${v}Compensated`] = 0
        rec[`visit${v}Reason`] = null
      }

      for (const vEntry of item.visits) {
        const vDateRaw = vEntry.visitDate
        if (vDateRaw && vDateRaw.trim()) {
          const normVDate = normalizeRegistryDateToIso(vDateRaw)
          const key = `${hn}_${normVDate}`

          let matchedItems: VisitRepItem[] = repeclaimMap.get(key) || []
          if (matchedItems.length === 0) {
            for (const [k, vList] of repeclaimMap.entries()) {
              if (k.startsWith(`${hn}_`) && (k.includes(normVDate) || normVDate.includes(k.replace(`${hn}_`, '')))) {
                matchedItems = vList
                break
              }
            }
          }

          if (matchedItems.length === 0) {
            matchedItems = repdataMap.get(key) || []
            if (matchedItems.length === 0) {
              for (const [k, vList] of repdataMap.entries()) {
                if (k.startsWith(`${hn}_`) && (k.includes(normVDate) || normVDate.includes(k.replace(`${hn}_`, '')))) {
                  matchedItems = vList
                  break
                }
              }
            }
          }

          if (matchedItems.length > 0) {
            matchedItems.sort((a, b) => b.rep.localeCompare(a.rep, undefined, { numeric: true }))
            const latestRep = matchedItems[0]

            vEntry.repItems = [latestRep]
            vEntry.rep = latestRep.rep
            vEntry.compensated = Number(latestRep.compensated) || 0
            vEntry.reason = latestRep.reason || null

            if (vEntry.visitNo <= 6) {
              const rec = item as unknown as Record<string, unknown>
              rec[`visit${vEntry.visitNo}RepItems`] = [latestRep]
              rec[`visit${vEntry.visitNo}Rep`] = latestRep.rep
              rec[`visit${vEntry.visitNo}Compensated`] = Number(latestRep.compensated) || 0
              rec[`visit${vEntry.visitNo}Reason`] = latestRep.reason || null
            }
          }
        }
      }
    }
  }

  /**
   * List palliative care patient records with search, filters, and real-time HOSxP Clinic 2423 and RCM Rep matching.
   */
  static async listRegistries(
    params: ListRegistriesParams = {},
    gateway: Partial<PalliativeGatewayAdapter> = defaultPalliativeGateway
  ): Promise<{
    items: PalliativeRegistryItem[]
    total: number
    page: number
    limit: number
    totalPages: number
    stats: RegistryStats
    colorCounts?: ColorCounts
    availableFiscalYears?: number[]
    syncInfo?: PalliativeSyncSummary | null
    syncError?: string | null
  }> {
    const gw: PalliativeGatewayAdapter = { ...defaultPalliativeGateway, ...gateway }

    let rawRegs: Array<Record<string, unknown>> | null = null
    let rawVisits: Array<Record<string, unknown>> = []
    let syncInfo: PalliativeSyncSummary | null = null
    let syncError: string | null = null

    if (process.env.NODE_ENV !== 'test') {
      if (params.forceSync) {
        PalliativeRegistryService.invalidateCache()
      }
      if (!params.exportAll) {
        try {
          syncInfo = await PalliativeRegistryService.ensureAutoSynced(
            { force: params.forceSync },
            gw
          )
        } catch (syncErr) {
          logger.warn({ syncErr }, 'HOSxP Clinic 47 auto-sync failed; continuing with existing website registry data')
          syncError = 'ไม่สามารถเชื่อมต่อ HOSxP เพื่อซิงค์ข้อมูลได้ในขณะนี้ ระบบแสดงข้อมูลล่าสุดที่มีอยู่ในทะเบียน'
        }
      }

      try {
        const bundle = await gw.getPalliativeRawBundle()
        if (Array.isArray(bundle?.registries) && bundle.registries.length > 0) {
          rawRegs = bundle.registries
          rawVisits = Array.isArray(bundle.visits) ? bundle.visits : []
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to fetch palliative raw bundle, falling back to paginated gateway endpoint')
      }
    }

    if (rawRegs && rawRegs.length > 0) {
      const visitsByRegId = new Map<number, Array<{ id: number; visitNo: number; visitDate: string }>>()
      for (const v of rawVisits) {
        const regId = Number(v.registry_id)
        const list = visitsByRegId.get(regId) || []
        list.push({
          id: Number(v.id),
          visitNo: Number(v.visit_no),
          visitDate: String(v.visit_date || ''),
        })
        visitsByRegId.set(regId, list)
      }

      const allItems: PalliativeRegistryItem[] = rawRegs.map((r) => {
        const id = Number(r.id)
        const regVisits = visitsByRegId.get(id) || []
        return {
          id,
          hn: String(r.hn || '').trim(),
          patientName: String(r.patient_name || ''),
          address: r.address ? String(r.address) : null,
          phone: r.phone ? String(r.phone) : null,
          icd10Principal: r.icd10_principal ? String(r.icd10_principal) : null,
          icd10Palliative: r.icd10_palliative ? String(r.icd10_palliative) : null,
          projectCode: r.project_code ? String(r.project_code) : null,
          registrationStatus: String(r.registration_status || 'ยังไม่ได้ดำเนินการ'),
          registeredDate: r.registered_date ? String(r.registered_date) : null,
          visit1Date: r.visit_1_date ? String(r.visit_1_date) : null,
          visit2Date: r.visit_2_date ? String(r.visit_2_date) : null,
          visit3Date: r.visit_3_date ? String(r.visit_3_date) : null,
          visit4Date: r.visit_4_date ? String(r.visit_4_date) : null,
          visit5Date: r.visit_5_date ? String(r.visit_5_date) : null,
          visit6Date: r.visit_6_date ? String(r.visit_6_date) : null,
          deathDate: r.death_date ? String(r.death_date) : null,
          createdBy: r.created_by ? String(r.created_by) : null,
          updatedBy: r.updated_by ? String(r.updated_by) : null,
          createdAt: String(r.created_at || ''),
          updatedAt: String(r.updated_at || ''),
          visits: regVisits,
        }
      })

      const now = Date.now()
      let maps: {
        repeclaimMap: Map<string, VisitRepItem[]>
        repdataMap: Map<string, VisitRepItem[]>
        clinicMemberMap: Map<string, string>
        anMap: Map<string, string>
      }

      if (
        PalliativeRegistryService.rcmCache &&
        now - PalliativeRegistryService.rcmCache.timestamp < 60_000
      ) {
        maps = PalliativeRegistryService.rcmCache
      } else {
        const regById = new Map<number, Record<string, unknown>>()
        for (const r of rawRegs) regById.set(Number(r.id), r)
        const hnsWithVisits = [
          ...new Set(
            rawVisits
              .map((v) => {
                const reg = regById.get(Number(v.registry_id))
                return reg?.hn ? String(reg.hn).trim() : null
              })
              .filter(Boolean)
          ),
        ] as string[]

        maps = await PalliativeRegistryService.fetchEnrichmentMaps(hnsWithVisits, gw)
        if (hnsWithVisits.length > 0) {
          PalliativeRegistryService.rcmCache = { ...maps, timestamp: now }
        }
      }

      let ltcHnSet = new Set<string>()
      try {
        ltcHnSet = await LtcRegistryService.getAllLtcHnSet()
      } catch (err) {
        logger.warn({ err }, 'Failed to fetch LTC HNs for palliative item enrichment')
      }

      PalliativeRegistryService.applyEnrichmentToItems(allItems, maps, ltcHnSet, false)

      const fySet = new Set<number>()
      const currentYearDate = new Date()
      const currFy =
        currentYearDate.getMonth() + 1 >= 10
          ? currentYearDate.getFullYear() + 544
          : currentYearDate.getFullYear() + 543
      fySet.add(currFy)
      fySet.add(currFy - 1)
      fySet.add(currFy - 2)
      for (const item of allItems) {
        const fy = getItemFiscalYear(item)
        if (fy) fySet.add(fy)
      }
      const availableFiscalYears = Array.from(fySet).sort((a, b) => b - a)

      let cohort = allItems

      if (params.search && params.search.trim()) {
        const q = params.search.trim().toLowerCase()
        cohort = cohort.filter(
          (i) =>
            i.hn.toLowerCase().includes(q) ||
            i.patientName.toLowerCase().includes(q) ||
            (i.icd10Principal && i.icd10Principal.toLowerCase().includes(q)) ||
            (i.address && i.address.toLowerCase().includes(q)) ||
            (i.phone && i.phone.toLowerCase().includes(q))
        )
      }

      if (params.fiscalYear && params.fiscalYear !== 'ALL') {
        const targetFy = parseInt(String(params.fiscalYear), 10)
        cohort = cohort.filter((i) => getItemFiscalYear(i) === targetFy)
      }

      if (params.registrationStatus && params.registrationStatus !== 'ALL') {
        cohort = cohort.filter((i) => {
          const isReg = Boolean(i.registeredDate || i.registrationStatus === 'ดำเนินการเรียบร้อย')
          if (params.registrationStatus === 'ดำเนินการเรียบร้อย') return isReg
          if (params.registrationStatus === 'ยังไม่ได้ดำเนินการ') return !isReg
          return i.registrationStatus === params.registrationStatus
        })
      }

      const getTotalCompensation = (item: PalliativeRegistryItem): number => {
        let sum = 0
        if (item.visits && item.visits.length > 0) {
          for (const v of item.visits) sum += Number(v.compensated || 0)
        } else {
          for (let v = 1; v <= 6; v++) sum += Number((item as unknown as Record<string, unknown>)[`visit${v}Compensated`] || 0)
        }
        return sum
      }

      const getCompensatedVisitCount = (item: PalliativeRegistryItem): number => {
        let count = 0
        if (item.visits && item.visits.length > 0) {
          for (const v of item.visits) {
            if (Number(v.compensated || 0) > 0) count++
          }
        } else {
          for (let v = 1; v <= 6; v++) {
            if (Number((item as unknown as Record<string, unknown>)[`visit${v}Compensated`] || 0) > 0) count++
          }
        }
        return count
      }

      if (params.compAmount && params.compAmount !== 'ALL') {
        cohort = cohort.filter((i) => {
          const totalComp = getTotalCompensation(i)
          if (params.compAmount === 'PAID') return totalComp > 0
          if (params.compAmount === 'ZERO') return totalComp === 0
          if (params.compAmount === '1_1000') return totalComp >= 1 && totalComp <= 1000
          if (params.compAmount === '1001_3000') return totalComp > 1000 && totalComp <= 3000
          if (params.compAmount === '3001_5000') return totalComp > 3000 && totalComp <= 5000
          if (params.compAmount === '5001_10000') return totalComp > 5000 && totalComp <= 10000
          if (params.compAmount === 'OVER_10000') return totalComp > 10000
          return true
        })
      }

      if (params.compVisits && params.compVisits !== 'ALL') {
        cohort = cohort.filter((i) => {
          const count = getCompensatedVisitCount(i)
          if (params.compVisits === 'HAS_COMP') return count >= 1
          if (params.compVisits === '0') return count === 0
          if (params.compVisits === '1') return count === 1
          if (params.compVisits === '2') return count === 2
          if (params.compVisits === '3') return count === 3
          if (params.compVisits === '4') return count === 4
          if (params.compVisits === '5') return count === 5
          if (params.compVisits === '6') return count === 6
          if (params.compVisits === '7_PLUS') return count >= 7
          return true
        })
      }

      let greenCount = 0
      let orangeCount = 0
      let orangeWaitingRepCount = 0
      let pinkCount = 0

      for (const item of cohort) {
        const isDeceased = Boolean(item.deathDate && item.deathDate.trim())
        const isReg = Boolean(item.registeredDate || item.registrationStatus === 'ดำเนินการเรียบร้อย')
        const hasComp = getTotalCompensation(item) > 0

        if (isDeceased) {
          pinkCount++
        } else if (hasComp) {
          greenCount++
        } else {
          orangeCount++
          if (isReg) orangeWaitingRepCount++
        }
      }

      const colorCounts: ColorCounts = {
        total: cohort.length,
        green: greenCount,
        orange: orangeCount,
        orangeWaitingRep: orangeWaitingRepCount,
        pink: pinkCount,
      }

      let filteredList = cohort
      if (params.color && params.color !== 'ALL') {
        filteredList = filteredList.filter((item) => {
          const isDeceased = Boolean(item.deathDate && item.deathDate.trim())
          const isReg = Boolean(item.registeredDate || item.registrationStatus === 'ดำเนินการเรียบร้อย')
          const hasComp = getTotalCompensation(item) > 0

          if (params.color === 'PINK') return isDeceased
          if (params.color === 'GREEN') return !isDeceased && hasComp
          if (params.color === 'ORANGE') return !isDeceased && !hasComp
          if (params.color === 'ORANGE_WAITING_REP') return !isDeceased && isReg && !hasComp
          return true
        })
      }

      let registered = 0
      let pendingRegistration = 0
      let paid = 0
      let waitingComp = 0
      let deceased = 0

      for (const item of filteredList) {
        const isDeceased = Boolean(item.deathDate && item.deathDate.trim())
        const isReg = Boolean(item.registeredDate || item.registrationStatus === 'ดำเนินการเรียบร้อย')
        const hasComp = getTotalCompensation(item) > 0

        if (isReg) registered++
        else pendingRegistration++

        if (isDeceased) deceased++
        else if (hasComp) paid++
        else waitingComp++
      }

      const stats: RegistryStats = {
        total: filteredList.length,
        registered,
        pendingRegistration,
        claimed: paid,
        paid,
        waitingComp,
        deceased,
        deny: 0,
      }

      const total = filteredList.length
      const page = Math.max(1, params.page || 1)
      const limit = params.exportAll ? Math.max(total, 1) : Math.max(1, params.limit || 50)
      const totalPages = Math.max(1, Math.ceil(total / limit))
      const pagedItems = params.exportAll
        ? filteredList
        : filteredList.slice((page - 1) * limit, page * limit)

      return {
        items: pagedItems,
        total,
        page,
        limit,
        totalPages,
        stats,
        colorCounts,
        availableFiscalYears,
        syncInfo,
        syncError,
      }
    }

    // ── Paginated Gateway Branch (also used in unit tests) ──
    const res = await apiGateway.app.getPalliativeRegistries({
      search: params.search,
      registrationStatus: params.registrationStatus,
      claimStatus: params.claimStatus,
      claimResult: params.claimResult,
      page: params.page,
      limit: params.limit,
    })

    const items = (res.items || []) as PalliativeRegistryItem[]
    const total = res.total || 0
    const page = res.page || 1
    const limit = res.limit || 50
    const totalPages = res.totalPages || 1

    if (items.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 1,
        stats: { total: 0, registered: 0, pendingRegistration: 0, claimed: 0, paid: 0, deny: 0 },
      }
    }

    const hns = [...new Set(items.map((i) => i.hn.trim()).filter(Boolean))]
    const maps = await PalliativeRegistryService.fetchEnrichmentMaps(hns, gw)

    let fallbackLtcHnSet = new Set<string>()
    try {
      fallbackLtcHnSet = await LtcRegistryService.getAllLtcHnSet()
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch LTC HNs for palliative fallback item enrichment')
    }

    PalliativeRegistryService.applyEnrichmentToItems(items, maps, fallbackLtcHnSet, true)

    const registeredCount =
      maps.clinicMemberMap.size > 0
        ? items.filter((i) => i.registrationStatus === 'ดำเนินการเรียบร้อย').length
        : res.stats?.registered ?? items.filter((i) => i.registrationStatus === 'ดำเนินการเรียบร้อย').length

    const pendingCount =
      maps.clinicMemberMap.size > 0
        ? items.length - registeredCount
        : res.stats?.pendingRegistration ?? (items.length - registeredCount)

    let paidCount = 0
    let claimedCount = 0
    for (const item of items) {
      let hasRep = false
      let hasComp = false
      if (item.visits && item.visits.length > 0) {
        for (const v of item.visits) {
          if (v.rep) hasRep = true
          if ((v.compensated || 0) > 0) hasComp = true
        }
      } else {
        for (let v = 1; v <= 6; v++) {
          const rec = item as unknown as Record<string, unknown>
          if (rec[`visit${v}Rep`]) hasRep = true
          if (Number(rec[`visit${v}Compensated`] || 0) > 0) hasComp = true
        }
      }
      if (hasRep) claimedCount++
      if (hasComp) paidCount++
    }

    const hasData = maps.repeclaimMap.size > 0 || maps.repdataMap.size > 0
    const stats: RegistryStats = {
      total: res.stats?.total || total,
      registered: registeredCount,
      pendingRegistration: pendingCount,
      claimed: hasData ? claimedCount : (res.stats?.claimed ?? claimedCount),
      paid: hasData ? paidCount : (res.stats?.paid ?? paidCount),
      deny: res.stats?.deny || 0,
    }

    let finalItems = items
    if (params.compAmount && params.compAmount !== 'ALL') {
      finalItems = finalItems.filter((i) => {
        let sum = 0
        if (i.visits && i.visits.length > 0) {
          for (const v of i.visits) sum += Number(v.compensated || 0)
        } else {
          for (let v = 1; v <= 6; v++) sum += Number((i as unknown as Record<string, unknown>)[`visit${v}Compensated`] || 0)
        }
        if (params.compAmount === 'PAID') return sum > 0
        if (params.compAmount === 'ZERO') return sum === 0
        if (params.compAmount === '1_1000') return sum >= 1 && sum <= 1000
        if (params.compAmount === '1001_3000') return sum > 1000 && sum <= 3000
        if (params.compAmount === '3001_5000') return sum > 3000 && sum <= 5000
        if (params.compAmount === '5001_10000') return sum > 5000 && sum <= 10000
        if (params.compAmount === 'OVER_10000') return sum > 10000
        return true
      })
    }

    if (params.compVisits && params.compVisits !== 'ALL') {
      finalItems = finalItems.filter((i) => {
        let count = 0
        if (i.visits && i.visits.length > 0) {
          for (const v of i.visits) {
            if (Number(v.compensated || 0) > 0) count++
          }
        } else {
          for (let v = 1; v <= 6; v++) {
            if (Number((i as unknown as Record<string, unknown>)[`visit${v}Compensated`] || 0) > 0) count++
          }
        }
        if (params.compVisits === 'HAS_COMP') return count >= 1
        if (params.compVisits === '0') return count === 0
        if (params.compVisits === '1') return count === 1
        if (params.compVisits === '2') return count === 2
        if (params.compVisits === '3') return count === 3
        if (params.compVisits === '4') return count === 4
        if (params.compVisits === '5') return count === 5
        if (params.compVisits === '6') return count === 6
        if (params.compVisits === '7_PLUS') return count >= 7
        return true
      })
    }

    return {
      items: finalItems,
      total: finalItems.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(finalItems.length / limit)),
      stats,
    }
  }

  static async getRegistryById(id: number): Promise<PalliativeRegistryItem | null> {
    try {
      const res = await apiGateway.app.getPalliativeRegistryById(id)
      return (res?.data || res) as unknown as PalliativeRegistryItem
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 404) return null
      throw err
    }
  }

  static async createRegistry(
    data: {
      hn: string
      patientName: string
      address?: string | null
      phone?: string | null
      icd10Principal?: string | null
      icd10Palliative?: string | null
      projectCode?: string | null
      registrationStatus?: string
      registeredDate?: string | null
      visit1Date?: string | null
      visit2Date?: string | null
      visit3Date?: string | null
      visit4Date?: string | null
      visit5Date?: string | null
      visit6Date?: string | null
      deathDate?: string | null
      visits?: Array<{ visitNo: number; visitDate: string }>
    },
    actor?: string
  ): Promise<PalliativeRegistryItem> {
    const cleanHn = /^\d+$/.test(data.hn.trim()) ? data.hn.trim().padStart(7, '0') : data.hn.trim()

    const isLtc = await LtcRegistryService.isPatientInLtc(cleanHn)
    if (isLtc) {
      throw new Error('ผู้ป่วยรายนี้มีรายชื่อในทะเบียน Long Term Care (LTC) แล้ว ไม่สามารถลงทะเบียน Palliative Care ได้')
    }

    try {
      const existingRes = await apiGateway.app.getPalliativeRegistryByHn(cleanHn)
      if (existingRes?.exists && existingRes.data) {
        throw new Error(
          `ผู้ป่วยรายนี้ (HN: ${cleanHn} - ${existingRes.data.patientName}) มีข้อมูลในทะเบียน Palliative Care แล้ว ห้ามลงข้อมูลซ้ำ`
        )
      }
    } catch (err: unknown) {
      if ((err as Error)?.message?.includes('มีข้อมูลในทะเบียน')) {
        throw err
      }
      logger.warn({ err }, 'Duplicate check query error in createRegistry')
    }

    const vMap = new Map<number, string>()
    if (Array.isArray(data.visits)) {
      data.visits.forEach((v) => {
        if (v && v.visitNo && v.visitDate) vMap.set(Number(v.visitNo), String(v.visitDate).trim())
      })
    }

    const payload = {
      hn: data.hn.trim(),
      patientName: data.patientName.trim(),
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      icd10Principal: data.icd10Principal?.trim() || null,
      icd10Palliative: data.icd10Palliative?.trim() || 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)',
      projectCode: data.projectCode?.trim() || '30001, Cons01',
      registrationStatus: data.registrationStatus || 'ยังไม่ได้ดำเนินการ',
      registeredDate: data.registeredDate || null,
      visit1Date: vMap.get(1) ?? data.visit1Date ?? null,
      visit2Date: vMap.get(2) ?? data.visit2Date ?? null,
      visit3Date: vMap.get(3) ?? data.visit3Date ?? null,
      visit4Date: vMap.get(4) ?? data.visit4Date ?? null,
      visit5Date: vMap.get(5) ?? data.visit5Date ?? null,
      visit6Date: vMap.get(6) ?? data.visit6Date ?? null,
      deathDate: data.deathDate || null,
      createdBy: actor || null,
      visits: data.visits || undefined,
    }

    const res = await apiGateway.app.createPalliativeRegistry(payload)
    PalliativeRegistryService.invalidateCache()
    const record = await this.getRegistryById(res.insertId)

    try {
      await logAudit(
        'CREATE',
        'palliative_care_registries',
        `Created palliative care patient record id: ${res.insertId}, HN: ${data.hn}`
      )
    } catch (err) {
      logger.error({ err }, 'Audit log failed for createRegistry')
    }

    return (
      record ||
      ({
        id: res.insertId,
        ...payload,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actor || null,
      } as unknown as PalliativeRegistryItem)
    )
  }

  static async updateRegistry(
    id: number,
    data: Partial<PalliativeRegistryItem>,
    actor?: string
  ): Promise<PalliativeRegistryItem> {
    const updateData: Record<string, unknown> = { ...data }
    delete updateData.id
    delete updateData.createdAt
    delete updateData.updatedAt
    updateData.updatedBy = actor || null

    if (Array.isArray(updateData.visits)) {
      const vMap = new Map<number, string>()
      updateData.visits.forEach((v: { visitNo?: number; visitDate?: string }) => {
        if (v && v.visitNo && v.visitDate) vMap.set(Number(v.visitNo), String(v.visitDate).trim())
      })
      if (vMap.has(1)) updateData.visit1Date = vMap.get(1) || null
      if (vMap.has(2)) updateData.visit2Date = vMap.get(2) || null
      if (vMap.has(3)) updateData.visit3Date = vMap.get(3) || null
      if (vMap.has(4)) updateData.visit4Date = vMap.get(4) || null
      if (vMap.has(5)) updateData.visit5Date = vMap.get(5) || null
      if (vMap.has(6)) updateData.visit6Date = vMap.get(6) || null
    }

    await apiGateway.app.updatePalliativeRegistry(id, updateData)
    PalliativeRegistryService.invalidateCache()
    const record = await this.getRegistryById(id)

    try {
      await logAudit(
        'UPDATE',
        'palliative_care_registries',
        `Updated palliative care patient record id: ${id}, HN: ${record?.hn || 'unknown'}`
      )
    } catch (err) {
      logger.error({ err }, 'Audit log failed for updateRegistry')
    }

    return (
      record ||
      ({
        id,
        ...updateData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as PalliativeRegistryItem)
    )
  }

  static async deleteRegistry(id: number, actor?: string): Promise<{ success: boolean }> {
    const record = await this.getRegistryById(id)

    await apiGateway.app.deletePalliativeRegistry(id)
    PalliativeRegistryService.invalidateCache()

    try {
      await logAudit(
        'DELETE',
        'palliative_care_registries',
        `Deleted palliative care patient record id: ${id}, HN: ${record?.hn || 'unknown'}`
      )
    } catch (err) {
      logger.error({ err }, 'Audit log failed for deleteRegistry')
    }

    return { success: true }
  }
}
