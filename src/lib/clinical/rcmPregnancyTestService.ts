import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams, type QueryExecutor } from './rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'

// ── 1. Domain Types: 8.1 การทดสอบการตั้งครรภ์ (Pregnancy Test ADP 31101, 30014) ──

export type PregnancyTestCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'UC_ONLY'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'

export type PregnancyTestSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'LABRESULT'

export type PregnancyTestSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'lab_order_result'

export interface PregnancyTestReportParams extends FiscalDateRangeParams {
  cardFilter?: PregnancyTestCardFilter
  pttypes?: string
  ucOnly?: boolean
  searchField?: PregnancyTestSearchField
  search?: string
  sortBy?: PregnancyTestSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface PregnancyTestAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface PregnancyTestAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: PregnancyTestAdpMappingItem[]
}

export type PregnancyLabStatus = 'POSITIVE' | 'NEGATIVE' | 'PENDING' | 'NO_LAB' | 'OTHER'

export interface PregnancyTestItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  age: number
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  isUc: boolean
  pttypename: string
  pttype_eclaim_id?: string | null
  department: string | null
  clinic: string | null
  pdx: string | null
  sdx: string | null
  income: number
  labname: string | null
  listname: string | null
  lab_order_result: string | null
  labStatus: PregnancyLabStatus
  combined_labname: string
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
}

