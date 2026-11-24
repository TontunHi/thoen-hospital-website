import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
} from './rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  resolveSeamlessFetcher,
  type RcmFundGatewayAdapter,
} from './rcmFundGatewayHelper'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── 1. Domain Types: ระบบ AMed และ Home Ward - รายงาน HOMEWARD ──────────────

export type HomewardCardFilter =
  | 'ALL'
  | 'ON_AMED'
  | 'NOT_ON_AMED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'WITH_REP'
  | 'NO_REP'
  | 'WITH_DEBIT'

export type HomewardSortField =
  | 'dchdate'
  | 'admdate'
  | 'an'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'los'
  | 'pdx'
  | 'income'
  | 'debit'
  | 'adjrw'

export interface HomewardReportParams extends FiscalDateRangeParams {
  cardFilter?: HomewardCardFilter
  search?: string
  sortBy?: HomewardSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  reps?: string
  ucOnly?: boolean
}

export interface HomewardItem {
  no: number
  an: string
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  nation: string
  admdate: string
  dchdate: string
  los: number
  editdate: string | null
  day_diff: number
  ward: string
  bedno: string
  clinic: string
  prediag: string
  pdx: string
  pdxname: string
  sdx: string
  proc_code: string
  adjrw: number
  admdoctor: string
  dchdoctor: string
  authencode: string | null
  hasAuthen: boolean
  pttype_eclaim_id?: string
  pttype_eclaim_name?: string
  isUc?: boolean
  pttype: string
  pttypename: string
  copttype: string
  gfmis: string
  accountcode: string
  pttypeno: string
  hospmain: string
  hospsub: string
  dchstts: string
  dchtype: string
  summary_status: string
  income: number
  uc_money: number
  discount_money: number
  paid_money: number
  rcpt_money: number
  rcpno: string
  debit: number
  max_debt_amount: number | null
  follow_money: number
  bill: string | null
  billdate: string | null
  staff: string
  address: string
  mobile: string
  tel: string
  rep: string | null
  rep_remark: string | null
  invoice: string | null
  compensated?: number
  onweb_cid: string | null
  anonweb: string | null
  isOnAmed: boolean
  hasRep: boolean
}

export interface HomewardSummary {
  totalCases: number
  onAmedCases: number
  notOnAmedCases: number
  withAuthenCases: number
  noAuthenCases: number
  withRepCases: number
  noRepCases: number
  withDebitCases: number
  totalIncome: number
  totalDebit: number
  totalAdjrw: number
  avgLos: number
}

export interface HomewardReportResult {
  ds1: string
  ds2: string
  cardFilter: HomewardCardFilter
  search: string
  sortBy: HomewardSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: HomewardSummary
  repBreakdown?: RepBreakdownSummary
  items: HomewardItem[]
}

// ── 2. Service Implementation ────────────────────────────────────────────────

