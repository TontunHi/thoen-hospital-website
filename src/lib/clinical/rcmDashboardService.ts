import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData } from '@/lib/cache'


export type QueryExecutor = (sql: string, params?: any[], options?: any) => Promise<any[]>

// ── 0. Fiscal Date Range & Domain Types ──────────────────────

export interface FiscalDateRange {
  startDate: string
  endDate: string
  /** Backward-compatible alias for startDate */
  ds1?: string
  /** Backward-compatible alias for endDate */
  ds2?: string
}

export interface FiscalDateRangeParams {
  startDate?: string
  endDate?: string
  ds1?: string
  ds2?: string
}

/**
 * Computes active Thai Government Fiscal Year date range (Oct 1 - Sep 30).
 */
export function getDefaultFiscalYearDateRange(referenceDate: Date = new Date()): FiscalDateRange {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(referenceDate)

  let year = referenceDate.getFullYear()
  let month = referenceDate.getMonth() + 1

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10)
    if (part.type === 'month') month = parseInt(part.value, 10)
  }

  const fiscalYear = month >= 10 ? year + 1 : year
  const startDate = `${fiscalYear - 1}-10-01`
  const endDate = `${fiscalYear}-09-30`

  return {
    startDate,
    endDate,
    ds1: startDate,
    ds2: endDate,
  }
}

/**
 * Resolves fiscal date range with fallback to active fiscal year.
 */
export function resolveFiscalDateRange(params?: FiscalDateRangeParams): { startDate: string; endDate: string } {
  const defaultRange = getDefaultFiscalYearDateRange()
  const startDate = params?.startDate || params?.ds1 || defaultRange.startDate
  const endDate = params?.endDate || params?.ds2 || defaultRange.endDate
  return { startDate, endDate }
}

/**
 * Standardize sex code into UTF-8 Thai representation ('ชาย' | 'หญิง' | 'ไม่ระบุ')
 * Resilient against TIS-620 / UTF-8 encoding or collation mismatches.
 */
export function formatThaiSex(sexCode?: string | null, fallback?: string): string {
  if (sexCode === '1') return 'ชาย'
  if (sexCode === '2') return 'หญิง'
  if (fallback && fallback.trim()) {
    const f = fallback.trim()
    if (f === 'ชาย' || f === '1') return 'ชาย'
    if (f === 'หญิง' || f === '2') return 'หญิง'
  }
  return 'ไม่ระบุ'
}

// ── 0.1 Specialty Classification Domain ──────────────────────

export type ClinicalDepartmentKey =
  | 'medicine'
  | 'surgery'
  | 'obgyn'
  | 'pediatrics'
  | 'orthopedics'
  | 'ent'
  | 'eye'
  | 'dental'
  | 'psychiatry'
  | 'other'

export interface ClinicalDepartmentDefinition {
  key: ClinicalDepartmentKey
  label: string
  thaiName: string
  spcltyCodes: string[]
}

export const CLINICAL_DEPARTMENT_DEFINITIONS: ClinicalDepartmentDefinition[] = [
  { key: 'medicine', label: '01. อายุรกรรม', thaiName: 'อายุรกรรม', spcltyCodes: ['01', '21'] },
  { key: 'surgery', label: '02. ศัลยกรรม', thaiName: 'ศัลยกรรม', spcltyCodes: ['02'] },
  { key: 'obgyn', label: '03. สูตินารีเวชกรรม', thaiName: 'สูตินารีเวชกรรม', spcltyCodes: ['03', '04'] },
  { key: 'pediatrics', label: '04. กุมารเวชกรรม', thaiName: 'กุมารเวชกรรม', spcltyCodes: ['05'] },
  { key: 'orthopedics', label: '05. ออร์โธปิติกส์', thaiName: 'ออร์โธปิติกส์', spcltyCodes: ['08'] },
  { key: 'ent', label: '06. ENT', thaiName: 'ENT', spcltyCodes: ['06'] },
  { key: 'eye', label: '07. จักษุ', thaiName: 'จักษุ', spcltyCodes: ['07'] },
  { key: 'dental', label: '08. ทันตกรรม', thaiName: 'ทันตกรรม', spcltyCodes: ['11'] },
  { key: 'psychiatry', label: '09. จิตเวช', thaiName: 'จิตเวช', spcltyCodes: ['09'] },
  { key: 'other', label: '10. อื่นๆ', thaiName: 'อื่นๆ', spcltyCodes: [] },
]

/**
 * Builds the standard SQL CASE expression for classifying clinical departments.
 */
export function buildDepartmentSqlCase(
  tableAlias: string = 'i',
  spcltyTableAlias: string = 's',
  format: 'key' | 'label' = 'key'
): string {
  if (format === 'label') {
    return `CASE
      WHEN ${tableAlias}.spclty IN ('01', '21') OR ${spcltyTableAlias}.name LIKE '%อายุร%' THEN '01. อายุรกรรม'
      WHEN ${tableAlias}.spclty = '02' OR (${spcltyTableAlias}.name LIKE '%ศัลยกรรม%' AND ${spcltyTableAlias}.name NOT LIKE '%กระดูก%' AND ${spcltyTableAlias}.name NOT LIKE '%ออร์โธ%') THEN '02. ศัลยกรรม'
      WHEN ${tableAlias}.spclty IN ('03', '04') OR ${spcltyTableAlias}.name LIKE '%สูติ%' OR ${spcltyTableAlias}.name LIKE '%นรีเวช%' THEN '03. สูตินารีเวชกรรม'
      WHEN ${tableAlias}.spclty = '05' OR ${spcltyTableAlias}.name LIKE '%กุมาร%' THEN '04. กุมารเวชกรรม'
      WHEN ${tableAlias}.spclty = '08' OR ${spcltyTableAlias}.name LIKE '%กระดูก%' OR ${spcltyTableAlias}.name LIKE '%ออร์โธ%' THEN '05. ออร์โธปิติกส์'
      WHEN ${tableAlias}.spclty = '06' OR ${spcltyTableAlias}.name LIKE '%ENT%' OR ${spcltyTableAlias}.name LIKE '%โสต%' THEN '06. ENT'
      WHEN ${tableAlias}.spclty = '07' OR ${spcltyTableAlias}.name LIKE '%จักษุ%' THEN '07. จักษุ'
      WHEN ${tableAlias}.spclty = '11' OR ${spcltyTableAlias}.name LIKE '%ทันต%' THEN '08. ทันตกรรม'
      WHEN ${tableAlias}.spclty = '09' OR ${spcltyTableAlias}.name LIKE '%จิตเวช%' THEN '09. จิตเวช'
      ELSE '10. อื่นๆ'
    END`
  }

  return `CASE
    WHEN ${tableAlias}.spclty IN ('01', '21') OR ${spcltyTableAlias}.name LIKE '%อายุร%' THEN 'medicine'
    WHEN ${tableAlias}.spclty = '02' OR (${spcltyTableAlias}.name LIKE '%ศัลยกรรม%' AND ${spcltyTableAlias}.name NOT LIKE '%กระดูก%' AND ${spcltyTableAlias}.name NOT LIKE '%ออร์โธ%') THEN 'surgery'
    WHEN ${tableAlias}.spclty IN ('03', '04') OR ${spcltyTableAlias}.name LIKE '%สูติ%' OR ${spcltyTableAlias}.name LIKE '%นรีเวช%' THEN 'obgyn'
    WHEN ${tableAlias}.spclty = '05' OR ${spcltyTableAlias}.name LIKE '%กุมาร%' THEN 'pediatrics'
    WHEN ${tableAlias}.spclty = '08' OR ${spcltyTableAlias}.name LIKE '%กระดูก%' OR ${spcltyTableAlias}.name LIKE '%ออร์โธ%' THEN 'orthopedics'
    WHEN ${tableAlias}.spclty = '06' OR ${spcltyTableAlias}.name LIKE '%ENT%' OR ${spcltyTableAlias}.name LIKE '%โสต%' THEN 'ent'
    WHEN ${tableAlias}.spclty = '07' OR ${spcltyTableAlias}.name LIKE '%จักษุ%' THEN 'eye'
    WHEN ${tableAlias}.spclty = '11' OR ${spcltyTableAlias}.name LIKE '%ทันต%' THEN 'dental'
    WHEN ${tableAlias}.spclty = '09' OR ${spcltyTableAlias}.name LIKE '%จิตเวช%' THEN 'psychiatry'
    ELSE 'other'
  END`
}

/**
 * Classifies medical specialty code and name into standard department metadata in memory.
 */
export function classifySpecialty(
  spcltyCode?: string | null,
  spcltyName?: string | null
): { key: ClinicalDepartmentKey; label: string; thaiName: string } {
  const code = (spcltyCode ?? '').trim()
  const name = (spcltyName ?? '').trim()

  if (code === '01' || code === '21' || name.includes('อายุร')) {
    return { key: 'medicine', label: '01. อายุรกรรม', thaiName: 'อายุรกรรม' }
  }
  if (code === '02' || (name.includes('ศัลยกรรม') && !name.includes('กระดูก') && !name.includes('ออร์โธ'))) {
    return { key: 'surgery', label: '02. ศัลยกรรม', thaiName: 'ศัลยกรรม' }
  }
  if (code === '03' || code === '04' || name.includes('สูติ') || name.includes('นรีเวช')) {
    return { key: 'obgyn', label: '03. สูตินารีเวชกรรม', thaiName: 'สูตินารีเวชกรรม' }
  }
  if (code === '05' || name.includes('กุมาร')) {
    return { key: 'pediatrics', label: '04. กุมารเวชกรรม', thaiName: 'กุมารเวชกรรม' }
  }
  if (code === '08' || name.includes('กระดูก') || name.includes('ออร์โธ')) {
    return { key: 'orthopedics', label: '05. ออร์โธปิติกส์', thaiName: 'ออร์โธปิติกส์' }
  }
  if (code === '06' || name.includes('ENT') || name.includes('โสต')) {
    return { key: 'ent', label: '06. ENT', thaiName: 'ENT' }
  }
  if (code === '07' || name.includes('จักษุ')) {
    return { key: 'eye', label: '07. จักษุ', thaiName: 'จักษุ' }
  }
  if (code === '11' || name.includes('ทันต')) {
    return { key: 'dental', label: '08. ทันตกรรม', thaiName: 'ทันตกรรม' }
  }
  if (code === '09' || name.includes('จิตเวช')) {
    return { key: 'psychiatry', label: '09. จิตเวช', thaiName: 'จิตเวช' }
  }
  return { key: 'other', label: '10. อื่นๆ', thaiName: 'อื่นๆ' }
}

export interface IpdDepartmentAdjrwQueryRow {
  sort_order?: number
  dch_month?: string
  dept_key?: string
  patients?: number | string
  visits?: number | string
  adjrw?: number | string
  cmi?: number | string
  [key: string]: unknown
}

export interface OpdDepartmentSummaryQueryRow {
  dept_group?: string
  patients?: number | string
  visits?: number | string
  [key: string]: unknown
}

// ── 1. SSS Dental Types ─────────────────────────────────────

export interface DentalDoctorSummaryItem {
  doctor_code: string
  doctor_name: string
  total_visits: number
  total_income: number
  total_uc_money: number
  total_rcpt_money: number
  total_discount: number
  total_debit: number
  monthly_income: Record<string, number>
  monthly_visits: Record<string, number>
}

export interface DentalPatientVisitItem {
  vn: string
  hn: string
  cid: string
  ptname: string
  sex: string
  age: number
  vstdate: string
  vsttime: string
  department: string
  pdx: string
  pdxname: string
  doctor_code: string
  doctor_name: string
  income: number
  uc_money: number
  discount_money: number
  paid_money: number
  rcpt_money: number
  debit: number
  rcpno: string
}

export interface SssDentalResult {
  months: string[]
  doctors: DentalDoctorSummaryItem[]
  monthlyTotals: Record<string, { income: number; visits: number }>
  grandTotal: {
    visits: number
    income: number
    uc_money: number
    rcpt_money: number
    discount: number
    debit: number
  }
  visits?: DentalPatientVisitItem[]
}

// ── 2. OPD Doctor Types ─────────────────────────────────────

export interface DoctorSummaryItem {
  doctor_code: string
  doctor_name: string
  total_visits: number
  total_income: number
  total_uc_money: number
  total_rcpt_money: number
  total_discount: number
  total_debit: number
  monthly_income: Record<string, number>
  monthly_visits: Record<string, number>
}

export interface PttypeOption {
  code: string
  name: string
}

export interface OpdDoctorSummaryResult {
  months: string[]
  doctors: DoctorSummaryItem[]
  monthlyTotals: Record<string, { income: number; visits: number }>
  grandTotal: {
    visits: number
    income: number
    uc_money: number
    rcpt_money: number
    discount: number
    debit: number
  }
  allPttypeOptions: PttypeOption[]
}

