import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type QueryExecutor } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import {
  NEW_ECLAIM_ADP_CODES,
  KRUNGTHAI_ADP_CODES,
  IUD_ADP_CODES,
  getAdpCodeForReport,
  getExpectedDxForReport,
  getReportTitle,
  evaluateFamilyPlanningDiscrepancy,
  type FamilyPlanningReportType,
  type FamilyPlanningPatientType,
  type FamilyPlanningCardFilter,
  type FamilyPlanningSearchField,
  type FamilyPlanningSortField,
  type FamilyPlanningReportParams,
  type FamilyPlanningAdpMappingItem,
  type FamilyPlanningAdpMappingCheck,
  type FamilyPlanningFormat,
  type FamilyPlanning91CardFilter,
  type FamilyPlanning91SearchField,
  type FamilyPlanning91SortField,
  type FamilyPlanning91Item,
  type FamilyPlanning91Summary,
  type FamilyPlanning91ReportResult,
  type FamilyPlanningItem,
  type FamilyPlanningSummary,
  type FamilyPlanningReportResult,
  type IudPatientType,
  type IudCardFilter,
  type IudSearchField,
  type IudSortField,
  type IudReportParams,
  type IudAdpMappingCheck,
  type IudItem,
  type IudSummary,
  type IudReportResult,
  type FamilyPlanning932Format,
  type FamilyPlanning932CardFilter,
  type FamilyPlanning932SearchField,
  type FamilyPlanning932SortField,
  type FamilyPlanning932Item,
  type FamilyPlanning932Summary,
  type FamilyPlanning932Params,
  type FamilyPlanning932AdpMappingCheck,
  type FamilyPlanning932ReportResult,
} from './typesAndHelpers'

  // ── 9.3.2 บริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป ─────────────────────────

  /**
   * Check ADP code mapping for 9.3.2 (FP001, FP002 or 20003, 20004).
   */
export async function checkFamilyPlanning932AdpMapping(
    format: FamilyPlanning932Format = 'NEW_ECLAIM',
    executor: QueryExecutor = queryClinicalDb
  ): Promise<FamilyPlanning932AdpMappingCheck> {
    const adpCodes = format === 'KRUNGTHAI' ? ['20003', '20004'] : ['FP001', 'FP002']
    const cacheKey = `rcm-fp-932-adp-mapping-${format}`

    return await getCachedData(
      cacheKey,
      async () => {
        try {
          const placeholders = adpCodes.map(() => '?').join(', ')
          const sRows = await executor(
            `SELECT icode, name, strength, nhso_adp_code
             FROM s_drugitems
             WHERE nhso_adp_code IN (${placeholders})
             ORDER BY name ASC`,
            adpCodes,
            { timeoutMs: 15000 }
          )

          const ndRows = await executor(
            `SELECT icode, name, NULL AS strength, nhso_adp_code
             FROM nondrugitems
             WHERE nhso_adp_code IN (${placeholders})
             ORDER BY name ASC`,
            adpCodes,
            { timeoutMs: 15000 }
          )

          const combined = [...(sRows || []), ...(ndRows || [])]
          const uniqueItems = Array.from(
            new Map(combined.map((item: any) => [item.icode, item])).values()
          ) as FamilyPlanningAdpMappingItem[]

          return {
            isMapped: uniqueItems.length > 0,
            mappedCount: uniqueItems.length,
            adpCodes,
            items: uniqueItems,
          }
        } catch {
          return {
            isMapped: true,
            mappedCount: 0,
            adpCodes,
            items: [],
          }
        }
      },
      86400000
    )
  }

  /**
   * 9.3.2 บริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป report implementation.
   */
