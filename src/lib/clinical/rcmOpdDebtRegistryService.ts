import { apiGateway, GatewayNotFoundError } from '@/lib/apiGateway'
import { getSwrCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  type FiscalDateRangeParams,
  resolveFiscalDateRange,
} from './rcmDashboardService'

export type OpdDebtCardFilter =
  | 'ALL'
  | 'WITH_DEBIT'
  | 'WITH_RCPT'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'

export type OpdDebtBreakdownType = 'account' | 'eclaim' | 'pttype' | 'vstdate'

export type OpdDebtSortField =
  | 'vstdate'
  | 'hn'
  | 'vn'
  | 'cid'
  | 'ptname'
  | 'pttype'
  | 'pttype_eclaim_id'
  | 'accountcode'
  | 'income'
  | 'uc_money'
  | 'discount_money'
  | 'paid_money'
  | 'rcpt_money'
  | 'debit'

export interface OpdDebtRegistryItem {
  no: number
  vn: string
  an: string
  hn: string
  cid: string
  ptname: string
  vstdate: string
  vsttime: string
  ptsubtypeCode: string
  ptsubtype: string
  authencode: string | null
  authenMethod: string | null
  pttype_eclaim_id: string
  pttype_eclaim_name: string
  pttype: string
  hipdata_code: string
  pttypename: string
  gfmis: string
  accountcode: string
  accountname: string
  department: string
  clinic: string
  pdx: string
  income: number
  uc_money: number
  discount_money: number
  paid_money: number
  rcpt_money: number
  rcpno: string
  rcpnodate: string
  debit: number
  max_debt_amount: number | null
}

export interface OpdDebtSummary {
  totalCases: number
  totalVisits: number
  totalIncome: number
  totalUcMoney: number
  totalDiscountMoney: number
  totalPaidMoney: number
  totalRcptMoney: number
  totalDebit: number
  withDebitCount: number
  withRcptCount: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
}

export interface OpdDebtGroupBreakdownRow {
  code: string
  name: string
  gfmis?: string
  hipdata_code?: string
  cases: number
  visits: number
  income: number
  discount_money: number
  rcpt_money: number
  debit: number
}

export interface OpdDebtBreakdowns {
  eclaim: OpdDebtGroupBreakdownRow[]
  account: OpdDebtGroupBreakdownRow[]
  pttype: OpdDebtGroupBreakdownRow[]
  vstdate: OpdDebtGroupBreakdownRow[]
}

export interface OpdDebtRegistryParams extends FiscalDateRangeParams {
  includeAdmitted?: boolean
  cardFilter?: OpdDebtCardFilter
  eclaimFilter?: string
  accountFilter?: string
  pttypeFilter?: string
  vstdateFilter?: string
  search?: string
  sortBy?: OpdDebtSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface OpdDebtRegistryResult {
  ds1: string
  ds2: string
  includeAdmitted: boolean
  cardFilter: OpdDebtCardFilter
  eclaimFilter: string
  accountFilter: string
  pttypeFilter: string
  vstdateFilter: string
  search: string
  sortBy: OpdDebtSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: OpdDebtSummary
  breakdowns: OpdDebtBreakdowns
  items: OpdDebtRegistryItem[]
}

export type OpdDebtRegistryFetcher = (params: {
  ds1: string
  ds2: string
  includeAdmitted: boolean
  cardFilter: OpdDebtCardFilter
  eclaimFilter?: string
  accountFilter?: string
  pttypeFilter?: string
  vstdateFilter?: string
  search?: string
  sortBy: OpdDebtSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  exportAll: boolean
  refresh: boolean
}) => Promise<any>

const VALID_SORT_FIELDS = new Set<OpdDebtSortField>([
  'vstdate',
  'hn',
  'vn',
  'cid',
  'ptname',
  'pttype',
  'pttype_eclaim_id',
  'accountcode',
  'income',
  'uc_money',
  'discount_money',
  'paid_money',
  'rcpt_money',
  'debit',
])

const defaultOpdDebtRegistryFetcher: OpdDebtRegistryFetcher = (params) =>
  apiGateway.clinical.getRcmOpdDebtRegistry(params)

function buildCacheKey(params: {
  ds1: string
  ds2: string
  includeAdmitted: boolean
  cardFilter: OpdDebtCardFilter
  eclaimFilter: string
  accountFilter: string
  pttypeFilter: string
  vstdateFilter: string
  search: string
  sortBy: OpdDebtSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
}): string {
  return [
    'rcm-opd-debt-registry:named',
    params.ds1,
    params.ds2,
    params.includeAdmitted ? 'all' : 'opd',
    params.cardFilter,
    params.eclaimFilter || '-',
    params.accountFilter || '-',
    params.pttypeFilter || '-',
    params.vstdateFilter || '-',
    params.search || '-',
    params.sortBy,
    params.sortOrder,
    params.page,
    params.pageSize,
  ].join(':')
}

/**
 * 2.1.1.3 รายชื่อผู้ป่วยนอก รับบริการ (ทะเบียนตั้งหนี้)
 * Zero-SQL Gateway Adapter delegating Two-Tier aggregation and paginated enrichment
 * strictly to API Gateway (`GET /api/v1/clinical/rcm/opd-debt-registry`).
 */
export class RcmOpdDebtRegistryService {
  static async getReportData(
    params: OpdDebtRegistryParams = {},
    fetcher: OpdDebtRegistryFetcher = defaultOpdDebtRegistryFetcher
  ): Promise<OpdDebtRegistryResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const includeAdmitted = Boolean(params.includeAdmitted)
    const cardFilter: OpdDebtCardFilter = params.cardFilter ?? 'ALL'
    const eclaimFilter = (params.eclaimFilter || '').trim()
    const accountFilter = (params.accountFilter || '').trim()
    const pttypeFilter = (params.pttypeFilter || '').trim()
    const vstdateFilter = (params.vstdateFilter || '').trim()
    const search = (params.search || '').trim()
    const sortBy: OpdDebtSortField =
      params.sortBy && VALID_SORT_FIELDS.has(params.sortBy) ? params.sortBy : 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder === 'asc' ? 'asc' : 'desc'
    const exportAll = Boolean(params.exportAll)
    const page = exportAll ? 1 : Math.max(1, Number(params.page || 1))
    const pageSize = exportAll ? 50000 : Math.max(1, Number(params.pageSize || 50))
    const refresh = Boolean(params.refresh)

    const cacheKey = buildCacheKey({
      ds1,
      ds2,
      includeAdmitted,
      cardFilter,
      eclaimFilter,
      accountFilter,
      pttypeFilter,
      vstdateFilter,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
    })

    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getSwrCachedData<OpdDebtRegistryResult>(
      cacheKey,
      async () => {
        const gwRes = await fetcher({
          ds1,
          ds2,
          includeAdmitted,
          cardFilter,
          eclaimFilter: eclaimFilter || undefined,
          accountFilter: accountFilter || undefined,
          pttypeFilter: pttypeFilter || undefined,
          vstdateFilter: vstdateFilter || undefined,
          search: search || undefined,
          sortBy,
          sortOrder,
          page,
          pageSize,
          exportAll,
          refresh,
        })
        const payload = (gwRes?.data ?? gwRes) as OpdDebtRegistryResult | undefined
        if (!payload || !Array.isArray(payload.items) || !payload.summary) {
          throw new GatewayNotFoundError('Invalid Named API payload')
        }
        return payload
      },
      { staleTtlMs: 20_000, maxTtlMs: 60_000, forceRefresh: refresh || exportAll }
    )
  }
}
