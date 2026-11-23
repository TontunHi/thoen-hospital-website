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

import { checkFamilyPlanningAdpMapping } from './service91Report'

  /**
   * 9.3 Family Planning (ฝังยาคุม / ถอดยาคุม) report implementation.
   */
export async function getFamilyPlanning93Report(
    params: FamilyPlanningReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<FamilyPlanningReportResult> {
    const reportType: FamilyPlanningReportType = params.reportType || '9.3.1'
    const patientType: FamilyPlanningPatientType = params.patientType === 'IPD' ? 'IPD' : 'OPD'
    const adpCode = getAdpCodeForReport(reportType)
    const expectedDx = getExpectedDxForReport(reportType)

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: FamilyPlanningCardFilter = params.cardFilter || 'ALL'
    const searchField: FamilyPlanningSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: FamilyPlanningSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fp-report-${reportType}-${patientType}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey(`rcm-fp-adp-mapping-${adpCode}`)
    }

    const { rawRows, adpMapping } = await getCachedData(
      cacheKey,
      async () => {
        let rows: Record<string, unknown>[] = []
        let mappingRes: FamilyPlanningAdpMappingCheck = {
          isMapped: false,
          mappedCount: 0,
          adpCode,
          items: [],
        }

        let fetchedViaNamedApi = false
        if (executor === queryClinicalDb) {
          try {
            const [mRes, gwRes] = await Promise.all([
              checkFamilyPlanningAdpMapping(adpCode, executor),
              apiGateway.clinical.getRcmFundData('family-planning', { ds1, ds2, adpCode, patientType, expectedDx }),
            ])
            mappingRes = mRes
            if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows) && gwRes.data.rawRows.length > 0) {
              rows = gwRes.data.rawRows
              fetchedViaNamedApi = true
            }
          } catch {
            // Fallback
          }
        }

        if (!fetchedViaNamedApi) {
          const [mRes, dbRows] = await Promise.all([
            checkFamilyPlanningAdpMapping(adpCode, executor),
            patientType === 'IPD'
              ? queryIpdRows(ds1, ds2, adpCode, executor, expectedDx)
              : queryOpdRows(ds1, ds2, adpCode, executor, expectedDx),
          ])
          rows = (dbRows || []) as Record<string, unknown>[]
          mappingRes = mRes
        }

        return { rawRows: rows, adpMapping: mappingRes }
      },
      300000 // Cache TTL 5 minutes
    )

    // Separate and filter cases according to the specific objective of each report:
    // - 9.3.1 / 9.3.1.1 (Implant Insertion): Exclude cases that only received removal service (FP002_2 / 71691) without insertion
    // - 9.3.2 / 9.3.1.2 (Implant Removal): Exclude cases that only received insertion service (FP002_1 / FP002 / 20004) without removal
    const isInsertionReport =
      reportType === '9.3.1' || reportType === '9.3.1.1' || adpCode === 'FP002_1'
    const isRemovalReport =
      reportType === '9.3.2' || reportType === '9.3.1.2' || adpCode === 'FP002_2'

    const targetRows = rawRows.filter((r) => {
      const adpStr = [
        String(r.all_adp_codes || ''),
        String(r.adp_list || ''),
        String(r.adpcode || ''),
        String(r.drug || ''),
      ]
        .join(',')
        .toUpperCase()

      const drugStr = String(r.drug || '')
      const isRemovalDrug = /ถอด/i.test(drugStr)
      const isInsertionDrug =
        /implanon|norplant|jadelle|etonogestrel/i.test(drugStr) ||
        (/ฝัง/i.test(drugStr) && !isRemovalDrug)

      const hasInsertionItem =
        /FP002_1|FP002\b|20004/i.test(adpStr) || isInsertionDrug
      const hasRemovalItem =
        /FP002_2|71691/i.test(adpStr) || isRemovalDrug

      if (isInsertionReport) {
        if (hasRemovalItem && !hasInsertionItem) {
          return false
        }
      } else if (isRemovalReport) {
        if (hasInsertionItem && !hasRemovalItem) {
          return false
        }
      }
      return true
    })

    // Map target rows into strongly typed domain items with validation
    let allItems: FamilyPlanningItem[] = targetRows.map((r, idx) => {
      const moneyEclaim = Number(r.money_eclaim || 0)
      const moneyRep = Number(r.money_rep || 0)
      const moneyInvoice = Number(r.money_invoice || 0)
      const compensatedVal = Number(r.compensated || 0)
      const compensated =
        moneyInvoice > 0
          ? moneyInvoice
          : moneyRep > 0
          ? moneyRep
          : moneyEclaim > 0
          ? moneyEclaim
          : compensatedVal
      const isCompensated =
        moneyInvoice > 0 ||
        moneyRep > 0 ||
        compensatedVal > 0 ||
        (Boolean(r.status) && String(r.status).toLowerCase().includes('rep')) ||
        (Boolean(r.rep) && String(r.rep).trim() !== '' && String(r.rep).trim() !== 'null')

      const rawDx = r.dx ?? r.pdx ?? (r.icd10 ? String(r.icd10) : null)
      const dx = rawDx ? String(rawDx).trim() : null
      const rawOp = r.op ?? r.op0 ?? (r.oper ? String(r.oper) : null)
      const op = rawOp ? String(rawOp).trim() : null
      const rawDrug = r.drug ?? r.listname ?? r.drugname
      const drug = rawDrug ? String(rawDrug).trim() : null
      const rawClaimCode = r.claimcode ?? r.authencode
      const claimcode = rawClaimCode ? String(rawClaimCode).trim() : null

      // FoxPro Validation Rules:
      // if(dx regexp '<<expectedDx>>', null, 'ไม่พบ Dx <<expectedDx>>') ErrorDx
      // if(drug<>'', null, 'ไม่พบค่าบริการ') ErrorDrug
      const hasExpectedDx = dx ? new RegExp(expectedDx, 'i').test(dx) : false
      const errorDx = hasExpectedDx ? null : `ไม่พบ Dx ${expectedDx}`
      const errorDrug = drug && drug.length > 0 ? null : 'ไม่พบค่าบริการ'
      const hasError = Boolean(errorDx || errorDrug)

      let rep = r.rep ? String(r.rep).trim() : null
      if (rep === '' || rep === 'null') rep = null

      let status = String(r.status || '').trim()
      if (!status) {
        status = '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
      }

      const rawSex = r.sex ?? (r.sex_code === '1' ? 'ชาย' : r.sex_code === '2' ? 'หญิง' : '—')
      const sex = String(rawSex || '—').trim()

      const pttypename = String(r.pttypename || '—').trim()
      const pttype_eclaim_id = r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null
      const isUc =
        typeof r.isUc === 'boolean'
          ? r.isUc
          : isUcEclaimCode(pttype_eclaim_id) || r.maininscl === 'UCS'

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex,
        age: Number(r.age || 0),
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || '00:00:00'),
        admdate: r.admdate ? String(r.admdate).trim() : null,
        dchdate: r.dchdate ? String(r.dchdate).trim() : null,
        pttypename,
        pttype_eclaim_id,
        isUc,
        claimcode,
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
        errorDrug,
        hasError,
        rep,
        status,
        patientType,
        reportType,
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

    // Compute Overall Summary Metrics (across summaryCohort before card filtering)
    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn).filter(Boolean)).size
    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const eclaimSentCases = summaryCohort.filter(
      (i) => !i.isCompensated && !i.status.includes('ยังไม่ส่ง')
    ).length
    const unsentCases = summaryCohort.filter((i) => i.status.includes('ยังไม่ส่ง')).length
    const compensationRate =
      totalCases > 0 ? Number(((compensatedCases / totalCases) * 100).toFixed(1)) : 0
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)
    const errorDxCount = summaryCohort.filter((i) => Boolean(i.errorDx)).length
    const errorDrugCount = summaryCohort.filter((i) => Boolean(i.errorDrug)).length
    const hasErrorCount = summaryCohort.filter((i) => i.hasError).length
    const withAuthenCount = summaryCohort.filter((i) => Boolean(i.claimcode)).length
    const withoutAuthenCount = totalCases - withAuthenCount
    const authenRate =
      totalCases > 0 ? Number(((withAuthenCount / totalCases) * 100).toFixed(1)) : 0

    const summary: FamilyPlanningSummary = {
      totalCases,
      uniquePatients,
      compensatedCases,
      eclaimSentCases,
      unsentCases,
      compensationRate,
      totalCompensated,
      totalIncome,
      errorDxCount,
      errorDrugCount,
      hasErrorCount,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
    }

    // Apply Interactive Card Filter
    let filteredItems = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filteredItems = filteredItems.filter((i) => i.isCompensated)
    } else if (cardFilter === 'ECLAIM_SENT') {
      filteredItems = filteredItems.filter(
        (i) => !i.isCompensated && !i.status.includes('ยังไม่ส่ง')
      )
    } else if (cardFilter === 'UNSENT') {
      filteredItems = filteredItems.filter((i) => i.status.includes('ยังไม่ส่ง'))
    } else if (cardFilter === 'ERROR_DX') {
      filteredItems = filteredItems.filter((i) => Boolean(i.errorDx))
    } else if (cardFilter === 'ERROR_DRUG') {
      filteredItems = filteredItems.filter((i) => Boolean(i.errorDrug))
    } else if (cardFilter === 'HAS_ERROR') {
      filteredItems = filteredItems.filter((i) => i.hasError)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filteredItems = filteredItems.filter((i) => Boolean(i.claimcode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filteredItems = filteredItems.filter((i) => !i.claimcode)
    }

    // Apply Search Filter
    if (search) {
      filteredItems = filteredItems.filter((item) => {
        if (searchField === 'HN') return item.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return item.cid.includes(search)
        if (searchField === 'PTNAME') return item.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') {
          return item.vn.toLowerCase().includes(search) || (item.an && item.an.toLowerCase().includes(search))
        }
        if (searchField === 'PTTYPE') return item.pttypename.toLowerCase().includes(search)
        if (searchField === 'DEPARTMENT') {
          return (
            (item.department || '').toLowerCase().includes(search) ||
            (item.clinic || '').toLowerCase().includes(search)
          )
        }
        if (searchField === 'CLINIC') return (item.clinic || '').toLowerCase().includes(search)
        if (searchField === 'DX') return (item.dx || '').toLowerCase().includes(search)
        if (searchField === 'DRUG') return (item.drug || '').toLowerCase().includes(search)

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
      reportType,
      patientType,
      adpCode,
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
    }
  }

  /**
   * Execute OPD SQL Query for Family Planning (9.3.1 / 9.3.2).
   */
export async function queryOpdRows(
    ds1: string,
    ds2: string,
    adpCode: string,
    executor: QueryExecutor,
    expectedDx: string = 'Z308'
  ): Promise<any[]> {
    try {
      const adpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      const sql = `
        SELECT 
          o.vn,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS claimcode,
          dep.department AS department,
          spc.name AS clinic,
          s.cc AS cc,
          IFNULL(v.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${adpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          COALESCE(e.income, 0) AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(n.rep, r.rep, IF(m.status = '4', m.rep, NULL), '') AS rep,
          CASE
            WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT vn FROM (
            SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND icd10 REGEXP ?
            UNION
            SELECT oo.vn 
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND IFNULL(oo.vn, '') <> ''
              AND ${adpMatchExpr}
          ) u
        ) t
        JOIN ovst o ON o.vn = t.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN opitemrece oo ON oo.vn = o.vn
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
        LEFT JOIN visit_pttype vt ON vt.vn = o.vn
        LEFT JOIN (
          SELECT e.opdseq AS vn,
                 SUM(COALESCE(cc.totpay1, 0)) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '1'
            AND e.dateadm BETWEEN ? AND ?
            AND (cc.code LIKE ? OR cc.code LIKE 'FP003%' OR cc.code LIKE 'FP002%')
          GROUP BY e.opdseq
        ) e ON e.vn = o.vn
        LEFT JOIN (
          SELECT vn,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'OP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'OP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY vn
        ) n ON n.vn = o.vn
        LEFT JOIN (
          SELECT m.opdseq AS vn,
                 MAX(m.eclaim_no) AS eclaim_no,
                 SUBSTRING_INDEX(GROUP_CONCAT(IF(m.status = '4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '1'
            AND m.opdseq IS NOT NULL
            AND m.dateadm BETWEEN ? AND ?
          GROUP BY m.opdseq
        ) m ON m.vn = o.vn
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `

      const codePattern = `${adpCode}%`
      return await executor(
        sql,
        [adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode, ds1, ds2, codePattern, ds1, ds2],
        { timeoutMs: 90000 }
      )
    } catch (primaryErr) {
      const adpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      // Graceful fallback without eclaimdb/rcmdb joins if cross-db schemas differ
      const fallbackSql = `
        SELECT 
          o.vn,
          IFNULL(pt.cid, '') AS cid,
          o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          NULL AS claimcode,
          dep.department AS department,
          spc.name AS clinic,
          s.cc AS cc,
          IFNULL(v.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${adpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT DISTINCT vn FROM (
            SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND icd10 REGEXP ?
            UNION
            SELECT oo.vn 
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND IFNULL(oo.vn, '') <> ''
              AND ${adpMatchExpr}
          ) u
        ) t
        JOIN ovst o ON o.vn = t.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN opitemrece oo ON oo.vn = o.vn
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `
      return await executor(fallbackSql, [adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode], { timeoutMs: 60000 })
    }
  }

  /**
   * Execute IPD SQL Query for Family Planning (9.3.1 / 9.3.2).
   */
export async function queryIpdRows(
    ds1: string,
    ds2: string,
    adpCode: string,
    executor: QueryExecutor,
    expectedDx: string = 'Z308'
  ): Promise<any[]> {
    try {
      const ipdAdpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_1' AND TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_2' AND TRIM(d.nhso_adp_code) = '71691')`
          : `(TRIM(d.nhso_adp_code) = ? OR (? IN ('FP003_1', 'FP003_2', 'FP003_3', 'FP003_4') AND TRIM(d.nhso_adp_code) IN ('20003','71681','71682','FP003_1','FP003_2','FP003_3','FP003_4')))`

      const ipdSubqueryAdpExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      const sql = `
        SELECT 
          i.an AS vn,
          i.an,
          IFNULL(pt.cid, '') AS cid,
          i.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS claimcode,
          w.name AS department,
          spc.name AS clinic,
          '' AS cc,
          IFNULL(a.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${ipdAdpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          COALESCE(e.income, 0) AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(n.rep, r.rep, IF(m.status = '4', m.rep, NULL), '') AS rep,
          CASE
            WHEN n.an IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.an IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT an FROM (
            SELECT i.an FROM ipt i JOIN iptdiag dx ON dx.an = i.an WHERE i.dchdate BETWEEN ? AND ? AND dx.icd10 REGEXP ?
            UNION
            SELECT oo.an 
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND IFNULL(oo.an, '') <> ''
              AND ${ipdSubqueryAdpExpr}
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
        LEFT JOIN rcmdb.authencode cc ON cc.vn = i.an
        LEFT JOIN visit_pttype vt ON vt.vn = i.an
        LEFT JOIN (
          SELECT e.an,
                 SUM(COALESCE(cc.totpay1, 0)) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '2'
            AND e.datedsc BETWEEN ? AND ?
            AND (cc.code LIKE ? OR cc.code LIKE 'FP003%' OR cc.code LIKE 'FP002%' OR cc.code LIKE 'FP001%')
          GROUP BY e.an
        ) e ON e.an = i.an
        LEFT JOIN (
          SELECT an,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'IP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY an
        ) r ON r.an = i.an
        LEFT JOIN (
          SELECT an,
                 SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'IP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY an
        ) n ON n.an = i.an
        LEFT JOIN (
          SELECT m.an,
                 MAX(m.eclaim_no) AS eclaim_no,
                 SUBSTRING_INDEX(GROUP_CONCAT(IF(m.status = '4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '2'
            AND m.an IS NOT NULL
            AND m.datedsc BETWEEN ? AND ?
          GROUP BY m.an
        ) m ON m.an = i.an
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        GROUP BY i.an
        ORDER BY i.dchdate DESC, i.regdate DESC;
      `

      const codePattern = `${adpCode}%`
      return await executor(
        sql,
        [adpCode, adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode, ds1, ds2, codePattern, ds1, ds2],
        { timeoutMs: 90000 }
      )
    } catch (primaryErr) {
      const ipdAdpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_1' AND TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_2' AND TRIM(d.nhso_adp_code) = '71691')`
          : `(TRIM(d.nhso_adp_code) = ? OR (? IN ('FP003_1', 'FP003_2', 'FP003_3', 'FP003_4') AND TRIM(d.nhso_adp_code) IN ('20003','71681','71682','FP003_1','FP003_2','FP003_3','FP003_4')))`

      const ipdSubqueryAdpExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      // Fallback without cross-db joins
      const fallbackSql = `
        SELECT 
          i.an AS vn,
          i.an,
          IFNULL(pt.cid, '') AS cid,
          i.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          NULL AS claimcode,
          w.name AS department,
          spc.name AS clinic,
          '' AS cc,
          IFNULL(a.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${ipdAdpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT DISTINCT an FROM (
            SELECT i.an FROM ipt i JOIN iptdiag dx ON dx.an = i.an WHERE i.dchdate BETWEEN ? AND ? AND dx.icd10 REGEXP ?
            UNION
            SELECT oo.an 
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND IFNULL(oo.an, '') <> ''
              AND ${ipdSubqueryAdpExpr}
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
        ORDER BY i.dchdate DESC, i.regdate DESC;
      `
      return await executor(fallbackSql, [adpCode, adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode], { timeoutMs: 60000 })
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ── 9.2 บริการใส่ห่วงอนามัย (IUD Insertion Service) ──────────────────────────
