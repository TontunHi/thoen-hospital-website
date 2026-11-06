import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams, type QueryExecutor } from './rcmDashboardService'

// ── Common Domain Types: กองทุนการตรวจหลังคลอด (PNC) ─────────────────────────

export type PostpartumCompensationFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'HAS_AUTHEN'
  | 'NO_AUTHEN'
  | 'HAS_PDX'
  | 'HAS_OP'

export type PostpartumSearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN' | 'DIAG' | 'PTTYPE'

export type PostpartumSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface PostpartumAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface PostpartumAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: PostpartumAdpMappingItem[]
}

export interface PostpartumServiceItem {
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
  operation: string | null
  listname: string | null
  listname1: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
}

export interface PostpartumServiceSummary {
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

// ── Aliases for 7.2 (บริการ 30015 ตรวจหลังคลอด) ─────────────────────────────
export type PostpartumService72Item = PostpartumServiceItem
export type PostpartumService72Summary = PostpartumServiceSummary
export interface PostpartumService72Params extends FiscalDateRangeParams {
  compensationFilter?: PostpartumCompensationFilter
  searchField?: PostpartumSearchField
  search?: string
  sortBy?: PostpartumSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}
export interface PostpartumService72Result {
  ds1: string
  ds2: string
  adpMapping: PostpartumAdpMappingCheck
  compensationFilter: PostpartumCompensationFilter
  searchField: PostpartumSearchField
  search: string
  sortBy: PostpartumSortField
  sortOrder: 'asc' | 'desc'
  summary: PostpartumService72Summary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: PostpartumService72Item[]
}

// ── Aliases for 7.3 (บริการ 30016 การจ่ายยา Triforine ADP) ────────────────────
export type PostpartumService30016Item = PostpartumServiceItem
export type PostpartumService30016Summary = PostpartumServiceSummary
export type PostpartumService30016Params = PostpartumService72Params
export interface PostpartumService30016Result {
  ds1: string
  ds2: string
  adpMapping: PostpartumAdpMappingCheck
  compensationFilter: PostpartumCompensationFilter
  searchField: PostpartumSearchField
  search: string
  sortBy: PostpartumSortField
  sortOrder: 'asc' | 'desc'
  summary: PostpartumService30016Summary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: PostpartumService30016Item[]
}

// ── 2. Service Implementation ──────────────────────────────────────────

export class RcmPostpartumService {
  /**
   * Checks whether NHSO ADP code 30015 is mapped in HOSxP `s_drugitems` table.
   */
  static async check72AdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PostpartumAdpMappingCheck> {
    try {
      const rows = await executor(
        `
        SELECT icode, name, strength, nhso_adp_code
        FROM s_drugitems
        WHERE TRIM(nhso_adp_code) IN ('30015')
        ORDER BY icode ASC
        `
      )

      const items: PostpartumAdpMappingItem[] = (rows || []).map((r: any) => ({
        icode: String(r.icode || '').trim(),
        name: String(r.name || '').trim(),
        strength: r.strength ? String(r.strength).trim() : null,
        nhso_adp_code: String(r.nhso_adp_code || '').trim(),
      }))

      return {
        isMapped: items.length > 0,
        mappedCount: items.length,
        items,
      }
    } catch {
      return {
        isMapped: false,
        mappedCount: 0,
        items: [],
      }
    }
  }

  static async check30015AdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PostpartumAdpMappingCheck> {
    return this.check72AdpMapping(executor)
  }

