import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams, type QueryExecutor } from './rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'

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

// ── 3. RcmFamilyPlanningService Class ─────────────────────────────────────────

export class RcmFamilyPlanningService {
  /**
   * ADP codes for Format 1 (New EClaim) and Format 2 (KrungThai Health Platform)
   */
  static readonly NEW_ECLAIM_ADP_CODES = ['FP001', 'FP002', 'FP003_1', 'FP003_2', 'FP003_3', 'FP003_4']
  static readonly KRUNGTHAI_ADP_CODES = ['20001', '20002', '20003', '20004']

  /**
   * Check whether relevant ADP codes are mapped in HOSxP `s_drugitems` table (for 9.1).
   */
  static async checkAdpMapping(
    format: 'NEW_ECLAIM' | 'KRUNGTHAI' = 'NEW_ECLAIM',
    executor: QueryExecutor = queryClinicalDb
  ): Promise<any> {
    const codes =
      format === 'KRUNGTHAI'
        ? RcmFamilyPlanningService.KRUNGTHAI_ADP_CODES
        : RcmFamilyPlanningService.NEW_ECLAIM_ADP_CODES

    const cacheKey = `rcm-fp-adp-mapping-${format}`
    return getCachedData(
      cacheKey,
      async () => {
        try {
          const placeholders = codes.map(() => '?').join(', ')
          const sql = `
            SELECT icode, name, strength, nhso_adp_code
            FROM s_drugitems 
            WHERE TRIM(nhso_adp_code) IN (${placeholders})
            ORDER BY nhso_adp_code ASC, icode ASC;
          `
          const rows = (await executor(sql, codes, { timeoutMs: 15000 })) as any[]
          const items = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))

          return {
            isMapped: items.length > 0,
            mappedCount: items.length,
            format,
            items,
          }
        } catch {
          return {
            isMapped: false,
            mappedCount: 0,
            format,
            items: [],
          }
        }
      },
      600000
    )
  }

  /**
   * Check if the specific ADP code ('FP002_1' or 'FP002_2') is mapped in s_drugitems (for 9.3).
   */
  static async checkFamilyPlanningAdpMapping(
    adpCode: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<FamilyPlanningAdpMappingCheck> {
    const cacheKey = `rcm-fp-adp-mapping-${adpCode}`
    return getCachedData(
      cacheKey,
      async () => {
        if (executor === queryClinicalDb) {
          try {
            const gwRes = await apiGateway.clinical.getAdpMapping(adpCode)
            if (gwRes && typeof gwRes.isMapped === 'boolean') {
              return {
                isMapped: gwRes.isMapped,
                mappedCount: gwRes.mappedCount,
                adpCode,
                items: (gwRes.items || []).map((r: any) => ({
                  icode: String(r.icode || '').trim(),
                  name: String(r.name || '').trim(),
                  strength: r.strength ? String(r.strength).trim() : null,
                  nhso_adp_code: String(r.nhso_adp_code || '').trim(),
                })),
              }
            }
          } catch {
            // Fallback
          }
        }

        try {
          const sql = `
            SELECT 
              icode, 
              name, 
              strength, 
              nhso_adp_code
            FROM s_drugitems 
            WHERE TRIM(nhso_adp_code) = ?
            ORDER BY icode ASC;
          `
          const rows = (await executor(sql, [adpCode], { timeoutMs: 15000 })) as any[]
          const items: FamilyPlanningAdpMappingItem[] = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))

          return {
            isMapped: items.length > 0,
            mappedCount: items.length,
            adpCode,
            items,
          }
        } catch {
          return {
            isMapped: false,
            mappedCount: 0,
            adpCode,
            items: [],
          }
        }
      },
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Universal dispatch for Family Planning reports:
   * Dispatches to 9.3 when reportType is specified, otherwise 9.1.
   */
  static async getFamilyPlanningReport(
    params: any = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<any> {
    if (
      params.reportType === '9.3.1' ||
      params.reportType === '9.3.2' ||
      params.reportType === '9.3.1.1' ||
      params.reportType === '9.3.1.2' ||
      params.reportType === '9.4' ||
      params.reportType === '9.3.4' ||
      params.reportType === '9.5' ||
      params.reportType === '9.3.5' ||
      params.reportType === '9.6' ||
      params.reportType === '9.3.6' ||
      params.reportType === '9.7' ||
      params.reportType === '9.3.7'
    ) {
      return RcmFamilyPlanningService.getFamilyPlanning93Report(params, executor)
    }
    return RcmFamilyPlanningService.getFamilyPlanning91Report(params, executor)
  }

  /**
   * 9.1 Family Planning report implementation.
   */
  static async getFamilyPlanning91Report(
    params: any = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<any> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const format = params.format || 'NEW_ECLAIM'
    const adpCodes =
      format === 'KRUNGTHAI'
        ? RcmFamilyPlanningService.KRUNGTHAI_ADP_CODES
        : RcmFamilyPlanningService.NEW_ECLAIM_ADP_CODES
    const adpPlaceholders = adpCodes.map(() => '?').join(', ')

    const serviceOnly = Boolean(params.serviceOnly)
    const statusParam = (params.status || 'ALL').trim()
    const errorFilterParam = (params.errorFilter || 'ALL').trim()
    const cardFilter = params.cardFilter || 'ALL'
    const searchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy = params.sortBy || 'vstdate'
    const sortOrder = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fp-9-1-${format}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const [adpMapping, rawRows] = await Promise.all([
      RcmFamilyPlanningService.checkAdpMapping(format, executor),
      getCachedData(
        cacheKey,
        async () => {
          const sql = `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
              TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              s.cc,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              ptt.name AS pttypename,
              ptt.pttype_eclaim_id,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              IFNULL(dx.icd10, '') AS icd10,
              dx.op,
              IFNULL(v.income, 0) AS income,
              doc.name AS doctorname,
              IFNULL(fp.name, '') AS listname,
              d.drugname,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-::ยังไม่ได้ส่ง') AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
              rd.TransactionType,
              re.resource,
              COALESCE(rd.fund, re.fund) AS fund,
              COALESCE(rd.subfund, re.subfund) AS subfund,
              rd.remark,
              rd.projectcode
            FROM (
              SELECT DISTINCT vn FROM (
                SELECT vn 
                FROM ovstdiag 
                WHERE vstdate BETWEEN ? AND ? 
                  AND icd10 REGEXP 'Z30' 
                  AND icd10 <> 'Z302'
                UNION
                SELECT oo.vn
                FROM s_drugitems d
                JOIN opitemrece oo ON oo.icode = d.icode
                WHERE TRIM(d.nhso_adp_code) IN (${adpPlaceholders})
                  AND oo.vstdate BETWEEN ? AND ? 
                  AND IFNULL(oo.vn, '') <> ''
                UNION
                SELECT oo.vn
                FROM opitemrece oo
                JOIN s_drugitems d ON d.icode = oo.icode
                LEFT JOIN income inc ON inc.income = oo.income
                WHERE oo.vstdate BETWEEN ? AND ?
                  AND IFNULL(oo.vn, '') <> ''
                  AND (d.name REGEXP 'norplant|คุมกำเนิด' OR d.drugcategory REGEXP 'FP|CONTRACEPTIVE|CONTRACEPTION')
                  AND d.name NOT REGEXP 'condom|ถุงยางอนามัย'
                  AND inc.group2 IN (3, 4, 5)
                  AND oo.qty > 0
              ) u
            ) t
            JOIN ovst o ON o.vn = t.vn
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN opdscreen s ON s.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN doctor doc ON doc.code = o.doctor
            LEFT JOIN (
              SELECT 
                oo.vn,
                GROUP_CONCAT(DISTINCT CONCAT_WS(':', d.nhso_adp_code, CONCAT(d.name, ' ', IFNULL(d.strength, ''))) SEPARATOR ', ') AS name
              FROM s_drugitems d
              JOIN opitemrece oo ON oo.icode = d.icode
              WHERE TRIM(d.nhso_adp_code) IN (${adpPlaceholders})
                AND oo.vstdate BETWEEN ? AND ?
              GROUP BY oo.vn
            ) fp ON fp.vn = o.vn
            LEFT JOIN (
              SELECT 
                oo.vn,
                GROUP_CONCAT(DISTINCT CONCAT(d.name, '#', oo.qty) SEPARATOR ', ') AS drugname
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              LEFT JOIN income inc ON inc.income = oo.income
              WHERE oo.vstdate BETWEEN ? AND ?
                AND IFNULL(oo.vn, '') <> ''
                AND (d.name REGEXP 'norplant|คุมกำเนิด' OR d.drugcategory REGEXP 'FP|CONTRACEPTIVE|CONTRACEPTION')
                AND d.name NOT REGEXP 'condom|ถุงยางอนามัย'
                AND inc.group2 IN (3, 4, 5)
                AND oo.qty > 0
              GROUP BY oo.vn
            ) d ON d.vn = o.vn
            LEFT JOIN (
              SELECT vn,
                     GROUP_CONCAT(DISTINCT IF(icd10 REGEXP '^[0-9]', NULL, icd10) SEPARATOR ', ') AS icd10,
                     GROUP_CONCAT(DISTINCT IF(icd10 REGEXP '^697|^992', icd10, NULL) SEPARATOR ', ') AS op
              FROM ovstdiag
              WHERE vstdate BETWEEN ? AND ?
                AND (
                  (icd10 REGEXP 'Z30' AND icd10 <> 'Z302')
                  OR icd10 REGEXP '^697|^992'
                )
              GROUP BY vn
            ) dx ON dx.vn = o.vn
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype vt ON vt.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              GROUP BY vn
            ) rep ON rep.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN rcmdb.repdata rd ON rd.vn = o.vn
            LEFT JOIN rcmdb.repeclaim re ON re.vn = o.vn
            LEFT JOIN (
              SELECT m.opdseq AS vn,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                     SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
              FROM eclaimdb.m_registerdata m
              LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
              WHERE m.person_type = '1'
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            GROUP BY o.vn
            ORDER BY o.vstdate DESC, o.vsttime DESC
          `
          const queryParams = [
            ds1,
            ds2,
            ...adpCodes,
            ds1,
            ds2,
            ds1,
            ds2,
            ...adpCodes,
            ds1,
            ds2,
            ds1,
            ds2,
            ds1,
            ds2,
            ds1,
            ds2,
            ds1,
            ds2,
          ]
          return (await executor(sql, queryParams, { timeoutMs: 45000 })) as any[]
        },
        300000
      ),
    ])

    let allItems = (rawRows || []).map((r: any, idx: number) => {
      const listname = r.listname ? String(r.listname).trim() : null
      const drugname = r.drugname ? String(r.drugname).trim() : null
      const icd10 = r.icd10 ? String(r.icd10).trim() : null
      const op = r.op ? String(r.op).trim() : null
      const hasFp = Boolean(listname && listname.length > 0)
      const hasDx = Boolean(icd10 && icd10.length > 0)
      const hasDrug = Boolean(drugname && drugname.length > 0)
      const errorname = evaluateFamilyPlanningDiscrepancy(hasFp, hasDx, hasDrug, listname, op)
      const hasError = Boolean(errorname)
      const hasService = hasFp
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const hasAuthen = Boolean(authencode && authencode.length > 0)
      const compensated = Number(r.compensated || 0)
      const pttypeEclaimId = r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null
      const isUc = isUcEclaimCode(pttypeEclaimId)

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: String(r.sex || '—').trim(),
        age: r.age != null ? Number(r.age) : null,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || '00:00:00'),
        cc: r.cc ? String(r.cc).trim() : null,
        authencode,
        pttypename: r.pttypename ? String(r.pttypename).trim() : null,
        pttype_eclaim_id: pttypeEclaimId,
        isUc,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 || null,
        dx1: r.dx1 || null,
        dx2: r.dx2 || null,
        dx3: r.dx3 || null,
        dx4: r.dx4 || null,
        dx5: r.dx5 || null,
        op0: r.op0 || null,
        op1: r.op1 || null,
        op2: r.op2 || null,
        op3: r.op3 || null,
        op4: r.op4 || null,
        op5: r.op5 || null,
        icd10,
        diag: icd10,
        op,
        oper: op,
        income: Number(r.income || 0),
        doctorname: r.doctorname ? String(r.doctorname).trim() : null,
        listname,
        drugname,
        status: String(r.status || '-::ยังไม่ได้ส่ง').trim(),
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        errorname,
        fund: r.fund || null,
        subfund: r.subfund || null,
        hasService,
        hasAuthen,
        hasError,
      }
    })

    // Dual-mode pttype filter (pttypes takes precedence over ucOnly)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, executor, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i: any) => matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id))
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i: any) => i.isUc)
    }

    const totalVisits = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i: any) => i.hn)).size
    const serviceOnlyCount = summaryCohort.filter((i: any) => i.hasService).length
    const compensatedVisits = summaryCohort.filter((i: any) => i.compensated > 0).length
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const totalCompensated = summaryCohort.reduce((acc: number, i: any) => acc + i.compensated, 0)
    const totalIncome = summaryCohort.reduce((acc: number, i: any) => acc + i.income, 0)
    const errorCount = summaryCohort.filter((i: any) => i.hasError).length
    const authenCount = summaryCohort.filter((i: any) => i.hasAuthen).length
    const noAuthenCount = totalVisits - authenCount
    const withDxCount = summaryCohort.filter((i: any) => Boolean(i.icd10)).length
    const withDrugCount = summaryCohort.filter((i: any) => Boolean(i.drugname)).length

    const summary = {
      totalVisits,
      uniquePatients,
      serviceOnlyCount,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated:
        compensatedVisits > 0 ? Math.round(totalCompensated / compensatedVisits) : 0,
      errorCount,
      authenCount,
      noAuthenCount,
      withDxCount,
      withDrugCount,
      totalIncome,
    }

    let filtered = summaryCohort
    if (serviceOnly) {
      filtered = filtered.filter((i: any) => i.hasService)
    }
    if (statusParam && statusParam !== 'ALL' && statusParam !== 'ทั้งหมด') {
      filtered = filtered.filter((i: any) => i.status === statusParam)
    }
    if (errorFilterParam && errorFilterParam !== 'ALL') {
      if (errorFilterParam === 'HAS_ERROR') {
        filtered = filtered.filter((i: any) => i.hasError)
      } else if (errorFilterParam === 'NO_ERROR') {
        filtered = filtered.filter((i: any) => !i.hasError)
      } else {
        filtered = filtered.filter((i: any) => i.errorname === errorFilterParam)
      }
    }
    if (cardFilter === 'SERVICE_ONLY') {
      filtered = filtered.filter((i: any) => i.hasService)
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i: any) => i.compensated > 0)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i: any) => i.compensated <= 0)
    } else if (cardFilter === 'HAS_ERROR') {
      filtered = filtered.filter((i: any) => i.hasError)
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i: any) => !i.hasAuthen)
    }

    if (search.length > 0) {
      filtered = filtered.filter(
        (i: any) =>
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.drugname && i.drugname.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search)) ||
          (i.errorname && i.errorname.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.icd10 && i.icd10.toLowerCase().includes(search)) ||
          (i.doctorname && i.doctorname.toLowerCase().includes(search)) ||
          (i.pttypename && i.pttypename.toLowerCase().includes(search))
      )
    }

    // Apply Sorting
    filtered.sort((a: any, b: any) => {
      let valA: string | number = a[sortBy] ?? ''
      let valB: string | number = b[sortBy] ?? ''

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const items = exportAll
      ? filtered.map((item: any, idx: number) => ({ ...item, no: idx + 1 }))
      : filtered
          .slice((page - 1) * pageSize, page * pageSize)
          .map((item: any, idx: number) => ({ ...item, no: (page - 1) * pageSize + idx + 1 }))

    return {
      ds1,
      ds2,
      format,
      serviceOnly,
      status: statusParam,
      cardFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      adpMapping,
      statusOptions: Array.from(new Set(allItems.map((i: any) => i.status))).sort(),
      errorOptions: Array.from(
        new Set(allItems.map((i: any) => i.errorname).filter(Boolean) as string[])
      ).sort(),
      totalCount,
      page,
      pageSize,
      totalPages,
      items,
    }
  }

  /**
   * 9.3 Family Planning (ฝังยาคุม / ถอดยาคุม) report implementation.
   */
  static async getFamilyPlanning93Report(
    params: FamilyPlanningReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<FamilyPlanningReportResult> {
    const reportType: FamilyPlanningReportType = params.reportType || '9.3.1'
    const patientType: FamilyPlanningPatientType = params.patientType === 'IPD' ? 'IPD' : 'OPD'
    const adpCode = getAdpCodeForReport(reportType)
    const expectedDx = getExpectedDxForReport(reportType)

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: FamilyPlanningCardFilter = params.cardFilter || 'ALL'
    const searchField: FamilyPlanningSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: FamilyPlanningSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fp-report-${reportType}-${patientType}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-fp-adp-mapping-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        let rows: Record<string, unknown>[] = []
        let mappingRes: FamilyPlanningAdpMappingCheck = {
          isMapped: false,
          mappedCount: 0,
          adpCode,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              RcmFamilyPlanningService.checkFamilyPlanningAdpMapping(adpCode, executor),
              apiGateway.clinical.getRcmFundData('family-planning', { ds1, ds2, adpCode, patientType, expectedDx }),
            ])
            mappingRes = mRes
            if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows) && gwRes.data.rawRows.length > 0) {
              rows = gwRes.data.rawRows
              fetchedViaNamedApi = true
            }
          } catch {
            // Fallback
          }
        }

        if (!fetchedViaNamedApi) {
          const [mRes, dbRows] = await Promise.all([
            RcmFamilyPlanningService.checkFamilyPlanningAdpMapping(adpCode, executor),
            patientType === 'IPD'
              ? RcmFamilyPlanningService.queryIpdRows(ds1, ds2, adpCode, executor, expectedDx)
              : RcmFamilyPlanningService.queryOpdRows(ds1, ds2, adpCode, executor, expectedDx),
          ])
          rows = (dbRows || []) as Record<string, unknown>[]
          mappingRes = mRes
        }

        return { rawRows: rows, adpMapping: mappingRes }
      },
      300000 // Cache TTL 5 minutes
    )

    // Separate and filter cases according to the specific objective of each report:
    // - 9.3.1 / 9.3.1.1 (Implant Insertion): Exclude cases that only received removal service (FP002_2 / 71691) without insertion
    // - 9.3.2 / 9.3.1.2 (Implant Removal): Exclude cases that only received insertion service (FP002_1 / FP002 / 20004) without removal
    const isInsertionReport =
      reportType === '9.3.1' || reportType === '9.3.1.1' || adpCode === 'FP002_1'
    const isRemovalReport =
      reportType === '9.3.2' || reportType === '9.3.1.2' || adpCode === 'FP002_2'

    const targetRows = rawRows.filter((r) => {
      const adpStr = [
        String(r.all_adp_codes || ''),
        String(r.adp_list || ''),
        String(r.adpcode || ''),
        String(r.drug || ''),
      ]
        .join(',')
        .toUpperCase()

      const drugStr = String(r.drug || '')
      const isRemovalDrug = /ถอด/i.test(drugStr)
      const isInsertionDrug =
        /implanon|norplant|jadelle|etonogestrel/i.test(drugStr) ||
        (/ฝัง/i.test(drugStr) && !isRemovalDrug)

      const hasInsertionItem =
        /FP002_1|FP002\b|20004/i.test(adpStr) || isInsertionDrug
      const hasRemovalItem =
        /FP002_2|71691/i.test(adpStr) || isRemovalDrug

      if (isInsertionReport) {
        if (hasRemovalItem && !hasInsertionItem) {
          return false
        }
      } else if (isRemovalReport) {
        if (hasInsertionItem && !hasRemovalItem) {
          return false
        }
      }
      return true
    })

    // Map target rows into strongly typed domain items with validation
    let allItems: FamilyPlanningItem[] = targetRows.map((r, idx) => {
      const moneyEclaim = Number(r.money_eclaim || 0)
      const moneyRep = Number(r.money_rep || 0)
      const moneyInvoice = Number(r.money_invoice || 0)
      const compensatedVal = Number(r.compensated || 0)
      const compensated =
        moneyInvoice > 0
          ? moneyInvoice
          : moneyRep > 0
          ? moneyRep
          : moneyEclaim > 0
          ? moneyEclaim
          : compensatedVal
      const isCompensated =
        moneyInvoice > 0 ||
        moneyRep > 0 ||
        compensatedVal > 0 ||
        (Boolean(r.status) && String(r.status).toLowerCase().includes('rep')) ||
        (Boolean(r.rep) && String(r.rep).trim() !== '' && String(r.rep).trim() !== 'null')

      const rawDx = r.dx ?? r.pdx ?? (r.icd10 ? String(r.icd10) : null)
      const dx = rawDx ? String(rawDx).trim() : null
      const rawOp = r.op ?? r.op0 ?? (r.oper ? String(r.oper) : null)
      const op = rawOp ? String(rawOp).trim() : null
      const rawDrug = r.drug ?? r.listname ?? r.drugname
      const drug = rawDrug ? String(rawDrug).trim() : null
      const rawClaimCode = r.claimcode ?? r.authencode
      const claimcode = rawClaimCode ? String(rawClaimCode).trim() : null

      // FoxPro Validation Rules:
      // if(dx regexp '<<expectedDx>>', null, 'ไม่พบ Dx <<expectedDx>>') ErrorDx
      // if(drug<>'', null, 'ไม่พบค่าบริการ') ErrorDrug
      const hasExpectedDx = dx ? new RegExp(expectedDx, 'i').test(dx) : false
      const errorDx = hasExpectedDx ? null : `ไม่พบ Dx ${expectedDx}`
      const errorDrug = drug && drug.length > 0 ? null : 'ไม่พบค่าบริการ'
      const hasError = Boolean(errorDx || errorDrug)

      let rep = r.rep ? String(r.rep).trim() : null
      if (rep === '' || rep === 'null') rep = null

      let status = String(r.status || '').trim()
      if (!status) {
        status = '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
      }

      const rawSex = r.sex ?? (r.sex_code === '1' ? 'ชาย' : r.sex_code === '2' ? 'หญิง' : '—')
      const sex = String(rawSex || '—').trim()

      const pttypename = String(r.pttypename || '—').trim()
      const pttype_eclaim_id = r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null
      const isUc =
        typeof r.isUc === 'boolean'
          ? r.isUc
          : isUcEclaimCode(pttype_eclaim_id) || r.maininscl === 'UCS'

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex,
        age: Number(r.age || 0),
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || '00:00:00'),
        admdate: r.admdate ? String(r.admdate).trim() : null,
        dchdate: r.dchdate ? String(r.dchdate).trim() : null,
        pttypename,
        pttype_eclaim_id,
        isUc,
        claimcode,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        cc: r.cc ? String(r.cc).trim() : null,
        income: Number(r.income || 0),
        dx,
        op,
        drug,
        money_eclaim: moneyEclaim,
        money_rep: moneyRep,
        money_invoice: moneyInvoice,
        compensated,
        isCompensated,
        errorDx,
        errorDrug,
        hasError,
        rep,
        status,
        patientType,
        reportType,
      }
    })

    // Dual-mode pttype filter (pttypes takes precedence over ucOnly)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, executor, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) => matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id))
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Overall Summary Metrics (across summaryCohort before card filtering)
    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn).filter(Boolean)).size
    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const eclaimSentCases = summaryCohort.filter(
      (i) => !i.isCompensated && !i.status.includes('ยังไม่ส่ง')
    ).length
    const unsentCases = summaryCohort.filter((i) => i.status.includes('ยังไม่ส่ง')).length
    const compensationRate =
      totalCases > 0 ? Number(((compensatedCases / totalCases) * 100).toFixed(1)) : 0
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)
    const errorDxCount = summaryCohort.filter((i) => Boolean(i.errorDx)).length
    const errorDrugCount = summaryCohort.filter((i) => Boolean(i.errorDrug)).length
    const hasErrorCount = summaryCohort.filter((i) => i.hasError).length
    const withAuthenCount = summaryCohort.filter((i) => Boolean(i.claimcode)).length
    const withoutAuthenCount = totalCases - withAuthenCount
    const authenRate =
      totalCases > 0 ? Number(((withAuthenCount / totalCases) * 100).toFixed(1)) : 0

    const summary: FamilyPlanningSummary = {
      totalCases,
      uniquePatients,
      compensatedCases,
      eclaimSentCases,
      unsentCases,
      compensationRate,
      totalCompensated,
      totalIncome,
      errorDxCount,
      errorDrugCount,
      hasErrorCount,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
    }

    // Apply Interactive Card Filter
    let filteredItems = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filteredItems = filteredItems.filter((i) => i.isCompensated)
    } else if (cardFilter === 'ECLAIM_SENT') {
      filteredItems = filteredItems.filter(
        (i) => !i.isCompensated && !i.status.includes('ยังไม่ส่ง')
      )
    } else if (cardFilter === 'UNSENT') {
      filteredItems = filteredItems.filter((i) => i.status.includes('ยังไม่ส่ง'))
    } else if (cardFilter === 'ERROR_DX') {
      filteredItems = filteredItems.filter((i) => Boolean(i.errorDx))
    } else if (cardFilter === 'ERROR_DRUG') {
      filteredItems = filteredItems.filter((i) => Boolean(i.errorDrug))
    } else if (cardFilter === 'HAS_ERROR') {
      filteredItems = filteredItems.filter((i) => i.hasError)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filteredItems = filteredItems.filter((i) => Boolean(i.claimcode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filteredItems = filteredItems.filter((i) => !i.claimcode)
    }

    // Apply Search Filter
    if (search) {
      filteredItems = filteredItems.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') {
          return item.vn.toLowerCase().includes(search) || (item.an && item.an.toLowerCase().includes(search))
        }
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)
        if (searchField === 'DEPARTMENT') {
          return (
            (item.department || '').toLowerCase().includes(search) ||
            (item.clinic || '').toLowerCase().includes(search)
          )
        }
        if (searchField === 'CLINIC') return (item.clinic || '').toLowerCase().includes(search)
        if (searchField === 'DX') return (item.dx || '').toLowerCase().includes(search)
        if (searchField === 'DRUG') return (item.drug || '').toLowerCase().includes(search)

        // Default 'ALL'
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.an && item.an.toLowerCase().includes(search)) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.department || '').toLowerCase().includes(search) ||
          (item.clinic || '').toLowerCase().includes(search) ||
          (item.dx || '').toLowerCase().includes(search) ||
          (item.drug || '').toLowerCase().includes(search) ||
          (item.rep || '').toLowerCase().includes(search) ||
          item.status.toLowerCase().includes(search)
        )
      })
    }

    // Apply Sorting
    filteredItems.sort((a, b) => {
      let valA: string | number = a[sortBy] ?? ''
      let valB: string | number = b[sortBy] ?? ''

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index row numbers
    filteredItems.forEach((item, index) => {
      item.no = index + 1
    })

    const totalCount = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pagedItems = filteredItems
    if (!exportAll) {
      const startIndex = (page - 1) * pageSize
      pagedItems = filteredItems.slice(startIndex, startIndex + pageSize)
    }

    return {
      ds1,
      ds2,
      reportType,
      patientType,
      adpCode,
      adpMapping,
      cardFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: pagedItems,
    }
  }

  /**
   * Execute OPD SQL Query for Family Planning (9.3.1 / 9.3.2).
   */
  private static async queryOpdRows(
    ds1: string,
    ds2: string,
    adpCode: string,
    executor: QueryExecutor,
    expectedDx: string = 'Z308'
  ): Promise<any[]> {
    try {
      const adpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      const sql = `
        SELECT 
          o.vn,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS claimcode,
          dep.department AS department,
          spc.name AS clinic,
          s.cc AS cc,
          IFNULL(v.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${adpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          COALESCE(e.income, 0) AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(n.rep, r.rep, IF(m.status = '4', m.rep, NULL), '') AS rep,
          CASE
            WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT vn FROM (
            SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND icd10 REGEXP ?
            UNION
            SELECT oo.vn 
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND IFNULL(oo.vn, '') <> ''
              AND ${adpMatchExpr}
          ) u
        ) t
        JOIN ovst o ON o.vn = t.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN opitemrece oo ON oo.vn = o.vn
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
        LEFT JOIN visit_pttype vt ON vt.vn = o.vn
        LEFT JOIN (
          SELECT e.opdseq AS vn,
                 SUM(COALESCE(cc.totpay1, 0)) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '1'
            AND e.dateadm BETWEEN ? AND ?
            AND (cc.code LIKE ? OR cc.code LIKE 'FP003%' OR cc.code LIKE 'FP002%')
          GROUP BY e.opdseq
        ) e ON e.vn = o.vn
        LEFT JOIN (
          SELECT vn,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'OP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'OP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY vn
        ) n ON n.vn = o.vn
        LEFT JOIN (
          SELECT m.opdseq AS vn,
                 MAX(m.eclaim_no) AS eclaim_no,
                 SUBSTRING_INDEX(GROUP_CONCAT(IF(m.status = '4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '1'
            AND m.opdseq IS NOT NULL
            AND m.dateadm BETWEEN ? AND ?
          GROUP BY m.opdseq
        ) m ON m.vn = o.vn
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `

      const codePattern = `${adpCode}%`
      return await executor(
        sql,
        [adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode, ds1, ds2, codePattern, ds1, ds2],
        { timeoutMs: 90000 }
      )
    } catch (primaryErr) {
      const adpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      // Graceful fallback without eclaimdb/rcmdb joins if cross-db schemas differ
      const fallbackSql = `
        SELECT 
          o.vn,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          NULL AS claimcode,
          dep.department AS department,
          spc.name AS clinic,
          s.cc AS cc,
          IFNULL(v.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${adpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT DISTINCT vn FROM (
            SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND icd10 REGEXP ?
            UNION
            SELECT oo.vn 
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND IFNULL(oo.vn, '') <> ''
              AND ${adpMatchExpr}
          ) u
        ) t
        JOIN ovst o ON o.vn = t.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN opitemrece oo ON oo.vn = o.vn
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `
      return await executor(fallbackSql, [adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode], { timeoutMs: 60000 })
    }
  }

  /**
   * Execute IPD SQL Query for Family Planning (9.3.1 / 9.3.2).
   */
  private static async queryIpdRows(
    ds1: string,
    ds2: string,
    adpCode: string,
    executor: QueryExecutor,
    expectedDx: string = 'Z308'
  ): Promise<any[]> {
    try {
      const ipdAdpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_1' AND TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_2' AND TRIM(d.nhso_adp_code) = '71691')`
          : `(TRIM(d.nhso_adp_code) = ? OR (? IN ('FP003_1', 'FP003_2', 'FP003_3', 'FP003_4') AND TRIM(d.nhso_adp_code) IN ('20003','71681','71682','FP003_1','FP003_2','FP003_3','FP003_4')))`

      const ipdSubqueryAdpExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      const sql = `
        SELECT 
          i.an AS vn,
          i.an,
          IFNULL(pt.cid, '') AS cid,
          i.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS claimcode,
          w.name AS department,
          spc.name AS clinic,
          '' AS cc,
          IFNULL(a.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${ipdAdpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          COALESCE(e.income, 0) AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(n.rep, r.rep, IF(m.status = '4', m.rep, NULL), '') AS rep,
          CASE
            WHEN n.an IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.an IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT an FROM (
            SELECT i.an FROM ipt i JOIN iptdiag dx ON dx.an = i.an WHERE i.dchdate BETWEEN ? AND ? AND dx.icd10 REGEXP ?
            UNION
            SELECT oo.an 
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND IFNULL(oo.an, '') <> ''
              AND ${ipdSubqueryAdpExpr}
          ) u
        ) t
        JOIN ipt i ON i.an = t.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN spclty spc ON spc.spclty = i.spclty
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN iptdiag dx ON dx.an = i.an
        LEFT JOIN iptoprt op ON op.an = i.an
        LEFT JOIN opitemrece oo ON oo.an = i.an
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN rcmdb.authencode cc ON cc.vn = i.an
        LEFT JOIN visit_pttype vt ON vt.vn = i.an
        LEFT JOIN (
          SELECT e.an,
                 SUM(COALESCE(cc.totpay1, 0)) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '2'
            AND e.datedsc BETWEEN ? AND ?
            AND (cc.code LIKE ? OR cc.code LIKE 'FP003%' OR cc.code LIKE 'FP002%' OR cc.code LIKE 'FP001%')
          GROUP BY e.an
        ) e ON e.an = i.an
        LEFT JOIN (
          SELECT an,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'IP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY an
        ) r ON r.an = i.an
        LEFT JOIN (
          SELECT an,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'IP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY an
        ) n ON n.an = i.an
        LEFT JOIN (
          SELECT m.an,
                 MAX(m.eclaim_no) AS eclaim_no,
                 SUBSTRING_INDEX(GROUP_CONCAT(IF(m.status = '4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '2'
            AND m.an IS NOT NULL
            AND m.datedsc BETWEEN ? AND ?
          GROUP BY m.an
        ) m ON m.an = i.an
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        GROUP BY i.an
        ORDER BY i.dchdate DESC, i.regdate DESC;
      `

      const codePattern = `${adpCode}%`
      return await executor(
        sql,
        [adpCode, adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode, ds1, ds2, codePattern, ds1, ds2],
        { timeoutMs: 90000 }
      )
    } catch (primaryErr) {
      const ipdAdpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_1' AND TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_2' AND TRIM(d.nhso_adp_code) = '71691')`
          : `(TRIM(d.nhso_adp_code) = ? OR (? IN ('FP003_1', 'FP003_2', 'FP003_3', 'FP003_4') AND TRIM(d.nhso_adp_code) IN ('20003','71681','71682','FP003_1','FP003_2','FP003_3','FP003_4')))`

      const ipdSubqueryAdpExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      // Fallback without cross-db joins
      const fallbackSql = `
        SELECT 
          i.an AS vn,
          i.an,
          IFNULL(pt.cid, '') AS cid,
          i.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          NULL AS claimcode,
          w.name AS department,
          spc.name AS clinic,
          '' AS cc,
          IFNULL(a.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${ipdAdpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT DISTINCT an FROM (
            SELECT i.an FROM ipt i JOIN iptdiag dx ON dx.an = i.an WHERE i.dchdate BETWEEN ? AND ? AND dx.icd10 REGEXP ?
            UNION
            SELECT oo.an 
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND IFNULL(oo.an, '') <> ''
              AND ${ipdSubqueryAdpExpr}
          ) u
        ) t
        JOIN ipt i ON i.an = t.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN spclty spc ON spc.spclty = i.spclty
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN iptdiag dx ON dx.an = i.an
        LEFT JOIN iptoprt op ON op.an = i.an
        LEFT JOIN opitemrece oo ON oo.an = i.an
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        GROUP BY i.an
        ORDER BY i.dchdate DESC, i.regdate DESC;
      `
      return await executor(fallbackSql, [adpCode, adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode], { timeoutMs: 60000 })
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ── 9.2 บริการใส่ห่วงอนามัย (IUD Insertion Service) ──────────────────────────
  // ═════════════════════════════════════════════════════════════════════════════

  /**
   * NHSO ADP codes for 9.2 บริการใส่ห่วงอนามัย:
   * '20003,FP001,71681,71682'
   */
  static readonly IUD_ADP_CODES = ['20003', 'FP001', '71681', '71682']

  /**
   * Check whether NHSO ADP codes for IUD insertion are mapped in HOSxP `s_drugitems` table.
   * Mirrors legacy check:
   * SELECT COUNT(*) FROM s_drugitems WHERE nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
   */
  static async checkIudAdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IudAdpMappingCheck> {
    const cacheKey = 'rcm-fp-9-2-iud-adp-mapping'
    return getCachedData(
      cacheKey,
      async () => {
        try {
          const sql = `
            SELECT 
              icode, 
              name, 
              strength, 
              nhso_adp_code
            FROM s_drugitems 
            WHERE TRIM(nhso_adp_code) IN (?, ?, ?, ?)
            ORDER BY nhso_adp_code ASC, icode ASC;
          `
          const rows = (await executor(sql, RcmFamilyPlanningService.IUD_ADP_CODES, {
            timeoutMs: 15000,
          })) as any[]
          const items: FamilyPlanningAdpMappingItem[] = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))

          return {
            isMapped: items.length > 0,
            mappedCount: items.length,
            adpCodes: RcmFamilyPlanningService.IUD_ADP_CODES,
            items,
          }
        } catch {
          return {
            isMapped: false,
            mappedCount: 0,
            adpCodes: RcmFamilyPlanningService.IUD_ADP_CODES,
            items: [],
          }
        }
      },
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate 9.2 บริการใส่ห่วงอนามัย (IUD Insertion Service) Report.
   * Full high-fidelity implementation of the FoxPro ledger queries:
   * - ADP codes: '20003', 'FP001', '71681', '71682'
   * - Supports OPD (ovst, ovstdiag, opitemrece) and IPD (ipt, iptdiag, iptoprt, opitemrece)
   * - Cross-reconciliation with E-Claim, RCM repdata, repeclaim, authencode
   * - Validation: ErrorDx (Z301), ErrorOp (697), ErrorDrug (ADP drug item)
   */
  static async getIudReport(
    params: IudReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IudReportResult> {
    const patientType: IudPatientType = params.patientType === 'IPD' ? 'IPD' : 'OPD'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: IudCardFilter = params.cardFilter || 'ALL'
    const searchField: IudSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: IudSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fp-9-2-iud-${patientType}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-fp-9-2-iud-adp-mapping')
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          RcmFamilyPlanningService.checkIudAdpMapping(executor),
          patientType === 'IPD'
            ? RcmFamilyPlanningService.queryIudIpdRows(ds1, ds2, executor)
            : RcmFamilyPlanningService.queryIudOpdRows(ds1, ds2, executor),
        ])

        return { rawRows: (rows || []) as Record<string, unknown>[], adpMapping: mappingRes }
      },
      300000 // Cache TTL 5 minutes
    )

    // Map raw rows into strongly typed IudItem records with validation rules
    let allItems: IudItem[] = rawRows.map((r, idx) => {
      const moneyEclaim = Number(r.money_eclaim || 0)
      const moneyRep = Number(r.money_rep || 0)
      const moneyInvoice = Number(r.money_invoice || 0)
      const compensated = moneyInvoice > 0 ? moneyInvoice : moneyRep > 0 ? moneyRep : moneyEclaim
      const isCompensated = moneyInvoice > 0 || moneyRep > 0

      const dx = r.dx ? String(r.dx).trim() : null
      const op = r.op ? String(r.op).trim() : null
      const drug = r.drug ? String(r.drug).trim() : null

      // FoxPro Validation Rules for 9.2:
      // if(dx regexp 'Z301', null, 'ไม่พบ Dx Z301') ErrorDx
      // if(op regexp '697', null, 'ไม่พบ Op 697') ErrorOp
      // if(drug<>'', null, 'ไม่พบค่าบริการ') ErrorDrug
      const hasZ301 = dx ? /Z301/i.test(dx) : false
      const errorDx = hasZ301 ? null : 'ไม่พบ Dx Z301'

      const hasOp697 = op ? /(^|[^0-9])697([^0-9]|$)/.test(op) || op.includes('697') : false
      const errorOp = hasOp697 ? null : 'ไม่พบ Op 697'

      const errorDrug = drug && drug.length > 0 ? null : 'ไม่พบค่าบริการ'
      const hasError = Boolean(errorDx || errorOp || errorDrug)

      let rep = r.rep ? String(r.rep).trim() : null
      if (rep === '' || rep === 'null') rep = null

      let status = String(r.status || '').trim()
      if (!status) {
        status = '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
      }

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: String(r.sex || '—').trim(),
        age: Number(r.age || 0),
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || '00:00:00'),
        admdate: r.admdate ? String(r.admdate).trim() : null,
        dchdate: r.dchdate ? String(r.dchdate).trim() : null,
        pttypename: String(r.pttypename || '—').trim(),
        pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
        isUc: isUcEclaimCode(r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null),
        claimcode: r.claimcode ? String(r.claimcode).trim() : null,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        cc: r.cc ? String(r.cc).trim() : null,
        income: Number(r.income || 0),
        dx,
        op,
        drug,
        money_eclaim: moneyEclaim,
        money_rep: moneyRep,
        money_invoice: moneyInvoice,
        compensated,
        isCompensated,
        errorDx,
        errorOp,
        errorDrug,
        hasError,
        rep,
        status,
        patientType,
      }
    })

    // Dual-mode pttype filter (pttypes takes precedence over ucOnly)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, executor, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) => matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id))
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Summary KPIs across summaryCohort (before card filtering)
    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const eclaimSentCases = summaryCohort.filter(
      (i) => i.status !== '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
    ).length
    const unsentCases = totalCases - eclaimSentCases
    const compensationRate =
      totalCases > 0 ? Number(((compensatedCases / totalCases) * 100).toFixed(1)) : 0

    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)
    const totalMoneyEclaim = summaryCohort.reduce((acc, i) => acc + i.money_eclaim, 0)
    const totalMoneyRep = summaryCohort.reduce((acc, i) => acc + i.money_rep, 0)
    const totalMoneyInvoice = summaryCohort.reduce((acc, i) => acc + i.money_invoice, 0)

    const errorDxCount = summaryCohort.filter((i) => Boolean(i.errorDx)).length
    const errorOpCount = summaryCohort.filter((i) => Boolean(i.errorOp)).length
    const errorDrugCount = summaryCohort.filter((i) => Boolean(i.errorDrug)).length
    const hasErrorCount = summaryCohort.filter((i) => i.hasError).length
    const completeCount = summaryCohort.filter((i) => !i.hasError).length

    const withAuthenCount = summaryCohort.filter((i) => Boolean(i.claimcode)).length
    const withoutAuthenCount = totalCases - withAuthenCount
    const authenRate =
      totalCases > 0 ? Number(((withAuthenCount / totalCases) * 100).toFixed(1)) : 0

    const summary: IudSummary = {
      totalCases,
      uniquePatients,
      compensatedCases,
      uncompensatedCases,
      eclaimSentCases,
      unsentCases,
      compensationRate,
      totalCompensated,
      totalIncome,
      totalMoneyEclaim,
      totalMoneyRep,
      totalMoneyInvoice,
      errorDxCount,
      errorOpCount,
      errorDrugCount,
      hasErrorCount,
      completeCount,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
    }

    // Apply Card Filter
    let filteredItems = summaryCohort.filter((item) => {
      switch (cardFilter) {
        case 'COMPENSATED':
          return item.isCompensated
        case 'UNCOMPENSATED':
          return !item.isCompensated
        case 'ECLAIM_SENT':
          return item.status !== '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
        case 'UNSENT':
          return item.status === '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
        case 'COMPLETE':
          return !item.hasError
        case 'HAS_ERROR':
          return item.hasError
        case 'ERROR_DX':
          return Boolean(item.errorDx)
        case 'ERROR_OP':
          return Boolean(item.errorOp)
        case 'ERROR_DRUG':
          return Boolean(item.errorDrug)
        case 'WITH_AUTHEN':
          return Boolean(item.claimcode)
        case 'NO_AUTHEN':
          return !item.claimcode
        case 'ALL':
        default:
          return true
      }
    })

    // Apply Search Filter
    if (search.length > 0) {
      filteredItems = filteredItems.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') {
          return item.vn.toLowerCase().includes(search) || (item.an && item.an.toLowerCase().includes(search))
        }
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)
        if (searchField === 'DEPARTMENT') return (item.department || '').toLowerCase().includes(search)
        if (searchField === 'CLINIC') return (item.clinic || '').toLowerCase().includes(search)
        if (searchField === 'DX') return (item.dx || '').toLowerCase().includes(search)
        if (searchField === 'OP') return (item.op || '').toLowerCase().includes(search)
        if (searchField === 'DRUG') return (item.drug || '').toLowerCase().includes(search)
        if (searchField === 'REP') return (item.rep || '').toLowerCase().includes(search)

        // Default 'ALL'
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.an && item.an.toLowerCase().includes(search)) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.department || '').toLowerCase().includes(search) ||
          (item.clinic || '').toLowerCase().includes(search) ||
          (item.dx || '').toLowerCase().includes(search) ||
          (item.op || '').toLowerCase().includes(search) ||
          (item.drug || '').toLowerCase().includes(search) ||
          (item.rep || '').toLowerCase().includes(search) ||
          item.status.toLowerCase().includes(search)
        )
      })
    }

    // Apply Sorting
    filteredItems.sort((a, b) => {
      let valA: string | number = a[sortBy] ?? ''
      let valB: string | number = b[sortBy] ?? ''

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index row numbers
    filteredItems.forEach((item, index) => {
      item.no = index + 1
    })

    const totalCount = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pagedItems = filteredItems
    if (!exportAll) {
      const startIndex = (page - 1) * pageSize
      pagedItems = filteredItems.slice(startIndex, startIndex + pageSize)
    }

    return {
      ds1,
      ds2,
      patientType,
      adpCodes: RcmFamilyPlanningService.IUD_ADP_CODES,
      adpMapping,
      cardFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: pagedItems,
    }
  }

  /**
   * Execute OPD SQL Query for 9.2 บริการใส่ห่วงอนามัย.
   */
  private static async queryIudOpdRows(
    ds1: string,
    ds2: string,
    executor: QueryExecutor
  ): Promise<any[]> {
    try {
      const sql = `
        SELECT 
          o.vn,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(cc.AuthenCode, m.claimcode, '') AS claimcode,
          dep.department AS department,
          spc.name AS clinic,
          s.cc AS cc,
          IFNULL(v.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
          COALESCE(e.income, 0) AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(n.rep, r.rep, m.rep, '') AS rep,
          CASE 
            WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT vn FROM (
            SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND (icd10 REGEXP 'Z301' OR icd10 IN ('697'))
            UNION
            SELECT oo.vn 
            FROM opitemrece oo 
            JOIN s_drugitems d ON d.icode = oo.icode 
            WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> '' AND d.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
          ) u
        ) t
        JOIN ovst o ON o.vn = t.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN opitemrece oo ON oo.vn = o.vn
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'OP' AND (fpnhso > 0 OR pp > 0)
          GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'OP' AND (fpnhso > 0 OR pp > 0)
          GROUP BY vn
        ) n ON n.vn = o.vn
        LEFT JOIN (
          SELECT e.opdseq AS vn, SUM(cc.totpay1) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '1' AND cc.code LIKE 'FP001%'
          GROUP BY e.opdseq
        ) e ON e.vn = o.vn
        LEFT JOIN (
          SELECT m.opdseq AS vn,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.claimcode ORDER BY m.eclaim_no DESC), ',', 1) AS claimcode
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '1' AND IFNULL(m.opdseq, '') <> ''
          GROUP BY m.opdseq
        ) m ON m.vn = o.vn
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `

      return await executor(sql, [ds1, ds2, ds1, ds2], { timeoutMs: 90000 })
    } catch (primaryErr) {
      // Resilient fallback query in case cross-db tables are inaccessible
      const fallbackSql = `
        SELECT 
          o.vn,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          '' AS claimcode,
          dep.department AS department,
          spc.name AS clinic,
          s.cc AS cc,
          IFNULL(v.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT DISTINCT vn FROM (
            SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND (icd10 REGEXP 'Z301' OR icd10 IN ('697'))
            UNION
            SELECT oo.vn 
            FROM opitemrece oo 
            JOIN s_drugitems d ON d.icode = oo.icode 
            WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> '' AND d.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
          ) u
        ) t
        JOIN ovst o ON o.vn = t.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN opitemrece oo ON oo.vn = o.vn
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `
      return await executor(fallbackSql, [ds1, ds2, ds1, ds2], { timeoutMs: 60000 })
    }
  }

  /**
   * Execute IPD SQL Query for 9.2 บริการใส่ห่วงอนามัย.
   */
  private static async queryIudIpdRows(
    ds1: string,
    ds2: string,
    executor: QueryExecutor
  ): Promise<any[]> {
    try {
      const sql = `
        SELECT 
          i.an AS vn,
          i.an,
          IFNULL(pt.cid, '') AS cid,
          i.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(cc.AuthenCode, m.claimcode, '') AS claimcode,
          w.name AS department,
          spc.name AS clinic,
          '' AS cc,
          IFNULL(a.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
          COALESCE(e.income, 0) AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(n.rep, r.rep, m.rep, '') AS rep,
          CASE 
            WHEN n.an IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.an IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT an FROM (
            SELECT i2.an FROM ipt i2 JOIN iptdiag dx2 ON dx2.an = i2.an WHERE i2.dchdate BETWEEN ? AND ? AND dx2.icd10 REGEXP 'Z301'
            UNION
            SELECT i3.an FROM ipt i3 JOIN iptoprt op3 ON op3.an = i3.an WHERE i3.dchdate BETWEEN ? AND ? AND op3.icd9 IN ('697')
            UNION
            SELECT oo2.an 
            FROM opitemrece oo2 
            JOIN s_drugitems d2 ON d2.icode = oo2.icode 
            WHERE oo2.vstdate BETWEEN ? AND ? AND IFNULL(oo2.an, '') <> '' AND d2.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
          ) u
        ) t
        JOIN ipt i ON i.an = t.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN spclty spc ON spc.spclty = i.spclty
        LEFT JOIN iptdiag dx ON dx.an = i.an
        LEFT JOIN iptoprt op ON op.an = i.an
        LEFT JOIN opitemrece oo ON oo.an = i.an
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN rcmdb.authencode cc ON cc.vn = i.an
        LEFT JOIN (
          SELECT an, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'IP' AND (fpnhso > 0 OR pp > 0)
          GROUP BY an
        ) r ON r.an = i.an
        LEFT JOIN (
          SELECT an, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'IP' AND (fpnhso > 0 OR pp > 0)
          GROUP BY an
        ) n ON n.an = i.an
        LEFT JOIN (
          SELECT e.an, SUM(cc.totpay1) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '2' AND cc.code LIKE 'FP001%'
          GROUP BY e.an
        ) e ON e.an = i.an
        LEFT JOIN (
          SELECT m.an,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.claimcode ORDER BY m.eclaim_no DESC), ',', 1) AS claimcode
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '2' AND IFNULL(m.an, '') <> ''
          GROUP BY m.an
        ) m ON m.an = i.an
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        GROUP BY i.an
        ORDER BY i.dchdate DESC;
      `

      return await executor(sql, [ds1, ds2, ds1, ds2, ds1, ds2], { timeoutMs: 90000 })
    } catch (primaryErr) {
      // Resilient fallback query in case cross-db tables are inaccessible
      const fallbackSql = `
        SELECT 
          i.an AS vn,
          i.an,
          IFNULL(pt.cid, '') AS cid,
          i.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          '' AS claimcode,
          w.name AS department,
          spc.name AS clinic,
          '' AS cc,
          IFNULL(a.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT DISTINCT an FROM (
            SELECT i2.an FROM ipt i2 JOIN iptdiag dx2 ON dx2.an = i2.an WHERE i2.dchdate BETWEEN ? AND ? AND dx2.icd10 REGEXP 'Z301'
            UNION
            SELECT i3.an FROM ipt i3 JOIN iptoprt op3 ON op3.an = i3.an WHERE i3.dchdate BETWEEN ? AND ? AND op3.icd9 IN ('697')
            UNION
            SELECT oo2.an 
            FROM opitemrece oo2 
            JOIN s_drugitems d2 ON d2.icode = oo2.icode 
            WHERE oo2.vstdate BETWEEN ? AND ? AND IFNULL(oo2.an, '') <> '' AND d2.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
          ) u
        ) t
        JOIN ipt i ON i.an = t.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN spclty spc ON spc.spclty = i.spclty
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN iptdiag dx ON dx.an = i.an
        LEFT JOIN iptoprt op ON op.an = i.an
        LEFT JOIN opitemrece oo ON oo.an = i.an
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        GROUP BY i.an
        ORDER BY i.dchdate DESC;
      `
      return await executor(fallbackSql, [ds1, ds2, ds1, ds2, ds1, ds2], { timeoutMs: 60000 })
    }
  }

  // ── 9.3.2 บริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป ─────────────────────────

  /**
   * Check ADP code mapping for 9.3.2 (FP001, FP002 or 20003, 20004).
   */
  static async checkFamilyPlanning932AdpMapping(
    format: FamilyPlanning932Format = 'NEW_ECLAIM',
    executor: QueryExecutor = queryClinicalDb
  ): Promise<FamilyPlanning932AdpMappingCheck> {
    const adpCodes = format === 'KRUNGTHAI' ? ['20003', '20004'] : ['FP001', 'FP002']
    const cacheKey = `rcm-fp-932-adp-mapping-${format}`

    return await getCachedData(
      cacheKey,
      async () => {
        try {
          const placeholders = adpCodes.map(() => '?').join(', ')
          const sRows = await executor(
            `SELECT icode, name, strength, nhso_adp_code
             FROM s_drugitems
             WHERE nhso_adp_code IN (${placeholders})
             ORDER BY name ASC`,
            adpCodes,
            { timeoutMs: 15000 }
          )

          const ndRows = await executor(
            `SELECT icode, name, NULL AS strength, nhso_adp_code
             FROM nondrugitems
             WHERE nhso_adp_code IN (${placeholders})
             ORDER BY name ASC`,
            adpCodes,
            { timeoutMs: 15000 }
          )

          const combined = [...(sRows || []), ...(ndRows || [])]
          const uniqueItems = Array.from(
            new Map(combined.map((item: any) => [item.icode, item])).values()
          ) as FamilyPlanningAdpMappingItem[]

          return {
            isMapped: uniqueItems.length > 0,
            mappedCount: uniqueItems.length,
            adpCodes,
            items: uniqueItems,
          }
        } catch {
          return {
            isMapped: true,
            mappedCount: 0,
            adpCodes,
            items: [],
          }
        }
      },
      86400000
    )
  }

  /**
   * 9.3.2 บริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป report implementation.
   */
  static async getFamilyPlanning932Report(
    params: FamilyPlanning932Params = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<FamilyPlanning932ReportResult> {
    const format: FamilyPlanning932Format = params.format || 'NEW_ECLAIM'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: FamilyPlanning932CardFilter = params.cardFilter || 'ALL'
    const searchField: FamilyPlanning932SearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: FamilyPlanning932SortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fp-932-${format}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-fp-932-adp-mapping-${format}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          RcmFamilyPlanningService.checkFamilyPlanning932AdpMapping(format, executor),
          RcmFamilyPlanningService.queryFamilyPlanning932Rows(ds1, ds2, format, executor),
        ])
        return { rawRows: rows, adpMapping: mappingRes }
      },
      300000
    )

    let allItems: FamilyPlanning932Item[] = (rawRows || []).map((row: any, idx: number) => {
      const compensatedEclaim = Number(row.compensated_eclaim) || 0
      const compensatedRep = Number(row.compensated_rep) || 0
      const compensatedNhso = Number(row.compensated_nhso) || 0
      const compensated = compensatedNhso || compensatedRep || compensatedEclaim || 0
      const isCompensated = compensated > 0
      const authencode = row.authencode ? String(row.authencode).trim() : null
      const hasAuthen = Boolean(authencode)
      const drugname = row.drugname ? String(row.drugname).trim() : null
      const listname = row.listname ? String(row.listname).trim() : null
      const hasDrug = Boolean(drugname)
      const hasService = Boolean(listname)
      const dx = row.dx ? String(row.dx).trim() : null
      const op = row.op ? String(row.op).trim() : null

      let errorDetail: string | null = null
      if (!dx) {
        errorDetail = 'ไม่พบการลงรหัส Dx'
      } else if (!hasDrug && !hasService) {
        errorDetail = 'ไม่พบรายการยาหรือค่าบริการคุมกำเนิด'
      } else if (!hasAuthen) {
        errorDetail = 'ไม่มี Authen Code'
      }
      const hasError = Boolean(errorDetail)

      return {
        no: idx + 1,
        vn: String(row.vn || ''),
        an: row.an ? String(row.an) : null,
        cid: String(row.cid || ''),
        hn: String(row.hn || ''),
        ptname: String(row.ptname || ''),
        sex: row.sex === '2' || row.sex === 'หญิง' ? 'หญิง' : String(row.sex || ''),
        age: Number(row.age) || 0,
        vstdate: String(row.vstdate || ''),
        vsttime: row.vsttime ? String(row.vsttime) : undefined,
        authencode,
        department: row.department ? String(row.department) : null,
        clinic: row.clinic ? String(row.clinic) : null,
        pttypename: String(row.pttypename || ''),
        pttype_eclaim_id: row.pttype_eclaim_id ? String(row.pttype_eclaim_id).trim() : null,
        isUc: isUcEclaimCode(row.pttype_eclaim_id ? String(row.pttype_eclaim_id).trim() : null),
        drugname,
        listname,
        adpcode: row.adpcode ? String(row.adpcode) : null,
        income: Number(row.income) || 0,
        dx,
        op,
        status: String(row.status || '- :: ยังไม่ได้ส่ง'),
        rep_eclaim: row.rep_eclaim ? String(row.rep_eclaim) : null,
        rep_rep: row.rep_rep ? String(row.rep_rep) : null,
        rep_nhso: row.rep_nhso ? String(row.rep_nhso) : null,
        compensated_eclaim: compensatedEclaim,
        compensated_rep: compensatedRep,
        compensated_nhso: compensatedNhso,
        compensated,
        isCompensated,
        hasAuthen,
        hasDrug,
        hasService,
        hasError,
        errorDetail,
      }
    })

    // Dual-mode pttype filter (pttypes takes precedence over ucOnly)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, executor, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) => matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id))
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn).filter(Boolean)).size
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalCompensatedEclaim = summaryCohort.reduce((acc, i) => acc + i.compensated_eclaim, 0)
    const totalCompensatedRep = summaryCohort.reduce((acc, i) => acc + i.compensated_rep, 0)
    const totalCompensatedNhso = summaryCohort.reduce((acc, i) => acc + i.compensated_nhso, 0)
    const compensatedCount = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCount = totalCases - compensatedCount
    const compensationRate = totalCases > 0 ? (compensatedCount / totalCases) * 100 : 0
    const eclaimSentCount = summaryCohort.filter((i) => i.status && !i.status.includes('ยังไม่ได้ส่ง')).length
    const unsentCount = totalCases - eclaimSentCount
    const withAuthenCount = summaryCohort.filter((i) => i.hasAuthen).length
    const noAuthenCount = totalCases - withAuthenCount
    const authenRate = totalCases > 0 ? (withAuthenCount / totalCases) * 100 : 0
    const withDrugCount = summaryCohort.filter((i) => i.hasDrug).length
    const withServiceCount = summaryCohort.filter((i) => i.hasService).length
    const hasErrorCount = summaryCohort.filter((i) => i.hasError).length

    const summary: FamilyPlanning932Summary = {
      totalCases,
      uniquePatients,
      totalIncome,
      totalCompensated,
      totalCompensatedEclaim,
      totalCompensatedRep,
      totalCompensatedNhso,
      compensatedCount,
      uncompensatedCount,
      compensationRate: Math.round(compensationRate * 10) / 10,
      eclaimSentCount,
      unsentCount,
      withAuthenCount,
      noAuthenCount,
      authenRate: Math.round(authenRate * 10) / 10,
      withDrugCount,
      withServiceCount,
      hasErrorCount,
    }

    let filtered = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'ECLAIM_SENT') {
      filtered = filtered.filter((i) => i.status && !i.status.includes('ยังไม่ได้ส่ง'))
    } else if (cardFilter === 'UNSENT') {
      filtered = filtered.filter((i) => !i.status || i.status.includes('ยังไม่ได้ส่ง'))
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => i.hasAuthen)
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.hasAuthen)
    } else if (cardFilter === 'WITH_DRUG') {
      filtered = filtered.filter((i) => i.hasDrug)
    } else if (cardFilter === 'WITH_SERVICE') {
      filtered = filtered.filter((i) => i.hasService)
    } else if (cardFilter === 'HAS_ERROR') {
      filtered = filtered.filter((i) => i.hasError)
    }

    if (search) {
      filtered = filtered.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return item.vn.toLowerCase().includes(search)
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)
        if (searchField === 'DEPARTMENT') return (item.department || '').toLowerCase().includes(search)
        if (searchField === 'CLINIC') return (item.clinic || '').toLowerCase().includes(search)
        if (searchField === 'DX') return (item.dx || '').toLowerCase().includes(search)
        if (searchField === 'OP') return (item.op || '').toLowerCase().includes(search)
        if (searchField === 'DRUG') return (item.drugname || '').toLowerCase().includes(search)
        if (searchField === 'SERVICE') return (item.listname || '').toLowerCase().includes(search)
        if (searchField === 'ADP') return (item.adpcode || '').toLowerCase().includes(search)
        if (searchField === 'REP') {
          return (
            (item.rep_eclaim || '').toLowerCase().includes(search) ||
            (item.rep_rep || '').toLowerCase().includes(search) ||
            (item.rep_nhso || '').toLowerCase().includes(search)
          )
        }
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.department || '').toLowerCase().includes(search) ||
          (item.clinic || '').toLowerCase().includes(search) ||
          (item.dx || '').toLowerCase().includes(search) ||
          (item.op || '').toLowerCase().includes(search) ||
          (item.drugname || '').toLowerCase().includes(search) ||
          (item.listname || '').toLowerCase().includes(search) ||
          (item.adpcode || '').toLowerCase().includes(search) ||
          (item.authencode || '').toLowerCase().includes(search) ||
          (item.status || '').toLowerCase().includes(search)
        )
      })
    }

    filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]
      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB || '', 'th')
        return sortOrder === 'asc' ? comp : -comp
      }
      valA = Number(valA) || 0
      valB = Number(valB) || 0
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })

    filtered = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))

    const totalItems = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const paginatedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    return {
      ds1,
      ds2,
      format,
      cardFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      adpCodes: adpMapping.adpCodes,
      adpMapping,
      summary,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
      items: paginatedItems,
    }
  }

  /**
   * Execute SQL Query for Family Planning 9.3.2 (หญิงอายุ 20 ปีขึ้นไป).
   */
  private static async queryFamilyPlanning932Rows(
    ds1: string,
    ds2: string,
    format: FamilyPlanning932Format,
    executor: QueryExecutor
  ): Promise<any[]> {
    const adp1 = format === 'KRUNGTHAI' ? '20003' : 'FP001'
    const adp2 = format === 'KRUNGTHAI' ? '20004' : 'FP002'

    try {
      const sql = `
        SELECT 
          o.vn,
          IFNULL(o.an, '') AS an,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          COALESCE(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(cc2.auth_code), ''), NULLIF(TRIM(cc2.claim_code), ''), '') AS authencode,
          dep.department AS department,
          spc.name AS clinic,
          IFNULL(v.income, 0) AS income,
          drug_sub.drugname,
          drug_sub.drug_adp,
          fp_sub.listname,
          fp_sub.fp_adp,
          CONCAT_WS(',', NULLIF(drug_sub.drug_adp, ''), NULLIF(fp_sub.fp_adp, '')) AS adpcode,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          COALESCE(e.income, 0) AS compensated_eclaim,
          COALESCE(r.income, 0) AS compensated_rep,
          COALESCE(n.income, 0) AS compensated_nhso,
          COALESCE(e.rep, '') AS rep_eclaim,
          COALESCE(r.rep, '') AS rep_rep,
          COALESCE(n.rep, '') AS rep_nhso,
          CASE
            WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ได้ส่ง'
          END AS status
        FROM (
          SELECT DISTINCT oo.vn
          FROM opitemrece oo
          LEFT JOIN drugitems d ON d.icode = oo.icode
          LEFT JOIN nondrugitems nd ON nd.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND IFNULL(oo.vn, '') <> ''
            AND (
              d.name REGEXP 'norplant|implanon|jadelle'
              OR d.name LIKE '%ยาฝัง%'
              OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%'
              OR nd.nhso_adp_code IN (?, ?)
            )
        ) filtered_vn
        JOIN ovst o ON o.vn = filtered_vn.vn
        JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN (
          SELECT oo.vn,
                 GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS drugname,
                 GROUP_CONCAT(DISTINCT d.nhso_adp_code SEPARATOR ', ') AS drug_adp
          FROM opitemrece oo
          JOIN drugitems d ON d.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND (
              d.name REGEXP 'norplant|implanon|jadelle'
              OR d.name LIKE '%ยาฝัง%'
              OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%'
            )
          GROUP BY oo.vn
        ) drug_sub ON drug_sub.vn = o.vn
        LEFT JOIN (
          SELECT oo.vn,
                 GROUP_CONCAT(DISTINCT nd.name SEPARATOR ', ') AS listname,
                 GROUP_CONCAT(DISTINCT nd.nhso_adp_code SEPARATOR ', ') AS fp_adp
          FROM opitemrece oo
          JOIN nondrugitems nd ON nd.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND nd.nhso_adp_code IN (?, ?)
          GROUP BY oo.vn
        ) fp_sub ON fp_sub.vn = o.vn
        LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
        LEFT JOIN visit_pttype cc2 ON cc2.vn = o.vn
        LEFT JOIN (
          SELECT e.opdseq AS vn,
                 SUM(COALESCE(cc.totpay1, 0)) AS income,
                 SUBSTRING_INDEX(GROUP_CONCAT(IF(e.status = '4', e.rep, NULL) ORDER BY e.eclaim_no DESC), ',', 1) AS rep
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '1'
            AND e.dateadm BETWEEN ? AND ?
          GROUP BY e.opdseq
        ) e ON e.vn = o.vn
        LEFT JOIN (
          SELECT vn,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'OP'
          GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'OP'
          GROUP BY vn
        ) n ON n.vn = o.vn
        LEFT JOIN (
          SELECT m.opdseq AS vn,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '1'
            AND m.opdseq IS NOT NULL
            AND m.dateadm BETWEEN ? AND ?
          GROUP BY m.opdseq
        ) m ON m.vn = o.vn
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        WHERE o.vstdate BETWEEN ? AND ?
          AND pt.sex = '2'
          AND (v.age_y >= 20 OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) >= 20)
          AND (drug_sub.vn IS NOT NULL OR fp_sub.vn IS NOT NULL)
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `

      return await executor(
        sql,
        [ds1, ds2, adp1, adp2, ds1, ds2, ds1, ds2, adp1, adp2, ds1, ds2, ds1, ds2, ds1, ds2],
        { timeoutMs: 90000 }
      )
    } catch {
      const fallbackSql = `
        SELECT 
          o.vn,
          IFNULL(o.an, '') AS an,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          COALESCE(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          COALESCE(NULLIF(TRIM(cc2.auth_code), ''), NULLIF(TRIM(cc2.claim_code), ''), '') AS authencode,
          dep.department AS department,
          spc.name AS clinic,
          IFNULL(v.income, 0) AS income,
          drug_sub.drugname,
          drug_sub.drug_adp,
          fp_sub.listname,
          fp_sub.fp_adp,
          CONCAT_WS(',', NULLIF(drug_sub.drug_adp, ''), NULLIF(fp_sub.fp_adp, '')) AS adpcode,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          0 AS compensated_eclaim,
          0 AS compensated_rep,
          0 AS compensated_nhso,
          '' AS rep_eclaim,
          '' AS rep_rep,
          '' AS rep_nhso,
          '- :: ยังไม่ได้ส่ง' AS status
        FROM (
          SELECT DISTINCT oo.vn
          FROM opitemrece oo
          LEFT JOIN drugitems d ON d.icode = oo.icode
          LEFT JOIN nondrugitems nd ON nd.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND IFNULL(oo.vn, '') <> ''
            AND (
              d.name REGEXP 'norplant|implanon|jadelle'
              OR d.name LIKE '%ยาฝัง%'
              OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%'
              OR nd.nhso_adp_code IN (?, ?)
            )
        ) filtered_vn
        JOIN ovst o ON o.vn = filtered_vn.vn
        JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN (
          SELECT oo.vn,
                 GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS drugname,
                 GROUP_CONCAT(DISTINCT d.nhso_adp_code SEPARATOR ', ') AS drug_adp
          FROM opitemrece oo
          JOIN drugitems d ON d.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND (
              d.name REGEXP 'norplant|implanon|jadelle'
              OR d.name LIKE '%ยาฝัง%'
              OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%'
            )
          GROUP BY oo.vn
        ) drug_sub ON drug_sub.vn = o.vn
        LEFT JOIN (
          SELECT oo.vn,
                 GROUP_CONCAT(DISTINCT nd.name SEPARATOR ', ') AS listname,
                 GROUP_CONCAT(DISTINCT nd.nhso_adp_code SEPARATOR ', ') AS fp_adp
          FROM opitemrece oo
          JOIN nondrugitems nd ON nd.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND nd.nhso_adp_code IN (?, ?)
          GROUP BY oo.vn
        ) fp_sub ON fp_sub.vn = o.vn
        LEFT JOIN visit_pttype cc2 ON cc2.vn = o.vn
        WHERE o.vstdate BETWEEN ? AND ?
          AND pt.sex = '2'
          AND (v.age_y >= 20 OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) >= 20)
          AND (drug_sub.vn IS NOT NULL OR fp_sub.vn IS NOT NULL)
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `
      return await executor(fallbackSql, [ds1, ds2, adp1, adp2, ds1, ds2, ds1, ds2, adp1, adp2, ds1, ds2], {
        timeoutMs: 60000,
      })
    }
  }
}

