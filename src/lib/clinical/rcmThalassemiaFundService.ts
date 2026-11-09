import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
  type QueryExecutor,
} from './rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'

// ── Types: กองทุน Thalassemia (ผู้ป่วยนอก OPD & ผู้ป่วยใน IPD) ──────────────────────

export type ThalassemiaFundCardFilter =
  | 'ALL'
  | 'WITH_DRUG'
  | 'WITH_BLOOD'
  | 'WITH_FERRITIN'
  | 'WITH_HB_HCT'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'UC_ONLY'

export type ThalassemiaFundSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'AN'
  | 'ICD10'
  | 'ICD9'
  | 'DRUG'
  | 'BLOOD'
  | 'PTTYPE'

export type ThalassemiaOpdSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'icd10'
  | 'bloodQty'
  | 'compensated'

export type ThalassemiaIpdSortField =
  | 'dchdate'
  | 'admdate'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'icd10'
  | 'bloodQty'
  | 'compensated'

export interface ThalassemiaFundReportParams extends FiscalDateRangeParams {
  cardFilter?: ThalassemiaFundCardFilter
  pttypes?: string
  ucOnly?: boolean
  searchField?: ThalassemiaFundSearchField
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface ThalassemiaOpdItem {
  no: number
  vn: string
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  vstdate: string
  vsttime: string
  pttypename: string
  pttype_eclaim_id?: string | null
  department: string | null
  clinic: string | null
  icd10: string | null
  icd9: string | null
  drugname: string | null
  hasDrug: boolean
  blood: string | null
  bloodDate: string | null
  bloodQty: number
  hasBlood: boolean
  ferritinResult: string | null
  ferritinDate: string | null
  hbResult: string | null
  hbDate: string | null
  hctResult: string | null
  hctDate: string | null
  authencode: string | null
  seamless: string | null
  rep: string | null
  status: string | null
  compensated: number
  isCompensated: boolean
  isUc: boolean
}

export interface ThalassemiaIpdItem {
  no: number
  an: string
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  admdate: string
  dchdate: string
  pttypename: string
  pttype_eclaim_id?: string | null
  ward: string | null
  icd10: string | null
  icd9: string | null
  drugname: string | null
  hasDrug: boolean
  blood: string | null
  bloodDate: string | null
  bloodQty: number
  hasBlood: boolean
  ferritinResult: string | null
  ferritinDate: string | null
  hbResult: string | null
  hbDate: string | null
  hctResult: string | null
  hctDate: string | null
  seamless: string | null
  rep: string | null
  status: string | null
  compensated: number
  isCompensated: boolean
  isUc: boolean
}

export interface ThalassemiaFundSummary {
  totalCases: number
  uniquePatients: number
  drugCases: number
  drugRate: number
  bloodCases: number
  bloodRate: number
  totalBloodUnits: number
  ferritinCases: number
  ferritinRate: number
  hbHctCases: number
  hbHctRate: number
  compensatedCases: number
  uncompensatedCases: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  ucCases: number
  ucRate: number
}

export interface ThalassemiaOpdReportResult {
  ds1: string
  ds2: string
  cardFilter: ThalassemiaFundCardFilter
  search: string
  sortBy: ThalassemiaOpdSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: ThalassemiaFundSummary
  items: ThalassemiaOpdItem[]
}

export interface ThalassemiaIpdReportResult {
  ds1: string
  ds2: string
  cardFilter: ThalassemiaFundCardFilter
  search: string
  sortBy: ThalassemiaIpdSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: ThalassemiaFundSummary
  items: ThalassemiaIpdItem[]
}

export interface AnClinicalDetails {
  header: {
    an: string
    hn: string
    cid: string
    ptname: string
    sex: string
    age: number
    admdate: string
    dchdate: string
    pttypename: string
    ward: string
  }
  diagnoses: {
    icd10: string
    icdName: string
    diagtype: string
    diagtypeName: string
    doctorName: string
  }[]
  procedures: {
    icd9: string
    icd9Name: string
    opdate: string
    doctorName: string
  }[]
  orders: {
    icode: string
    itemName: string
    strength: string | null
    units: string | null
    qty: number
    unitprice: number
    sumPrice: number
    paidstName: string
    incomeName: string
    isDrug: boolean
  }[]
}

// ── Service Implementation ────────────────────────────────────────────────────────

export class RcmThalassemiaFundService {
  /**
   * 1. รายงานผู้ป่วยนอก Thalassemia (OPD)
   * - ผู้ป่วยโรคโลหิตจางธาลัสซีเมีย (ICD10 D56, D582)
   * - ได้รับยาขับเหล็ก (Deferasirox, Deferipron, Desferrioxamin) หรือ ได้รับการให้เลือด (ADP 232xxxx)
   * - ผลตรวจ Lab: Ferritin, Hb, Hct
   */
  static async getOpdReport(
    params: ThalassemiaFundReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<ThalassemiaOpdReportResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: ThalassemiaFundCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy = (params.sortBy as ThalassemiaOpdSortField) || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-thalassemia-fund-opd-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () => {

        const sql = `
          SELECT 
            t.vn,
            t.hn,
            t.cid,
            t.ptname,
            t.sex_code,
            t.birthday,
            t.age,
            t.vstdate,
            t.vsttime,
            t.maininscl,
            t.pttype_eclaim_id,
            t.pttypename,
            t.department,
            t.clinic,
            t.icd10,
            t.icd9,
            t.drugname,
            b.blood,
            b.blood_date,
            IFNULL(b.qty, 0) AS blood_qty,
            l.Ferritin_Result AS ferritin_result,
            l.Ferritin_date AS ferritin_date,
            l.Hb_Result AS hb_result,
            l.Hb_Date AS hb_date,
            l.Hct_Result AS hct_result,
            l.Hct_Date AS hct_date,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            GROUP_CONCAT(DISTINCT r.rep SEPARATOR ', ') AS seamless,
            GROUP_CONCAT(DISTINCT re.rep SEPARATOR ', ') AS rep,
            MAX(IF(re.rep IS NOT NULL AND re.rep <> '', 'มี Rep แล้ว', IF(r.rep IS NOT NULL AND r.rep <> '', 'มี Seamless', 'รอส่งเบิก'))) AS status,
            SUM(DISTINCT IFNULL(re.compensated, 0)) AS compensated
          FROM (
            SELECT 
              o.vn,
              o.hn,
              IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
              IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              IFNULL(ptt.hipdata_code, '') AS maininscl,
              IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
              IFNULL(ptt.name, o.pttype) AS pttypename,
              IFNULL(dep.department, o.main_dep) AS department,
              IFNULL(spc.name, o.spclty) AS clinic,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'D56|D582', dx.icd10, NULL) ORDER BY dx.diagtype SEPARATOR ', ') AS icd10,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS icd9,
              GROUP_CONCAT(DISTINCT IF(d.name REGEXP 'Deferasirox|Deferipron|Desferrioxamin', CONCAT(d.name, ' ', IFNULL(d.strength, ''), ' #', oo.qty), NULL) SEPARATOR ', ') AS drugname
            FROM ovst o
            JOIN patient pt ON pt.hn = o.hn
            JOIN ovstdiag dx ON dx.vn = o.vn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN opitemrece oo ON oo.vn = o.vn
            LEFT JOIN drugitems d ON d.icode = oo.icode
            WHERE o.vstdate BETWEEN ? AND ?
              AND dx.icd10 REGEXP 'D56|D582'
            GROUP BY o.vn
          ) t
          LEFT JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS blood,
              GROUP_CONCAT(DISTINCT DATE_FORMAT(oo.rxdate, '%Y-%m-%d') SEPARATOR ', ') AS blood_date,
              SUM(oo.qty) AS qty
            FROM opitemrece oo
            JOIN nondrugitems d ON d.icode = oo.icode
            WHERE d.nhso_adp_code LIKE '232%'
              AND oo.vstdate BETWEEN ? AND ?
            GROUP BY oo.vn
          ) b ON b.vn = t.vn
          LEFT JOIN (
            SELECT 
              lh.vn,
              GROUP_CONCAT(DISTINCT IF(l.lab_items_name REGEXP 'ferritin', lo.lab_order_result, NULL) SEPARATOR ', ') AS Ferritin_Result,
              GROUP_CONCAT(DISTINCT IF(l.lab_items_name REGEXP 'ferritin', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Ferritin_date,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621401', lo.lab_order_result, NULL) SEPARATOR ', ') AS Hb_Result,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621401', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Hb_Date,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621201', lo.lab_order_result, NULL) SEPARATOR ', ') AS Hct_Result,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621201', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Hct_Date
            FROM lab_head lh
            JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
            JOIN lab_items l ON l.lab_items_code = lo.lab_items_code
            WHERE (l.provis_labcode IN ('0621401', '0621201') OR l.lab_items_name REGEXP 'ferritin')
              AND lh.order_date BETWEEN ? AND ?
            GROUP BY lh.vn
          ) l ON l.vn = t.vn
          LEFT JOIN rcmdb.authencode cc ON cc.vn = t.vn
          LEFT JOIN visit_pttype vt ON vt.vn = t.vn
          LEFT JOIN rcmdb.seamless r ON r.vn = t.vn
          LEFT JOIN rcmdb.repdata re ON re.vn = t.vn
          WHERE (t.drugname IS NOT NULL OR b.vn IS NOT NULL)
          GROUP BY t.vn
          ORDER BY t.vstdate DESC, t.vsttime DESC;
        `
        const rows = (await executor(
          sql,
          [ds1, ds2, ds1, ds2, ds1, ds2],
          { timeoutMs: 90000 }
        )) as any[]
        return rows || []
      },
      600000 // Cache TTL 10 minutes
    )

