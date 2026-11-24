import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange } from '../rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  fetchAdpMappingViaGateway,
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

import { getFamilyPlanning93Report } from './service93Report'

export interface FamilyPlanningGatewayAdapter extends RcmFundGatewayAdapter {
  getFamilyPlanning91AdpMapping?: (format: 'NEW_ECLAIM' | 'KRUNGTHAI') => Promise<{
    isMapped: boolean
    mappedCount: number
    format?: string
    items: Array<Record<string, any>>
  }>
}

const defaultFpGateway: FamilyPlanningGatewayAdapter = {
  ...defaultRcmFundGateway,
  getFamilyPlanning91AdpMapping: (format) => apiGateway.clinical.getFamilyPlanning91AdpMapping(format),
}

  /**
   * Check whether relevant ADP codes are mapped in HOSxP `s_drugitems` table (for 9.1) via API Gateway.
   */
export async function checkAdpMapping(
    format: 'NEW_ECLAIM' | 'KRUNGTHAI' = 'NEW_ECLAIM',
    gateway: FamilyPlanningGatewayAdapter = defaultFpGateway
  ): Promise<any> {
    const cacheKey = `rcm-fp-adp-mapping-${format}`
    return getCachedData(
      cacheKey,
      async () => {
        try {
          const gwRes = gateway.getFamilyPlanning91AdpMapping
            ? await gateway.getFamilyPlanning91AdpMapping(format)
            : await gateway.getAdpMapping(format)
          const items = (gwRes?.items || []).map((r: any) => ({
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
   * Check if the specific ADP code ('FP002_1' or 'FP002_2') is mapped in s_drugitems (for 9.3) via API Gateway.
   */
export async function checkFamilyPlanningAdpMapping(
    adpCode: string,
    gateway: RcmFundGatewayAdapter = defaultFpGateway
  ): Promise<FamilyPlanningAdpMappingCheck> {
    const cacheKey = `rcm-fp-adp-mapping-${adpCode}`
    return getCachedData(
      cacheKey,
      () => fetchAdpMappingViaGateway(adpCode, gateway),
      600000 // Cache TTL 10 minutes
    )
  }

  /**
   * Universal dispatch for Family Planning reports:
   * Dispatches to 9.3 when reportType is specified, otherwise 9.1.
   */
export async function getFamilyPlanningReport(
    params: any = {},
    gateway: FamilyPlanningGatewayAdapter = defaultFpGateway
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
      return getFamilyPlanning93Report(params, gateway)
    }
    return getFamilyPlanning91Report(params, gateway)
  }

  /**
   * 9.1 Family Planning report implementation via API Gateway.
   */
export async function getFamilyPlanning91Report(
    params: any = {},
    gateway: FamilyPlanningGatewayAdapter = defaultFpGateway
  ): Promise<any> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const format = params.format || 'NEW_ECLAIM'

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
      checkAdpMapping(format, gateway),
      getCachedData(
        cacheKey,
        async () => {
          const gwRes = await gateway.getRcmFundData('family-planning-91', { ds1, ds2, format })
          return extractFundRawRows(gwRes)
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
    allItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      resolveSeamlessFetcher(gateway, defaultFpGateway),
      Boolean(params.refresh)
    )
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
