import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams, type QueryExecutor } from './rcmDashboardService'

// ── 1. Domain Types: 23.1 บริการตรวจคัดกรองไวรัสตับอักเสบ B (ADP 36318, 36319) ──

export type ViralHepatitisCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'WITH_LAB'
  | 'NO_LAB'
  | 'UC_ONLY'

export type ViralHepatitisSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'LABRESULT'

export type ViralHepatitisSortField =
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
  | 'labresult'

export interface ViralHepatitisReportParams extends FiscalDateRangeParams {
  cardFilter?: ViralHepatitisCardFilter
  ucOnly?: boolean
  searchField?: ViralHepatitisSearchField
  search?: string
  sortBy?: ViralHepatitisSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface ViralHepatitisAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
  source: 's_drugitems' | 'nondrugitems'
}

export interface ViralHepatitisAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: ViralHepatitisAdpMappingItem[]
}

export interface ViralHepatitisItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
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
  cc: string | null
  pdx: string | null
  dx0: string | null
  dx1: string | null
  dx2: string | null
  dx3: string | null
  dx4: string | null
  dx5: string | null
  sdx: string | null
  op0: string | null
  op1: string | null
  op2: string | null
  op3: string | null
  op4: string | null
  op5: string | null
  ops: string | null
  income: number
  listname: string | null
  labresult: string | null
  hasLabResult: boolean
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  status_sm: string | null
  rep_sm: string | null
  compensated_sm: number
  address: string | null
  mobile: string | null
  tel: string | null
  fund: string | null
  subfund: string | null
}

export interface ViralHepatitisSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  withLabCount: number
  withoutLabCount: number
  labRate: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface ViralHepatitisReportResult {
  ds1: string
  ds2: string
  adpMapping: ViralHepatitisAdpMappingCheck
  cardFilter: ViralHepatitisCardFilter
  ucOnly: boolean
  searchField: ViralHepatitisSearchField
  search: string
  sortBy: ViralHepatitisSortField
  sortOrder: 'asc' | 'desc'
  summary: ViralHepatitisSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: ViralHepatitisItem[]
}

// ── 2. Helper Functions ───────────────────────────────────────────────────────