export interface PregnancyTestSummary {
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
  positiveCount: number
  positiveRate: number
  negativeCount: number
  negativeRate: number
  pendingCount: number
  noLabCount: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface PregnancyTestReportResult {
  ds1: string
  ds2: string
  adpMapping: PregnancyTestAdpMappingCheck
  cardFilter: PregnancyTestCardFilter
  ucOnly: boolean
  searchField: PregnancyTestSearchField
  search: string
  sortBy: PregnancyTestSortField
  sortOrder: 'asc' | 'desc'
  summary: PregnancyTestSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: PregnancyTestItem[]
}

// ── 2. Helper Functions ───────────────────────────────────────────────────────

/**
 * Evaluates the lab result text from lab_order (UPT / Pregnancy test)
 * and categorizes into POSITIVE, NEGATIVE, PENDING, NO_LAB, or OTHER.
 */
export function determinePregnancyLabStatus(
  labResult: string | null | undefined
): PregnancyLabStatus {
  if (!labResult || !labResult.trim()) {
    return 'NO_LAB'
  }
  const text = labResult.trim().toLowerCase()

  if (text.includes('รอผล') || text.includes('pending') || text.includes('processing')) {
    return 'PENDING'
  }

  // Check negative keywords first to avoid 'non-reactive' matching 'reactive'
  if (
    text.includes('non-reactive') ||
    text.includes('not reactive') ||
    text.includes('negative') ||
    text === 'neg' ||
    text.includes('neg.') ||
    text.includes('ไม่พบการตั้งครรภ์') ||
    text.includes('ไม่พบ') ||
    text.includes('ผลลบ') ||
    text === '-' ||
    text.startsWith('- ')
  ) {
    return 'NEGATIVE'
  }

  // Check positive keywords (+, pos, positive, reactive, พบ)
  if (
    text.includes('positive') ||
    text === 'pos' ||
    text.includes('pos.') ||
    text.includes('reactive') ||
    text.includes('พบการตั้งครรภ์') ||
    text.includes('ผลบวก') ||
    text === '+' ||
    text.startsWith('+ ')
  ) {
    return 'POSITIVE'
  }

  return 'OTHER'
}

// ── 3. RcmPregnancyTestService Class ──────────────────────────────────────────

export class RcmPregnancyTestService {
  /**
   * Check if ADP codes '31101' and '30014' are mapped in s_drugitems table.
   * Matches FoxPro verification:
   * select count(*) from s_drugitems where nhso_adp_code in ('31101', '30014')
   */
  static async checkPregnancyTestAdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PregnancyTestAdpMappingCheck> {
    const cacheKey = 'rcm-pregnancy-test-adp-mapping-check'
    return getCachedData(
      cacheKey,
      async () => {
        if (executor === queryClinicalDb) {
          try {
            const gwRes = await apiGateway.clinical.getAdpMapping('31101')
            if (gwRes && typeof gwRes.isMapped === 'boolean') {
              return {
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
            WHERE TRIM(nhso_adp_code) IN ('31101', '30014')
            ORDER BY nhso_adp_code ASC, icode ASC;
          `
          const rows = (await executor(sql, [], { timeoutMs: 15000 })) as any[]
          const items: PregnancyTestAdpMappingItem[] = (rows || []).map((r) => ({
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
      },
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate 8.1 Pregnancy testing report (การทดสอบการตั้งครรภ์).
   * Direct translation of legacy FoxPro logic:
   * - Queries visits with dispensing of ADP 31101 / 30014 in opitemrece
   * - Joins HOSxP patient, ovst, vn_stat, pttype, departments, specialty
   * - Joins UPT lab results from lab_head + lab_order (preg|UPT)
   * - Joins NHSO/Rep/NewEclaim/EClaim reimbursement data
   * - Calculates KPIs and supports card click filtering, UC-only filtering, search and pagination.
   */
  static async getPregnancyTestReport(
    params: PregnancyTestReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PregnancyTestReportResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: PregnancyTestCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const searchField: PregnancyTestSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: PregnancyTestSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-pregnancy-test-report-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-pregnancy-test-adp-mapping-check')
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
              IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              IFNULL(ptt.hipdata_code, '') AS maininscl,
              CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
              ptt.pttype_eclaim_id AS pttype_eclaim_id,
              dep.department AS department,
              spc.name AS clinic,
              v.pdx,
              CONCAT_WS(', ', NULLIF(v.dx0, ''), NULLIF(v.dx1, ''), NULLIF(v.dx2, ''), NULLIF(v.dx3, ''), NULLIF(v.dx4, ''), NULLIF(v.dx5, '')) AS sdx,
              IFNULL(v.income, 0) AS income,
              dd.labname AS drug_labname,
              dd.name AS listname,
              lo.lab_order_result AS lab_order_result,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-:ยังไม่ได้ส่ง') AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
              re.fund,
              re.subfund
            FROM ovst o
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            JOIN (
              SELECT 
                oo.vn,
                GROUP_CONCAT(IF(TRIM(d.nhso_adp_code) = '31101', CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS labname,
                GROUP_CONCAT(IF(TRIM(d.nhso_adp_code) = '30014', CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate BETWEEN ? AND ?
                AND TRIM(d.nhso_adp_code) IN ('31101', '30014')
              GROUP BY oo.vn
            ) dd ON dd.vn = o.vn
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype vt ON vt.vn = o.vn
            LEFT JOIN (
              SELECT 
                lh.vn,
                GROUP_CONCAT(DISTINCT lo.lab_order_result SEPARATOR ', ') AS lab_order_result
              FROM lab_head lh
              JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
              WHERE lh.order_date BETWEEN ? AND ?
                AND (lo.lab_items_name_ref REGEXP 'preg|UPT' OR lo.lab_items_name_ref LIKE '%pregnancy%')
              GROUP BY lh.vn
            ) lo ON lo.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) rep ON rep.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                     GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              GROUP BY vn
            ) re ON re.vn = o.vn
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
            GROUP BY o.vn
            ORDER BY o.vstdate DESC, o.vsttime DESC;
        `
        const sqlParams = [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2]

        let rows: Record<string, unknown>[] = []
        let mappingRes: PregnancyTestAdpMappingCheck = {
          isMapped: false,
          mappedCount: 0,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              RcmPregnancyTestService.checkPregnancyTestAdpMapping(executor),
              apiGateway.clinical.getRcmFundData('pregnancy-test', { ds1, ds2 }),
            ])
            mappingRes = mRes
            if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows)) {
              rows = gwRes.data.rawRows as Record<string, unknown>[]
              fetchedViaNamedApi = true
            }
          } catch {
            // Fallback to executor query
          }
        }

        if (!fetchedViaNamedApi) {
          const [mRes, dbRows] = await Promise.all([
            RcmPregnancyTestService.checkPregnancyTestAdpMapping(executor),
            executor(sql, sqlParams, { timeoutMs: 90000 }) as Promise<Record<string, unknown>[]>,
          ])
          rows = dbRows || []
          mappingRes = mRes
        }

        return { rawRows: rows, adpMapping: mappingRes }
      },
      600 // Cache TTL 10 minutes
    )

    // Map raw rows into typed domain items
    const allItems: PregnancyTestItem[] = rawRows.map((r, idx) => {
      const compensated = Number(r.compensated || 0)
      const income = Number(r.income || 0)
      const labResult = r.lab_order_result ? String(r.lab_order_result).trim() : null
      const labStatus = determinePregnancyLabStatus(labResult)
      const drugLabName = r.drug_labname ? String(r.drug_labname).trim() : null
      const listName = r.listname ? String(r.listname).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypeEclaimId = r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null
      const isUc = isUcEclaimCode(pttypeEclaimId) || maininscl.toUpperCase() === 'UCS'

      // Mirror FoxPro: asstring(concat_ws('#',dd.labname,lo.lab_order_result)) labname
      const combinedLabName = [drugLabName, labResult].filter(Boolean).join('#')

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        age: Number(r.age || 0),
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        maininscl,
        isUc,
        pttypename: String(r.pttypename || '').trim(),
        pttype_eclaim_id: pttypeEclaimId,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        sdx: r.sdx ? String(r.sdx).trim() : null,
        income,
        labname: drugLabName,
        listname: listName,
        lab_order_result: labResult,
        labStatus,
        combined_labname: combinedLabName,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: compensated > 0,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
      }
    })

