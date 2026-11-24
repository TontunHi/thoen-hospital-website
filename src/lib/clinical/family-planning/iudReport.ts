import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import { buildRepBreakdownSummary, matchesRepFilter, parseRepFilterParam } from '../rcmRepTagHelper'
import {
  IUD_ADP_CODES,
  defaultFpV2Gateway,
  type FamilyPlanningV2GatewayAdapter,
  type IudPatientType,
  type IudCardFilter,
  type IudSearchField,
  type IudSortField,
  type IudReportParams,
  type IudAdpMappingCheck,
  type IudItem,
  type IudSummary,
  type IudReportResult,
} from './typesAndHelpers'

export async function checkIudAdpMapping(
  gateway: Partial<FamilyPlanningV2GatewayAdapter> = {}
): Promise<IudAdpMappingCheck> {
  const gw = { ...defaultFpV2Gateway, ...gateway }
  const cacheKey = 'rcm-fp-9-2-iud-adp-mapping'
  return getCachedData(
    cacheKey,
    async () => {
      try {
        return await gw.getFpIudAdpMapping()
      } catch {
        return { isMapped: false, mappedCount: 0, adpCodes: IUD_ADP_CODES, items: [] }
      }
    },
    600000
  )
}

export async function getIudReport(
  params: IudReportParams = {},
  gateway: Partial<FamilyPlanningV2GatewayAdapter> = {}
): Promise<IudReportResult> {
  const gw = { ...defaultFpV2Gateway, ...gateway }
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
    async () =>
      gw.getFpIudRaw({
        startDate: ds1,
        endDate: ds2,
        patientType,
        refresh: Boolean(params.refresh),
      }),
    300000
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
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, gw.seamlessFetcher, Boolean(params.refresh))
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