  /**
   * Checks whether NHSO ADP code 30016 is mapped in HOSxP `s_drugitems` table.
   * Mirrors FoxPro check:
   * select count(*) from s_drugitems where nhso_adp_code in ('30016')
   */
  static async check30016AdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PostpartumAdpMappingCheck> {
    try {
      const rows = await executor(
        `
        SELECT icode, name, strength, nhso_adp_code
        FROM s_drugitems
        WHERE TRIM(nhso_adp_code) IN ('30016')
        ORDER BY icode ASC
        `
      )

      const items: PostpartumAdpMappingItem[] = (rows || []).map((r: any) => ({
        icode: String(r.icode || '').trim(),
        name: String(r.name || '').trim(),
        strength: r.strength ? String(r.strength).trim() : null,
        nhso_adp_code: String(r.nhso_adp_code || '').trim(),
      }))

      return {
        isMapped: items.length > 0,
        mappedCount: items.length,
        items,
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
   * Helper to retrieve report for an arbitrary ADP code (30015 or 30016)
   */
  private static async executeReport(
    adpCode: '30015' | '30016',
    cachePrefix: string,
    params: PostpartumService72Params,
    executor: QueryExecutor
  ): Promise<{
    ds1: string
    ds2: string
    adpMapping: PostpartumAdpMappingCheck
    compensationFilter: PostpartumCompensationFilter
    searchField: PostpartumSearchField
    search: string
    sortBy: PostpartumSortField
    sortOrder: 'asc' | 'desc'
    summary: PostpartumServiceSummary
    totalCount: number
    page: number
    pageSize: number
    totalPages: number
    items: PostpartumServiceItem[]
  }> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const compensationFilter: PostpartumCompensationFilter = params.compensationFilter || 'ALL'
    const searchField: PostpartumSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: PostpartumSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `${cachePrefix}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          adpCode === '30015'
            ? RcmPostpartumService.check72AdpMapping(executor)
            : RcmPostpartumService.check30016AdpMapping(executor),
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
              cc.AuthenCode AS authencode,
              ptt.name AS pttypename,
              dep.department,
              spc.name AS clinic,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              dd.name AS listname,
              (SELECT GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ')
               FROM opitemrece a
               JOIN nondrugitems b ON b.icode = a.icode
               WHERE a.vn = o.vn) AS listname1,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
              re.fund,
              re.subfund
            FROM ovst o
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            JOIN (
              SELECT 
                oo.vn, 
                GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate BETWEEN ? AND ?
                AND TRIM(d.nhso_adp_code) IN ('${adpCode}')
              GROUP BY oo.vn
            ) dd ON dd.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) rep ON rep.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                     GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
              GROUP BY vn
            ) re ON re.vn = o.vn
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
            WHERE o.vstdate BETWEEN ? AND ?
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC
            `,
            [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
            { timeoutMs: 90000 }
          ),
        ])

        return { rawRows: rows as Record<string, unknown>[], adpMapping: mappingRes }
      },
      600
    )

    const allItems: PostpartumServiceItem[] = rawRows.map((r, idx) => {
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
        operation: null,
        listname: r.listname ? String(r.listname).trim() : null,
        listname1: r.listname1 ? String(r.listname1).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: compensated > 0,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
      }
    })

    // Calculate Summary Metrics on all visits before filtering
    const totalVisits = allItems.length
    const uniqueHns = new Set(allItems.map((i) => i.hn).filter(Boolean))
    const uniquePatients = uniqueHns.size

    let compensatedVisits = 0
    let uncompensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let withPdxCount = 0
    let withOpCount = 0

    for (const item of allItems) {
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      } else {
        uncompensatedVisits++
      }

      if (item.authencode) withAuthenCount++
      else withoutAuthenCount++

      if (item.pdx) withPdxCount++
      if (item.op0 || item.op1 || item.op2 || item.op3 || item.op4 || item.op5) {
        withOpCount++
      }
    }

    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0

    const summary: PostpartumServiceSummary = {
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

    // Apply Filter & Search
    let filtered = allItems

    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (compensationFilter === 'HAS_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (compensationFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (compensationFilter === 'HAS_PDX') {
      filtered = filtered.filter((i) => Boolean(i.pdx))
    } else if (compensationFilter === 'HAS_OP') {
      filtered = filtered.filter((i) => Boolean(i.op0 || i.op1 || i.op2 || i.op3 || i.op4 || i.op5))
    }

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'PTTYPE') return (i.pttypename || '').toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          const dxStr = [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return dxStr.includes(search)
        }
        // ALL
        const fullStr = [
          i.hn,
          i.cid,
          i.ptname,
          i.vn,
          i.pdx,
          i.dx0,
          i.dx1,
          i.op0,
          i.pttypename,
          i.department,
          i.status,
          i.rep,
          i.authencode,
          i.listname,
          i.listname1,
          i.fund,
          i.subfund,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return fullStr.includes(search)
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (valA == null && valB == null) return 0
      if (valA == null) return sortOrder === 'asc' ? -1 : 1
      if (valB == null) return sortOrder === 'asc' ? 1 : -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      valA = String(valA).toLowerCase()
      valB = String(valB).toLowerCase()
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let items: PostpartumServiceItem[]
    if (exportAll) {
      items = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      items = filtered
        .slice(startIndex, startIndex + pageSize)
        .map((item, idx) => ({ ...item, no: startIndex + idx + 1 }))
    }

    return {
      ds1,
      ds2,
      adpMapping,
      compensationFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items,
    }
  }

  /**
   * Retrieves Postpartum Care 7.2 report (ADP 30015 ตรวจหลังคลอด)
   */
  static async getService72Report(
    params: PostpartumService72Params = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PostpartumService72Result> {
    return this.executeReport('30015', 'rcm-postpartum-7-2-30015', params, executor)
  }

  /**
   * Retrieves Postpartum Care 7.3 report (ADP 30016 การจ่ายยา Triforine ADP)
   */
  static async getService30016Report(
    params: PostpartumService30016Params = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PostpartumService30016Result> {
    return this.executeReport('30016', 'rcm-postpartum-7-3-30016', params, executor)
  }

  static async getService73Report(
    params: PostpartumService30016Params = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PostpartumService30016Result> {
    return this.getService30016Report(params, executor)
  }
}
