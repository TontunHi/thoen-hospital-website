import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
  type QueryExecutor,
} from './rcmDashboardService'

// ── 1. Domain Types: กองทุน Walkin - รายชื่อผู้รับบริการจาก ADP (WALKIN) ──

export type WalkinFundCardFilter =
  | 'ALL'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'COMPENSATED'
  | 'INVOICE'
  | 'UNSENT'
  | 'UC_ONLY'

export type WalkinFundSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'

export type WalkinFundSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'pdx'
  | 'authencode'
  | 'pttypename'

export interface WalkinFundReportParams extends FiscalDateRangeParams {
  cardFilter?: WalkinFundCardFilter
  ucOnly?: boolean
  searchField?: WalkinFundSearchField
  search?: string
  sortBy?: WalkinFundSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface WalkinAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface WalkinAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: WalkinAdpMappingItem[]
}

export interface WalkinFundItem {
  no: number
  vn: string
  an: string | null
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  isUc: boolean
  pttypename: string
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
  income: number
  listname: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  transactiontype: string | null
  invoice: string | null
  invoice_compensated: number
  resource: string | null
  subfund: string | null
  remark: string | null
  projectcode: string | null
}

export interface WalkinFundSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  invoiceVisits: number
  totalInvoiceCompensated: number
  unsentVisits: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface WalkinFundReportResult {
  title: string
  adpCode: string
  ds1: string
  ds2: string
  cardFilter: WalkinFundCardFilter
  ucOnly: boolean
  search: string
  sortBy: WalkinFundSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  items: WalkinFundItem[]
  summary: WalkinFundSummary
  adpMapping: WalkinAdpMappingCheck
}

// ── 2. Business Logic Helpers ─────────────────────────────────

export function isUniversalCoverageScheme(
  maininscl?: string | null,
  pttypename?: string | null
): boolean {
  if (maininscl) {
    const code = maininscl.trim().toUpperCase()
    if (code === 'UCS' || code === 'WEL' || code === 'UC') return true
  }
  if (pttypename) {
    const text = pttypename.toLowerCase()
    if (
      text.includes('บัตรทอง') ||
      text.includes('ประกันสุขภาพถ้วนหน้า') ||
      text.includes('30 บาท') ||
      text.includes('uc')
    ) {
      return true
    }
  }
  return false
}

// ── 3. Service Implementation ─────────────────────────────────

