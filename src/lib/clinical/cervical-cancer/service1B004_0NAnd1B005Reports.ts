import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import { buildRepBreakdownSummary, matchesRepFilter, parseRepFilterParam } from '../rcmRepTagHelper'
import {
  compareService1B004NItems,
  defaultCcsGateway,
  type CcsGatewayAdapter,
  type CcsAdpMappingCheck,
  type CcsService1B004_0NParams,
  type CcsService1B004_0NResult,
  type CcsService1B004_0NItem,
  type CcsService1B004_0NSummary,
  type CcsService1B004_0NCompensationFilter,
  type CcsService1B004_0NSearchField,
  type CcsService1B004_0NSortField,
  type CcsService1B005Params,
  type CcsService1B005Result,
  type CcsService1B005Item,
  type CcsService1B005Summary,
  type CcsService1B005CompensationFilter,
  type CcsService1B005SearchField,
  type CcsService1B005SortField,
} from './typesAndHelpers'

export async function check1B004_0NAdpMapping(
  gateway: Partial<CcsGatewayAdapter> = {}
): Promise<CcsAdpMappingCheck> {
  const gw = { ...defaultCcsGateway, ...gateway }
  try {
    return await gw.getCcsAdpMapping('1B004_0N')
  } catch {
    return { isMapped: false, mappedCount: 0, items: [] }
  }
}

export async function getService1B004_0NReport(
  params: CcsService1B004_0NParams = {},
  gateway: Partial<CcsGatewayAdapter> = {}
): Promise<CcsService1B004_0NResult> {
  const gw = { ...defaultCcsGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const compensationFilter: CcsService1B004_0NCompensationFilter = params.compensationFilter || 'ALL'
  const searchField: CcsService1B004_0NSearchField = params.searchField || 'ALL'
  const search = (params.search || '').trim().toLowerCase()
  const sortBy: CcsService1B004_0NSortField = params.sortBy || 'vstdate'
  const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
  const page = Math.max(1, Number(params.page || 1))
  const pageSize = Math.max(1, Number(params.pageSize || 50))
  const exportAll = Boolean(params.exportAll)

  const cacheKey = `rcm-ccs-p5-1b004-0n-${ds1}-${ds2}`
  if (params.refresh) {
    invalidateCacheKey(cacheKey)
  }

  const { rawRows, adpMapping } = await getCachedData(
    cacheKey,
    async () =>
      gw.getCcsServiceRaw('1B004_0N', {
        startDate: ds1,
        endDate: ds2,
        refresh: Boolean(params.refresh),
      }),
    600
  )

    const allItems: CcsService1B004_0NItem[] = rawRows.map((r, idx) => {
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
        listname: r.listname ? String(r.listname).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated,
        isCompensated: compensated > 0,
      }
    })

    const uniquePatients = new Set(allItems.map((i) => i.hn).filter(Boolean)).size
    let compensatedVisits = 0
    let uncompensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withoutAuthenCount = 0
    let withPdxCount = 0
    let withOpCount = 0

    for (const item of allItems) {
      if (item.compensated > 0) {
        compensatedVisits++
        totalCompensated += item.compensated
      } else {
        uncompensatedVisits++
      }

      if (item.authencode) {
        withAuthenCount++
      } else {
        withoutAuthenCount++
      }

      if (item.pdx) {
        withPdxCount++
      }

      if (item.op0 || item.op1 || item.op2 || item.op3 || item.op4 || item.op5) {
        withOpCount++
      }
    }

    const totalVisits = allItems.length
    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0

    const summary: CcsService1B004_0NSummary = {
      totalVisits,
      uniquePatients,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      averageCompensated,
      withAuthenCount,
      withoutAuthenCount,
      withPdxCount,
      withOpCount,
    }

    let filtered = await enrichItemsWithSeamlessCache(
      cacheKey,
      allItems,
      gw.seamlessFetcher,
      Boolean(params.refresh)
    )
    const repBreakdown = buildRepBreakdownSummary(filtered)
    const selectedReps = parseRepFilterParam(params.reps)

    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.compensated > 0)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => i.compensated <= 0)
    } else if (compensationFilter === 'HAS_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (compensationFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') {
          return i.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          return i.cid.includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return i.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return i.vn.toLowerCase().includes(search)
        }
        if (searchField === 'DIAG') {
          return [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5]
            .filter(Boolean)
            .some((dx) => dx!.toLowerCase().includes(search))
        }
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.status && i.status.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search))
        )
      })
    }

    const sorted = [...filtered].sort((a, b) => compareService1B004NItems(a, b, sortBy, sortOrder))

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
      adpMapping,
      compensationFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
      repBreakdown,
    }
  }

export async function check1B005AdpMapping(
  gateway: Partial<CcsGatewayAdapter> = {}
): Promise<CcsAdpMappingCheck> {
  const gw = { ...defaultCcsGateway, ...gateway }
  try {
    return await gw.getCcsAdpMapping('1B005')
  } catch {
    return { isMapped: false, mappedCount: 0, items: [] }
  }
}

