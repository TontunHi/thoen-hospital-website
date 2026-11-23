import { apiGateway } from '@/lib/apiGateway'
import { queryClinicalDb } from '@/lib/clinicalDb'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { LtcRegistryService } from '../ltcRegistryService'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'

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

export interface PalliativeSyncInsertedItem {
  hn: string
  patientName: string
  icd10Principal?: string | null
  registeredDate?: string | null
}

export interface PalliativeSyncUpdatedItem {
  hn: string
  patientName: string
  updatedFields: Array<'status' | 'registeredDate' | 'deathDate'>
  registeredDate?: string | null
  deathDate?: string | null
}

export interface PalliativeSyncVisitAddedItem {
  hn: string
  patientName: string
  addedVisits: Array<{
    visitNo: number
    visitDate: string
  }>
}

export interface PalliativeSyncSkippedLtcItem {
  hn: string
  patientName: string
}

export interface PalliativeSyncSummary {
  totalClinicMembers: number
  insertedCount: number
  updatedCount: number
  visitsAddedCount: number
  skippedLtcCount: number
  syncedAt: string
  insertedItems?: PalliativeSyncInsertedItem[]
  updatedItems?: PalliativeSyncUpdatedItem[]
  visitsAddedItems?: PalliativeSyncVisitAddedItem[]
  skippedLtcItems?: PalliativeSyncSkippedLtcItem[]
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
  forceSync?: boolean
  page?: number
  limit?: number
}

export const PALLIATIVE_DX_REGEX = /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/
export const DEFAULT_ICD10_PALLIATIVE = 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)'
export const DEFAULT_PROJECT_CODE = '30001, Cons01'
export const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000

export function normalizeHn(hn: string | null | undefined): string {
  const raw = String(hn || '').trim()
  if (!raw) return ''
  return /^\d+$/.test(raw) ? raw.padStart(7, '0') : raw
}

export function normalizeRegistryDateToIso(d: string | null | undefined): string {
  if (!d) return ''
  const clean = d.trim()

  const mYmd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (mYmd) {
    let yr = parseInt(mYmd[1], 10)
    if (yr > 2500) yr -= 543
    return `${yr}-${mYmd[2].padStart(2, '0')}-${mYmd[3].padStart(2, '0')}`
  }

  const mDmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (mDmy) {
    let yr = parseInt(mDmy[3], 10)
    if (yr > 2500) yr -= 543
    return `${yr}-${mDmy[2].padStart(2, '0')}-${mDmy[1].padStart(2, '0')}`
  }

  const mDmy2 = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/)
  if (mDmy2) {
    let yr = parseInt(mDmy2[3], 10)
    yr = yr >= 50 ? 2500 + yr - 543 : 2000 + yr
    return `${yr}-${mDmy2[2].padStart(2, '0')}-${mDmy2[1].padStart(2, '0')}`
  }

  return clean
}

export function isoToDisplayDmy(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return isoDate
  return `${m[3]}/${m[2]}/${m[1]}`
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


/**
 * Look up patient demographics, Clinic 2423 Palliative Care registration status,
 * and ICD10 primary diagnosis from admission AN in 2423 Palliative Care (or OPD / Clinicmember note).
 */
export async function lookupPatientByHn(
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
