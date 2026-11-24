import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type QueryExecutor } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import { buildRepBreakdownSummary, matchesRepFilter, parseRepFilterParam } from '../rcmRepTagHelper'
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

  /**
   * Check whether NHSO ADP codes for IUD insertion are mapped in HOSxP `s_drugitems` table.
   * Mirrors legacy check:
   * SELECT COUNT(*) FROM s_drugitems WHERE nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
   */
export async function checkIudAdpMapping(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IudAdpMappingCheck> {
    const cacheKey = 'rcm-fp-9-2-iud-adp-mapping'
    return getCachedData(
      cacheKey,
      async () => {
        try {
          const sql = `
            SELECT 
              icode, 
              name, 
              strength, 
              nhso_adp_code
            FROM s_drugitems 
            WHERE TRIM(nhso_adp_code) IN (?, ?, ?, ?)
            ORDER BY nhso_adp_code ASC, icode ASC;
          `
          const rows = (await executor(sql, IUD_ADP_CODES, {
            timeoutMs: 15000,
          })) as any[]
          const items: FamilyPlanningAdpMappingItem[] = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))

          return {
            isMapped: items.length > 0,
            mappedCount: items.length,
            adpCodes: IUD_ADP_CODES,
            items,
          }
        } catch {
          return {
            isMapped: false,
            mappedCount: 0,
            adpCodes: IUD_ADP_CODES,
            items: [],
          }
        }
      },
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Generate 9.2 บริการใส่ห่วงอนามัย (IUD Insertion Service) Report.
   * Full high-fidelity implementation of the FoxPro ledger queries:
   * - ADP codes: '20003', 'FP001', '71681', '71682'
   * - Supports OPD (ovst, ovstdiag, opitemrece) and IPD (ipt, iptdiag, iptoprt, opitemrece)
   * - Cross-reconciliation with E-Claim, RCM repdata, repeclaim, authencode
   * - Validation: ErrorDx (Z301), ErrorOp (697), ErrorDrug (ADP drug item)
   */
export async function getIudReport(
    params: IudReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IudReportResult> {
    const patientType: IudPatientType = params.patientType === 'IPD' ? 'IPD' : 'OPD'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: IudCardFilter = params.cardFilter || 'ALL'
    const searchField: IudSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: IudSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fp-9-2-iud-${patientType}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-fp-9-2-iud-adp-mapping')
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        const [mappingRes, rows] = await Promise.all([
          checkIudAdpMapping(executor),
          patientType === 'IPD'
            ? queryIudIpdRows(ds1, ds2, executor)
            : queryIudOpdRows(ds1, ds2, executor),
        ])

        return { rawRows: (rows || []) as Record<string, unknown>[], adpMapping: mappingRes }
      },
      300000 // Cache TTL 5 minutes
    )

    // Map raw rows into strongly typed IudItem records with validation rules
    let allItems: IudItem[] = rawRows.map((r, idx) => {
      const moneyEclaim = Number(r.money_eclaim || 0)
      const moneyRep = Number(r.money_rep || 0)
      const moneyInvoice = Number(r.money_invoice || 0)
      const compensated = moneyInvoice > 0 ? moneyInvoice : moneyRep > 0 ? moneyRep : moneyEclaim
      const isCompensated = moneyInvoice > 0 || moneyRep > 0

      const dx = r.dx ? String(r.dx).trim() : null
      const op = r.op ? String(r.op).trim() : null
      const drug = r.drug ? String(r.drug).trim() : null

      // FoxPro Validation Rules for 9.2:
      // if(dx regexp 'Z301', null, 'ไม่พบ Dx Z301') ErrorDx
      // if(op regexp '697', null, 'ไม่พบ Op 697') ErrorOp
      // if(drug<>'', null, 'ไม่พบค่าบริการ') ErrorDrug
      const hasZ301 = dx ? /Z301/i.test(dx) : false
      const errorDx = hasZ301 ? null : 'ไม่พบ Dx Z301'

      const hasOp697 = op ? /(^|[^0-9])697([^0-9]|$)/.test(op) || op.includes('697') : false
      const errorOp = hasOp697 ? null : 'ไม่พบ Op 697'

      const errorDrug = drug && drug.length > 0 ? null : 'ไม่พบค่าบริการ'
      const hasError = Boolean(errorDx || errorOp || errorDrug)

      let rep = r.rep ? String(r.rep).trim() : null
      if (rep === '' || rep === 'null') rep = null

      let status = String(r.status || '').trim()
      if (!status) {
        status = '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
      }

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: String(r.sex || '—').trim(),
        age: Number(r.age || 0),
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || '00:00:00'),
        admdate: r.admdate ? String(r.admdate).trim() : null,
        dchdate: r.dchdate ? String(r.dchdate).trim() : null,
        pttypename: String(r.pttypename || '—').trim(),
        pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
        isUc: isUcEclaimCode(r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null),
        claimcode: r.claimcode ? String(r.claimcode).trim() : null,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        cc: r.cc ? String(r.cc).trim() : null,
        income: Number(r.income || 0),
        dx,
        op,
        drug,
        money_eclaim: moneyEclaim,
        money_rep: moneyRep,
        money_invoice: moneyInvoice,
        compensated,
        isCompensated,
        errorDx,
        errorOp,
        errorDrug,
        hasError,
        rep,
        status,
        patientType,
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

    // Compute Summary KPIs across summaryCohort (before card filtering)
    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const eclaimSentCases = summaryCohort.filter(
      (i) => i.status !== '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
    ).length
    const unsentCases = totalCases - eclaimSentCases
    const compensationRate =
      totalCases > 0 ? Number(((compensatedCases / totalCases) * 100).toFixed(1)) : 0

    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)
    const totalMoneyEclaim = summaryCohort.reduce((acc, i) => acc + i.money_eclaim, 0)
    const totalMoneyRep = summaryCohort.reduce((acc, i) => acc + i.money_rep, 0)
    const totalMoneyInvoice = summaryCohort.reduce((acc, i) => acc + i.money_invoice, 0)

    const errorDxCount = summaryCohort.filter((i) => Boolean(i.errorDx)).length
    const errorOpCount = summaryCohort.filter((i) => Boolean(i.errorOp)).length
    const errorDrugCount = summaryCohort.filter((i) => Boolean(i.errorDrug)).length
    const hasErrorCount = summaryCohort.filter((i) => i.hasError).length
    const completeCount = summaryCohort.filter((i) => !i.hasError).length

    const withAuthenCount = summaryCohort.filter((i) => Boolean(i.claimcode)).length
    const withoutAuthenCount = totalCases - withAuthenCount
    const authenRate =
      totalCases > 0 ? Number(((withAuthenCount / totalCases) * 100).toFixed(1)) : 0

    const summary: IudSummary = {
      totalCases,
      uniquePatients,
      compensatedCases,
      uncompensatedCases,
      eclaimSentCases,
      unsentCases,
      compensationRate,
      totalCompensated,
      totalIncome,
      totalMoneyEclaim,
      totalMoneyRep,
      totalMoneyInvoice,
      errorDxCount,
      errorOpCount,
      errorDrugCount,
      hasErrorCount,
      completeCount,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Apply Card Filter
    let filteredItems = summaryCohort.filter((item) => {
      if (selectedReps.length > 0 && !matchesRepFilter(item, selectedReps)) return false
      switch (cardFilter) {
        case 'COMPENSATED':
          return item.isCompensated
        case 'UNCOMPENSATED':
          return !item.isCompensated
        case 'ECLAIM_SENT':
          return item.status !== '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
        case 'UNSENT':
          return item.status === '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
        case 'COMPLETE':
          return !item.hasError
        case 'HAS_ERROR':
          return item.hasError
        case 'ERROR_DX':
          return Boolean(item.errorDx)
        case 'ERROR_OP':
          return Boolean(item.errorOp)
        case 'ERROR_DRUG':
          return Boolean(item.errorDrug)
        case 'WITH_AUTHEN':
          return Boolean(item.claimcode)
        case 'NO_AUTHEN':
          return !item.claimcode
        case 'ALL':
        default:
          return true
      }
    })

    // Apply Search Filter
    if (search.length > 0) {
      filteredItems = filteredItems.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') {
          return item.vn.toLowerCase().includes(search) || (item.an && item.an.toLowerCase().includes(search))
        }
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)
        if (searchField === 'DEPARTMENT') return (item.department || '').toLowerCase().includes(search)
        if (searchField === 'CLINIC') return (item.clinic || '').toLowerCase().includes(search)
        if (searchField === 'DX') return (item.dx || '').toLowerCase().includes(search)
        if (searchField === 'OP') return (item.op || '').toLowerCase().includes(search)
        if (searchField === 'DRUG') return (item.drug || '').toLowerCase().includes(search)
        if (searchField === 'REP') return (item.rep || '').toLowerCase().includes(search)

        // Default 'ALL'
        return (
          matchesSeamlessRepSearch(item, search) ||
          item.hn.toLowerCase().includes(search) ||
          item.cid.includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.vn.toLowerCase().includes(search) ||
          (item.an && item.an.toLowerCase().includes(search)) ||
          item.pttypename.toLowerCase().includes(search) ||
          (item.department || '').toLowerCase().includes(search) ||
          (item.clinic || '').toLowerCase().includes(search) ||
          (item.dx || '').toLowerCase().includes(search) ||
          (item.op || '').toLowerCase().includes(search) ||
          (item.drug || '').toLowerCase().includes(search) ||
          (item.rep || '').toLowerCase().includes(search) ||
          item.status.toLowerCase().includes(search)
        )
      })
    }

    // Apply Sorting
    filteredItems.sort((a, b) => {
      let valA: string | number = a[sortBy] ?? ''
      let valB: string | number = b[sortBy] ?? ''

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index row numbers
    filteredItems.forEach((item, index) => {
      item.no = index + 1
    })

    const totalCount = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pagedItems = filteredItems
    if (!exportAll) {
      const startIndex = (page - 1) * pageSize
      pagedItems = filteredItems.slice(startIndex, startIndex + pageSize)
    }

    return {
      ds1,
      ds2,
      patientType,
      adpCodes: IUD_ADP_CODES,
      adpMapping,
      cardFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page,
      pageSize,
      totalPages,
      items: pagedItems,
      repBreakdown,
    }
  }

  /**
   * Execute OPD SQL Query for 9.2 บริการใส่ห่วงอนามัย.
   */
export async function queryIudOpdRows(
    ds1: string,
    ds2: string,
    executor: QueryExecutor
  ): Promise<any[]> {
    try {
      const sql = `
        SELECT 
          o.vn,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(cc.AuthenCode, m.claimcode, '') AS claimcode,
          dep.department AS department,
          spc.name AS clinic,
          s.cc AS cc,
          IFNULL(v.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
          COALESCE(e.income, 0) AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, ''), NULLIF(nn.Rep, ''), NULLIF(m.rep, ''), '') AS rep,
          CASE 
            WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN nn.Seq IS NOT NULL AND IFNULL(nn.Rep, '') <> '' THEN IFNULL(nn.StatusName, 'E-Claim :: มี Rep แล้ว')
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT vn FROM (
            SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND (icd10 REGEXP 'Z301' OR icd10 IN ('697'))
            UNION
            SELECT oo.vn 
            FROM opitemrece oo 
            JOIN s_drugitems d ON d.icode = oo.icode 
            WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> '' AND d.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
          ) u
        ) t
        JOIN ovst o ON o.vn = t.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN opitemrece oo ON oo.vn = o.vn
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'OP' AND (fpnhso > 0 OR pp > 0)
          GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'OP' AND (fpnhso > 0 OR pp > 0)
          GROUP BY vn
        ) n ON n.vn = o.vn
        LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
        LEFT JOIN (
          SELECT e.opdseq AS vn, SUM(cc.totpay1) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '1' AND cc.code LIKE 'FP001%'
          GROUP BY e.opdseq
        ) e ON e.vn = o.vn
        LEFT JOIN (
          SELECT m.opdseq AS vn,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.claimcode ORDER BY m.eclaim_no DESC), ',', 1) AS claimcode
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '1' AND IFNULL(m.opdseq, '') <> ''
          GROUP BY m.opdseq
        ) m ON m.vn = o.vn
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `

      return await executor(sql, [ds1, ds2, ds1, ds2], { timeoutMs: 90000 })
    } catch (primaryErr) {
      // Resilient fallback query in case cross-db tables are inaccessible
      const fallbackSql = `
        SELECT 
          o.vn,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          '' AS claimcode,
          dep.department AS department,
          spc.name AS clinic,
          s.cc AS cc,
          IFNULL(v.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT DISTINCT vn FROM (
            SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND (icd10 REGEXP 'Z301' OR icd10 IN ('697'))
            UNION
            SELECT oo.vn 
            FROM opitemrece oo 
            JOIN s_drugitems d ON d.icode = oo.icode 
            WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> '' AND d.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
          ) u
        ) t
        JOIN ovst o ON o.vn = t.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN opitemrece oo ON oo.vn = o.vn
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `
      return await executor(fallbackSql, [ds1, ds2, ds1, ds2], { timeoutMs: 60000 })
    }
  }

  /**
   * Execute IPD SQL Query for 9.2 บริการใส่ห่วงอนามัย.
   */
export async function queryIudIpdRows(
    ds1: string,
    ds2: string,
    executor: QueryExecutor
  ): Promise<any[]> {
    try {
      const sql = `
        SELECT 
          i.an AS vn,
          i.an,
          IFNULL(pt.cid, '') AS cid,
          i.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(cc.AuthenCode, m.claimcode, '') AS claimcode,
          w.name AS department,
          spc.name AS clinic,
          '' AS cc,
          IFNULL(a.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
          COALESCE(e.income, 0) AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, ''), NULLIF(nn.Rep, ''), NULLIF(m.rep, ''), '') AS rep,
          CASE 
            WHEN n.an IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.an IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN nn.Seq IS NOT NULL AND IFNULL(nn.Rep, '') <> '' THEN IFNULL(nn.StatusName, 'E-Claim :: มี Rep แล้ว')
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT an FROM (
            SELECT i2.an FROM ipt i2 JOIN iptdiag dx2 ON dx2.an = i2.an WHERE i2.dchdate BETWEEN ? AND ? AND dx2.icd10 REGEXP 'Z301'
            UNION
            SELECT i3.an FROM ipt i3 JOIN iptoprt op3 ON op3.an = i3.an WHERE i3.dchdate BETWEEN ? AND ? AND op3.icd9 IN ('697')
            UNION
            SELECT oo2.an 
            FROM opitemrece oo2 
            JOIN s_drugitems d2 ON d2.icode = oo2.icode 
            WHERE oo2.vstdate BETWEEN ? AND ? AND IFNULL(oo2.an, '') <> '' AND d2.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
          ) u
        ) t
        JOIN ipt i ON i.an = t.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN spclty spc ON spc.spclty = i.spclty
        LEFT JOIN iptdiag dx ON dx.an = i.an
        LEFT JOIN iptoprt op ON op.an = i.an
        LEFT JOIN opitemrece oo ON oo.an = i.an
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN rcmdb.authencode cc ON cc.vn = i.an
        LEFT JOIN (
          SELECT an, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'IP' AND (fpnhso > 0 OR pp > 0)
          GROUP BY an
        ) r ON r.an = i.an
        LEFT JOIN (
          SELECT an, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'IP' AND (fpnhso > 0 OR pp > 0)
          GROUP BY an
        ) n ON n.an = i.an
        LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = i.an
        LEFT JOIN (
          SELECT e.an, SUM(cc.totpay1) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '2' AND cc.code LIKE 'FP001%'
          GROUP BY e.an
        ) e ON e.an = i.an
        LEFT JOIN (
          SELECT m.an,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.claimcode ORDER BY m.eclaim_no DESC), ',', 1) AS claimcode
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '2' AND IFNULL(m.an, '') <> ''
          GROUP BY m.an
        ) m ON m.an = i.an
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        GROUP BY i.an
        ORDER BY i.dchdate DESC;
      `

      return await executor(sql, [ds1, ds2, ds1, ds2, ds1, ds2], { timeoutMs: 90000 })
    } catch (primaryErr) {
      // Resilient fallback query in case cross-db tables are inaccessible
      const fallbackSql = `
        SELECT 
          i.an AS vn,
          i.an,
          IFNULL(pt.cid, '') AS cid,
          i.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          '' AS claimcode,
          w.name AS department,
          spc.name AS clinic,
          '' AS cc,
          IFNULL(a.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT DISTINCT an FROM (
            SELECT i2.an FROM ipt i2 JOIN iptdiag dx2 ON dx2.an = i2.an WHERE i2.dchdate BETWEEN ? AND ? AND dx2.icd10 REGEXP 'Z301'
            UNION
            SELECT i3.an FROM ipt i3 JOIN iptoprt op3 ON op3.an = i3.an WHERE i3.dchdate BETWEEN ? AND ? AND op3.icd9 IN ('697')
            UNION
            SELECT oo2.an 
            FROM opitemrece oo2 
            JOIN s_drugitems d2 ON d2.icode = oo2.icode 
            WHERE oo2.vstdate BETWEEN ? AND ? AND IFNULL(oo2.an, '') <> '' AND d2.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
          ) u
        ) t
        JOIN ipt i ON i.an = t.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN spclty spc ON spc.spclty = i.spclty
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN iptdiag dx ON dx.an = i.an
        LEFT JOIN iptoprt op ON op.an = i.an
        LEFT JOIN opitemrece oo ON oo.an = i.an
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        GROUP BY i.an
        ORDER BY i.dchdate DESC;
      `
      return await executor(fallbackSql, [ds1, ds2, ds1, ds2, ds1, ds2], { timeoutMs: 60000 })
    }
  }
