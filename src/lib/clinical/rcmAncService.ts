import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'
import { resolveFiscalDateRange, type FiscalDateRangeParams } from './rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  fetchAdpMappingViaGateway,
  resolveSeamlessFetcher,
  type RcmFundGatewayAdapter,
} from './rcmFundGatewayHelper'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── 1. Domain Types: 2.4 บริการฝากครรภ์ (ANC 30011) ──────────────────────

export type AncCompensationFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'HAS_AUTHEN'
  | 'NO_AUTHEN'

export type AncSearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN' | 'DIAG' | 'PTTYPE'

export type AncSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface AncService30011Params extends FiscalDateRangeParams {
  compensationFilter?: AncCompensationFilter
  pttypes?: string
  reps?: string
  ucOnly?: boolean
  searchField?: AncSearchField
  search?: string
  sortBy?: AncSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface AncAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface AncAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: AncAdpMappingItem[]
}

export interface AncService30011Item {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  age: number | null
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  pttypename: string | null
  pttype_eclaim_id?: string | null
  isUc?: boolean
  department: string | null
  clinic: string | null
  pdx: string | null
  dx0: string | null
  dx1: string | null
  dx2: string | null
  dx3: string | null
  dx4: string | null
  dx5: string | null
  op0: string | null
  op1: string | null
  op2: string | null
  op3: string | null
  op4: string | null
  op5: string | null
  operation: string | null
  listname: string | null
  listname1: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
}

export interface AncService30011Summary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  withAuthenCount: number
  withoutAuthenCount: number
  withPdxCount: number
  withOpCount: number
}

export interface AncService30011Result {
  ds1: string
  ds2: string
  adpMapping: AncAdpMappingCheck
  compensationFilter: AncCompensationFilter
  searchField: AncSearchField
  search: string
  sortBy: AncSortField
  sortOrder: 'asc' | 'desc'
  summary: AncService30011Summary
  repBreakdown?: RepBreakdownSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: AncService30011Item[]
}

// ── 2. Service Implementation ──────────────────────────────────────────

