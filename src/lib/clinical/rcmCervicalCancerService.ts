import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams, type QueryExecutor } from './rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'

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
}

// ── 8. Internal Helpers ────────────────────────────────────────────────

const PERSON_SELECT_COLUMNS = `
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

const PERSON_FROM_JOINS = `
  FROM person p
  LEFT JOIN house h ON h.house_id = p.house_id
  LEFT JOIN village vil ON vil.village_id = h.village_id
  LEFT JOIN thaiaddress ta_h ON ta_h.addressid = vil.address_id
  LEFT JOIN person_address pa ON pa.person_id = p.person_id
  LEFT JOIN thaiaddress ta_pa ON ta_pa.addressid = CONCAT(IFNULL(pa.chwpart,''), IFNULL(pa.amppart,''), IFNULL(pa.tmbpart,''))
  LEFT JOIN nationality nat ON nat.nationality = p.nationality
  LEFT JOIN pttype ptt ON ptt.pttype = p.pttype
`

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

function compareTargetItems(
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

function compareScreenedItems(
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

function compareService1B004NItems(
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

// ── 6. Cervical Cancer Screening (CCS) Domain Service ──────────────────

export class RcmCervicalCancerService {
  /**
   * Look up person demographics by 13-digit CIDs (FoxPro `Proc QueryPerson`).
   */
  static async lookupPersonsByCids(
    cids: string[],
    executor: QueryExecutor = queryClinicalDb
  ): Promise<Map<string, RepIndividualPersonLookup>> {
    const map = new Map<string, RepIndividualPersonLookup>()
    const uniqueCids = Array.from(
      new Set(cids.map((c) => c.replace(/\D/g, '')).filter((c) => c.length === 13))
    )
    if (uniqueCids.length === 0) return map

    for (const chunk of chunkArray(uniqueCids, 400)) {
      const ph = chunk.map(() => '?').join(',')
      const rows = await executor(
        `SELECT ${PERSON_SELECT_COLUMNS} ${PERSON_FROM_JOINS} WHERE p.cid IN (${ph})`,
        chunk,
        { timeoutMs: 45000 }
      )
      for (const r of rows || []) {
        const cid = String(r.cid || '').replace(/\D/g, '')
        if (!cid || map.has(cid)) continue
        map.set(cid, {
          person_id: String(r.person_id || ''),
          hn: String(r.hn || '').trim(),
          cid,
          ptname: String(r.ptname || '').trim(),
          birthdate: r.birthdate ? String(r.birthdate) : null,
          age: r.age != null ? Number(r.age) : null,
          sex: r.sex ? String(r.sex) : null,
          nation: r.nation ? String(r.nation).trim() : null,
          person_discharge_id: r.person_discharge_id != null ? Number(r.person_discharge_id) : null,
          typearea: String(r.typearea || '').trim(),
          address: String(r.address || '').trim(),
        })
      }
    }

    return map
  }

  /**
   * 1. หญิงไทยอายุ 30 - 60 ปี ได้รับการตรวจคัดกรองมะเร็งปากมดลูก
   * Reconciles HOSxP `person` target population (female, Thai, age 30-60, discharge=9)
   * with OPD CCS screening visits (`tmpPapSmear`), `rcmdb.seamless` (`tmpCCS`),
   * `rcmdb.repeclaim` (`nhso` HPV), and CID-level `CheckData` + `QueryPerson`.
   */
  static async getTargetPopulationReport(
    params: CcsTargetPopulationParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsTargetPopulationResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const screeningFilter: CcsTargetScreeningFilter = params.screeningFilter || 'ALL'
    const typeareaFilter: 'ALL' | '1_3' = params.typeareaFilter || 'ALL'
    const searchField: CcsTargetSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CcsTargetSortField = params.sortBy || 'hn'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'asc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ccs-p1-target-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const allRows = await getCachedData(
      cacheKey,
      async () => {
        const [personRows, visitRows, seamlessRows, hpvRepRows] = await Promise.all([
          executor(
            `
            SELECT ${PERSON_SELECT_COLUMNS}
            ${PERSON_FROM_JOINS}
            WHERE TIMESTAMPDIFF(YEAR, p.birthdate, NOW()) BETWEEN 30 AND 60
              AND p.sex = '2'
              AND p.nationality = '99'
              AND p.person_discharge_id = 9
            ORDER BY p.patient_hn ASC, p.person_id ASC
            `,
            [],
            { timeoutMs: 90000 }
          ),
          executor(
            `
            SELECT
              o.vn,
              o.hn,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              NULLIF(TRIM(s.cc), '') AS cc,
              CONCAT_WS(',', NULLIF(v.pdx,''), NULLIF(v.dx0,''), NULLIF(v.dx1,''), NULLIF(v.dx2,''), NULLIF(v.dx3,''), NULLIF(v.dx4,''), NULLIF(v.dx5,'')) AS icd10,
              GROUP_CONCAT(DISTINCT IFNULL(hc.name, NULLIF(pp.dest_hospcode, ''))) AS hospital,
              GROUP_CONCAT(DISTINCT doc.name) AS doctorname,
              GROUP_CONCAT(DISTINCT t.pp_special_code) AS pp_codes
            FROM ovst o
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN opdscreen s ON s.vn = o.vn
            LEFT JOIN pp_special pp ON pp.vn = o.vn
            LEFT JOIN pp_special_type t ON t.pp_special_type_id = pp.pp_special_type_id
            LEFT JOIN hospcode hc ON hc.hospcode = pp.dest_hospcode
            LEFT JOIN doctor doc ON doc.code = pp.doctor
            WHERE o.vstdate BETWEEN ? AND ?
              AND (
                t.pp_special_code REGEXP '^1B004|^1B30|^1B40|^0320277'
                OR CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) REGEXP 'Z124'
              )
            GROUP BY o.vn
            ORDER BY o.vn ASC
            `,
            [ds1, ds2],
            { timeoutMs: 60000 }
          ),
          executor(
            `
            SELECT
              VN AS vn,
              HN AS hn,
              PID AS cid,
              Ptname AS ptname,
              Rep AS rep,
              DATE_FORMAT(AdmDate, '%Y-%m-%d') AS admdate,
              PayNo AS payno,
              Status AS status,
              IFNULL(Compensated, 0) AS compensated,
              HSub AS hsub,
              Note AS note
            FROM rcmdb.seamless
            WHERE Rep REGEXP 'CCS'
              AND AdmDate >= ? AND AdmDate < DATE_ADD(?, INTERVAL 1 DAY)
              AND IFNULL(Compensated, 0) > 0
            `,
            [ds1, ds2],
            { timeoutMs: 60000 }
          ),
          executor(
            `
            SELECT
              VN AS vn,
              HN AS hn,
              PID AS cid,
              Rep AS rep,
              IFNULL(Compensated, 0) AS compensated
            FROM rcmdb.repeclaim
            WHERE AdmDate >= ? AND AdmDate < DATE_ADD(?, INTERVAL 1 DAY)
              AND FileName REGEXP 'HPV'
            `,
            [ds1, ds2],
            { timeoutMs: 60000 }
          ),
        ])

        // Group screening visits by HN (ordered by o.vn ASC)
        const visitsByHn = new Map<string, Record<string, unknown>[]>()
        for (const v of visitRows || []) {
          const hn = String(v.hn || '').trim()
          if (!hn) continue
          const arr = visitsByHn.get(hn) || []
          arr.push(v)
          visitsByHn.set(hn, arr)
        }

        // Index seamless (tmpCCS) by VN, HN, and CID (for FoxPro CheckData reconciliation)
        const seamlessByVn = new Map<string, Record<string, unknown>[]>()
        const seamlessByHn = new Map<string, Record<string, unknown>[]>()
        const seamlessByCid = new Map<string, Record<string, unknown>[]>()
        for (const s of seamlessRows || []) {
          const vn = String(s.vn || '').trim()
          if (vn) {
            const arr = seamlessByVn.get(vn) || []
            arr.push(s)
            seamlessByVn.set(vn, arr)
          }
          const hn = String(s.hn || '').trim()
          if (hn) {
            const arr = seamlessByHn.get(hn) || []
            arr.push(s)
            seamlessByHn.set(hn, arr)
          }
          const cid = String(s.cid || '').replace(/\D/g, '')
          if (cid.length === 13) {
            const arr = seamlessByCid.get(cid) || []
            arr.push(s)
            seamlessByCid.set(cid, arr)
          }
        }

        // Index NHSO HPV repeclaim by VN and HN
        const hpvByVn = new Map<string, Record<string, unknown>[]>()
        const hpvByHn = new Map<string, Record<string, unknown>[]>()
        for (const h of hpvRepRows || []) {
          const vn = String(h.vn || '').trim()
          if (vn) {
            const arr = hpvByVn.get(vn) || []
            arr.push(h)
            hpvByVn.set(vn, arr)
          }
          const hn = String(h.hn || '').trim()
          if (hn) {
            const arr = hpvByHn.get(hn) || []
            arr.push(h)
            hpvByHn.set(hn, arr)
          }
        }

        const seenCids = new Set<string>()
        const items: CcsTargetPopulationItem[] = []

        for (const p of personRows || []) {
          const hn = String(p.hn || '').trim()
          const cid = String(p.cid || '').trim()
          const cleanCid = cid.replace(/\D/g, '')
          if (cleanCid) seenCids.add(cleanCid)

          const visits = hn ? visitsByHn.get(hn) || [] : []
          const vDates: string[] = []
          const ccs: string[] = []
          const icd10s: string[] = []
          const hospitals = new Set<string>()
          const doctors = new Set<string>()
          const allPpCodes: string[] = []
          let latestVn: string | null = null

          const matchedSeamlessSet = new Set<Record<string, unknown>>()
          const matchedHpvSet = new Set<Record<string, unknown>>()

          for (const v of visits) {
            const vn = String(v.vn || '').trim()
            if (vn) {
              latestVn = vn
              for (const sm of seamlessByVn.get(vn) || []) matchedSeamlessSet.add(sm)
              for (const hp of hpvByVn.get(vn) || []) matchedHpvSet.add(hp)
            }
            if (v.vstdate && !vDates.includes(String(v.vstdate))) {
              vDates.push(String(v.vstdate))
            }
            if (v.cc && !ccs.includes(String(v.cc))) {
              ccs.push(String(v.cc))
            }
            if (v.icd10 && !icd10s.includes(String(v.icd10))) {
              icd10s.push(String(v.icd10))
            }
            if (v.hospital) {
              String(v.hospital)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((h) => hospitals.add(h))
            }
            if (v.doctorname) {
              String(v.doctorname)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((d) => doctors.add(d))
            }
            if (v.pp_codes) {
              allPpCodes.push(...String(v.pp_codes).split(','))
            }
          }

          // Also match seamless/repeclaim by HN (for visits in range without PP code) and CID (FoxPro CheckData)
          if (hn) {
            for (const sm of seamlessByHn.get(hn) || []) matchedSeamlessSet.add(sm)
            for (const hp of hpvByHn.get(hn) || []) matchedHpvSet.add(hp)
          }
          if (cleanCid) {
            for (const sm of seamlessByCid.get(cleanCid) || []) matchedSeamlessSet.add(sm)
          }

          const combinedSeamless = Array.from(matchedSeamlessSet)
          const combinedHpv = Array.from(matchedHpvSet)

          if (!latestVn) {
            const smWithVn = combinedSeamless.find((s) => s.vn)
            const hpWithVn = combinedHpv.find((h) => h.vn)
            if (smWithVn?.vn) latestVn = String(smWithVn.vn).trim()
            else if (hpWithVn?.vn) latestVn = String(hpWithVn.vn).trim()
          }

          const ppClass = classifyPpSpecialCodes(allPpCodes)
          const isScreenedInHosxp = visits.length > 0

          const reps = new Set<string>()
          const comebackDates = new Set<string>()
          const paynos = new Set<string>()
          const statuses = new Set<string>()
          const hsubs = new Set<string>()
          const remarks = new Set<string>()
          let compensated = 0

          // Populate seamless metadata (comeback_date, payno, status, hsub, remark)
          for (const sm of combinedSeamless) {
            if (sm.admdate) comebackDates.add(String(sm.admdate).trim())
            if (sm.payno) paynos.add(String(sm.payno).trim())
            if (sm.status) statuses.add(String(sm.status).trim())
            if (sm.hsub) hsubs.add(String(sm.hsub).trim())
            if (sm.note) remarks.add(String(sm.note).trim())
          }

          // FoxPro: if(nhso.vn is not null, nhso.rep / nhso.compensated, ss.rep / ss.compensated)
          // plus CheckData updating seamless rep/compensated when seamless exists
          if (combinedSeamless.length > 0) {
            for (const sm of combinedSeamless) {
              if (sm.rep) reps.add(String(sm.rep).trim())
              compensated += Number(sm.compensated || 0)
            }
          } else if (combinedHpv.length > 0) {
            for (const hr of combinedHpv) {
              if (hr.rep) reps.add(String(hr.rep).trim())
              compensated += Number(hr.compensated || 0)
            }
          }

          const hasSeamlessRep = combinedSeamless.length > 0
          const comeback: 'Y' | null = hasSeamlessRep ? 'Y' : null
          const vstdateStr = vDates.length > 0 ? vDates.join(',') : null
          const comebackDateStr = comebackDates.size > 0 ? Array.from(comebackDates).join(',') : null

          // FoxPro tmpPapSmear: concat_ws(',','HOSxP', if(ss.rep is not null,'Rep',null))
          const note = hasSeamlessRep ? 'HOSxP,Rep' : 'HOSxP'

          const hasSameDayMatch =
            comeback === 'Y' &&
            ((vstdateStr !== null && comebackDateStr !== null && vstdateStr === comebackDateStr) ||
              vDates.some((d) => comebackDates.has(d)))

          let matchType: CcsTargetRowMatchType = 'unscreened'
          if (hasSameDayMatch) {
            matchType = 'matched_same_day'
          } else if (comeback === 'Y') {
            matchType = 'matched_diff_day'
          } else if (isScreenedInHosxp || combinedHpv.length > 0) {
            matchType = 'hosxp_only'
          }

          items.push({
            no: 0,
            person_id: String(p.person_id || ''),
            vn: latestVn,
            hn,
            cid,
            ptname: String(p.ptname || '').trim(),
            birthdate: p.birthdate ? String(p.birthdate) : null,
            age: p.age != null ? Number(p.age) : null,
            sex: String(p.sex || 'หญิง'),
            nation: String(p.nation || 'ไทย').trim(),
            person_discharge_id: p.person_discharge_id != null ? Number(p.person_discharge_id) : null,
            typearea: String(p.typearea || '').trim(),
            address: String(p.address || '').trim(),
            vstdate: vstdateStr,
            pttypename: isScreenedInHosxp ? String(p.person_pttypename || '').trim() || null : null,
            cc: ccs.length > 0 ? ccs.join(' | ') : null,
            icd10: icd10s.length > 0 ? icd10s.join(' | ') : null,
            hospital: hospitals.size > 0 ? Array.from(hospitals).join(', ') : null,
            doctorname: doctors.size > 0 ? Array.from(doctors).join(', ') : null,
            papsmear: ppClass.papsmear,
            papsmear_result: ppClass.papsmear_result,
            via: ppClass.via,
            via_result: ppClass.via_result,
            hpv: ppClass.hpv,
            hpv_result: ppClass.hpv_result,
            other: ppClass.other,
            other_result: ppClass.other_result,
            rep: reps.size > 0 ? Array.from(reps).join(',') : null,
            comeback,
            comeback_date: comebackDateStr,
            payno: paynos.size > 0 ? Array.from(paynos).join(',') : null,
            note,
            status: statuses.size > 0 ? Array.from(statuses).join(',') : null,
            compensated,
            hsub: hsubs.size > 0 ? Array.from(hsubs).join(',') : null,
            remark: remarks.size > 0 ? Array.from(remarks).join(' | ') : null,
            hasAbnormalResult: ppClass.hasAbnormalResult,
            matchType,
          })
        }

        // FoxPro CheckData + QueryPerson: reconcile Seamless CIDs not in the 30-60 active target table
        const unmatchedCids: string[] = []
        for (const cidKey of seamlessByCid.keys()) {
          if (!seenCids.has(cidKey)) {
            unmatchedCids.push(cidKey)
          }
        }

        const extraPersonMap =
          unmatchedCids.length > 0
            ? await RcmCervicalCancerService.lookupPersonsByCids(unmatchedCids, executor)
            : new Map<string, RepIndividualPersonLookup>()

        for (const cidKey of unmatchedCids) {
          const smGroup = seamlessByCid.get(cidKey) || []
          if (smGroup.length === 0) continue
          const first = smGroup[0]
          const foundPerson = extraPersonMap.get(cidKey)
          const totalComp = smGroup.reduce((acc, r) => acc + Number(r.compensated || 0), 0)

          items.push({
            no: 0,
            person_id: foundPerson?.person_id || '',
            vn: first.vn ? String(first.vn).trim() : null,
            hn: foundPerson?.hn || String(first.hn || '').trim(),
            cid: cidKey,
            ptname: foundPerson?.ptname || String(first.ptname || '').trim(),
            birthdate: foundPerson?.birthdate ?? null,
            age: foundPerson?.age ?? null,
            sex: foundPerson?.sex ?? null,
            nation: foundPerson?.nation ?? null,
            person_discharge_id: foundPerson?.person_discharge_id ?? null,
            typearea: foundPerson?.typearea || '',
            address: foundPerson?.address || '',
            vstdate: null,
            pttypename: null,
            cc: null,
            icd10: null,
            hospital: null,
            doctorname: null,
            papsmear: null,
            papsmear_result: null,
            via: null,
            via_result: null,
            hpv: null,
            hpv_result: null,
            other: null,
            other_result: null,
            rep:
              Array.from(new Set(smGroup.map((s) => String(s.rep || '').trim()).filter(Boolean))).join(',') ||
              null,
            comeback: 'Y',
            comeback_date:
              Array.from(new Set(smGroup.map((s) => String(s.admdate || '').trim()).filter(Boolean))).join(
                ','
              ) || null,
            payno:
              Array.from(new Set(smGroup.map((s) => String(s.payno || '').trim()).filter(Boolean))).join(',') ||
              null,
            note: 'Rep',
            status:
              Array.from(new Set(smGroup.map((s) => String(s.status || '').trim()).filter(Boolean))).join(
                ','
              ) || null,
            compensated: totalComp,
            hsub:
              Array.from(new Set(smGroup.map((s) => String(s.hsub || '').trim()).filter(Boolean))).join(',') ||
              null,
            remark:
              Array.from(new Set(smGroup.map((s) => String(s.note || '').trim()).filter(Boolean))).join(
                ' | '
              ) || null,
            hasAbnormalResult: false,
            matchType: 'rep_only',
          })
        }

        return items
      },
      300000 // 5 minutes cache TTL
    )

    let workingRows = allRows
    if (params.extraRepRows && params.extraRepRows.length > 0) {
      const excelDatesByCid = new Map<string, Set<string>>()
      for (const er of params.extraRepRows) {
        const cid = String(er.cid || '').replace(/\D/g, '')
        if (cid.length !== 13) continue
        const set = excelDatesByCid.get(cid) || new Set<string>()
        if (er.comebackDate) set.add(er.comebackDate)
        excelDatesByCid.set(cid, set)
      }

      if (excelDatesByCid.size > 0) {
        const matchedExcelCids = new Set<string>()
        workingRows = allRows.map((row) => {
          const cleanCid = row.cid.replace(/\D/g, '')
          const excelDates = excelDatesByCid.get(cleanCid)
          if (!excelDates) return row
          matchedExcelCids.add(cleanCid)

          const mergedDates = new Set<string>(
            (row.comeback_date || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          )
          for (const d of excelDates) mergedDates.add(d)
          const comebackDateStr = mergedDates.size > 0 ? Array.from(mergedDates).join(',') : row.comeback_date

          const vDates = (row.vstdate || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          const hasSameDay =
            (row.vstdate !== null && comebackDateStr !== null && row.vstdate === comebackDateStr) ||
            vDates.some((d) => mergedDates.has(d))

          const nextNote = row.note === 'Rep' ? 'Rep' : 'HOSxP,Rep'
          const nextMatchType: CcsTargetRowMatchType =
            nextNote === 'Rep' ? 'rep_only' : hasSameDay ? 'matched_same_day' : 'matched_diff_day'

          return {
            ...row,
            comeback: 'Y',
            comeback_date: comebackDateStr,
            note: nextNote,
            matchType: nextMatchType,
          }
        })

        const newExcelCids = Array.from(excelDatesByCid.keys()).filter((c) => !matchedExcelCids.has(c))
        if (newExcelCids.length > 0) {
          const personLookup = await RcmCervicalCancerService.lookupPersonsByCids(newExcelCids, executor)
          for (const cidKey of newExcelCids) {
            const found = personLookup.get(cidKey)
            const dates = Array.from(excelDatesByCid.get(cidKey) || [])
            workingRows.push({
              no: 0,
              person_id: found?.person_id || '',
              vn: null,
              hn: found?.hn || '',
              cid: cidKey,
              ptname: found?.ptname || '(พบในไฟล์ Rep Individual)',
              birthdate: found?.birthdate ?? null,
              age: found?.age ?? null,
              sex: found?.sex ?? null,
              nation: found?.nation ?? null,
              person_discharge_id: found?.person_discharge_id ?? null,
              typearea: found?.typearea || '',
              address: found?.address || '',
              vstdate: null,
              pttypename: null,
              cc: null,
              icd10: null,
              hospital: null,
              doctorname: null,
              papsmear: null,
              papsmear_result: null,
              via: null,
              via_result: null,
              hpv: null,
              hpv_result: null,
              other: null,
              other_result: null,
              rep: 'Rep_Individual',
              comeback: 'Y',
              comeback_date: dates.length > 0 ? dates.join(',') : null,
              payno: null,
              note: 'Rep',
              status: null,
              compensated: 0,
              hsub: null,
              remark: 'เทียบจากไฟล์ Rep_Individual',
              hasAbnormalResult: false,
              matchType: 'rep_only',
            })
          }
        }
      }
    }

    // Apply TypeArea scope filter before computing summary KPIs
    let scoped = workingRows
    if (typeareaFilter === '1_3') {
      scoped = scoped.filter(
        (r) => r.typearea === '1' || r.typearea === '3' || r.matchType === 'rep_only'
      )
    }

    const totalTarget = scoped.length
    const typearea13Count = workingRows.filter((r) => r.typearea === '1' || r.typearea === '3').length
    const screenedCount = scoped.filter(
      (r) => r.vstdate !== null || r.comeback === 'Y' || r.compensated > 0
    ).length
    const unscreenedCount = totalTarget - screenedCount
    const coverageRate = totalTarget > 0 ? Number(((screenedCount / totalTarget) * 100).toFixed(2)) : 0
    const abnormalCount = scoped.filter((r) => r.hasAbnormalResult).length
    const compensatedCount = scoped.filter((r) => r.comeback === 'Y' || r.compensated > 0).length
    const matchedSameDayCount = scoped.filter((r) => r.matchType === 'matched_same_day').length
    const matchedDiffDayCount = scoped.filter((r) => r.matchType === 'matched_diff_day').length
    const repOnlyCount = scoped.filter((r) => r.matchType === 'rep_only').length
    const totalCompensated = scoped.reduce((acc, r) => acc + r.compensated, 0)

    const summary: CcsTargetPopulationSummary = {
      totalTarget,
      typearea13Count,
      screenedCount,
      unscreenedCount,
      coverageRate,
      abnormalCount,
      compensatedCount,
      matchedSameDayCount,
      matchedDiffDayCount,
      repOnlyCount,
      totalCompensated,
    }

    // Apply screening status filter
    let filtered = scoped
    if (screeningFilter === 'SCREENED') {
      filtered = filtered.filter((r) => r.vstdate !== null || r.comeback === 'Y' || r.compensated > 0)
    } else if (screeningFilter === 'UNSCREENED') {
      filtered = filtered.filter((r) => r.vstdate === null && r.comeback !== 'Y' && r.compensated === 0)
    } else if (screeningFilter === 'ABNORMAL') {
      filtered = filtered.filter((r) => r.hasAbnormalResult)
    } else if (screeningFilter === 'COMPENSATED') {
      filtered = filtered.filter((r) => r.comeback === 'Y' || r.compensated > 0)
    } else if (screeningFilter === 'MATCHED_SAME_DAY') {
      filtered = filtered.filter((r) => r.matchType === 'matched_same_day')
    } else if (screeningFilter === 'MATCHED_DIFF_DAY') {
      filtered = filtered.filter((r) => r.matchType === 'matched_diff_day')
    } else if (screeningFilter === 'REP_ONLY') {
      filtered = filtered.filter((r) => r.matchType === 'rep_only')
    }

    // Apply search filter (FoxPro lblFind / txtFind: HN, CID, PTNAME, or ALL)
    if (search) {
      filtered = filtered.filter((r) => {
        if (searchField === 'HN') {
          return r.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          return r.cid.includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return r.ptname.toLowerCase().includes(search)
        }
        return (
          r.hn.toLowerCase().includes(search) ||
          r.cid.includes(search) ||
          r.ptname.toLowerCase().includes(search) ||
          r.address.toLowerCase().includes(search) ||
          (r.rep && r.rep.toLowerCase().includes(search))
        )
      })
    }

    // Sort (FoxPro ToClick)
    const sorted =
      sortBy === 'hn' && sortOrder === 'asc'
        ? filtered
        : [...filtered].sort((a, b) => compareTargetItems(a, b, sortBy, sortOrder))

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
      screeningFilter,
      typeareaFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
    }
  }

  /**
   * 1.2 รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก (Screened Recipients)
   * Corresponds to FoxPro `1.1.รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก` report:
   * Queries OPD visits in date range receiving CCS screening (PP special code,
   * Z124 diagnosis, Colposcopy ADP 1B005, or mapped CCS ADP items),
   * reconciles with Seamless (`rcmdb.seamless` CCS), HPV Rep (`rcmdb.repeclaim`),
   * AuthenCode, and NHSO / Rep / NewEclaim / EClaim reimbursement status.
   */
  static async getScreenedRecipientsReport(
    params: CcsScreenedRecipientsParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsScreenedRecipientsResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const methodFilter: CcsMethodFilter = params.methodFilter || 'ALL'
    const okFilter: CcsOkFilter = params.okFilter || 'ALL'
    const resultStatusFilter: CcsResultStatusFilter = params.resultStatusFilter || 'ALL'
    const compensationFilter: CcsCompensationFilter = params.compensationFilter || 'ALL'
    const searchField: CcsScreenedSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CcsScreenedSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ccs-p2-recipients-${ds1}-${ds2}`

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const sql = `
          SELECT 
            o.vn,
            o.an,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
            IFNULL(nat.name, pt.nationality) AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            ptt_pt.name AS pttypename_patient,
            ptt_o.name AS pttypename_visit,
            ptt_o.pttype_eclaim_id AS pttype_eclaim_id,
            dep.department,
            spc.name AS clinic,
            v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            IF(GROUP_CONCAT(DISTINCT IF(t.pp_special_code REGEXP '^1B004|^1B30' OR pap.checkup = 'Y', 'Y', NULL)) IS NOT NULL, 'Y', NULL) AS ok,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0044','1B30','1B40','1B004N','1B004P'), t.pp_special_code, NULL)) AS papsmear,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0044','1B30','1B004N'), 'ปกติ', IF(t.pp_special_code IN ('1B40','1B004P'), 'ผิดปกติ', NULL))) AS papsmear_result,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0040','1B0041','1B0042','1B0043','1B0045','1B004_0N','1B004_0P'), t.pp_special_code, NULL)) AS via,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0040','1B0043','1B004_0N'), 'ปกติ', IF(t.pp_special_code IN ('1B0041','1B0042','1B0043','1B0045','1B004_0P'), 'ผิดปกติ', NULL))) AS via_result,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code REGEXP '^1B0046', t.pp_special_code, NULL)) AS hpv,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code REGEXP '1B0046_[12]', 'ผิดปกติ', IF(t.pp_special_code REGEXP '1B0046', 'ปกติ', NULL))) AS hpv_result,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0048','1B0049','0320277_0','0320277_1'), t.pp_special_code, NULL)) AS other,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0048','1B0049','0320277_0'), 'ปกติ', IF(t.pp_special_code IN ('0320277_1'), 'ผิดปกติ', NULL))) AS other_result,
            pap.checkup AS colposcopy,
            GROUP_CONCAT(DISTINCT sm.type) AS type,
            IF(rr.vn IS NOT NULL, rr.rep, sm.rep) AS rep,
            IF(rr.vn IS NOT NULL, rr.compensated, sm.compensated) AS compensated,
            sm.note,
            DATE_FORMAT(sm.paydate, '%Y-%m-%d') AS paydate,
            c.name AS listname,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep_nhso,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated) AS nhso
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt_pt ON ptt_pt.pttype = pt.pttype
          LEFT JOIN pttype ptt_o ON ptt_o.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN pp_special pp ON o.vn = pp.vn
          LEFT JOIN pp_special_type t ON t.pp_special_type_id = pp.pp_special_type_id
          LEFT JOIN rcmdb.seamless sm ON sm.vn = o.vn AND sm.rep REGEXP 'CCS'
          LEFT JOIN rcmdb.repeclaim rr ON rr.vn = o.vn AND rr.filename REGEXP 'HPV'
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN visit_pttype vt ON vt.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'NHSO :: มี Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'Rep :: มี Rep แล้ว' AS statusname
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) rep ON rep.vn = o.vn
          LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
          LEFT JOIN (
            SELECT m.opdseq AS vn,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                   SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
            FROM eclaimdb.m_registerdata m
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> ''
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          LEFT JOIN (
            SELECT o2.vn, 'Y' AS checkup
            FROM ovst o2
            JOIN opitemrece oo ON oo.vn = o2.vn
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE o2.vstdate BETWEEN ? AND ? AND d.nhso_adp_code = '1B005'
            GROUP BY o2.vn
          ) pap ON pap.vn = o.vn
          LEFT JOIN (
            SELECT oo.vn, GROUP_CONCAT(DISTINCT d.nhso_adp_code) AS name
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE IFNULL(oo.vn,'') <> '' AND oo.vstdate BETWEEN ? AND ?
              AND d.nhso_adp_code IN ('1B0046_0','1B0046_01','1B0046_1','1B0046_11','1B0046_2','1B0046_21','1B004_0N','1B004_0P','1B004N','1B004P','1B005')
            GROUP BY oo.vn
          ) c ON c.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
            AND (
              t.pp_special_code REGEXP '^1B004|^1B30|^01B40|^0320277'
              OR CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) REGEXP 'Z124'
              OR pap.checkup = 'Y'
              OR c.vn IS NOT NULL
            )
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC
        `
        return (await executor(
          sql,
          [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
          { timeoutMs: 60000 }
        )) as Record<string, unknown>[]
      },
      300000
    )

    const items: CcsScreenedRecipientItem[] = (rawRows || []).map((r) => {
      const papsmear_result = r.papsmear_result ? String(r.papsmear_result).trim() : null
      const via_result = r.via_result ? String(r.via_result).trim() : null
      const hpv_result = r.hpv_result ? String(r.hpv_result).trim() : null
      const other_result = r.other_result ? String(r.other_result).trim() : null

      const hasAbnormalResult =
        Boolean(papsmear_result && papsmear_result.includes('ผิดปกติ')) ||
        Boolean(via_result && via_result.includes('ผิดปกติ')) ||
        Boolean(hpv_result && hpv_result.includes('ผิดปกติ')) ||
        Boolean(other_result && other_result.includes('ผิดปกติ'))

      return {
        no: 0,
        vn: String(r.vn || '').trim(),
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').replace(/\D/g, ''),
        ptname: String(r.ptname || '').trim(),
        age: r.age != null ? Number(r.age) : null,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        pttypename_patient: r.pttypename_patient ? String(r.pttypename_patient).trim() : null,
        pttypename_visit: r.pttypename_visit ? String(r.pttypename_visit).trim() : null,
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
        ok: r.ok === 'Y' ? 'Y' : null,
        papsmear: r.papsmear ? String(r.papsmear).trim() : null,
        papsmear_result,
        via: r.via ? String(r.via).trim() : null,
        via_result,
        hpv: r.hpv ? String(r.hpv).trim() : null,
        hpv_result,
        other: r.other ? String(r.other).trim() : null,
        other_result,
        colposcopy: r.colposcopy === 'Y' ? 'Y' : null,
        type: r.type ? String(r.type).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: Number(r.compensated || 0),
        note: r.note ? String(r.note).trim() : null,
        paydate: r.paydate ? String(r.paydate).trim() : null,
        listname: r.listname ? String(r.listname).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep_nhso: r.rep_nhso ? String(r.rep_nhso).trim() : null,
        nhso: Number(r.nhso || 0),
        hasAbnormalResult,
      }
    })

    // Full Page Filter: Apply pttypes / ucOnly filter across all cohort items before summary & pagination
    const summaryCohort = items.filter((i) => {
      if (params.pttypes !== undefined) {
        return matchesPttypeFilter((i as any).pttypename || i.pttypename_visit || i.pttypename_patient || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      }
      if (params.ucOnly) {
        return i.isUc ?? false
      }
      return true
    })

    // Compute Summary across summaryCohort
    const totalVisits = summaryCohort.length
    const uniqueHns = new Set(summaryCohort.map((i) => i.hn).filter(Boolean))
    const uniquePatients = uniqueHns.size
    const okCount = summaryCohort.filter((i) => i.ok === 'Y').length
    const notOkCount = summaryCohort.filter((i) => i.ok !== 'Y').length
    const papCount = summaryCohort.filter((i) => Boolean(i.papsmear)).length
    const viaCount = summaryCohort.filter((i) => Boolean(i.via)).length
    const hpvCount = summaryCohort.filter((i) => Boolean(i.hpv)).length
    const colposcopyCount = summaryCohort.filter((i) => i.colposcopy === 'Y').length
    const abnormalCount = summaryCohort.filter((i) => i.hasAbnormalResult).length
    const totalSeamlessCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalNhsoCompensated = summaryCohort.reduce((acc, i) => acc + i.nhso, 0)

    const summary: CcsScreenedRecipientsSummary = {
      totalVisits,
      uniquePatients,
      okCount,
      notOkCount,
      papCount,
      viaCount,
      hpvCount,
      colposcopyCount,
      abnormalCount,
      totalSeamlessCompensated,
      totalNhsoCompensated,
    }

    // Filter by screening method (FoxPro cshow: ทั้งหมด, PapSmear, VIA, HPV, ColpoScopy)
    let filtered = summaryCohort
    if (methodFilter === 'PapSmear') {
      filtered = filtered.filter((i) => Boolean(i.papsmear))
    } else if (methodFilter === 'VIA') {
      filtered = filtered.filter((i) => Boolean(i.via))
    } else if (methodFilter === 'HPV') {
      filtered = filtered.filter((i) => Boolean(i.hpv))
    } else if (methodFilter === 'ColpoScopy') {
      filtered = filtered.filter((i) => i.colposcopy === 'Y')
    }

    // Filter by OK recording status
    if (okFilter === 'OK') {
      filtered = filtered.filter((i) => i.ok === 'Y')
    } else if (okFilter === 'NOT_OK') {
      filtered = filtered.filter((i) => i.ok !== 'Y')
    }

    // Filter by test results
    if (resultStatusFilter === 'ABNORMAL') {
      filtered = filtered.filter((i) => i.hasAbnormalResult)
    } else if (resultStatusFilter === 'NORMAL') {
      filtered = filtered.filter((i) => !i.hasAbnormalResult)
    }

    // Filter by compensation
    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.compensated > 0 || i.nhso > 0 || i.status !== null || i.rep !== null)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter(
        (i) => i.compensated === 0 && i.nhso === 0 && i.status === null && i.rep === null
      )
    }

    // Filter by search
    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') {
          return i.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          return i.cid.includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return i.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return i.vn.toLowerCase().includes(search)
        }
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search))
        )
      })
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => compareScreenedItems(a, b, sortBy, sortOrder))

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
      methodFilter,
      okFilter,
      resultStatusFilter,
      compensationFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
    }
  }

  /**
   * Checks whether the NHSO ADP Code '1B004N' is mapped in `s_drugitems` (FoxPro `updatedrugitems` check).
   */
  static async check1B004NAdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsAdpMappingCheck> {
    try {
      const rows = (await executor(
        `
        SELECT 
          d.icode, 
          d.name, 
          d.strength, 
          d.nhso_adp_code
        FROM s_drugitems d
        WHERE TRIM(d.nhso_adp_code) IN ('1B004N', '1b004n')
        ORDER BY d.icode ASC
        `,
        [],
        { timeoutMs: 15000 }
      )) as CcsAdpMappingItem[]

      return {
        isMapped: rows.length > 0,
        mappedCount: rows.length,
        items: rows.map((r) => ({
          icode: String(r.icode || ''),
          name: String(r.name || ''),
          strength: r.strength ? String(r.strength) : null,
          nhso_adp_code: String(r.nhso_adp_code || ''),
        })),
      }
    } catch {
      return {
        isMapped: false,
        mappedCount: 0,
        items: [],
      }
    }
  }

  /**
   * 1.3 บริการ 1B004N (HPV DNA Service Report)
   * Corresponds to FoxPro `1.3.บริการ 1B004N` report:
   * Queries OPD visits in date range receiving prescribed ADP code 1B004N in `opitemrece` + `s_drugitems`,
   * reconciles with AuthenCode, diagnoses (pdx, dx0..dx5), procedures (op0..op5),
   * and reimbursement status (NHSO / Rep / NewEclaim / EClaim).
   */
  static async getService1B004NReport(
    params: CcsService1B004NParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsService1B004NResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const compensationFilter: CcsService1B004NCompensationFilter = params.compensationFilter || 'ALL'
    const searchField: CcsService1B004NSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CcsService1B004NSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ccs-p3-1b004n-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          RcmCervicalCancerService.check1B004NAdpMapping(executor),
          executor(
            `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              ptt.name AS pttypename,
              dep.department,
              spc.name AS clinic,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              dd.name AS listname,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated
            FROM ovst o
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype vt ON vt.vn = o.vn
            JOIN (
              SELECT 
                oo.vn, 
                GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate BETWEEN ? AND ?
                AND TRIM(d.nhso_adp_code) IN ('1B004N', '1b004n')
              GROUP BY oo.vn
            ) dd ON dd.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) rep ON rep.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN (
              SELECT m.opdseq AS vn,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                     SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
              FROM eclaimdb.m_registerdata m
              LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
              WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> ''
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            WHERE o.vstdate BETWEEN ? AND ?
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC
            `,
            [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
            { timeoutMs: 90000 }
          ),
        ])

        return { rawRows: rows as Record<string, unknown>[], adpMapping: mappingRes }
      },
      600
    )

    const allItems: CcsService1B004NItem[] = rawRows.map((r, idx) => {
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
        listname: r.listname ? String(r.listname).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: compensated > 0,
      }
    })

    const uniquePatients = new Set(allItems.map((i) => i.hn).filter(Boolean)).size
    let compensatedVisits = 0
    let uncompensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let withPdxCount = 0
    let withOpCount = 0

    for (const item of allItems) {
      if (item.compensated > 0) {
        compensatedVisits++
        totalCompensated += item.compensated
      } else {
        uncompensatedVisits++
      }

      if (item.authencode) {
        withAuthenCount++
      } else {
        withoutAuthenCount++
      }

      if (item.pdx) {
        withPdxCount++
      }

      if (item.op0 || item.op1 || item.op2 || item.op3 || item.op4 || item.op5) {
        withOpCount++
      }
    }

    const totalVisits = allItems.length
    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0

    const summary: CcsService1B004NSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      withPdxCount,
      withOpCount,
    }

    let filtered = allItems

    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.compensated > 0)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => i.compensated <= 0)
    } else if (compensationFilter === 'HAS_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (compensationFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') {
          return i.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          return i.cid.includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return i.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return i.vn.toLowerCase().includes(search)
        }
        if (searchField === 'DIAG') {
          return [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5]
            .filter(Boolean)
            .some((dx) => dx!.toLowerCase().includes(search))
        }
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.status && i.status.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search))
        )
      })
    }

    const sorted = [...filtered].sort((a, b) => compareService1B004NItems(a, b, sortBy, sortOrder))

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
      adpMapping,
      compensationFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
    }
  }

  /**
   * Checks whether the NHSO ADP Code '1B004P' is mapped in `s_drugitems` (FoxPro `updatedrugitems` check).
   */
  static async check1B004PAdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsAdpMappingCheck> {
    try {
      const rows = (await executor(
        `
        SELECT 
          d.icode, 
          d.name, 
          d.strength, 
          d.nhso_adp_code
        FROM s_drugitems d
        WHERE TRIM(d.nhso_adp_code) IN ('1B004P', '1b004p')
        ORDER BY d.icode ASC
        `,
        [],
        { timeoutMs: 15000 }
      )) as CcsAdpMappingItem[]

      return {
        isMapped: rows.length > 0,
        mappedCount: rows.length,
        items: rows.map((r) => ({
          icode: String(r.icode || ''),
          name: String(r.name || ''),
          strength: r.strength ? String(r.strength) : null,
          nhso_adp_code: String(r.nhso_adp_code || ''),
        })),
      }
    } catch {
      return {
        isMapped: false,
        mappedCount: 0,
        items: [],
      }
    }
  }

  /**
   * 1.4 บริการ 1B004P (HPV DNA Repeat / Positive Service Report)
   * Corresponds to FoxPro `1.4.บริการ 1B004P` report:
   * Queries OPD visits in date range receiving prescribed ADP code 1B004P in `opitemrece` + `s_drugitems`,
   * reconciles with AuthenCode, diagnoses (pdx, dx0..dx5), procedures (op0..op5),
   * and reimbursement status (NHSO / Rep / NewEclaim / EClaim).
   */
  static async getService1B004PReport(
    params: CcsService1B004PParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsService1B004PResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const compensationFilter: CcsService1B004PCompensationFilter = params.compensationFilter || 'ALL'
    const searchField: CcsService1B004PSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CcsService1B004PSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ccs-p4-1b004p-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          RcmCervicalCancerService.check1B004PAdpMapping(executor),
          executor(
            `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              ptt.name AS pttypename,
              dep.department,
              spc.name AS clinic,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              dd.name AS listname,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated
            FROM ovst o
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype vt ON vt.vn = o.vn
            JOIN (
              SELECT 
                oo.vn, 
                GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate BETWEEN ? AND ?
                AND TRIM(d.nhso_adp_code) IN ('1B004P', '1b004p')
              GROUP BY oo.vn
            ) dd ON dd.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) rep ON rep.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN (
              SELECT m.opdseq AS vn,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                     SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
              FROM eclaimdb.m_registerdata m
              LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
              WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> ''
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            WHERE o.vstdate BETWEEN ? AND ?
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC
            `,
            [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
            { timeoutMs: 90000 }
          ),
        ])

        return { rawRows: rows, adpMapping: mappingRes }
      },
      600
    )

    const allItems: CcsService1B004PItem[] = rawRows.map((r, idx) => {
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
        listname: r.listname ? String(r.listname).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: compensated > 0,
      }
    })

    const uniquePatients = new Set(allItems.map((i) => i.hn).filter(Boolean)).size
    let compensatedVisits = 0
    let uncompensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let withPdxCount = 0
    let withOpCount = 0

    for (const item of allItems) {
      if (item.compensated > 0) {
        compensatedVisits++
        totalCompensated += item.compensated
      } else {
        uncompensatedVisits++
      }

      if (item.authencode) {
        withAuthenCount++
      } else {
        withoutAuthenCount++
      }

      if (item.pdx) {
        withPdxCount++
      }

      if (item.op0 || item.op1 || item.op2 || item.op3 || item.op4 || item.op5) {
        withOpCount++
      }
    }

    const totalVisits = allItems.length
    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0

    const summary: CcsService1B004PSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      withPdxCount,
      withOpCount,
    }

    let filtered = allItems

    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.compensated > 0)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => i.compensated <= 0)
    } else if (compensationFilter === 'HAS_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (compensationFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') {
          return i.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          return i.cid.replace(/\D/g, '').includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return i.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return i.vn.toLowerCase().includes(search)
        }
        if (searchField === 'DIAG') {
          const diagBlob = [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5, i.op0, i.op1, i.op2, i.op3, i.op4, i.op5]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return diagBlob.includes(search)
        }

        // Global search
        const cleanQ = search.replace(/\D/g, '')
        const matchCid = cleanQ ? i.cid.replace(/\D/g, '').includes(cleanQ) : false
        const matchText =
          i.ptname.toLowerCase().includes(search) ||
          i.hn.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search))

        return matchText || matchCid
      })
    }

    const sorted = [...filtered].sort((a, b) => {
      let valA: string | number = ''
      let valB: string | number = ''

      switch (sortBy) {
        case 'vstdate':
          valA = `${a.vstdate} ${a.vsttime}`
          valB = `${b.vstdate} ${b.vsttime}`
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
        case 'compensated':
          valA = a.compensated
          valB = b.compensated
          break
        case 'pdx':
          valA = a.pdx || ''
          valB = b.pdx || ''
          break
        case 'authencode':
          valA = a.authencode || ''
          valB = b.authencode || ''
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
      adpMapping,
      compensationFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
    }
  }

  /**
   * Checks whether the NHSO ADP Code '1B004_0N' is mapped in `s_drugitems` (FoxPro `updatedrugitems` check).
   */
  static async check1B004_0NAdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsAdpMappingCheck> {
    try {
      const rows = (await executor(
        `
        SELECT 
          d.icode, 
          d.name, 
          d.strength, 
          d.nhso_adp_code
        FROM s_drugitems d
        WHERE TRIM(d.nhso_adp_code) IN ('1B004_0N', '1b004_0n')
        ORDER BY d.icode ASC
        `,
        [],
        { timeoutMs: 15000 }
      )) as CcsAdpMappingItem[]

      return {
        isMapped: rows.length > 0,
        mappedCount: rows.length,
        items: rows.map((r) => ({
          icode: String(r.icode || ''),
          name: String(r.name || ''),
          strength: r.strength ? String(r.strength) : null,
          nhso_adp_code: String(r.nhso_adp_code || ''),
        })),
      }
    } catch {
      return {
        isMapped: false,
        mappedCount: 0,
        items: [],
      }
    }
  }

  /**
   * 1.5 บริการ 1B004_0N (VIA / Cervical Screening Service Report)
   * Corresponds to FoxPro `1.5.บริการ 1B004_0N` report:
   * Queries OPD visits in date range receiving prescribed ADP code 1B004_0N in `opitemrece` + `s_drugitems`,
   * reconciles with AuthenCode, diagnoses (pdx, dx0..dx5), procedures (op0..op5),
   * and reimbursement status (NHSO / Rep / NewEclaim / EClaim).
   */
  static async getService1B004_0NReport(
    params: CcsService1B004_0NParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsService1B004_0NResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const compensationFilter: CcsService1B004_0NCompensationFilter = params.compensationFilter || 'ALL'
    const searchField: CcsService1B004_0NSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CcsService1B004_0NSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ccs-p5-1b004-0n-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          RcmCervicalCancerService.check1B004_0NAdpMapping(executor),
          executor(
            `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              ptt.name AS pttypename,
              dep.department,
              spc.name AS clinic,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              dd.name AS listname,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated
            FROM ovst o
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype vt ON vt.vn = o.vn
            JOIN (
              SELECT 
                oo.vn, 
                GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate BETWEEN ? AND ?
                AND TRIM(d.nhso_adp_code) IN ('1B004_0N', '1b004_0n')
              GROUP BY oo.vn
            ) dd ON dd.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) rep ON rep.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN (
              SELECT m.opdseq AS vn,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                     SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
              FROM eclaimdb.m_registerdata m
              LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
              WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> ''
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            WHERE o.vstdate BETWEEN ? AND ?
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC
            `,
            [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
            { timeoutMs: 90000 }
          ),
        ])

        return { rawRows: rows as Record<string, unknown>[], adpMapping: mappingRes }
      },
      600
    )

    const allItems: CcsService1B004_0NItem[] = rawRows.map((r, idx) => {
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
        listname: r.listname ? String(r.listname).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: compensated > 0,
      }
    })

    const uniquePatients = new Set(allItems.map((i) => i.hn).filter(Boolean)).size
    let compensatedVisits = 0
    let uncompensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let withPdxCount = 0
    let withOpCount = 0

    for (const item of allItems) {
      if (item.compensated > 0) {
        compensatedVisits++
        totalCompensated += item.compensated
      } else {
        uncompensatedVisits++
      }

      if (item.authencode) {
        withAuthenCount++
      } else {
        withoutAuthenCount++
      }

      if (item.pdx) {
        withPdxCount++
      }

      if (item.op0 || item.op1 || item.op2 || item.op3 || item.op4 || item.op5) {
        withOpCount++
      }
    }

    const totalVisits = allItems.length
    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0

    const summary: CcsService1B004_0NSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      withPdxCount,
      withOpCount,
    }

    let filtered = allItems

    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.compensated > 0)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => i.compensated <= 0)
    } else if (compensationFilter === 'HAS_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (compensationFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') {
          return i.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          return i.cid.includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return i.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return i.vn.toLowerCase().includes(search)
        }
        if (searchField === 'DIAG') {
          return [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5]
            .filter(Boolean)
            .some((dx) => dx!.toLowerCase().includes(search))
        }
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.status && i.status.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search))
        )
      })
    }

    const sorted = [...filtered].sort((a, b) => compareService1B004NItems(a, b, sortBy, sortOrder))

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
      adpMapping,
      compensationFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
    }
  }

  /**
   * Checks whether the NHSO ADP Code '1B005' is mapped in `s_drugitems` (FoxPro `updatedrugitems` check).
   */
  static async check1B005AdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsAdpMappingCheck> {
    try {
      const rows = (await executor(
        `
        SELECT 
          d.icode, 
          d.name, 
          d.strength, 
          d.nhso_adp_code
        FROM s_drugitems d
        WHERE TRIM(d.nhso_adp_code) IN ('1B005', '1b005')
        ORDER BY d.icode ASC
        `,
        [],
        { timeoutMs: 15000 }
      )) as CcsAdpMappingItem[]

      return {
        isMapped: rows.length > 0,
        mappedCount: rows.length,
        items: rows.map((r) => ({
          icode: String(r.icode || ''),
          name: String(r.name || ''),
          strength: r.strength ? String(r.strength) : null,
          nhso_adp_code: String(r.nhso_adp_code || ''),
        })),
      }
    } catch {
      return {
        isMapped: false,
        mappedCount: 0,
        items: [],
      }
    }
  }

  /**
   * 1.10 บริการ 1B005 (Pap Smear / Cervical Cancer Screening Service Report)
   * Corresponds to FoxPro `1.10.บริการ 1B005` report:
   * Queries OPD visits in date range receiving prescribed ADP code 1B005 in `opitemrece` + `s_drugitems`,
   * reconciles with AuthenCode, diagnoses (pdx, dx0..dx5), procedures (op0..op5),
   * and reimbursement status (NHSO / Rep / NewEclaim / EClaim).
   */
  static async getService1B005Report(
    params: CcsService1B005Params = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsService1B005Result> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const compensationFilter: CcsService1B005CompensationFilter = params.compensationFilter || 'ALL'
    const searchField: CcsService1B005SearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CcsService1B005SortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ccs-p10-1b005-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          RcmCervicalCancerService.check1B005AdpMapping(executor),
          executor(
            `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              ptt.name AS pttypename,
              ptt.pttype_eclaim_id AS pttype_eclaim_id,
              dep.department,
              spc.name AS clinic,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              dd.name AS listname,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated
            FROM ovst o
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype vt ON vt.vn = o.vn
            JOIN (
              SELECT 
                oo.vn, 
                GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate BETWEEN ? AND ?
                AND TRIM(d.nhso_adp_code) IN ('1B005', '1b005')
              GROUP BY oo.vn
            ) dd ON dd.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) rep ON rep.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN (
              SELECT m.opdseq AS vn,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                     SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
              FROM eclaimdb.m_registerdata m
              LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
              WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> ''
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            WHERE o.vstdate BETWEEN ? AND ?
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC
            `,
            [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
            { timeoutMs: 90000 }
          ),
        ])

        return { rawRows: rows as Record<string, unknown>[], adpMapping: mappingRes }
      },
      600
    )

    const allMappedItems: CcsService1B005Item[] = rawRows.map((row, idx) => {
      const compVal = Number(row.compensated || 0)
      return {
        no: idx + 1,
        vn: String(row.vn || ''),
        cid: String(row.cid || ''),
        hn: String(row.hn || ''),
        ptname: String(row.ptname || ''),
        age: row.age !== null && row.age !== undefined ? Number(row.age) : null,
        nation: row.nation ? String(row.nation) : null,
        vstdate: String(row.vstdate || ''),
        vsttime: String(row.vsttime || ''),
        authencode: row.authencode ? String(row.authencode) : null,
        pttypename: row.pttypename ? String(row.pttypename) : null,
        pttype_eclaim_id: row.pttype_eclaim_id ? String(row.pttype_eclaim_id).trim() : null,
        isUc: isUcEclaimCode(row.pttype_eclaim_id ? String(row.pttype_eclaim_id) : null),
        department: row.department ? String(row.department) : null,
        clinic: row.clinic ? String(row.clinic) : null,
        pdx: row.pdx ? String(row.pdx) : null,
        dx0: row.dx0 ? String(row.dx0) : null,
        dx1: row.dx1 ? String(row.dx1) : null,
        dx2: row.dx2 ? String(row.dx2) : null,
        dx3: row.dx3 ? String(row.dx3) : null,
        dx4: row.dx4 ? String(row.dx4) : null,
        dx5: row.dx5 ? String(row.dx5) : null,
        op0: row.op0 ? String(row.op0) : null,
        op1: row.op1 ? String(row.op1) : null,
        op2: row.op2 ? String(row.op2) : null,
        op3: row.op3 ? String(row.op3) : null,
        op4: row.op4 ? String(row.op4) : null,
        op5: row.op5 ? String(row.op5) : null,
        listname: row.listname ? String(row.listname) : null,
        status: row.status ? String(row.status) : null,
        rep: row.rep ? String(row.rep) : null,
        compensated: compVal,
        isCompensated: compVal > 0,
      }
    })

    // Full Page Filter: Apply pttypes / ucOnly filter across all cohort items before summary & pagination
    const summaryCohort = allMappedItems.filter((i) => {
      if (params.pttypes !== undefined) {
        return matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      }
      if (params.ucOnly) {
        return i.isUc ?? false
      }
      return true
    })

    const totalVisits = summaryCohort.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withPdxCount = 0
    let withOpCount = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits += 1
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCount += 1
      if (item.pdx) withPdxCount += 1
      if (
        item.op0 ||
        item.op1 ||
        item.op2 ||
        item.op3 ||
        item.op4 ||
        item.op5
      ) {
        withOpCount += 1
      }
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0
    const withoutAuthenCount = totalVisits - withAuthenCount

    const summary: CcsService1B005Summary = {
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

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5]
            .filter(Boolean)
            .some((dx) => dx!.toLowerCase().includes(search))
        }
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.status && i.status.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search))
        )
      })
    }

    const sorted = [...filtered].sort((a, b) => compareService1B004NItems(a, b, sortBy, sortOrder))

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
      adpMapping,
      compensationFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
    }
  }
}

