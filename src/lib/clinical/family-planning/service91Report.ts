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

import { getFamilyPlanning93Report } from './service93Report'

  /**
   * Check whether relevant ADP codes are mapped in HOSxP `s_drugitems` table (for 9.1).
   */
export async function checkAdpMapping(
    format: 'NEW_ECLAIM' | 'KRUNGTHAI' = 'NEW_ECLAIM',
    executor: QueryExecutor = queryClinicalDb
  ): Promise<any> {
    const codes =
      format === 'KRUNGTHAI'
        ? KRUNGTHAI_ADP_CODES
        : NEW_ECLAIM_ADP_CODES

    const cacheKey = `rcm-fp-adp-mapping-${format}`
    return getCachedData(
      cacheKey,
      async () => {
        try {
          const placeholders = codes.map(() => '?').join(', ')
          const sql = `
            SELECT icode, name, strength, nhso_adp_code
            FROM s_drugitems 
            WHERE TRIM(nhso_adp_code) IN (${placeholders})
            ORDER BY nhso_adp_code ASC, icode ASC;
          `
          const rows = (await executor(sql, codes, { timeoutMs: 15000 })) as any[]
          const items = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))

          return {
            isMapped: items.length > 0,
            mappedCount: items.length,
            format,
            items,
          }
        } catch {
          return {
            isMapped: false,
            mappedCount: 0,
            format,
            items: [],
          }
        }
      },
      600000
    )
  }

  /**
   * Check if the specific ADP code ('FP002_1' or 'FP002_2') is mapped in s_drugitems (for 9.3).
   */
