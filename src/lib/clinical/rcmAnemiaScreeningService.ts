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

// ── 1. Domain Types: 17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP (13001) ──

export type AnemiaScreeningCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'TARGET_AGE'
  | 'REPEAT_CLAIM'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type AnemiaScreeningSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'

export type AnemiaScreeningSortField =
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
  | 'camedate'

export interface AnemiaScreeningReportParams extends FiscalDateRangeParams {
  cardFilter?: AnemiaScreeningCardFilter
  ucOnly?: boolean
  pttypes?: string
  targetAgeOnly?: boolean
  searchField?: AnemiaScreeningSearchField
  search?: string
  sortBy?: AnemiaScreeningSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface AnemiaScreeningAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface AnemiaScreeningAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: AnemiaScreeningAdpMappingItem[]
}

export interface AnemiaScreeningItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  age: number
  isTargetAge: boolean // Age between 13 and 24 years
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  isUc: boolean
  pttype_eclaim_id: string
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
  listname: string | null
  listname1?: string | null
  camedate: string | null // เคยเคลมในปีงบประมาณก่อนหน้า visit นี้
  hasRepeatClaim: boolean // มีประวัติเคยเคลมในปีงบเดียวกัน
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

export interface AnemiaScreeningSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  targetAgeCount: number // อายุ 13-24 ปี
  targetAgeRate: number
  repeatClaimCount: number // เคยเคลมซ้ำในปีงบประมาณ
  repeatClaimRate: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface AnemiaScreeningReportResult {
  adpCode: '13001'
  title: string
  ds1: string
  ds2: string
  fiscalStartYear: string
  adpMapping: AnemiaScreeningAdpMappingCheck
  cardFilter: AnemiaScreeningCardFilter
  ucOnly: boolean
  pttypes?: string
  targetAgeOnly: boolean
  searchField: AnemiaScreeningSearchField
  search: string
  sortBy: AnemiaScreeningSortField
  sortOrder: 'asc' | 'desc'
  summary: AnemiaScreeningSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: AnemiaScreeningItem[]
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

/**
 * Calculates start of fiscal year (YYYY-10-01) for a given date YYYY-MM-DD.
 * Equivalent to legacy FoxPro startyear(_start).
 */
export function getFiscalYearStartDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length < 2) return dateStr
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const startY = m >= 10 ? y : y - 1
  return `${startY}-10-01`
}

// ── 3. RcmAnemiaScreeningService Implementation ───────────────────────────────────

