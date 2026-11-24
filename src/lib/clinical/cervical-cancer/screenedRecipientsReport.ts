import { getCachedData } from '@/lib/cache'
import { resolveFiscalDateRange } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import { buildRepBreakdownSummary, matchesRepFilter, parseRepFilterParam } from '../rcmRepTagHelper'
import {
  compareScreenedItems,
  defaultCcsGateway,
  type CcsGatewayAdapter,
  type CcsScreenedRecipientsParams,
  type CcsScreenedRecipientsResult,
  type CcsScreenedRecipientItem,
  type CcsScreenedRecipientsSummary,
  type CcsMethodFilter,
  type CcsOkFilter,
  type CcsResultStatusFilter,
  type CcsCompensationFilter,
  type CcsScreenedSearchField,
  type CcsScreenedSortField,
} from './typesAndHelpers'

export async function getScreenedRecipientsReport(
  params: CcsScreenedRecipientsParams = {},
  gateway: Partial<CcsGatewayAdapter> = {}
): Promise<CcsScreenedRecipientsResult> {
  const gw = { ...defaultCcsGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const methodFilter: CcsMethodFilter = params.methodFilter || 'ALL'
  const okFilter: CcsOkFilter = params.okFilter || 'ALL'
  const resultStatusFilter: CcsResultStatusFilter = params.resultStatusFilter || 'ALL'
  const compensationFilter: CcsCompensationFilter = params.compensationFilter || 'ALL'
  const searchField: CcsScreenedSearchField = params.searchField || 'ALL'
  const search = (params.search || '').trim().toLowerCase()
  const sortBy: CcsScreenedSortField = params.sortBy || 'vstdate'
  const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
  const page = Math.max(1, Number(params.page || 1))
  const pageSize = Math.max(1, Number(params.pageSize || 50))
  const exportAll = Boolean(params.exportAll)

  const cacheKey = `rcm-ccs-p2-recipients-${ds1}-${ds2}`

  const rawRows = await getCachedData(
    cacheKey,
    async () =>
      gw.getCcsScreenedRecipientsRaw({
        startDate: ds1,
        endDate: ds2,
        refresh: Boolean((params as any).refresh),
      }),
    300000
  )

    const items: CcsScreenedRecipientItem[] = (rawRows || []).map((r) => {
      const papsmear_result = r.papsmear_result ? String(r.papsmear_result).trim() : null
      const via_result = r.via_result ? String(r.via_result).trim() : null
      const hpv_result = r.hpv_result ? String(r.hpv_result).trim() : null
      const other_result = r.other_result ? String(r.other_result).trim() : null

      const hasAbnormalResult =
        Boolean(papsmear_result && papsmear_result.includes('ผิดปกติ')) ||
        Boolean(via_result && via_result.includes('ผิดปกติ')) ||
        Boolean(hpv_result && hpv_result.includes('ผิดปกติ')) ||
        Boolean(other_result && other_result.includes('ผิดปกติ'))

      return {
        no: 0,
        vn: String(r.vn || '').trim(),
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').replace(/\D/g, ''),
        ptname: String(r.ptname || '').trim(),
        age: r.age != null ? Number(r.age) : null,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        pttypename_patient: r.pttypename_patient ? String(r.pttypename_patient).trim() : null,
        pttypename_visit: r.pttypename_visit ? String(r.pttypename_visit).trim() : null,
        pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
        isUc: isUcEclaimCode(r.pttype_eclaim_id ? String(r.pttype_eclaim_id) : null),
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        ok: r.ok === 'Y' ? 'Y' : null,
        papsmear: r.papsmear ? String(r.papsmear).trim() : null,
        papsmear_result,
        via: r.via ? String(r.via).trim() : null,
        via_result,
        hpv: r.hpv ? String(r.hpv).trim() : null,
        hpv_result,
        other: r.other ? String(r.other).trim() : null,
        other_result,
        colposcopy: r.colposcopy === 'Y' ? 'Y' : null,
        type: r.type ? String(r.type).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: Number(r.compensated || 0),
        note: r.note ? String(r.note).trim() : null,
        paydate: r.paydate ? String(r.paydate).trim() : null,
        listname: r.listname ? String(r.listname).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep_nhso: r.rep_nhso ? String(r.rep_nhso).trim() : null,
        nhso: Number(r.nhso || 0),
        hasAbnormalResult,
      }
    })

    const enrichedItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      items,
      gw.seamlessFetcher,
      Boolean((params as any).refresh)
    )

    // Full Page Filter: Apply pttypes / ucOnly filter across all cohort items before summary & pagination
    const summaryCohort = enrichedItems.filter((i) => {
      if (params.pttypes !== undefined) {
        return matchesPttypeFilter((i as any).pttypename || i.pttypename_visit || i.pttypename_patient || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      }
      if (params.ucOnly) {
        return i.isUc ?? false
      }
      return true
    })

    // Compute Summary across summaryCohort
    const totalVisits = summaryCohort.length
    const uniqueHns = new Set(summaryCohort.map((i) => i.hn).filter(Boolean))
    const uniquePatients = uniqueHns.size
    const okCount = summaryCohort.filter((i) => i.ok === 'Y').length
    const notOkCount = summaryCohort.filter((i) => i.ok !== 'Y').length
    const papCount = summaryCohort.filter((i) => Boolean(i.papsmear)).length
    const viaCount = summaryCohort.filter((i) => Boolean(i.via)).length
    const hpvCount = summaryCohort.filter((i) => Boolean(i.hpv)).length
    const colposcopyCount = summaryCohort.filter((i) => i.colposcopy === 'Y').length
    const abnormalCount = summaryCohort.filter((i) => i.hasAbnormalResult).length
    const totalSeamlessCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalNhsoCompensated = summaryCohort.reduce((acc, i) => acc + i.nhso, 0)

    const summary: CcsScreenedRecipientsSummary = {
      totalVisits,
      uniquePatients,
      okCount,
      notOkCount,
      papCount,
      viaCount,
      hpvCount,
      colposcopyCount,
      abnormalCount,
      totalSeamlessCompensated,
      totalNhsoCompensated,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Filter by screening method (FoxPro cshow: ทั้งหมด, PapSmear, VIA, HPV, ColpoScopy)
    let filtered = summaryCohort
    if (methodFilter === 'PapSmear') {
      filtered = filtered.filter((i) => Boolean(i.papsmear))
    } else if (methodFilter === 'VIA') {
      filtered = filtered.filter((i) => Boolean(i.via))
    } else if (methodFilter === 'HPV') {
      filtered = filtered.filter((i) => Boolean(i.hpv))
    } else if (methodFilter === 'ColpoScopy') {
      filtered = filtered.filter((i) => i.colposcopy === 'Y')
    }

    // Filter by OK recording status
    if (okFilter === 'OK') {
      filtered = filtered.filter((i) => i.ok === 'Y')
    } else if (okFilter === 'NOT_OK') {
      filtered = filtered.filter((i) => i.ok !== 'Y')
    }

    // Filter by test results
    if (resultStatusFilter === 'ABNORMAL') {
      filtered = filtered.filter((i) => i.hasAbnormalResult)
    } else if (resultStatusFilter === 'NORMAL') {
      filtered = filtered.filter((i) => !i.hasAbnormalResult)
    }

    // Filter by compensation
    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.compensated > 0 || i.nhso > 0 || i.status !== null || i.rep !== null)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter(
        (i) => i.compensated === 0 && i.nhso === 0 && i.status === null && i.rep === null
      )
    }

    // Filter by search
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
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search))
        )
      })
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => compareScreenedItems(a, b, sortBy, sortOrder))

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
      methodFilter,
      okFilter,
      resultStatusFilter,
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