export interface OPDRecord {
  vn: string
  hn: string
  an: string
  cid: string
  ptname: string
  sex: string
  age: number
  vstdate: string
  vsttime: string
  department: string
  clinic: string
  pdx: string
  pdxname: string
  pttype: string
  pttypename: string
  pttype_eclaim_id: string
  pttype_eclaim_name: string
  accountcode: string
  income: number
  uc_money: number
  discount_money: number
  paid_money: number
  rcpt_money: number
  rcpno: string
  debit: number
  doctorname: string
  ct: number
  cm: number
}

export interface OpdDepartmentSummaryItem {
  dept_group: string
  patients: number
  visits: number
}

// ── 3. IPD Types ────────────────────────────────────────────

export interface IPDRecord {
  an: string
  hn: string
  cid: string
  ptname: string
  sex: string
  age: number
  admdate: string
  dchdate: string
  los: number
  editdate: string | null
  summary_days: number | null
  ward: string
  ward_name: string
  bedno: string
  clinic: string
  prediag: string
  pdx: string
  pdxname: string
  sdx: string
  proc: string
  adjrw: number
  admdoctor: string
  dchdoctor: string
  authencode: string
  pttype: string
  pttypename: string
  pttype_eclaim_id: string
  accountcode: string
  hospmain: string
  hospsub: string
  dchstts: string
  dchtype: string
  status: string
  income: number
  uc_money: number
  discount_money: number
  paid_money: number
  rcpt_money: number
  rcpno: string
  debit: number
}

export interface IPDReportResult {
  count: number
  data: IPDRecord[]
}

export interface DepartmentMetricData {
  patients: number
  visits: number
  adjrw: number
  cmi: number
}

export interface IpdDepartmentAdjrwItem {
  month: string
  total_patients: number
  total_visits: number
  adjrw_sum: number
  cmi: number
  medicine: number
  surgery: number
  obgyn: number
  pediatrics: number
  orthopedics: number
  ent: number
  eye: number
  other: number
  dental: number
  psychiatry: number
  total: number
  depts: Record<string, DepartmentMetricData>
}

// ── 4. Telegram Notification Types ─────────────────────────

export interface DoctorChartSummary {
  doctor_code: string
  doctor_name: string
  total_charts: number
  completed_charts: number
  uncompleted_charts: number
}

export interface IPDChartReportData {
  fiscalYear: number
  startDate: string
  endDate: string
  reportDateStr: string
  grandTotal: {
    total_charts: number
    completed_charts: number
    uncompleted_charts: number
    completed_percentage: number
  }
  doctors: DoctorChartSummary[]
}

// ── 5. Invoice Summary & Reconciliation Types (5.2.2.1) ──────────

export interface InvoiceSummaryItem {
  code: string
  name: string
  visit: number
  receipt: number
  compensated: number
  down: number
  up: number
  debit: number
}

export interface InvoiceSummaryGrandTotal {
  visit: number
  receipt: number
  compensated: number
  down: number
  up: number
  debit: number
}

export interface InvoiceSummaryResult {
  department: 'OP' | 'IP'
  ds1: string
  ds2: string
  dateType?: 'bill_date' | 'admdate'
  items: InvoiceSummaryItem[]
  grandTotal: InvoiceSummaryGrandTotal
}

export interface InvoiceDetailItem {
  no: number
  vnOrAn: string
  cid: string
  hn: string
  ptname: string
  vstdate?: string
  vsttime?: string
  admdate?: string
  dchdate?: string
  income_hosxp: number
  rcpt_money: number
  debit_hosxp: number
  compensated: number
  fund_money: number
  hc: number
  ae: number
  inst: number
  op: number
  ip: number
  drug: number
  dmis: number
  down: number
  up: number
  rep: string
  bill: string
  billdate: string
  pttype_eclaim_id?: string
  pttype?: string
}

export interface InvoiceDetailResult {
  department: 'OP' | 'IP'
  ds1: string
  ds2: string
  dateType?: 'bill_date' | 'admdate'
  pttype?: string
  pttypeName?: string
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: InvoiceDetailItem[]
}

/**
 * Convert CE date range (YYYY-MM-DD) into array of Thai YYMM strings (e.g. ['6908', '6909'])
 * to leverage the indexed `YYMM` column on `rcmdb.repeclaim`.
 * Supports lookbackMonths to catch statements where service occurred in preceding months.
 */

// ── Palliative Care Domain Interfaces ──────────────────────

export interface PalliativeCareItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  vstdate: string
  authencode: string
  pttype: string
  inscl: string
  pttypename: string
  address: string
  tel: string
  cc: string
  room: string
  spclty: string
  diag: string
  oper: string
  z515: string // 'Y' | ''
  dx: string   // 'Y' | ''
  z718: string // 'Y' | ''
  cancer: string // 'Y' | ''
  drug: string   // 'Y' | ''
  death: string  // 'Y' | 'N'
  death_date: string | null
  ok: string     // 'Y' | ' ' (Paid)
  compensated: number
  rep_invoice: string
  eclaim_no: string
  senddate: string | null
  status_eclaim: string
  filename_send: string
  error_name: string // 'ไม่พบรหัส Z515' when z515 is empty
}

export interface PalliativeCareSummary {
  totalVisits: number
  totalPatients: number
  advanceCarePlanCount: number // Z718='Y' & Dx='Y'
  opioidCount: number          // Cancer='Y' & Drug='Y'
  hasZ515Count: number         // Z515='Y'
  missingZ515Count: number     // Z515=''
  paidCount: number            // OK='Y'
  totalCompensated: number     // sum(compensated)
  deceasedCount: number        // death='Y'
}

export const BASE_COMPENSATION_OPTIONS = [750, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000]

export interface PalliativeCareReportParams {
  startDate?: string
  endDate?: string
  ds1?: string
  ds2?: string
  ucOnly?: boolean
  hasRepInvoice?: boolean
  compensated?: number[] | string
  paidStatus?: 'ALL' | 'PAID' | 'UNPAID'
  deathStatus?: 'ALL' | 'Y' | 'N'
  z515Status?: 'ALL' | 'Y' | 'N'
  hn?: string
  filterType?: 'ALL' | 'Chronic' | 'Opioid' | 'Death'
  search?: string
}

export interface PalliativeCareResult {
  ds1: string
  ds2: string
  ucOnly: boolean
  hasRepInvoice: boolean
  compensated?: number[] | string
  paidStatus?: 'ALL' | 'PAID' | 'UNPAID'
  deathStatus?: 'ALL' | 'Y' | 'N'
  z515Status?: 'ALL' | 'Y' | 'N'
  hn?: string
  filterType: 'ALL' | 'Chronic' | 'Opioid' | 'Death'
  summary: PalliativeCareSummary
  items: PalliativeCareItem[]
  availableCompensations: number[]
}

export interface PalliativeCarePc1Item {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  age: number
  nation: string
  vstdate: string
  vsttime: string
  authencode: string
  pttypename: string
  department: string
  clinic: string
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
  listname: string
  rep: string | null
  compensated: number
  transaction_type: string | null
  invoice: string | null
  invoice_compensated: number
  resource: string | null
  subfund: string | null
  remark: string | null
  projectcode: string | null
}

export interface PalliativeCarePc1Summary {
  totalVisits: number
  totalPatients: number
  paidCount: number
  unpaidCount: number
  totalCompensated: number
  totalInvoiceCompensated: number
}

export interface PalliativeCarePc1ReportParams {
  startDate?: string
  endDate?: string
  ds1?: string
  ds2?: string
  search?: string
  paidStatus?: 'ALL' | 'PAID' | 'UNPAID' | 'INVOICE'
}

export interface PalliativeCarePc1Result {
  ds1: string
  ds2: string
  paidStatus?: 'ALL' | 'PAID' | 'UNPAID' | 'INVOICE'
  summary: PalliativeCarePc1Summary
  items: PalliativeCarePc1Item[]
}

// ── VN Clinical Details Domain Interfaces ──────────────────────

export interface VnScreenData {
  bw: number | null
  height: number | null
  bmi: number | null
  bps: number | null
  bpd: number | null
  pulse: number | null
  rr: number | null
  temperature: number | null
  spo2: number | null
  fbs: number | null
  cc: string | null
  hpi: string | null
  pmh: string | null
  pe: string | null
  screen_dep: string | null
  screen_dep_name: string | null
  symptom: string | null
}

export interface VnDiagItem {
  icd10: string
  icd_name: string
  diagtype: string
  diagtype_name: string
  doctor_name: string | null
}

export type VnOrderCategoryGroup = 'DRUG' | 'LAB' | 'XRAY' | 'PROCEDURE_SERVICE' | 'SUPPLY' | 'OTHER'

export interface VnOrderItem {
  icode: string
  item_name: string
  name?: string
  strength: string | null
  units: string | null
  qty: number
  unitprice: number
  sum_price: number
  paidst: string
  paidst_name: string
  income_code: string
  income_name: string
  category_group: VnOrderCategoryGroup
  drugusage_text: string
}

export interface VnOrderCategorySummary {
  category_group: VnOrderCategoryGroup
  title: string
  total_price: number
  item_count: number
  items: VnOrderItem[]
}

export interface VnClinicalDetailsHeader {
  vn: string
  hn: string
  cid: string
  ptname: string
  age: number
  sex: string
  vstdate: string
  vsttime: string
  pttypename: string
  department: string
  clinic: string
  isLtc?: boolean
}

export interface VnClinicalDetails {
  header: VnClinicalDetailsHeader
  screen: VnScreenData | null
  diagnoses: VnDiagItem[]
  orders: {
    items: VnOrderItem[]
    categories: VnOrderCategorySummary[]
    total_price: number
    total_items: number
    total_paid: number
    total_claim: number
  }
}

export function dateRangeToYymmList(ds1: string, ds2: string, lookbackMonths = 0): string[] {
  const d1 = new Date(ds1)
  const d2 = new Date(ds2)
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return []

  const yymmSet = new Set<string>()
  const startMonth = new Date(d1.getFullYear(), d1.getMonth() - lookbackMonths, 1)
  const endMonth = new Date(d2.getFullYear(), d2.getMonth(), 1)

  const curr = new Date(startMonth)
  while (curr <= endMonth) {
    const beYear = curr.getFullYear() + 543
    const yy = String(beYear).slice(-2)
    const mm = String(curr.getMonth() + 1).padStart(2, '0')
    yymmSet.add(`${yy}${mm}`)
    curr.setMonth(curr.getMonth() + 1)
  }

  return Array.from(yymmSet)
}

// ── RcmDashboardService Implementation ─────────────────────