export class RcmAnemiaScreeningService {
  /**
   * Check if ADP code '13001' is mapped in s_drugitems table.
   */
  static async checkAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh?: boolean
  ): Promise<AnemiaScreeningAdpMappingCheck> {
    const adpCode = '13001'
    const cacheKey = `rcm-anemia-screening-adp-mapping-check-${adpCode}`
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
          const items: AnemiaScreeningAdpMappingItem[] = (rows || []).map((r) => ({
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
   * Generate 17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP (13001) Report:
   * - Queries visits with dispensing of ADP code 13001 in opitemrece
   * - Calculates previous claims in same fiscal year (camedate < vstdate)
   * - Identifies target age (13-24 years)
   * - Aggregates KPIs, calculates card filter counts, supports sorting, search, pagination.
   */
  static async getAnemiaScreeningReport(
    params: AnemiaScreeningReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<AnemiaScreeningReportResult> {
    const adpCode = '13001'
    const reportTitle = '17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const fiscalStartYear = getFiscalYearStartDate(ds1)

    const cardFilter: AnemiaScreeningCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const targetAgeOnly = Boolean(params.targetAgeOnly)
    const searchField: AnemiaScreeningSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: AnemiaScreeningSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-anemia-screening-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-anemia-screening-adp-mapping-check-${adpCode}`)
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
              (
                SELECT GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ')
                FROM opitemrece a
                JOIN nondrugitems b ON b.icode = a.icode
                WHERE a.vn = o.vn
              ) AS listname1,
              (
                SELECT GROUP_CONCAT(DISTINCT DATE_FORMAT(o2.vstdate, '%Y-%m-%d') ORDER BY o2.vstdate SEPARATOR ', ')
                FROM ovst o2
                JOIN opitemrece oo2 ON oo2.vn = o2.vn
                JOIN s_drugitems d2 ON d2.icode = oo2.icode
                WHERE o2.hn = o.hn
                  AND o2.vstdate >= ? AND o2.vstdate < o.vstdate
                  AND TRIM(d2.nhso_adp_code) = ?
              ) AS camedate,
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
              AND (v.sex = 2 OR v.sex = '2' OR pt.sex = '2' OR pt.sex = 2)
              AND (
                v.age_y BETWEEN 13 AND 24 
                OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) BETWEEN 13 AND 24
              )
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC;
        `

        const sqlParams: any[] = [
          fiscalStartYear, adpCode, // camedate
          ds1, ds2, adpCode, // dd
          ds1, ds2, // nhso
          ds1, ds2, // rep
          ds1, ds2, // main ovst o
        ]

        let rows: any[] = []
        let mappingRes: AnemiaScreeningAdpMappingCheck = {
          adpCode,
          isMapped: false,
          mappedCount: 0,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              RcmAnemiaScreeningService.checkAdpMapping(executor, Boolean(params.refresh)),
              apiGateway.clinical.getRcmFundData('anemia-screening', { ds1, ds2, adpCode }),
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
            RcmAnemiaScreeningService.checkAdpMapping(executor, Boolean(params.refresh)),
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
    const allItems: AnemiaScreeningItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const isCompensated = compensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const isUc = isUniversalCoverageScheme(maininscl, pttypename)
      const age = Number(r.age) || 0
      const isTargetAge = age >= 13 && age <= 24
      const camedate = r.camedate ? String(r.camedate).trim() : null
      const hasRepeatClaim = Boolean(camedate && camedate.length > 0)
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
        isUc,
        pttype_eclaim_id: String(r.pttype_eclaim_id || '').trim(),
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
        camedate: camedate || null,
        hasRepeatClaim,
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

    const pttypes = (params.pttypes || '').trim()
    const selectedPttypesList = pttypes ? pttypes.split(',').map((s) => s.trim()).filter(Boolean) : []

    // Cohort for summary KPIs (Full page filter Q2: A)
    const summaryCohort = selectedPttypesList.length > 0
      ? allItems.filter((it) => matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, selectedPttypesList, it.isUc, it.pttype_eclaim_id))
      : allItems

    // Calculate Summary Aggregates across summaryCohort
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let repeatClaimCount = 0
    let withAuthenCount = 0
    let ucCount = 0
    let targetAgeCount = 0
    let totalIncome = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      if (item.hasRepeatClaim) repeatClaimCount++
      if (item.authencode) withAuthenCount++
      if (item.isUc) ucCount++
      if (item.isTargetAge) targetAgeCount++
      totalIncome += item.income
    }

    const totalVisits = summaryCohort.length
    const uncompensatedVisits = totalVisits - compensatedVisits
    const withoutAuthenCount = totalVisits - withAuthenCount
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const repeatClaimRate = totalVisits > 0 ? (repeatClaimCount / totalVisits) * 100 : 0
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0
    const targetAgeRate = totalVisits > 0 ? (targetAgeCount / totalVisits) * 100 : 0

    const summary: AnemiaScreeningSummary = {
      totalVisits,
      uniquePatients: uniqueHnSet.size,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      targetAgeCount,
      targetAgeRate,
      repeatClaimCount,
      repeatClaimRate,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
      totalIncome,
    }

    // Apply Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    } else if (cardFilter === 'REPEAT_CLAIM') {
      filtered = filtered.filter((i) => i.hasRepeatClaim)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    // Secondary filters: ucOnly & targetAgeOnly (fallback when pttypes is empty)
    if (selectedPttypesList.length === 0 && ucOnly && cardFilter !== 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }
    if (targetAgeOnly && cardFilter !== 'TARGET_AGE') {
      filtered = filtered.filter((i) => i.isTargetAge)
    }

    // Apply Search
    if (search) {
      filtered = filtered.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return item.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (item.pdx && item.pdx.toLowerCase().includes(search)) ||
            (item.sdx && item.sdx.toLowerCase().includes(search))
          )
        }
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)

        // ALL searchField: searches hn, cid, ptname, vn, pdx, authencode, rep, pttypename
        return (
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.pdx && item.pdx.toLowerCase().includes(search)) ||
          (item.authencode && item.authencode.toLowerCase().includes(search)) ||
          (item.rep && item.rep.toLowerCase().includes(search)) ||
          item.pttypename.toLowerCase().includes(search)
        )
      })
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'vstdate':
          comparison = a.vstdate.localeCompare(b.vstdate) || a.vsttime.localeCompare(b.vsttime)
          break
        case 'vsttime':
          comparison = a.vsttime.localeCompare(b.vsttime)
          break
        case 'hn':
          comparison = a.hn.localeCompare(b.hn)
          break
        case 'cid':
          comparison = a.cid.localeCompare(b.cid)
          break
        case 'ptname':
          comparison = a.ptname.localeCompare(b.ptname, 'th')
          break
        case 'age':
          comparison = a.age - b.age
          break
        case 'income':
          comparison = a.income - b.income
          break
        case 'compensated':
          comparison = a.compensated - b.compensated
          break
        case 'pdx':
          comparison = (a.pdx || '').localeCompare(b.pdx || '')
          break
        case 'authencode':
          comparison = (a.authencode || '').localeCompare(b.authencode || '')
          break
        case 'camedate':
          comparison = (a.camedate || '').localeCompare(b.camedate || '')
          break
        default:
          comparison = a.vstdate.localeCompare(b.vstdate)
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    // Re-index displayed numbers sequentially
    const reindexedItems = filtered.map((item, idx) => ({
      ...item,
      no: idx + 1,
    }))

    const totalCount = reindexedItems.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    const paginatedItems = exportAll
      ? reindexedItems
      : reindexedItems.slice((page - 1) * pageSize, page * pageSize)

    return {
      adpCode,
      title: reportTitle,
      ds1,
      ds2,
      fiscalStartYear,
      adpMapping,
      cardFilter,
      ucOnly,
      pttypes,
      targetAgeOnly,
      searchField,
      search,
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
