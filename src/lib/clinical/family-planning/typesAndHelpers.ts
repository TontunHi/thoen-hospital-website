import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams, type QueryExecutor } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'

// ── 1. Domain Types ──────────────────────────────────────────────────────────

export type FamilyPlanningReportType =
  | '9.3.1'
  | '9.3.2'
  | '9.3.1.1'
  | '9.3.1.2'
  | '9.4'
  | '9.3.4'
  | '9.5'
  | '9.3.5'
  | '9.6'
  | '9.3.6'
  | '9.7'
  | '9.3.7'
export type FamilyPlanningPatientType = 'OPD' | 'IPD'

export type FamilyPlanningCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'ECLAIM_SENT'
  | 'UNSENT'
  | 'ERROR_DX'
  | 'ERROR_DRUG'
  | 'HAS_ERROR'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'

export type FamilyPlanningSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'PTTYPE'
  | 'DEPARTMENT'
  | 'CLINIC'
  | 'DX'
  | 'DRUG'

export type FamilyPlanningSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'status'
  | 'errorDx'
  | 'errorDrug'

export interface FamilyPlanningReportParams extends FiscalDateRangeParams {
  reportType?: FamilyPlanningReportType // '9.3.1' = ฝังยาคุม (FP002_1), '9.3.2' = ถอดยาคุม (FP002_2)
  patientType?: FamilyPlanningPatientType // 'OPD' | 'IPD'
  cardFilter?: FamilyPlanningCardFilter
  searchField?: FamilyPlanningSearchField
  search?: string
  sortBy?: FamilyPlanningSortField
  sortOrder?: 'asc' | 'desc'
  pttypes?: string | string[]
  ucOnly?: boolean
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface FamilyPlanningAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface FamilyPlanningAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  adpCode?: string
  format?: string
  items: FamilyPlanningAdpMappingItem[]
}

// ── 1.1 Domain Types: 9.1 บริการวางแผนครอบครัวและการป้องกันการตั้งครรภ์ ───────

export type FamilyPlanningFormat = 'NEW_ECLAIM' | 'KRUNGTHAI'

export type FamilyPlanning91CardFilter =
  | 'ALL'
  | 'SERVICE_ONLY'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'HAS_ERROR'
  | 'NO_AUTHEN'

export type FamilyPlanning91SearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DRUG'
  | 'SERVICE'
  | 'DIAG'
  | 'DOCTOR'
  | 'ERROR'

export type FamilyPlanning91SortField =
  | 'vstdate'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'status'
  | 'errorname'
  | 'listname'

export interface FamilyPlanning91Item {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number | null
  nation: string | null
  vstdate: string
  vsttime: string
  cc: string | null
  authencode: string | null
  pttypename: string | null
  pttype_eclaim_id?: string | null
  isUc?: boolean
  pdx: string | null
  dx0?: string | null
  dx1?: string | null
  dx2?: string | null
  dx3?: string | null
  dx4?: string | null
  dx5?: string | null
  op0?: string | null
  op1?: string | null
  op2?: string | null
  op3?: string | null
  op4?: string | null
  op5?: string | null
  icd10: string | null
  diag: string | null
  op: string | null
  oper: string | null
  income: number
  doctorname: string | null
  listname: string | null
  drugname: string | null
  status: string
  rep: string | null
  compensated: number
  errorname: string | null
  fund: string | null
  subfund: string | null
  hasService: boolean
  hasAuthen: boolean
  hasError: boolean
}

export interface FamilyPlanning91Summary {
  totalVisits: number
  uniquePatients: number
  serviceOnlyCount: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  errorCount: number
  authenCount: number
  noAuthenCount: number
  withDxCount: number
  withDrugCount: number
  totalIncome: number
}

