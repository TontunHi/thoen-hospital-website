import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams, type QueryExecutor } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import type { RepBreakdownSummary } from '../rcmRepTagHelper'

// ── 1. PP Special Screening Classification Helper ──────────────────────

export interface PpSpecialClassification {
  papsmear: string | null
  papsmear_result: string | null
  via: string | null
  via_result: string | null
  hpv: string | null
  hpv_result: string | null
  other: string | null
  other_result: string | null
  hasValidPpCode: boolean
  hasAbnormalResult: boolean
}

const PAP_CODES = new Set(['1B0044', '1B30', '1B40', '1B004N', '1B004P'])
const PAP_NORMAL = new Set(['1B0044', '1B30', '1B004N'])
const PAP_ABNORMAL = new Set(['1B40', '1B004P'])

const VIA_CODES = new Set(['1B0040', '1B0041', '1B0042', '1B0043', '1B0045', '1B004_0N', '1B004_0P'])
const VIA_NORMAL = new Set(['1B0040', '1B0043', '1B004_0N'])
const VIA_ABNORMAL = new Set(['1B0041', '1B0042', '1B0045', '1B004_0P'])

const OTHER_CODES = new Set(['1B0048', '1B0049', '0320277_0', '0320277_1'])
const OTHER_NORMAL = new Set(['1B0048', '1B0049', '0320277_0'])
const OTHER_ABNORMAL = new Set(['0320277_1'])

/**
 * Classifies HOSxP `pp_special_code` values according to NHSO CCS screening rules
 * (Pap Smear, VIA, HPV DNA, and Other screening methods).
 */
export function classifyPpSpecialCodes(rawCodes: string | string[] | null | undefined): PpSpecialClassification {
  const list = Array.isArray(rawCodes)
    ? rawCodes
    : typeof rawCodes === 'string'
      ? rawCodes.split(',')
      : []

  const codes = Array.from(new Set(list.map((c) => c.trim()).filter(Boolean)))

  const papList: string[] = []
  const papRes = new Set<string>()

  const viaList: string[] = []
  const viaRes = new Set<string>()

  const hpvList: string[] = []
  const hpvRes = new Set<string>()

  const otherList: string[] = []
  const otherRes = new Set<string>()

  let hasValidPpCode = false

  for (const code of codes) {
    if (/^1B004|^1B30/.test(code)) {
      hasValidPpCode = true
    }

    if (PAP_CODES.has(code)) {
      papList.push(code)
      if (PAP_NORMAL.has(code)) papRes.add('ปกติ')
      else if (PAP_ABNORMAL.has(code)) papRes.add('ผิดปกติ')
    }

    if (VIA_CODES.has(code)) {
      viaList.push(code)
      if (VIA_NORMAL.has(code)) viaRes.add('ปกติ')
      else if (VIA_ABNORMAL.has(code)) viaRes.add('ผิดปกติ')
    }

    if (/^1B0046/.test(code)) {
      hpvList.push(code)
      if (/1B0046_[12]/.test(code)) hpvRes.add('ผิดปกติ')
      else hpvRes.add('ปกติ')
    }

    if (OTHER_CODES.has(code)) {
      otherList.push(code)
      if (OTHER_NORMAL.has(code)) otherRes.add('ปกติ')
      else if (OTHER_ABNORMAL.has(code)) otherRes.add('ผิดปกติ')
    }
  }

  const hasAbnormalResult =
    papRes.has('ผิดปกติ') ||
    viaRes.has('ผิดปกติ') ||
    hpvRes.has('ผิดปกติ') ||
    otherRes.has('ผิดปกติ')

  return {
    papsmear: papList.length > 0 ? papList.join(',') : null,
    papsmear_result: papRes.size > 0 ? Array.from(papRes).join(',') : null,
    via: viaList.length > 0 ? viaList.join(',') : null,
    via_result: viaRes.size > 0 ? Array.from(viaRes).join(',') : null,
    hpv: hpvList.length > 0 ? hpvList.join(',') : null,
    hpv_result: hpvRes.size > 0 ? Array.from(hpvRes).join(',') : null,
    other: otherList.length > 0 ? otherList.join(',') : null,
    other_result: otherRes.size > 0 ? Array.from(otherRes).join(',') : null,
    hasValidPpCode,
    hasAbnormalResult,
  }
}