    // Map rows into domain objects
    const allItems: ThalassemiaOpdItem[] = rawRows.map((r, idx) => {
      const hasDrug = Boolean(r.drugname && String(r.drugname).trim().length > 0)
      const hasBlood = Boolean(r.blood && String(r.blood).trim().length > 0)
      const compensated = Number(r.compensated || 0)
      const rep = r.rep ? String(r.rep).trim() : null
      const isCompensated = compensated > 0 || Boolean(rep && rep.length > 0)
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc =
        (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) ||
        String(r.maininscl || '').trim() === 'UCS' ||
        String(r.pttypename || '').includes('บัตรทอง') ||
        String(r.pttypename || '').includes('ประกันสุขภาพ')

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        hn: String(r.hn || ''),
        cid: String(r.cid || ''),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code),
        birthday: r.birthday ? String(r.birthday) : null,
        age: Number(r.age || 0),
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        pttypename: String(r.pttypename || ''),
        pttype_eclaim_id: pttypeEclaimId,
        department: r.department ? String(r.department) : null,
        clinic: r.clinic ? String(r.clinic) : null,
        icd10: r.icd10 ? String(r.icd10) : null,
        icd9: r.icd9 ? String(r.icd9) : null,
        drugname: r.drugname ? String(r.drugname) : null,
        hasDrug,
        blood: r.blood ? String(r.blood) : null,
        bloodDate: r.blood_date ? String(r.blood_date) : null,
        bloodQty: Number(r.blood_qty || 0),
        hasBlood,
        ferritinResult: r.ferritin_result ? String(r.ferritin_result) : null,
        ferritinDate: r.ferritin_date ? String(r.ferritin_date) : null,
        hbResult: r.hb_result ? String(r.hb_result) : null,
        hbDate: r.hb_date ? String(r.hb_date) : null,
        hctResult: r.hct_result ? String(r.hct_result) : null,
        hctDate: r.hct_date ? String(r.hct_date) : null,
        authencode: r.authencode ? String(r.authencode).trim() : null,
        seamless: r.seamless ? String(r.seamless).trim() : null,
        rep,
        status: r.status ? String(r.status).trim() : null,
        compensated,
        isCompensated,
        isUc,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Summary across summaryCohort
    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    const drugCases = summaryCohort.filter((i) => i.hasDrug).length
    const bloodCases = summaryCohort.filter((i) => i.hasBlood).length
    const totalBloodUnits = summaryCohort.reduce((acc, cur) => acc + cur.bloodQty, 0)
    const ferritinCases = summaryCohort.filter((i) => Boolean(i.ferritinResult)).length
    const hbHctCases = summaryCohort.filter((i) => Boolean(i.hbResult || i.hctResult)).length
    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const totalCompensated = summaryCohort.reduce((acc, cur) => acc + cur.compensated, 0)
    const averageCompensated = compensatedCases > 0 ? totalCompensated / compensatedCases : 0
    const ucCases = summaryCohort.filter((i) => i.isUc).length

    const summary: ThalassemiaFundSummary = {
      totalCases,
      uniquePatients,
      drugCases,
      drugRate: totalCases > 0 ? (drugCases / totalCases) * 100 : 0,
      bloodCases,
      bloodRate: totalCases > 0 ? (bloodCases / totalCases) * 100 : 0,
      totalBloodUnits,
      ferritinCases,
      ferritinRate: totalCases > 0 ? (ferritinCases / totalCases) * 100 : 0,
      hbHctCases,
      hbHctRate: totalCases > 0 ? (hbHctCases / totalCases) * 100 : 0,
      compensatedCases,
      uncompensatedCases,
      compensationRate: totalCases > 0 ? (compensatedCases / totalCases) * 100 : 0,
      totalCompensated,
      averageCompensated,
      ucCases,
      ucRate: totalCases > 0 ? (ucCases / totalCases) * 100 : 0,
    }

    // Apply Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'WITH_DRUG') {
      filtered = filtered.filter((i) => i.hasDrug)
    } else if (cardFilter === 'WITH_BLOOD') {
      filtered = filtered.filter((i) => i.hasBlood)
    } else if (cardFilter === 'WITH_FERRITIN') {
      filtered = filtered.filter((i) => Boolean(i.ferritinResult))
    } else if (cardFilter === 'WITH_HB_HCT') {
      filtered = filtered.filter((i) => Boolean(i.hbResult || i.hctResult))
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    // Apply Unified Search
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.icd10 && i.icd10.toLowerCase().includes(search)) ||
          (i.icd9 && i.icd9.toLowerCase().includes(search)) ||
          (i.drugname && i.drugname.toLowerCase().includes(search)) ||
          (i.blood && i.blood.toLowerCase().includes(search)) ||
          i.pttypename.toLowerCase().includes(search)
        )
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'vstdate') {
        cmp = a.vstdate.localeCompare(b.vstdate)
      } else if (sortBy === 'vsttime') {
        cmp = a.vsttime.localeCompare(b.vsttime)
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname)
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'bloodQty') {
        cmp = a.bloodQty - b.bloodQty
      } else if (sortBy === 'compensated') {
        cmp = a.compensated - b.compensated
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Pagination
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const pagedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    // Re-index displayed records
    pagedItems.forEach((it, idx) => {
      it.no = exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1
    })

    return {
      ds1,
      ds2,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      summary,
      items: pagedItems,
    }
  }

  /**
   * 2. รายงานผู้ป่วยใน Thalassemia (IPD)
   * - ผู้ป่วยในโรคโลหิตจางธาลัสซีเมีย (ICD10 D56, D582)
   * - ได้รับการให้เลือด (ICD-9 9904 หรือ ADP 232xxxx) หรือ ได้รับยาขับเหล็ก
   * - ผลตรวจ Lab: Ferritin, Hb, Hct
   */
  static async getIpdReport(
    params: ThalassemiaFundReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<ThalassemiaIpdReportResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: ThalassemiaFundCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy = (params.sortBy as ThalassemiaIpdSortField) || 'dchdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-thalassemia-fund-ipd-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () => {

        const sql = `
          SELECT 
            t.an,
            t.hn,
            t.cid,
            t.ptname,
            t.sex_code,
            t.birthday,
            t.age,
            t.admdate,
            t.dchdate,
            t.maininscl,
            t.pttype_eclaim_id,
            t.pttypename,
            t.ward,
            t.icd10,
            t.icd9,
            t.drugname,
            b.blood,
            b.blood_date,
            IFNULL(b.qty, 0) AS blood_qty,
            l.Ferritin_Result AS ferritin_result,
            l.Ferritin_date AS ferritin_date,
            l.Hb_Result AS hb_result,
            l.Hb_Date AS hb_date,
            l.Hct_Result AS hct_result,
            l.Hct_Date AS hct_date,
            GROUP_CONCAT(DISTINCT r.rep SEPARATOR ', ') AS seamless,
            GROUP_CONCAT(DISTINCT re.rep SEPARATOR ', ') AS rep,
            MAX(IF(re.rep IS NOT NULL AND re.rep <> '', 'มี Rep แล้ว', IF(r.rep IS NOT NULL AND r.rep <> '', 'มี Seamless', 'รอส่งเบิก'))) AS status,
            SUM(DISTINCT IFNULL(re.compensated, 0)) AS compensated
          FROM (
            SELECT 
              i.an,
              i.hn,
              IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
              IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.dchdate), 0) AS age,
              DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
              DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
              IFNULL(ptt.hipdata_code, '') AS maininscl,
              IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
              IFNULL(ptt.name, i.pttype) AS pttypename,
              IFNULL(w.name, i.ward) AS ward,
              GROUP_CONCAT(DISTINCT dx.icd10 ORDER BY dx.diagtype SEPARATOR ', ') AS icd10,
              GROUP_CONCAT(DISTINCT op.icd9 SEPARATOR ', ') AS icd9,
              GROUP_CONCAT(DISTINCT IF(d.name REGEXP 'Deferasirox|Deferipron|Desferrioxamin', CONCAT(d.name, ' ', IFNULL(d.strength, ''), ' #', oo.qty), NULL) SEPARATOR ', ') AS drugname
            FROM ipt i
            JOIN patient pt ON pt.hn = i.hn
            JOIN iptdiag dx ON dx.an = i.an
            LEFT JOIN iptoprt op ON op.an = i.an
            LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
            LEFT JOIN ward w ON w.ward = i.ward
            LEFT JOIN opitemrece oo ON oo.an = i.an
            LEFT JOIN drugitems d ON d.icode = oo.icode
            WHERE i.dchdate BETWEEN ? AND ?
              AND dx.icd10 REGEXP 'D56|D582'
            GROUP BY i.an
          ) t
          LEFT JOIN (
            SELECT 
              oo.an,
              GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS blood,
              GROUP_CONCAT(DISTINCT DATE_FORMAT(oo.rxdate, '%Y-%m-%d') SEPARATOR ', ') AS blood_date,
              SUM(oo.qty) AS qty
            FROM opitemrece oo
            JOIN nondrugitems d ON d.icode = oo.icode
            WHERE d.nhso_adp_code LIKE '232%'
              AND oo.an IS NOT NULL
            GROUP BY oo.an
          ) b ON b.an = t.an
          LEFT JOIN (
            SELECT 
              lh.vn AS an,
              GROUP_CONCAT(DISTINCT IF(l.lab_items_name REGEXP 'ferritin', lo.lab_order_result, NULL) SEPARATOR ', ') AS Ferritin_Result,
              GROUP_CONCAT(DISTINCT IF(l.lab_items_name REGEXP 'ferritin', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Ferritin_date,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621401', lo.lab_order_result, NULL) SEPARATOR ', ') AS Hb_Result,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621401', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Hb_Date,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621201', lo.lab_order_result, NULL) SEPARATOR ', ') AS Hct_Result,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621201', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Hct_Date
            FROM lab_head lh
            JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
            JOIN lab_items l ON l.lab_items_code = lo.lab_items_code
            WHERE (l.provis_labcode IN ('0621401', '0621201') OR l.lab_items_name REGEXP 'ferritin')
            GROUP BY lh.vn
          ) l ON l.an = t.an
          LEFT JOIN rcmdb.seamless r ON r.an = t.an
          LEFT JOIN rcmdb.repdata re ON re.an = t.an
          WHERE (t.icd9 REGEXP '9904' OR t.drugname IS NOT NULL OR b.an IS NOT NULL)
          GROUP BY t.an
          ORDER BY t.dchdate DESC, t.admdate DESC;
        `
        const rows = (await executor(
          sql,
          [ds1, ds2],
          { timeoutMs: 90000 }
        )) as any[]
        return rows || []
      },
      600000 // Cache TTL 10 minutes
    )

    // Map rows into domain objects
    const allItems: ThalassemiaIpdItem[] = rawRows.map((r, idx) => {
      const hasDrug = Boolean(r.drugname && String(r.drugname).trim().length > 0)
      const hasBlood =
        Boolean(r.blood && String(r.blood).trim().length > 0) ||
        Boolean(r.icd9 && String(r.icd9).includes('9904'))
      const compensated = Number(r.compensated || 0)
      const rep = r.rep ? String(r.rep).trim() : null
      const isCompensated = compensated > 0 || Boolean(rep && rep.length > 0)
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc =
        (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) ||
        String(r.maininscl || '').trim() === 'UCS' ||
        String(r.pttypename || '').includes('บัตรทอง') ||
        String(r.pttypename || '').includes('ประกันสุขภาพ')

      return {
        no: idx + 1,
        an: String(r.an || ''),
        hn: String(r.hn || ''),
        cid: String(r.cid || ''),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code),
        birthday: r.birthday ? String(r.birthday) : null,
        age: Number(r.age || 0),
        admdate: String(r.admdate || ''),
        dchdate: String(r.dchdate || ''),
        pttypename: String(r.pttypename || ''),
        pttype_eclaim_id: pttypeEclaimId,
        ward: r.ward ? String(r.ward) : null,
        icd10: r.icd10 ? String(r.icd10) : null,
        icd9: r.icd9 ? String(r.icd9) : null,
        drugname: r.drugname ? String(r.drugname) : null,
        hasDrug,
        blood: r.blood ? String(r.blood) : null,
        bloodDate: r.blood_date ? String(r.blood_date) : null,
        bloodQty: Number(r.blood_qty || 0),
        hasBlood,
        ferritinResult: r.ferritin_result ? String(r.ferritin_result) : null,
        ferritinDate: r.ferritin_date ? String(r.ferritin_date) : null,
        hbResult: r.hb_result ? String(r.hb_result) : null,
        hbDate: r.hb_date ? String(r.hb_date) : null,
        hctResult: r.hct_result ? String(r.hct_result) : null,
        hctDate: r.hct_date ? String(r.hct_date) : null,
        seamless: r.seamless ? String(r.seamless).trim() : null,
        rep,
        status: r.status ? String(r.status).trim() : null,
        compensated,
        isCompensated,
        isUc,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Summary across summaryCohort
    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    const drugCases = summaryCohort.filter((i) => i.hasDrug).length
    const bloodCases = summaryCohort.filter((i) => i.hasBlood).length
    const totalBloodUnits = summaryCohort.reduce((acc, cur) => acc + cur.bloodQty, 0)
    const ferritinCases = summaryCohort.filter((i) => Boolean(i.ferritinResult)).length
    const hbHctCases = summaryCohort.filter((i) => Boolean(i.hbResult || i.hctResult)).length
    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const totalCompensated = summaryCohort.reduce((acc, cur) => acc + cur.compensated, 0)
    const averageCompensated = compensatedCases > 0 ? totalCompensated / compensatedCases : 0
    const ucCases = summaryCohort.filter((i) => i.isUc).length

    const summary: ThalassemiaFundSummary = {
      totalCases,
      uniquePatients,
      drugCases,
      drugRate: totalCases > 0 ? (drugCases / totalCases) * 100 : 0,
      bloodCases,
      bloodRate: totalCases > 0 ? (bloodCases / totalCases) * 100 : 0,
      totalBloodUnits,
      ferritinCases,
      ferritinRate: totalCases > 0 ? (ferritinCases / totalCases) * 100 : 0,
      hbHctCases,
      hbHctRate: totalCases > 0 ? (hbHctCases / totalCases) * 100 : 0,
      compensatedCases,
      uncompensatedCases,
      compensationRate: totalCases > 0 ? (compensatedCases / totalCases) * 100 : 0,
      totalCompensated,
      averageCompensated,
      ucCases,
      ucRate: totalCases > 0 ? (ucCases / totalCases) * 100 : 0,
    }

    // Apply Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'WITH_DRUG') {
      filtered = filtered.filter((i) => i.hasDrug)
    } else if (cardFilter === 'WITH_BLOOD') {
      filtered = filtered.filter((i) => i.hasBlood)
    } else if (cardFilter === 'WITH_FERRITIN') {
      filtered = filtered.filter((i) => Boolean(i.ferritinResult))
    } else if (cardFilter === 'WITH_HB_HCT') {
      filtered = filtered.filter((i) => Boolean(i.hbResult || i.hctResult))
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    // Apply Unified Search
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.an.toLowerCase().includes(search) ||
          (i.icd10 && i.icd10.toLowerCase().includes(search)) ||
          (i.icd9 && i.icd9.toLowerCase().includes(search)) ||
          (i.drugname && i.drugname.toLowerCase().includes(search)) ||
          (i.blood && i.blood.toLowerCase().includes(search)) ||
          i.pttypename.toLowerCase().includes(search)
        )
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'dchdate') {
        cmp = a.dchdate.localeCompare(b.dchdate)
      } else if (sortBy === 'admdate') {
        cmp = a.admdate.localeCompare(b.admdate)
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname)
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'bloodQty') {
        cmp = a.bloodQty - b.bloodQty
      } else if (sortBy === 'compensated') {
        cmp = a.compensated - b.compensated
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Pagination
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const pagedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    // Re-index displayed records
    pagedItems.forEach((it, idx) => {
      it.no = exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1
    })

    return {
      ds1,
      ds2,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      summary,
      items: pagedItems,
    }
  }

  /**
   * 3. รายละเอียดเวชระเบียนผู้ป่วยในระดับ Admission (AN Clinical Details)
   * สำหรับแสดงผลใน Modal รายละเอียดเมื่อคลิกที่ record ในตาราง IPD
   */
  static async getAnClinicalDetails(
    an: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<AnClinicalDetails | null> {
    const cleanAn = (an || '').trim()
    if (!cleanAn) return null

    const headerSql = `
      SELECT 
        i.an, i.hn, IFNULL(pt.cid, '') AS cid,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        CASE WHEN pt.sex = '1' THEN 'ชาย' WHEN pt.sex = '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
        IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.dchdate), 0) AS age,
        DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
        DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
        IFNULL(p.name, IFNULL(i.pttype, '')) AS pttypename,
        IFNULL(w.name, IFNULL(i.ward, '')) AS ward
      FROM ipt i
      LEFT JOIN patient pt ON pt.hn = i.hn
      LEFT JOIN pttype p ON p.pttype = i.pttype
      LEFT JOIN ward w ON w.ward = i.ward
      WHERE i.an = ?
      LIMIT 1;
    `

    const diagSql = `
      SELECT 
        d.icd10,
        IFNULL(ic.name, d.icd10) AS icd_name,
        IFNULL(d.diagtype, '') AS diagtype,
        IFNULL(dt.name, CASE d.diagtype 
          WHEN '1' THEN 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)' 
          WHEN '2' THEN 'CO-MORBIDITY (การวินิจฉัยโรคร่วม)' 
          WHEN '3' THEN 'COMPLICATION (ภาวะแทรกซ้อน)' 
          WHEN '4' THEN 'OTHER (การวินิจฉัยอื่นๆ)' 
          WHEN '5' THEN 'EXTERNAL CAUSE (สาเหตุภายนอก)' 
          ELSE 'ไม่ระบุประเภท' END) AS diagtype_name,
        IFNULL(doc.name, '') AS doctor_name
      FROM iptdiag d
      LEFT JOIN icd101 ic ON ic.code = d.icd10
      LEFT JOIN diagtype dt ON dt.diagtype = d.diagtype
      LEFT JOIN doctor doc ON doc.code = d.doctor
      WHERE d.an = ?
      ORDER BY d.diagtype ASC, d.ipt_diag_id ASC;
    `

    const oprtSql = `
      SELECT 
        op.icd9,
        IFNULL(ic9.name, op.icd9) AS icd9_name,
        DATE_FORMAT(op.opdate, '%Y-%m-%d') AS opdate,
        IFNULL(doc.name, '') AS doctor_name
      FROM iptoprt op
      LEFT JOIN icd9cm1 ic9 ON ic9.code = op.icd9
      LEFT JOIN doctor doc ON doc.code = op.doctor
      WHERE op.an = ?
      ORDER BY op.opdate ASC;
    `

    const orderSql = `
      SELECT 
        o.icode,
        COALESCE(d.name, nd.name, o.icode) AS item_name,
        d.strength,
        d.units,
        IFNULL(o.qty, 0) AS qty,
        IFNULL(o.unitprice, 0) AS unitprice,
        IFNULL(o.sum_price, 0) AS sum_price,
        IFNULL(pst.name, o.paidst) AS paidst_name,
        IFNULL(inc.name, o.income) AS income_name,
        IF(d.icode IS NOT NULL, 1, 0) AS is_drug
      FROM opitemrece o
      LEFT JOIN s_drugitems d ON d.icode = o.icode
      LEFT JOIN nondrugitems nd ON nd.icode = o.icode
      LEFT JOIN paidst pst ON pst.paidst = o.paidst
      LEFT JOIN income inc ON inc.income = o.income
      WHERE o.an = ?
      ORDER BY o.income ASC, o.item_no ASC, o.icode ASC;
    `

    const [headerRows, diagRows, oprtRows, orderRows] = await Promise.all([
      executor(headerSql, [cleanAn]),
      executor(diagSql, [cleanAn]),
      executor(oprtSql, [cleanAn]),
      executor(orderSql, [cleanAn]),
    ])

    if (!headerRows || headerRows.length === 0) {
      return null
    }

    const h = headerRows[0]
    return {
      header: {
        an: String(h.an || cleanAn),
        hn: String(h.hn || ''),
        cid: String(h.cid || ''),
        ptname: String(h.ptname || '').trim(),
        sex: String(h.sex || '-'),
        age: Number(h.age || 0),
        admdate: String(h.admdate || ''),
        dchdate: String(h.dchdate || ''),
        pttypename: String(h.pttypename || ''),
        ward: String(h.ward || ''),
      },
      diagnoses: (diagRows || []).map((d: any) => ({
        icd10: String(d.icd10 || ''),
        icdName: String(d.icd_name || d.icd10 || ''),
        diagtype: String(d.diagtype || ''),
        diagtypeName: String(d.diagtype_name || ''),
        doctorName: String(d.doctor_name || ''),
      })),
      procedures: (oprtRows || []).map((op: any) => ({
        icd9: String(op.icd9 || ''),
        icd9Name: String(op.icd9_name || op.icd9 || ''),
        opdate: String(op.opdate || ''),
        doctorName: String(op.doctor_name || ''),
      })),
      orders: (orderRows || []).map((o: any) => ({
        icode: String(o.icode || ''),
        itemName: String(o.item_name || o.icode || ''),
        strength: o.strength ? String(o.strength) : null,
        units: o.units ? String(o.units) : null,
        qty: Number(o.qty || 0),
        unitprice: Number(o.unitprice || 0),
        sumPrice: Number(o.sum_price || 0),
        paidstName: String(o.paidst_name || ''),
        incomeName: String(o.income_name || ''),
        isDrug: Boolean(o.is_drug === 1),
      })),
    }
  }
}
