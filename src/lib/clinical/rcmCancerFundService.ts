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

// ── 1. Domain Types: กองทุนมะเร็ง (CANCER ADP) ───────────────────────────────

export const CANCER_ADP_CODE = 'CANCER'

export type CancerFundCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'INVOICE'
  | 'UC_ONLY'

export type CancerFundSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'pttypename'
  | 'authencode'
  | 'pdx'
  | 'listname'
  | 'status_eclaim'
  | 'rep'
  | 'compensated'

export interface CancerFundReportParams extends FiscalDateRangeParams {
  cardFilter?: CancerFundCardFilter
  statusFilter?: string
  ucOnly?: boolean
  pttypes?: string
  search?: string
  sortBy?: CancerFundSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface CancerFundAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface CancerFundAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: CancerFundAdpMappingItem[]
}

export interface CancerFundPatientItem {
  no: number
  vn: string
  hn: string
  cid: string
  ptname: string
  firstName: string
  lastName: string
  sex: string
  birthday: string | null
  age: number
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  pttype_eclaim_id: string
  pttypename: string
  isUc: boolean
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
  listname: string
  rep: string | null
  compensated: number
  isCompensated: boolean
  transactiontype: string | null
  invoice: string | null
  invoice_compensated: number
  resource: string | null
  fund: string | null
  subfund: string | null
  remark: string | null
  projectcode: string | null
  status: string
  status_eclaim: string
}

export interface CancerFundSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  totalInvoiceCompensated: number
  totalIncome: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  invoiceCount: number
  invoiceRate: number
  repCount: number
  repRate: number
  ucCount: number
  ucRate: number
}

export interface CancerFundReportResult {
  title: string
  categoryTitle: string
  subTitle: string
  adpCode: string
  ds1: string
  ds2: string
  adpMapping: CancerFundAdpMappingCheck
  cardFilter: CancerFundCardFilter
  statusFilter: string
  statusOptions: string[]
  ucOnly: boolean
  pttypes?: string
  search: string
  sortBy: CancerFundSortField
  sortOrder: 'asc' | 'desc'
  summary: CancerFundSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: CancerFundPatientItem[]
}

// ── 2. Helper Functions ───────────────────────────────────────────────────────