// ── 2. Domain Types: 1. หญิงไทยอายุ 30 - 60 ปี (Target Population) ──────

export type CcsTargetScreeningFilter =
  | 'ALL'
  | 'SCREENED'
  | 'UNSCREENED'
  | 'ABNORMAL'
  | 'COMPENSATED'
  | 'MATCHED_SAME_DAY'
  | 'MATCHED_DIFF_DAY'
  | 'REP_ONLY'

export type CcsTargetSearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME'

export type CcsTargetSortField =
  | 'hn'
  | 'person_id'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'vstdate'
  | 'comeback_date'
  | 'note'
  | 'compensated'

export type CcsTargetRowMatchType =
  | 'matched_same_day'
  | 'matched_diff_day'
  | 'rep_only'
  | 'hosxp_only'
  | 'unscreened'

export interface CcsTargetPopulationParams extends FiscalDateRangeParams {
  screeningFilter?: CcsTargetScreeningFilter
  typeareaFilter?: 'ALL' | '1_3'
  searchField?: CcsTargetSearchField
  search?: string
  sortBy?: CcsTargetSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  extraRepRows?: RepIndividualExcelRow[]
  reps?: string
}

export interface CcsTargetPopulationItem {
  no: number
  person_id: string
  vn: string | null
  hn: string
  cid: string
  ptname: string
  birthdate: string | null
  age: number | null
  sex: string | null
  nation: string | null
  person_discharge_id: number | null
  typearea: string
  address: string
  vstdate: string | null
  pttypename: string | null
  cc: string | null
  icd10: string | null
  hospital: string | null
  doctorname: string | null
  papsmear: string | null
  papsmear_result: string | null
  via: string | null
  via_result: string | null
  hpv: string | null
  hpv_result: string | null
  other: string | null
  other_result: string | null
  rep: string | null
  comeback: 'Y' | null
  comeback_date: string | null
  payno: string | null
  note: string
  status: string | null
  compensated: number
  hsub: string | null
  remark: string | null
  hasAbnormalResult: boolean
  matchType: CcsTargetRowMatchType
}

export interface CcsTargetPopulationSummary {
  totalTarget: number
  typearea13Count: number
  screenedCount: number
  unscreenedCount: number
  coverageRate: number
  abnormalCount: number
  compensatedCount: number
  matchedSameDayCount: number
  matchedDiffDayCount: number
  repOnlyCount: number
  totalCompensated: number
}

export interface CcsTargetPopulationResult {
  ds1: string
  ds2: string
  screeningFilter: CcsTargetScreeningFilter
  typeareaFilter: 'ALL' | '1_3'
  searchField: CcsTargetSearchField
  sortBy: CcsTargetSortField
  sortOrder: 'asc' | 'desc'
  summary: CcsTargetPopulationSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: CcsTargetPopulationItem[]
  repBreakdown?: RepBreakdownSummary
}

export interface RepIndividualExcelRow {
  cid: string
  comebackDate: string | null
}

export interface RepIndividualPersonLookup {
  person_id: string
  hn: string
  cid: string
  ptname: string
  birthdate: string | null
  age: number | null
  sex: string | null
  nation: string | null
  person_discharge_id: number | null
  typearea: string
  address: string
}

// ── 3. Domain Types: 1.2 รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก (Screened Recipients) ──

export type CcsMethodFilter = 'ALL' | 'PapSmear' | 'VIA' | 'HPV' | 'ColpoScopy'
export type CcsOkFilter = 'ALL' | 'OK' | 'NOT_OK'
export type CcsResultStatusFilter = 'ALL' | 'NORMAL' | 'ABNORMAL'
export type CcsCompensationFilter = 'ALL' | 'COMPENSATED' | 'UNCOMPENSATED'
export type CcsScreenedSearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN'
export type CcsScreenedSortField =
  | 'vstdate'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'compensated'
  | 'nhso'