export async function getFamilyPlanning932Report(
    params: FamilyPlanning932Params = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<FamilyPlanning932ReportResult> {
    const format: FamilyPlanning932Format = params.format || 'NEW_ECLAIM'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: FamilyPlanning932CardFilter = params.cardFilter || 'ALL'
    const searchField: FamilyPlanning932SearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: FamilyPlanning932SortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fp-932-${format}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-fp-932-adp-mapping-${format}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          checkFamilyPlanning932AdpMapping(format, executor),
          queryFamilyPlanning932Rows(ds1, ds2, format, executor),
        ])
        return { rawRows: rows, adpMapping: mappingRes }
      },
      300000
    )

    let allItems: FamilyPlanning932Item[] = (rawRows || []).map((row: any, idx: number) => {
      const compensatedEclaim = Number(row.compensated_eclaim) || 0
      const compensatedRep = Number(row.compensated_rep) || 0
      const compensatedNhso = Number(row.compensated_nhso) || 0
      const compensated = compensatedNhso || compensatedRep || compensatedEclaim || 0
      const isCompensated = compensated > 0
      const authencode = row.authencode ? String(row.authencode).trim() : null
      const hasAuthen = Boolean(authencode)
      const drugname = row.drugname ? String(row.drugname).trim() : null
      const listname = row.listname ? String(row.listname).trim() : null
      const hasDrug = Boolean(drugname)
      const hasService = Boolean(listname)
      const dx = row.dx ? String(row.dx).trim() : null
      const op = row.op ? String(row.op).trim() : null

      let errorDetail: string | null = null
      if (!dx) {
        errorDetail = 'ไม่พบการลงรหัส Dx'
      } else if (!hasDrug && !hasService) {
        errorDetail = 'ไม่พบรายการยาหรือค่าบริการคุมกำเนิด'
      } else if (!hasAuthen) {
        errorDetail = 'ไม่มี Authen Code'
      }
      const hasError = Boolean(errorDetail)

      return {
        no: idx + 1,
        vn: String(row.vn || ''),
        an: row.an ? String(row.an) : null,
        cid: String(row.cid || ''),
        hn: String(row.hn || ''),
        ptname: String(row.ptname || ''),
        sex: row.sex === '2' || row.sex === 'หญิง' ? 'หญิง' : String(row.sex || ''),
        age: Number(row.age) || 0,
        vstdate: String(row.vstdate || ''),
        vsttime: row.vsttime ? String(row.vsttime) : undefined,
        authencode,
        department: row.department ? String(row.department) : null,
        clinic: row.clinic ? String(row.clinic) : null,
        pttypename: String(row.pttypename || ''),
        pttype_eclaim_id: row.pttype_eclaim_id ? String(row.pttype_eclaim_id).trim() : null,
        isUc: isUcEclaimCode(row.pttype_eclaim_id ? String(row.pttype_eclaim_id).trim() : null),
        drugname,
        listname,
        adpcode: row.adpcode ? String(row.adpcode) : null,
        income: Number(row.income) || 0,
        dx,
        op,
        status: String(row.status || '- :: ยังไม่ได้ส่ง'),
        rep_eclaim: row.rep_eclaim ? String(row.rep_eclaim) : null,
        rep_rep: row.rep_rep ? String(row.rep_rep) : null,
        rep_nhso: row.rep_nhso ? String(row.rep_nhso) : null,
        compensated_eclaim: compensatedEclaim,
        compensated_rep: compensatedRep,
        compensated_nhso: compensatedNhso,
        compensated,
        isCompensated,
        hasAuthen,
        hasDrug,
        hasService,
        hasError,
        errorDetail,
      }
    })

    // Dual-mode pttype filter (pttypes takes precedence over ucOnly)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, executor, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) => matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id))
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn).filter(Boolean)).size
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalCompensatedEclaim = summaryCohort.reduce((acc, i) => acc + i.compensated_eclaim, 0)
    const totalCompensatedRep = summaryCohort.reduce((acc, i) => acc + i.compensated_rep, 0)
    const totalCompensatedNhso = summaryCohort.reduce((acc, i) => acc + i.compensated_nhso, 0)
    const compensatedCount = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCount = totalCases - compensatedCount
    const compensationRate = totalCases > 0 ? (compensatedCount / totalCases) * 100 : 0
    const eclaimSentCount = summaryCohort.filter((i) => i.status && !i.status.includes('ยังไม่ได้ส่ง')).length
    const unsentCount = totalCases - eclaimSentCount
    const withAuthenCount = summaryCohort.filter((i) => i.hasAuthen).length
    const noAuthenCount = totalCases - withAuthenCount
    const authenRate = totalCases > 0 ? (withAuthenCount / totalCases) * 100 : 0
    const withDrugCount = summaryCohort.filter((i) => i.hasDrug).length
    const withServiceCount = summaryCohort.filter((i) => i.hasService).length
    const hasErrorCount = summaryCohort.filter((i) => i.hasError).length

    const summary: FamilyPlanning932Summary = {
      totalCases,
      uniquePatients,
      totalIncome,
      totalCompensated,
      totalCompensatedEclaim,
      totalCompensatedRep,
      totalCompensatedNhso,
      compensatedCount,
      uncompensatedCount,
      compensationRate: Math.round(compensationRate * 10) / 10,
      eclaimSentCount,
      unsentCount,
      withAuthenCount,
      noAuthenCount,
      authenRate: Math.round(authenRate * 10) / 10,
      withDrugCount,
      withServiceCount,
      hasErrorCount,
    }

    let filtered = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'ECLAIM_SENT') {
      filtered = filtered.filter((i) => i.status && !i.status.includes('ยังไม่ได้ส่ง'))
    } else if (cardFilter === 'UNSENT') {
      filtered = filtered.filter((i) => !i.status || i.status.includes('ยังไม่ได้ส่ง'))
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => i.hasAuthen)
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.hasAuthen)
    } else if (cardFilter === 'WITH_DRUG') {
      filtered = filtered.filter((i) => i.hasDrug)
    } else if (cardFilter === 'WITH_SERVICE') {
      filtered = filtered.filter((i) => i.hasService)
    } else if (cardFilter === 'HAS_ERROR') {
      filtered = filtered.filter((i) => i.hasError)
    }

    if (search) {
      filtered = filtered.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return item.vn.toLowerCase().includes(search)
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)
        if (searchField === 'DEPARTMENT') return (item.department || '').toLowerCase().includes(search)
        if (searchField === 'CLINIC') return (item.clinic || '').toLowerCase().includes(search)
        if (searchField === 'DX') return (item.dx || '').toLowerCase().includes(search)
        if (searchField === 'OP') return (item.op || '').toLowerCase().includes(search)
        if (searchField === 'DRUG') return (item.drugname || '').toLowerCase().includes(search)
        if (searchField === 'SERVICE') return (item.listname || '').toLowerCase().includes(search)
        if (searchField === 'ADP') return (item.adpcode || '').toLowerCase().includes(search)
        if (searchField === 'REP') {
          return (
            (item.rep_eclaim || '').toLowerCase().includes(search) ||
            (item.rep_rep || '').toLowerCase().includes(search) ||
            (item.rep_nhso || '').toLowerCase().includes(search)
          )
        }
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.department || '').toLowerCase().includes(search) ||
          (item.clinic || '').toLowerCase().includes(search) ||
          (item.dx || '').toLowerCase().includes(search) ||
          (item.op || '').toLowerCase().includes(search) ||
          (item.drugname || '').toLowerCase().includes(search) ||
          (item.listname || '').toLowerCase().includes(search) ||
          (item.adpcode || '').toLowerCase().includes(search) ||
          (item.authencode || '').toLowerCase().includes(search) ||
          (item.status || '').toLowerCase().includes(search)
        )
      })
    }

    filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]
      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB || '', 'th')
        return sortOrder === 'asc' ? comp : -comp
      }
      valA = Number(valA) || 0
      valB = Number(valB) || 0
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })

    filtered = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))

    const totalItems = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const paginatedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    return {
      ds1,
      ds2,
      format,
      cardFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      adpCodes: adpMapping.adpCodes,
      adpMapping,
      summary,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
      items: paginatedItems,
    }
  }

  /**
   * Execute SQL Query for Family Planning 9.3.2 (หญิงอายุ 20 ปีขึ้นไป).
   */