export async function getService1B005Report(
  params: CcsService1B005Params = {},
  gateway: Partial<CcsGatewayAdapter> = {}
): Promise<CcsService1B005Result> {
  const gw = { ...defaultCcsGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const compensationFilter: CcsService1B005CompensationFilter = params.compensationFilter || 'ALL'
  const searchField: CcsService1B005SearchField = params.searchField || 'ALL'
  const search = (params.search || '').trim().toLowerCase()
  const sortBy: CcsService1B005SortField = params.sortBy || 'vstdate'
  const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
  const page = Math.max(1, Number(params.page || 1))
  const pageSize = Math.max(1, Number(params.pageSize || 50))
  const exportAll = Boolean(params.exportAll)

  const cacheKey = `rcm-ccs-p10-1b005-${ds1}-${ds2}`
  if (params.refresh) {
    invalidateCacheKey(cacheKey)
  }

  const { rawRows, adpMapping } = await getCachedData(
    cacheKey,
    async () =>
      gw.getCcsServiceRaw('1B005', {
        startDate: ds1,
        endDate: ds2,
        refresh: Boolean(params.refresh),
      }),
    600
  )

  const allMappedItems: CcsService1B005Item[] = await enrichItemsWithSeamlessCache(
    cacheKey,
    rawRows.map((row, idx) => {
      const compVal = Number(row.compensated || 0)
      return {
        no: idx + 1,
        vn: String(row.vn || ''),
        cid: String(row.cid || ''),
        hn: String(row.hn || ''),
        ptname: String(row.ptname || ''),
        age: row.age !== null && row.age !== undefined ? Number(row.age) : null,
        nation: row.nation ? String(row.nation) : null,
        vstdate: String(row.vstdate || ''),
        vsttime: String(row.vsttime || ''),
        authencode: row.authencode ? String(row.authencode) : null,
        pttypename: row.pttypename ? String(row.pttypename) : null,
        pttype_eclaim_id: row.pttype_eclaim_id ? String(row.pttype_eclaim_id).trim() : null,
        isUc: isUcEclaimCode(row.pttype_eclaim_id ? String(row.pttype_eclaim_id) : null),
        department: row.department ? String(row.department) : null,
        clinic: row.clinic ? String(row.clinic) : null,
        pdx: row.pdx ? String(row.pdx) : null,
        dx0: row.dx0 ? String(row.dx0) : null,
        dx1: row.dx1 ? String(row.dx1) : null,
        dx2: row.dx2 ? String(row.dx2) : null,
        dx3: row.dx3 ? String(row.dx3) : null,
        dx4: row.dx4 ? String(row.dx4) : null,
        dx5: row.dx5 ? String(row.dx5) : null,
        op0: row.op0 ? String(row.op0) : null,
        op1: row.op1 ? String(row.op1) : null,
        op2: row.op2 ? String(row.op2) : null,
        op3: row.op3 ? String(row.op3) : null,
        op4: row.op4 ? String(row.op4) : null,
        op5: row.op5 ? String(row.op5) : null,
        listname: row.listname ? String(row.listname) : null,
        status: row.status ? String(row.status) : null,
        rep: row.rep ? String(row.rep) : null,
        compensated: compVal,
        isCompensated: compVal > 0,
      }
    }),
    gw.seamlessFetcher,
    Boolean(params.refresh)
  )

    // Full Page Filter: Apply pttypes / ucOnly filter across all cohort items before summary & pagination
    const summaryCohort = allMappedItems.filter((i) => {
      if (params.pttypes !== undefined) {
        return matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      }
      if (params.ucOnly) {
        return i.isUc ?? false
      }
      return true
    })

    const totalVisits = summaryCohort.length
    const uniqueHnSet = new Set<string>()
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let withPdxCount = 0
    let withOpCount = 0

    for (const item of summaryCohort) {
      if (item.hn) uniqueHnSet.add(item.hn)
      if (item.isCompensated) {
        compensatedVisits += 1
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCount += 1
      if (item.pdx) withPdxCount += 1
      if (
        item.op0 ||
        item.op1 ||
        item.op2 ||
        item.op3 ||
        item.op4 ||
        item.op5
      ) {
        withOpCount += 1
      }
    }

    const uniquePatients = uniqueHnSet.size
    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate =
      totalVisits > 0 ? Number(((compensatedVisits / totalVisits) * 100).toFixed(1)) : 0
    const averageCompensated =
      compensatedVisits > 0 ? Number((totalCompensated / compensatedVisits).toFixed(2)) : 0
    const withoutAuthenCount = totalVisits - withAuthenCount

    const summary: CcsService1B005Summary = {
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

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    let filtered = summaryCohort

    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (compensationFilter === 'HAS_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (compensationFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'DIAG') {
          return [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5]
            .filter(Boolean)
            .some((dx) => dx!.toLowerCase().includes(search))
        }
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.status && i.status.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search))
        )
      })
    }

    const sorted = [...filtered].sort((a, b) => compareService1B004NItems(a, b, sortBy, sortOrder))

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
      adpMapping,
      compensationFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
      repBreakdown,
    }
  }
