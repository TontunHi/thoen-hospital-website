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

// ── 1. Domain Types: 21.2 บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test) อายุ 50-70 ปี (ADP 90005) ──

export type ColorectalCancerCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'COMPLETE'
  | 'MISSING_ADP'
  | 'MISSING_PP'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type ColorectalCancerSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'DIAG'
  | 'PTTYPE'
  | 'CODE'
  | 'LAB'

export type ColorectalCancerSortField =
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
  | 'code'

export type ColorectalCancerDataQualityStatus =
  | 'COMPLETE' // มี ADP 90005 + Special PP 1B0060 หรือ 1B0061
  | 'MISSING_ADP' // มี Special PP แต่ไม่มี ADP 90005 (แถบสีแดงอ่อน)
  | 'MISSING_PP' // มี ADP 90005 แต่ไม่มี Special PP (แถบสีส้ม)
  | 'INVALID_PP_CODE' // มี Special PP แต่รหัสไม่ใช่ 1B0060/1B0061 (แถบสีเหลืองอ่อน)

export interface ColorectalCancerReportParams extends FiscalDateRangeParams {
  cardFilter?: ColorectalCancerCardFilter
  ucOnly?: boolean
  pttypes?: string
  searchField?: ColorectalCancerSearchField
  search?: string
  sortBy?: ColorectalCancerSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface ColorectalCancerAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface ColorectalCancerAdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: ColorectalCancerAdpMappingItem[]
}

export interface ColorectalCancerItem {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  isTargetAge: boolean // อายุ 50 - 70 ปี
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  maininscl: string
  isUc: boolean
  pttype?: string
  pttype_eclaim_id?: string
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
  labresult: string | null
  code: string | null // tt.pp_special_type_name
  pp_special_code: string | null // e.g. 1B0060, 1B0061
  listname: string | null // ADP 90005 description
  hasAdp: boolean
  hasPpSpecial: boolean
  dataQualityStatus: ColorectalCancerDataQualityStatus
  status_seamless: string | null
  rep_seamless: string | null
  compensated_seamless: number
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  agency?: string | null
  fund: string | null
  subfund: string | null
}

export interface ColorectalCancerSummary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  completeCount: number
  completeRate: number
  missingAdpCount: number
  missingAdpRate: number
  missingPpCount: number
  missingPpRate: number
  invalidPpCodeCount: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  totalIncome: number
}

