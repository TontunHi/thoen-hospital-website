import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange } from '../rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  resolveSeamlessFetcher,
  type RcmFundGatewayAdapter,
} from '../rcmFundGatewayHelper'
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

import { checkFamilyPlanningAdpMapping } from './service91Report'

  /**
   * 9.3 Family Planning (ฝังยาคุม / ถอดยาคุม) report implementation.
   */
export async function getFamilyPlanning93Report(
    params: FamilyPlanningReportParams = {},
    gateway: RcmFundGatewayAdapter = defaultRcmFundGateway
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
        const [mRes, gwRes] = await Promise.all([
          checkFamilyPlanningAdpMapping(adpCode, gateway),
          gateway.getRcmFundData('family-planning-93', { ds1, ds2, adpCode, patientType, expectedDx }),
        ])
        return {
          rawRows: extractFundRawRows<Record<string, unknown>>(gwRes),
          adpMapping: mRes,
        }
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
    allItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      resolveSeamlessFetcher(gateway),
      Boolean(params.refresh)
    )
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

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

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

    if (selectedReps.length > 0) {
      filteredItems = filteredItems.filter((i) => matchesRepFilter(i, selectedReps))
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
      repBreakdown,
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ── 9.2 บริการใส่ห่วงอนามัย (IUD Insertion Service) ──────────────────────────