export interface FamilyPlanning91ReportResult {
  ds1: string
  ds2: string
  format: FamilyPlanningFormat
  serviceOnly: boolean
  status: string
  cardFilter: FamilyPlanning91CardFilter
  searchField: FamilyPlanning91SearchField
  search: string
  sortBy: FamilyPlanning91SortField
  sortOrder: 'asc' | 'desc'
  summary: FamilyPlanning91Summary
  adpMapping: FamilyPlanningAdpMappingCheck
  statusOptions: string[]
  errorOptions: string[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: FamilyPlanning91Item[]
}

export interface FamilyPlanningItem {
  no: number
  vn: string // VN for OPD, AN for IPD
  an?: string | null
  hn: string
  cid: string
  ptname: string
  sex: string
  age: number
  vstdate: string // YYYY-MM-DD
  vsttime: string // HH:mm:ss
  admdate?: string | null
  dchdate?: string | null
  pttypename: string
  pttype_eclaim_id?: string | null
  isUc?: boolean
  claimcode: string | null
  department: string | null
  clinic: string | null
  cc: string | null
  income: number
  dx: string | null
  op: string | null
  drug: string | null
  money_eclaim: number
  money_rep: number
  money_invoice: number
  compensated: number
  isCompensated: boolean
  errorDx: string | null // 'ไม่พบ Dx Z308' | null
  errorDrug: string | null // 'ไม่พบค่าบริการ' | null
  hasError: boolean
  rep: string | null
  status: string
  patientType: FamilyPlanningPatientType
  reportType: FamilyPlanningReportType
}

export interface FamilyPlanningSummary {
  totalCases: number
  uniquePatients: number
  compensatedCases: number
  eclaimSentCases: number
  unsentCases: number
  compensationRate: number
  totalCompensated: number
  totalIncome: number
  errorDxCount: number
  errorDrugCount: number
  hasErrorCount: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
}

export interface FamilyPlanningReportResult {
  ds1: string
  ds2: string
  reportType: FamilyPlanningReportType
  patientType: FamilyPlanningPatientType
  adpCode: string
  adpMapping: FamilyPlanningAdpMappingCheck
  cardFilter: FamilyPlanningCardFilter
  searchField: FamilyPlanningSearchField
  search: string
  sortBy: FamilyPlanningSortField
  sortOrder: 'asc' | 'desc'
  summary: FamilyPlanningSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: FamilyPlanningItem[]
}

// ── 1.2 Domain Types: 9.2 บริการใส่ห่วงอนามัย (IUD Insertion Service) ─────────

export type IudPatientType = 'OPD' | 'IPD'

export type IudCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'ECLAIM_SENT'
  | 'UNSENT'
  | 'COMPLETE'
  | 'HAS_ERROR'
  | 'ERROR_DX'
  | 'ERROR_OP'
  | 'ERROR_DRUG'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'

export type IudSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'PTTYPE'
  | 'DEPARTMENT'
  | 'CLINIC'
  | 'DX'
  | 'OP'
  | 'DRUG'
  | 'REP'

export type IudSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'money_eclaim'
  | 'money_rep'
  | 'money_invoice'
  | 'status'
  | 'errorDx'
  | 'errorOp'
  | 'errorDrug'

export interface IudReportParams extends FiscalDateRangeParams {
  patientType?: IudPatientType
  cardFilter?: IudCardFilter
  searchField?: IudSearchField
  search?: string
  sortBy?: IudSortField
  sortOrder?: 'asc' | 'desc'
  pttypes?: string | string[]
  ucOnly?: boolean
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface IudAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  adpCodes: string[]
  items: FamilyPlanningAdpMappingItem[]
}

export interface IudItem {
  no: number
  vn: string
  an?: string | null
  hn: string
  cid: string
  ptname: string
  sex: string
  age: number
  vstdate: string
  vsttime: string
  admdate?: string | null
  dchdate?: string | null
  pttypename: string
  pttype_eclaim_id?: string | null
  isUc?: boolean
  claimcode: string | null
  department: string | null
  clinic: string | null
  cc: string | null
  income: number
  dx: string | null
  op: string | null
  drug: string | null
  money_eclaim: number
  money_rep: number
  money_invoice: number
  compensated: number
  isCompensated: boolean
  errorDx: string | null
  errorOp: string | null
  errorDrug: string | null
  hasError: boolean
  rep: string | null
  status: string
  patientType: IudPatientType
}

export interface IudSummary {
  totalCases: number
  uniquePatients: number
  compensatedCases: number
  uncompensatedCases: number
  eclaimSentCases: number
  unsentCases: number
  compensationRate: number
  totalCompensated: number
  totalIncome: number
  totalMoneyEclaim: number
  totalMoneyRep: number
  totalMoneyInvoice: number
  errorDxCount: number
  errorOpCount: number
  errorDrugCount: number
  hasErrorCount: number
  completeCount: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
}

export interface IudReportResult {
  ds1: string
  ds2: string
  patientType: IudPatientType
  adpCodes: string[]
  adpMapping: IudAdpMappingCheck
  cardFilter: IudCardFilter
  searchField: IudSearchField
  search: string
  sortBy: IudSortField
  sortOrder: 'asc' | 'desc'
  summary: IudSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: IudItem[]
}

// ── 1.3 Domain Types: 9.3.2 บริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป ─────────

export type FamilyPlanning932Format = 'NEW_ECLAIM' | 'KRUNGTHAI'

export type FamilyPlanning932CardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'ECLAIM_SENT'
  | 'UNSENT'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'WITH_DRUG'
  | 'WITH_SERVICE'
  | 'HAS_ERROR'

export type FamilyPlanning932SearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'PTTYPE'
  | 'DEPARTMENT'
  | 'CLINIC'
  | 'DX'
  | 'OP'
  | 'DRUG'
  | 'SERVICE'
  | 'ADP'
  | 'REP'

export type FamilyPlanning932SortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'compensated_eclaim'
  | 'compensated_rep'
  | 'compensated_nhso'
  | 'status'

export interface FamilyPlanning932Item {
  no: number
  vn: string
  an?: string | null
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number
  vstdate: string // YYYY-MM-DD
  vsttime?: string // HH:mm:ss
  authencode: string | null
  department: string | null
  clinic: string | null
  pttypename: string
  pttype_eclaim_id?: string | null
  isUc?: boolean
  drugname: string | null
  listname: string | null
  adpcode: string | null
  income: number
  dx: string | null
  op: string | null
  status: string
  rep_eclaim: string | null
  rep_rep: string | null
  rep_nhso: string | null
  compensated_eclaim: number
  compensated_rep: number
  compensated_nhso: number
  compensated: number
  isCompensated: boolean
  hasAuthen: boolean
  hasDrug: boolean
  hasService: boolean
  hasError: boolean
  errorDetail?: string | null
}

export interface FamilyPlanning932Summary {
  totalCases: number
  uniquePatients: number
  totalIncome: number
  totalCompensated: number
  totalCompensatedEclaim: number
  totalCompensatedRep: number
  totalCompensatedNhso: number
  compensatedCount: number
  uncompensatedCount: number
  compensationRate: number
  eclaimSentCount: number
  unsentCount: number
  withAuthenCount: number
  noAuthenCount: number
  authenRate: number
  withDrugCount: number
  withServiceCount: number
  hasErrorCount: number
}

export interface FamilyPlanning932Params extends FiscalDateRangeParams {
  format?: FamilyPlanning932Format
  cardFilter?: FamilyPlanning932CardFilter
  searchField?: FamilyPlanning932SearchField
  search?: string
  sortBy?: FamilyPlanning932SortField
  sortOrder?: 'asc' | 'desc'
  pttypes?: string | string[]
  ucOnly?: boolean
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface FamilyPlanning932AdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  adpCodes: string[]
  items: FamilyPlanningAdpMappingItem[]
}

export interface FamilyPlanning932ReportResult {
  ds1: string
  ds2: string
  format: FamilyPlanning932Format
  cardFilter: FamilyPlanning932CardFilter
  searchField: FamilyPlanning932SearchField
  search: string
  sortBy: FamilyPlanning932SortField
  sortOrder: 'asc' | 'desc'
  adpCodes: string[]
  adpMapping: FamilyPlanning932AdpMappingCheck
  summary: FamilyPlanning932Summary
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  items: FamilyPlanning932Item[]
}

// ── 2. Helper Functions ───────────────────────────────────────────────────────

export function getAdpCodeForReport(reportType: FamilyPlanningReportType): string {
  if (reportType === '9.7' || reportType === '9.3.7') return 'FP003_4'
  if (reportType === '9.6' || reportType === '9.3.6') return 'FP003_3'
  if (reportType === '9.5' || reportType === '9.3.5') return 'FP003_2'
  if (reportType === '9.4' || reportType === '9.3.4') return 'FP003_1'
  if (reportType === '9.3.2' || reportType === '9.3.1.2') return 'FP002_2'
  return 'FP002_1'
}

export function getExpectedDxForReport(reportType: FamilyPlanningReportType): string {
  if (
    reportType === '9.7' ||
    reportType === '9.3.7' ||
    reportType === '9.6' ||
    reportType === '9.3.6' ||
    reportType === '9.5' ||
    reportType === '9.3.5' ||
    reportType === '9.4' ||
    reportType === '9.3.4'
  ) {
    return 'Z304'
  }
  return 'Z308'
}

export function getReportTitle(reportType: FamilyPlanningReportType): string {
  if (reportType === '9.7' || reportType === '9.3.7') {
    return 'หัวข้อ 9.7 ยาฉีดคุมกำเนิด (ADP: FP003_4)'
  }
  if (reportType === '9.6' || reportType === '9.3.6') {
    return 'หัวข้อ 9.6 ยาเม็ดคุมกำเนิดชนิดฉุกเฉิน (ADP: FP003_3)'
  }
  if (reportType === '9.5' || reportType === '9.3.5') {
    return 'หัวข้อ 9.5 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดียว (ADP: FP003_2)'
  }
  if (reportType === '9.4' || reportType === '9.3.4') {
    return 'หัวข้อ 9.4 รายการยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม (ADP: FP003_1)'
  }
  if (reportType === '9.3.2' || reportType === '9.3.1.2') {
    return 'หัวข้อ 9.3.2 รายการถอดยาคุม (ADP: FP002_2)'
  }
  return 'หัวข้อ 9.3.1 รายการฝังยาคุม (ADP: FP002_1)'
}

export function evaluateFamilyPlanningDiscrepancy(
  hasFp: boolean,
  hasDx: boolean,
  hasDrug: boolean,
  fpName: string | null | undefined,
  op: string | null | undefined
): string | null {
  const fp = (fpName || '').toLowerCase()
  const opStr = op || ''

  if (hasDx && !hasFp) {
    return 'พบ Dx การคุมกำเนิด แต่ไม่พบการบริการ'
  }
  if ((fp.includes('fp001') || fp.includes('20003')) && !opStr.includes('697')) {
    return 'ใส่ห่วง แต่ไม่พบหัตถการ'
  }
  if ((fp.includes('fp002') || fp.includes('20004')) && !opStr.includes('992')) {
    return 'ฝังยาคุม แต่ไม่พบหัตถการ'
  }
  if (hasDrug && !hasFp) {
    return 'พบรายการยาคุมกำเนิด แต่ไม่พบการบริการ'
  }
  if (hasFp && !hasDx) {
    return 'พบรายการบริการ แต่ไม่พบ Dx'
  }
  if (hasDrug && !hasDx) {
    return 'พบรายการยาคุมกำเนิด แต่ไม่พบ Dx'
  }
  return null
}

export const NEW_ECLAIM_ADP_CODES = ['FP001', 'FP002', 'FP003_1', 'FP003_2', 'FP003_3', 'FP003_4']
export const KRUNGTHAI_ADP_CODES = ['20001', '20002', '20003', '20004']
export const IUD_ADP_CODES = ['20003', 'FP001', '71681', '71682']