export class RcmWalkinFundService {
  /**
   * Check if ADP code 'WALKIN' is mapped in s_drugitems table.
   */
  static async checkAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh?: boolean
  ): Promise<WalkinAdpMappingCheck> {
    const adpCode = 'WALKIN'
    const cacheKey = `rcm-walkin-fund-adp-mapping-check-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
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
            WHERE TRIM(nhso_adp_code) = ?
            ORDER BY icode ASC;
          `
          const rows = (await executor(sql, [adpCode], { timeoutMs: 15000 })) as any[]
          const items: WalkinAdpMappingItem[] = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))

          return {
            adpCode,
            isMapped: items.length > 0,
            mappedCount: items.length,
            items,
          }
        } catch {
          return {
            adpCode,
            isMapped: false,
            mappedCount: 0,
            items: [],
          }
        }
      },
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate Walkin Fund Report:
   * - Queries visits with ADP code 'WALKIN' in opitemrece via Driving Subquery Pattern
   * - Resolves AuthenCode, patient info, diagnosis, and reimbursement statuses
   * - Aggregates KPIs, calculates card filter counts, supports sorting, search, pagination.
   */
  static async getReportData(
    params: WalkinFundReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<WalkinFundReportResult> {
    const adpCode = 'WALKIN'
    const reportTitle = 'กองทุน Walkin: รายชื่อผู้รับบริการจาก ADP (WALKIN)'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: WalkinFundCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: WalkinFundSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(1, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-walkin-fund-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-walkin-fund-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const sql = `
          SELECT 
            o.vn,
            o.an,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            IFNULL(pt.sex, '') AS sex_code,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            IFNULL(nat.name, pt.nationality) AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            cc.AuthenCode AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            ptt.name AS pttypename,
            dep.department AS department,
            spc.name AS clinic,
            v.pdx,
            v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
            IFNULL(v.income, 0) AS income,
            dd.name AS listname,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
            rep.transactiontype,
            nhso.rep AS invoice,
            IFNULL(nhso.compensated, 0) AS invoice_compensated,
            rep.agency AS resource,
            rep.subfund,
            rep.remark,
            rep.projectcode
          FROM (
            SELECT 
              oo.vn,
              oo.an,
              oo.vstdate,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE IFNULL(oo.vn, '') <> ''
              AND oo.vstdate BETWEEN ? AND ?
              AND TRIM(d.nhso_adp_code) = ?
            GROUP BY oo.vn
          ) dd
          JOIN ovst o ON o.vn = dd.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'NHSO :: มี Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = o.vn
          LEFT JOIN (
            SELECT vn,
                   GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
                   SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
                   IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: มี Rep แล้ว', NULL) AS statusname,
                   GROUP_CONCAT(DISTINCT agency SEPARATOR ',') AS agency,
                   GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund,
                   GROUP_CONCAT(DISTINCT errorcode SEPARATOR ',') AS errorcode,
                   GROUP_CONCAT(DISTINCT transactiontype SEPARATOR ',') AS transactiontype,
                   GROUP_CONCAT(DISTINCT remark SEPARATOR ',') AS remark,
                   GROUP_CONCAT(DISTINCT projectcode SEPARATOR ',') AS projectcode
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
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
            WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> '' AND m.dateadm BETWEEN ? AND ?
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          ORDER BY o.hn ASC, o.vn ASC;
        `

        const [rows, adpCheck] = await Promise.all([
          executor(
            sql,
            [ds1, ds2, adpCode, ds1, ds2, ds1, ds2, ds1, ds2],
            { timeoutMs: 90000 }
          ),
          this.checkAdpMapping(executor, params.refresh),
        ])

        return {
          rawRows: (rows || []) as any[],
          adpMapping: adpCheck,
        }
      },
      300000 // Cache TTL 5 minutes
    )

    // Process Raw Rows
    let transformedItems: WalkinFundItem[] = rawRows.map((row: any, index: number) => {
      const compensatedVal = Number(row.compensated || 0)
      const invoiceCompVal = Number(row.invoice_compensated || 0)
      const isComp = compensatedVal > 0 || (Boolean(row.rep) && String(row.rep).trim() !== '')
      const maininscl = String(row.maininscl || '').trim()
      const pttypename = String(row.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename)

      return {
        no: index + 1,
        vn: String(row.vn || '').trim(),
        an: row.an ? String(row.an).trim() : null,
        cid: String(row.cid || '').trim(),
        hn: String(row.hn || '').trim(),
        ptname: String(row.ptname || '').trim(),
        sex: formatThaiSex(row.sex_code, row.sex),
        age: Number(row.age || 0),
        nation: row.nation ? String(row.nation).trim() : null,
        vstdate: String(row.vstdate || ''),
        vsttime: String(row.vsttime || ''),
        authencode: row.authencode ? String(row.authencode).trim() : null,
        maininscl,
        isUc,
        pttypename,
        department: row.department ? String(row.department).trim() : null,
        clinic: row.clinic ? String(row.clinic).trim() : null,
        pdx: row.pdx ? String(row.pdx).trim() : null,
        dx0: row.dx0 ? String(row.dx0).trim() : null,
        dx1: row.dx1 ? String(row.dx1).trim() : null,
        dx2: row.dx2 ? String(row.dx2).trim() : null,
        dx3: row.dx3 ? String(row.dx3).trim() : null,
        dx4: row.dx4 ? String(row.dx4).trim() : null,
        dx5: row.dx5 ? String(row.dx5).trim() : null,
        op0: row.op0 ? String(row.op0).trim() : null,
        op1: row.op1 ? String(row.op1).trim() : null,
        op2: row.op2 ? String(row.op2).trim() : null,
        op3: row.op3 ? String(row.op3).trim() : null,
        op4: row.op4 ? String(row.op4).trim() : null,
        op5: row.op5 ? String(row.op5).trim() : null,
        income: Number(row.income || 0),
        listname: row.listname ? String(row.listname).trim() : null,
        status: row.status ? String(row.status).trim() : null,
        rep: row.rep ? String(row.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated: isComp,
        transactiontype: row.transactiontype ? String(row.transactiontype).trim() : null,
        invoice: row.invoice ? String(row.invoice).trim() : null,
        invoice_compensated: invoiceCompVal,
        resource: row.resource ? String(row.resource).trim() : null,
        subfund: row.subfund ? String(row.subfund).trim() : null,
        remark: row.remark ? String(row.remark).trim() : null,
        projectcode: row.projectcode ? String(row.projectcode).trim() : null,
      }
    })

    // Compute Summary from all records
    const totalVisits = transformedItems.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let invoiceVisits = 0
    let totalInvoiceCompensated = 0
    let withAuthenCount = 0
    let ucCount = 0
    let totalIncome = 0

    for (const item of transformedItems) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      if (item.invoice) {
        invoiceVisits++
        totalInvoiceCompensated += item.invoice_compensated
      }
      if (item.authencode) {
        withAuthenCount++
      }
      if (item.isUc) {
        ucCount++
      }
      totalIncome += item.income
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const unsentVisits = transformedItems.filter(
      (it) => !it.isCompensated && !it.invoice && (!it.status || it.status === '')
    ).length
    const withoutAuthenCount = totalVisits - withAuthenCount
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0

    const summary: WalkinFundSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      invoiceVisits,
      totalInvoiceCompensated,
      unsentVisits,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
      totalIncome,
    }

    // Apply Filter (Card Filter, UC Only)
    let filteredItems = transformedItems

    if (cardFilter === 'WITH_AUTHEN') {
      filteredItems = filteredItems.filter((it) => Boolean(it.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filteredItems = filteredItems.filter((it) => !it.authencode)
    } else if (cardFilter === 'COMPENSATED') {
      filteredItems = filteredItems.filter((it) => it.isCompensated)
    } else if (cardFilter === 'INVOICE') {
      filteredItems = filteredItems.filter((it) => Boolean(it.invoice) && !it.isCompensated)
    } else if (cardFilter === 'UNSENT') {
      filteredItems = filteredItems.filter(
        (it) => !it.isCompensated && !it.invoice && (!it.status || it.status === '')
      )
    } else if (cardFilter === 'UC_ONLY') {
      filteredItems = filteredItems.filter((it) => it.isUc)
    }

    if (ucOnly && cardFilter !== 'UC_ONLY') {
      filteredItems = filteredItems.filter((it) => it.isUc)
    }

    // Apply Unified Global Search
    if (search) {
      filteredItems = filteredItems.filter((it) => {
        return (
          it.hn.toLowerCase().includes(search) ||
          it.cid.includes(search) ||
          it.ptname.toLowerCase().includes(search) ||
          it.vn.toLowerCase().includes(search) ||
          (it.an && it.an.toLowerCase().includes(search)) ||
          (it.pdx && it.pdx.toLowerCase().includes(search)) ||
          it.pttypename.toLowerCase().includes(search) ||
          (it.authencode && it.authencode.toLowerCase().includes(search)) ||
          (it.rep && it.rep.toLowerCase().includes(search)) ||
          (it.listname && it.listname.toLowerCase().includes(search))
        )
      })
    }

    // Sorting
    filteredItems.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (valA === null || valA === undefined) valA = ''
      if (valB === null || valB === undefined) valB = ''

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA)
      const strB = String(valB)
      return sortOrder === 'asc'
        ? strA.localeCompare(strB, 'th-TH')
        : strB.localeCompare(strA, 'th-TH')
    })

    // Re-index displayed numbers
    filteredItems = filteredItems.map((item, idx) => ({
      ...item,
      no: idx + 1,
    }))

    const totalCount = filteredItems.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    // Pagination (or Export All)
    const items = exportAll
      ? filteredItems
      : filteredItems.slice((page - 1) * pageSize, page * pageSize)

    return {
      title: reportTitle,
      adpCode,
      ds1,
      ds2,
      cardFilter,
      ucOnly,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      items,
      summary,
      adpMapping,
    }
  }
}
