import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { matchesPttypeFilter } from './pttypeConstants'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
  type QueryExecutor,
} from './rcmDashboardService'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'

// ── 1. Domain Types: 20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001) ──

export type FluorideVarnishCardFilter =
  | 'ALL'
  | 'TARGET_AGE'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type FluorideVarnishSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'

export type FluorideVarnishSortField =
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

export interface FluorideVarnishReportParams extends FiscalDateRangeParams {
  cardFilter?: FluorideVarnishCardFilter
  ucOnly?: boolean
  pttypes?: string
  targetAgeOnly?: boolean
  searchField?: FluorideVarnishSearchField
  search?: string
  sortBy?: FluorideVarnishSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface FluorideVarnishAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface FluorideVarnishAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: FluorideVarnishAdpMappingItem[]
}

export interface FluorideVarnishItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number
  isTargetAge: boolean // Age between 25 and 59 years
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  pttype_eclaim_id?: string
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
  sdx: string | null
  op0: string | null
  op1: string | null
  op2: string | null
  op3: string | null
  op4: string | null
  op5: string | null
  ops: string | null
  income: number
  listname: string | null // ADP 15001 item name
  listname1?: string | null // Non-drug items
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund: string | null
  subfund: string | null
  errorcode?: string | null
  transactiontype?: string | null
}

export interface FluorideVarnishSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  targetAgeCount: number // อายุ 25-59 ปี
  targetAgeRate: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface FluorideVarnishReportResult {
  title: string
  adpCode: string
  ds1: string
  ds2: string
  cardFilter: FluorideVarnishCardFilter
  ucOnly: boolean
  targetAgeOnly: boolean
  searchField: FluorideVarnishSearchField
  search: string
  sortBy: FluorideVarnishSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  items: FluorideVarnishItem[]
  summary: FluorideVarnishSummary
  adpMapping: FluorideVarnishAdpMappingCheck
}

// ── 2. Business Logic Helpers ─────────────────────────────────

/**
 * Checks if the patient scheme corresponds to Universal Coverage (บัตรทอง / UC / UCS / WEL).
 */
