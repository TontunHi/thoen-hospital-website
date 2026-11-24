import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange } from '../rcmDashboardService'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import { buildRepBreakdownSummary, matchesRepFilter, parseRepFilterParam } from '../rcmRepTagHelper'
import {
  compareService1B004NItems,
  defaultCcsGateway,
  type CcsGatewayAdapter,
  type CcsAdpMappingCheck,
  type CcsService1B004NParams,
  type CcsService1B004NResult,
  type CcsService1B004NItem,
  type CcsService1B004NSummary,
  type CcsService1B004NCompensationFilter,
  type CcsService1B004NSearchField,
  type CcsService1B004NSortField,
  type CcsService1B004PParams,
  type CcsService1B004PResult,
  type CcsService1B004PItem,
  type CcsService1B004PSummary,
  type CcsService1B004PCompensationFilter,
  type CcsService1B004PSearchField,
  type CcsService1B004PSortField,
} from './typesAndHelpers'

export async function check1B004NAdpMapping(
  gateway: Partial<CcsGatewayAdapter> = {}
): Promise<CcsAdpMappingCheck> {
  const gw = { ...defaultCcsGateway, ...gateway }
  try {
    return await gw.getCcsAdpMapping('1B004N')
  } catch {
    return { isMapped: false, mappedCount: 0, items: [] }
  }
}

export async function getService1B004NReport(
  params: CcsService1B004NParams = {},
  gateway: Partial<CcsGatewayAdapter> = {}
): Promise<CcsService1B004NResult> {
  const gw = { ...defaultCcsGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const compensationFilter: CcsService1B004NCompensationFilter = params.compensationFilter || 'ALL'
  const searchField: CcsService1B004NSearchField = params.searchField || 'ALL'
  const search = (params.search || '').trim().toLowerCase()
  const sortBy: CcsService1B004NSortField = params.sortBy || 'vstdate'
  const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
  const page = Math.max(1, Number(params.page || 1))
  const pageSize = Math.max(1, Number(params.pageSize || 50))
  const exportAll = Boolean(params.exportAll)

  const cacheKey = `rcm-ccs-p3-1b004n-${ds1}-${ds2}`
  if (params.refresh) {
    invalidateCacheKey(cacheKey)
  }

  const { rawRows, adpMapping } = await getCachedData(
    cacheKey,
    async () =>
      gw.getCcsServiceRaw('1B004N', {
        startDate: ds1,
        endDate: ds2,
        refresh: Boolean(params.refresh),
      }),
    600
  )

    const allItems: CcsService1B004NItem[] = rawRows.map((r, idx) => {
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

    const summary: CcsService1B004NSummary = {
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

export async function check1B004PAdpMapping(
  gateway: Partial<CcsGatewayAdapter> = {}
): Promise<CcsAdpMappingCheck> {
  const gw = { ...defaultCcsGateway, ...gateway }
  try {
    return await gw.getCcsAdpMapping('1B004P')
  } catch {
    return { isMapped: false, mappedCount: 0, items: [] }
  }
}

export async function getService1B004PReport(
  params: CcsService1B004PParams = {},
  gateway: Partial<CcsGatewayAdapter> = {}
): Promise<CcsService1B004PResult> {
  const gw = { ...defaultCcsGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const compensationFilter: CcsService1B004PCompensationFilter = params.compensationFilter || 'ALL'
  const searchField: CcsService1B004PSearchField = params.searchField || 'ALL'
  const search = (params.search || '').trim().toLowerCase()
  const sortBy: CcsService1B004PSortField = params.sortBy || 'vstdate'
  const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
  const page = Math.max(1, Number(params.page || 1))
  const pageSize = Math.max(1, Number(params.pageSize || 50))
  const exportAll = Boolean(params.exportAll)

  const cacheKey = `rcm-ccs-p4-1b004p-${ds1}-${ds2}`
  if (params.refresh) {
    invalidateCacheKey(cacheKey)
  }

  const { rawRows, adpMapping } = await getCachedData(
    cacheKey,
    async () =>
      gw.getCcsServiceRaw('1B004P', {
        startDate: ds1,
        endDate: ds2,
        refresh: Boolean(params.refresh),
      }),
    600
  )

    const allItems: CcsService1B004PItem[] = rawRows.map((r, idx) => {
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

    const summary: CcsService1B004PSummary = {
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
          return i.cid.replace(/\D/g, '').includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return i.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return i.vn.toLowerCase().includes(search)
        }
        if (searchField === 'DIAG') {
          const diagBlob = [i.pdx, i.dx0, i.dx1, i.dx2, i.dx3, i.dx4, i.dx5, i.op0, i.op1, i.op2, i.op3, i.op4, i.op5]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return diagBlob.includes(search)
        }

        // Global search
        const cleanQ = search.replace(/\D/g, '')
        const matchCid = cleanQ ? i.cid.replace(/\D/g, '').includes(cleanQ) : false
        const matchText =
          matchesSeamlessRepSearch(i, search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.hn.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search))

        return matchText || matchCid
      })
    }

    const sorted = [...filtered].sort((a, b) => {
      let valA: string | number = ''
      let valB: string | number = ''

      switch (sortBy) {
        case 'vstdate':
          valA = `${a.vstdate} ${a.vsttime}`
          valB = `${b.vstdate} ${b.vsttime}`
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
        case 'compensated':
          valA = a.compensated
          valB = b.compensated
          break
        case 'pdx':
          valA = a.pdx || ''
          valB = b.pdx || ''
          break
        case 'authencode':
          valA = a.authencode || ''
          valB = b.authencode || ''
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
