import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
  type QueryExecutor,
} from './rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'

// ── 1. Domain Types: กองทุนรากฟันเทียม (Dental Implant) - DENSUR ────────────────

export const DENSUR_ADP_CODE = 'DENSUR'

export type DentalImplantCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type DentalImplantSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'pttypename'
  | 'authencode'
  | 'pdx'
  | 'listname'
  | 'status'
  | 'rep'
  | 'compensated'

export interface DentalImplantReportParams extends FiscalDateRangeParams {
  cardFilter?: DentalImplantCardFilter
  pttypes?: string
  ucOnly?: boolean
  search?: string
  sortBy?: DentalImplantSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface DentalImplantAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface DentalImplantAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: DentalImplantAdpMappingItem[]
}

export interface DentalImplantDensurItem {
  no: number
  vn: string
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
  pttype_eclaim_id?: string | null
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
  listname: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund?: string | null
  subfund?: string | null
  errorcode?: string | null
  transactiontype?: string | null
}

export interface DentalImplantSummary {
  totalCases: number
  uniquePatients: number
  compensatedCases: number
  uncompensatedCases: number
  compensationRate: number
  totalCompensated: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
}

export interface DentalImplantReportResult {
  title: string
  subtitle: string
  adpCode: string
  ds1: string
  ds2: string
  adpMapping: DentalImplantAdpMappingCheck
  cardFilter: DentalImplantCardFilter
  search: string
  sortBy: DentalImplantSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: DentalImplantSummary
  items: DentalImplantDensurItem[]
}

// ── 2. Helper Functions ─────────────────────────────────────────────────────

function isUniversalCoverage(maininscl: string, pttypename: string, pttypeEclaimId?: string | null): boolean {
  if (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) return true
  const normMain = (maininscl || '').trim().toUpperCase()
  if (normMain === 'UCS' || normMain === 'UC' || normMain === 'WEL') return true
  const normName = (pttypename || '').toLowerCase()
  if (
    normName.includes('ประกันสุขภาพ') ||
    normName.includes('บัตรทอง') ||
    normName.includes('ถ้วนหน้า') ||
    normName.includes('uc') ||
    normName.includes('ท.74') ||
    normName.includes('ท.89')
  ) {
    return true
  }
  return false
}

// ── 3. Service Implementation ───────────────────────────────────────────────