    // Full Page Filter: Apply pttypes / ucOnly filter across all cohort items before summary & pagination
    const summaryCohort = allItems.filter((i) => {
      if (params.pttypes !== undefined) {
        return matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      }
      if (ucOnly || cardFilter === 'UC_ONLY') {
        return i.isUc
      }
      return true
    })

    // Compute baseline summary metrics across summaryCohort
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let uncompensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let positiveCount = 0
    let negativeCount = 0
    let pendingCount = 0
    let noLabCount = 0
    let ucCount = 0
    let totalIncome = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      totalIncome += item.income

      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      } else {
        uncompensatedVisits++
      }

      if (item.authencode) {
        withAuthenCount++
      } else {
        withoutAuthenCount++
      }

      if (item.isUc) {
        ucCount++
      }

      if (item.labStatus === 'POSITIVE') positiveCount++
      else if (item.labStatus === 'NEGATIVE') negativeCount++
      else if (item.labStatus === 'PENDING') pendingCount++
      else if (item.labStatus === 'NO_LAB') noLabCount++
    }

    const totalVisits = summaryCohort.length
    const compensationRate = totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const authenRate = totalVisits > 0 ? Number(((withAuthenCount / totalVisits) * 100).toFixed(1)) : 0
    const positiveRate = totalVisits > 0 ? Number(((positiveCount / totalVisits) * 100).toFixed(1)) : 0
    const negativeRate = totalVisits > 0 ? Number(((negativeCount / totalVisits) * 100).toFixed(1)) : 0
    const ucRate = totalVisits > 0 ? Number(((ucCount / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0

    const summary: PregnancyTestSummary = {
      totalVisits,
      uniquePatients: uniqueHnSet.size,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated: Number(totalCompensated.toFixed(2)),
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      positiveCount,
      positiveRate,
      negativeCount,
      negativeRate,
      pendingCount,
      noLabCount,
      ucCount,
      ucRate,
      totalIncome: Number(totalIncome.toFixed(2)),
    }

    // Apply interactive filters
    let filtered = summaryCohort

    // 2. Card Filter
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'POSITIVE') {
      filtered = filtered.filter((i) => i.labStatus === 'POSITIVE')
    } else if (cardFilter === 'NEGATIVE') {
      filtered = filtered.filter((i) => i.labStatus === 'NEGATIVE')
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    // 3. Search query filter
    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (i.pdx && i.pdx.toLowerCase().includes(search)) ||
            (i.sdx && i.sdx.toLowerCase().includes(search))
          )
        }
        if (searchField === 'PTTYPE') return i.pttypename.toLowerCase().includes(search)
        if (searchField === 'LABRESULT') {
          return (
            (i.lab_order_result && i.lab_order_result.toLowerCase().includes(search)) ||
            (i.labname && i.labname.toLowerCase().includes(search))
          )
        }
        // ALL
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.sdx && i.sdx.toLowerCase().includes(search)) ||
          i.pttypename.toLowerCase().includes(search) ||
          (i.lab_order_result && i.lab_order_result.toLowerCase().includes(search)) ||
          (i.labname && i.labname.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search)) ||
          (i.department && i.department.toLowerCase().includes(search)) ||
          (i.clinic && i.clinic.toLowerCase().includes(search)) ||
          (i.authencode && i.authencode.toLowerCase().includes(search))
        )
      })
    }

    // 4. Sorting
    filtered.sort((a, b) => {
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
      } else if (sortBy === 'lab_order_result') {
        cmp = (a.lab_order_result || '').localeCompare(b.lab_order_result || '', 'th')
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const totalCount = filtered.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1
    const offset = (page - 1) * pageSize
    const paginated = exportAll ? filtered : filtered.slice(offset, offset + pageSize)

    // Re-number rows for the display view
    const numberedItems = paginated.map((item, idx) => ({
      ...item,
      no: exportAll ? idx + 1 : offset + idx + 1,
    }))

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
      items: numberedItems,
    }
  }
}
