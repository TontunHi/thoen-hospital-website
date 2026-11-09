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

// ── 1. Domain Types: กองทุนยา Clopidogrel ─────────────────────────────────────

export const CLOPIDOGREL_ADP_CODE = '37999771001'
export const CLOPIDOGREL_ADP_CODE_LEGACY = '3799977101'
export const CLOPIDOGREL_ADP_CODES = [CLOPIDOGREL_ADP_CODE, CLOPIDOGREL_ADP_CODE_LEGACY]
export const CLOPIDOGREL_DID_PREFIX = '1248460000039721217'

export type ClopidogrelCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'UC_ONLY'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'INVOICE'
  | 'NOT_SENT'

export type ClopidogrelSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'qty'
  | 'money'
  | 'hosxp_money'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface ClopidogrelReportParams extends FiscalDateRangeParams {
  cardFilter?: ClopidogrelCardFilter
  ucOnly?: boolean
  pttypes?: string
  search?: string
  sortBy?: ClopidogrelSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface ClopidogrelAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface ClopidogrelAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: ClopidogrelAdpMappingItem[]
}

export interface ClopidogrelItem {
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
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  pttype_eclaim_id: string
  pttypename: string
  isUc: boolean
  department: string | null
  clinic: string | null
  doctorname: string | null
  pdx: string | null
  dx0: string | null
  dx1: string | null
  dx2: string | null
  dx3: string | null
  dx4: string | null
  dx5: string | null
  icode: string
  drugname: string
  units: string | null
  adpcode: string | null
  adpname: string | null
  tmt: string | null
  did: string | null
  qty: number
  money: number
  hosxp_money: number
  status_eclaim: string
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund?: string | null
  subfund?: string | null
  errorcode?: string | null
}

export interface ClopidogrelSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  totalDrugMoney: number
  totalHosxpIncome: number
  totalQty: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  invoiceCount: number
  invoiceRate: number
  repCount: number
  repRate: number
  notSentCount: number
}