export class RcmDentalImplantService {
  /**
   * Check if ADP code 'DENSUR' is mapped in s_drugitems table.
   */
  static async checkAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh?: boolean
  ): Promise<DentalImplantAdpMappingCheck> {
    const adpCode = DENSUR_ADP_CODE
    const cacheKey = `rcm-dental-implant-adp-mapping-check-${adpCode}`
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
          const items: DentalImplantAdpMappingItem[] = (rows || []).map((r) => ({
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
   * Generate กองทุนรากฟันเทียม - รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR Report:
   * - Queries OPD visits with dispensing of ADP code DENSUR in opitemrece
   * - Filters age between 25 and 59 from database
   * - Aggregates KPIs, calculates card filter counts, supports sorting, search, pagination.
   */
  static async getDensurReport(
    params: DentalImplantReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<DentalImplantReportResult> {
    const adpCode = DENSUR_ADP_CODE
    const categoryTitle = 'กองทุนรากฟันเทียม'
    const reportTitle = 'รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: DentalImplantCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: DentalImplantSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-dental-implant-densur-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-dental-implant-adp-mapping-check-${adpCode}`)
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
              dd.name AS listname,
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
          ds1, ds2, adpCode, // dd driving subquery
          ds1, ds2, // nhso
          ds1, ds2, // rep
          ds1, ds2, // main ovst o
        ]

        let rows: any[] = []
        let mappingRes: DentalImplantAdpMappingCheck = {
          adpCode,
          isMapped: false,
          mappedCount: 0,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              RcmDentalImplantService.checkAdpMapping(executor, Boolean(params.refresh)),
              apiGateway.clinical.getRcmFundData('dental-implant', { ds1, ds2, adpCode }),
            ])
            mappingRes = mRes
            if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows)) {
              rows = gwRes.data.rawRows
              fetchedViaNamedApi = true
            }
          } catch {
            // Fallback to parameterized query via executor
          }
        }

        if (!fetchedViaNamedApi) {
          const [mRes, rRows] = await Promise.all([
            RcmDentalImplantService.checkAdpMapping(executor, Boolean(params.refresh)),
            executor(sql, sqlParams, { timeoutMs: 90000 }) as Promise<any[]>,
          ])
          mappingRes = mRes
          rows = rRows || []
        }

        return {
          rawRows: rows || [],
          adpMapping: mappingRes,
        }
      },
      300000 // Cache TTL 5 minutes
    )

    // Transform and map rows
    const allItems: DentalImplantDensurItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated || 0)
      const pttypename = String(r.pttypename || '').trim()
      const maininscl = String(r.maininscl || '').trim()
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc = isUniversalCoverage(maininscl, pttypename, pttypeEclaimId)
      const isCompensated = compensated > 0 || (r.status && String(r.status).includes('ชดเชย'))

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code),
        age: Number(r.age || 0),
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: r.authencode ? String(r.authencode).trim() : null,
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
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        listname: r.listname ? String(r.listname).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: Boolean(isCompensated),
        agency: r.agency ? String(r.agency).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        errorcode: r.errorcode ? String(r.errorcode).trim() : null,
        transactiontype: r.transactiontype ? String(r.transactiontype).trim() : null,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((it) =>
        matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, params.pttypes, it.isUc, it.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((it) => it.isUc)
    }

    // Calculate aggregated summary
    const uniqueHnSet = new Set<string>()
    let compensatedCases = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let ucCount = 0

    for (const it of summaryCohort) {
      if (it.hn) uniqueHnSet.add(it.hn)
      if (it.isCompensated) {
        compensatedCases++
        totalCompensated += it.compensated
      }
      if (it.authencode) withAuthenCount++
      if (it.isUc) ucCount++
    }

    const totalCases = summaryCohort.length
    const uncompensatedCases = totalCases - compensatedCases
    const withoutAuthenCount = totalCases - withAuthenCount
    const compensationRate = totalCases > 0 ? (compensatedCases / totalCases) * 100 : 0
    const authenRate = totalCases > 0 ? (withAuthenCount / totalCases) * 100 : 0
    const ucRate = totalCases > 0 ? (ucCount / totalCases) * 100 : 0

    const summary: DentalImplantSummary = {
      totalCases,
      uniquePatients: uniqueHnSet.size,
      compensatedCases,
      uncompensatedCases,
      compensationRate,
      totalCompensated,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
    }

    // Apply Card Filter
    let filteredItems = summaryCohort
    switch (cardFilter) {
      case 'COMPENSATED':
        filteredItems = filteredItems.filter((it) => it.isCompensated)
        break
      case 'UNCOMPENSATED':
        filteredItems = filteredItems.filter((it) => !it.isCompensated)
        break
      case 'WITH_AUTHEN':
        filteredItems = filteredItems.filter((it) => Boolean(it.authencode))
        break
      case 'NO_AUTHEN':
        filteredItems = filteredItems.filter((it) => !it.authencode)
        break
      case 'UC_ONLY':
        filteredItems = filteredItems.filter((it) => it.isUc)
        break
      case 'ALL':
      default:
        break
    }

    // Apply Global Search (HN, CID, Name, VN, PDX, DX0-5, OP0-5, Pttype, Authen code, Listname, Status, Rep)
    if (search) {
      filteredItems = filteredItems.filter((it) => {
        return (
          it.hn.toLowerCase().includes(search) ||
          it.cid.toLowerCase().includes(search) ||
          it.ptname.toLowerCase().includes(search) ||
          it.vn.toLowerCase().includes(search) ||
          (it.authencode && it.authencode.toLowerCase().includes(search)) ||
          (it.pdx && it.pdx.toLowerCase().includes(search)) ||
          (it.dx0 && it.dx0.toLowerCase().includes(search)) ||
          (it.dx1 && it.dx1.toLowerCase().includes(search)) ||
          (it.dx2 && it.dx2.toLowerCase().includes(search)) ||
          (it.dx3 && it.dx3.toLowerCase().includes(search)) ||
          (it.dx4 && it.dx4.toLowerCase().includes(search)) ||
          (it.dx5 && it.dx5.toLowerCase().includes(search)) ||
          (it.op0 && it.op0.toLowerCase().includes(search)) ||
          (it.op1 && it.op1.toLowerCase().includes(search)) ||
          (it.op2 && it.op2.toLowerCase().includes(search)) ||
          (it.op3 && it.op3.toLowerCase().includes(search)) ||
          (it.op4 && it.op4.toLowerCase().includes(search)) ||
          (it.op5 && it.op5.toLowerCase().includes(search)) ||
          (it.pttypename && it.pttypename.toLowerCase().includes(search)) ||
          (it.listname && it.listname.toLowerCase().includes(search)) ||
          (it.status && it.status.toLowerCase().includes(search)) ||
          (it.rep && it.rep.toLowerCase().includes(search))
        )
      })
    }

    // Sort items
    filteredItems.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (valA == null) valA = ''
      if (valB == null) valB = ''

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA)
      const strB = String(valB)
      return sortOrder === 'asc'
        ? strA.localeCompare(strB, 'th')
        : strB.localeCompare(strA, 'th')
    })

    const totalCount = filteredItems.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    // Paginate or export all
    const items = exportAll
      ? filteredItems
      : filteredItems.slice((page - 1) * pageSize, page * pageSize)

    // Re-assign running numbers for the current page
    const itemsWithNo = items.map((it, idx) => ({
      ...it,
      no: exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1,
    }))

    return {
      title: categoryTitle,
      subtitle: reportTitle,
      adpCode,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      summary,
      items: itemsWithNo,
    }
  }
}