export interface ColorectalCancerReportResult {
  adpCode: '90005'
  title: string
  categoryTitle: string
  ds1: string
  ds2: string
  adpMapping: ColorectalCancerAdpMappingCheck
  cardFilter: ColorectalCancerCardFilter
  ucOnly: boolean
  pttypes?: string
  searchField: ColorectalCancerSearchField
  search: string
  sortBy: ColorectalCancerSortField
  sortOrder: 'asc' | 'desc'
  summary: ColorectalCancerSummary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: ColorectalCancerItem[]
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

/**
 * Classifies data quality based on Visual FoxPro legacy color logic:
 * - empty(nvl(listname,'')) -> lightred (ขาด ADP 90005)
 * - empty(nvl(code,'')) -> orange (ขาด Special PP)
 * - !(getwordnum(code,1,' ')=='1B0060' or getwordnum(code,1,' ')=='1B0061') -> lightyellow (รหัส PP ไม่ตรง)
 * - else -> white / normal (ข้อมูลครบถ้วน)
 */
export function evaluateFitTestDataQuality(
  hasAdp: boolean,
  ppCodeName?: string | null,
  ppSpecialCode?: string | null
): ColorectalCancerDataQualityStatus {
  if (!hasAdp) {
    return 'MISSING_ADP'
  }

  const nameVal = (ppCodeName || '').trim()
  const codeVal = (ppSpecialCode || '').trim()

  if (!nameVal && !codeVal) {
    return 'MISSING_PP'
  }

  // Check if first token or code contains 1B0060 or 1B0061
  const firstWord = nameVal.split(/\s+/)[0] || ''
  const hasValidCode =
    firstWord === '1B0060' ||
    firstWord === '1B0061' ||
    codeVal.includes('1B0060') ||
    codeVal.includes('1B0061')

  if (!hasValidCode) {
    return 'INVALID_PP_CODE'
  }

  return 'COMPLETE'
}

// ── 3. RcmColorectalCancerService Implementation ──────────────────────────────

export class RcmColorectalCancerService {
  /**
   * Check if ADP code '90005' is mapped in s_drugitems table.
   */
  static async checkAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh?: boolean
  ): Promise<ColorectalCancerAdpMappingCheck> {
    const adpCode = '90005'
    const cacheKey = `rcm-fit-test-adp-mapping-check-${adpCode}`
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
          const items: ColorectalCancerAdpMappingItem[] = (rows || []).map((r) => ({
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
   * Generate 21.2 รายชื่อผู้รับบริการ ADP (90005) - บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test) Report.
   * Direct translation of legacy Visual FoxPro logic with high-performance Driving Subquery Pattern.
   */
  static async getColorectalCancerReport(
    params: ColorectalCancerReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<ColorectalCancerReportResult> {
    const adpCode = '90005'
    const categoryTitle = 'บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test) อายุ 50-70 ปี'
    const reportTitle = '21.2 รายชื่อผู้รับบริการ ADP (90005)'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: ColorectalCancerCardFilter = params.cardFilter || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const searchField: ColorectalCancerSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ColorectalCancerSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fit-test-report-${adpCode}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-fit-test-adp-mapping-check-${adpCode}`)
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
            DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
            IFNULL(pt.sex, '') AS sex_code,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            IFNULL(nat.name, pt.nationality) AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            IFNULL(o.pttype, '') AS pttype,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            ptt.name AS pttypename,
            dep.department AS department,
            spc.name AS clinic,
            v.pdx,
            v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
            IFNULL(v.income, 0) AS income,
            lo.labresult AS labresult,
            tt.pp_special_code AS pp_special_code,
            tt.code AS code,
            dd.name AS listname,
            sm.status AS status_seamless,
            sm.rep AS rep_seamless,
            IFNULL(sm.compensated, 0) AS compensated_seamless,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, sm.status, '-:ยังไม่ได้ส่ง') AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep, sm.rep) AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, sm.compensated, 0) AS compensated,
            rep.agency,
            rep.fund,
            rep.subfund
          FROM ovst o
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
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', s_sub.name, NULLIF(s_sub.strength, '')) SEPARATOR ', ') AS name
            FROM s_drugitems s_sub
            JOIN opitemrece oo ON oo.icode = s_sub.icode
            WHERE TRIM(s_sub.nhso_adp_code) = ?
              AND IFNULL(oo.vn, '') <> ''
              AND oo.vstdate BETWEEN ? AND ?
            GROUP BY oo.vn
          ) dd ON dd.vn = o.vn
          LEFT JOIN (
            SELECT 
              pp.vn,
              GROUP_CONCAT(DISTINCT tt_sub.pp_special_code SEPARATOR ', ') AS pp_special_code,
              GROUP_CONCAT(DISTINCT tt_sub.pp_special_type_name SEPARATOR ', ') AS code
            FROM pp_special pp
            JOIN pp_special_type tt_sub ON tt_sub.pp_special_type_id = pp.pp_special_type_id
            WHERE tt_sub.pp_special_code REGEXP '1B006'
            GROUP BY pp.vn
          ) tt ON tt.vn = o.vn
          LEFT JOIN (
            SELECT 
              lh.vn,
              GROUP_CONCAT(DISTINCT lo_sub.lab_order_result SEPARATOR ', ') AS labresult
            FROM lab_head lh
            JOIN lab_order lo_sub ON lo_sub.lab_order_number = lh.lab_order_number 
                                 AND lo_sub.lab_items_name_ref REGEXP 'stool'
            WHERE lh.order_date BETWEEN ? AND ?
            GROUP BY lh.vn
          ) lo ON lo.vn = o.vn
          LEFT JOIN (
            SELECT vn, 
                   SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY vn), ',', 1) AS status,
                   SUBSTRING_INDEX(GROUP_CONCAT(rep ORDER BY vn), ',', 1) AS rep,
                   SUM(compensated) AS compensated
            FROM rcmdb.seamless
            WHERE IFNULL(vn, '') <> ''
            GROUP BY vn
          ) sm ON sm.vn = o.vn
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
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
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
              v.age_y BETWEEN 50 AND 70
              OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) BETWEEN 50 AND 70
            )
            AND (tt.vn IS NOT NULL OR dd.vn IS NOT NULL)
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC;
        `

        const sqlParams: any[] = [
          adpCode, // dd TRIM(s_sub.nhso_adp_code) = ?
          ds1, ds2, // dd oo.vstdate BETWEEN ? AND ?
          ds1, ds2, // lo lh.order_date BETWEEN ? AND ?
          ds1, ds2, // nhso admdate
          ds1, ds2, // rep admdate
          ds1, ds2, // main ovst o.vstdate BETWEEN ? AND ?
        ]

        let rows: any[] = []
        let mappingRes: ColorectalCancerAdpMappingCheck = {
          adpCode,
          isMapped: false,
          mappedCount: 0,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              RcmColorectalCancerService.checkAdpMapping(executor, Boolean(params.refresh)),
              apiGateway.clinical.getRcmFundData('colorectal-cancer', { ds1, ds2, adpCode }),
            ])
            mappingRes = mRes
            // Only accept gateway data if it is from a dedicated route containing Special PP code fields,
            // avoiding incomplete generic fallback rows that lack code, pp_special_code, and labresult.
            const hasDedicatedData =
              gwRes &&
              (Boolean((gwRes as any).isDedicated) ||
                (gwRes.data &&
                  Array.isArray(gwRes.data.rawRows) &&
                  gwRes.data.rawRows.length > 0 &&
                  gwRes.data.rawRows[0] &&
                  ('code' in gwRes.data.rawRows[0] || 'pp_special_code' in gwRes.data.rawRows[0])))

            if (hasDedicatedData && gwRes.data && Array.isArray(gwRes.data.rawRows)) {
              rows = gwRes.data.rawRows
              fetchedViaNamedApi = true
            }
          } catch {
            // Fallback to executor query
          }
        }

        if (!fetchedViaNamedApi) {
          const [mRes, dbRows] = await Promise.all([
            RcmColorectalCancerService.checkAdpMapping(executor, Boolean(params.refresh)),
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

    // Normalize and map items
    const allItems: ColorectalCancerItem[] = (rawRows || []).map((r: any, idx: number) => {
      const compensated = Number(r.compensated) || 0
      const isCompensated = compensated > 0
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const maininscl = String(r.maininscl || '').trim()
      const pttypename = String(r.pttypename || '').trim()
      const pttype = r.pttype ? String(r.pttype).trim() : ''
      const pttypeEclaimId = r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : ''
      const isUc = isUniversalCoverageScheme(maininscl, pttypename, pttypeEclaimId)
      const age = Number(r.age) || 0
      const isTargetAge = age >= 50 && age <= 70
      const sex = formatThaiSex(r.sex_code, r.sex)

      const listname = r.listname ? String(r.listname).trim() : null
      const hasAdp = Boolean(listname && listname.length > 0)
      const code = r.code ? String(r.code).trim() : null
      const ppSpecialCode = r.pp_special_code ? String(r.pp_special_code).trim() : null
      const hasPpSpecial = Boolean((code && code.length > 0) || (ppSpecialCode && ppSpecialCode.length > 0))

      const dataQualityStatus = evaluateFitTestDataQuality(hasAdp, code, ppSpecialCode)

      const sdxList = [r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
        .map((d) => (d ? String(d).trim() : ''))
        .filter(Boolean)
      const sdx = sdxList.length > 0 ? sdxList.join(', ') : null

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
        sex,
        birthday: r.birthday ? String(r.birthday).trim() : null,
        age,
        isTargetAge,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode,
        maininscl,
        isUc,
        pttype,
        pttype_eclaim_id: pttypeEclaimId,
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
        sdx,
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        ops,
        income: Number(r.income) || 0,
        labresult: r.labresult ? String(r.labresult).trim() : null,
        code,
        pp_special_code: ppSpecialCode,
        listname,
        hasAdp,
        hasPpSpecial,
        dataQualityStatus,
        status_seamless: r.status_seamless ? String(r.status_seamless).trim() : null,
        rep_seamless: r.rep_seamless ? String(r.rep_seamless).trim() : null,
        compensated_seamless: Number(r.compensated_seamless) || 0,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated,
        agency: r.agency ? String(r.agency).trim() : null,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
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

    // Calculate Summary KPIs across eligible records
    const totalVisits = summaryCohort.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let totalIncome = 0
    let completeCount = 0
    let missingAdpCount = 0
    let missingPpCount = 0
    let invalidPpCodeCount = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let ucCount = 0

    for (const it of summaryCohort) {
      if (it.hn) uniqueHnSet.add(it.hn)
      if (it.isCompensated) {
        compensatedVisits++
        totalCompensated += it.compensated
      }
      totalIncome += it.income

      if (it.dataQualityStatus === 'COMPLETE') completeCount++
      else if (it.dataQualityStatus === 'MISSING_ADP') missingAdpCount++
      else if (it.dataQualityStatus === 'MISSING_PP') missingPpCount++
      else if (it.dataQualityStatus === 'INVALID_PP_CODE') invalidPpCodeCount++

      if (it.authencode) withAuthenCount++
      else withoutAuthenCount++

      if (it.isUc) ucCount++
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const averageCompensated = compensatedVisits > 0 ? totalCompensated / compensatedVisits : 0
    const completeRate = totalVisits > 0 ? (completeCount / totalVisits) * 100 : 0
    const missingAdpRate = totalVisits > 0 ? (missingAdpCount / totalVisits) * 100 : 0
    const missingPpRate = totalVisits > 0 ? (missingPpCount / totalVisits) * 100 : 0
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0
    const ucRate = totalVisits > 0 ? (ucCount / totalVisits) * 100 : 0

    const summary: ColorectalCancerSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      completeCount,
      completeRate,
      missingAdpCount,
      missingAdpRate,
      missingPpCount,
      missingPpRate,
      invalidPpCodeCount,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucCount,
      ucRate,
      totalIncome,
    }

    // Filter Items by cardFilter and ucOnly (Dual-Mode)
    let filtered = summaryCohort

    if (selectedPttypesList.length === 0 && ucOnly) {
      filtered = filtered.filter((it) => it.isUc)
    }

    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((it) => it.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((it) => !it.isCompensated)
    } else if (cardFilter === 'COMPLETE') {
      filtered = filtered.filter((it) => it.dataQualityStatus === 'COMPLETE')
    } else if (cardFilter === 'MISSING_ADP') {
      filtered = filtered.filter((it) => it.dataQualityStatus === 'MISSING_ADP')
    } else if (cardFilter === 'MISSING_PP') {
      filtered = filtered.filter((it) => it.dataQualityStatus === 'MISSING_PP')
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((it) => Boolean(it.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((it) => !it.authencode)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((it) => it.isUc)
    }

    // Search Filtering
    if (search) {
      filtered = filtered.filter((it) => {
        if (searchField === 'HN') return it.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return it.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return it.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return it.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return (
            (it.pdx && it.pdx.toLowerCase().includes(search)) ||
            (it.sdx && it.sdx.toLowerCase().includes(search))
          )
        }
        if (searchField === 'PTTYPE') return it.pttypename.toLowerCase().includes(search)
        if (searchField === 'CODE') {
          return (
            (it.code && it.code.toLowerCase().includes(search)) ||
            (it.pp_special_code && it.pp_special_code.toLowerCase().includes(search)) ||
            (it.listname && it.listname.toLowerCase().includes(search))
          )
        }
        if (searchField === 'LAB') {
          return it.labresult && it.labresult.toLowerCase().includes(search)
        }

        // Global search across all relevant fields
        return (
          matchesSeamlessRepSearch(it, search) ||
          it.hn.toLowerCase().includes(search) ||
          it.cid.toLowerCase().includes(search) ||
          it.ptname.toLowerCase().includes(search) ||
          it.vn.toLowerCase().includes(search) ||
          (it.pdx && it.pdx.toLowerCase().includes(search)) ||
          (it.sdx && it.sdx.toLowerCase().includes(search)) ||
          it.pttypename.toLowerCase().includes(search) ||
          (it.authencode && it.authencode.toLowerCase().includes(search)) ||
          (it.code && it.code.toLowerCase().includes(search)) ||
          (it.pp_special_code && it.pp_special_code.toLowerCase().includes(search)) ||
          (it.listname && it.listname.toLowerCase().includes(search)) ||
          (it.labresult && it.labresult.toLowerCase().includes(search)) ||
          (it.rep && it.rep.toLowerCase().includes(search)) ||
          (it.status && it.status.toLowerCase().includes(search))
        )
      })
    }

    // Sorting
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
      } else if (sortBy === 'labresult') {
        cmp = (a.labresult || '').localeCompare(b.labresult || '', 'th')
      } else if (sortBy === 'code') {
        cmp = (a.code || '').localeCompare(b.code || '', 'th')
      }

      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Re-index row numbers
    const totalCount = filtered.length
    const totalPages = exportAll ? 1 : Math.ceil(totalCount / pageSize) || 1
    const pagedItems = exportAll
      ? filtered.map((it, idx) => ({ ...it, no: idx + 1 }))
      : filtered
          .slice((page - 1) * pageSize, page * pageSize)
          .map((it, idx) => ({ ...it, no: (page - 1) * pageSize + idx + 1 }))

    return {
      adpCode: '90005',
      title: reportTitle,
      categoryTitle,
      ds1,
      ds2,
      adpMapping,
      cardFilter,
      ucOnly,
      pttypes,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: exportAll ? 1 : page,
      pageSize: exportAll ? totalCount : pageSize,
      totalPages,
      items: pagedItems,
    }
  }
}
