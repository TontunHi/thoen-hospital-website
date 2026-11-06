import { apiGateway } from '@/lib/apiGateway'
import { queryClinicalDb } from '@/lib/clinicalDb'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { LtcRegistryService } from './ltcRegistryService'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

export interface VisitRepItem {
  rep: string
  compensated: number
  reason?: string | null
  source?: 'repeclaim' | 'repdata'
}

export interface PalliativeVisitEntry {
  id?: number
  visitNo: number
  visitDate: string
  rep?: string | null
  compensated?: number
  reason?: string | null
  repItems?: VisitRepItem[]
}

export interface PalliativeRegistryItem {
  id: number
  hn: string
  an?: string | null
  patientName: string
  isLtc?: boolean
  address: string | null
  phone: string | null
  icd10Principal: string | null
  icd10Palliative: string | null
  projectCode: string | null
  registrationStatus: string
  registeredDate?: string | null
  visits?: PalliativeVisitEntry[]
  visit1Date: string | null
  visit1Rep?: string | null
  visit1Compensated?: number
  visit1Reason?: string | null
  visit1RepItems?: VisitRepItem[]
  visit2Date: string | null
  visit2Rep?: string | null
  visit2Compensated?: number
  visit2Reason?: string | null
  visit2RepItems?: VisitRepItem[]
  visit3Date: string | null
  visit3Rep?: string | null
  visit3Compensated?: number
  visit3Reason?: string | null
  visit3RepItems?: VisitRepItem[]
  visit4Date: string | null
  visit4Rep?: string | null
  visit4Compensated?: number
  visit4Reason?: string | null
  visit4RepItems?: VisitRepItem[]
  visit5Date: string | null
  visit5Rep?: string | null
  visit5Compensated?: number
  visit5Reason?: string | null
  visit5RepItems?: VisitRepItem[]
  visit6Date: string | null
  visit6Rep?: string | null
  visit6Compensated?: number
  visit6Reason?: string | null
  visit6RepItems?: VisitRepItem[]
  deathDate: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface ListRegistriesParams {
  search?: string
  registrationStatus?: string
  claimStatus?: string
  claimResult?: string
  fiscalYear?: string | number
  color?: string
  compAmount?: string
  compVisits?: string
  exportAll?: boolean
  page?: number
  limit?: number
}

export interface RegistryStats {
  total: number
  registered: number
  pendingRegistration: number
  claimed: number
  paid: number
  waitingComp?: number
  deceased?: number
  deny: number
}

export interface ColorCounts {
  total: number
  green: number
  orange: number
  orangeWaitingRep: number
  pink: number
}

/**
 * Calculates Thai Fiscal Year (ปีงบประมาณ พ.ศ.) from date string.
 * Thai Fiscal Year runs from 1 October to 30 September of the following year.
 * e.g., 2026-10-19 -> 2570
 *       2026-07-04 -> 2569
 *       05/04/2024 -> 2567
 */
export function calculateFiscalYear(dateStr?: string | null): number | null {
  if (!dateStr || !dateStr.trim()) return null
  const clean = dateStr.trim()

  let year: number | null = null
  let month: number | null = null

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10)
    month = parseInt(ymdMatch[2], 10)
  } else {
    // 2. DMY format: D/M/YYYY or DD/MM/YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
    if (dmyMatch) {
      month = parseInt(dmyMatch[2], 10)
      year = parseInt(dmyMatch[3], 10)
    }
  }

  if (!year || !month) return null
  if (year > 2400) year -= 543

  const beYear = year + 543
  return month >= 10 ? beYear + 1 : beYear
}

export function getItemFiscalYear(item: {
  registeredDate?: string | null
  visit1Date?: string | null
  createdAt?: string | Date | null
}): number | null {
  return (
    calculateFiscalYear(item.registeredDate) ||
    calculateFiscalYear(item.visit1Date) ||
    calculateFiscalYear(item.createdAt ? String(item.createdAt) : null)
  )
}

export interface PatientLookupResult {
  hn: string
  an: string | null
  patientName: string
  address: string
  phone: string
  death: string
  deathDate: string | null
  isRegistered: boolean
  registeredDate: string | null
  icd10Principal: string | null
  isAlreadyInRegistry?: boolean
  existingRegistryId?: number
  isLtc?: boolean
  ltcMessage?: string
}