export interface CcsScreenedRecipientsParams extends FiscalDateRangeParams {
  methodFilter?: CcsMethodFilter
  okFilter?: CcsOkFilter
  resultStatusFilter?: CcsResultStatusFilter
  compensationFilter?: CcsCompensationFilter
  pttypes?: string
  ucOnly?: boolean
  searchField?: CcsScreenedSearchField
  search?: string
  sortBy?: CcsScreenedSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  reps?: string
}

export interface CcsScreenedRecipientItem {
  no: number
  vn: string
  an: string | null
  hn: string
  cid: string
  ptname: string
  age: number | null
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  pttypename_patient: string | null
  pttypename_visit: string | null
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
  ok: 'Y' | null
  papsmear: string | null
  papsmear_result: string | null
  via: string | null
  via_result: string | null
  hpv: string | null
  hpv_result: string | null
  other: string | null
  other_result: string | null
  colposcopy: 'Y' | null
  type: string | null
  rep: string | null
  compensated: number
  note: string | null
  paydate: string | null
  listname: string | null
  status: string | null
  rep_nhso: string | null
  nhso: number
  hasAbnormalResult: boolean
}

export interface CcsScreenedRecipientsSummary {
  totalVisits: number
  uniquePatients: number
  okCount: number
  notOkCount: number
  papCount: number
  viaCount: number
  hpvCount: number
  colposcopyCount: number
  abnormalCount: number
  totalSeamlessCompensated: number
  totalNhsoCompensated: number
}