export async function queryFamilyPlanning932Rows(
    ds1: string,
    ds2: string,
    format: FamilyPlanning932Format,
    executor: QueryExecutor
  ): Promise<any[]> {
    const adp1 = format === 'KRUNGTHAI' ? '20003' : 'FP001'
    const adp2 = format === 'KRUNGTHAI' ? '20004' : 'FP002'

    try {
      const sql = `
        SELECT 
          o.vn,
          IFNULL(o.an, '') AS an,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          COALESCE(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(cc2.auth_code), ''), NULLIF(TRIM(cc2.claim_code), ''), '') AS authencode,
          dep.department AS department,
          spc.name AS clinic,
          IFNULL(v.income, 0) AS income,
          drug_sub.drugname,
          drug_sub.drug_adp,
          fp_sub.listname,
          fp_sub.fp_adp,
          CONCAT_WS(',', NULLIF(drug_sub.drug_adp, ''), NULLIF(fp_sub.fp_adp, '')) AS adpcode,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          COALESCE(e.income, 0) AS compensated_eclaim,
          COALESCE(r.income, 0) AS compensated_rep,
          COALESCE(n.income, 0) AS compensated_nhso,
          COALESCE(e.rep, '') AS rep_eclaim,
          COALESCE(r.rep, '') AS rep_rep,
          COALESCE(n.rep, '') AS rep_nhso,
          CASE
            WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ได้ส่ง'
          END AS status
        FROM (
          SELECT DISTINCT oo.vn
          FROM opitemrece oo
          LEFT JOIN drugitems d ON d.icode = oo.icode
          LEFT JOIN nondrugitems nd ON nd.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND IFNULL(oo.vn, '') <> ''
            AND (
              d.name REGEXP 'norplant|implanon|jadelle'
              OR d.name LIKE '%ยาฝัง%'
              OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%'
              OR nd.nhso_adp_code IN (?, ?)
            )
        ) filtered_vn
        JOIN ovst o ON o.vn = filtered_vn.vn
        JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN (
          SELECT oo.vn,
                 GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS drugname,
                 GROUP_CONCAT(DISTINCT d.nhso_adp_code SEPARATOR ', ') AS drug_adp
          FROM opitemrece oo
          JOIN drugitems d ON d.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND (
              d.name REGEXP 'norplant|implanon|jadelle'
              OR d.name LIKE '%ยาฝัง%'
              OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%'
            )
          GROUP BY oo.vn
        ) drug_sub ON drug_sub.vn = o.vn
        LEFT JOIN (
          SELECT oo.vn,
                 GROUP_CONCAT(DISTINCT nd.name SEPARATOR ', ') AS listname,
                 GROUP_CONCAT(DISTINCT nd.nhso_adp_code SEPARATOR ', ') AS fp_adp
          FROM opitemrece oo
          JOIN nondrugitems nd ON nd.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND nd.nhso_adp_code IN (?, ?)
          GROUP BY oo.vn
        ) fp_sub ON fp_sub.vn = o.vn
        LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
        LEFT JOIN visit_pttype cc2 ON cc2.vn = o.vn
        LEFT JOIN (
          SELECT e.opdseq AS vn,
                 SUM(COALESCE(cc.totpay1, 0)) AS income,
                 SUBSTRING_INDEX(GROUP_CONCAT(IF(e.status = '4', e.rep, NULL) ORDER BY e.eclaim_no DESC), ',', 1) AS rep
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '1'
            AND e.dateadm BETWEEN ? AND ?
          GROUP BY e.opdseq
        ) e ON e.vn = o.vn
        LEFT JOIN (
          SELECT vn,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'OP'
          GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'OP'
          GROUP BY vn
        ) n ON n.vn = o.vn
        LEFT JOIN (
          SELECT m.opdseq AS vn,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '1'
            AND m.opdseq IS NOT NULL
            AND m.dateadm BETWEEN ? AND ?
          GROUP BY m.opdseq
        ) m ON m.vn = o.vn
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        WHERE o.vstdate BETWEEN ? AND ?
          AND pt.sex = '2'
          AND (v.age_y >= 20 OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) >= 20)
          AND (drug_sub.vn IS NOT NULL OR fp_sub.vn IS NOT NULL)
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `

      return await executor(
        sql,
        [ds1, ds2, adp1, adp2, ds1, ds2, ds1, ds2, adp1, adp2, ds1, ds2, ds1, ds2, ds1, ds2],
        { timeoutMs: 90000 }
      )
    } catch {
      const fallbackSql = `
        SELECT 
          o.vn,
          IFNULL(o.an, '') AS an,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          COALESCE(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          COALESCE(NULLIF(TRIM(cc2.auth_code), ''), NULLIF(TRIM(cc2.claim_code), ''), '') AS authencode,
          dep.department AS department,
          spc.name AS clinic,
          IFNULL(v.income, 0) AS income,
          drug_sub.drugname,
          drug_sub.drug_adp,
          fp_sub.listname,
          fp_sub.fp_adp,
          CONCAT_WS(',', NULLIF(drug_sub.drug_adp, ''), NULLIF(fp_sub.fp_adp, '')) AS adpcode,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          0 AS compensated_eclaim,
          0 AS compensated_rep,
          0 AS compensated_nhso,
          '' AS rep_eclaim,
          '' AS rep_rep,
          '' AS rep_nhso,
          '- :: ยังไม่ได้ส่ง' AS status
        FROM (
          SELECT DISTINCT oo.vn
          FROM opitemrece oo
          LEFT JOIN drugitems d ON d.icode = oo.icode
          LEFT JOIN nondrugitems nd ON nd.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND IFNULL(oo.vn, '') <> ''
            AND (
              d.name REGEXP 'norplant|implanon|jadelle'
              OR d.name LIKE '%ยาฝัง%'
              OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%'
              OR nd.nhso_adp_code IN (?, ?)
            )
        ) filtered_vn
        JOIN ovst o ON o.vn = filtered_vn.vn
        JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN (
          SELECT oo.vn,
                 GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS drugname,
                 GROUP_CONCAT(DISTINCT d.nhso_adp_code SEPARATOR ', ') AS drug_adp
          FROM opitemrece oo
          JOIN drugitems d ON d.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND (
              d.name REGEXP 'norplant|implanon|jadelle'
              OR d.name LIKE '%ยาฝัง%'
              OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%'
            )
          GROUP BY oo.vn
        ) drug_sub ON drug_sub.vn = o.vn
        LEFT JOIN (
          SELECT oo.vn,
                 GROUP_CONCAT(DISTINCT nd.name SEPARATOR ', ') AS listname,
                 GROUP_CONCAT(DISTINCT nd.nhso_adp_code SEPARATOR ', ') AS fp_adp
          FROM opitemrece oo
          JOIN nondrugitems nd ON nd.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND nd.nhso_adp_code IN (?, ?)
          GROUP BY oo.vn
        ) fp_sub ON fp_sub.vn = o.vn
        LEFT JOIN visit_pttype cc2 ON cc2.vn = o.vn
        WHERE o.vstdate BETWEEN ? AND ?
          AND pt.sex = '2'
          AND (v.age_y >= 20 OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) >= 20)
          AND (drug_sub.vn IS NOT NULL OR fp_sub.vn IS NOT NULL)
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `
      return await executor(fallbackSql, [ds1, ds2, adp1, adp2, ds1, ds2, ds1, ds2, adp1, adp2, ds1, ds2], {
        timeoutMs: 60000,
      })
    }
  }
