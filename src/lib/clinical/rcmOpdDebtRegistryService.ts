import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway, GatewayNotFoundError } from '@/lib/apiGateway'
import { getSwrCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  type QueryExecutor,
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

const PT_SUBTYPE_LABELS: Record<string, string> = {
  '0': 'ตรวจโรคทั่วไป',
  '1': 'ส่งเสริมสุขภาพ',
  '2': 'ฝากครรภ์ (ANC)',
  '3': 'คลินิกเด็กดี (WBC)',
  '4': 'สร้างเสริมภูมิคุ้มกัน (EPI)',
  '5': 'วางแผนครอบครัว (FP)',
  '6': 'เยี่ยมบ้าน / ชุมชน',
}

const SORT_COLUMN_MAP: Record<OpdDebtSortField, string> = {
  vstdate: 'o.vstdate',
  hn: 'o.hn',
  vn: 'o.vn',
  cid: 'pt.cid',
  ptname: 'pt.fname',
  pttype: 'o.pttype',
  pttype_eclaim_id: 'ptt.pttype_eclaim_id',
  accountcode: 'e.ar_opd',
  income: 'v.income',
  uc_money: 'v.uc_money',
  discount_money: 'v.discount_money',
  paid_money: 'v.paid_money',
  rcpt_money: 'v.rcpt_money',
  debit: '(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0))',
}

function formatPtSubtype(code?: string | number | null): string {
  const c = code == null ? '' : String(code).trim()
  if (!c) return ''
  return PT_SUBTYPE_LABELS[c] || c
}

function sanitizeRcpnoText(val?: string | null): string {
  if (!val) return ''
  return String(val).replace(/["']/g, '').trim()
}

function round2(n: unknown): number {
  const num = Number(n ?? 0)
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0
}

function buildTier1CacheKey(ds1: string, ds2: string, includeAdmitted: boolean): string {
  return `rcm-opd-debt-registry:tier1:${ds1}:${ds2}:${includeAdmitted ? 'all' : 'opd'}`
}

function buildTier2CacheKey(params: {
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
    'rcm-opd-debt-registry:tier2',
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

const AUTHEN_EXISTS_SQL = `(
  EXISTS (
    SELECT 1 FROM rcmdb.authencode cc
    WHERE cc.vn = o.vn AND NULLIF(TRIM(cc.AuthenCode), '') IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM visit_pttype vt
    WHERE vt.vn = o.vn
      AND (NULLIF(TRIM(vt.auth_code), '') IS NOT NULL OR NULLIF(TRIM(vt.claim_code), '') IS NOT NULL)
  )
)`

interface Tier1Data {
  summary: OpdDebtSummary
  breakdowns: OpdDebtBreakdowns
}

/**
 * 2.1.1.3 รายชื่อผู้ป่วยนอก รับบริการ (ทะเบียนตั้งหนี้)
 * Pattern A (True SQL Two-Tier):
 * - Tier 1: Parallel SQL GROUP BY summary + 4 financial breakdowns (E-Claim, Account, Pttype, Date) cached via SWR.
 * - Tier 2: Parameterized COUNT + LIMIT/OFFSET ledger + batch enrichment (rcpt_print, authencode, visit_pttype) for the current page only.
 */
export class RcmOpdDebtRegistryService {
  static async getReportData(
    params: OpdDebtRegistryParams = {},
    executor: QueryExecutor = queryClinicalDb
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
      params.sortBy && SORT_COLUMN_MAP[params.sortBy] ? params.sortBy : 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder === 'asc' ? 'asc' : 'desc'
    const exportAll = Boolean(params.exportAll)
    const page = exportAll ? 1 : Math.max(1, Number(params.page || 1))
    const pageSize = exportAll ? 50000 : Math.max(1, Number(params.pageSize || 50))
    const offset = (page - 1) * pageSize
    const refresh = Boolean(params.refresh)

    const tier1Key = buildTier1CacheKey(ds1, ds2, includeAdmitted)
    const tier2Key = buildTier2CacheKey({
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
      invalidateCacheKey(tier1Key)
      invalidateCacheKey(tier2Key)
    }

    if (executor === queryClinicalDb) {
      const namedKey = `named:${tier2Key}`
      if (refresh) {
        invalidateCacheKey(namedKey)
      }
      try {
        const namedResult = await getSwrCachedData<OpdDebtRegistryResult>(
          namedKey,
          async () => {
            const gwRes = await apiGateway.clinical.getRcmOpdDebtRegistry({
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
        return namedResult
      } catch (err: unknown) {
        if (!(err instanceof GatewayNotFoundError)) {
          throw err
        }
        // Fallback to queryClinicalDb SQL queries if Gateway Named API is not yet deployed
      }
    }

    const tier1Promise = getSwrCachedData<Tier1Data>(
      tier1Key,
      () => this.fetchTier1Summary(ds1, ds2, includeAdmitted, executor),
      { staleTtlMs: 30_000, maxTtlMs: 120_000, forceRefresh: refresh }
    )

    const tier2Fetcher = () =>
      this.fetchTier2Ledger(
        {
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
          offset,
          exportAll,
        },
        executor
      )

    const tier2Promise = exportAll
      ? tier2Fetcher()
      : getSwrCachedData(tier2Key, tier2Fetcher, {
          staleTtlMs: 20_000,
          maxTtlMs: 60_000,
          forceRefresh: refresh,
        })

    const [tier1, tier2] = await Promise.all([tier1Promise, tier2Promise])

    return {
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
      totalCount: tier2.totalCount,
      totalPages: Math.max(1, Math.ceil(tier2.totalCount / pageSize)),
      summary: tier1.summary,
      breakdowns: tier1.breakdowns,
      items: tier2.items,
    }
  }

  private static async fetchTier1Summary(
    ds1: string,
    ds2: string,
    includeAdmitted: boolean,
    executor: QueryExecutor
  ): Promise<Tier1Data> {
    const anClause = includeAdmitted ? '' : "AND IFNULL(o.an, '') = ''"

    const summarySql = `
      SELECT
        COUNT(DISTINCT o.hn) AS total_cases,
        COUNT(DISTINCT o.vn) AS total_visits,
        SUM(IFNULL(v.income, 0)) AS total_income,
        SUM(IFNULL(v.uc_money, 0)) AS total_uc_money,
        SUM(IFNULL(v.discount_money, 0)) AS total_discount_money,
        SUM(IFNULL(v.paid_money, 0)) AS total_paid_money,
        SUM(IFNULL(v.rcpt_money, 0)) AS total_rcpt_money,
        SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS total_debit,
        SUM(CASE WHEN (IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) > 0 THEN 1 ELSE 0 END) AS with_debit_count,
        SUM(CASE WHEN IFNULL(v.rcpt_money, 0) > 0 THEN 1 ELSE 0 END) AS with_rcpt_count,
        SUM(CASE WHEN ${AUTHEN_EXISTS_SQL} THEN 1 ELSE 0 END) AS with_authen_count
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      WHERE o.vstdate BETWEEN ? AND ?
        ${anClause}
    `

    const eclaimSql = `
      SELECT
        COALESCE(NULLIF(TRIM(ptt.pttype_eclaim_id), ''), 'NONE') AS code,
        COALESCE(NULLIF(TRIM(e.name), ''), '') AS name,
        COUNT(DISTINCT o.hn) AS cases,
        COUNT(DISTINCT o.vn) AS visits,
        SUM(IFNULL(v.income, 0)) AS income,
        SUM(IFNULL(v.discount_money, 0)) AS discount_money,
        SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
        SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
      WHERE o.vstdate BETWEEN ? AND ?
        ${anClause}
      GROUP BY COALESCE(NULLIF(TRIM(ptt.pttype_eclaim_id), ''), 'NONE'), COALESCE(NULLIF(TRIM(e.name), ''), '')
      ORDER BY debit DESC, income DESC
    `

    const accountSql = `
      SELECT
        COALESCE(NULLIF(TRIM(e.ar_opd), ''), 'NONE') AS code,
        COALESCE(NULLIF(TRIM(ca.name), ''), NULLIF(TRIM(e.ar_opd), ''), '') AS name,
        MAX(IFNULL(e.gf_opd, '')) AS gfmis,
        COUNT(DISTINCT o.hn) AS cases,
        COUNT(DISTINCT o.vn) AS visits,
        SUM(IFNULL(v.income, 0)) AS income,
        SUM(IFNULL(v.discount_money, 0)) AS discount_money,
        SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
        SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
      LEFT JOIN codeaccount ca ON ca.code = e.ar_opd
      WHERE o.vstdate BETWEEN ? AND ?
        ${anClause}
      GROUP BY COALESCE(NULLIF(TRIM(e.ar_opd), ''), 'NONE'), COALESCE(NULLIF(TRIM(ca.name), ''), NULLIF(TRIM(e.ar_opd), ''), '')
      ORDER BY debit DESC, income DESC
    `

    const pttypeSql = `
      SELECT
        COALESCE(NULLIF(TRIM(o.pttype), ''), 'NONE') AS code,
        COALESCE(NULLIF(TRIM(ptt.name), ''), NULLIF(TRIM(o.pttype), ''), '') AS name,
        MAX(IFNULL(ptt.hipdata_code, '')) AS hipdata_code,
        COUNT(DISTINCT o.hn) AS cases,
        COUNT(DISTINCT o.vn) AS visits,
        SUM(IFNULL(v.income, 0)) AS income,
        SUM(IFNULL(v.discount_money, 0)) AS discount_money,
        SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
        SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      WHERE o.vstdate BETWEEN ? AND ?
        ${anClause}
      GROUP BY COALESCE(NULLIF(TRIM(o.pttype), ''), 'NONE'), COALESCE(NULLIF(TRIM(ptt.name), ''), NULLIF(TRIM(o.pttype), ''), '')
      ORDER BY debit DESC, income DESC
    `

    const vstdateSql = `
      SELECT
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS code,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS name,
        COUNT(DISTINCT o.hn) AS cases,
        COUNT(DISTINCT o.vn) AS visits,
        SUM(IFNULL(v.income, 0)) AS income,
        SUM(IFNULL(v.discount_money, 0)) AS discount_money,
        SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
        SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      WHERE o.vstdate BETWEEN ? AND ?
        ${anClause}
      GROUP BY DATE_FORMAT(o.vstdate, '%Y-%m-%d')
      ORDER BY code DESC
    `

    const dateParams = [ds1, ds2]
    const [summaryRows, eclaimRows, accountRows, pttypeRows, vstdateRows] = await Promise.all([
      executor(summarySql, dateParams, { timeoutMs: 60000 }),
      executor(eclaimSql, dateParams, { timeoutMs: 60000 }),
      executor(accountSql, dateParams, { timeoutMs: 60000 }),
      executor(pttypeSql, dateParams, { timeoutMs: 60000 }),
      executor(vstdateSql, dateParams, { timeoutMs: 60000 }),
    ])

    const sr = summaryRows?.[0] ?? {}
    const totalVisits = Number(sr.total_visits ?? 0)
    const withAuthenCount = Number(sr.with_authen_count ?? 0)
    const withoutAuthenCount = Math.max(0, totalVisits - withAuthenCount)
    const authenRate =
      totalVisits > 0 ? Math.round((withAuthenCount / totalVisits) * 1000) / 10 : 0

    const mapBreakdown = (
      rows: any[],
      fallbackName: string
    ): OpdDebtGroupBreakdownRow[] =>
      (rows || []).map((r) => {
        const code = String(r.code || 'NONE').trim()
        const rawName = String(r.name || '').trim()
        return {
          code,
          name: rawName || (code === 'NONE' ? fallbackName : code),
          gfmis: r.gfmis ? String(r.gfmis).trim() : undefined,
          hipdata_code: r.hipdata_code ? String(r.hipdata_code).trim() : undefined,
          cases: Number(r.cases ?? 0),
          visits: Number(r.visits ?? 0),
          income: round2(r.income),
          discount_money: round2(r.discount_money),
          rcpt_money: round2(r.rcpt_money),
          debit: round2(r.debit),
        }
      })

    return {
      summary: {
        totalCases: Number(sr.total_cases ?? 0),
        totalVisits,
        totalIncome: round2(sr.total_income),
        totalUcMoney: round2(sr.total_uc_money),
        totalDiscountMoney: round2(sr.total_discount_money),
        totalPaidMoney: round2(sr.total_paid_money),
        totalRcptMoney: round2(sr.total_rcpt_money),
        totalDebit: round2(sr.total_debit),
        withDebitCount: Number(sr.with_debit_count ?? 0),
        withRcptCount: Number(sr.with_rcpt_count ?? 0),
        withAuthenCount,
        withoutAuthenCount,
        authenRate,
      },
      breakdowns: {
        eclaim: mapBreakdown(eclaimRows, 'ไม่ระบุสิทธิ e-Claim'),
        account: mapBreakdown(accountRows, 'ไม่ระบุผังบัญชี'),
        pttype: mapBreakdown(pttypeRows, 'ไม่ระบุสิทธิ'),
        vstdate: mapBreakdown(vstdateRows, 'ไม่ระบุวันที่'),
      },
    }
  }

  private static async fetchTier2Ledger(
    opts: {
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
      offset: number
      exportAll: boolean
    },
    executor: QueryExecutor
  ): Promise<{ totalCount: number; items: OpdDebtRegistryItem[] }> {
    const whereClauses: string[] = ['o.vstdate BETWEEN ? AND ?']
    const whereParams: unknown[] = [opts.ds1, opts.ds2]

    if (!opts.includeAdmitted) {
      whereClauses.push("IFNULL(o.an, '') = ''")
    }

    if (opts.eclaimFilter) {
      if (opts.eclaimFilter === 'NONE') {
        whereClauses.push("(ptt.pttype_eclaim_id IS NULL OR TRIM(ptt.pttype_eclaim_id) = '')")
      } else {
        whereClauses.push('ptt.pttype_eclaim_id = ?')
        whereParams.push(opts.eclaimFilter)
      }
    }

    if (opts.accountFilter) {
      if (opts.accountFilter === 'NONE') {
        whereClauses.push("(e.ar_opd IS NULL OR TRIM(e.ar_opd) = '')")
      } else {
        whereClauses.push('e.ar_opd = ?')
        whereParams.push(opts.accountFilter)
      }
    }

    if (opts.pttypeFilter) {
      if (opts.pttypeFilter === 'NONE') {
        whereClauses.push("(o.pttype IS NULL OR TRIM(o.pttype) = '')")
      } else {
        whereClauses.push('o.pttype = ?')
        whereParams.push(opts.pttypeFilter)
      }
    }

    if (opts.vstdateFilter) {
      whereClauses.push('o.vstdate = ?')
      whereParams.push(opts.vstdateFilter)
    }

    if (opts.cardFilter === 'WITH_DEBIT') {
      whereClauses.push(
        '(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) > 0'
      )
    } else if (opts.cardFilter === 'WITH_RCPT') {
      whereClauses.push('IFNULL(v.rcpt_money, 0) > 0')
    } else if (opts.cardFilter === 'WITH_AUTHEN') {
      whereClauses.push(AUTHEN_EXISTS_SQL)
    } else if (opts.cardFilter === 'NO_AUTHEN') {
      whereClauses.push(`NOT ${AUTHEN_EXISTS_SQL}`)
    }

    if (opts.search) {
      const like = `%${opts.search}%`
      whereClauses.push(`(
        o.hn LIKE ? OR
        o.vn LIKE ? OR
        o.an LIKE ? OR
        pt.cid LIKE ? OR
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) LIKE ? OR
        ptt.name LIKE ? OR
        e.name LIKE ? OR
        e.ar_opd LIKE ? OR
        v.pdx LIKE ? OR
        v.rcpno_list LIKE ? OR
        EXISTS (SELECT 1 FROM rcmdb.authencode cc WHERE cc.vn = o.vn AND cc.AuthenCode LIKE ?) OR
        EXISTS (SELECT 1 FROM visit_pttype vt WHERE vt.vn = o.vn AND (vt.auth_code LIKE ? OR vt.claim_code LIKE ?))
      )`)
      whereParams.push(
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like
      )
    }

    const whereSql = whereClauses.join(' AND ')
    const sortExpr = SORT_COLUMN_MAP[opts.sortBy] || 'o.vstdate'
    const dir = opts.sortOrder === 'asc' ? 'ASC' : 'DESC'
    const orderBySql =
      opts.sortBy === 'vstdate'
        ? `o.vstdate ${dir}, o.vsttime ${dir}, o.vn ${dir}`
        : `${sortExpr} ${dir}, o.vn DESC`

    const countSql = `
      SELECT COUNT(DISTINCT o.vn) AS total
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
      WHERE ${whereSql}
    `

    const dataSql = `
      SELECT
        o.vn,
        IFNULL(o.an, '') AS an,
        o.hn,
        IFNULL(pt.cid, '') AS cid,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        IFNULL(o.pt_subtype, '') AS pt_subtype,
        IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
        IFNULL(e.name, '') AS pttype_eclaim_name,
        IFNULL(o.pttype, '') AS pttype,
        IFNULL(ptt.hipdata_code, '') AS hipdata_code,
        IFNULL(ptt.name, '') AS pttypename,
        IFNULL(e.gf_opd, '') AS gfmis,
        IFNULL(e.ar_opd, '') AS accountcode,
        IFNULL(ca.name, '') AS accountname,
        IFNULL(dep.department, IFNULL(o.main_dep, '')) AS department,
        IFNULL(spc.name, IFNULL(o.spclty, '')) AS clinic,
        IFNULL(v.pdx, '') AS pdx,
        IFNULL(v.income, 0) AS income,
        IFNULL(v.uc_money, 0) AS uc_money,
        IFNULL(v.discount_money, 0) AS discount_money,
        IFNULL(v.paid_money, 0) AS paid_money,
        IFNULL(v.rcpt_money, 0) AS rcpt_money,
        IFNULL(v.rcpno_list, '') AS rcpno_list,
        (IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
      FROM ovst o
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
      LEFT JOIN codeaccount ca ON ca.code = e.ar_opd
      LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
      LEFT JOIN spclty spc ON spc.spclty = o.spclty
      WHERE ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ? OFFSET ?
    `

    const [countRows, rawRows] = await Promise.all([
      executor(countSql, whereParams, { timeoutMs: 60000 }),
      executor(dataSql, [...whereParams, opts.pageSize, opts.offset], { timeoutMs: 90000 }),
    ])

    const totalCount = Number(countRows?.[0]?.total ?? 0)
    const rows = Array.isArray(rawRows) ? rawRows : []

    if (rows.length === 0) {
      return { totalCount, items: [] }
    }

    // Batch-enrich ONLY the returned rows (50 rows per page) with rcpt_print, authencode, visit_pttype
    const vnList = Array.from(
      new Set(rows.map((r: any) => String(r.vn || '').trim()).filter(Boolean))
    )

    const enrichment = await this.fetchRowEnrichments(vnList, executor)

    const items: OpdDebtRegistryItem[] = rows.map((r: any, idx: number) => {
      const vn = String(r.vn || '').trim()
      const rcptInfo = enrichment.rcptMap.get(vn)
      const authenInfo = enrichment.authenMap.get(vn)
      const visitPttypeInfo = enrichment.visitPttypeMap.get(vn)

      const resolvedAuthen =
        authenInfo?.authencode ||
        visitPttypeInfo?.authCode ||
        visitPttypeInfo?.claimCode ||
        null

      const rawRcpno = rcptInfo?.rcpno || r.rcpno_list || ''
      const ptSubtypeCode = r.pt_subtype != null ? String(r.pt_subtype).trim() : ''

      return {
        no: opts.offset + idx + 1,
        vn,
        an: String(r.an || '').trim(),
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        ptsubtypeCode: ptSubtypeCode,
        ptsubtype: formatPtSubtype(ptSubtypeCode),
        authencode: resolvedAuthen,
        authenMethod: authenInfo?.authenMethod || null,
        pttype_eclaim_id: String(r.pttype_eclaim_id || '').trim(),
        pttype_eclaim_name: String(r.pttype_eclaim_name || '').trim(),
        pttype: String(r.pttype || '').trim(),
        hipdata_code: String(r.hipdata_code || '').trim(),
        pttypename: String(r.pttypename || '').trim(),
        gfmis: String(r.gfmis || '').trim(),
        accountcode: String(r.accountcode || '').trim(),
        accountname: String(r.accountname || '').trim(),
        department: String(r.department || '').trim(),
        clinic: String(r.clinic || '').trim(),
        pdx: String(r.pdx || '').trim(),
        income: round2(r.income),
        uc_money: round2(r.uc_money),
        discount_money: round2(r.discount_money),
        paid_money: round2(r.paid_money),
        rcpt_money: round2(r.rcpt_money),
        rcpno: sanitizeRcpnoText(rawRcpno),
        rcpnodate: String(rcptInfo?.rcpnodate || '').trim(),
        debit: round2(r.debit),
        max_debt_amount:
          visitPttypeInfo?.maxDebtAmount != null
            ? round2(visitPttypeInfo.maxDebtAmount)
            : null,
      }
    })

    return { totalCount, items }
  }

  private static async fetchRowEnrichments(
    vns: string[],
    executor: QueryExecutor
  ): Promise<{
    rcptMap: Map<string, { rcpno: string; rcpnodate: string }>
    authenMap: Map<string, { authencode: string | null; authenMethod: string | null }>
    visitPttypeMap: Map<
      string,
      { authCode: string | null; claimCode: string | null; maxDebtAmount: number | null }
    >
  }> {
    const rcptMap = new Map<string, { rcpno: string; rcpnodate: string }>()
    const authenMap = new Map<string, { authencode: string | null; authenMethod: string | null }>()
    const visitPttypeMap = new Map<
      string,
      { authCode: string | null; claimCode: string | null; maxDebtAmount: number | null }
    >()

    if (vns.length === 0) {
      return { rcptMap, authenMap, visitPttypeMap }
    }

    const CHUNK_SIZE = 500
    const chunks: string[][] = []
    for (let i = 0; i < vns.length; i += CHUNK_SIZE) {
      chunks.push(vns.slice(i, i + CHUNK_SIZE))
    }

    const safeQuery = async (sql: string, params: unknown[]): Promise<any[]> => {
      try {
        const res = await executor(sql, params, { timeoutMs: 20000 })
        return Array.isArray(res) ? res : []
      } catch {
        return []
      }
    }

    await Promise.all(
      chunks.map(async (chunk) => {
        const placeholders = chunk.map(() => '?').join(',')

        const rcptSql = `
          SELECT
            b.vn,
            GROUP_CONCAT(CONCAT(b.rcpno, '#', FORMAT(IFNULL(b.total_amount, 0), 2)) ORDER BY b.finance_number SEPARATOR ', ') AS rcpno,
            GROUP_CONCAT(DATE_FORMAT(b.bill_date_time, '%Y-%m-%d %H:%i') ORDER BY b.finance_number SEPARATOR ', ') AS rcpnodate
          FROM rcpt_print b
          WHERE b.vn IN (${placeholders})
            AND IFNULL(b.status, '') NOT REGEXP 'Abort'
          GROUP BY b.vn
        `

        const authenSql = `
          SELECT
            cc.vn,
            MAX(NULLIF(TRIM(cc.AuthenCode), '')) AS authencode,
            MAX(NULLIF(TRIM(cc.AuthenMethod), '')) AS authen_method
          FROM rcmdb.authencode cc
          WHERE cc.vn IN (${placeholders})
          GROUP BY cc.vn
        `

        const vtSql = `
          SELECT
            vt.vn,
            MAX(NULLIF(TRIM(vt.auth_code), '')) AS auth_code,
            MAX(NULLIF(TRIM(vt.claim_code), '')) AS claim_code,
            MAX(vt.max_debt_amount) AS max_debt_amount
          FROM visit_pttype vt
          WHERE vt.vn IN (${placeholders})
          GROUP BY vt.vn
        `

        const [rcptRows, authenRows, vtRows] = await Promise.all([
          safeQuery(rcptSql, chunk),
          safeQuery(authenSql, chunk),
          safeQuery(vtSql, chunk),
        ])

        for (const r of rcptRows) {
          const vn = String(r.vn || '').trim()
          if (vn) {
            rcptMap.set(vn, {
              rcpno: String(r.rcpno || '').trim(),
              rcpnodate: String(r.rcpnodate || '').trim(),
            })
          }
        }

        for (const r of authenRows) {
          const vn = String(r.vn || '').trim()
          if (vn) {
            authenMap.set(vn, {
              authencode: r.authencode ? String(r.authencode).trim() : null,
              authenMethod: r.authen_method ? String(r.authen_method).trim() : null,
            })
          }
        }

        for (const r of vtRows) {
          const vn = String(r.vn || '').trim()
          if (vn) {
            visitPttypeMap.set(vn, {
              authCode: r.auth_code ? String(r.auth_code).trim() : null,
              claimCode: r.claim_code ? String(r.claim_code).trim() : null,
              maxDebtAmount: r.max_debt_amount != null ? Number(r.max_debt_amount) : null,
            })
          }
        }
      })
    )

    return { rcptMap, authenMap, visitPttypeMap }
  }
}