export function isUniversalCoverageScheme(
  maininscl?: string | null,
  pttypename?: string | null,
  pttypeEclaimId?: string | null
): boolean {
  if (pttypeEclaimId) {
    const id = pttypeEclaimId.trim()
    if (/^0[1-9]$/.test(id)) return true
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

// ── 3. RcmCancerFundService Implementation ───────────────────────────────────

export class RcmCancerFundService {
  /**
   * Check if ADP code 'CANCER' is mapped in s_drugitems or drugitems.
   */
  static async checkAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh?: boolean
  ): Promise<CancerFundAdpMappingCheck> {
    const adpCode = CANCER_ADP_CODE
    const cacheKey = `rcm-cancer-fund-adp-mapping-check-${adpCode}`
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
                adpCode,
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
            UNION
            SELECT 
              icode, 
              name, 
              strength, 
              nhso_adp_code
            FROM drugitems 
            WHERE TRIM(nhso_adp_code) = ?
            ORDER BY icode ASC;
          `
          const rows = (await executor(sql, [adpCode, adpCode], { timeoutMs: 15000 })) as any[]
          const items: CancerFundAdpMappingItem[] = (rows || []).map((r) => ({
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
   * Generate กองทุนมะเร็ง (CANCER ADP) Patient Report:
   * - Queries visits matching s_drugitems/drugitems with nhso_adp_code = 'CANCER'
   * - Uses Driving Subquery Pattern on opitemrece for high performance (<0.1s)
   * - Joins patient, vn_stat, pttype, department, specialty, nationality, authencode, repdata, repeclaim, eclaim
   * - Provides summary metrics, card filters, unified search, pagination, and sorting
   */
  static async getCancerPatientsReport(
    params: CancerFundReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CancerFundReportResult> {
    const categoryTitle = 'กองทุนมะเร็ง'
    const reportTitle = 'กองทุนมะเร็ง'
    const subTitle = 'รายชื่อผู้ป่วย จาก ADP (CANCER)'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: CancerFundCardFilter = params.cardFilter || 'ALL'
    const statusFilter = (params.statusFilter || 'ALL').trim()
    const ucOnly = Boolean(params.ucOnly)
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CancerFundSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-cancer-fund-adp-report-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-cancer-fund-adp-mapping-check-${CANCER_ADP_CODE}`)
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
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, '')) AS firstName,
            IFNULL(pt.lname, '') AS lastName,
            DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
            IFNULL(pt.sex, '') AS sex_code,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            nat.name AS nation,
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
            dd.listname,
            COALESCE(rd.rep, nn.Rep, m.rep) AS rep,
            COALESCE(rd.compensated, nn.Income, m.compensated, 0) AS compensated,
            rd.transactiontype,
            re.invoice AS invoice,
            IFNULL(re.invoice_compensated, 0) AS invoice_compensated,
            re.resource,
            rd.subfund,
            rd.remark,
            rd.projectcode,
            COALESCE(re.statusname, rd.statusname, nn.StatusName, m.statusname, '- :: ยังไม่ได้ส่ง') AS status,
            COALESCE(re.statusname, rd.statusname, nn.StatusName, m.statusname, '- :: ยังไม่ได้ส่ง') AS status_eclaim
          FROM (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', target_items.name, NULLIF(target_items.strength, '')) SEPARATOR ', ') AS listname
            FROM (
              SELECT icode, name, strength, nhso_adp_code
              FROM s_drugitems
              WHERE TRIM(nhso_adp_code) = ?
              UNION
              SELECT icode, name, strength, nhso_adp_code
              FROM drugitems
              WHERE TRIM(nhso_adp_code) = ?
            ) target_items
            JOIN opitemrece oo ON oo.icode = target_items.icode
            WHERE IFNULL(oo.vn, '') <> ''
              AND oo.vstdate BETWEEN ? AND ?
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
            SELECT 
              vn, 
              GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS invoice,
              SUM(IFNULL(compensated, 0)) AS invoice_compensated,
              GROUP_CONCAT(DISTINCT resource SEPARATOR ', ') AS resource,
              'NHSO :: ได้รับ Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' 
              AND IFNULL(vn, '') <> '' 
              AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) re ON re.vn = o.vn
          LEFT JOIN (
            SELECT 
              vn,
              GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL) SEPARATOR ', ') AS rep,
              SUM(IF(errorcode = '' OR errorcode IS NULL, IFNULL(compensated, 0), 0)) AS compensated,
              IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: ส่ง Rep แล้ว', NULL) AS statusname,
              GROUP_CONCAT(DISTINCT TransactionType SEPARATOR ', ') AS transactiontype,
              GROUP_CONCAT(DISTINCT subfund SEPARATOR ', ') AS subfund,
              GROUP_CONCAT(DISTINCT remark SEPARATOR ', ') AS remark,
              GROUP_CONCAT(DISTINCT projectcode SEPARATOR ', ') AS projectcode
            FROM rcmdb.repdata
            WHERE department = 'OP' 
              AND IFNULL(vn, '') <> '' 
              AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY vn
          ) rd ON rd.vn = o.vn
          LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
          LEFT JOIN (
            SELECT 
              m.opdseq AS vn,
              SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
              SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
              SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
            FROM eclaimdb.m_registerdata m
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE m.person_type = '1' 
              AND IFNULL(m.opdseq, '') <> ''
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC, o.vn DESC;
        `

        const sqlParams: any[] = [
          CANCER_ADP_CODE, // s_drugitems TRIM(nhso_adp_code) = ?
          CANCER_ADP_CODE, // drugitems TRIM(nhso_adp_code) = ?
          ds1, ds2,        // dd oo.vstdate BETWEEN ? AND ?
          ds1, ds2,        // re admdate
          ds1, ds2,        // rd admdate
          ds1, ds2,        // o vstdate BETWEEN ? AND ?
        ]

        let rows: any[] = []
        let mappingRes: CancerFundAdpMappingCheck = {
          adpCode: CANCER_ADP_CODE,
          isMapped: false,
          mappedCount: 0,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              RcmCancerFundService.checkAdpMapping(executor, Boolean(params.refresh)),
              apiGateway.clinical.getRcmFundData('cancer', { ds1, ds2, adpCode: CANCER_ADP_CODE }),
            ])
            mappingRes = mRes
            if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows) && gwRes.data.rawRows.length > 0) {
              rows = gwRes.data.rawRows
              fetchedViaNamedApi = true
            }
          } catch {
            // Fallback to executor query
          }
        }

        if (!fetchedViaNamedApi) {
          const [mRes, dbRows] = await Promise.all([
            RcmCancerFundService.checkAdpMapping(executor, Boolean(params.refresh)),
            executor(sql, sqlParams, { timeoutMs: 90000 }),
          ])
          rows = (dbRows as any[]) || []
          mappingRes = mRes
        }

        return {
          rawRows: rows || [],
          adpMapping: mappingRes,
        }
      },
      600000 // Cache TTL 10 minutes
    )

    // Normalize and transform items
    const allItems: CancerFundPatientItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const invoiceCompensated = Number(r.invoice_compensated) || 0
      const isCompensated = compensated > 0 || invoiceCompensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename, pttypeEclaimId)
      const age = Number(r.age) || 0
      const sex = formatThaiSex(r.sex_code, r.sex)
      const income = Number(r.income) || 0

      const ptname = String(r.ptname || '').trim()
      let rawFirstName = String(r.firstName || '').trim()
      let rawLastName = String(r.lastName || '').trim()
      if (!rawFirstName && ptname) {
        const parts = ptname.split(/\s+/)
        rawFirstName = parts[0] || ptname
        rawLastName = parts.slice(1).join(' ')
      }

      const statusStr = String(r.status || r.status_eclaim || '- :: ยังไม่ได้ส่ง').trim()
      const rep = r.rep ? String(r.rep).trim() : null

      return {
        no: idx + 1,
        vn: String(r.vn || '').trim(),
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname,
        firstName: rawFirstName || ptname,
        lastName: rawLastName,
        sex,
        birthday: r.birthday ? String(r.birthday) : null,
        age,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        authencode,
        maininscl,
        pttype_eclaim_id: pttypeEclaimId,
        pttypename,
        isUc,
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
        income,
        listname: String(r.listname || '').trim(),
        rep,
        compensated,
        isCompensated,
        transactiontype: r.transactiontype ? String(r.transactiontype).trim() : null,
        invoice: r.invoice ? String(r.invoice).trim() : null,
        invoice_compensated: invoiceCompensated,
        resource: r.resource ? String(r.resource).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        remark: r.remark ? String(r.remark).trim() : null,
        projectcode: r.projectcode ? String(r.projectcode).trim() : null,
        status: statusStr,
        status_eclaim: statusStr,
      }
    })

    const enrichedAllItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      executor,
      Boolean(params.refresh)
    )
    const pttypes = (params.pttypes || '').trim()
    const selectedPttypesList = pttypes ? pttypes.split(',').map((s) => s.trim()).filter(Boolean) : []

    // Cohort for summary KPIs:
    // If pttypes filter is specified, compute summary KPIs based on matching pttypes (Full Page Filter Q2: A)
    const summaryCohort = selectedPttypesList.length > 0
      ? enrichedAllItems.filter((it) => matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, selectedPttypesList, it.isUc, it.pttype_eclaim_id))
      : enrichedAllItems

    // Compute Summary across summaryCohort
    const totalVisits = summaryCohort.length
    const uniqueHns = new Set(summaryCohort.map((i) => i.hn).filter(Boolean))
    const uniquePatients = uniqueHns.size

    let compensatedVisits = 0
    let totalCompensated = 0
    let totalInvoiceCompensated = 0
    let totalIncome = 0
    let withAuthenCount = 0
    let invoiceCount = 0
    let repCount = 0
    let ucCount = 0

    for (const item of summaryCohort) {
      if (item.isCompensated) compensatedVisits++
      totalCompensated += item.compensated
      totalInvoiceCompensated += item.invoice_compensated
      totalIncome += item.income
      if (item.authencode) withAuthenCount++
      if (item.invoice) invoiceCount++
      if (item.rep) repCount++
      if (item.isUc) ucCount++
    }

    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const invoiceRate = totalVisits > 0 ? (invoiceCount / totalVisits) * 100 : 0
    const repRate = totalVisits > 0 ? (repCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0

    const summary: CancerFundSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      totalInvoiceCompensated,
      totalIncome,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      invoiceCount,
      invoiceRate,
      repCount,
      repRate,
      ucCount,
      ucRate,
    }

    // Available status options for dropdown
    const statusOptions = Array.from(
      new Set(summaryCohort.map((i) => i.status_eclaim).filter(Boolean))
    ).sort() as string[]

    // Apply Filters
    let filtered = summaryCohort

    // 1. Card Filter
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (cardFilter === 'INVOICE') {
      filtered = filtered.filter((i) => Boolean(i.invoice))
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    // 2. Status e-Claim / REP Filter
    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'HAS_REP') {
        filtered = filtered.filter((i) => Boolean(i.rep))
      } else if (statusFilter === 'NO_REP') {
        filtered = filtered.filter((i) => !i.rep)
      } else {
        filtered = filtered.filter((i) => i.status_eclaim === statusFilter || i.status === statusFilter)
      }
    }

    // 3. UC-Only explicit toggle (fallback when pttypes is empty)
    if (selectedPttypesList.length === 0 && ucOnly) {
      filtered = filtered.filter((i) => i.isUc)
    }

    // 4. Unified Global Search
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search)) ||
          (i.pttypename && i.pttypename.toLowerCase().includes(search)) ||
          (i.status_eclaim && i.status_eclaim.toLowerCase().includes(search))
        )
      })
    }

    // 4. Sorting
    filtered.sort((a, b) => {
      let valA: any = a[sortBy] ?? ''
      let valB: any = b[sortBy] ?? ''

      if (sortBy === 'compensated' || sortBy === 'income' || sortBy === 'age') {
        valA = Number(valA) || 0
        valB = Number(valB) || 0
      } else {
        valA = String(valA).toLowerCase()
        valB = String(valB).toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index displayed row numbers
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let resultItems: CancerFundPatientItem[]
    if (exportAll) {
      resultItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      resultItems = filtered
        .slice(startIndex, startIndex + pageSize)
        .map((item, idx) => ({ ...item, no: startIndex + idx + 1 }))
    }

    return {
      title: reportTitle,
      categoryTitle,
      subTitle,
      adpCode: CANCER_ADP_CODE,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      statusFilter,
      statusOptions,
      ucOnly,
      pttypes,
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
