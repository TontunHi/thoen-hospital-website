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

export interface InvoiceDetailFilteredSummary {
  totalVisits: number
  compensated: number
  fund_money: number
  income_hosxp: number
  rcpt_money: number
  debit_hosxp: number
  hc: number
  ae: number
  inst: number
  op: number
  ip: number
  drug: number
  dmis: number
  down: number
  up: number
  net_diff: number
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
  filteredSummary?: InvoiceDetailFilteredSummary
}

/**
 * Build aggregate count + 3-category reconciliation summary SQL across all matching visits/admissions.
 */
export function buildInvoiceCountAndSummarySql(
  department: 'OP' | 'IP',
  dateCol: 'bill_date' | 'admdate',
  pttypeClause: string,
  searchClause: string
): string {
  const isOp = department === 'OP'
  const idCol = isOp ? 't.vn' : 't.an'
  const visitJoin = isOp
    ? `LEFT JOIN hos.ovst o ON o.vn = t.vn
       LEFT JOIN hos.vn_stat v ON v.vn = o.vn
       LEFT JOIN hos.pttype ptt ON ptt.pttype = o.pttype`
    : `LEFT JOIN hos.ipt i ON i.an = t.an
       LEFT JOIN hos.an_stat v ON v.an = i.an
       LEFT JOIN hos.pttype ptt ON ptt.pttype = i.pttype`

  return `
    SELECT
      COUNT(*) as total,
      ROUND(COALESCE(SUM(sub.compensated), 0), 2) as compensated,
      ROUND(COALESCE(SUM(sub.fund_money), 0), 2) as fund_money,
      ROUND(COALESCE(SUM(sub.income_hosxp), 0), 2) as income_hosxp,
      ROUND(COALESCE(SUM(sub.rcpt_money), 0), 2) as rcpt_money,
      ROUND(COALESCE(SUM(sub.debit_hosxp), 0), 2) as debit_hosxp,
      ROUND(COALESCE(SUM(sub.hc), 0), 2) as hc,
      ROUND(COALESCE(SUM(sub.ae), 0), 2) as ae,
      ROUND(COALESCE(SUM(sub.inst), 0), 2) as inst,
      ROUND(COALESCE(SUM(sub.op), 0), 2) as op,
      ROUND(COALESCE(SUM(sub.ip), 0), 2) as ip,
      ROUND(COALESCE(SUM(sub.drug), 0), 2) as drug,
      ROUND(COALESCE(SUM(sub.dmis), 0), 2) as dmis,
      ROUND(COALESCE(SUM(sub.down), 0), 2) as down,
      ROUND(COALESCE(SUM(sub.up), 0), 2) as up
    FROM (
      SELECT STRAIGHT_JOIN
        ${idCol} as visit_key,
        SUM(t.compensated) as compensated,
        SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)) as fund_money,
        v.income as income_hosxp,
        v.rcpt_money as rcpt_money,
        v.income - v.rcpt_money as debit_hosxp,
        SUM(t.hc) as hc,
        SUM(t.ae) as ae,
        SUM(t.inst) as inst,
        SUM(t.op) as op,
        SUM(t.ip) as ip,
        SUM(t.drug) as drug,
        SUM(t.dmis) as dmis,
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
      ${visitJoin}
      WHERE t.department = '${department}'
        AND t.${dateCol} BETWEEN ? AND ?
        ${pttypeClause}
        ${searchClause}
      GROUP BY ${idCol}, v.income, v.rcpt_money
    ) sub
  `
}

/**
 * Normalize an aggregate summary SQL row into InvoiceDetailFilteredSummary.
 */
export function mapInvoiceFilteredSummary(row: Record<string, unknown> | undefined): InvoiceDetailFilteredSummary {
  const round2 = (v: unknown) => Math.round(Number(v || 0) * 100) / 100
  const compensated = round2(row?.compensated)
  const debit_hosxp = round2(row?.debit_hosxp)

  return {
    totalVisits: Number(row?.total || row?.totalVisits || 0),
    compensated,
    fund_money: round2(row?.fund_money),
    income_hosxp: round2(row?.income_hosxp),
    rcpt_money: round2(row?.rcpt_money),
    debit_hosxp,
    hc: round2(row?.hc),
    ae: round2(row?.ae),
    inst: round2(row?.inst),
    op: round2(row?.op),
    ip: round2(row?.ip),
    drug: round2(row?.drug),
    dmis: round2(row?.dmis),
    down: round2(row?.down),
    up: round2(row?.up),
    net_diff: Math.round((compensated - debit_hosxp) * 100) / 100,
  }
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