export class RcmAmedHomewardService {
  /**
   * Fetch and calculate HOMEWARD report via API Gateway Named Endpoint with In-Memory Filtering.
   */
  static async getHomewardReport(
    params: HomewardReportParams = {},
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
  ): Promise<HomewardReportResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: HomewardCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: HomewardSortField = params.sortBy || 'dchdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-homeward-report-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const gwRes = await gateway.getRcmFundData('amed-homeward', { ds1, ds2 })
        return extractFundRawRows(gwRes)
      },
      300000 // Cache TTL 5 minutes
    )

    // Map Raw Rows to HomewardItem domain models
    const allItems: HomewardItem[] = (rawRows || []).map((row, idx) => {
      const authen = row.authencode ? String(row.authencode).trim() : null
      const repVal = row.rep ? String(row.rep).trim() : null
      const invVal = row.invoice ? String(row.invoice).trim() : null
      const onwebCid = row.onweb_cid ? String(row.onweb_cid).trim() : null
      const onwebAn = row.anonweb ? String(row.anonweb).trim() : null
      const isOnAmed = Boolean((onwebCid && onwebCid.length > 0) || (onwebAn && onwebAn.length > 0))
      const hasRep = Boolean((repVal && repVal.length > 0) || (invVal && invVal.length > 0))
      const hasAuthen = Boolean(authen && authen.length > 0)
      const pttypeEclaimId = String(row.pttype_eclaim_id || '').trim()
      const isUc = isUcEclaimCode(pttypeEclaimId)

      return {
        no: idx + 1,
        an: String(row.an || '').trim(),
        hn: String(row.hn || '').trim(),
        cid: String(row.cid || '').trim(),
        ptname: String(row.ptname || '').trim(),
        sex: formatThaiSex(row.sex_code),
        birthday: row.birthday ? String(row.birthday) : null,
        age: Number(row.age || 0),
        nation: String(row.nation || '').trim(),
        admdate: String(row.admdate || '').trim(),
        dchdate: String(row.dchdate || '').trim(),
        los: Number(row.los || 0),
        editdate: row.editdate ? String(row.editdate) : null,
        day_diff: Number(row.day_diff || 0),
        ward: String(row.ward || '').trim(),
        bedno: String(row.bedno || '').trim(),
        clinic: String(row.clinic || '').trim(),
        prediag: String(row.prediag || '').trim(),
        pdx: String(row.pdx || '').trim(),
        pdxname: String(row.pdxname || '').trim(),
        sdx: String(row.sdx || '').trim(),
        proc_code: String(row.proc_code || '').trim(),
        adjrw: Number(row.adjrw || 0),
        admdoctor: String(row.admdoctor || '').trim(),
        dchdoctor: String(row.dchdoctor || '').trim(),
        authencode: authen || null,
        hasAuthen,
        pttype_eclaim_id: pttypeEclaimId,
        pttype_eclaim_name: String(row.pttype_eclaim_name || '').trim(),
        isUc,
        pttype: String(row.pttype || '').trim(),
        pttypename: String(row.pttypename || '').trim(),
        copttype: String(row.copttype || '').trim(),
        gfmis: String(row.gfmis || '').trim(),
        accountcode: String(row.accountcode || '').trim(),
        pttypeno: String(row.pttypeno || '').trim(),
        hospmain: String(row.hospmain || '').trim(),
        hospsub: String(row.hospsub || '').trim(),
        dchstts: String(row.dchstts || '').trim(),
        dchtype: String(row.dchtype || '').trim(),
        summary_status: String(row.summary_status || '').trim(),
        income: Number(row.income || 0),
        uc_money: Number(row.uc_money || 0),
        discount_money: Number(row.discount_money || 0),
        paid_money: Number(row.paid_money || 0),
        rcpt_money: Number(row.rcpt_money || 0),
        rcpno: String(row.rcpno || '').trim(),
        debit: Number(row.debit || 0),
        max_debt_amount: row.max_debt_amount != null ? Number(row.max_debt_amount) : null,
        follow_money: Number(row.follow_money || 0),
        bill: row.bill ? String(row.bill).trim() : null,
        billdate: row.billdate ? String(row.billdate).trim() : null,
        staff: String(row.staff || '').trim(),
        address: String(row.address || '').trim(),
        mobile: String(row.mobile || '').trim(),
        tel: String(row.tel || '').trim(),
        rep: repVal || null,
        rep_remark: row.rep_remark ? String(row.rep_remark).trim() : null,
        invoice: invVal || null,
        compensated: Number(row.compensated || 0),
        onweb_cid: onwebCid || null,
        anonweb: onwebAn || null,
        isOnAmed,
        hasRep,
      }
    })

    // Dual-mode summaryCohort filtering (pttypes takes precedence, ucOnly fallback)
    const enrichedAllItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      resolveSeamlessFetcher(gateway),
      Boolean(params.refresh)
    )
    let summaryCohort = enrichedAllItems
    if (params.pttypes) {
      summaryCohort = enrichedAllItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = enrichedAllItems.filter((i) => i.isUc)
    }

    // Compute Tier 1 Aggregated Summary from summaryCohort
    const totalCases = summaryCohort.length
    let onAmedCases = 0
    let notOnAmedCases = 0
    let withAuthenCases = 0
    let noAuthenCases = 0
    let withRepCases = 0
    let noRepCases = 0
    let withDebitCases = 0
    let totalIncome = 0
    let totalDebit = 0
    let totalAdjrw = 0
    let totalLos = 0

    for (const item of summaryCohort) {
      if (item.isOnAmed) onAmedCases++
      else notOnAmedCases++

      if (item.hasAuthen) withAuthenCases++
      else noAuthenCases++

      if (item.hasRep) withRepCases++
      else noRepCases++

      if (item.debit > 0) withDebitCases++

      totalIncome += item.income
      totalDebit += item.debit
      totalAdjrw += item.adjrw
      totalLos += item.los
    }

    const avgLos = totalCases > 0 ? Number((totalLos / totalCases).toFixed(2)) : 0

    const summary: HomewardSummary = {
      totalCases,
      onAmedCases,
      notOnAmedCases,
      withAuthenCases,
      noAuthenCases,
      withRepCases,
      noRepCases,
      withDebitCases,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalAdjrw: Math.round(totalAdjrw * 10000) / 10000,
      avgLos,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedRepsList = parseRepFilterParam(params.reps)

    // Apply Card Filtering
    let filtered = summaryCohort
    if (cardFilter === 'ON_AMED') {
      filtered = filtered.filter((i) => i.isOnAmed)
    } else if (cardFilter === 'NOT_ON_AMED') {
      filtered = filtered.filter((i) => !i.isOnAmed)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => i.hasAuthen)
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.hasAuthen)
    } else if (cardFilter === 'WITH_REP') {
      filtered = filtered.filter((i) => i.hasRep)
    } else if (cardFilter === 'NO_REP') {
      filtered = filtered.filter((i) => !i.hasRep)
    } else if (cardFilter === 'WITH_DEBIT') {
      filtered = filtered.filter((i) => i.debit > 0)
    }
    if (selectedRepsList.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedRepsList))
    }

    // Apply Unified Search
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.an.toLowerCase().includes(search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.pdx.toLowerCase().includes(search) ||
          i.pdxname.toLowerCase().includes(search) ||
          i.sdx.toLowerCase().includes(search) ||
          i.ward.toLowerCase().includes(search) ||
          i.clinic.toLowerCase().includes(search) ||
          i.pttypename.toLowerCase().includes(search) ||
          i.admdoctor.toLowerCase().includes(search) ||
          i.dchdoctor.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.invoice && i.invoice.toLowerCase().includes(search))
        )
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'dchdate') {
        cmp = a.dchdate.localeCompare(b.dchdate)
      } else if (sortBy === 'admdate') {
        cmp = a.admdate.localeCompare(b.admdate)
      } else if (sortBy === 'an') {
        cmp = a.an.localeCompare(b.an)
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname)
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'los') {
        cmp = a.los - b.los
      } else if (sortBy === 'pdx') {
        cmp = a.pdx.localeCompare(b.pdx)
      } else if (sortBy === 'income') {
        cmp = a.income - b.income
      } else if (sortBy === 'debit') {
        cmp = a.debit - b.debit
      } else if (sortBy === 'adjrw') {
        cmp = a.adjrw - b.adjrw
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Pagination (Tier 2 Paginated List)
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const pagedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    // Re-index displayed items
    pagedItems.forEach((it, idx) => {
      it.no = exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1
    })

    return {
      ds1,
      ds2,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      summary,
      repBreakdown,
      items: pagedItems,
    }
  }
}
