import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
  type QueryExecutor,
} from './rcmDashboardService'
import { matchesPttypeFilter } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'

// ── 1. Domain Types: ไวรัสตับอักเสบ C (23.2 คัดกรอง 36331 & 23.4 ยืนยัน HCV RNA 36333) ──

export const HEPATITIS_C_SCREENING_ADP = '36331' as const
export const HEPATITIS_C_CONFIRM_ADP = '36333' as const

export type HepatitisCCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'
  | 'WITH_LAB'
  | 'SEAMLESS'
  | 'SEAMLESS_COMPENSATED'

export type HepatitisCSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'LAB'
  | 'LABRESULT'

export type HepatitisCSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'pdx'
  | 'labresult'
  | 'authencode'

export interface HepatitisCReportParams extends FiscalDateRangeParams {
  adpCode?: string
  cardFilter?: HepatitisCCardFilter
  ucOnly?: boolean
  pttypes?: string
  withLabOnly?: boolean
  searchField?: HepatitisCSearchField
  search?: string
  sortBy?: HepatitisCSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface HepatitisCAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface HepatitisCAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: HepatitisCAdpMappingItem[]
}

export interface HepatitisCItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number
  nation?: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  isUc: boolean
  pttypename: string
  pttype_eclaim_id?: string | null
  cc: string | null
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
  labresult: string | null
  hasLab: boolean
  listname: string | null
  listname1?: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund: string | null
  subfund: string | null
  errorcode?: string | null
  transactiontype?: string | null
  status_sm: string | null
  rep_sm: string | null
  compensated_sm: number
  isSeamlessCompensated: boolean
  address: string | null
  mobile: string | null
  tel: string | null
  hospcode?: string | null
}

export interface HepatitisCSummary {
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
  ucCount: number
  ucRate: number
  withLabCount: number
  withLabRate: number
  seamlessCount: number
  seamlessCompensatedCount?: number
  totalSeamlessCompensated: number
  totalIncome: number
}