export interface ClopidogrelReportResult {
  title: string
  categoryTitle: string
  ds1: string
  ds2: string
  adpMapping: ClopidogrelAdpMappingCheck
  cardFilter: ClopidogrelCardFilter
  ucOnly: boolean
  search: string
  sortBy: ClopidogrelSortField
  sortOrder: 'asc' | 'desc'
  summary: ClopidogrelSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: ClopidogrelItem[]
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

// ── 3. RcmClopidogrelService Implementation ───────────────────────────────────

export class RcmClopidogrelService {
  /**
   * Check if Clopidogrel ADP code '37999771001' (or legacy '3799977101') is mapped in s_drugitems or drugitems.
   */
  static async checkAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh?: boolean
  ): Promise<ClopidogrelAdpMappingCheck> {
    const adpCode = CLOPIDOGREL_ADP_CODE
    const cacheKey = `rcm-clopidogrel-adp-mapping-check-v2-${adpCode}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-clopidogrel-adp-mapping-check-v2-${CLOPIDOGREL_ADP_CODE_LEGACY}`)
    }

    return getCachedData(
      cacheKey,
      async () => {
        if (executor === queryClinicalDb) {
          try {
            let gwRes = await apiGateway.clinical.getAdpMapping(CLOPIDOGREL_ADP_CODE)
            if (!gwRes?.isMapped) {
              gwRes = await apiGateway.clinical.getAdpMapping(CLOPIDOGREL_ADP_CODE_LEGACY)
            }
            if (gwRes && typeof gwRes.isMapped === 'boolean' && gwRes.isMapped) {
              return {
                adpCode: gwRes.adpCode || CLOPIDOGREL_ADP_CODE,
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
            WHERE TRIM(nhso_adp_code) IN (?, ?) OR TRIM(nhso_adp_code) LIKE '379997710%'
            UNION
            SELECT 
              icode, 
              name, 
              strength, 
              nhso_adp_code
            FROM drugitems 
            WHERE TRIM(nhso_adp_code) IN (?, ?) OR TRIM(nhso_adp_code) LIKE '379997710%'
            ORDER BY icode ASC;
          `
          const rows = (await executor(
            sql,
            [CLOPIDOGREL_ADP_CODE, CLOPIDOGREL_ADP_CODE_LEGACY, CLOPIDOGREL_ADP_CODE, CLOPIDOGREL_ADP_CODE_LEGACY],
            { timeoutMs: 15000 }
          )) as any[]
          const items: ClopidogrelAdpMappingItem[] = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))

          return {
            adpCode: CLOPIDOGREL_ADP_CODE,
            isMapped: items.length > 0,
            mappedCount: items.length,
            items,
          }
        } catch {
          return {
            adpCode: CLOPIDOGREL_ADP_CODE,
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
   * Generate กองทุนยา Clopidogrel Report:
   * - Queries OPD visits with dispensing of Clopidogrel drug (name REGEXP, ADP 3799977101, or DID prefix)
   * - Uses Driving Subquery Pattern on opitemrece for fast execution (<0.1s)
   * - Joins patient, pttype, doctor, authencode, and claim settlement tables (repeclaim, repdata, eclaimdb)
   * - Aggregates KPIs, calculates card filter counts, supports sorting, search, pagination.
   */
  static async getClopidogrelReport(
    params: ClopidogrelReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<ClopidogrelReportResult> {
    const categoryTitle = 'กองทุนยา Clopidogrel'
    const reportTitle = 'รายชื่อการใช้ยา Clopidogrel'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: ClopidogrelCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ClopidogrelSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-clopidogrel-usage-v2-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-clopidogrel-adp-mapping-check-v2-${CLOPIDOGREL_ADP_CODE}`)
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
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            ptt.name AS pttypename,
            dep.department AS department,
            spc.name AS clinic,
            doc.name AS doctorname,
            v.pdx,
            v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            IFNULL(v.income, 0) AS hosxp_money,
            dd.icode,
            dd.drugname,
            dd.units,
            dd.adpcode,
            dd.tmt,
            dd.did,
            dd.qty,
            dd.money,
            COALESCE(nhso.statusname, m.statusname, rep.statusname, nn.StatusName, '- :: ยังไม่ได้ส่ง') AS status_eclaim,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
            rep.agency,
            rep.fund AS fund,
            rep.subfund AS subfund,
            rep.errorcode
          FROM (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT target_items.icode SEPARATOR ', ') AS icode,
              GROUP_CONCAT(DISTINCT target_items.drug_name SEPARATOR ', ') AS drugname,
              GROUP_CONCAT(DISTINCT target_items.units SEPARATOR ', ') AS units,
              GROUP_CONCAT(DISTINCT target_items.nhso_adp_code SEPARATOR ', ') AS adpcode,
              GROUP_CONCAT(DISTINCT target_items.tmt SEPARATOR ', ') AS tmt,
              GROUP_CONCAT(DISTINCT target_items.did SEPARATOR ', ') AS did,
              SUM(oo.qty) AS qty,
              SUM(oo.sum_price) AS money,
              MAX(oo.doctor) AS doctor_code
            FROM (
              SELECT 
                d.icode, 
                CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) AS drug_name, 
                d.units,
                d.nhso_adp_code,
                IFNULL(d.tpu_code_list, d.sks_drug_code) AS tmt,
                d.did
              FROM drugitems d 
              WHERE (
                d.name REGEXP 'Clopidrogrel|Clopidogrel' 
                OR TRIM(d.nhso_adp_code) IN (?, ?)
                OR TRIM(d.nhso_adp_code) LIKE '379997710%'
                OR d.did LIKE ?
              )
            ) target_items
            JOIN opitemrece oo ON oo.icode = target_items.icode
            WHERE IFNULL(oo.vn, '') <> ''
              AND oo.vstdate BETWEEN ? AND ?
            GROUP BY oo.vn
            HAVING qty > 0
          ) dd
          JOIN ovst o ON o.vn = dd.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN doctor doc ON doc.code = dd.doctor_code
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN visit_pttype vt ON vt.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'NHSO :: ได้รับ Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = o.vn
          LEFT JOIN (
            SELECT vn,
                   GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
                   SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
                   IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: ส่ง Rep แล้ว', NULL) AS statusname,
                   GROUP_CONCAT(DISTINCT agency SEPARATOR ',') AS agency,
                   GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund,
                   GROUP_CONCAT(DISTINCT errorcode SEPARATOR ',') AS errorcode
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
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC, o.vn DESC;
        `

        const sqlParams: any[] = [
          CLOPIDOGREL_ADP_CODE,
          CLOPIDOGREL_ADP_CODE_LEGACY,
          `${CLOPIDOGREL_DID_PREFIX}%`, // d.did LIKE ?
          ds1, ds2, // dd oo.vstdate BETWEEN ? AND ?
          ds1, ds2, // nhso admdate
          ds1, ds2, // rep admdate
          ds1, ds2, // main ovst o vstdate
        ]

        let rows: any[] = []
        let mappingRes: ClopidogrelAdpMappingCheck = {
          adpCode: CLOPIDOGREL_ADP_CODE,
          isMapped: false,
          mappedCount: 0,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              RcmClopidogrelService.checkAdpMapping(executor, Boolean(params.refresh)),
              apiGateway.clinical.getRcmFundData('clopidogrel', { ds1, ds2, adpCode: CLOPIDOGREL_ADP_CODE }),
            ])
            mappingRes = mRes
            if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows) && gwRes.data.rawRows.length > 0) {
              const firstRow = gwRes.data.rawRows[0]
              // Check that Named API returned rich drug item fields (drugname or qty)
              if (firstRow && ('drugname' in firstRow || 'qty' in firstRow)) {
                rows = gwRes.data.rawRows
                fetchedViaNamedApi = true
              }
            }
          } catch {
            // Fallback to executor query
          }
        }

        if (!fetchedViaNamedApi) {
          const [mRes, dbRows] = await Promise.all([
            RcmClopidogrelService.checkAdpMapping(executor, Boolean(params.refresh)),
            executor(sql, sqlParams, { timeoutMs: 90000 }),
          ])
          rows = (dbRows as any[]) || []
          mappingRes = mRes
        }

        if (!rows || rows.length === 0) {
          invalidateCacheKey(cacheKey)
        }

        return {
          rawRows: rows || [],
          adpMapping: mappingRes,
        }
      },
      600000 // Cache TTL 10 minutes
    )

    // Normalize and map items
    const allItems: ClopidogrelItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const isCompensated = compensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename, pttypeEclaimId)
      const age = Number(r.age) || 0
      const sex = formatThaiSex(r.sex_code, r.sex)

      const ptname = String(r.ptname || '').trim()
      const rawFirstName = String(r.firstName || '').trim()
      const rawLastName = String(r.lastName || '').trim()

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
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        authencode,
        maininscl,
        pttype_eclaim_id: pttypeEclaimId,
        pttypename,
        isUc,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        doctorname: r.doctorname ? String(r.doctorname).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        icode: String(r.icode || '').trim(),
        drugname: String(r.drugname || r.listname || r.name || '').trim(),
        units: r.units ? String(r.units).trim() : null,
        adpcode: r.adpcode ? String(r.adpcode).trim() : (r.nhso_adp_code ? String(r.nhso_adp_code).trim() : null),
        adpname: r.adpcode && CLOPIDOGREL_ADP_CODES.includes(String(r.adpcode).trim()) ? 'ยา Clopidogrel' : null,
        tmt: r.tmt ? String(r.tmt).trim() : null,
        did: r.did ? String(r.did).trim() : null,
        qty: Number(r.qty) || 0,
        money: Number(r.money) || 0,
        hosxp_money: Number(r.hosxp_money ?? r.income) || 0,
        status_eclaim: String(r.status_eclaim || r.status || '- :: ยังไม่ได้ส่ง').trim(),
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated,
        agency: r.agency ? String(r.agency).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        errorcode: r.errorcode ? String(r.errorcode).trim() : null,
      }
    })

    // Dual-Mode Cohort Filtering (pttypes takes precedence, ucOnly fallback)
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Tier 1 Aggregated Summary from summaryCohort
    const totalVisits = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    let compensatedVisits = 0
    let totalCompensated = 0
    let totalDrugMoney = 0
    let totalHosxpIncome = 0
    let totalQty = 0
    let withAuthenCount = 0
    let ucCount = 0
    let invoiceCount = 0
    let repCount = 0
    let notSentCount = 0

    for (const item of summaryCohort) {
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      totalDrugMoney += item.money
      totalHosxpIncome += item.hosxp_money
      totalQty += item.qty

      if (item.authencode) {
        withAuthenCount++
      }
      if (item.isUc) {
        ucCount++
      }
      if (item.status_eclaim.includes('Invoice')) {
        invoiceCount++
      } else if (item.status_eclaim.includes('Rep')) {
        repCount++
      } else if (item.status_eclaim.includes('ยังไม่ได้ส่ง')) {
        notSentCount++
      }
    }

    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated =
      compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const invoiceRate = totalVisits > 0 ? (invoiceCount / totalVisits) * 100 : 0
    const repRate = totalVisits > 0 ? (repCount / totalVisits) * 100 : 0

    const summary: ClopidogrelSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate: Math.round(compensationRate * 100) / 100,
      totalCompensated,
      averageCompensated: Math.round(averageCompensated * 100) / 100,
      totalDrugMoney: Math.round(totalDrugMoney * 100) / 100,
      totalHosxpIncome: Math.round(totalHosxpIncome * 100) / 100,
      totalQty,
      withAuthenCount,
      withoutAuthenCount,
      authenRate: Math.round(authenRate * 100) / 100,
      ucCount,
      ucRate: Math.round(ucRate * 100) / 100,
      invoiceCount,
      invoiceRate: Math.round(invoiceRate * 100) / 100,
      repCount,
      repRate: Math.round(repRate * 100) / 100,
      notSentCount,
    }

    // Apply Filters
    let filtered = [...summaryCohort]

    switch (cardFilter) {
      case 'COMPENSATED':
        filtered = filtered.filter((i) => i.isCompensated)
        break
      case 'UNCOMPENSATED':
        filtered = filtered.filter((i) => !i.isCompensated)
        break
      case 'UC_ONLY':
        filtered = filtered.filter((i) => i.isUc)
        break
      case 'WITH_AUTHEN':
        filtered = filtered.filter((i) => Boolean(i.authencode))
        break
      case 'NO_AUTHEN':
        filtered = filtered.filter((i) => !i.authencode)
        break
      case 'INVOICE':
        filtered = filtered.filter((i) => i.status_eclaim.includes('Invoice'))
        break
      case 'NOT_SENT':
        filtered = filtered.filter((i) => i.status_eclaim.includes('ยังไม่ได้ส่ง'))
        break
      case 'ALL':
      default:
        break
    }

    // Apply Global Search (cross-cutting: HN, CID, name, VN, doctor, clinic, department, diagnosis, drug)
    if (search) {
      filtered = filtered.filter((item) => {
        return (
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.doctorname && item.doctorname.toLowerCase().includes(search)) ||
          (item.clinic && item.clinic.toLowerCase().includes(search)) ||
          (item.department && item.department.toLowerCase().includes(search)) ||
          (item.pdx && item.pdx.toLowerCase().includes(search)) ||
          (item.drugname && item.drugname.toLowerCase().includes(search)) ||
          (item.pttypename && item.pttypename.toLowerCase().includes(search)) ||
          (item.authencode && item.authencode.toLowerCase().includes(search)) ||
          (item.rep && item.rep.toLowerCase().includes(search))
        )
      })
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      let valA: string | number = a[sortBy] ?? ''
      let valB: string | number = b[sortBy] ?? ''

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
      }
      if (typeof valB === 'string') {
        valB = valB.toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index item numbers after filtering and sorting
    filtered = filtered.map((item, idx) => ({
      ...item,
      no: idx + 1,
    }))

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    // Pagination (or full dataset for exportAll)
    const paginatedItems = exportAll
      ? filtered
      : filtered.slice((page - 1) * pageSize, page * pageSize)

    return {
      title: reportTitle,
      categoryTitle,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      search: params.search || '',
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: paginatedItems,
    }
  }
}