export function isUniversalCoverageScheme(
  maininscl?: string | null,
  pttypename?: string | null,
  pttypeEclaimId?: string | null
): boolean {
  if (pttypeEclaimId) {
    const num = parseInt(pttypeEclaimId.trim(), 10)
    if (!isNaN(num) && num >= 1 && num <= 9) return true
  }
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

export class RcmFluorideVarnishService {
  /**
   * Check if ADP code '15001' is mapped in s_drugitems table.
   */
  static async checkAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh?: boolean
  ): Promise<FluorideVarnishAdpMappingCheck> {
    const adpCode = '15001'
    const cacheKey = `rcm-fluoride-varnish-adp-mapping-check-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      async () => {
        if (executor === queryClinicalDb) {
          try {
            const gwRes = await apiGateway.clinical.getAdpMapping(adpCode)
            if (gwRes && typeof gwRes.isMapped === 'boolean') {
              return {
                adpCode: gwRes.adpCode || adpCode,
                isMapped: gwRes.isMapped,
                mappedCount: gwRes.mappedCount,
                items: (gwRes.items || []).map((r: any) => ({
                  icode: String(r.icode || '').trim(),
                  name: String(r.name || '').trim(),
                  strength: r.strength ? String(r.strength).trim() : null,
                  nhso_adp_code: String(r.nhso_adp_code || '').trim(),
                })),
              }
            }
          } catch {
            // Fallback to executor query
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
          const items: FluorideVarnishAdpMappingItem[] = (rows || []).map((r) => ({
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
   * Generate 20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001) Report:
   * - Queries visits with dispensing of ADP code 15001 in opitemrece
   * - Filters age between 25 and 59 from database, with target age 25-59 years
   * - Aggregates KPIs, calculates card filter counts, supports sorting, search, pagination.
   */
  static async getFluorideVarnishReport(
    params: FluorideVarnishReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<FluorideVarnishReportResult> {
    const adpCode = '15001'
    const reportTitle = '20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001)'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: FluorideVarnishCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const targetAgeOnly = Boolean(params.targetAgeOnly)
    const searchField: FluorideVarnishSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: FluorideVarnishSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fluoride-varnish-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-fluoride-varnish-adp-mapping-check-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const sql = `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              IFNULL(ptt.hipdata_code, '') AS maininscl,
              IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
              ptt.name AS pttypename,
              dep.department AS department,
              spc.name AS clinic,
              v.pdx,
              v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              IFNULL(v.income, 0) AS income,
              dd.name AS listname,
              nd.listname1 AS listname1,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-:ยังไม่ได้ส่ง') AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
              rep.agency,
              rep.fund,
              rep.subfund,
              rep.errorcode,
              rep.transactiontype
            FROM (
              SELECT 
                oo.vn,
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
            LEFT JOIN (
              SELECT 
                a.vn, 
                GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ') AS listname1
              FROM (
                SELECT DISTINCT oo_nd.vn
                FROM opitemrece oo_nd
                JOIN s_drugitems d_nd ON d_nd.icode = oo_nd.icode
                WHERE IFNULL(oo_nd.vn, '') <> ''
                  AND oo_nd.vstdate BETWEEN ? AND ?
                  AND TRIM(d_nd.nhso_adp_code) = ?
              ) target_vn
              JOIN opitemrece a ON a.vn = target_vn.vn
              JOIN nondrugitems b ON b.icode = a.icode
              GROUP BY a.vn
            ) nd ON nd.vn = o.vn
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype vt ON vt.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
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
                     GROUP_CONCAT(DISTINCT transactiontype SEPARATOR ',') AS transactiontype
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
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
              WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> ''
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            WHERE o.vstdate BETWEEN ? AND ?
              AND (
                v.age_y BETWEEN 25 AND 59 
                OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) BETWEEN 25 AND 59
              )
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC;
        `

        const sqlParams: any[] = [
          ds1, ds2, adpCode, // dd
          ds1, ds2, adpCode, // nd (listname1)
          ds1, ds2, // nhso
          ds1, ds2, // rep
          ds1, ds2, // main ovst o
        ]

        let rows: any[] = []
        let mappingRes: FluorideVarnishAdpMappingCheck = {
          adpCode,
          isMapped: false,
          mappedCount: 0,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              RcmFluorideVarnishService.checkAdpMapping(executor, Boolean(params.refresh)),
              apiGateway.clinical.getRcmFundData('fluoride-varnish', { ds1, ds2, adpCode }),
            ])
            mappingRes = mRes
            if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows)) {
              rows = gwRes.data.rawRows
              fetchedViaNamedApi = true
            }
          } catch {
            // Fallback to executor query
          }
        }

        if (!fetchedViaNamedApi) {
          const [mRes, dbRows] = await Promise.all([
            RcmFluorideVarnishService.checkAdpMapping(executor, Boolean(params.refresh)),
            executor(sql, sqlParams, { timeoutMs: 90000 }) as Promise<any[]>,
          ])
          rows = dbRows || []
          mappingRes = mRes
        }

        return {
          rawRows: rows || [],
          adpMapping: mappingRes,
        }
      },
      300000 // Cache TTL 5 minutes
    )

    // Normalize and map items
    const allItems: FluorideVarnishItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const isCompensated = compensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename, pttypeEclaimId)
      const age = Number(r.age) || 0
      const isTargetAge = age >= 25 && age <= 59
      const sex = formatThaiSex(r.sex_code, r.sex)

      const sDxList = [r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
        .map((d) => (d ? String(d).trim() : ''))
        .filter(Boolean)
      const sOpsList = [r.op1, r.op2, r.op3, r.op4, r.op5]
        .map((op) => (op ? String(op).trim() : ''))
        .filter(Boolean)

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex,
        age,
        isTargetAge,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: authencode || null,
        maininscl,
        pttype_eclaim_id: pttypeEclaimId,
        isUc,
        pttypename,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        sdx: sDxList.length > 0 ? sDxList.join(', ') : null,
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        ops: sOpsList.length > 0 ? sOpsList.join(', ') : null,
        income: Number(r.income) || 0,
        listname: r.listname ? String(r.listname).trim() : null,
        listname1: r.listname1 ? String(r.listname1).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated,
        agency: r.agency ? String(r.agency).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        errorcode: r.errorcode ? String(r.errorcode).trim() : null,
        transactiontype: r.transactiontype ? String(r.transactiontype).trim() : null,
      }
    })

    const enrichedAllItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      executor,
      Boolean(params.refresh)
    )

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    let summaryCohort = enrichedAllItems
    if (params.pttypes) {
      summaryCohort = enrichedAllItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = enrichedAllItems.filter((i) => i.isUc)
    }

    // Compute Summary across summaryCohort
    const totalVisits = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    const compensatedVisits = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? Math.round((compensatedVisits / totalVisits) * 1000) / 10 : 0
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const averageCompensated =
      compensatedVisits > 0 ? Math.round((totalCompensated / compensatedVisits) * 100) / 100 : 0

    const targetAgeCount = summaryCohort.filter((i) => i.isTargetAge).length
    const targetAgeRate = totalVisits > 0 ? Math.round((targetAgeCount / totalVisits) * 1000) / 10 : 0

    const withAuthenCount = summaryCohort.filter((i) => Boolean(i.authencode)).length
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? Math.round((withAuthenCount / totalVisits) * 1000) / 10 : 0

    const ucCount = summaryCohort.filter((i) => i.isUc).length
    const ucRate = totalVisits > 0 ? Math.round((ucCount / totalVisits) * 1000) / 10 : 0
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)

    const summary: FluorideVarnishSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      targetAgeCount,
      targetAgeRate,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
      totalIncome,
    }

    // Filter by Card & Toggles
    let filtered = [...summaryCohort]

    if (cardFilter === 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    if (ucOnly && cardFilter !== 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    if (targetAgeOnly && cardFilter !== 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    }

    // Filter by Search Query
    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (i.pdx || '').toLowerCase().includes(search) ||
            (i.sdx || '').toLowerCase().includes(search)
          )
        }
        if (searchField === 'PTTYPE') return i.pttypename.toLowerCase().includes(search)

        // Global search across all relevant fields
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx || '').toLowerCase().includes(search) ||
          (i.sdx || '').toLowerCase().includes(search) ||
          (i.authencode || '').toLowerCase().includes(search) ||
          i.pttypename.toLowerCase().includes(search) ||
          (i.listname || '').toLowerCase().includes(search) ||
          (i.status || '').toLowerCase().includes(search) ||
          (i.rep || '').toLowerCase().includes(search)
        )
      })
    }

    // Sort items
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'vstdate') {
        cmp = a.vstdate.localeCompare(b.vstdate) || a.vsttime.localeCompare(b.vsttime)
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
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Re-index filtered rows
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pageItems: FluorideVarnishItem[]
    if (exportAll) {
      pageItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIdx = (page - 1) * pageSize
      pageItems = filtered.slice(startIdx, startIdx + pageSize).map((item, idx) => ({
        ...item,
        no: startIdx + idx + 1,
      }))
    }

    return {
      title: reportTitle,
      adpCode,
      ds1,
      ds2,
      cardFilter,
      ucOnly,
      targetAgeOnly,
      searchField,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      items: pageItems,
      summary,
      adpMapping,
    }
  }
}
