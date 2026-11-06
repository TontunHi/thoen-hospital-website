import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type FiscalDateRangeParams, type QueryExecutor } from './rcmDashboardService'

// ── 1. Domain Types: 2.4 บริการฝากครรภ์ (ANC 30011) ──────────────────────

export type AncCompensationFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'HAS_AUTHEN'
  | 'NO_AUTHEN'

export type AncSearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN' | 'DIAG' | 'PTTYPE'

export type AncSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface AncService30011Params extends FiscalDateRangeParams {
  compensationFilter?: AncCompensationFilter
  searchField?: AncSearchField
  search?: string
  sortBy?: AncSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface AncAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface AncAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: AncAdpMappingItem[]
}

export interface AncService30011Item {
  no: number
  vn: string
  cid: string
  hn: string
  ptname: string
  age: number | null
  nation: string | null
  vstdate: string
  vsttime: string
  authencode: string | null
  pttypename: string | null
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
  operation: string | null
  listname: string | null
  listname1: string | null
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
}

export interface AncService30011Summary {
  totalVisits: number
  uniquePatients: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  withAuthenCount: number
  withoutAuthenCount: number
  withPdxCount: number
  withOpCount: number
}

export interface AncService30011Result {
  ds1: string
  ds2: string
  adpMapping: AncAdpMappingCheck
  compensationFilter: AncCompensationFilter
  searchField: AncSearchField
  search: string
  sortBy: AncSortField
  sortOrder: 'asc' | 'desc'
  summary: AncService30011Summary
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: AncService30011Item[]
}

// ── 2. Service Implementation ──────────────────────────────────────────

export class RcmAncService {
  /**
   * Checks whether NHSO ADP code 30011 is mapped in HOSxP `s_drugitems` table.
   * Mirrors FoxPro check:
   * select count(*) from s_drugitems where nhso_adp_code in ('30011')
   */
  static async check30011AdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<AncAdpMappingCheck> {
    try {
      const rows = await executor(
        `
        SELECT icode, name, strength, nhso_adp_code
        FROM s_drugitems
        WHERE TRIM(nhso_adp_code) IN ('30011')
        ORDER BY icode ASC
        `
      )

      const items: AncAdpMappingItem[] = (rows || []).map((r: any) => ({
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
  }

  /**
   * Retrieves ANC Service 30011 report based on HOSxP visits, ADP code 30011 dispensing,
   * non-drug items (listname1), and reimbursement status (NHSO / Rep / NewEclaim / EClaim).
   */
  static async getService30011Report(
    params: AncService30011Params = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<AncService30011Result> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const compensationFilter: AncCompensationFilter = params.compensationFilter || 'ALL'
    const searchField: AncSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: AncSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-anc-2-4-30011-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          RcmAncService.check30011AdpMapping(executor),
          executor(
            `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              cc.AuthenCode AS authencode,
              ptt.name AS pttypename,
              dep.department,
              spc.name AS clinic,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              dd.name AS listname,
              (SELECT GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ')
               FROM opitemrece a
               JOIN nondrugitems b ON b.icode = a.icode
               WHERE a.vn = o.vn) AS listname1,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
              re.fund,
              re.subfund
            FROM ovst o
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            JOIN (
              SELECT 
                oo.vn, 
                GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate BETWEEN ? AND ?
                AND TRIM(d.nhso_adp_code) IN ('30011')
              GROUP BY oo.vn
            ) dd ON dd.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) rep ON rep.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                     GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
              GROUP BY vn
            ) re ON re.vn = o.vn
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
            WHERE o.vstdate BETWEEN ? AND ?
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC
            `,
            [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
            { timeoutMs: 90000 }
          ),
        ])

        return { rawRows: rows as Record<string, unknown>[], adpMapping: mappingRes }
      },
      600
    )

    const allItems: AncService30011Item[] = rawRows.map((r, idx) => {
      const compensated = Number(r.compensated || 0)
      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        age: r.age != null ? Number(r.age) : null,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        pttypename: r.pttypename ? String(r.pttypename).trim() : null,
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
        operation: null,
        listname: r.listname ? String(r.listname).trim() : null,
        listname1: r.listname1 ? String(r.listname1).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: compensated > 0,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
      }
    })

    // Calculate Summary Metrics on all visits before filtering
    const totalVisits = allItems.length
    const uniqueHns = new Set(allItems.map((i) => i.hn).filter(Boolean))
    const uniquePatients = uniqueHns.size

    let compensatedVisits = 0
    let uncompensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let withPdxCount = 0
    let withOpCount = 0

    for (const item of allItems) {
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      } else {
        uncompensatedVisits++
      }

      if (item.authencode) withAuthenCount++
      else withoutAuthenCount++

      if (item.pdx) withPdxCount++
      if (item.op0 || item.op1 || item.op2 || item.op3 || item.op4 || item.op5) {
        withOpCount++
      }
    }

    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0