export class RcmDashboardService {
  /**
   * 2.1.1.1 รายงานการให้บริการทันตกรรมสิทธิ์ประกันสังคม จำแนกตามทันตแพทย์
   */
  static async getSssDentalReport(
    params: FiscalDateRangeParams & {
      doctorFilter?: string
      fetchVisits?: boolean
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<SssDentalResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const { doctorFilter = '', fetchVisits = false } = params
    const cacheKey = `rcm-sss-dental-${ds1}-${ds2}-${doctorFilter}-${fetchVisits}`

    return getCachedData(
      cacheKey,
      async () => {
        const summaryWhere = [
          'o.vstdate BETWEEN ? AND ?',
          "IFNULL(o.an, '') = ''",
          "o.pttype = '00'", // สิทธิประกันสังคมทำฟัน
        ]
        const summaryParams: any[] = [ds1, ds2]

        if (doctorFilter) {
          summaryWhere.push('o.doctor = ?')
          summaryParams.push(doctorFilter)
        }

        const summaryQuery = `
          SELECT 
            IFNULL(o.doctor, 'UNKNOWN') AS doctor_code,
            IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')) AS doctor_name,
            DATE_FORMAT(o.vstdate, '%Y-%m') AS ym,
            COUNT(DISTINCT o.vn) AS visits,
            SUM(IFNULL(v.income, 0)) AS income,
            SUM(IFNULL(v.uc_money, 0)) AS uc_money,
            SUM(IFNULL(v.discount_money, 0)) AS discount_money,
            SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
            SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
          FROM ovst o
          INNER JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN doctor d ON d.code = o.doctor
          WHERE ${summaryWhere.join(' AND ')}
          GROUP BY IFNULL(o.doctor, 'UNKNOWN'), IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')), DATE_FORMAT(o.vstdate, '%Y-%m')
          ORDER BY doctor_name ASC, ym ASC
        `

        const summaryRows = await executor(summaryQuery, summaryParams)

        const doctorMap: Record<string, DentalDoctorSummaryItem> = {}
        const monthsSet = new Set<string>()

        summaryRows.forEach((row: any) => {
          const docCode = row.doctor_code
          const ym = row.ym
          monthsSet.add(ym)

          if (!doctorMap[docCode]) {
            doctorMap[docCode] = {
              doctor_code: docCode,
              doctor_name: row.doctor_name,
              total_visits: 0,
              total_income: 0,
              total_uc_money: 0,
              total_rcpt_money: 0,
              total_discount: 0,
              total_debit: 0,
              monthly_income: {},
              monthly_visits: {},
            }
          }

          const inc = Number(row.income) || 0
          const vis = Number(row.visits) || 0

          doctorMap[docCode].total_visits += vis
          doctorMap[docCode].total_income += inc
          doctorMap[docCode].total_uc_money += Number(row.uc_money) || 0
          doctorMap[docCode].total_rcpt_money += Number(row.rcpt_money) || 0
          doctorMap[docCode].total_discount += Number(row.discount_money) || 0
          doctorMap[docCode].total_debit += Number(row.debit) || 0

          doctorMap[docCode].monthly_income[ym] = (doctorMap[docCode].monthly_income[ym] || 0) + inc
          doctorMap[docCode].monthly_visits[ym] = (doctorMap[docCode].monthly_visits[ym] || 0) + vis
        })

        const doctors = Object.values(doctorMap).sort((a, b) => b.total_income - a.total_income)
        const months = Array.from(monthsSet).sort()

        const monthlyTotals: Record<string, { income: number; visits: number }> = {}
        months.forEach((m) => {
          monthlyTotals[m] = { income: 0, visits: 0 }
          doctors.forEach((d) => {
            monthlyTotals[m].income += d.monthly_income[m] || 0
            monthlyTotals[m].visits += d.monthly_visits[m] || 0
          })
        })

        const grandTotal = {
          visits: doctors.reduce((sum, d) => sum + d.total_visits, 0),
          income: doctors.reduce((sum, d) => sum + d.total_income, 0),
          uc_money: doctors.reduce((sum, d) => sum + d.total_uc_money, 0),
          rcpt_money: doctors.reduce((sum, d) => sum + d.total_rcpt_money, 0),
          discount: doctors.reduce((sum, d) => sum + d.total_discount, 0),
          debit: doctors.reduce((sum, d) => sum + d.total_debit, 0),
        }

        let visitsData: DentalPatientVisitItem[] | undefined
        if (fetchVisits) {
          const visitWhere = [
            'o.vstdate BETWEEN ? AND ?',
            "IFNULL(o.an, '') = ''",
            "o.pttype = '00'",
          ]
          const visitParams: any[] = [ds1, ds2]

          if (doctorFilter) {
            visitWhere.push('o.doctor = ?')
            visitParams.push(doctorFilter)
          }

          const visitQuery = `
            SELECT 
              o.vn,
              o.hn,
              IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
              IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              IFNULL(k.department, o.main_dep) AS department,
              IFNULL(v.pdx, '') AS pdx,
              IFNULL(icd.name, v.pdx) AS pdxname,
              IFNULL(o.doctor, '') AS doctor_code,
              IFNULL(d.name, o.doctor) AS doctor_name,
              IFNULL(v.income, 0) AS income,
              IFNULL(v.uc_money, 0) AS uc_money,
              IFNULL(v.discount_money, 0) AS discount_money,
              IFNULL(v.paid_money, 0) AS paid_money,
              IFNULL(v.rcpt_money, 0) AS rcpt_money,
              (IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit,
              IFNULL(v.rcpno_list, '') AS rcpno
            FROM ovst o
            INNER JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
            LEFT JOIN icd101 icd ON icd.code = v.pdx
            LEFT JOIN doctor d ON d.code = o.doctor
            WHERE ${visitWhere.join(' AND ')}
            ORDER BY o.vstdate DESC, o.vsttime DESC
            LIMIT 1000
          `
          const vRows = await executor(visitQuery, visitParams)
          visitsData = (vRows as any[]).map((r) => ({
            ...r,
            sex: formatThaiSex(r.sex_code, r.sex),
          })) as DentalPatientVisitItem[]
        }

        return {
          months,
          doctors,
          monthlyTotals,
          grandTotal,
          visits: visitsData,
        }
      },
      30000 // Cache TTL 30s
    )
  }

  /**
   * 2.1.1.2 สรุปค่าบริการผู้ป่วยนอก OPD จำแนกรายแพทย์ และตัวเลือก 37 สิทธิ e-Claim
   */
  static async getOpdDoctorSummary(
    params: FiscalDateRangeParams & {
      eclaimsParam?: string
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<OpdDoctorSummaryResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const { eclaimsParam = '' } = params
    const cacheKey = `rcm-opd-doctor-summary-${ds1}-${ds2}-${eclaimsParam}`

    return getCachedData(
      cacheKey,
      async () => {
        // ดึง 37 สิทธิมาตรฐาน e-Claim
        const allPttypeQuery = `
          SELECT 
            code, 
            name
          FROM pttype_eclaim 
          ORDER BY CAST(code AS UNSIGNED), code ASC
        `
        const allPttypeRows = (await executor(allPttypeQuery)) as PttypeOption[]

        const whereClauses: string[] = [
          'v.vstdate BETWEEN ? AND ?',
        ]
        const queryParams: any[] = [ds1, ds2]

        if (eclaimsParam && eclaimsParam.trim() !== '') {
          const list = eclaimsParam
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          if (list.length > 0) {
            whereClauses.push(
              `ptt.pttype_eclaim_id IN (${list.map(() => '?').join(',')})`
            )
            queryParams.push(...list)
          }
        }

        const query = `
          SELECT 
            IFNULL(o.doctor, 'UNKNOWN') AS doctor_code,
            IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')) AS doctor_name,
            DATE_FORMAT(v.vstdate, '%Y-%m') AS ym,
            COUNT(v.vn) AS visits,
            SUM(IFNULL(v.income, 0)) AS income,
            SUM(IFNULL(v.uc_money, 0)) AS uc_money,
            SUM(IFNULL(v.discount_money, 0)) AS discount_money,
            SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
            SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
          FROM vn_stat v
          INNER JOIN ovst o ON o.vn = v.vn AND (o.an IS NULL OR o.an = '')
          INNER JOIN pttype ptt ON ptt.pttype = v.pttype
          LEFT JOIN doctor d ON d.code = o.doctor
          WHERE ${whereClauses.join(' AND ')}
          GROUP BY IFNULL(o.doctor, 'UNKNOWN'), IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')), DATE_FORMAT(v.vstdate, '%Y-%m')
          ORDER BY doctor_name ASC, ym ASC
        `

        const rows = await executor(query, queryParams)

        const doctorMap: Record<string, DoctorSummaryItem> = {}
        const monthsSet = new Set<string>()

        rows.forEach((row: any) => {
          const docCode = row.doctor_code
          const ym = row.ym
          monthsSet.add(ym)

          if (!doctorMap[docCode]) {
            doctorMap[docCode] = {
              doctor_code: docCode,
              doctor_name: row.doctor_name,
              total_visits: 0,
              total_income: 0,
              total_uc_money: 0,
              total_rcpt_money: 0,
              total_discount: 0,
              total_debit: 0,
              monthly_income: {},
              monthly_visits: {},
            }
          }

          const inc = Number(row.income) || 0
          const vis = Number(row.visits) || 0

          doctorMap[docCode].total_visits += vis
          doctorMap[docCode].total_income += inc
          doctorMap[docCode].total_uc_money += Number(row.uc_money) || 0
          doctorMap[docCode].total_rcpt_money += Number(row.rcpt_money) || 0
          doctorMap[docCode].total_discount += Number(row.discount_money) || 0
          doctorMap[docCode].total_debit += Number(row.debit) || 0

          doctorMap[docCode].monthly_income[ym] = (doctorMap[docCode].monthly_income[ym] || 0) + inc
          doctorMap[docCode].monthly_visits[ym] = (doctorMap[docCode].monthly_visits[ym] || 0) + vis
        })

        const doctors = Object.values(doctorMap).sort((a, b) => b.total_income - a.total_income)
        const months = Array.from(monthsSet).sort()

        const monthlyTotals: Record<string, { income: number; visits: number }> = {}
        months.forEach((m) => {
          monthlyTotals[m] = { income: 0, visits: 0 }
          doctors.forEach((d) => {
            monthlyTotals[m].income += d.monthly_income[m] || 0
            monthlyTotals[m].visits += d.monthly_visits[m] || 0
          })
        })

        const grandTotal = {
          visits: doctors.reduce((sum, d) => sum + d.total_visits, 0),
          income: doctors.reduce((sum, d) => sum + d.total_income, 0),
          uc_money: doctors.reduce((sum, d) => sum + d.total_uc_money, 0),
          rcpt_money: doctors.reduce((sum, d) => sum + d.total_rcpt_money, 0),
          discount: doctors.reduce((sum, d) => sum + d.total_discount, 0),
          debit: doctors.reduce((sum, d) => sum + d.total_debit, 0),
        }

        return {
          months,
          doctors,
          monthlyTotals,
          grandTotal,
          allPttypeOptions: allPttypeRows,
        }
      },
      30000
    )
  }

  /**
   * รายงานผู้ป่วยนอก OPD รายละเอียด (กรณีต้องการดูรายคน)
   */
  static async getOpdDetailedReport(
    params: FiscalDateRangeParams & {
      pttype?: string
      isAll?: boolean
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<OPDRecord[]> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const { pttype = '', isAll = false } = params
    const cacheKey = `rcm-opd-detailed-${ds1}-${ds2}-${pttype}-${isAll}`

    return getCachedData(
      cacheKey,
      async () => {
        const query = `
          SELECT 
            o.vn,
            o.hn,
            IFNULL(o.an, '') AS an,
            IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            IFNULL(pt.sex, '') AS sex_code,
            CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
            IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            IFNULL(k.department, o.main_dep) AS department,
            IFNULL(sp.name, o.spclty) AS clinic,
            IFNULL(v.pdx, '') AS pdx,
            IFNULL(icd.name, v.pdx) AS pdxname,
            IFNULL(o.pttype, '') AS pttype,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(e.name, '') AS pttype_eclaim_name,
            IFNULL(e.ar_opd, '') AS accountcode,
            IFNULL(v.income, 0) AS income,
            IFNULL(v.uc_money, 0) AS uc_money,
            IFNULL(v.discount_money, 0) AS discount_money,
            IFNULL(v.paid_money, 0) AS paid_money,
            IFNULL(v.rcpt_money, 0) AS rcpt_money,
            IFNULL(v.rcpno_list, '') AS rcpno,
            (IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit,
            IFNULL(d.name, o.doctor) AS doctorname,
            0 AS ct,
            0 AS cm
          FROM ovst o
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
          LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
          LEFT JOIN spclty sp ON sp.spclty = o.spclty
          LEFT JOIN icd101 icd ON icd.code = v.pdx
          LEFT JOIN doctor d ON d.code = o.doctor
          WHERE o.vstdate BETWEEN ? AND ?
          ${!isAll ? "AND IFNULL(o.an, '') = ''" : ''}
          ${pttype ? 'AND o.pttype = ?' : ''}
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC
          LIMIT 1000
        `

        const queryParams = pttype ? [ds1, ds2, pttype] : [ds1, ds2]
        const rows = await executor(query, queryParams)
        return (rows as any[]).map((r) => ({
          ...r,
          sex: formatThaiSex(r.sex_code, r.sex),
        })) as OPDRecord[]
      },
      30000
    )
  }

  /**
   * 2.1.2.1 รายงานสรุปการให้บริการผู้ป่วยในโรงพยาบาลเถิน (IPD)
   */
  static async getIpdReport(
    params: FiscalDateRangeParams & {
      pttype?: string
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IPDRecord[]> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const { pttype = '' } = params
    const cacheKey = `rcm-ipd-report-${ds1}-${ds2}-${pttype}`

    return getCachedData(
      cacheKey,
      async () => {
        const query = `
          SELECT 
            i.an,
            i.hn,
            IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            IFNULL(pt.sex, '') AS sex_code,
            CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
            IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
            DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
            DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
            IFNULL(DATEDIFF(i.dchdate, i.regdate), 0) AS los,
            DATE_FORMAT(idx.modify_datetime, '%Y-%m-%d') AS editdate,
            DATEDIFF(idx.modify_datetime, i.dchdate) AS summary_days,
            IFNULL(i.ward, '') AS ward,
            IFNULL(w.name, i.ward) AS ward_name,
            '' AS bedno,
            IFNULL(sp.name, i.spclty) AS clinic,
            IFNULL(i.prediag, '') AS prediag,
            IFNULL(a.pdx, '') AS pdx,
            IFNULL(icd.name, a.pdx) AS pdxname,
            '' AS sdx,
            '' AS proc,
            IFNULL(i.adjrw, 0) AS adjrw,
            IFNULL(d1.name, i.admdoctor) AS admdoctor,
            IFNULL(d2.name, i.dch_doctor) AS dchdoctor,
            '' AS authencode,
            IFNULL(i.pttype, '') AS pttype,
            IFNULL(ptt.name, i.pttype) AS pttypename,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(e.ar_ipd, '') AS accountcode,
            '' AS hospmain,
            '' AS hospsub,
            IFNULL(ds.name, i.dchstts) AS dchstts,
            IFNULL(dt.name, i.dchtype) AS dchtype,
            IF(idx.modify_datetime IS NOT NULL, 'สรุปผลแล้ว', 'รอสรุป') AS status,
            IFNULL(a.income, 0) AS income,
            IFNULL(a.uc_money, 0) AS uc_money,
            IFNULL(a.discount_money, 0) AS discount_money,
            IFNULL(a.paid_money, 0) AS paid_money,
            IFNULL(a.rcpt_money, 0) AS rcpt_money,
            IFNULL(a.rcpno_list, '') AS rcpno,
            (IFNULL(a.income, 0) - IFNULL(a.discount_money, 0) - IFNULL(a.rcpt_money, 0)) AS debit
          FROM ipt i
          LEFT JOIN an_stat a ON a.an = i.an
          LEFT JOIN patient pt ON i.hn = pt.hn
          LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
          LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
          LEFT JOIN ward w ON w.ward = i.ward
          LEFT JOIN spclty sp ON sp.spclty = i.spclty
          LEFT JOIN icd101 icd ON icd.code = a.pdx
          LEFT JOIN doctor d1 ON d1.code = i.admdoctor
          LEFT JOIN doctor d2 ON d2.code = i.dch_doctor
          LEFT JOIN dchstts ds ON ds.dchstts = i.dchstts
          LEFT JOIN dchtype dt ON dt.dchtype = i.dchtype
          LEFT JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
          WHERE i.dchdate BETWEEN ? AND ?
          ${pttype ? 'AND i.pttype = ?' : ''}
          GROUP BY i.an
          ORDER BY i.dchdate DESC, i.an DESC
        `

        const queryParams = pttype ? [ds1, ds2, pttype] : [ds1, ds2]
        const rows = await executor(query, queryParams)
        return (rows as any[]).map((r) => ({
          ...r,
          sex: formatThaiSex(r.sex_code, r.sex),
        })) as IPDRecord[]
      },
      30000
    )
  }

  /**
   * 2.1.2.2 จำนวน SumAdjRW แยกรายแผนก IPD
   */
  static async getIpdDepartmentAdjrw(
    params: FiscalDateRangeParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IpdDepartmentAdjrwItem[]> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cacheKey = `rcm-ipd-dept-adjrw-v2-${ds1}-${ds2}`

    const DEPT_KEYS = [
      'medicine',
      'surgery',
      'obgyn',
      'pediatrics',
      'orthopedics',
      'ent',
      'eye',
      'other',
      'dental',
      'psychiatry',
    ] as const

    const createDefaultDepts = (): Record<string, DepartmentMetricData> => ({
      medicine: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      surgery: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      obgyn: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      pediatrics: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      orthopedics: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      ent: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      eye: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      other: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      dental: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      psychiatry: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
    })

    return getCachedData(
      cacheKey,
      async () => {
        const ipdDeptCase = buildDepartmentSqlCase('i', 's', 'key')
        const query = `
          SELECT 
            CASE WHEN MONTH(i.dchdate) >= 10 THEN MONTH(i.dchdate) - 9 ELSE MONTH(i.dchdate) + 3 END AS sort_order,
            CONCAT(
              ELT(MONTH(i.dchdate), 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'),
              '-',
              RIGHT(YEAR(i.dchdate) + 543, 2)
            ) AS dch_month,
            ${ipdDeptCase} AS dept_key,
            COUNT(DISTINCT i.hn) AS patients,
            COUNT(DISTINCT i.an) AS visits,
            ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
            ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
          FROM ipt i
          LEFT JOIN spclty s ON s.spclty = i.spclty
          WHERE i.dchdate BETWEEN ? AND ?
          GROUP BY YEAR(i.dchdate), MONTH(i.dchdate), dept_key

          UNION ALL

          -- สรุปภาพรวมรายเดือน (total per month)
          SELECT 
            CASE WHEN MONTH(i.dchdate) >= 10 THEN MONTH(i.dchdate) - 9 ELSE MONTH(i.dchdate) + 3 END AS sort_order,
            CONCAT(
              ELT(MONTH(i.dchdate), 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'),
              '-',
              RIGHT(YEAR(i.dchdate) + 543, 2)
            ) AS dch_month,
            'total' AS dept_key,
            COUNT(DISTINCT i.hn) AS patients,
            COUNT(DISTINCT i.an) AS visits,
            ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
            ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
          FROM ipt i
          LEFT JOIN spclty s ON s.spclty = i.spclty
          WHERE i.dchdate BETWEEN ? AND ?
          GROUP BY YEAR(i.dchdate), MONTH(i.dchdate)

          UNION ALL

          -- สรุปภาพรวมทั้งปี แยกรายแผนก (total per department for full period)
          SELECT 
            99 AS sort_order,
            'รวม' AS dch_month,
            ${ipdDeptCase} AS dept_key,
            COUNT(DISTINCT i.hn) AS patients,
            COUNT(DISTINCT i.an) AS visits,
            ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
            ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
          FROM ipt i
          LEFT JOIN spclty s ON s.spclty = i.spclty
          WHERE i.dchdate BETWEEN ? AND ?
          GROUP BY dept_key

          UNION ALL

          -- แถวสรุปรวมทั้งหมดของ รพ. ตลอดช่วงเวลา (grand total)
          SELECT 
            99 AS sort_order,
            'รวม' AS dch_month,
            'total' AS dept_key,
            COUNT(DISTINCT i.hn) AS patients,
            COUNT(DISTINCT i.an) AS visits,
            ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
            ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
          FROM ipt i
          LEFT JOIN spclty s ON s.spclty = i.spclty
          WHERE i.dchdate BETWEEN ? AND ?

          ORDER BY sort_order, dept_key
        `

        const rows = (await executor(query, [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2])) as IpdDepartmentAdjrwQueryRow[]

        // Handle legacy flat format if returned (for mock tests)
        if (
          rows.length > 0 &&
          ('อายุรกรรม' in rows[0] || 'medicine' in rows[0]) &&
          !('dept_key' in rows[0])
        ) {
          return rows.map((r: IpdDepartmentAdjrwQueryRow) => {
            const total_patients = Number(r['คนรวม'] ?? r.total_patients ?? 0)
            const total_visits = Number(r['ครั้งรวม'] ?? r.total_visits ?? 0)
            const adjrw_sum = Number(r['AdjRW รวม'] ?? r.adjrw_sum ?? 0)
            const cmi = Number(r['CMI รวม'] ?? r.cmi ?? 0)

            const depts = createDefaultDepts()
            const deptMapping: [keyof typeof depts, string][] = [
              ['medicine', 'อายุรกรรม'],
              ['surgery', 'ศัลยกรรม'],
              ['obgyn', 'สูตินารีเวชกรรม'],
              ['pediatrics', 'กุมารเวชกรรม'],
              ['orthopedics', 'ออร์โธปิติกส์'],
              ['ent', 'ENT'],
              ['eye', 'จักษุ'],
              ['other', 'อื่นๆ'],
              ['dental', 'ทันตกรรม'],
              ['psychiatry', 'จิตเวช'],
            ]

            for (const [k, name] of deptMapping) {
              const val = Number(r[name] ?? r[k] ?? 0)
              const p = Number(r[`${name}_คน`] ?? r[`${k}_patients`] ?? 0)
              const v = Number(r[`${name}_ครั้ง`] ?? r[`${k}_visits`] ?? 0)
              const c = Number(r[`${name}_cmi`] ?? r[`${k}_cmi`] ?? (v > 0 ? val / v : 0))
              depts[k] = {
                patients: p,
                visits: v,
                adjrw: val,
                cmi: Number(c.toFixed(4)),
              }
            }

            const medicine = depts.medicine.adjrw
            const surgery = depts.surgery.adjrw
            const obgyn = depts.obgyn.adjrw
            const pediatrics = depts.pediatrics.adjrw
            const orthopedics = depts.orthopedics.adjrw
            const ent = depts.ent.adjrw
            const eye = depts.eye.adjrw
            const other = depts.other.adjrw
            const dental = depts.dental.adjrw
            const psychiatry = depts.psychiatry.adjrw

            const sumOfDepts = Number(
              (
                medicine +
                surgery +
                obgyn +
                pediatrics +
                orthopedics +
                ent +
                eye +
                other +
                dental +
                psychiatry
              ).toFixed(4)
            )
            const total = adjrw_sum > 0 ? adjrw_sum : sumOfDepts

            return {
              month: String(r['เดือน'] ?? r.dch_month ?? r.month ?? ''),
              total_patients,
              total_visits,
              adjrw_sum: total,
              cmi: cmi > 0 ? cmi : total_visits > 0 ? Number((total / total_visits).toFixed(4)) : 0,
              medicine,
              surgery,
              obgyn,
              pediatrics,
              orthopedics,
              ent,
              eye,
              other,
              dental,
              psychiatry,
              total,
              depts,
            }
          })
        }

        // New grouped query format
        const monthsMap = new Map<string, IpdDepartmentAdjrwItem>()
        const monthOrder: string[] = []

        for (const r of rows) {
          const monthName = String(r.dch_month ?? r['เดือน'] ?? '')
          if (!monthName) continue

          if (!monthsMap.has(monthName)) {
            monthOrder.push(monthName)
            monthsMap.set(monthName, {
              month: monthName,
              total_patients: 0,
              total_visits: 0,
              adjrw_sum: 0,
              cmi: 0,
              medicine: 0,
              surgery: 0,
              obgyn: 0,
              pediatrics: 0,
              orthopedics: 0,
              ent: 0,
              eye: 0,
              other: 0,
              dental: 0,
              psychiatry: 0,
              total: 0,
              depts: createDefaultDepts(),
            })
          }

          const item = monthsMap.get(monthName)!
          const key = String(r.dept_key ?? '')
          const patients = Number(r.patients ?? r['คน'] ?? 0)
          const visits = Number(r.visits ?? r['ครั้ง'] ?? 0)
          const adjrw = Number(r.adjrw ?? r['adjrw'] ?? 0)
          const cmi = Number(r.cmi ?? r['cmi'] ?? 0)

          if (key === 'total') {
            item.total_patients = patients
            item.total_visits = visits
            item.adjrw_sum = adjrw
            item.cmi = cmi
            item.total = adjrw
          } else if (key in item.depts) {
            item.depts[key] = { patients, visits, adjrw, cmi }
            if (key in item) {
              ;(item as any)[key] = adjrw
            }
          }
        }

        // Finalize any missing totals
        for (const item of monthsMap.values()) {
          if (item.adjrw_sum === 0) {
            let sumAdj = 0
            for (const k of DEPT_KEYS) {
              sumAdj += item.depts[k].adjrw
            }
            item.adjrw_sum = Number(sumAdj.toFixed(4))
            item.total = item.adjrw_sum
          }
          if (item.cmi === 0 && item.total_visits > 0) {
            item.cmi = Number((item.adjrw_sum / item.total_visits).toFixed(4))
          }
        }

        return monthOrder.map((m) => monthsMap.get(m)!)
      },
      30000
    )
  }

  /**
   * ดึงข้อมูลสรุปชาร์ตค้าง IPD แยกตามแพทย์ D/C สำหรับส่ง Telegram
   */
  static async getIpdDoctorChartSummary(
    targetDate: Date = new Date(),
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IPDChartReportData> {
    const calYear = targetDate.getFullYear()
    const month = targetDate.getMonth() + 1
    const fiscalYear = month >= 10 ? calYear + 1 : calYear
    const startDate = `${fiscalYear - 1}-10-01`
    const endDate = `${fiscalYear}-09-30`

    const docQuery = `
      SELECT 
        IFNULL(i.dch_doctor, 'UNKNOWN') AS doctor_code,
        IFNULL(d2.name, IFNULL(i.dch_doctor, 'ไม่ระบุแพทย์')) AS doctor_name,
        COUNT(DISTINCT i.an) AS total_charts,
        COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NOT NULL THEN i.an END) AS completed_charts,
        COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NULL THEN i.an END) AS uncompleted_charts
      FROM ipt i
      LEFT JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
      LEFT JOIN doctor d2 ON d2.code = i.dch_doctor
      WHERE i.dchdate BETWEEN ? AND ?
      GROUP BY IFNULL(i.dch_doctor, 'UNKNOWN'), IFNULL(d2.name, IFNULL(i.dch_doctor, 'ไม่ระบุแพทย์'))
      HAVING uncompleted_charts > 0
      ORDER BY uncompleted_charts DESC, total_charts DESC
    `
    const docRows = await executor(docQuery, [startDate, endDate])

    const grandQuery = `
      SELECT 
        COUNT(DISTINCT i.an) AS total_charts,
        COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NOT NULL THEN i.an END) AS completed_charts,
        COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NULL THEN i.an END) AS uncompleted_charts
      FROM ipt i
      LEFT JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
      WHERE i.dchdate BETWEEN ? AND ?
    `
    const grandRows = await executor(grandQuery, [startDate, endDate])
    const grand = grandRows[0] || { total_charts: 0, completed_charts: 0, uncompleted_charts: 0 }

    const totalCharts = Number(grand.total_charts) || 0
    const completedCharts = Number(grand.completed_charts) || 0
    const uncompletedCharts = Number(grand.uncompleted_charts) || 0
    const completedPercentage = totalCharts > 0 ? (completedCharts / totalCharts) * 100 : 0

    const doctors: DoctorChartSummary[] = docRows.map((r: any) => ({
      doctor_code: r.doctor_code,
      doctor_name: r.doctor_name,
      total_charts: Number(r.total_charts) || 0,
      completed_charts: Number(r.completed_charts) || 0,
      uncompleted_charts: Number(r.uncompleted_charts) || 0,
    }))

    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ]
    const reportDateStr = `${targetDate.getDate()} ${thaiMonths[targetDate.getMonth()]} ${targetDate.getFullYear() + 543}`

    return {
      fiscalYear: fiscalYear + 543,
      startDate,
      endDate,
      reportDateStr,
      grandTotal: {
        total_charts: totalCharts,
        completed_charts: completedCharts,
        uncompleted_charts: uncompletedCharts,
        completed_percentage: completedPercentage,
      },
      doctors,
    }
  }

  /**
   * แปลงข้อมูลชาร์ตค้างเป็นข้อความ HTML สำหรับส่ง Telegram
   */
  static formatTelegramChartSummary(data: IPDChartReportData, portalUrl = ''): string {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`
    const thaiMonthsShort = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ]
    const shortDateStr = `${now.getDate()} ${thaiMonthsShort[now.getMonth()]} ${String(now.getFullYear() + 543).slice(-2)}`
    const shortFyStr = `ปีงบ ${String(data.fiscalYear).slice(-2)}`

    let msg = `🏥 <b>สรุปชาร์ต IPD ค้างสรุป</b>\n`
    msg += `📅 ${shortDateStr} | ${timeStr} | ${shortFyStr}\n`
    msg += `━━━━━━━━━━━━━━━\n`
    msg += `📊 รวม <b>${data.grandTotal.total_charts.toLocaleString()}</b> ชาร์ต | สรุปแล้ว <b>${data.grandTotal.completed_charts.toLocaleString()}</b> (${data.grandTotal.completed_percentage.toFixed(1)}%)\n`
    msg += `⏳ ค้าง <b>${data.grandTotal.uncompleted_charts.toLocaleString()}</b> ชาร์ต จาก <b>${data.doctors.length}</b> ท่าน\n`
    msg += `━━━━━━━━━━━━━━━\n\n`

    if (data.doctors.length === 0) {
      msg += `✅ <i>ไม่มีแพทย์ที่มีชาร์ตค้างสรุปในขณะนี้</i>\n`
      msg += `━━━━━━━━━━━━━━━`
      return msg
    }

    data.doctors.forEach((doc, idx) => {
      msg += `${idx + 1}. ${doc.doctor_name}\n`
      msg += `   ✅ ลง ${doc.completed_charts.toLocaleString()}/${doc.total_charts.toLocaleString()} ชาร์ต • ⏳ ยังไม่ได้สรุป <b>${doc.uncompleted_charts.toLocaleString()}</b> ชาร์ต\n\n`
    })

    msg += `━━━━━━━━━━━━━━━\n`
    if (portalUrl) {
      msg += `🌐 สามารถกดดู Dashboard : \n${portalUrl}`
    } else {
      msg += `🌐 ตรวจสอบสถานะได้ที่ระบบ Dashboard-RCM โรงพยาบาลเถิน`
    }
    return msg
  }

  /**
   * สรุปจำนวนผู้รับบริการผู้ป่วยนอก (OPD) แยกรายแผนก และแถวสรุปรวมทั้งโรงพยาบาล
   */
  static async getOpdDepartmentSummary(
    params: FiscalDateRangeParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<OpdDepartmentSummaryItem[]> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cacheKey = `rcm-opd-dept-summary-v2-${ds1}-${ds2}`

    return getCachedData(
      cacheKey,
      async () => {
        const opdDeptCase = buildDepartmentSqlCase('o', 's', 'label')
        const query = `
          SELECT 
            dept_group,
            COUNT(DISTINCT t.hn) AS patients,
            COUNT(DISTINCT t.vn) AS visits
          FROM (
            SELECT 
              o.hn,
              o.vn,
              ${opdDeptCase} AS dept_group
            FROM ovst o
            LEFT JOIN spclty s ON s.spclty = o.spclty
            WHERE o.vstdate BETWEEN ? AND ?
          ) t
          GROUP BY dept_group

          UNION ALL

          -- แถวสรุปรวมทั้งโรงพยาบาล
          SELECT 
            'รวมทั้งหมด' AS dept_group,
            COUNT(DISTINCT o.hn) AS patients,
            COUNT(DISTINCT o.vn) AS visits
          FROM ovst o
          WHERE o.vstdate BETWEEN ? AND ?
          ORDER BY dept_group;
        `

        const rows = (await executor(query, [ds1, ds2, ds1, ds2])) as OpdDepartmentSummaryQueryRow[]

        return rows.map((r: OpdDepartmentSummaryQueryRow) => ({
          dept_group: String(r.dept_group || r['แผนก'] || ''),
          patients: Number(r.patients ?? r['จำนวนคน'] ?? 0),
          visits: Number(r.visits ?? r['จำนวนครั้ง'] ?? 0),
        }))
      },
      60 * 5 // 5 minutes TTL
    )
  }

  /**
   * 5.2.2.1 รายงานสรุปรายรับจาก Invoice (e-Claim Reconciliation Summary)
   */
  static async getInvoiceSummary(
    params: {
      department?: 'OP' | 'IP'
      ds1?: string
      ds2?: string
      dateType?: 'bill_date' | 'admdate'
    } = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<InvoiceSummaryResult> {
    const department = params.department === 'IP' ? 'IP' : 'OP'
    const dateType = params.dateType === 'admdate' ? 'admdate' : 'bill_date'
    const dateCol = dateType === 'admdate' ? 'admdate' : 'bill_date'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const filterStart = dateType === 'admdate' ? `${ds1} 00:00:00` : ds1
    const filterEnd = dateType === 'admdate' ? `${ds2} 23:59:59` : ds2
    const cacheKey = `rcm-invoice-summary-${department}-${dateType}-${ds1}-${ds2}`

    return getCachedData(
      cacheKey,
      async () => {
        // In production with default queryClinicalDb executor, use dedicated Gateway endpoint
        if (executor === queryClinicalDb) {
          try {
            const gwRes = await apiGateway.clinical.getRcmInvoiceSummary({
              department,
              startDate: ds1,
              endDate: ds2,
              dateType,
            })
            if (gwRes && gwRes.items) {
              return {
                department,
                ds1,
                ds2,
                dateType,
                items: gwRes.items.filter((r) => Number(r.visit || 0) > 0),
                grandTotal: gwRes.grandTotal,
              }
            }
          } catch {
            // Fall back to parameterized query via executor if dedicated endpoint is pending reload
          }
        }

        const queryParams: any[] = [filterStart, filterEnd]
        let query = ''

        if (department === 'OP') {
          query = `
            SELECT 
              COALESCE(t.pttype_eclaim_id, 'UNKNOWN') as code,
              COALESCE(a.name, 'ไม่ระบุกลุ่มสิทธิ e-Claim') as name,
              t.visit,
              t.receipt,
              t.compensated,
              t.down,
              t.up,
              t.debit
            FROM (
              SELECT 
                ptt.pttype_eclaim_id,
                COUNT(t.vn) as visit,
                ROUND(SUM(t.receipt), 2) as receipt,
                ROUND(SUM(t.compensated), 2) as compensated,
                ROUND(SUM(t.down), 2) as down,
                ROUND(SUM(t.up), 2) as up,
                ROUND(SUM(t.debit), 2) as debit
              FROM (
                SELECT 
                  t.vn,
                  o.pttype,
                  SUM(t.compensated) as compensated,
                  SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)) as receipt,
                  v.income - v.rcpt_money as debit,
                  CASE 
                    WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                    WHEN SUM(t.compensated) - (v.income - v.rcpt_money) > 0 THEN SUM(t.compensated) - (v.income - v.rcpt_money)
                    ELSE 0 
                  END as down,
                  CASE
                    WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                    WHEN SUM(t.compensated) - (v.income - v.rcpt_money) < 0 THEN SUM(t.compensated) - (v.income - v.rcpt_money)
                    ELSE 0 
                  END as up
                FROM rcmdb.repeclaim t
                LEFT JOIN hos.ovst o ON o.vn = t.vn
                LEFT JOIN hos.vn_stat v ON v.vn = o.vn
                WHERE t.department = 'OP'
                  AND t.${dateCol} BETWEEN ? AND ?
                GROUP BY t.vn, o.pttype, v.income, v.rcpt_money
              ) t
              LEFT JOIN hos.pttype ptt ON ptt.pttype = t.pttype
              GROUP BY ptt.pttype_eclaim_id
            ) t
            LEFT JOIN hos.pttype_eclaim a ON a.code = t.pttype_eclaim_id
            WHERE t.visit > 0
            ORDER BY t.visit DESC, code ASC;
          `
        } else {
          query = `
            SELECT 
              COALESCE(t.pttype_eclaim_id, 'UNKNOWN') as code,
              COALESCE(a.name, 'ไม่ระบุกลุ่มสิทธิ e-Claim') as name,
              t.visit,
              t.receipt,
              t.compensated,
              t.down,
              t.up,
              t.debit
            FROM (
              SELECT 
                ptt.pttype_eclaim_id,
                COUNT(t.an) as visit,
                ROUND(SUM(t.receipt), 2) as receipt,
                ROUND(SUM(t.compensated), 2) as compensated,
                ROUND(SUM(t.down), 2) as down,
                ROUND(SUM(t.up), 2) as up,
                ROUND(SUM(t.debit), 2) as debit
              FROM (
                SELECT 
                  t.an,
                  i.pttype,
                  SUM(t.compensated) as compensated,
                  SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)) as receipt,
                  a.income - a.rcpt_money as debit,
                  CASE 
                    WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                    WHEN SUM(t.compensated) - (a.income - a.rcpt_money) > 0 THEN SUM(t.compensated) - (a.income - a.rcpt_money)
                    ELSE 0 
                  END as down,
                  CASE
                    WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                    WHEN SUM(t.compensated) - (a.income - a.rcpt_money) < 0 THEN SUM(t.compensated) - (a.income - a.rcpt_money)
                    ELSE 0 
                  END as up
                FROM rcmdb.repeclaim t
                LEFT JOIN hos.ipt i ON i.an = t.an
                LEFT JOIN hos.an_stat a ON a.an = i.an
                WHERE t.department = 'IP'
                  AND t.${dateCol} BETWEEN ? AND ?
                GROUP BY t.an, i.pttype, a.income, a.rcpt_money
              ) t
              LEFT JOIN hos.pttype ptt ON ptt.pttype = t.pttype
              GROUP BY ptt.pttype_eclaim_id
            ) t
            LEFT JOIN hos.pttype_eclaim a ON a.code = t.pttype_eclaim_id
            WHERE t.visit > 0
            ORDER BY t.visit DESC, code ASC;
          `
        }

        const rows = (await executor(query, queryParams)) as any[]

        let grandVisit = 0
        let grandReceipt = 0
        let grandCompensated = 0
        let grandDown = 0
        let grandUp = 0
        let grandDebit = 0

        const items: InvoiceSummaryItem[] = rows
          .filter((r) => Number(r.visit || 0) > 0)
          .map((r) => {
            const visit = Number(r.visit || 0)
            const receipt = Number(r.receipt || 0)
            const compensated = Number(r.compensated || 0)
            const down = Number(r.down || 0)
            const up = Number(r.up || 0)
            const debit = Number(r.debit || 0)

            grandVisit += visit
            grandReceipt += receipt
            grandCompensated += compensated
            grandDown += down
            grandUp += up
            grandDebit += debit

            return {
              code: String(r.code || ''),
              name: String(r.name || ''),
              visit,
              receipt: Math.round(receipt * 100) / 100,
              compensated: Math.round(compensated * 100) / 100,
              down: Math.round(down * 100) / 100,
              up: Math.round(up * 100) / 100,
              debit: Math.round(debit * 100) / 100,
            }
          })

        return {
          department,
          ds1,
          ds2,
          items,
          grandTotal: {
            visit: grandVisit,
            receipt: Math.round(grandReceipt * 100) / 100,
            compensated: Math.round(grandCompensated * 100) / 100,
            down: Math.round(grandDown * 100) / 100,
            up: Math.round(grandUp * 100) / 100,
            debit: Math.round(grandDebit * 100) / 100,
          },
        }
      },
      60 * 3 // 3 minutes TTL
    )
  }

  /**
   * 5.2.2.1 รายชื่อผู้ป่วยและรายละเอียดการชดเชย Invoice (Drill-down Patient List)
   */
  static async getInvoiceDetails(
    params: {
      department?: 'OP' | 'IP'
      ds1?: string
      ds2?: string
      pttype?: string
      search?: string
      page?: number
      pageSize?: number
      exportAll?: boolean
      dateType?: 'bill_date' | 'admdate'
    } = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<InvoiceDetailResult> {
    const department = params.department === 'IP' ? 'IP' : 'OP'
    const dateType = params.dateType === 'admdate' ? 'admdate' : 'bill_date'
    const dateCol = dateType === 'admdate' ? 'admdate' : 'bill_date'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const filterStart = dateType === 'admdate' ? `${ds1} 00:00:00` : ds1
    const filterEnd = dateType === 'admdate' ? `${ds2} 23:59:59` : ds2
    const pttype = (params.pttype || '').trim()
    const search = (params.search || '').trim()
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = params.exportAll ? 10000 : Math.max(1, Math.min(200, Number(params.pageSize || 50)))
    const offset = (page - 1) * pageSize

    // In production with default queryClinicalDb executor, use dedicated Gateway endpoint
    if (executor === queryClinicalDb) {
      try {
        const gwRes = await apiGateway.clinical.getRcmInvoiceDetails({
          department,
          startDate: ds1,
          endDate: ds2,
          pttype: pttype || undefined,
          search: search || undefined,
          page,
          pageSize,
          exportAll: params.exportAll,
          dateType,
        })
        if (gwRes && Array.isArray(gwRes.items)) {
          return {
            department,
            ds1,
            ds2,
            dateType,
            items: gwRes.items as InvoiceDetailItem[],
            totalCount: Number(gwRes.totalCount || 0),
            totalPages: Number(gwRes.totalPages || 1),
            page: Number(gwRes.page || page),
            pageSize: Number(gwRes.pageSize || pageSize),
          }
        }

      } catch {
        // Fall back to parameterized query via executor if dedicated endpoint is pending reload
      }
    }

    const pttypeClause = pttype ? 'AND ptt.pttype_eclaim_id = ?' : ''
    let searchClause = ''
    const searchParams: any[] = []

    if (search) {
      searchClause = `AND (
        t.hn LIKE ? OR 
        ${department === 'OP' ? 't.vn' : 't.an'} LIKE ? OR 
        t.ptname LIKE ? OR 
        t.pid LIKE ? OR 
        t.rep LIKE ? OR 
        t.bill LIKE ?
      )`
      const s = `%${search}%`
      searchParams.push(s, s, s, s, s, s)
    }

    // 1. Count query
    let countSql = ''
    const countParams: any[] = [filterStart, filterEnd]
    if (pttype) countParams.push(pttype)
    if (search) countParams.push(...searchParams)

    if (department === 'OP') {
      countSql = `
        SELECT STRAIGHT_JOIN COUNT(DISTINCT t.vn) as total
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ovst o ON o.vn = t.vn
        LEFT JOIN hos.pttype ptt ON ptt.pttype = o.pttype
        WHERE t.department = 'OP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause};
      `
    } else {
      countSql = `
        SELECT STRAIGHT_JOIN COUNT(DISTINCT t.an) as total
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ipt i ON i.an = t.an
        LEFT JOIN hos.pttype ptt ON ptt.pttype = i.pttype
        WHERE t.department = 'IP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause};
      `
    }

    const countRes = (await executor(countSql, countParams)) as any[]
    const totalCount = Number(countRes?.[0]?.total || 0)
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    // 2. Fetch data query
    let dataSql = ''
    const dataParams: any[] = [filterStart, filterEnd]
    if (pttype) dataParams.push(pttype)
    if (search) dataParams.push(...searchParams)
    dataParams.push(pageSize, offset)

    if (department === 'OP') {
      dataSql = `
        SELECT STRAIGHT_JOIN 
          t.vn as vnOrAn,
          t.pid as cid,
          t.hn,
          t.ptname,
          DATE_FORMAT(t.admdate, '%Y-%m-%d') as vstdate,
          DATE_FORMAT(t.admdate, '%T') as vsttime,
          ROUND(SUM(t.compensated), 2) as compensated,
          ROUND(SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)), 2) as fund_money,
          ROUND(v.income, 2) as income_hosxp,
          ROUND(v.rcpt_money, 2) as rcpt_money,
          ROUND(v.income - v.rcpt_money, 2) as debit_hosxp,
          ROUND(SUM(t.hc), 2) as hc,
          ROUND(SUM(t.ae), 2) as ae,
          ROUND(SUM(t.inst), 2) as inst,
          ROUND(SUM(t.op), 2) as op,
          ROUND(SUM(t.ip), 2) as ip,
          ROUND(SUM(t.drug), 2) as drug,
          ROUND(SUM(t.dmis), 2) as dmis,
          CASE 
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (v.income - v.rcpt_money) > 0 THEN ROUND(SUM(t.compensated) - (v.income - v.rcpt_money), 2)
            ELSE 0 
          END as down,
          CASE
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (v.income - v.rcpt_money) < 0 THEN ROUND(SUM(t.compensated) - (v.income - v.rcpt_money), 2)
            ELSE 0 
          END as up,
          GROUP_CONCAT(DISTINCT t.rep ORDER BY t.rep) as rep,
          GROUP_CONCAT(DISTINCT t.bill ORDER BY t.rep) as bill,
          GROUP_CONCAT(DISTINCT DATE_FORMAT(t.bill_date, '%Y-%m-%d') ORDER BY t.rep) as billdate,
          ptt.pttype_eclaim_id,
          o.pttype
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ovst o ON o.vn = t.vn
        LEFT JOIN hos.vn_stat v ON v.vn = o.vn
        LEFT JOIN hos.pttype ptt ON ptt.pttype = o.pttype
        WHERE t.department = 'OP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause}
        GROUP BY t.vn, t.pid, t.hn, t.ptname, t.admdate, v.income, v.rcpt_money, ptt.pttype_eclaim_id, o.pttype
        ORDER BY t.admdate DESC, t.vn DESC
        LIMIT ? OFFSET ?;
      `
    } else {
      dataSql = `
        SELECT STRAIGHT_JOIN 
          t.an as vnOrAn,
          t.pid as cid,
          t.hn,
          t.ptname,
          DATE_FORMAT(t.admdate, '%Y-%m-%d') as admdate,
          DATE_FORMAT(t.dchdate, '%Y-%m-%d') as dchdate,
          ROUND(SUM(t.compensated), 2) as compensated,
          ROUND(SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)), 2) as fund_money,
          ROUND(a.income, 2) as income_hosxp,
          ROUND(a.rcpt_money, 2) as rcpt_money,
          ROUND(a.income - a.rcpt_money, 2) as debit_hosxp,
          ROUND(SUM(t.hc), 2) as hc,
          ROUND(SUM(t.ae), 2) as ae,
          ROUND(SUM(t.inst), 2) as inst,
          ROUND(SUM(t.op), 2) as op,
          ROUND(SUM(t.ip), 2) as ip,
          ROUND(SUM(t.drug), 2) as drug,
          ROUND(SUM(t.dmis), 2) as dmis,
          CASE 
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (a.income - a.rcpt_money) > 0 THEN ROUND(SUM(t.compensated) - (a.income - a.rcpt_money), 2)
            ELSE 0 
          END as down,
          CASE
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (a.income - a.rcpt_money) < 0 THEN ROUND(SUM(t.compensated) - (a.income - a.rcpt_money), 2)
            ELSE 0 
          END as up,
          GROUP_CONCAT(DISTINCT t.rep ORDER BY t.rep) as rep,
          GROUP_CONCAT(DISTINCT t.bill ORDER BY t.rep) as bill,
          GROUP_CONCAT(DISTINCT DATE_FORMAT(t.bill_date, '%Y-%m-%d') ORDER BY t.rep) as billdate,
          ptt.pttype_eclaim_id,
          i.pttype
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ipt i ON i.an = t.an
        LEFT JOIN hos.an_stat a ON a.an = i.an
        LEFT JOIN hos.pttype ptt ON ptt.pttype = i.pttype
        WHERE t.department = 'IP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause}
        GROUP BY t.an, t.pid, t.hn, t.ptname, t.admdate, t.dchdate, a.income, a.rcpt_money, ptt.pttype_eclaim_id, i.pttype
        ORDER BY t.admdate DESC, t.an DESC
        LIMIT ? OFFSET ?;
      `
    }

    const rows = (await executor(dataSql, dataParams)) as any[]

    const items: InvoiceDetailItem[] = rows.map((r, idx) => ({
      no: offset + idx + 1,
      vnOrAn: String(r.vnOrAn || ''),
      cid: String(r.cid || ''),
      hn: String(r.hn || ''),
      ptname: String(r.ptname || ''),
      vstdate: r.vstdate ? String(r.vstdate) : undefined,
      vsttime: r.vsttime ? String(r.vsttime) : undefined,
      admdate: r.admdate ? String(r.admdate) : undefined,
      dchdate: r.dchdate ? String(r.dchdate) : undefined,
      income_hosxp: Number(r.income_hosxp || 0),
      rcpt_money: Number(r.rcpt_money || 0),
      debit_hosxp: Number(r.debit_hosxp || 0),
      compensated: Number(r.compensated || 0),
      fund_money: Number(r.fund_money || 0),
      hc: Number(r.hc || 0),
      ae: Number(r.ae || 0),
      inst: Number(r.inst || 0),
      op: Number(r.op || 0),
      ip: Number(r.ip || 0),
      drug: Number(r.drug || 0),
      dmis: Number(r.dmis || 0),
      down: Number(r.down || 0),
      up: Number(r.up || 0),
      rep: String(r.rep || ''),
      bill: String(r.bill || ''),
      billdate: String(r.billdate || ''),
      pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id) : undefined,
      pttype: r.pttype ? String(r.pttype) : undefined,
    }))

    return {
      department,
      ds1,
      ds2,
      dateType,
      pttype: pttype || undefined,
      totalCount,
      page,
      pageSize,
      totalPages,
      items,
    }
  }

  /**
   * Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด
   */
  static async getPalliativeCareReport(
    params: PalliativeCareReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PalliativeCareResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const ucOnly = params.ucOnly !== undefined ? Boolean(params.ucOnly) : true
    const hasRepInvoice = params.hasRepInvoice !== undefined ? Boolean(params.hasRepInvoice) : false
    const paidStatus = params.paidStatus || 'ALL'
    const deathStatus = params.deathStatus || 'ALL'
    const hnFilter = (params.hn || '').trim().toLowerCase()
    const compensatedExpr = typeof params.compensated === 'string' ? params.compensated.trim() : ''
    let compensatedFilterNums: number[] = []
    if (Array.isArray(params.compensated)) {
      compensatedFilterNums = params.compensated.map(Number).filter((n) => !isNaN(n))
    } else if (
      compensatedExpr &&
      !compensatedExpr.startsWith('>') &&
      !compensatedExpr.startsWith('<') &&
      !compensatedExpr.startsWith('=') &&
      compensatedExpr !== 'ALL' &&
      compensatedExpr !== 'PAID'
    ) {
      compensatedFilterNums = compensatedExpr
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n))
    }
    const filterType = params.filterType || 'ALL'
    const search = (params.search || '').trim().toLowerCase()

    const cacheKey = `rcm-palliative-care-${ds1}-${ds2}`

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const sql = `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            IFNULL(cc.AuthenCode, '') AS authencode,
            IFNULL(o.pttype, '') AS pttype,
            IFNULL(ptt.hipdata_code, '') AS inscl,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            CONCAT(IFNULL(pt.addrpart,''), ' ม.', IFNULL(pt.moopart,''), ' ', IFNULL(pt.road,'')) AS address,
            COALESCE(NULLIF(TRIM(pt.mobile_phone_number),''), NULLIF(TRIM(pt.informtel),''), NULLIF(TRIM(pt.hometel),''), '') AS tel,
            IFNULL(s.cc, '') AS cc,
            IFNULL(k.department, o.main_dep) AS room,
            IFNULL(sp.name, o.spclty) AS spclty,
            CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) AS Diag,
            CONCAT_WS(',', v.op0, v.op1, v.op2, v.op3, v.op4, v.op5) AS Oper,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'Z515', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Z515,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'B2[0-4]|^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Dx,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'Z718', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Z718,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^C|D3[7-9]|D4', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Cancer,
            IFNULL(dr.Drug, '') AS Drug,
            IFNULL(pt.death, 'N') AS death,
            DATE_FORMAT(pt.deathday, '%Y-%m-%d') AS death_date,
            IF(e.hn IS NULL, ' ', 'Y') AS OK,
            IFNULL(e.PallativeCare, 0) AS compensated,
            CONCAT_WS('#', e.rep, e.id) AS rep_invoice,
            CONCAT_WS('#', m.eclaim_no, m.id) AS eclaim_no,
            m.senddate,
            CASE 
              WHEN m.status IS NOT NULL THEN CONCAT(m.status, ' :: ', IFNULL(ecs.name, m.status))
              ELSE '- :: ยังไม่ได้ส่ง'
            END AS status_Eclaim,
            IFNULL(m.filename_send, '') AS filename_send
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn 
          JOIN ovstdiag dx ON dx.vn = o.vn
          LEFT JOIN opdscreen s ON s.vn = o.vn
          LEFT JOIN (
            SELECT DISTINCT oo.vn, 'Y' AS Drug
            FROM opitemrece oo
            JOIN drugitems d ON d.icode = oo.icode
            WHERE d.nhso_adp_code REGEXP '^M'
              AND oo.vstdate BETWEEN ? AND ?
          ) dr ON dr.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype 
          LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
          LEFT JOIN spclty sp ON sp.spclty = o.spclty
          LEFT JOIN (
            SELECT hn, MAX(PallativeCare) AS PallativeCare, MAX(rep) AS rep, MAX(id) AS id
            FROM rcmdb.repeclaim
            WHERE PallativeCare > 0
            GROUP BY hn
          ) e ON e.hn = o.hn
          LEFT JOIN (
            SELECT 
              m.opdseq AS vn,
              MAX(m.eclaim_no) AS eclaim_no,
              SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT IF(m.status='4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
              SUBSTRING_INDEX(GROUP_CONCAT(m.maininscl ORDER BY m.eclaim_no DESC), ',', 1) AS maininscl,
              SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status,
              SUBSTRING_INDEX(GROUP_CONCAT(m.code_id ORDER BY m.eclaim_no DESC), ',', 1) AS errorcode,
              SUBSTRING_INDEX(GROUP_CONCAT(m.tran_id ORDER BY m.eclaim_no DESC), ',', 1) AS id,
              SUBSTRING_INDEX(GROUP_CONCAT(UCASE(m.filename_send) ORDER BY m.eclaim_no DESC), ',', 1) AS filename_send,
              SUBSTRING_INDEX(GROUP_CONCAT(pp.child_dob ORDER BY m.eclaim_no DESC), ',', 1) AS vstdate,
              SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(m.date_send, m.filename_send) ORDER BY m.eclaim_no DESC), ',', 1) AS senddate
            FROM eclaimdb.m_registerdata m
            JOIN eclaimdb.m_ppcom pp ON pp.eclaim_no = m.eclaim_no 
            WHERE pp.itemname REGEXP '30001'
              AND m.person_type = '1'
              AND m.opdseq IS NOT NULL
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
            AND IFNULL(o.pttype, '') NOT IN ('H1', '35', '36')
            AND dx.icd10 REGEXP 'B2[0-4]|^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185|Z515|Z718'
          GROUP BY o.vn
          HAVING Dx = 'Y'
          ORDER BY o.hn ASC
        `
        return (await executor(sql, [ds1, ds2, ds1, ds2], { timeoutMs: 120000 })) as any[]
      },
      300000 // Cache TTL 5 minutes (300 seconds)
    )

    // Format & map rows
    let mapped: PalliativeCareItem[] = (rawRows || []).map((r, idx) => {
      const z515 = String(r.Z515 || '').trim()
      const errorName = !z515 ? 'ไม่พบรหัส Z515' : ''
      let formattedSendDate: string | null = null
      if (r.senddate) {
        const rawDate = String(r.senddate).trim()
        const match = rawDate.match(/(\d{4})(\d{2})(\d{2})/)
        if (match) {
          formattedSendDate = `${match[1]}-${match[2]}-${match[3]}`
        } else {
          formattedSendDate = rawDate
        }
      }

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        cid: String(r.cid || ''),
        hn: String(r.hn || ''),
        ptname: String(r.ptname || '').trim(),
        vstdate: String(r.vstdate || ''),
        authencode: String(r.authencode || '').trim(),
        pttype: String(r.pttype || '').trim(),
        inscl: String(r.inscl || '').trim(),
        pttypename: String(r.pttypename || '').trim(),
        address: String(r.address || '').trim(),
        tel: String(r.tel || '').trim(),
        cc: String(r.cc || '').trim(),
        room: String(r.room || '').trim(),
        spclty: String(r.spclty || '').trim(),
        diag: String(r.Diag || ''),
        oper: String(r.Oper || ''),
        z515,
        dx: String(r.Dx || '').trim(),
        z718: String(r.Z718 || '').trim(),
        cancer: String(r.Cancer || '').trim(),
        drug: String(r.Drug || '').trim(),
        death: String(r.death || 'N').trim(),
        death_date: r.death_date ? String(r.death_date) : null,
        ok: String(r.OK || ' ').trim(),
        compensated: Number(r.compensated || 0),
        rep_invoice: String(r.rep_invoice || '').trim(),
        eclaim_no: String(r.eclaim_no || '').trim(),
        senddate: formattedSendDate,
        status_eclaim: String(r.status_Eclaim || '').trim(),
        filename_send: String(r.filename_send || '').trim(),
        error_name: errorName,
      }
    })

    // Apply interactive filters
    // Exclude H1, 35, 36
    mapped = mapped.filter((item) => !['H1', '35', '36'].includes(item.pttype))

    if (ucOnly) {
      mapped = mapped.filter((item) => item.inscl === 'UCS')
    }

    if (hasRepInvoice) {
      mapped = mapped.filter((item) => Boolean(item.rep_invoice && item.rep_invoice.trim() !== ''))
    }

    if (compensatedFilterNums.length > 0) {
      mapped = mapped.filter((item) => compensatedFilterNums.includes(item.compensated))
    } else if (compensatedExpr && compensatedExpr !== 'ALL') {
      if (compensatedExpr === '0') {
        mapped = mapped.filter((item) => item.compensated === 0)
      } else if (compensatedExpr === 'PAID' || compensatedExpr === '>0') {
        mapped = mapped.filter((item) => item.compensated > 0 || item.ok === 'Y')
      } else if (compensatedExpr.startsWith('>=')) {
        const t = Number(compensatedExpr.slice(2).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated >= t)
      } else if (compensatedExpr.startsWith('>')) {
        const t = Number(compensatedExpr.slice(1).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated > t)
      } else if (compensatedExpr.startsWith('<=')) {
        const t = Number(compensatedExpr.slice(2).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated <= t)
      } else if (compensatedExpr.startsWith('<')) {
        const t = Number(compensatedExpr.slice(1).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated < t)
      } else if (compensatedExpr.startsWith('=')) {
        const t = Number(compensatedExpr.slice(1).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated === t)
      }
    }

    if (paidStatus === 'PAID') {
      mapped = mapped.filter((item) => item.ok === 'Y' || item.compensated > 0)
    } else if (paidStatus === 'UNPAID') {
      mapped = mapped.filter((item) => item.ok !== 'Y' && item.compensated === 0)
    }

    if (deathStatus === 'Y') {
      mapped = mapped.filter((item) => item.death === 'Y')
    } else if (deathStatus === 'N') {
      mapped = mapped.filter((item) => item.death === 'N')
    }

    const z515Status = params.z515Status || 'ALL'
    if (z515Status === 'Y') {
      mapped = mapped.filter((item) => item.z515 === 'Y')
    } else if (z515Status === 'N') {
      mapped = mapped.filter((item) => !item.z515 || item.z515 !== 'Y')
    }

    if (hnFilter) {
      mapped = mapped.filter((item) => item.hn.toLowerCase().includes(hnFilter))
    }

    if (filterType === 'Chronic') {
      mapped = mapped.filter((item) => item.z718 === 'Y' && item.dx === 'Y')
    } else if (filterType === 'Opioid') {
      mapped = mapped.filter((item) => item.cancer === 'Y' && item.drug === 'Y')
    } else if (filterType === 'Death') {
      mapped = mapped.filter((item) => item.death === 'Y')
    }

    if (search) {
      mapped = mapped.filter(
        (item) =>
          item.hn.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.cid.includes(search) ||
          item.vn.includes(search) ||
          item.diag.toLowerCase().includes(search)
      )
    }

    // Re-index row numbers
    mapped.forEach((item, i) => {
      item.no = i + 1
    })

    const uniquePatients = new Set(mapped.map((item) => item.hn))

    const dbCompensations = (rawRows || [])
      .map((r) => Number(r.compensated || 0))
      .filter((val) => val > 0)
    const availableCompensations = Array.from(
      new Set([...BASE_COMPENSATION_OPTIONS, ...dbCompensations])
    ).sort((a, b) => a - b)

    const summary: PalliativeCareSummary = {
      totalVisits: mapped.length,
      totalPatients: uniquePatients.size,
      advanceCarePlanCount: mapped.filter((item) => item.z718 === 'Y' && item.dx === 'Y').length,
      opioidCount: mapped.filter((item) => item.cancer === 'Y' && item.drug === 'Y').length,
      hasZ515Count: mapped.filter((item) => item.z515 === 'Y').length,
      missingZ515Count: mapped.filter((item) => !item.z515).length,
      paidCount: mapped.filter((item) => item.ok === 'Y').length,
      totalCompensated: mapped.reduce((sum, item) => sum + item.compensated, 0),
      deceasedCount: mapped.filter((item) => item.death === 'Y').length,
    }

    return {
      ds1,
      ds2,
      ucOnly,
      hasRepInvoice,
      compensated: params.compensated,
      paidStatus,
      deathStatus,
      z515Status,
      hn: hnFilter,
      filterType,
      summary,
      items: mapped,
      availableCompensations,
    }
  }

  /**
   * Palliative Care End Of Life (PC.1)
   * บริการ Palliative Care End Of Life ตามรหัส ADP 30001
   */
  static async getPalliativeCarePc1Report(
    params: PalliativeCarePc1ReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PalliativeCarePc1Result> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const paidStatus = params.paidStatus || 'ALL'
    const search = (params.search || '').trim().toLowerCase()

    const cacheKey = `rcm-palliative-care-pc1-${ds1}-${ds2}`

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const sql = `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
            IFNULL(n.name, IFNULL(pt.nationality, '')) AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            IFNULL(cc.AuthenCode, '') AS authencode,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            IFNULL(k.department, o.main_dep) AS department,
            IFNULL(sp.name, o.spclty) AS clinic,
            v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
            dd.listname,
            rd.rep,
            IFNULL(rd.compensated, 0) AS compensated,
            rd.TransactionType AS transaction_type,
            re.rep AS invoice,
            IFNULL(re.compensated, 0) AS invoice_compensated,
            re.resource,
            rd.subfund,
            rd.remark,
            rd.projectcode
          FROM ovst o
          JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, d.strength) SEPARATOR ', ') AS listname
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND d.nhso_adp_code IN ('30001')
            GROUP BY oo.vn
          ) dd ON dd.vn = o.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality n ON n.nationality = pt.nationality
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
          LEFT JOIN spclty sp ON sp.spclty = o.spclty
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN rcmdb.repdata rd ON rd.vn = o.vn
          LEFT JOIN rcmdb.repeclaim re ON re.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC
        `
        return (await executor(sql, [ds1, ds2, ds1, ds2], { timeoutMs: 120000 })) as any[]
      },
      300000 // Cache TTL 5 minutes
    )

    let mapped: PalliativeCarePc1Item[] = (rawRows || []).map((r, idx) => ({
      no: idx + 1,
      vn: String(r.vn || ''),
      cid: String(r.cid || ''),
      hn: String(r.hn || ''),
      ptname: String(r.ptname || '').trim(),
      age: Number(r.age || 0),
      nation: String(r.nation || 'ไทย').trim(),
      vstdate: String(r.vstdate || ''),
      vsttime: String(r.vsttime || ''),
      authencode: String(r.authencode || ''),
      pttypename: String(r.pttypename || ''),
      department: String(r.department || ''),
      clinic: String(r.clinic || ''),
      pdx: r.pdx ? String(r.pdx) : null,
      dx0: r.dx0 ? String(r.dx0) : null,
      dx1: r.dx1 ? String(r.dx1) : null,
      dx2: r.dx2 ? String(r.dx2) : null,
      dx3: r.dx3 ? String(r.dx3) : null,
      dx4: r.dx4 ? String(r.dx4) : null,
      dx5: r.dx5 ? String(r.dx5) : null,
      op0: r.op0 ? String(r.op0) : null,
      op1: r.op1 ? String(r.op1) : null,
      op2: r.op2 ? String(r.op2) : null,
      op3: r.op3 ? String(r.op3) : null,
      op4: r.op4 ? String(r.op4) : null,
      op5: r.op5 ? String(r.op5) : null,
      listname: String(r.listname || ''),
      rep: r.rep ? String(r.rep) : null,
      compensated: Number(r.compensated || 0),
      transaction_type: r.transaction_type ? String(r.transaction_type) : null,
      invoice: r.invoice ? String(r.invoice) : null,
      invoice_compensated: Number(r.invoice_compensated || 0),
      resource: r.resource ? String(r.resource) : null,
      subfund: r.subfund ? String(r.subfund) : null,
      remark: r.remark ? String(r.remark) : null,
      projectcode: r.projectcode ? String(r.projectcode) : null,
    }))

    if (paidStatus === 'PAID') {
      mapped = mapped.filter((item) => item.compensated > 0)
    } else if (paidStatus === 'UNPAID') {
      mapped = mapped.filter((item) => item.compensated === 0)
    } else if (paidStatus === 'INVOICE') {
      mapped = mapped.filter((item) => item.invoice_compensated > 0 || Boolean(item.invoice && item.invoice.trim()))
    }

    if (search) {
      mapped = mapped.filter(
        (item) =>
          item.hn.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.cid.includes(search) ||
          item.vn.includes(search) ||
          (item.pdx && item.pdx.toLowerCase().includes(search)) ||
          item.listname.toLowerCase().includes(search)
      )
    }

    // Re-index row numbers
    mapped.forEach((item, i) => {
      item.no = i + 1
    })

    const uniquePatients = new Set(mapped.map((item) => item.hn))

    const summary: PalliativeCarePc1Summary = {
      totalVisits: mapped.length,
      totalPatients: uniquePatients.size,
      paidCount: mapped.filter((item) => item.compensated > 0).length,
      unpaidCount: mapped.filter((item) => item.compensated === 0).length,
      totalCompensated: mapped.reduce((sum, item) => sum + item.compensated, 0),
      totalInvoiceCompensated: mapped.reduce((sum, item) => sum + item.invoice_compensated, 0),
    }

    return {
      ds1,
      ds2,
      paidStatus,
      summary,
      items: mapped,
    }
  }

  /**
   * Retrieves comprehensive clinical details for a single visit (VN),
   * including opdscreen (vitals, CC, HPI, PMH, PE), ovstdiag (diagnoses & physicians),
   * and opitemrece (itemized medications, labs, imaging, nursing & services grouped by category).
   */
  static async getVnClinicalDetails(
    vn: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<VnClinicalDetails | null> {
    const cleanVn = (vn || '').trim()
    if (!cleanVn) return null

    const headerSql = `
      SELECT 
        o.vn, o.hn, IFNULL(pt.cid, '') AS cid,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        CASE WHEN pt.sex = '1' THEN 'ชาย' WHEN pt.sex = '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
        IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        IFNULL(o.vsttime, '') AS vsttime,
        IFNULL(p.name, IFNULL(o.pttype, '')) AS pttypename,
        IFNULL(k.department, IFNULL(o.main_dep, '')) AS department,
        IFNULL(s.name, IFNULL(o.spclty, '')) AS clinic
      FROM ovst o
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN pttype p ON p.pttype = o.pttype
      LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
      LEFT JOIN spclty s ON s.spclty = o.spclty
      WHERE o.vn = ?
      LIMIT 1;
    `

    const screenSql = `
      SELECT 
        s.bw, s.height, s.bmi, s.bps, s.bpd, s.pulse, s.rr, s.temperature, s.spo2, s.fbs,
        s.cc, s.hpi, s.pmh, s.pe, s.screen_dep,
        IFNULL(k.department, s.screen_dep) AS screen_dep_name,
        s.symptom
      FROM opdscreen s
      LEFT JOIN kskdepartment k ON k.depcode = s.screen_dep
      WHERE s.vn = ?
      LIMIT 1;
    `

    const diagSql = `
      SELECT 
        d.icd10,
        IFNULL(i.name, d.icd10) AS icd_name,
        IFNULL(d.diagtype, '') AS diagtype,
        IFNULL(dt.name, CASE d.diagtype 
          WHEN '1' THEN 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)' 
          WHEN '2' THEN 'CO-MORBIDITY (การวินิจฉัยโรคร่วม)' 
          WHEN '3' THEN 'COMPLICATION (ภาวะแทรกซ้อน)' 
          WHEN '4' THEN 'OTHER (การวินิจฉัยอื่นๆ)' 
          WHEN '5' THEN 'EXTERNAL CAUSE (สาเหตุภายนอก)' 
          ELSE 'ไม่ระบุประเภท' END) AS diagtype_name,
        IFNULL(doc.name, '') AS doctor_name
      FROM ovstdiag d
      LEFT JOIN icd101 i ON i.code = d.icd10
      LEFT JOIN diagtype dt ON dt.diagtype = d.diagtype
      LEFT JOIN doctor doc ON doc.code = d.doctor
      WHERE d.vn = ?
      ORDER BY d.diagtype ASC, d.ovst_diag_id ASC;
    `

    const orderSql = `
      SELECT 
        o.icode,
        COALESCE(d.name, nd.name, o.icode) AS item_name,
        d.strength,
        d.units,
        IFNULL(o.qty, 0) AS qty,
        IFNULL(o.unitprice, 0) AS unitprice,
        IFNULL(o.sum_price, 0) AS sum_price,
        IFNULL(o.paidst, '') AS paidst,
        IFNULL(pst.name, CASE o.paidst 
          WHEN '01' THEN 'ชำระเองเบิกได้' 
          WHEN '02' THEN 'ลูกหนี้สิทธิ' 
          WHEN '03' THEN 'ชำระเองเบิกไม่ได้' 
          WHEN '00' THEN 'ค้างชำระ' 
          ELSE o.paidst END) AS paidst_name,
        IFNULL(o.income, '') AS income_code,
        IFNULL(inc.name, '') AS income_name,
        CONCAT_WS(' ', du.name1, du.name2, du.name3, sp.name1, sp.name2, sp.name3) AS drugusage_text,
        IF(d.icode IS NOT NULL, 1, 0) AS is_drug
      FROM opitemrece o
      LEFT JOIN s_drugitems d ON d.icode = o.icode
      LEFT JOIN nondrugitems nd ON nd.icode = o.icode
      LEFT JOIN paidst pst ON pst.paidst = o.paidst
      LEFT JOIN income inc ON inc.income = o.income
      LEFT JOIN drugusage du ON du.drugusage = o.drugusage
      LEFT JOIN sp_use sp ON sp.sp_use = o.sp_use
      WHERE o.vn = ?
      ORDER BY o.income ASC, o.item_no ASC, o.icode ASC;
    `

    const [headerRows, screenRows, diagRows, orderRows] = await Promise.all([
      executor(headerSql, [cleanVn]),
      executor(screenSql, [cleanVn]),
      executor(diagSql, [cleanVn]),
      executor(orderSql, [cleanVn]),
    ])

    if (!headerRows || headerRows.length === 0) {
      return null
    }

    const h = headerRows[0]
    const header: VnClinicalDetailsHeader = {
      vn: String(h.vn || cleanVn),
      hn: String(h.hn || ''),
      cid: String(h.cid || ''),
      ptname: String(h.ptname || '').trim(),
      age: Number(h.age || 0),
      sex: String(h.sex || '-'),
      vstdate: String(h.vstdate || ''),
      vsttime: String(h.vsttime || ''),
      pttypename: String(h.pttypename || ''),
      department: String(h.department || ''),
      clinic: String(h.clinic || ''),
    }

    let screen: VnScreenData | null = null
    if (screenRows && screenRows.length > 0) {
      const s = screenRows[0]
      screen = {
        bw: s.bw != null ? Number(s.bw) : null,
        height: s.height != null ? Number(s.height) : null,
        bmi: s.bmi != null ? Number(s.bmi) : null,
        bps: s.bps != null ? Number(s.bps) : null,
        bpd: s.bpd != null ? Number(s.bpd) : null,
        pulse: s.pulse != null ? Number(s.pulse) : null,
        rr: s.rr != null ? Number(s.rr) : null,
        temperature: s.temperature != null ? Number(s.temperature) : null,
        spo2: s.spo2 != null ? Number(s.spo2) : null,
        fbs: s.fbs != null ? Number(s.fbs) : null,
        cc: s.cc ? String(s.cc).trim() : null,
        hpi: s.hpi ? String(s.hpi).trim() : null,
        pmh: s.pmh ? String(s.pmh).trim() : null,
        pe: s.pe ? String(s.pe).trim() : null,
        screen_dep: s.screen_dep ? String(s.screen_dep) : null,
        screen_dep_name: s.screen_dep_name ? String(s.screen_dep_name).trim() : null,
        symptom: s.symptom ? String(s.symptom).trim() : null,
      }
    }

    const diagnoses: VnDiagItem[] = (diagRows || []).map((d: any) => ({
      icd10: String(d.icd10 || ''),
      icd_name: String(d.icd_name || ''),
      diagtype: String(d.diagtype || ''),
      diagtype_name: String(d.diagtype_name || ''),
      doctor_name: d.doctor_name ? String(d.doctor_name).trim() : null,
    }))

    const orderItems: VnOrderItem[] = (orderRows || []).map((o: any) => {
      const inc = String(o.income_code || '')
      const isDrug = Boolean(o.is_drug)

      let categoryGroup: VnOrderCategoryGroup = 'OTHER'
      if (isDrug || ['03', '85', '86', '90', '91'].includes(inc)) {
        categoryGroup = 'DRUG'
      } else if (['05', '26', '27', '28', '93', '94'].includes(inc)) {
        categoryGroup = 'LAB'
      } else if (['04', '06', '87', '95'].includes(inc)) {
        categoryGroup = 'XRAY'
      } else if (['11', '12', '13', '14', '16', '20', '45', '71', '76', '77', '78', '98', '99', '36', '37'].includes(inc)) {
        categoryGroup = 'PROCEDURE_SERVICE'
      } else if (['18', '19', '24', '30', '31', '89', '92', '97'].includes(inc)) {
        categoryGroup = 'SUPPLY'
      }

      return {
        icode: String(o.icode || ''),
        item_name: String(o.item_name || ''),
        strength: o.strength ? String(o.strength).trim() : null,
        units: o.units ? String(o.units).trim() : null,
        qty: Number(o.qty || 0),
        unitprice: Number(o.unitprice || 0),
        sum_price: Number(o.sum_price || 0),
        paidst: String(o.paidst || ''),
        paidst_name: String(o.paidst_name || ''),
        income_code: inc,
        income_name: String(o.income_name || ''),
        category_group: categoryGroup,
        drugusage_text: String(o.drugusage_text || '').trim(),
      }
    })

    const categoryDefinitions: { group: VnOrderCategoryGroup; title: string }[] = [
      { group: 'DRUG', title: 'ยาและเวชภัณฑ์ยา' },
      { group: 'LAB', title: 'การตรวจชันสูตรทางห้องปฏิบัติการ (LAB)' },
      { group: 'XRAY', title: 'เอกซเรย์และการตรวจรังสี (X-Ray)' },
      { group: 'PROCEDURE_SERVICE', title: 'หัตถการและค่าบริการทางการพยาบาล / การแพทย์' },
      { group: 'SUPPLY', title: 'อุปกรณ์และเวชภัณฑ์มิใช่ยา' },
      { group: 'OTHER', title: 'ค่าบริการอื่นๆ' },
    ]

    const categories: VnOrderCategorySummary[] = categoryDefinitions
      .map((def) => {
        const groupItems = orderItems.filter((i) => i.category_group === def.group)
        return {
          category_group: def.group,
          title: def.title,
          total_price: groupItems.reduce((acc, curr) => acc + curr.sum_price, 0),
          item_count: groupItems.length,
          items: groupItems,
        }
      })
      .filter((cat) => cat.item_count > 0)

    const totalPrice = orderItems.reduce((sum, item) => sum + item.sum_price, 0)
    const totalItems = orderItems.reduce((sum, item) => sum + item.qty, 0)
    const totalPaid = orderItems
      .filter((i) => ['01', '03'].includes(i.paidst))
      .reduce((sum, item) => sum + item.sum_price, 0)
    const totalClaim = orderItems
      .filter((i) => i.paidst === '02')
      .reduce((sum, item) => sum + item.sum_price, 0)

    return {
      header,
      screen,
      diagnoses,
      orders: {
        items: orderItems,
        categories,
        total_price: totalPrice,
        total_items: totalItems,
        total_paid: totalPaid,
        total_claim: totalClaim,
      },
    }
  }

}