export class RcmAncService {
  /**
   * Checks whether NHSO ADP code 30011 is mapped in HOSxP `s_drugitems` table via API Gateway.
   */
  static async check30011AdpMapping(
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<AncAdpMappingCheck> {
    const res = await fetchAdpMappingViaGateway('30011', gateway)
    return {
      isMapped: res.isMapped,
      mappedCount: res.mappedCount,
      items: res.items,
    }
  }

  /**
   * Retrieves ANC Service 30011 report via API Gateway Named Endpoint.
   */
  static async getService30011Report(
    params: AncService30011Params = {},
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<AncService30011Result> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const compensationFilter: AncCompensationFilter = params.compensationFilter || 'ALL'
    const searchField: AncSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: AncSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const exportAll = Boolean(params.exportAll)
    const pageSize = exportAll ? 1_000_000 : Math.max(1, Number(params.pageSize || 50))

    const cacheKey = `rcm-anc-2-4-30011-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mRes, gwRes] = await Promise.all([
          RcmAncService.check30011AdpMapping(gateway),
          gateway.getRcmFundData('anc-30011', { ds1, ds2, adpCode: '30011' }),
        ])
        return {
          rawRows: extractFundRawRows<Record<string, unknown>>(gwRes),
          adpMapping: mRes,
        }
      },
      600
    )

    const allItems: AncService30011Item[] = rawRows.map((r, idx) => {
      const compensated = Number(r.compensated || 0)
      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        age: r.age != null ? Number(r.age) : null,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        pttypename: r.pttypename ? String(r.pttypename).trim() : null,
        pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
        isUc: isUcEclaimCode(r.pttype_eclaim_id ? String(r.pttype_eclaim_id) : null),
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        operation: null,
        listname: r.listname ? String(r.listname).trim() : null,
        listname1: r.listname1 ? String(r.listname1).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: compensated > 0,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
      }
    })

    const enrichedAllItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      resolveSeamlessFetcher(gateway),
      Boolean(params.refresh)
    )

    // Full Page Filter: Apply pttypes / ucOnly filter across all cohort items before summary & pagination
    const summaryCohort = enrichedAllItems.filter((i) => {
      if (params.pttypes !== undefined) {
        return matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      }
      if (params.ucOnly) {
        return i.isUc ?? false
      }
      return true
    })

    // Calculate Summary Metrics on summaryCohort
    const totalVisits = summaryCohort.length
    const uniqueHns = new Set(summaryCohort.map((i) => i.hn).filter(Boolean))
    const uniquePatients = uniqueHns.size

    let compensatedVisits = 0
    let uncompensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let withPdxCount = 0
    let withOpCount = 0

    for (const item of summaryCohort) {
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      } else {
        uncompensatedVisits++
      }

      if (item.authencode) withAuthenCount++
      else withoutAuthenCount++

      if (item.pdx) withPdxCount++
      if (item.op0 || item.op1 || item.op2 || item.op3 || item.op4 || item.op5) {
        withOpCount++
      }
    }

    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0

    const summary: AncService30011Summary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated: Number(totalCompensated.toFixed(2)),
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      withPdxCount,
      withOpCount,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedRepsList = parseRepFilterParam(params.reps)

    // Apply Filter & Search
    let filtered = summaryCohort

    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (compensationFilter === 'HAS_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (compensationFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }
    if (selectedRepsList.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedRepsList))
    }

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'PTTYPE') return (i.pttypename || '').toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          const dxStr = [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return dxStr.includes(search)
        }
        // ALL
        if (matchesSeamlessRepSearch(i, search)) return true
        const fullStr = [
          i.hn,
          i.cid,
          i.ptname,
          i.vn,
          i.pdx,
          i.dx0,
          i.dx1,
          i.op0,
          i.pttypename,
          i.department,
          i.status,
          i.rep,
          i.authencode,
          i.listname,
          i.listname1,
          i.fund,
          i.subfund,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return fullStr.includes(search)
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (valA == null && valB == null) return 0
      if (valA == null) return sortOrder === 'asc' ? -1 : 1
      if (valB == null) return sortOrder === 'asc' ? 1 : -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      valA = String(valA).toLowerCase()
      valB = String(valB).toLowerCase()
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let items: AncService30011Item[]
    if (exportAll) {
      items = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      items = filtered.slice(startIndex, startIndex + pageSize).map((item, idx) => ({
        ...item,
        no: startIndex + idx + 1,
      }))
    }

    return {
      ds1,
      ds2,
      adpMapping,
      compensationFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      repBreakdown,
      totalCount,
      page,
      pageSize,
      totalPages,
      items,
    }
  }

  // ── 3. Section 2.3: หญิงตั้งครรภ์ US - ตรวจช่องปาก - ขัดฟัน ───────────────────

  /**
   * 2.3 หญิงตั้งครรภ์ ได้รับบริการตรวจ Ultrasound - ตรวจช่องปาก - ขัดทำความสะอาดฟัน
   * Reconciles pregnancy care records across 5 streams:
   * 1. Dental Care visits (dental_care_type_id = 1)
   * 2. Ultrasound diagnoses (ovstdiag icd10 REGEXP '887[6-9]' for females in person_anc)
   * 3. Ultrasound service items in opitemrece + nondrugitems
   * 4. ANC services in person_anc_service (anc_service_type_id = 1)
   * 5. Pregnant women in person_anc within 24 weeks of LMP
   * 
   * Merges clinical HOSxP data with claim reimbursement status (NHSO, Rep, NewEclaim, EClaim).
   */
  static async getAncService23Report(
    params: AncService23Params = {},
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<AncService23Result> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: AncService23CardFilter = params.cardFilter || 'ALL'
    const serviceFilter: 'ALL' | 'OK' | 'NOT_OK' = params.serviceFilter || 'ALL'
    const ucFilter: 'ALL' | 'UC' | 'NON_UC' = params.ucFilter || 'ALL'
    const statusFilter = (params.statusFilter || '').trim()
    const searchField: AncService23SearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: AncService23SortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const exportAll = Boolean(params.exportAll)
    const pageSize = exportAll ? 1_000_000 : Math.max(1, Number(params.pageSize || 50))

    const cacheKey = `rcm-anc-service-2-3-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const allRows: AncService23Item[] = await getCachedData(
      cacheKey,
      async () => {
        const gwRes = await gateway.getRcmFundData('anc-23', { ds1, ds2, serviceType: '2.3' })
        const rows = extractFundRawRows<Record<string, unknown>>(gwRes)

        return rows.map((r) => {
          const groupIdNum = Number(r.group_id_num || 0)
          const groupIdPad = String(groupIdNum).padStart(4, '0') // e.g. '1111'
          // groupIdPad: [1000: service, 100: oper, 10: anc, 1: dent]
          const isService = groupIdPad[0] === '1'
          const isOper = groupIdPad[1] === '1'
          const isAnc = groupIdPad[2] === '1'
          const isDent = groupIdPad[3] === '1'

          const groupParts: string[] = []
          if (isAnc) groupParts.push('ANC')
          if (isDent) groupParts.push('บริการทันตกรรม')
          if (isService || isOper) groupParts.push('Ultrasound')
          const groupname = groupParts.join(' & ') || '—'

          const operVal = r.oper ? String(r.oper) : null
          const serviceNameVal = r.servicename ? String(r.servicename) : null
          const usVal: string | null = operVal ? 'Y' : serviceNameVal ? 'S' : null

          const checkupVal: string | null = r.checkup === 'Y' ? 'Y' : null
          const scallingVal: string | null = r.scalling === 'Y' ? 'Y' : null

          // ok is 'Y' when ultrasound or dental care is provided
          const okVal: string | null =
            serviceNameVal || operVal || checkupVal === 'Y' || scallingVal === 'Y' ? 'Y' : null

          const rawGa = r.ga !== null && r.ga !== undefined ? Number(r.ga) : null
          let ancTrimester: string | null = null
          if (rawGa !== null) {
            if (rawGa >= 32 && rawGa <= 40) ancTrimester = '5'
            else if (rawGa >= 26 && rawGa <= 31) ancTrimester = '4'
            else if (rawGa >= 20 && rawGa <= 25) ancTrimester = '3'
            else if (rawGa >= 13 && rawGa <= 19) ancTrimester = '2'
            else if (rawGa >= 4 && rawGa <= 12) ancTrimester = '1'
          }

          const rawItemName = r.itemname ? String(r.itemname).replace(/^,|,$/g, '').trim() : null
          const rawLmp = r.lmp ? String(r.lmp) : null

          // Validation Warnings (FoxPro `mean`)
          const warnings: string[] = []
          if (okVal === 'Y' && (!rawItemName || rawItemName === '')) {
            warnings.push('ไม่มีหัตถการ')
          }
          if (okVal === 'Y' && (!rawLmp || rawLmp === '')) {
            warnings.push('ไม่มี LMP')
          }
          if (rawGa !== null && rawGa > 48) {
            warnings.push('อายุครรภ์เกินเกณฑ์ (>48 สัปดาห์)')
          }
          const meanVal = warnings.length > 0 ? warnings.join(', ') : null

          const compensatedVal = Number(r.compensated || 0)

          return {
            vn: String(r.vn || ''),
            hn: String(r.hn || ''),
            cid: String(r.cid || ''),
            person_id: r.person_id ? Number(r.person_id) : null,
            ptname: String(r.ptname || '').trim(),
            sex: String(r.sex || '2') === '1' ? 'ชาย' : 'หญิง',
            age: r.age !== null && r.age !== undefined ? Number(r.age) : null,
            nation: r.nation ? String(r.nation) : null,
            vstdate: String(r.vstdate || ''),
            vsttime: r.vsttime ? String(r.vsttime) : null,
            camedate: String(r.vstdate || ''),
            room: r.room ? String(r.room) : null,
            pttypename_patient: r.pttypename_patient ? String(r.pttypename_patient) : null,
            pttypename_visit: r.pttypename_visit ? String(r.pttypename_visit) : null,
            pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
            uc: String(r.uc || ' '),
            authencode: r.authencode ? String(r.authencode) : null,
            group_id: groupIdPad,
            groupname,
            preg_no: r.preg_no ? String(r.preg_no) : null,
            ga: rawGa,
            lmp: rawLmp,
            lastdate: r.lastdate ? String(r.lastdate) : null,
            pregnancy: r.pregnancy ? String(r.pregnancy) : null,
            labor_date: r.labor_date ? String(r.labor_date) : null,
            dchdate: r.dchdate ? String(r.dchdate) : null,
            anc: ancTrimester,
            servicename: serviceNameVal,
            oper: operVal,
            us: usVal,
            checkup: checkupVal,
            scalling: scallingVal,
            service_date: r.service_date ? String(r.service_date) : null,
            itemname: rawItemName,
            ok: okVal,
            doctor: r.doctor ? String(r.doctor) : null,
            typearea: r.typearea ? String(r.typearea) : null,
            address: r.address ? String(r.address).trim() : null,
            tel: r.tel ? String(r.tel).trim() : null,
            eclaim_no: r.eclaim_no ? String(r.eclaim_no) : null,
            status_eclaim: r.status_eclaim ? String(r.status_eclaim) : '- :: ยังไม่ได้ส่ง',
            service: r.service ? String(r.service) : null,
            compensated: compensatedVal,
            isCompensated: compensatedVal > 0,
            rep: r.rep ? String(r.rep) : null,
            fund: r.fund ? String(r.fund) : null,
            subfund: r.subfund ? String(r.subfund) : null,
            mean: meanVal,
          }
        })
      },
      300000 // 5 minutes cache TTL
    )

    const enrichedAllRows = await enrichItemsWithSeamlessCache(
      cacheKey,
      allRows,
      resolveSeamlessFetcher(gateway),
      Boolean(params.refresh)
    )
    const pttypes = (params.pttypes || '').trim()
    const selectedPttypesList = pttypes ? pttypes.split(',').map((s) => s.trim()).filter(Boolean) : []

    // Cohort for summary KPIs:
    // If pttypes filter is applied, compute summary KPIs based on matching pttypes (Full Page Filter Q2: A)
    const summaryCohort = selectedPttypesList.length > 0
      ? enrichedAllRows.filter((i) => matchesPttypeFilter((i as any).pttypename || i.pttypename_visit || i.pttype_eclaim_id, selectedPttypesList, i.uc === 'Y', i.pttype_eclaim_id))
      : enrichedAllRows

    // Compute Summary KPIs on the eligible cohort
    const totalVisits = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn).filter(Boolean)).size
    const serviceOkCount = summaryCohort.filter((i) => i.ok === 'Y').length
    const checkupCount = summaryCohort.filter((i) => i.checkup === 'Y').length
    const scallingCount = summaryCohort.filter((i) => i.scalling === 'Y').length
    const ultrasoundCount = summaryCohort.filter((i) => i.us !== null).length
    const ucCount = summaryCohort.filter((i) => i.uc === 'Y').length
    const compensatedCount = summaryCohort.filter((i) => i.compensated > 0).length
    const uncompensatedCount = totalVisits - compensatedCount
    const compensationRate = totalVisits > 0 ? Number(((compensatedCount / totalVisits) * 100).toFixed(2)) : 0
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const averageCompensated = compensatedCount > 0 ? Number((totalCompensated / compensatedCount).toFixed(2)) : 0
    const warningCount = summaryCohort.filter((i) => Boolean(i.mean)).length