    const summary: AncService30011Summary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated: Number(totalCompensated.toFixed(2)),
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      withPdxCount,
      withOpCount,
    }

    // Apply Filter & Search
    let filtered = allItems

    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (compensationFilter === 'HAS_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (compensationFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'PTTYPE') return (i.pttypename || '').toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          const dxStr = [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return dxStr.includes(search)
        }
        // ALL
        const fullStr = [
          i.hn,
          i.cid,
          i.ptname,
          i.vn,
          i.pdx,
          i.dx0,
          i.dx1,
          i.op0,
          i.pttypename,
          i.department,
          i.status,
          i.rep,
          i.authencode,
          i.listname,
          i.listname1,
          i.fund,
          i.subfund,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return fullStr.includes(search)
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (valA == null && valB == null) return 0
      if (valA == null) return sortOrder === 'asc' ? -1 : 1
      if (valB == null) return sortOrder === 'asc' ? 1 : -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      valA = String(valA).toLowerCase()
      valB = String(valB).toLowerCase()
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let items: AncService30011Item[]
    if (exportAll) {
      items = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      items = filtered.slice(startIndex, startIndex + pageSize).map((item, idx) => ({
        ...item,
        no: startIndex + idx + 1,
      }))
    }

    return {
      ds1,
      ds2,
      adpMapping,
      compensationFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items,
    }
  }

  // ── 3. Section 2.3: หญิงตั้งครรภ์ US - ตรวจช่องปาก - ขัดฟัน ───────────────────

  /**
   * 2.3 หญิงตั้งครรภ์ ได้รับบริการตรวจ Ultrasound - ตรวจช่องปาก - ขัดทำความสะอาดฟัน
   * Reconciles pregnancy care records across 5 streams:
   * 1. Dental Care visits (dental_care_type_id = 1)
   * 2. Ultrasound diagnoses (ovstdiag icd10 REGEXP '887[6-9]' for females in person_anc)
   * 3. Ultrasound service items in opitemrece + nondrugitems
   * 4. ANC services in person_anc_service (anc_service_type_id = 1)
   * 5. Pregnant women in person_anc within 24 weeks of LMP
   * 
   * Merges clinical HOSxP data with claim reimbursement status (NHSO, Rep, NewEclaim, EClaim).
   */
  static async getAncService23Report(
    params: AncService23Params = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<AncService23Result> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: AncService23CardFilter = params.cardFilter || 'ALL'
    const serviceFilter: 'ALL' | 'OK' | 'NOT_OK' = params.serviceFilter || 'ALL'
    const ucFilter: 'ALL' | 'UC' | 'NON_UC' = params.ucFilter || 'ALL'
    const statusFilter = (params.statusFilter || '').trim()
    const searchField: AncService23SearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: AncService23SortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-anc-service-2-3-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const allRows: AncService23Item[] = await getCachedData(
      cacheKey,
      async () => {
        const sql = `
          SELECT 
            o.vn,
            o.hn,
            IFNULL(pt.cid, '') AS cid,
            anc_info.person_id,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            IFNULL(pt.sex, '2') AS sex,
            TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
            IFNULL(nat.name, pt.nationality) AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            dep.department AS room,
            ptt_pt.name AS pttypename_patient,
            ptt_o.name AS pttypename_visit,
            IF(ptt_o.pttype_eclaim_id BETWEEN '01' AND '09', 'Y', ' ') AS uc,
            cc.AuthenCode AS authencode,
            
            -- Group composition flags
            (
              IF(dent.vn IS NOT NULL, 1, 0) +
              IF(anc_info.person_anc_id IS NOT NULL, 10, 0) +
              IF(oper.vn IS NOT NULL, 100, 0) +
              IF(srv.vn IS NOT NULL, 1000, 0)
            ) AS group_id_num,
            
            anc_info.preg_no,
            DATE_FORMAT(anc_info.lmp, '%Y-%m-%d') AS lmp,
            DATE_FORMAT(DATE_ADD(anc_info.lmp, INTERVAL 168 DAY), '%Y-%m-%d') AS lastdate,
            dt.pregnancy,
            TIMESTAMPDIFF(WEEK, anc_info.lmp, o.vstdate) AS ga,
            DATE_FORMAT(anc_info.labor_date, '%Y-%m-%d') AS labor_date,
            DATE_FORMAT(anc_info.discharge_date, '%Y-%m-%d') AS dchdate,
            
            srv.servicename,
            oper.oper,
            
            -- Dental operations
            GROUP_CONCAT(DISTINCT IF(tm.icd10tm_operation_code IN ('2330011','2330013'), 'Y', NULL)) AS checkup,
            GROUP_CONCAT(DISTINCT IF(tm.icd10tm_operation_code IN ('2387010','2277310','2277320','2287310','2287320'), 'Y', NULL)) AS scalling,
            GROUP_CONCAT(DISTINCT IF(tm.icd10tm_operation_code IN ('2330011','2330013','2387010','2277310','2277320','2287310','2287320'), DATE_FORMAT(o.vstdate, '%Y-%m-%d'), NULL)) AS service_date,
            
            -- Procedure code list
            CONCAT_WS(',',
              GROUP_CONCAT(DISTINCT IF(tm.icd10tm_operation_code IN ('2330011','2330013','2387010','2277310','2277320','2287310','2287320'), tm.icd10tm_operation_code, NULL)),
              oper.oper
            ) AS itemname,
            
            o.doctor,
            pt.type_area AS typearea,
            CONCAT_WS(' ', pt.addrpart, pt.moopart, pt.road) AS address,
            CONCAT_WS(' ', NULLIF(pt.informtel, ''), NULLIF(pt.hometel, '')) AS tel,
            
            -- E-Claim & Reimbursement
            m.eclaim_no,
            m.service,
            COALESCE(nhso.statusname, m.statusname, rep.statusname, '- :: ยังไม่ได้ส่ง') AS status_eclaim,
            COALESCE(nhso.compensated, rep.compensated, m.compensated, 0) AS compensated,
            COALESCE(nhso.rep, rep.rep, m.rep) AS rep,
            rr.fund,
            rr.subfund

          FROM (
            -- Union of target visits
            SELECT o.vn
            FROM ovst o
            JOIN dental_care dc ON dc.vn = o.vn
            WHERE o.vstdate BETWEEN ? AND ? AND dc.dental_care_type_id = 1
            
            UNION
            
            SELECT dx.vn
            FROM ovstdiag dx
            LEFT JOIN vn_stat v ON v.vn = dx.vn
            JOIN person p ON p.patient_hn = dx.hn
            JOIN person_anc anc ON anc.person_id = p.person_id
            WHERE dx.vstdate BETWEEN ? AND ?
              AND dx.icd10 REGEXP '887[6-9]'
              AND (v.sex = '2' OR v.sex IS NULL)
              
            UNION
            
            SELECT oo.vn
            FROM opitemrece oo
            JOIN nondrugitems d ON d.icode = oo.icode
            LEFT JOIN vn_stat v ON v.vn = oo.vn
            WHERE oo.vstdate BETWEEN ? AND ?
              AND IFNULL(oo.vn, '') <> ''
              AND (d.name LIKE '%ultrasound%' OR d.name LIKE '%อัลตราซาวด์%' OR d.name LIKE '%อัลตร้าซาวด์%' OR d.billcode LIKE '%887%')
              AND (v.sex = '2' OR v.sex IS NULL)
              
            UNION
            
            SELECT s.vn
            FROM person_anc_service s
            JOIN person_anc anc ON anc.person_anc_id = s.person_anc_id
            JOIN ovst o ON o.vn = s.vn
            WHERE s.anc_service_date BETWEEN ? AND ?
              AND s.anc_service_type_id = 1
              
            UNION
            
            SELECT o.vn
            FROM person_anc anc
            JOIN person p ON p.person_id = anc.person_id
            JOIN ovst o ON o.hn = p.patient_hn
            WHERE o.vstdate BETWEEN ? AND ?
              AND anc.lmp IS NOT NULL
              AND TIMESTAMPDIFF(WEEK, anc.lmp, o.vstdate) BETWEEN 0 AND 24
          ) vt
          JOIN ovst o ON o.vn = vt.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt_pt ON ptt_pt.pttype = pt.pttype
          LEFT JOIN pttype ptt_o ON ptt_o.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          
          -- Dental visit check
          LEFT JOIN (
            SELECT dc.vn
            FROM dental_care dc
            WHERE dc.dental_care_type_id = 1
            GROUP BY dc.vn
          ) dent ON dent.vn = o.vn

          -- Ultrasound diagnosis
          LEFT JOIN (
            SELECT dx.vn, GROUP_CONCAT(DISTINCT dx.icd10 SEPARATOR ',') AS oper
            FROM ovstdiag dx
            WHERE dx.vstdate BETWEEN ? AND ? AND dx.icd10 REGEXP '887[6-9]'
            GROUP BY dx.vn
          ) oper ON oper.vn = o.vn

          -- Ultrasound service item
          LEFT JOIN (
            SELECT oo.vn, GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS servicename
            FROM opitemrece oo
            JOIN nondrugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND (d.name LIKE '%ultrasound%' OR d.name LIKE '%อัลตราซาวด์%' OR d.name LIKE '%อัลตร้าซาวด์%' OR d.billcode LIKE '%887%')
            GROUP BY oo.vn
          ) srv ON srv.vn = o.vn

          -- Person ANC metadata (matched via service or latest pregnancy)
          LEFT JOIN (
            SELECT 
              o2.vn,
              anc.person_id,
              anc.person_anc_id,
              anc.lmp,
              anc.preg_no,
              anc.labor_date,
              anc.discharge_date
            FROM ovst o2
            JOIN person p ON p.patient_hn = o2.hn
            JOIN person_anc anc ON anc.person_id = p.person_id
            WHERE o2.vstdate BETWEEN ? AND ?
              AND (anc.labor_date IS NULL OR o2.vstdate <= anc.labor_date)
            GROUP BY o2.vn
          ) anc_info ON anc_info.vn = o.vn

          -- Dental procedures
          LEFT JOIN dtmain dt ON dt.vn = o.vn
          LEFT JOIN dttm tm ON tm.code = dt.tmcode

          -- Reimbursement & E-Claim
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'NHSO :: ได้รับ Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND date(admdate) BETWEEN ? AND ?
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = o.vn

          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'Rep :: ส่ง Rep แล้ว' AS statusname
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND date(admdate) BETWEEN ? AND ?
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) rep ON rep.vn = o.vn

          LEFT JOIN (
            SELECT m.opdseq AS vn,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.eclaim_no ORDER BY m.eclaim_no DESC), ',', 1) AS eclaim_no,
                   SUBSTRING_INDEX(GROUP_CONCAT(IF(m.status = '4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                   SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname,
                   MAX(IF(m.code_id = '30008' OR m.code_id = '30009', 'Y', NULL)) AS service
            FROM eclaimdb.m_registerdata m
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE m.person_type = '1' AND IFNULL(m.opdseq, '') <> '' AND m.dateadm BETWEEN ? AND ?
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn

          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ', ') AS fund, GROUP_CONCAT(DISTINCT subfund SEPARATOR ', ') AS subfund
            FROM rcmdb.repdata
            WHERE IFNULL(vn, '') <> '' AND date(admdate) BETWEEN ? AND ?
            GROUP BY vn
          ) rr ON rr.vn = o.vn

          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC
        `

        // 5 unions (10 params) + oper (2) + srv (2) + anc_info (2) + nhso (2) + rep (2) + m (2) + rr (2) = 24 params
        const queryParams = [
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
        ]

        const rows = (await executor(sql, queryParams, { timeoutMs: 45000 })) as Record<string, unknown>[]

        return rows.map((r) => {
          const groupIdNum = Number(r.group_id_num || 0)
          const groupIdPad = String(groupIdNum).padStart(4, '0') // e.g. '1111'
          // groupIdPad: [1000: service, 100: oper, 10: anc, 1: dent]
          const isService = groupIdPad[0] === '1'
          const isOper = groupIdPad[1] === '1'
          const isAnc = groupIdPad[2] === '1'
          const isDent = groupIdPad[3] === '1'

          const groupParts: string[] = []
          if (isAnc) groupParts.push('ANC')
          if (isDent) groupParts.push('บริการทันตกรรม')
          if (isService || isOper) groupParts.push('Ultrasound')
          const groupname = groupParts.join(' & ') || '—'

          const operVal = r.oper ? String(r.oper) : null
          const serviceNameVal = r.servicename ? String(r.servicename) : null
          const usVal: string | null = operVal ? 'Y' : serviceNameVal ? 'S' : null

          const checkupVal: string | null = r.checkup === 'Y' ? 'Y' : null
          const scallingVal: string | null = r.scalling === 'Y' ? 'Y' : null

          // ok is 'Y' when ultrasound or dental care is provided
          const okVal: string | null =
            serviceNameVal || operVal || checkupVal === 'Y' || scallingVal === 'Y' ? 'Y' : null

          const rawGa = r.ga !== null && r.ga !== undefined ? Number(r.ga) : null
          let ancTrimester: string | null = null
          if (rawGa !== null) {
            if (rawGa >= 32 && rawGa <= 40) ancTrimester = '5'
            else if (rawGa >= 26 && rawGa <= 31) ancTrimester = '4'
            else if (rawGa >= 20 && rawGa <= 25) ancTrimester = '3'
            else if (rawGa >= 13 && rawGa <= 19) ancTrimester = '2'
            else if (rawGa >= 4 && rawGa <= 12) ancTrimester = '1'
          }

          const rawItemName = r.itemname ? String(r.itemname).replace(/^,|,$/g, '').trim() : null
          const rawLmp = r.lmp ? String(r.lmp) : null

          // Validation Warnings (FoxPro `mean`)
          const warnings: string[] = []
          if (okVal === 'Y' && (!rawItemName || rawItemName === '')) {
            warnings.push('ไม่มีหัตถการ')
          }
          if (okVal === 'Y' && (!rawLmp || rawLmp === '')) {
            warnings.push('ไม่มี LMP')
          }
          if (rawGa !== null && rawGa > 48) {
            warnings.push('อายุครรภ์เกินเกณฑ์ (>48 สัปดาห์)')
          }
          const meanVal = warnings.length > 0 ? warnings.join(', ') : null

          const compensatedVal = Number(r.compensated || 0)

          return {
            vn: String(r.vn || ''),
            hn: String(r.hn || ''),
            cid: String(r.cid || ''),
            person_id: r.person_id ? Number(r.person_id) : null,
            ptname: String(r.ptname || '').trim(),
            sex: String(r.sex || '2') === '1' ? 'ชาย' : 'หญิง',
            age: r.age !== null && r.age !== undefined ? Number(r.age) : null,
            nation: r.nation ? String(r.nation) : null,
            vstdate: String(r.vstdate || ''),
            vsttime: r.vsttime ? String(r.vsttime) : null,
            camedate: String(r.vstdate || ''),
            room: r.room ? String(r.room) : null,
            pttypename_patient: r.pttypename_patient ? String(r.pttypename_patient) : null,
            pttypename_visit: r.pttypename_visit ? String(r.pttypename_visit) : null,
            uc: String(r.uc || ' '),
            authencode: r.authencode ? String(r.authencode) : null,
            group_id: groupIdPad,
            groupname,
            preg_no: r.preg_no ? String(r.preg_no) : null,
            ga: rawGa,
            lmp: rawLmp,
            lastdate: r.lastdate ? String(r.lastdate) : null,
            pregnancy: r.pregnancy ? String(r.pregnancy) : null,
            labor_date: r.labor_date ? String(r.labor_date) : null,
            dchdate: r.dchdate ? String(r.dchdate) : null,
            anc: ancTrimester,
            servicename: serviceNameVal,
            oper: operVal,
            us: usVal,
            checkup: checkupVal,
            scalling: scallingVal,
            service_date: r.service_date ? String(r.service_date) : null,
            itemname: rawItemName,
            ok: okVal,
            doctor: r.doctor ? String(r.doctor) : null,
            typearea: r.typearea ? String(r.typearea) : null,
            address: r.address ? String(r.address).trim() : null,
            tel: r.tel ? String(r.tel).trim() : null,
            eclaim_no: r.eclaim_no ? String(r.eclaim_no) : null,
            status_eclaim: r.status_eclaim ? String(r.status_eclaim) : '- :: ยังไม่ได้ส่ง',
            service: r.service ? String(r.service) : null,
            compensated: compensatedVal,
            isCompensated: compensatedVal > 0,
            rep: r.rep ? String(r.rep) : null,
            fund: r.fund ? String(r.fund) : null,
            subfund: r.subfund ? String(r.subfund) : null,
            mean: meanVal,
          }
        })
      },
      300000 // 5 minutes cache TTL
    )

    // Compute Summary KPIs on the full date-range cohort
    const totalVisits = allRows.length
    const uniquePatients = new Set(allRows.map((i) => i.hn).filter(Boolean)).size
    const serviceOkCount = allRows.filter((i) => i.ok === 'Y').length
    const checkupCount = allRows.filter((i) => i.checkup === 'Y').length
    const scallingCount = allRows.filter((i) => i.scalling === 'Y').length
    const ultrasoundCount = allRows.filter((i) => i.us !== null).length
    const ucCount = allRows.filter((i) => i.uc === 'Y').length
    const compensatedCount = allRows.filter((i) => i.compensated > 0).length
    const uncompensatedCount = totalVisits - compensatedCount
    const compensationRate = totalVisits > 0 ? Number(((compensatedCount / totalVisits) * 100).toFixed(2)) : 0
    const totalCompensated = allRows.reduce((acc, i) => acc + i.compensated, 0)
    const averageCompensated = compensatedCount > 0 ? Number((totalCompensated / compensatedCount).toFixed(2)) : 0
    const warningCount = allRows.filter((i) => Boolean(i.mean)).length

    const summary: AncService23Summary = {
      totalVisits,
      uniquePatients,
      serviceOkCount,
      checkupCount,
      scallingCount,
      ultrasoundCount,
      ucCount,
      compensatedCount,
      uncompensatedCount,
      compensationRate,
      totalCompensated,
      averageCompensated,
      warningCount,
    }

    // Available status options for dropdown
    const statusOptions = Array.from(
      new Set(allRows.map((i) => i.status_eclaim).filter(Boolean))
    ).sort() as string[]

    // Apply Card Filter (Interactive KPI Cards)
    let filtered = allRows
    if (cardFilter === 'SERVICE_OK') {
      filtered = filtered.filter((i) => i.ok === 'Y')
    } else if (cardFilter === 'CHECKUP') {
      filtered = filtered.filter((i) => i.checkup === 'Y')
    } else if (cardFilter === 'SCALLING') {
      filtered = filtered.filter((i) => i.scalling === 'Y')
    } else if (cardFilter === 'ULTRASOUND') {
      filtered = filtered.filter((i) => i.us !== null)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.uc === 'Y')
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.compensated > 0)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => i.compensated === 0)
    } else if (cardFilter === 'WARNINGS') {
      filtered = filtered.filter((i) => Boolean(i.mean))
    }

    // Apply Secondary Service Filter
    if (serviceFilter === 'OK') {
      filtered = filtered.filter((i) => i.ok === 'Y')
    } else if (serviceFilter === 'NOT_OK') {
      filtered = filtered.filter((i) => i.ok !== 'Y')
    }

    // Apply UC Filter
    if (ucFilter === 'UC') {
      filtered = filtered.filter((i) => i.uc === 'Y')
    } else if (ucFilter === 'NON_UC') {
      filtered = filtered.filter((i) => i.uc !== 'Y')
    }

    // Apply Status E-Claim Filter
    if (statusFilter && statusFilter !== 'ALL') {
      filtered = filtered.filter((i) => i.status_eclaim === statusFilter)
    }

    // Apply Search Filter
    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') {
          return i.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          const cleanCid = i.cid.replace(/\D/g, '')
          return cleanCid.includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return i.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return i.vn.toLowerCase().includes(search)
        }
        if (searchField === 'AUTHEN') {
          return (i.authencode || '').toLowerCase().includes(search)
        }
        if (searchField === 'ITEMNAME') {
          return (i.itemname || '').toLowerCase().includes(search)
        }

        // searchField === 'ALL'
        const cleanQ = search.replace(/\D/g, '')
        const matchCid = cleanQ && cleanQ.length >= 3 && i.cid.replace(/\D/g, '').includes(cleanQ)
        const matchText =
          i.hn.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.itemname && i.itemname.toLowerCase().includes(search)) ||
          (i.groupname && i.groupname.toLowerCase().includes(search)) ||
          (i.status_eclaim && i.status_eclaim.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search))

        return matchText || matchCid
      })
    }

    // Apply Sorting
    const sorted = [...filtered].sort((a, b) => {
      let valA: string | number = ''
      let valB: string | number = ''

      switch (sortBy) {
        case 'vstdate':
          valA = `${a.vstdate} ${a.vsttime || ''}`
          valB = `${b.vstdate} ${b.vsttime || ''}`
          break
        case 'hn':
          valA = a.hn
          valB = b.hn
          break
        case 'cid':
          valA = a.cid
          valB = b.cid
          break
        case 'ptname':
          valA = a.ptname
          valB = b.ptname
          break
        case 'age':
          valA = a.age ?? -1
          valB = b.age ?? -1
          break
        case 'ga':
          valA = a.ga ?? -1
          valB = b.ga ?? -1
          break
        case 'compensated':
          valA = a.compensated
          valB = b.compensated
          break
        case 'authencode':
          valA = a.authencode || ''
          valB = b.authencode || ''
          break
        case 'groupname':
          valA = a.groupname || ''
          valB = b.groupname || ''
          break
        default:
          valA = a.vstdate
          valB = b.vstdate
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    const totalCount = sorted.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const safePage = Math.min(page, totalPages)

    const slice = exportAll ? sorted : sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
    const offset = exportAll ? 0 : (safePage - 1) * pageSize

    const numberedItems = slice.map((item, idx) => ({
      ...item,
      no: offset + idx + 1,
    }))

    return {
      ds1,
      ds2,
      cardFilter,
      serviceFilter,
      ucFilter,
      statusFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      statusOptions,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
    }
  }
}

// ── 4. Domain Types: ANC 2.3 หญิงตั้งครรภ์ US - ตรวจช่องปาก - ขัดฟัน ─────────

export type AncService23CardFilter =
  | 'ALL'
  | 'SERVICE_OK'
  | 'CHECKUP'
  | 'SCALLING'
  | 'ULTRASOUND'
  | 'UC_ONLY'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WARNINGS'

export type AncService23SearchField = 'ALL' | 'HN' | 'CID' | 'PTNAME' | 'VN' | 'AUTHEN' | 'ITEMNAME'

export type AncService23SortField =
  | 'vstdate'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'ga'
  | 'compensated'
  | 'authencode'
  | 'groupname'

export interface AncService23Params extends FiscalDateRangeParams {
  cardFilter?: AncService23CardFilter
  serviceFilter?: 'ALL' | 'OK' | 'NOT_OK'
  ucFilter?: 'ALL' | 'UC' | 'NON_UC'
  statusFilter?: string
  searchField?: AncService23SearchField
  search?: string
  sortBy?: AncService23SortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface AncService23Item {
  no?: number
  vn: string
  hn: string
  cid: string
  person_id: number | null
  ptname: string
  sex: string
  age: number | null
  nation: string | null
  vstdate: string // YYYY-MM-DD
  vsttime: string | null
  camedate: string
  room: string | null
  pttypename_patient: string | null
  pttypename_visit: string | null
  uc: string // 'Y' | ' '
  authencode: string | null
  group_id: string
  groupname: string
  preg_no: number | string | null
  ga: number | null
  lmp: string | null
  lastdate: string | null
  pregnancy: string | null
  labor_date: string | null
  dchdate: string | null
  anc: string | null // '1' | '2' | '3' | '4' | '5' | null
  servicename: string | null
  oper: string | null
  us: string | null // 'Y' | 'S' | null
  checkup: string | null // 'Y' | null
  scalling: string | null // 'Y' | null
  service_date: string | null
  itemname: string | null
  ok: string | null // 'Y' | null
  doctor: string | null
  typearea: string | null
  address: string | null
  tel: string | null
  eclaim_no: string | null
  status_eclaim: string | null
  service: string | null
  compensated: number
  isCompensated: boolean
  rep: string | null
  fund: string | null
  subfund: string | null
  mean: string | null // validation notes: 'ไม่มีหัตถการ', 'ไม่มี LMP', 'อายุครรภ์เกินเกณฑ์ (>48 สัปดาห์)'
}

export interface AncService23Summary {
  totalVisits: number
  uniquePatients: number
  serviceOkCount: number
  checkupCount: number
  scallingCount: number
  ultrasoundCount: number
  ucCount: number
  compensatedCount: number
  uncompensatedCount: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  warningCount: number
}

export interface AncService23Result {
  ds1: string
  ds2: string
  cardFilter: AncService23CardFilter
  serviceFilter: 'ALL' | 'OK' | 'NOT_OK'
  ucFilter: 'ALL' | 'UC' | 'NON_UC'
  statusFilter: string
  searchField: AncService23SearchField
  sortBy: AncService23SortField
  sortOrder: 'asc' | 'desc'
  summary: AncService23Summary
  statusOptions: string[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  items: AncService23Item[]
}