export interface HepatitisCReportResult {
  adpCode: string
  title: string
  categoryTitle?: string
  ds1: string
  ds2: string
  cardFilter: HepatitisCCardFilter
  ucOnly: boolean
  withLabOnly: boolean
  searchField: HepatitisCSearchField
  search: string
  sortBy: HepatitisCSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  items: HepatitisCItem[]
  summary: HepatitisCSummary
  adpMapping: HepatitisCAdpMappingCheck
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

export class RcmHepatitisCService {
  /**
   * Pre-check whether the NHSO ADP Code is mapped in HOSxP `s_drugitems` table.
   */
  static async checkAdpMapping(
    executorOrAdp?: QueryExecutor | string,
    refreshOrExecutor?: boolean | QueryExecutor,
    maybeRefresh?: boolean
  ): Promise<HepatitisCAdpMappingCheck> {
    let adpCode = '36331'
    let executor: QueryExecutor = queryClinicalDb
    let refresh = false

    if (typeof executorOrAdp === 'string') {
      adpCode = executorOrAdp
      if (typeof refreshOrExecutor === 'function') {
        executor = refreshOrExecutor
      }
      if (typeof maybeRefresh === 'boolean') {
        refresh = maybeRefresh
      }
    } else if (typeof executorOrAdp === 'function') {
      executor = executorOrAdp
      if (typeof refreshOrExecutor === 'boolean') {
        refresh = refreshOrExecutor
      }
    }

    const cacheKey = `rcm-hepatitis-c-adp-mapping-check-${adpCode}`
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
            ORDER BY icode ASC;
          `
          const rows = (await executor(sql, [adpCode], { timeoutMs: 15000 })) as any[]
          const items: HepatitisCAdpMappingItem[] = (rows || []).map((r) => ({
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
   * Generate Hepatitis C Report (23.2 screening ADP 36331 or 23.4 confirmation ADP 36333)
   */
  static async getHepatitisCReport(
    params: HepatitisCReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<HepatitisCReportResult> {
    const adpCode = params.adpCode || '36331'
    const isScreening = adpCode === '36331'
    const reportTitle = isScreening
      ? '23.2 บริการตรวจคัดกรองไวรัสตับอักเสบ C'
      : '23.4 ตรวจยืนยันไวรัสตับ C HCV RNA'
    const categoryTitle = isScreening
      ? 'บริการตรวจคัดกรองไวรัสตับอักเสบ C'
      : 'ตรวจยืนยันไวรัสตับ C HCV RNA'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: HepatitisCCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const withLabOnly = Boolean(params.withLabOnly)
    const searchField: HepatitisCSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: HepatitisCSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-hepatitis-c-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-hepatitis-c-adp-mapping-check-${adpCode}`)
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
            ptt.name AS pttypename,
            ptt.pttype_eclaim_id,
            s.cc AS cc,
            dep.department AS department,
            spc.name AS clinic,
            v.pdx,
            v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
            IFNULL(v.income, 0) AS income,
            dd.name AS listname,
            nd.listname1 AS listname1,
            l.labresult,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-::ยังไม่ได้ส่ง') AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
            pt.informaddr AS address,
            pt.mobile_phone_number AS mobile,
            CONCAT_WS(' / ', NULLIF(TRIM(pt.informtel), ''), NULLIF(TRIM(pt.hometel), '')) AS tel,
            sm.status_sm,
            sm.rep_sm,
            IFNULL(sm.compensated_sm, 0) AS compensated_sm,
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
            LEFT JOIN nondrugitems nd ON nd.icode = l.icode
            LEFT JOIN s_drugitems sd ON sd.icode = l.icode
            WHERE lh.order_date BETWEEN ? AND ?
              AND (TRIM(IFNULL(nd.nhso_adp_code, '')) = ? OR TRIM(IFNULL(sd.nhso_adp_code, '')) = ?)
            GROUP BY lh.vn
          ) l ON l.vn = o.vn
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
          LEFT JOIN (
            SELECT
              vn,
              GROUP_CONCAT(DISTINCT status SEPARATOR ', ') AS status_sm,
              GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep_sm,
              SUM(IFNULL(compensated, 0)) AS compensated_sm
            FROM rcmdb.seamless
            WHERE IFNULL(vn, '') <> ''
            GROUP BY vn
          ) sm ON sm.vn = o.vn
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC;
        `

        const queryParams = [
          ds1,
          ds2,
          adpCode,
          ds1,
          ds2,
          adpCode,
          adpCode,
          ds1,
          ds2,
          adpCode,
          ds1,
          ds2,
          ds1,
          ds2,
        ]

        let rows: any[] = []
        let adpCheck: HepatitisCAdpMappingCheck = {
          adpCode,
          isMapped: false,
          mappedCount: 0,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              this.checkAdpMapping(adpCode, executor, params.refresh),
              apiGateway.clinical.getRcmFundData('hepatitis-c', { ds1, ds2, adpCode }),
            ])
            adpCheck = mRes
            if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows)) {
              rows = gwRes.data.rawRows
              fetchedViaNamedApi = true
            }
          } catch {
            // Fallback to executor query
          }
        }

        if (!fetchedViaNamedApi) {
          const [dbRows, mRes] = await Promise.all([
            executor(sql, queryParams, { timeoutMs: 90000 }) as Promise<any[]>,
            this.checkAdpMapping(adpCode, executor, params.refresh),
          ])
          rows = dbRows || []
          adpCheck = mRes
        }

        return {
          rawRows: rows || [],
          adpMapping: adpCheck,
        }
      },
      300000 // Cache TTL 5 minutes
    )

    let allDomainItems: HepatitisCItem[] = rawRows.map((row: any, idx: number) => {
      const compensated = Number(row.compensated || 0)
      const compensatedSm = Number(row.compensated_sm || 0)
      const isComp = compensated > 0
      const isSmComp = compensatedSm > 0
      const maininscl = String(row.maininscl || '').trim()
      const pttypename = String(row.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename)
      const labResultStr = row.labresult ? String(row.labresult).trim() : null

      const sdxList = [row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5]
        .map((d) => (d ? String(d).trim() : null))
        .filter((d): d is string => Boolean(d))
      const opsList = [row.op0, row.op1, row.op2, row.op3, row.op4, row.op5]
        .map((op) => (op ? String(op).trim() : null))
        .filter((op): op is string => Boolean(op))

      return {
        no: idx + 1,
        vn: String(row.vn || '').trim(),
        cid: String(row.cid || '').trim(),
        hn: String(row.hn || '').trim(),
        ptname: String(row.ptname || '').trim(),
        sex: formatThaiSex(row.sex_code),
        age: Number(row.age || 0),
        nation: row.nation ? String(row.nation).trim() : null,
        vstdate: String(row.vstdate || '').trim(),
        vsttime: String(row.vsttime || '').trim(),
        authencode: row.authencode ? String(row.authencode).trim() : null,
        maininscl,
        isUc,
        pttypename,
        pttype_eclaim_id: row.pttype_eclaim_id != null ? String(row.pttype_eclaim_id).trim() : null,
        cc: row.cc ? String(row.cc).trim() : null,
        department: row.department ? String(row.department).trim() : null,
        clinic: row.clinic ? String(row.clinic).trim() : null,
        pdx: row.pdx ? String(row.pdx).trim() : null,
        dx0: row.dx0 ? String(row.dx0).trim() : null,
        dx1: row.dx1 ? String(row.dx1).trim() : null,
        dx2: row.dx2 ? String(row.dx2).trim() : null,
        dx3: row.dx3 ? String(row.dx3).trim() : null,
        dx4: row.dx4 ? String(row.dx4).trim() : null,
        dx5: row.dx5 ? String(row.dx5).trim() : null,
        sdx: sdxList.length > 0 ? sdxList.join(', ') : null,
        op0: row.op0 ? String(row.op0).trim() : null,
        op1: row.op1 ? String(row.op1).trim() : null,
        op2: row.op2 ? String(row.op2).trim() : null,
        op3: row.op3 ? String(row.op3).trim() : null,
        op4: row.op4 ? String(row.op4).trim() : null,
        op5: row.op5 ? String(row.op5).trim() : null,
        ops: opsList.length > 0 ? opsList.join(', ') : null,
        income: Number(row.income || 0),
        labresult: labResultStr,
        hasLab: Boolean(labResultStr && labResultStr !== '-'),
        listname: row.listname ? String(row.listname).trim() : null,
        listname1: row.listname1 ? String(row.listname1).trim() : null,
        status: row.status ? String(row.status).trim() : null,
        rep: row.rep ? String(row.rep).trim() : null,
        compensated,
        isCompensated: isComp,
        agency: row.agency ? String(row.agency).trim() : null,
        fund: row.fund ? String(row.fund).trim() : null,
        subfund: row.subfund ? String(row.subfund).trim() : null,
        errorcode: row.errorcode ? String(row.errorcode).trim() : null,
        transactiontype: row.transactiontype ? String(row.transactiontype).trim() : null,
        status_sm: row.status_sm ? String(row.status_sm).trim() : null,
        rep_sm: row.rep_sm ? String(row.rep_sm).trim() : null,
        compensated_sm: compensatedSm,
        isSeamlessCompensated: isSmComp,
        address: row.address ? String(row.address).trim() : null,
        mobile: row.mobile ? String(row.mobile).trim() : null,
        tel: row.tel ? String(row.tel).trim() : null,
        hospcode: '10978',
      }
    })

    // Calculate Summary Aggregates (Full Page Filter based on pttypes / ucOnly)
    allDomainItems = await enrichItemsWithSeamlessCache(cacheKey, allDomainItems, executor, Boolean(params.refresh))
    let summaryCohort = allDomainItems
    if (params.pttypes) {
      const selectedPttypesList = params.pttypes.split(',').map((p) => p.trim()).filter(Boolean)
      summaryCohort = summaryCohort.filter((item) =>
        matchesPttypeFilter(item.pttypename || item.pttype_eclaim_id, selectedPttypesList, item.isUc, item.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = summaryCohort.filter((item) => item.isUc)
    }

    const totalVisits = summaryCohort.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let ucCount = 0
    let withLabCount = 0
    let seamlessCompensatedCount = 0
    let totalSeamlessCompensated = 0
    let totalIncome = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCount++
      if (item.isUc) ucCount++
      if (item.hasLab) withLabCount++
      if (item.isSeamlessCompensated) {
        seamlessCompensatedCount++
        totalSeamlessCompensated += item.compensated_sm
      }
      totalIncome += item.income
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const withLabRate = totalVisits > 0 ? (withLabCount / totalVisits) * 100 : 0

    const summary: HepatitisCSummary = {
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
      ucCount,
      ucRate,
      withLabCount,
      withLabRate,
      seamlessCount: seamlessCompensatedCount,
      seamlessCompensatedCount,
      totalSeamlessCompensated,
      totalIncome,
    }

    let filtered = summaryCohort.filter((item) => {
      switch (cardFilter) {
        case 'COMPENSATED':
          return item.isCompensated
        case 'UNCOMPENSATED':
          return !item.isCompensated
        case 'WITH_AUTHEN':
          return Boolean(item.authencode)
        case 'NO_AUTHEN':
          return !item.authencode
        case 'UC_ONLY':
          return item.isUc
        case 'WITH_LAB':
          return item.hasLab
        case 'SEAMLESS':
        case 'SEAMLESS_COMPENSATED':
          return item.isSeamlessCompensated
        case 'ALL':
        default:
          return true
      }
    })

    if (ucOnly) {
      filtered = filtered.filter((i) => i.isUc)
    }
    if (withLabOnly) {
      filtered = filtered.filter((i) => i.hasLab)
    }

    if (search) {
      filtered = filtered.filter((item) => {
        const matchHn = item.hn.toLowerCase().includes(search)
        const matchCid = item.cid.toLowerCase().includes(search)
        const matchPtname = item.ptname.toLowerCase().includes(search)
        const matchVn = item.vn.toLowerCase().includes(search)
        const matchPdx = (item.pdx || '').toLowerCase().includes(search)
        const matchSdx = (item.sdx || '').toLowerCase().includes(search)
        const matchPttype = (item.pttypename || '').toLowerCase().includes(search)
        const matchLab = (item.labresult || '').toLowerCase().includes(search)
        const matchAuthen = (item.authencode || '').toLowerCase().includes(search)
        const matchRep = (item.rep || '').toLowerCase().includes(search)

        switch (searchField) {
          case 'HN':
            return matchHn
          case 'CID':
            return matchCid
          case 'PTNAME':
            return matchPtname
          case 'VN':
            return matchVn
          case 'DIAG':
            return matchPdx || matchSdx
          case 'PTTYPE':
            return matchPttype
          case 'LAB':
          case 'LABRESULT':
            return matchLab
          case 'ALL':
          default:
            return (
              matchesSeamlessRepSearch(item, search) ||
              matchHn ||
              matchCid ||
              matchPtname ||
              matchVn ||
              matchPdx ||
              matchSdx ||
              matchPttype ||
              matchLab ||
              matchAuthen ||
              matchRep
            )
        }
      })
    }

    filtered.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'vstdate':
          cmp = a.vstdate.localeCompare(b.vstdate) || a.vsttime.localeCompare(b.vsttime)
          break
        case 'vsttime':
          cmp = a.vsttime.localeCompare(b.vsttime)
          break
        case 'hn':
          cmp = a.hn.localeCompare(b.hn)
          break
        case 'cid':
          cmp = a.cid.localeCompare(b.cid)
          break
        case 'ptname':
          cmp = a.ptname.localeCompare(b.ptname, 'th')
          break
        case 'age':
          cmp = a.age - b.age
          break
        case 'income':
          cmp = a.income - b.income
          break
        case 'compensated':
          cmp = a.compensated - b.compensated
          break
        case 'pdx':
          cmp = (a.pdx || '').localeCompare(b.pdx || '')
          break
        case 'authencode':
          cmp = (a.authencode || '').localeCompare(b.authencode || '')
          break
        case 'labresult':
          cmp = (a.labresult || '').localeCompare(b.labresult || '')
          break
        default:
          cmp = 0
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pagedItems: HepatitisCItem[]
    if (exportAll) {
      pagedItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      pagedItems = filtered
        .slice(startIndex, startIndex + pageSize)
        .map((item, idx) => ({ ...item, no: startIndex + idx + 1 }))
    }

    return {
      adpCode,
      title: reportTitle,
      categoryTitle,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      withLabOnly,
      searchField,
      search: params.search || '',
      sortBy,
      sortOrder,
      page: exportAll ? 1 : page,
      pageSize: exportAll ? totalCount : pageSize,
      totalCount,
      totalPages,
      items: pagedItems,
      summary,
    }
  }
}
