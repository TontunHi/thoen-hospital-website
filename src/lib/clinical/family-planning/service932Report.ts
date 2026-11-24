import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import { buildRepBreakdownSummary, matchesRepFilter, parseRepFilterParam } from '../rcmRepTagHelper'
import {
  defaultFpV2Gateway,
  type FamilyPlanningV2GatewayAdapter,
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

export async function checkFamilyPlanning932AdpMapping(
  format: FamilyPlanning932Format = 'NEW_ECLAIM',
  gateway: Partial<FamilyPlanningV2GatewayAdapter> = {}
): Promise<FamilyPlanning932AdpMappingCheck> {
  const gw = { ...defaultFpV2Gateway, ...gateway }
  const adpCodes = format === 'KRUNGTHAI' ? ['20003', '20004'] : ['FP001', 'FP002']
  const cacheKey = `rcm-fp-932-adp-mapping-${format}`

  return await getCachedData(
    cacheKey,
    async () => {
      try {
        return await gw.getFp932AdpMapping(format)
      } catch {
        return { isMapped: true, mappedCount: 0, adpCodes, items: [] }
      }
    },
    86400000
  )
}

export async function getFamilyPlanning932Report(
  params: FamilyPlanning932Params = {},
  gateway: Partial<FamilyPlanningV2GatewayAdapter> = {}
): Promise<FamilyPlanning932ReportResult> {
  const gw = { ...defaultFpV2Gateway, ...gateway }
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
    async () =>
      gw.getFp932Raw({
        startDate: ds1,
        endDate: ds2,
        format,
        refresh: Boolean(params.refresh),
      }),
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
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, gw.seamlessFetcher, Boolean(params.refresh))
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

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

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

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
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
      repBreakdown,
    }
  }