    const summary: AncService23Summary = {
      totalVisits,
      uniquePatients,
      serviceOkCount,
      checkupCount,
      scallingCount,
      ultrasoundCount,
      ucCount,
      compensatedCount,
      uncompensatedCount,
      compensationRate,
      totalCompensated,
      averageCompensated,
      warningCount,
    }

    // Available status options for dropdown
    const statusOptions = Array.from(
      new Set(summaryCohort.map((i) => i.status_eclaim).filter(Boolean))
    ).sort() as string[]

    // Apply Card Filter (Interactive KPI Cards)
    let filtered = summaryCohort
    if (cardFilter === 'SERVICE_OK') {
      filtered = filtered.filter((i) => i.ok === 'Y')
    } else if (cardFilter === 'CHECKUP') {
      filtered = filtered.filter((i) => i.checkup === 'Y')
    } else if (cardFilter === 'SCALLING') {
      filtered = filtered.filter((i) => i.scalling === 'Y')
    } else if (cardFilter === 'ULTRASOUND') {
      filtered = filtered.filter((i) => i.us !== null)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.uc === 'Y')
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.compensated > 0)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => i.compensated === 0)
    } else if (cardFilter === 'WARNINGS') {
      filtered = filtered.filter((i) => Boolean(i.mean))
    }

    // Apply Secondary Service Filter
    if (serviceFilter === 'OK') {
      filtered = filtered.filter((i) => i.ok === 'Y')
    } else if (serviceFilter === 'NOT_OK') {
      filtered = filtered.filter((i) => i.ok !== 'Y')
    }

    // Apply UC Filter (only when pttypes is not selected)
    if (selectedPttypesList.length === 0) {
      if (ucFilter === 'UC') {
        filtered = filtered.filter((i) => i.uc === 'Y')
      } else if (ucFilter === 'NON_UC') {
        filtered = filtered.filter((i) => i.uc !== 'Y')
      }
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedRepsList = parseRepFilterParam(params.reps)

    // Apply Status E-Claim Filter
    if (statusFilter && statusFilter !== 'ALL') {
      filtered = filtered.filter((i) => i.status_eclaim === statusFilter)
    }
    if (selectedRepsList.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedRepsList))
    }

    // Apply Search Filter
    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') {
          return i.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          const cleanCid = i.cid.replace(/\D/g, '')
          return cleanCid.includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return i.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return i.vn.toLowerCase().includes(search)
        }
        if (searchField === 'AUTHEN') {
          return (i.authencode || '').toLowerCase().includes(search)
        }
        if (searchField === 'ITEMNAME') {
          return (i.itemname || '').toLowerCase().includes(search)
        }

        // searchField === 'ALL'
        const cleanQ = search.replace(/\D/g, '')
        const matchCid = cleanQ && cleanQ.length >= 3 && i.cid.replace(/\D/g, '').includes(cleanQ)
        const matchText =
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.itemname && i.itemname.toLowerCase().includes(search)) ||
          (i.groupname && i.groupname.toLowerCase().includes(search)) ||
          (i.status_eclaim && i.status_eclaim.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search))

        return matchText || matchCid
      })
    }

    // Apply Sorting
    const sorted = [...filtered].sort((a, b) => {
      let valA: string | number = ''
      let valB: string | number = ''

      switch (sortBy) {
        case 'vstdate':
          valA = `${a.vstdate} ${a.vsttime || ''}`
          valB = `${b.vstdate} ${b.vsttime || ''}`
          break
        case 'hn':
          valA = a.hn
          valB = b.hn
          break
        case 'cid':
          valA = a.cid
          valB = b.cid
          break
        case 'ptname':
          valA = a.ptname
          valB = b.ptname
          break
        case 'age':
          valA = a.age ?? -1
          valB = b.age ?? -1
          break
        case 'ga':
          valA = a.ga ?? -1
          valB = b.ga ?? -1
          break
        case 'compensated':
          valA = a.compensated
          valB = b.compensated
          break
        case 'authencode':
          valA = a.authencode || ''
          valB = b.authencode || ''
          break
        case 'groupname':
          valA = a.groupname || ''
          valB = b.groupname || ''
          break
        default:
          valA = a.vstdate
          valB = b.vstdate
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    const totalCount = sorted.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const safePage = Math.min(page, totalPages)

    const slice = exportAll ? sorted : sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
    const offset = exportAll ? 0 : (safePage - 1) * pageSize

    const numberedItems = slice.map((item, idx) => ({
      ...item,
      no: offset + idx + 1,
    }))

    return {
      ds1,
      ds2,
      cardFilter,
      serviceFilter,
      ucFilter,
      pttypes,
      statusFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      repBreakdown,
      statusOptions,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
    }
  }
}

// ── 4. Domain Types: ANC 2.3 หญิงตั้งครรภ์ US - ตรวจช่องปาก - ขัดฟัน ─────────

export type AncService23CardFilter =
  | 'ALL'
  | 'SERVICE_OK'
  | 'CHECKUP'
  | 'SCALLING'
  | 'ULTRASOUND'
  | 'UC_ONLY'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WARNINGS'

export type AncService23SearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN' | 'AUTHEN' | 'ITEMNAME'

export type AncService23SortField =
  | 'vstdate'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'ga'
  | 'compensated'
  | 'authencode'
  | 'groupname'

export interface AncService23Params extends FiscalDateRangeParams {
  cardFilter?: AncService23CardFilter
  serviceFilter?: 'ALL' | 'OK' | 'NOT_OK'
  ucFilter?: 'ALL' | 'UC' | 'NON_UC'
  pttypes?: string
  reps?: string
  statusFilter?: string
  searchField?: AncService23SearchField
  search?: string
  sortBy?: AncService23SortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface AncService23Item {
  no?: number
  vn: string
  hn: string
  cid: string
  person_id: number | null
  ptname: string
  sex: string
  age: number | null
  nation: string | null
  vstdate: string // YYYY-MM-DD
  vsttime: string | null
  camedate: string
  room: string | null
  pttypename_patient: string | null
  pttypename_visit: string | null
  pttype_eclaim_id?: string | null
  uc: string // 'Y' | ' '
  authencode: string | null
  group_id: string
  groupname: string
  preg_no: number | string | null
  ga: number | null
  lmp: string | null
  lastdate: string | null
  pregnancy: string | null
  labor_date: string | null
  dchdate: string | null
  anc: string | null // '1' | '2' | '3' | '4' | '5' | null
  servicename: string | null
  oper: string | null
  us: string | null // 'Y' | 'S' | null
  checkup: string | null // 'Y' | null
  scalling: string | null // 'Y' | null
  service_date: string | null
  itemname: string | null
  ok: string | null // 'Y' | null
  doctor: string | null
  typearea: string | null
  address: string | null
  tel: string | null
  eclaim_no: string | null
  status_eclaim: string | null
  service: string | null
  compensated: number
  isCompensated: boolean
  rep: string | null
  fund: string | null
  subfund: string | null
  mean: string | null // validation notes: 'ไม่มีหัตถการ', 'ไม่มี LMP', 'อายุครรภ์เกินเกณฑ์ (>48 สัปดาห์)'
}

export interface AncService23Summary {
  totalVisits: number
  uniquePatients: number
  serviceOkCount: number
  checkupCount: number
  scallingCount: number
  ultrasoundCount: number
  ucCount: number
  compensatedCount: number
  uncompensatedCount: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  warningCount: number
}

export interface AncService23Result {
  ds1: string
  ds2: string
  cardFilter: AncService23CardFilter
  serviceFilter: 'ALL' | 'OK' | 'NOT_OK'
  ucFilter: 'ALL' | 'UC' | 'NON_UC'
  pttypes?: string
  statusFilter: string
  searchField: AncService23SearchField
  sortBy: AncService23SortField
  sortOrder: 'asc' | 'desc'
  summary: AncService23Summary
  repBreakdown?: RepBreakdownSummary
  statusOptions: string[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: AncService23Item[]
}