export interface CcsScreenedRecipientsResult {
  ds1: string
  ds2: string
  methodFilter: CcsMethodFilter
  okFilter: CcsOkFilter
  resultStatusFilter: CcsResultStatusFilter
  compensationFilter: CcsCompensationFilter
  searchField: CcsScreenedSearchField
  sortBy: CcsScreenedSortField
  sortOrder: 'asc' | 'desc'
  summary: CcsScreenedRecipientsSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: CcsScreenedRecipientItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 4. Domain Types: 1.3 บริการ 1B004N (HPV DNA Service) ──────

export type CcsService1B004NCompensationFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'HAS_AUTHEN'
  | 'NO_AUTHEN'

export type CcsService1B004NSearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN' | 'DIAG'

export type CcsService1B004NSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface CcsService1B004NParams extends FiscalDateRangeParams {
  compensationFilter?: CcsService1B004NCompensationFilter
  searchField?: CcsService1B004NSearchField
  search?: string
  sortBy?: CcsService1B004NSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface CcsService1B004NItem {
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
  listname: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
}

export interface CcsService1B004NSummary {
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

export interface CcsAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface CcsAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: CcsAdpMappingItem[]
}

export interface CcsService1B004NResult {
  ds1: string
  ds2: string
  adpMapping: CcsAdpMappingCheck
  compensationFilter: CcsService1B004NCompensationFilter
  searchField: CcsService1B004NSearchField
  sortBy: CcsService1B004NSortField
  sortOrder: 'asc' | 'desc'
  summary: CcsService1B004NSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: CcsService1B004NItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 5. Domain Types: 1.4 บริการ 1B004P (HPV DNA Repeat / Positive Service) ──

export type CcsService1B004PCompensationFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'HAS_AUTHEN'
  | 'NO_AUTHEN'

export type CcsService1B004PSearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN' | 'DIAG'

export type CcsService1B004PSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface CcsService1B004PParams extends FiscalDateRangeParams {
  compensationFilter?: CcsService1B004PCompensationFilter
  searchField?: CcsService1B004PSearchField
  search?: string
  sortBy?: CcsService1B004PSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface CcsService1B004PItem {
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
  listname: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
}

export interface CcsService1B004PSummary {
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

export interface CcsService1B004PResult {
  ds1: string
  ds2: string
  adpMapping: CcsAdpMappingCheck
  compensationFilter: CcsService1B004PCompensationFilter
  searchField: CcsService1B004PSearchField
  sortBy: CcsService1B004PSortField
  sortOrder: 'asc' | 'desc'
  summary: CcsService1B004PSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: CcsService1B004PItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 6. Domain Types: 1.5 บริการ 1B004_0N (VIA / Cervical Screening Service) ──

export type CcsService1B004_0NCompensationFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'HAS_AUTHEN'
  | 'NO_AUTHEN'

export type CcsService1B004_0NSearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN' | 'DIAG'

export type CcsService1B004_0NSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface CcsService1B004_0NParams extends FiscalDateRangeParams {
  compensationFilter?: CcsService1B004_0NCompensationFilter
  searchField?: CcsService1B004_0NSearchField
  search?: string
  sortBy?: CcsService1B004_0NSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export type CcsService1B004_0NItem = CcsService1B004NItem
export type CcsService1B004_0NSummary = CcsService1B004NSummary

export interface CcsService1B004_0NResult {
  ds1: string
  ds2: string
  adpMapping: CcsAdpMappingCheck
  compensationFilter: CcsService1B004_0NCompensationFilter
  searchField: CcsService1B004_0NSearchField
  sortBy: CcsService1B004_0NSortField
  sortOrder: 'asc' | 'desc'
  summary: CcsService1B004_0NSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: CcsService1B004_0NItem[]
  repBreakdown?: RepBreakdownSummary
}

// ── 7. Domain Types: 1.10 บริการ 1B005 (Pap Smear / Cervical Cancer Screening Service) ──

export type CcsService1B005CompensationFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'HAS_AUTHEN'
  | 'NO_AUTHEN'

export type CcsService1B005SearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN' | 'DIAG'

export type CcsService1B005SortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface CcsService1B005Params extends FiscalDateRangeParams {
  compensationFilter?: CcsService1B005CompensationFilter
  pttypes?: string
  ucOnly?: boolean
  searchField?: CcsService1B005SearchField
  search?: string
  sortBy?: CcsService1B005SortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export type CcsService1B005Item = CcsService1B004NItem
export type CcsService1B005Summary = CcsService1B004NSummary

export interface CcsService1B005Result {
  ds1: string
  ds2: string
  adpMapping: CcsAdpMappingCheck
  compensationFilter: CcsService1B005CompensationFilter
  searchField: CcsService1B005SearchField
  sortBy: CcsService1B005SortField
  sortOrder: 'asc' | 'desc'
  summary: CcsService1B005Summary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: CcsService1B005Item[]
  repBreakdown?: RepBreakdownSummary
}

// ── 8. Internal Helpers ────────────────────────────────────────────────

export const PERSON_SELECT_COLUMNS = `
  CAST(p.person_id AS CHAR(20)) AS person_id,
  IFNULL(p.patient_hn, '') AS hn,
  IFNULL(p.cid, '') AS cid,
  CONCAT(IFNULL(p.pname, ''), IFNULL(p.fname, ''), ' ', IFNULL(p.lname, '')) AS ptname,
  DATE_FORMAT(p.birthdate, '%Y-%m-%d') AS birthdate,
  TIMESTAMPDIFF(YEAR, p.birthdate, NOW()) AS age,
  CASE WHEN p.sex = '1' THEN 'ชาย' WHEN p.sex = '2' THEN 'หญิง' ELSE IFNULL(p.sex, '') END AS sex,
  IFNULL(nat.name, 'ไทย') AS nation,
  p.person_discharge_id,
  CAST(IFNULL(p.house_regist_type_id, '') AS CHAR(2)) AS typearea,
  TRIM(CONCAT_WS(' ',
    IF(IFNULL(vil.village_moo, 0) = 0, pa.addrpart, h.address),
    IF(IFNULL(vil.village_moo, 0) = 0,
       IF(IFNULL(pa.moopart, '') <> '', CONCAT('ม.', pa.moopart), NULL),
       CONCAT('ม.', CAST(vil.village_moo AS UNSIGNED))),
    IF(IFNULL(vil.village_moo, 0) = 0, ta_pa.full_name, ta_h.full_name)
  )) AS address,
  IFNULL(ptt.name, IFNULL(p.pttype, '')) AS person_pttypename
`

export const PERSON_FROM_JOINS = `
  FROM person p
  LEFT JOIN house h ON h.house_id = p.house_id
  LEFT JOIN village vil ON vil.village_id = h.village_id
  LEFT JOIN thaiaddress ta_h ON ta_h.addressid = vil.address_id
  LEFT JOIN person_address pa ON pa.person_id = p.person_id
  LEFT JOIN thaiaddress ta_pa ON ta_pa.addressid = CONCAT(IFNULL(pa.chwpart,''), IFNULL(pa.amppart,''), IFNULL(pa.tmbpart,''))
  LEFT JOIN nationality nat ON nat.nationality = p.nationality
  LEFT JOIN pttype ptt ON ptt.pttype = p.pttype
`

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

export function compareTargetItems(
  a: CcsTargetPopulationItem,
  b: CcsTargetPopulationItem,
  sortBy: CcsTargetSortField,
  sortOrder: 'asc' | 'desc'
): number {
  const dir = sortOrder === 'desc' ? -1 : 1

  if (sortBy === 'age') {
    const av = a.age ?? -1
    const bv = b.age ?? -1
    if (av !== bv) return (av - bv) * dir
  } else if (sortBy === 'compensated') {
    if (a.compensated !== b.compensated) return (a.compensated - b.compensated) * dir
  } else if (sortBy === 'vstdate' || sortBy === 'comeback_date') {
    const av = a[sortBy] || ''
    const bv = b[sortBy] || ''
    // Always keep empty dates at the bottom unless explicitly equal
    if (!av && bv) return 1
    if (av && !bv) return -1
    if (av !== bv) return av.localeCompare(bv) * dir
  } else {
    const av = String(a[sortBy] || '')
    const bv = String(b[sortBy] || '')
    if (av !== bv) return av.localeCompare(bv, 'th') * dir
  }

  return a.hn.localeCompare(b.hn, 'th')
}

export function compareScreenedItems(
  a: CcsScreenedRecipientItem,
  b: CcsScreenedRecipientItem,
  sortBy: CcsScreenedSortField,
  sortOrder: 'asc' | 'desc'
): number {
  const dir = sortOrder === 'desc' ? -1 : 1

  if (sortBy === 'age') {
    const av = a.age ?? -1
    const bv = b.age ?? -1
    if (av !== bv) return (av - bv) * dir
  } else if (sortBy === 'compensated') {
    if (a.compensated !== b.compensated) return (a.compensated - b.compensated) * dir
  } else if (sortBy === 'nhso') {
    if (a.nhso !== b.nhso) return (a.nhso - b.nhso) * dir
  } else if (sortBy === 'vstdate') {
    const av = `${a.vstdate} ${a.vsttime || ''}`
    const bv = `${b.vstdate} ${b.vsttime || ''}`
    if (av !== bv) return av.localeCompare(bv) * dir
  } else {
    const av = String(a[sortBy] || '')
    const bv = String(b[sortBy] || '')
    if (av !== bv) return av.localeCompare(bv, 'th') * dir
  }

  return a.vn.localeCompare(b.vn, 'th')
}

export function compareService1B004NItems(
  a: CcsService1B004NItem,
  b: CcsService1B004NItem,
  sortBy: CcsService1B004NSortField,
  sortOrder: 'asc' | 'desc'
): number {
  const dir = sortOrder === 'desc' ? -1 : 1

  if (sortBy === 'age') {
    const av = a.age ?? -1
    const bv = b.age ?? -1
    if (av !== bv) return (av - bv) * dir
  } else if (sortBy === 'compensated') {
    if (a.compensated !== b.compensated) return (a.compensated - b.compensated) * dir
  } else if (sortBy === 'vstdate') {
    const av = `${a.vstdate} ${a.vsttime || ''}`
    const bv = `${b.vstdate} ${b.vsttime || ''}`
    if (av !== bv) return av.localeCompare(bv) * dir
  } else {
    const av = String(a[sortBy] || '')
    const bv = String(b[sortBy] || '')
    if (av !== bv) return av.localeCompare(bv, 'th') * dir
  }

  return a.vn.localeCompare(b.vn, 'th')
}