export function isUniversalCoverageScheme(maininscl?: string | null, pttypename?: string | null): boolean {
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

// ── 3. RcmViralHepatitisService Implementation ──────────────────────────────────

export class RcmViralHepatitisService {
  /**
   * Check if ADP codes '36318', '36319' are mapped in s_drugitems or nondrugitems.
   * Mirrors legacy FoxPro check:
   * select count(*) from s_drugitems where nhso_adp_code in ('36318','36319')
   */
  static async checkViralHepatitisAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh?: boolean
  ): Promise<ViralHepatitisAdpMappingCheck> {
    const cacheKey = 'rcm-viral-hepatitis-adp-mapping-check-36318-36319'
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
              nhso_adp_code,
              's_drugitems' AS source
            FROM s_drugitems 
            WHERE TRIM(nhso_adp_code) IN ('36318', '36319')
            UNION ALL
            SELECT 
              icode, 
              name, 
              NULL AS strength, 
              nhso_adp_code,
              'nondrugitems' AS source
            FROM nondrugitems 
            WHERE TRIM(nhso_adp_code) IN ('36318', '36319')
            ORDER BY nhso_adp_code ASC, icode ASC;
          `
          const rows = (await executor(sql, [], { timeoutMs: 15000 })) as any[]
          const items: ViralHepatitisAdpMappingItem[] = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
            source: r.source === 'nondrugitems' ? 'nondrugitems' : 's_drugitems',
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
      },
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate 23.1 Viral Hepatitis B Screening Report (บริการตรวจคัดกรองไวรัสตับอักเสบ B ADP 36318, 36319)
   * Direct translation of legacy FoxPro logic:
   * - Queries visits with dispensing of ADP 36318, 36319 in opitemrece
   * - Joins lab results from lab_head + lab_order + lab_items + nondrugitems
   * - Joins HOSxP patient, ovst, vn_stat, opdscreen, pttype, kskdepartment, spclty
   * - Joins authencode, NHSO repeclaim, repdata, neweclaim, eclaimdb, seamless, ktb_confirm
   * - Aggregates KPIs, calculates card filter counts, supports sorting, search, pagination.
   */
  static async getViralHepatitisReport(
    params: ViralHepatitisReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<ViralHepatitisReportResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: ViralHepatitisCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const searchField: ViralHepatitisSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ViralHepatitisSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-viral-hepatitis-report-36318-36319-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-viral-hepatitis-adp-mapping-check-36318-36319')
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          RcmViralHepatitisService.checkViralHepatitisAdpMapping(executor, Boolean(params.refresh)),
          executor(
            `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              cc.AuthenCode AS authencode,
              IFNULL(ptt.hipdata_code, '') AS maininscl,
              ptt.name AS pttypename,
              dep.department AS department,
              spc.name AS clinic,
              IFNULL(s.cc, '') AS cc,
              v.pdx,
              v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              IFNULL(v.income, 0) AS income,
              dd.name AS listname,
              l.labresult AS labresult,
              CASE
                WHEN sm.vn IS NOT NULL THEN CONCAT(sm.status, ' Seamless')
                WHEN nhso.statusname IS NOT NULL THEN nhso.statusname
                WHEN cf.vn IS NOT NULL THEN 'KTB :: ส่งแล้ว'
                WHEN rep.statusname IS NOT NULL THEN rep.statusname
                WHEN nn.StatusName IS NOT NULL THEN nn.StatusName
                WHEN m.statusname IS NOT NULL THEN m.statusname
                ELSE '-::ยังไม่ได้ส่ง'
              END AS status,
              CASE
                WHEN sm.vn IS NOT NULL THEN sm.rep
                WHEN nhso.rep IS NOT NULL THEN nhso.rep
                WHEN rep.rep IS NOT NULL THEN rep.rep
                WHEN nn.Rep IS NOT NULL THEN nn.Rep
                WHEN m.rep IS NOT NULL THEN m.rep
                ELSE NULL
              END AS rep,
              CASE
                WHEN sm.vn IS NOT NULL THEN sm.compensated
                WHEN nhso.compensated IS NOT NULL THEN nhso.compensated
                WHEN rep.compensated IS NOT NULL THEN rep.compensated
                WHEN nn.Income IS NOT NULL THEN nn.Income
                WHEN m.compensated IS NOT NULL THEN m.compensated
                ELSE 0
              END AS compensated,
              sm.status AS status_sm,
              sm.rep AS rep_sm,
              sm.compensated AS compensated_sm,
              pt.informaddr AS address,
              pt.mobile_phone_number AS mobile,
              CONCAT_WS(' ', NULLIF(pt.informtel, ''), NULLIF(pt.hometel, '')) AS tel,
              rep.fund,
              rep.subfund
            FROM (
              SELECT 
                oo.vn,
                GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN (
                SELECT icode, name, strength 
                FROM s_drugitems 
                WHERE TRIM(nhso_adp_code) IN ('36318', '36319')
                UNION ALL
                SELECT icode, name, NULL AS strength 
                FROM nondrugitems 
                WHERE TRIM(nhso_adp_code) IN ('36318', '36319')
              ) d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate BETWEEN ? AND ?
              GROUP BY oo.vn
            ) dd
            JOIN ovst o ON o.vn = dd.vn
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN opdscreen s ON s.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN (
              SELECT 
                lh.vn,
                GROUP_CONCAT(DISTINCT lo.lab_order_result SEPARATOR ', ') AS labresult
              FROM lab_head lh 
              JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
              JOIN lab_items l ON l.lab_items_code = lo.lab_items_code
              JOIN nondrugitems d ON d.icode = l.icode 
              WHERE lh.order_date BETWEEN ? AND ?
                AND TRIM(d.nhso_adp_code) IN ('36318', '36319')
              GROUP BY lh.vn
            ) l ON l.vn = o.vn
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
                     GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
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
            LEFT JOIN (
              SELECT 
                vn,
                SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY vn), ',', 1) AS status,
                SUBSTRING_INDEX(GROUP_CONCAT(rep ORDER BY vn), ',', 1) AS rep,
                SUM(compensated) AS compensated
              FROM rcmdb.seamless
              WHERE IFNULL(vn, '') <> ''
              GROUP BY vn
            ) sm ON sm.vn = o.vn
            LEFT JOIN (
              SELECT vn
              FROM rcmdb.ktb_confirm
              WHERE IFNULL(vn, '') <> ''
              GROUP BY vn
            ) cf ON cf.vn = o.vn
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC;
          `,
            [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
            { timeoutMs: 90000 }
          ),
        ])

        return { rawRows: rows as any[], adpMapping: mappingRes }
      },
      180000 // Cache TTL 3 minutes
    )

    // Transform raw rows into structured domain items
    const allItems: ViralHepatitisItem[] = (rawRows || []).map((r, idx) => {
      const compensatedVal = Number(r.compensated) || 0
      const isComp =
        compensatedVal > 0 ||
        Boolean(r.rep) ||
        (r.status && !r.status.includes('ยังไม่ได้ส่ง'))

      const isUc = isUniversalCoverageScheme(r.maininscl, r.pttypename)
      const labResultVal = r.labresult ? String(r.labresult).trim() : null
      const hasLab = Boolean(labResultVal)

      const sDxList = [r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
        .map((d) => (d ? String(d).trim() : ''))
        .filter(Boolean)
      const sdx = sDxList.length > 0 ? sDxList.join(', ') : null

      const opList = [r.op0, r.op1, r.op2, r.op3, r.op4, r.op5]
        .map((o) => (o ? String(o).trim() : ''))
        .filter(Boolean)
      const ops = opList.length > 0 ? opList.join(', ') : null

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        age: Number(r.age) || 0,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        maininscl: String(r.maininscl || '').trim(),
        isUc,
        pttypename: String(r.pttypename || '').trim(),
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        cc: r.cc ? String(r.cc).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        sdx,
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        ops,
        income: Number(r.income) || 0,
        listname: r.listname ? String(r.listname).trim() : null,
        labresult: labResultVal,
        hasLabResult: hasLab,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated: Boolean(isComp),
        status_sm: r.status_sm ? String(r.status_sm).trim() : null,
        rep_sm: r.rep_sm ? String(r.rep_sm).trim() : null,
        compensated_sm: Number(r.compensated_sm) || 0,
        address: r.address ? String(r.address).trim() : null,
        mobile: r.mobile ? String(r.mobile).trim() : null,
        tel: r.tel ? String(r.tel).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
      }
    })

    // Compute Overall Summary Statistics
    const totalVisits = allItems.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withLabCount = 0
    let ucCount = 0
    let totalIncome = 0

    for (const item of allItems) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCount++
      if (item.hasLabResult) withLabCount++
      if (item.isUc) ucCount++
      totalIncome += item.income
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const withoutLabCount = totalVisits - withLabCount
    const labRate = totalVisits > 0 ? (withLabCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0

    const summary: ViralHepatitisSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      withLabCount,
      withoutLabCount,
      labRate,
      ucCount,
      ucRate,
      totalIncome,
    }

    // Filter Items by Card Filter
    let filteredItems = allItems.filter((item) => {
      if (cardFilter === 'COMPENSATED' && !item.isCompensated) return false
      if (cardFilter === 'UNCOMPENSATED' && item.isCompensated) return false
      if (cardFilter === 'WITH_AUTHEN' && !item.authencode) return false
      if (cardFilter === 'NO_AUTHEN' && item.authencode) return false
      if (cardFilter === 'WITH_LAB' && !item.hasLabResult) return false
      if (cardFilter === 'NO_LAB' && item.hasLabResult) return false
      if (cardFilter === 'UC_ONLY' && !item.isUc) return false
      if (ucOnly && !item.isUc) return false
      return true
    })

    // Filter Items by Search Term
    if (search) {
      filteredItems = filteredItems.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return item.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (item.pdx || '').toLowerCase().includes(search) ||
            (item.sdx || '').toLowerCase().includes(search)
          )
        }
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)
        if (searchField === 'LABRESULT') {
          return (item.labresult || '').toLowerCase().includes(search)
        }

        // Global search across all fields
        return (
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.pdx || '').toLowerCase().includes(search) ||
          (item.sdx || '').toLowerCase().includes(search) ||
          (item.listname || '').toLowerCase().includes(search) ||
          (item.labresult || '').toLowerCase().includes(search) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.authencode || '').toLowerCase().includes(search) ||
          (item.rep || '').toLowerCase().includes(search) ||
          (item.status || '').toLowerCase().includes(search)
        )
      })
    }

    // Sort Items
    filteredItems.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'vstdate') {
        cmp = a.vstdate.localeCompare(b.vstdate)
        if (cmp === 0) cmp = a.vsttime.localeCompare(b.vsttime)
      } else if (sortBy === 'vsttime') {
        cmp = a.vsttime.localeCompare(b.vsttime)
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname, 'th')
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'income') {
        cmp = a.income - b.income
      } else if (sortBy === 'compensated') {
        cmp = a.compensated - b.compensated
      } else if (sortBy === 'pdx') {
        cmp = (a.pdx || '').localeCompare(b.pdx || '')
      } else if (sortBy === 'authencode') {
        cmp = (a.authencode || '').localeCompare(b.authencode || '')
      } else if (sortBy === 'labresult') {
        cmp = (a.labresult || '').localeCompare(b.labresult || '', 'th')
      }

      return sortOrder === 'desc' ? -cmp : cmp
    })

    // Re-index row numbers
    const totalCount = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let resultItems: ViralHepatitisItem[]
    if (exportAll) {
      resultItems = filteredItems.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIdx = (page - 1) * pageSize
      resultItems = filteredItems
        .slice(startIdx, startIdx + pageSize)
        .map((item, idx) => ({ ...item, no: startIdx + idx + 1 }))
    }

    return {
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: resultItems,
    }
  }
}