export class PalliativeRegistryService {
  /**
   * Look up patient demographics, Clinic 2423 Palliative Care registration status,
   * and ICD10 primary diagnosis from admission AN in 2423 Palliative Care (or OPD / Clinicmember note).
   */
  static async lookupPatientByHn(
    hn: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PatientLookupResult | null> {
    const rawInput = (hn || '').trim()
    if (!rawInput) return null

    let cleanHn = /^\d+$/.test(rawInput) ? rawInput.padStart(7, '0') : rawInput
    let resolvedAn: string | null = null

    // If input looks like an AN (9 digits, e.g. 680000925), resolve to patient's HN
    if (/^\d{9}$/.test(rawInput)) {
      try {
        const anLookup = await executor('SELECT hn, an FROM an_stat WHERE an = ? LIMIT 1', [rawInput])
        if (anLookup && anLookup.length > 0 && anLookup[0].hn) {
          cleanHn = String(anLookup[0].hn).padStart(7, '0')
          resolvedAn = String(anLookup[0].an).trim()
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to lookup patient by AN')
      }
    }

    const ptSql = `
      SELECT 
        pt.hn,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        CONCAT(
          IFNULL(pt.addrpart, ''),
          IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
          IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
          IF(t.name IS NOT NULL, CONCAT(' ต.', t.name), ''),
          IF(a.name IS NOT NULL, CONCAT(' อ.', a.name), '')
        ) AS address,
        COALESCE(
          NULLIF(TRIM(pt.mobile_phone_number), ''),
          NULLIF(TRIM(pt.informtel), ''),
          NULLIF(TRIM(pt.hometel), ''),
          NULLIF(TRIM(pt.worktel), ''),
          ''
        ) AS phone,
        IFNULL(pt.death, 'N') AS death,
        DATE_FORMAT(pt.deathday, '%Y-%m-%d') AS death_date
      FROM patient pt
      LEFT JOIN thaiaddress t ON t.chwpart = pt.chwpart AND t.amppart = pt.amppart AND t.tmbpart = pt.tmbpart
      LEFT JOIN thaiaddress a ON a.chwpart = pt.chwpart AND a.amppart = pt.amppart AND a.tmbpart = '00'
      WHERE pt.hn = ?
      LIMIT 1;
    `

    const cmSql = `
      SELECT hn, clinic, DATE_FORMAT(regdate, '%Y-%m-%d') as regdate, note
      FROM clinicmember
      WHERE hn = ? AND clinic = '47'
      LIMIT 1;
    `

    // Look for admission AN with Z515 or Palliative Care disease spectrum
    const anSql = `
      SELECT 
        a.an,
        a.pdx,
        IFNULL(i1.name, '') as pdx_name,
        DATE_FORMAT(a.regdate, '%Y-%m-%d') as regdate,
        GROUP_CONCAT(DISTINCT d.icd10) as all_dx
      FROM an_stat a
      JOIN iptdiag d ON d.an = a.an
      LEFT JOIN icd101 i1 ON i1.code = a.pdx
      WHERE a.hn = ?
      GROUP BY a.an
      ORDER BY 
        (GROUP_CONCAT(DISTINCT d.icd10) LIKE '%Z515%' OR a.pdx = 'Z515') DESC,
        (a.pdx REGEXP '^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185') DESC,
        a.regdate DESC
      LIMIT 1;
    `

    // Look for OPD visit if AN has no palliative disease
    const opdSql = `
      SELECT 
        v.vn,
        v.pdx,
        IFNULL(i1.name, '') as pdx_name,
        DATE_FORMAT(v.vstdate, '%Y-%m-%d') as vstdate,
        GROUP_CONCAT(DISTINCT d.icd10) as all_dx
      FROM vn_stat v
      JOIN ovstdiag d ON d.vn = v.vn
      LEFT JOIN icd101 i1 ON i1.code = v.pdx
      WHERE v.hn = ?
        AND (v.pdx REGEXP '^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185' OR d.icd10 = 'Z515' OR v.pdx = 'Z515')
      GROUP BY v.vn
      ORDER BY 
        (GROUP_CONCAT(DISTINCT d.icd10) LIKE '%Z515%' OR v.pdx = 'Z515') DESC,
        v.vstdate DESC
      LIMIT 1;
    `

    const [ptRows, cmRows, anRows, opdRows] = await Promise.all([
      executor(ptSql, [cleanHn]),
      executor(cmSql, [cleanHn]),
      executor(anSql, [cleanHn]),
      executor(opdSql, [cleanHn]),
    ])

    if (!ptRows || ptRows.length === 0) {
      return null
    }

    const pt = ptRows[0]
    const cm = cmRows && cmRows.length > 0 ? cmRows[0] : null

    // Helper: test if diagnosis code or all_dx matches Palliative Care scope
    const isPalliative = (code: string | null | undefined, allDx: string | null | undefined) => {
      if (!code && !allDx) return false
      return (
        /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/.test(code || '') ||
        Boolean(allDx && (allDx.includes('Z515') || /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/.test(allDx)))
      )
    }

    let icd10Principal: string | null = null

    // 1. Check IPD AN
    if (anRows && anRows.length > 0) {
      const an = anRows[0]
      if (an.pdx && an.pdx !== 'Z515' && /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/.test(an.pdx)) {
        icd10Principal = String(an.pdx).trim()
      } else if (isPalliative(an.pdx, an.all_dx)) {
        // If pdx was Z515 or acute symptom, extract the specific palliative disease from iptdiag for this AN
        try {
          const iptDiagSql = `
            SELECT d.icd10
            FROM iptdiag d
            WHERE d.an = ? AND d.icd10 != 'Z515'
            ORDER BY (d.icd10 REGEXP '^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185') DESC, d.diagtype ASC
            LIMIT 1;
          `
          const diagRows = await executor(iptDiagSql, [an.an])
          if (diagRows && diagRows.length > 0 && diagRows[0].icd10) {
            icd10Principal = String(diagRows[0].icd10).trim()
          }
        } catch {
          // fallback to pdx
        }
        if (!icd10Principal && an.pdx) {
          icd10Principal = String(an.pdx).trim()
        }
      }
    }

    // 2. Check OPD if AN did not resolve a palliative disease
    if (!icd10Principal && opdRows && opdRows.length > 0) {
      const opd = opdRows[0]
      if (opd.pdx && opd.pdx !== 'Z515') {
        icd10Principal = String(opd.pdx).trim()
      }
    }

    // 3. Check Clinicmember note (e.g. "CA corpus", "CKD 5", "COPD")
    if (!icd10Principal && cm?.note) {
      icd10Principal = String(cm.note).trim()
    }

    // 4. Fallback to any latest AN pdx
    if (!icd10Principal && anRows && anRows.length > 0 && anRows[0].pdx) {
      icd10Principal = String(anRows[0].pdx).trim()
    }

    if (!resolvedAn && anRows && anRows.length > 0 && anRows[0].an) {
      resolvedAn = String(anRows[0].an).trim()
    }

    let isAlreadyInRegistry = false
    let existingRegistryId: number | undefined
    try {
      const existingRes = await apiGateway.app.getPalliativeRegistryByHn(cleanHn)
      if (existingRes?.exists && existingRes.data) {
        isAlreadyInRegistry = true
        existingRegistryId = Number(existingRes.data.id)
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to check existing registry for patient in lookup')
    }

    let isLtc = false
    try {
      isLtc = await LtcRegistryService.isPatientInLtc(cleanHn)
    } catch (err) {
      logger.warn({ err }, 'Failed to check LTC status in lookup')
    }

    return {
      hn: String(pt.hn || cleanHn),
      an: resolvedAn,
      patientName: String(pt.ptname || '').trim(),
      address: String(pt.address || '').trim(),
      phone: String(pt.phone || '').trim(),
      death: String(pt.death || 'N'),
      deathDate: pt.death_date ? String(pt.death_date) : null,
      isRegistered: Boolean(cm),
      registeredDate: cm?.regdate ? String(cm.regdate) : null,
      icd10Principal,
      isAlreadyInRegistry,
      existingRegistryId,
      isLtc,
      ltcMessage: isLtc
        ? 'ผู้ป่วยรายนี้มีรายชื่อในทะเบียน Long Term Care (LTC) แล้ว ไม่สามารถลงทะเบียน Palliative Care ได้'
        : undefined,
    }
  }

  // In-memory short-lived cache for RCM STM compensations and clinic member mapping
  private static rcmCache: {
    repeclaimMap: Map<string, VisitRepItem[]>
    repdataMap: Map<string, VisitRepItem[]>
    clinicMemberMap: Map<string, string>
    anMap: Map<string, string>
    timestamp: number
  } | null = null

  public static invalidateCache() {
    PalliativeRegistryService.rcmCache = null
  }

  /**
   * List palliative care patient records with search, filters, and real-time HOSxP Clinic 2423 and RCM Rep matching.
   * Calculates comprehensive executive stats and color counts across all matching records.
   */
  static async listRegistries(
    params: ListRegistriesParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<{
    items: PalliativeRegistryItem[]
    total: number
    page: number
    limit: number
    totalPages: number
    stats: RegistryStats
    colorCounts?: ColorCounts
    availableFiscalYears?: number[]
  }> {
    const normalizeDateStr = (d: string | null | undefined): string => {
      if (!d) return ''
      const clean = d.trim()

      // Case 1: YYYY-MM-DD or YYYY/MM/DD
      const mYmd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
      if (mYmd) {
        let yr = parseInt(mYmd[1], 10)
        if (yr > 2500) yr -= 543
        return `${yr}-${mYmd[2].padStart(2, '0')}-${mYmd[3].padStart(2, '0')}`
      }

      // Case 2: DD/MM/YYYY or DD-MM-YYYY (4-digit year)
      const mDmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
      if (mDmy) {
        let yr = parseInt(mDmy[3], 10)
        if (yr > 2500) yr -= 543
        return `${yr}-${mDmy[2].padStart(2, '0')}-${mDmy[1].padStart(2, '0')}`
      }

      // Case 3: DD/MM/YY or DD-MM-YY (2-digit year e.g. 69 -> 2569 -> 2026)
      const mDmy2 = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/)
      if (mDmy2) {
        let yr = parseInt(mDmy2[3], 10)
        if (yr >= 50) {
          yr = 2500 + yr - 543
        } else {
          yr = 2000 + yr
        }
        return `${yr}-${mDmy2[2].padStart(2, '0')}-${mDmy2[1].padStart(2, '0')}`
      }

      return clean
    }

    // ── Production Branch: Direct Fast DB Query across all records ──
    let rawRegs: any[] | null = null
    let rawVisits: any[] = []

    if (process.env.NODE_ENV !== 'test') {
      try {
        const [regs, visits] = await Promise.all([
          apiGateway.app.query<any>(`
            SELECT 
              id, hn, patient_name, address, phone, icd10_principal, icd10_palliative,
              project_code, registration_status, registered_date,
              visit_1_date, visit_2_date, visit_3_date, visit_4_date, visit_5_date, visit_6_date,
              death_date, created_by, updated_by, created_at, updated_at
            FROM palliative_care_registries
            ORDER BY registered_date DESC, id DESC
          `),
          apiGateway.app.query<any>(`
            SELECT id, registry_id, visit_no, visit_date
            FROM palliative_care_registry_visits
            ORDER BY registry_id ASC, visit_no ASC
          `),
        ])
        if (Array.isArray(regs) && regs.length > 0) {
          rawRegs = regs
          rawVisits = Array.isArray(visits) ? visits : []
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to query website database directly, falling back to gateway')
      }
    }

    if (rawRegs && rawRegs.length > 0) {
      const visitsByRegId = new Map<number, any[]>()
      for (const v of rawVisits) {
        const list = visitsByRegId.get(v.registry_id) || []
        list.push({
          id: v.id,
          visitNo: v.visit_no,
          visitDate: v.visit_date,
        })
        visitsByRegId.set(v.registry_id, list)
      }

      const allItems: PalliativeRegistryItem[] = rawRegs.map((r) => {
        const regVisits = visitsByRegId.get(r.id) || []
        return {
          id: r.id,
          hn: String(r.hn || '').trim(),
          patientName: r.patient_name || '',
          address: r.address || null,
          phone: r.phone || null,
          icd10Principal: r.icd10_principal || null,
          icd10Palliative: r.icd10_palliative || null,
          projectCode: r.project_code || null,
          registrationStatus: r.registration_status || 'ยังไม่ได้ดำเนินการ',
          registeredDate: r.registered_date || null,
          visit1Date: r.visit_1_date || null,
          visit2Date: r.visit_2_date || null,
          visit3Date: r.visit_3_date || null,
          visit4Date: r.visit_4_date || null,
          visit5Date: r.visit_5_date || null,
          visit6Date: r.visit_6_date || null,
          deathDate: r.death_date || null,
          createdBy: r.created_by || null,
          updatedBy: r.updated_by || null,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          visits: regVisits,
        }
      })

      // Check RCM in-memory cache
      const now = Date.now()
      let repeclaimMap = new Map<string, VisitRepItem[]>()
      let repdataMap = new Map<string, VisitRepItem[]>()
      let clinicMemberMap = new Map<string, string>()
      let anMap = new Map<string, string>()

      if (
        PalliativeRegistryService.rcmCache &&
        now - PalliativeRegistryService.rcmCache.timestamp < 60_000
      ) {
        repeclaimMap = PalliativeRegistryService.rcmCache.repeclaimMap
        repdataMap = PalliativeRegistryService.rcmCache.repdataMap
        clinicMemberMap = PalliativeRegistryService.rcmCache.clinicMemberMap
        anMap = PalliativeRegistryService.rcmCache.anMap
      } else {
        // Collect HNs with home visits for targeted RCM queries
        const hnsWithVisits = [
          ...new Set(
            rawVisits
              .map((v) => {
                const reg = rawRegs.find((r) => r.id === v.registry_id)
                return reg?.hn ? String(reg.hn).trim() : null
              })
              .filter(Boolean)
          ),
        ] as string[]

        if (hnsWithVisits.length > 0) {
          const placeholders = hnsWithVisits.map(() => '?').join(',')

          const cmSql = `
            SELECT hn, DATE_FORMAT(regdate, '%Y-%m-%d') as regdate
            FROM clinicmember
            WHERE hn IN (${placeholders}) AND clinic = '47';
          `

          const anBatchSql = `
            SELECT a.hn, a.an
            FROM an_stat a
            JOIN (
              SELECT hn, MAX(regdate) as max_regdate
              FROM an_stat
              WHERE hn IN (${placeholders})
              GROUP BY hn
            ) latest ON latest.hn = a.hn AND latest.max_regdate = a.regdate
            WHERE a.hn IN (${placeholders})
            GROUP BY a.hn;
          `

          const repeclaimSql = `
            SELECT 
              t.hn,
              DATE_FORMAT(t.admdate, '%Y-%m-%d') as admdate,
              t.rep,
              SUM(t.compensated) as compensated
            FROM rcmdb.repeclaim t
            LEFT JOIN ovst o ON o.vn = t.vn
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            WHERE t.department = 'OP'
              AND ptt.pttype_eclaim_id = '01'
              AND t.hn IN (${placeholders})
            GROUP BY t.hn, DATE_FORMAT(t.admdate, '%Y-%m-%d'), t.rep
            ORDER BY t.admdate DESC, t.rep ASC;
          `

          const repdataSql = `
            SELECT 
              hn,
              DATE_FORMAT(AdmDate, '%Y-%m-%d') as admdate,
              Rep as rep,
              Compensated as compensated,
              ErrorCode as errorcode,
              Remark as remark
            FROM rcmdb.repdata
            WHERE hn IN (${placeholders})
            ORDER BY AdmDate DESC, Rep ASC;
          `

          try {
            const [cmRows, repeclaimRows, repdataRows, anRows] = await Promise.all([
              executor(cmSql, hnsWithVisits).catch(() => []),
              executor(repeclaimSql, hnsWithVisits).catch(() => []),
              executor(repdataSql, hnsWithVisits).catch(() => []),
              executor(anBatchSql, [...hnsWithVisits, ...hnsWithVisits]).catch(() => []),
            ])

            if (Array.isArray(anRows)) {
              for (const row of anRows) {
                if (row.hn && row.an) anMap.set(String(row.hn).trim(), String(row.an).trim())
              }
            }

            if (Array.isArray(cmRows)) {
              for (const row of cmRows) {
                if (row.hn) clinicMemberMap.set(String(row.hn).trim(), String(row.regdate || ''))
              }
            }

            if (Array.isArray(repeclaimRows)) {
              for (const r of repeclaimRows) {
                const key = `${String(r.hn || '').trim()}_${String(r.admdate || '').trim()}`
                const list = repeclaimMap.get(key) || []
                list.push({
                  rep: String(r.rep || '').trim(),
                  compensated: Number(r.compensated || 0),
                  source: 'repeclaim',
                })
                repeclaimMap.set(key, list)
              }
            }

            if (Array.isArray(repdataRows)) {
              for (const r of repdataRows) {
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
            }

            // Cache RCM queries
            PalliativeRegistryService.rcmCache = {
              repeclaimMap,
              repdataMap,
              clinicMemberMap,
              anMap,
              timestamp: now,
            }
          } catch (dbErr) {
            logger.warn({ dbErr }, 'Failed to batch fetch RCM compensations for palliative registries')
          }
        }
      }

      let ltcHnSet = new Set<string>()
      try {
        ltcHnSet = await LtcRegistryService.getAllLtcHnSet()
      } catch (err) {
        logger.warn({ err }, 'Failed to fetch LTC HNs for palliative item enrichment')
      }

      // Enrich all items with RCM, LTC, and clinic member info
      for (const item of allItems) {
        const hn = item.hn.trim()
        item.isLtc = ltcHnSet.has(hn) || ltcHnSet.has(hn.padStart(7, '0'))
        item.an = anMap.get(hn) || null
        if (clinicMemberMap.has(hn)) {
          item.registrationStatus = 'ดำเนินการเรียบร้อย'
          item.registeredDate = clinicMemberMap.get(hn) || item.registeredDate
        }

        if (!item.visits || item.visits.length === 0) {
          item.visits = []
          for (let v = 1; v <= 6; v++) {
            const vd = (item as any)[`visit${v}Date`]
            if (vd && String(vd).trim()) {
              item.visits.push({
                visitNo: v,
                visitDate: String(vd).trim(),
              })
            }
          }
        }

        for (let v = 1; v <= 6; v++) {
          ;(item as any)[`visit${v}RepItems`] = []
          ;(item as any)[`visit${v}Rep`] = null
          ;(item as any)[`visit${v}Compensated`] = 0
          ;(item as any)[`visit${v}Reason`] = null
        }

        for (const vEntry of item.visits) {
          const vDateRaw = vEntry.visitDate
          if (vDateRaw && vDateRaw.trim()) {
            const normVDate = normalizeDateStr(vDateRaw)
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
                ;(item as any)[`visit${vEntry.visitNo}RepItems`] = [latestRep]
                ;(item as any)[`visit${vEntry.visitNo}Rep`] = latestRep.rep
                ;(item as any)[`visit${vEntry.visitNo}Compensated`] = Number(latestRep.compensated) || 0
                ;(item as any)[`visit${vEntry.visitNo}Reason`] = latestRep.reason || null
              }
            }
          }
        }
      }

      // Collect available fiscal years across all 1,341 records
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

      // Step A: Filter cohort by search, fiscalYear, and registrationStatus
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
          for (const v of item.visits) {
            sum += Number(v.compensated || 0)
          }
        } else {
          for (let v = 1; v <= 6; v++) {
            sum += Number((item as any)[`visit${v}Compensated`] || 0)
          }
        }
        return sum
      }

      const getCompensatedVisitCount = (item: PalliativeRegistryItem): number => {
        let count = 0
        if (item.visits && item.visits.length > 0) {
          for (const v of item.visits) {
            if (Number(v.compensated || 0) > 0) {
              count++
            }
          }
        } else {
          for (let v = 1; v <= 6; v++) {
            if (Number((item as any)[`visit${v}Compensated`] || 0) > 0) {
              count++
            }
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

      // Step B: Calculate colorCounts across the cohort (for the dropdown options)
      let greenCount = 0
      let orangeCount = 0
      let orangeWaitingRepCount = 0
      let pinkCount = 0

      for (const item of cohort) {
        const isDeceased = Boolean(item.deathDate && item.deathDate.trim())
        const isReg = Boolean(item.registeredDate || item.registrationStatus === 'ดำเนินการเรียบร้อย')
        const hasComp = Boolean(
          (item.visits && item.visits.some((v) => (v.compensated || 0) > 0)) ||
          [1, 2, 3, 4, 5, 6].some((v) => ((item as any)[`visit${v}Compensated`] || 0) > 0)
        )

        if (isDeceased) {
          pinkCount++
        } else {
          if (hasComp) {
            greenCount++
          } else {
            orangeCount++
            if (isReg) {
              orangeWaitingRepCount++
            }
          }
        }
      }

      const colorCounts: ColorCounts = {
        total: cohort.length,
        green: greenCount,
        orange: orangeCount,
        orangeWaitingRep: orangeWaitingRepCount,
        pink: pinkCount,
      }

      // Step C: Filter by color / compensation status
      let filteredList = cohort
      if (params.color && params.color !== 'ALL') {
        filteredList = filteredList.filter((item) => {
          const isDeceased = Boolean(item.deathDate && item.deathDate.trim())
          const isReg = Boolean(item.registeredDate || item.registrationStatus === 'ดำเนินการเรียบร้อย')
          const hasComp = Boolean(
            (item.visits && item.visits.some((v) => (v.compensated || 0) > 0)) ||
            [1, 2, 3, 4, 5, 6].some((v) => ((item as any)[`visit${v}Compensated`] || 0) > 0)
          )

          if (params.color === 'PINK') return isDeceased
          if (params.color === 'GREEN') return !isDeceased && hasComp
          if (params.color === 'ORANGE') return !isDeceased && !hasComp
          if (params.color === 'ORANGE_WAITING_REP') return !isDeceased && isReg && !hasComp
          return true
        })
      }

      // Step D: Calculate accurate summary metrics across all records in the filtered cohort (matching ALL active filters)
      let registered = 0
      let pendingRegistration = 0
      let paid = 0
      let waitingComp = 0
      let deceased = 0

      for (const item of filteredList) {
        const isDeceased = Boolean(item.deathDate && item.deathDate.trim())
        const isReg = Boolean(item.registeredDate || item.registrationStatus === 'ดำเนินการเรียบร้อย')
        const hasComp = Boolean(
          (item.visits && item.visits.some((v) => (v.compensated || 0) > 0)) ||
          [1, 2, 3, 4, 5, 6].some((v) => ((item as any)[`visit${v}Compensated`] || 0) > 0)
        )

        if (isReg) registered++
        else pendingRegistration++

        if (isDeceased) {
          deceased++
        } else {
          if (hasComp) {
            paid++
          } else {
            waitingComp++
          }
        }
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

      // Step D: Server-side pagination
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
      }
    }

    // ── Test Fallback Branch: Fallback to getPalliativeRegistries gateway mock ──
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

    const clinicMemberMap = new Map<string, string>()
    const repeclaimMap = new Map<string, VisitRepItem[]>()
    const repdataMap = new Map<string, VisitRepItem[]>()
    const anMap = new Map<string, string>()

    if (hns.length > 0) {
      const placeholders = hns.map(() => '?').join(',')

      const cmSql = `
        SELECT hn, DATE_FORMAT(regdate, '%Y-%m-%d') as regdate
        FROM clinicmember
        WHERE hn IN (${placeholders}) AND clinic = '47';
      `

      const anBatchSql = `
        SELECT a.hn, a.an
        FROM an_stat a
        JOIN (
          SELECT hn, MAX(regdate) as max_regdate
          FROM an_stat
          WHERE hn IN (${placeholders})
          GROUP BY hn
        ) latest ON latest.hn = a.hn AND latest.max_regdate = a.regdate
        WHERE a.hn IN (${placeholders})
        GROUP BY a.hn;
      `

      const repeclaimSql = `
        SELECT 
          t.hn,
          DATE_FORMAT(t.admdate, '%Y-%m-%d') as admdate,
          t.rep,
          SUM(t.compensated) as compensated
        FROM rcmdb.repeclaim t
        LEFT JOIN ovst o ON o.vn = t.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        WHERE t.department = 'OP'
          AND ptt.pttype_eclaim_id = '01'
          AND t.hn IN (${placeholders})
        GROUP BY t.hn, DATE_FORMAT(t.admdate, '%Y-%m-%d'), t.rep
        ORDER BY t.admdate DESC, t.rep ASC;
      `

      const repdataSql = `
        SELECT 
          hn,
          DATE_FORMAT(AdmDate, '%Y-%m-%d') as admdate,
          Rep as rep,
          Compensated as compensated,
          ErrorCode as errorcode,
          Remark as remark
        FROM rcmdb.repdata
        WHERE hn IN (${placeholders})
        ORDER BY AdmDate DESC, Rep ASC;
      `

      try {
        const [cmRows, repeclaimRows, repdataRows, anRows] = await Promise.all([
          executor(cmSql, hns),
          executor(repeclaimSql, hns),
          executor(repdataSql, hns),
          executor(anBatchSql, [...hns, ...hns]).catch(() => []),
        ])

        if (Array.isArray(anRows)) {
          for (const row of anRows) {
            if (row.hn && row.an) anMap.set(String(row.hn).trim(), String(row.an).trim())
          }
        }

        if (Array.isArray(cmRows)) {
          for (const row of cmRows) {
            if (row.hn) clinicMemberMap.set(String(row.hn).trim(), String(row.regdate || ''))
          }
        }

        if (Array.isArray(repeclaimRows)) {
          for (const r of repeclaimRows) {
            const key = `${String(r.hn || '').trim()}_${String(r.admdate || '').trim()}`
            const list = repeclaimMap.get(key) || []
            list.push({
              rep: String(r.rep || '').trim(),
              compensated: Number(r.compensated || 0),
              source: 'repeclaim',
            })
            repeclaimMap.set(key, list)
          }
        }

        if (Array.isArray(repdataRows)) {
          for (const r of repdataRows) {
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
        }
      } catch (dbErr) {
        logger.warn({ dbErr }, 'Failed to batch fetch clinicmember/repeclaim/repdata for palliative registries')
      }
    }

    let fallbackLtcHnSet = new Set<string>()
    try {
      fallbackLtcHnSet = await LtcRegistryService.getAllLtcHnSet()
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch LTC HNs for palliative fallback item enrichment')
    }

    // Enrich items
    for (const item of items) {
      const hn = item.hn.trim()
      item.isLtc = fallbackLtcHnSet.has(hn) || fallbackLtcHnSet.has(hn.padStart(7, '0'))
      item.an = anMap.get(hn) || null
      if (clinicMemberMap.has(hn)) {
        item.registrationStatus = 'ดำเนินการเรียบร้อย'
        item.registeredDate = clinicMemberMap.get(hn) || null
      } else if (clinicMemberMap.size > 0) {
        item.registrationStatus = 'ยังไม่ได้ดำเนินการ'
        item.registeredDate = null
      }

      if (!item.visits || item.visits.length === 0) {
        item.visits = []
        for (let v = 1; v <= 6; v++) {
          const vd = (item as any)[`visit${v}Date`]
          if (vd && String(vd).trim()) {
            item.visits.push({
              visitNo: v,
              visitDate: String(vd).trim(),
            })
          }
        }
      }

      for (let v = 1; v <= 6; v++) {
        ;(item as any)[`visit${v}RepItems`] = []
        ;(item as any)[`visit${v}Rep`] = null
        ;(item as any)[`visit${v}Compensated`] = 0
        ;(item as any)[`visit${v}Reason`] = null
      }

      for (const vEntry of item.visits) {
        const vDateRaw = vEntry.visitDate

        if (vDateRaw && vDateRaw.trim()) {
          const normVDate = normalizeDateStr(vDateRaw)
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
              ;(item as any)[`visit${vEntry.visitNo}RepItems`] = [latestRep]
              ;(item as any)[`visit${vEntry.visitNo}Rep`] = latestRep.rep
              ;(item as any)[`visit${vEntry.visitNo}Compensated`] = Number(latestRep.compensated) || 0
              ;(item as any)[`visit${vEntry.visitNo}Reason`] = latestRep.reason || null
            }
          }
        }
      }
    }

    const registeredCount = clinicMemberMap.size > 0
      ? items.filter((i) => i.registrationStatus === 'ดำเนินการเรียบร้อย').length
      : res.stats?.registered ?? items.filter((i) => i.registrationStatus === 'ดำเนินการเรียบร้อย').length

    const pendingCount = clinicMemberMap.size > 0
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
          if ((item as any)[`visit${v}Rep`]) hasRep = true
          if (((item as any)[`visit${v}Compensated`] || 0) > 0) hasComp = true
        }
      }
      if (hasRep) claimedCount++
      if (hasComp) paidCount++
    }

    const hasData = repeclaimMap.size > 0 || repdataMap.size > 0
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
          for (let v = 1; v <= 6; v++) sum += Number((i as any)[`visit${v}Compensated`] || 0)
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
            if (Number((i as any)[`visit${v}Compensated`] || 0) > 0) count++
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

  /**
   * Get single registry record by ID via Centralized API Gateway
   */
  static async getRegistryById(id: number): Promise<PalliativeRegistryItem | null> {
    try {
      const res = await apiGateway.app.getPalliativeRegistryById(id)
      return (res?.data || res) as unknown as PalliativeRegistryItem
    } catch (err: any) {
      if (err?.status === 404) return null
      throw err
    }
  }

  /**
   * Create new palliative patient registry record via Centralized API Gateway
   */
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

    // Cross-system constraint: Patients registered in LTC cannot be added to Palliative Care
    const isLtc = await LtcRegistryService.isPatientInLtc(cleanHn)
    if (isLtc) {
      throw new Error('ผู้ป่วยรายนี้มีรายชื่อในทะเบียน Long Term Care (LTC) แล้ว ไม่สามารถลงทะเบียน Palliative Care ได้')
    }

    // Defensive check: prevent duplicate registration of the same patient/admission
    try {
      const existingRes = await apiGateway.app.getPalliativeRegistryByHn(cleanHn)
      if (existingRes?.exists && existingRes.data) {
        throw new Error(
          `ผู้ป่วยรายนี้ (HN: ${cleanHn} - ${existingRes.data.patientName}) มีข้อมูลในทะเบียน Palliative Care แล้ว ห้ามลงข้อมูลซ้ำ`
        )
      }
    } catch (err: any) {
      if (err?.message?.includes('มีข้อมูลในทะเบียน')) {
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

  /**
   * Update existing palliative patient record via Centralized API Gateway
   */
  static async updateRegistry(
    id: number,
    data: Partial<PalliativeRegistryItem>,
    actor?: string
  ): Promise<PalliativeRegistryItem> {
    const updateData: any = { ...data }
    delete updateData.id
    delete updateData.createdAt
    delete updateData.updatedAt
    updateData.updatedBy = actor || null

    if (Array.isArray(updateData.visits)) {
      const vMap = new Map<number, string>()
      updateData.visits.forEach((v: any) => {
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

  /**
   * Delete palliative patient record via Centralized API Gateway
   */
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