export async function checkFamilyPlanningAdpMapping(
    adpCode: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<FamilyPlanningAdpMappingCheck> {
    const cacheKey = `rcm-fp-adp-mapping-${adpCode}`
    return getCachedData(
      cacheKey,
      async () => {
        if (executor === queryClinicalDb) {
          try {
            const gwRes = await apiGateway.clinical.getAdpMapping(adpCode)
            if (gwRes && typeof gwRes.isMapped === 'boolean') {
              return {
                isMapped: gwRes.isMapped,
                mappedCount: gwRes.mappedCount,
                adpCode,
                items: (gwRes.items || []).map((r: any) => ({
                  icode: String(r.icode || '').trim(),
                  name: String(r.name || '').trim(),
                  strength: r.strength ? String(r.strength).trim() : null,
                  nhso_adp_code: String(r.nhso_adp_code || '').trim(),
                })),
              }
            }
          } catch {
            // Fallback
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
          const items: FamilyPlanningAdpMappingItem[] = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))

          return {
            isMapped: items.length > 0,
            mappedCount: items.length,
            adpCode,
            items,
          }
        } catch {
          return {
            isMapped: false,
            mappedCount: 0,
            adpCode,
            items: [],
          }
        }
      },
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Universal dispatch for Family Planning reports:
   * Dispatches to 9.3 when reportType is specified, otherwise 9.1.
   */
export async function getFamilyPlanningReport(
    params: any = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<any> {
    if (
      params.reportType === '9.3.1' ||
      params.reportType === '9.3.2' ||
      params.reportType === '9.3.1.1' ||
      params.reportType === '9.3.1.2' ||
      params.reportType === '9.4' ||
      params.reportType === '9.3.4' ||
      params.reportType === '9.5' ||
      params.reportType === '9.3.5' ||
      params.reportType === '9.6' ||
      params.reportType === '9.3.6' ||
      params.reportType === '9.7' ||
      params.reportType === '9.3.7'
    ) {
      return getFamilyPlanning93Report(params, executor)
    }
    return getFamilyPlanning91Report(params, executor)
  }

  /**
   * 9.1 Family Planning report implementation.
   */
export async function getFamilyPlanning91Report(
    params: any = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<any> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const format = params.format || 'NEW_ECLAIM'
    const adpCodes =
      format === 'KRUNGTHAI'
        ? KRUNGTHAI_ADP_CODES
        : NEW_ECLAIM_ADP_CODES
    const adpPlaceholders = adpCodes.map(() => '?').join(', ')

    const serviceOnly = Boolean(params.serviceOnly)
    const statusParam = (params.status || 'ALL').trim()
    const errorFilterParam = (params.errorFilter || 'ALL').trim()
    const cardFilter = params.cardFilter || 'ALL'
    const searchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy = params.sortBy || 'vstdate'
    const sortOrder = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fp-9-1-${format}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const [adpMapping, rawRows] = await Promise.all([
      checkAdpMapping(format, executor),
      getCachedData(
        cacheKey,
        async () => {
          const sql = `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
              TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              s.cc,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              ptt.name AS pttypename,
              ptt.pttype_eclaim_id,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              IFNULL(dx.icd10, '') AS icd10,
              dx.op,
              IFNULL(v.income, 0) AS income,
              doc.name AS doctorname,
              IFNULL(fp.name, '') AS listname,
              d.drugname,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-::ยังไม่ได้ส่ง') AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
              rep.TransactionType,
              nhso.resource,
              COALESCE(rep.fund, nhso.fund) AS fund,
              COALESCE(rep.subfund, nhso.subfund) AS subfund,
              rep.remark,
              rep.projectcode
            FROM (
              SELECT DISTINCT vn FROM (
                SELECT vn 
                FROM ovstdiag 
                WHERE vstdate BETWEEN ? AND ? 
                  AND icd10 REGEXP 'Z30' 
                  AND icd10 <> 'Z302'
                UNION
                SELECT oo.vn
                FROM s_drugitems d
                JOIN opitemrece oo ON oo.icode = d.icode
                WHERE TRIM(d.nhso_adp_code) IN (${adpPlaceholders})
                  AND oo.vstdate BETWEEN ? AND ? 
                  AND IFNULL(oo.vn, '') <> ''
                UNION
                SELECT oo.vn
                FROM opitemrece oo
                JOIN s_drugitems d ON d.icode = oo.icode
                LEFT JOIN income inc ON inc.income = oo.income
                WHERE oo.vstdate BETWEEN ? AND ?
                  AND IFNULL(oo.vn, '') <> ''
                  AND (d.name REGEXP 'norplant|คุมกำเนิด' OR d.drugcategory REGEXP 'FP|CONTRACEPTIVE|CONTRACEPTION')
                  AND d.name NOT REGEXP 'condom|ถุงยางอนามัย'
                  AND inc.group2 IN (3, 4, 5)
                  AND oo.qty > 0
              ) u
            ) t
            JOIN ovst o ON o.vn = t.vn
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN opdscreen s ON s.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN doctor doc ON doc.code = o.doctor
            LEFT JOIN (
              SELECT 
                oo.vn,
                GROUP_CONCAT(DISTINCT CONCAT_WS(':', d.nhso_adp_code, CONCAT(d.name, ' ', IFNULL(d.strength, ''))) SEPARATOR ', ') AS name
              FROM s_drugitems d
              JOIN opitemrece oo ON oo.icode = d.icode
              WHERE TRIM(d.nhso_adp_code) IN (${adpPlaceholders})
                AND oo.vstdate BETWEEN ? AND ?
              GROUP BY oo.vn
            ) fp ON fp.vn = o.vn
            LEFT JOIN (
              SELECT 
                oo.vn,
                GROUP_CONCAT(DISTINCT CONCAT(d.name, '#', oo.qty) SEPARATOR ', ') AS drugname
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              LEFT JOIN income inc ON inc.income = oo.income
              WHERE oo.vstdate BETWEEN ? AND ?
                AND IFNULL(oo.vn, '') <> ''
                AND (d.name REGEXP 'norplant|คุมกำเนิด' OR d.drugcategory REGEXP 'FP|CONTRACEPTIVE|CONTRACEPTION')
                AND d.name NOT REGEXP 'condom|ถุงยางอนามัย'
                AND inc.group2 IN (3, 4, 5)
                AND oo.qty > 0
              GROUP BY oo.vn
            ) d ON d.vn = o.vn
            LEFT JOIN (
              SELECT vn,
                     GROUP_CONCAT(DISTINCT IF(icd10 REGEXP '^[0-9]', NULL, icd10) SEPARATOR ', ') AS icd10,
                     GROUP_CONCAT(DISTINCT IF(icd10 REGEXP '^697|^992', icd10, NULL) SEPARATOR ', ') AS op
              FROM ovstdiag
              WHERE vstdate BETWEEN ? AND ?
                AND (
                  (icd10 REGEXP 'Z30' AND icd10 <> 'Z302')
                  OR icd10 REGEXP '^697|^992'
                )
              GROUP BY vn
            ) dx ON dx.vn = o.vn
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype vt ON vt.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     MAX(resource) AS resource, MAX(fund) AS fund, MAX(subfund) AS subfund,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND admdate >= DATE_SUB(?, INTERVAL 1 DAY) AND admdate < DATE_ADD(?, INTERVAL 2 DAY)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     MAX(TransactionType) AS TransactionType, MAX(fund) AS fund, MAX(subfund) AS subfund,
                     MAX(remark) AS remark, MAX(projectcode) AS projectcode,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND admdate >= DATE_SUB(?, INTERVAL 1 DAY) AND admdate < DATE_ADD(?, INTERVAL 2 DAY)
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
              WHERE m.person_type = '1'
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            GROUP BY o.vn
            ORDER BY o.vstdate DESC, o.vsttime DESC
          `
          const queryParams = [
            ds1,
            ds2,
            ...adpCodes,
            ds1,
            ds2,
            ds1,
            ds2,
            ...adpCodes,
            ds1,
            ds2,
            ds1,
            ds2,
            ds1,
            ds2,
            ds1,
            ds2,
            ds1,
            ds2,
          ]
          return (await executor(sql, queryParams, { timeoutMs: 45000 })) as any[]
        },
        300000
      ),
    ])

    let allItems = (rawRows || []).map((r: any, idx: number) => {
      const listname = r.listname ? String(r.listname).trim() : null
      const drugname = r.drugname ? String(r.drugname).trim() : null
      const icd10 = r.icd10 ? String(r.icd10).trim() : null
      const op = r.op ? String(r.op).trim() : null
      const hasFp = Boolean(listname && listname.length > 0)
      const hasDx = Boolean(icd10 && icd10.length > 0)
      const hasDrug = Boolean(drugname && drugname.length > 0)
      const errorname = evaluateFamilyPlanningDiscrepancy(hasFp, hasDx, hasDrug, listname, op)
      const hasError = Boolean(errorname)
      const hasService = hasFp
      const authencode = r.authencode ? String(r.authencode).trim() : null
      const hasAuthen = Boolean(authencode && authencode.length > 0)
      const compensated = Number(r.compensated || 0)
      const pttypeEclaimId = r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null
      const isUc = isUcEclaimCode(pttypeEclaimId)

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        cid: String(r.cid || '').trim(),
        hn: String(r.hn || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: String(r.sex || '—').trim(),
        age: r.age != null ? Number(r.age) : null,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || '00:00:00'),
        cc: r.cc ? String(r.cc).trim() : null,
        authencode,
        pttypename: r.pttypename ? String(r.pttypename).trim() : null,
        pttype_eclaim_id: pttypeEclaimId,
        isUc,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 || null,
        dx1: r.dx1 || null,
        dx2: r.dx2 || null,
        dx3: r.dx3 || null,
        dx4: r.dx4 || null,
        dx5: r.dx5 || null,
        op0: r.op0 || null,
        op1: r.op1 || null,
        op2: r.op2 || null,
        op3: r.op3 || null,
        op4: r.op4 || null,
        op5: r.op5 || null,
        icd10,
        diag: icd10,
        op,
        oper: op,
        income: Number(r.income || 0),
        doctorname: r.doctorname ? String(r.doctorname).trim() : null,
        listname,
        drugname,
        status: String(r.status || '-::ยังไม่ได้ส่ง').trim(),
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        errorname,
        fund: r.fund || null,
        subfund: r.subfund || null,
        hasService,
        hasAuthen,
        hasError,
      }
    })

    // Dual-mode pttype filter (pttypes takes precedence over ucOnly)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, executor, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i: any) => matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id))
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i: any) => i.isUc)
    }

    const totalVisits = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i: any) => i.hn)).size
    const serviceOnlyCount = summaryCohort.filter((i: any) => i.hasService).length
    const compensatedVisits = summaryCohort.filter((i: any) => i.compensated > 0).length
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const totalCompensated = summaryCohort.reduce((acc: number, i: any) => acc + i.compensated, 0)
    const totalIncome = summaryCohort.reduce((acc: number, i: any) => acc + i.income, 0)
    const errorCount = summaryCohort.filter((i: any) => i.hasError).length
    const authenCount = summaryCohort.filter((i: any) => i.hasAuthen).length
    const noAuthenCount = totalVisits - authenCount
    const withDxCount = summaryCohort.filter((i: any) => Boolean(i.icd10)).length
    const withDrugCount = summaryCohort.filter((i: any) => Boolean(i.drugname)).length

    const summary = {
      totalVisits,
      uniquePatients,
      serviceOnlyCount,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated:
        compensatedVisits > 0 ? Math.round(totalCompensated / compensatedVisits) : 0,
      errorCount,
      authenCount,
      noAuthenCount,
      withDxCount,
      withDrugCount,
      totalIncome,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    let filtered = summaryCohort
    if (serviceOnly) {
      filtered = filtered.filter((i: any) => i.hasService)
    }
    if (statusParam && statusParam !== 'ALL' && statusParam !== 'ทั้งหมด') {
      filtered = filtered.filter((i: any) => i.status === statusParam)
    }
    if (errorFilterParam && errorFilterParam !== 'ALL') {
      if (errorFilterParam === 'HAS_ERROR') {
        filtered = filtered.filter((i: any) => i.hasError)
      } else if (errorFilterParam === 'NO_ERROR') {
        filtered = filtered.filter((i: any) => !i.hasError)
      } else {
        filtered = filtered.filter((i: any) => i.errorname === errorFilterParam)
      }
    }
    if (cardFilter === 'SERVICE_ONLY') {
      filtered = filtered.filter((i: any) => i.hasService)
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i: any) => i.compensated > 0)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i: any) => i.compensated <= 0)
    } else if (cardFilter === 'HAS_ERROR') {
      filtered = filtered.filter((i: any) => i.hasError)
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i: any) => !i.hasAuthen)
    }

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i: any) => matchesRepFilter(i, selectedReps))
    }

    if (search.length > 0) {
      filtered = filtered.filter(
        (i: any) =>
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.drugname && i.drugname.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search)) ||
          (i.errorname && i.errorname.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.icd10 && i.icd10.toLowerCase().includes(search)) ||
          (i.doctorname && i.doctorname.toLowerCase().includes(search)) ||
          (i.pttypename && i.pttypename.toLowerCase().includes(search))
      )
    }

    // Apply Sorting
    filtered.sort((a: any, b: any) => {
      let valA: string | number = a[sortBy] ?? ''
      let valB: string | number = b[sortBy] ?? ''

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const items = exportAll
      ? filtered.map((item: any, idx: number) => ({ ...item, no: idx + 1 }))
      : filtered
          .slice((page - 1) * pageSize, page * pageSize)
          .map((item: any, idx: number) => ({ ...item, no: (page - 1) * pageSize + idx + 1 }))

    return {
      ds1,
      ds2,
      format,
      serviceOnly,
      status: statusParam,
      cardFilter,
      searchField,
      search,
      sortBy,
      sortOrder,
      summary,
      adpMapping,
      statusOptions: Array.from(new Set(allItems.map((i: any) => i.status))).sort(),
      errorOptions: Array.from(
        new Set(allItems.map((i: any) => i.errorname).filter(Boolean) as string[])
      ).sort(),
      totalCount,
      page,
      pageSize,
      totalPages,
      items,
      repBreakdown,
    }
  }
