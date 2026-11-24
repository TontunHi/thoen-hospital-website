import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
} from './rcmDashboardService'
import { isUniversalCoverageScheme } from './rcmColorectalCancerService'
import { matchesPttypeFilter } from './pttypeConstants'
import {
  enrichItemsWithSeamlessCache,
  matchesSeamlessRepSearch,
  type SeamlessEnricherFetcher,
} from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

export interface T1dmGdmPdmGatewayAdapter {
  getRcmExtraT1dmRecipientsRaw: typeof apiGateway.clinical.getRcmExtraT1dmRecipientsRaw
  seamlessFetcher?: SeamlessEnricherFetcher
}

const defaultT1dmGateway: T1dmGdmPdmGatewayAdapter = {
  getRcmExtraT1dmRecipientsRaw: (p) => apiGateway.clinical.getRcmExtraT1dmRecipientsRaw(p),
}

// ── Types: กองทุน T1DM/GDM/PDM (หัวข้อที่ 2 รายชื่อผู้รับบริการ) ──────────────────────

export type T1dmGdmPdmCardFilter =
  | 'ALL'
  | 'REGISTERED'
  | 'NOT_REGISTERED'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type T1dmGdmPdmSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'ICD10'
  | 'TYPE'
  | 'PTTYPE'
  | 'REP'

export type T1dmGdmPdmSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'type'
  | 'regdate'
  | 'lmp'
  | 'pdx'
  | 'status'
  | 'compensated'

export interface T1dmGdmPdmReportParams extends FiscalDateRangeParams {
  cardFilter?: T1dmGdmPdmCardFilter
  searchField?: T1dmGdmPdmSearchField
  search?: string
  sortBy?: T1dmGdmPdmSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  ucOnly?: boolean
  reps?: string
}

export interface T1dmGdmPdmRecipientItem {
  no: number
  vn: string
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  nation: string | null
  tel: string | null
  ok: string | null // 'Y' or null
  isRegistered: boolean
  type: string | null // e.g. T1DM, GDM, PDM
  regdate: string | null
  vstdate: string
  vsttime: string
  lmp: string | null
  authencode: string | null
  pttypenamePatient: string | null
  pttypenameVisit: string | null
  maininscl: string | null
  pttype_eclaim_id?: string
  department: string | null
  clinic: string | null
  pdx: string | null
  dx0: string | null
  dx1: string | null
  dx2: string | null
  dx3: string | null
  dx4: string | null
  dx5: string | null
  op0: string | null
  op1: string | null
  op2: string | null
  op3: string | null
  op4: string | null
  op5: string | null
  allDx: string[]
  allOp: string[]
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
  isUc: boolean
}

export interface T1dmGdmPdmSummary {
  totalCases: number
  uniquePatients: number
  registeredCases: number
  registeredRate: number
  notRegisteredCases: number
  notRegisteredRate: number
  compensatedCases: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  uncompensatedCases: number
  withAuthenCases: number
  withAuthenRate: number
  noAuthenCases: number
  ucCases: number
  ucRate: number
}

export interface T1dmGdmPdmReportResult {
  categoryTitle: string
  reportTitle: string
  ds1: string
  ds2: string
  summary: T1dmGdmPdmSummary
  items: T1dmGdmPdmRecipientItem[]
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
  cardFilter: T1dmGdmPdmCardFilter
  search: string
  sortBy: T1dmGdmPdmSortField
  sortOrder: 'asc' | 'desc'
  repBreakdown?: RepBreakdownSummary
}

// ── Service Implementation ──────────────────────────────────────────────────

export class RcmT1dmGdmPdmService {
  /**
   * สร้างรายงานรายชื่อผู้รับบริการ กองทุน T1DM/GDM/PDM (หัวข้อที่ 2)
   * แปลงจาก FoxPro:
   * - ตาราง ovst o, patient pt, ovstdiag dx, vn_stat v
   * - เงื่อนไข dx.icd10 REGEXP 'O24' (โรคเบาหวานขณะตั้งครรภ์และระยะหลังคลอด)
   * - ข้อมูลทะเบียน rcmdb.t1dm dd ON dd.pid = pt.cid
   * - ข้อมูล Authen Code จาก rcmdb.authencode cc ON cc.vn = o.vn
   * - ข้อมูลชดเชยจาก rcmdb.repeclaim, rcmdb.repdata, rcmdb.neweclaim, eclaimdb.m_registerdata
   */
  static async getRecipientsReport(
    params: T1dmGdmPdmReportParams,
    gateway: Partial<T1dmGdmPdmGatewayAdapter> = {}
  ): Promise<T1dmGdmPdmReportResult> {
    const gw = { ...defaultT1dmGateway, ...gateway }
    const categoryTitle = 'กองทุน T1DM/GDM/PDM'
    const reportTitle = 'รายชื่อผู้รับบริการ'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: T1dmGdmPdmCardFilter = params.cardFilter || 'ALL'
    const searchField: T1dmGdmPdmSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: T1dmGdmPdmSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-t1dm-gdm-pdm-recipients-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () =>
        ((await gw.getRcmExtraT1dmRecipientsRaw({
          startDate: ds1,
          endDate: ds2,
          refresh: Boolean(params.refresh),
        })) as any[]) || [],
      600000
    )

    // Map rows into domain objects
    let allItems: T1dmGdmPdmRecipientItem[] = (rawRows || []).map((r, index) => {
      const okVal = r.ok === 'Y' || r.ok === '1' ? 'Y' : null
      const isRegistered = okVal === 'Y'
      const compensatedVal = Number(r.compensated || 0)
      const hasRep = Boolean(r.rep && String(r.rep).trim() !== '')
      const isCompensated = compensatedVal > 0 || hasRep
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc = isUniversalCoverageScheme(r.maininscl, r.pttypename_visit || r.pttypename_patient, pttypeEclaimId)

      const pdx = r.pdx ? String(r.pdx).trim() : null
      const dxList: string[] = [
        pdx,
        r.dx0 ? String(r.dx0).trim() : null,
        r.dx1 ? String(r.dx1).trim() : null,
        r.dx2 ? String(r.dx2).trim() : null,
        r.dx3 ? String(r.dx3).trim() : null,
        r.dx4 ? String(r.dx4).trim() : null,
        r.dx5 ? String(r.dx5).trim() : null,
      ].filter((x): x is string => Boolean(x && x !== ''))

      const opList: string[] = [
        r.op0 ? String(r.op0).trim() : null,
        r.op1 ? String(r.op1).trim() : null,
        r.op2 ? String(r.op2).trim() : null,
        r.op3 ? String(r.op3).trim() : null,
        r.op4 ? String(r.op4).trim() : null,
        r.op5 ? String(r.op5).trim() : null,
      ].filter((x): x is string => Boolean(x && x !== ''))

      return {
        no: index + 1,
        vn: String(r.vn || '').trim(),
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code),
        birthday: r.birthday ? String(r.birthday) : null,
        age: Number(r.age || 0),
        nation: r.nation ? String(r.nation).trim() : null,
        tel: r.tel ? String(r.tel).trim() : null,
        ok: okVal,
        isRegistered,
        type: r.type ? String(r.type).trim() : null,
        regdate: r.regdate ? String(r.regdate) : null,
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        lmp: r.lmp ? String(r.lmp) : null,
        authencode: r.authencode ? String(r.authencode).trim() : null,
        pttypenamePatient: r.pttypename_patient ? String(r.pttypename_patient).trim() : null,
        pttypenameVisit: r.pttypename_visit ? String(r.pttypename_visit).trim() : null,
        maininscl: r.maininscl ? String(r.maininscl).trim() : null,
        pttype_eclaim_id: pttypeEclaimId,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        pdx,
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
        allDx: dxList,
        allOp: opList,
        status: r.status ? String(r.status).trim() : (isCompensated ? 'มี Rep แล้ว' : 'รอส่งเบิก'),
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        isUc,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, gw.seamlessFetcher, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter((i as any).pttypename || i.pttypenameVisit || i.pttypenamePatient || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Summary across summaryCohort
    const totalCases = summaryCohort.length
    const uniqueHns = new Set(summaryCohort.map((i) => i.hn))
    const uniquePatients = uniqueHns.size

    let registeredCases = 0
    let compensatedCases = 0
    let totalCompensated = 0
    let withAuthenCases = 0
    let ucCases = 0

    for (const item of summaryCohort) {
      if (item.isRegistered) registeredCases++
      if (item.isCompensated) {
        compensatedCases++
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCases++
      if (item.isUc) ucCases++
    }

    const notRegisteredCases = totalCases - registeredCases
    const uncompensatedCases = totalCases - compensatedCases
    const noAuthenCases = totalCases - withAuthenCases

    const registeredRate = totalCases > 0 ? (registeredCases / totalCases) * 100 : 0
    const notRegisteredRate = totalCases > 0 ? (notRegisteredCases / totalCases) * 100 : 0
    const compensationRate = totalCases > 0 ? (compensatedCases / totalCases) * 100 : 0
    const withAuthenRate = totalCases > 0 ? (withAuthenCases / totalCases) * 100 : 0
    const ucRate = totalCases > 0 ? (ucCases / totalCases) * 100 : 0
    const averageCompensated = compensatedCases > 0 ? totalCompensated / compensatedCases : 0

    const summary: T1dmGdmPdmSummary = {
      totalCases,
      uniquePatients,
      registeredCases,
      registeredRate,
      notRegisteredCases,
      notRegisteredRate,
      compensatedCases,
      compensationRate,
      totalCompensated,
      averageCompensated,
      uncompensatedCases,
      withAuthenCases,
      withAuthenRate,
      noAuthenCases,
      ucCases,
      ucRate,
    }

    // Apply Card Filter
    let filtered = [...summaryCohort]
    switch (cardFilter) {
      case 'REGISTERED':
        filtered = filtered.filter((i) => i.isRegistered)
        break
      case 'NOT_REGISTERED':
        filtered = filtered.filter((i) => !i.isRegistered)
        break
      case 'COMPENSATED':
        filtered = filtered.filter((i) => i.isCompensated)
        break
      case 'UNCOMPENSATED':
        filtered = filtered.filter((i) => !i.isCompensated)
        break
      case 'WITH_AUTHEN':
        filtered = filtered.filter((i) => Boolean(i.authencode))
        break
      case 'NO_AUTHEN':
        filtered = filtered.filter((i) => !i.authencode)
        break
      case 'UC_ONLY':
        filtered = filtered.filter((i) => i.isUc)
        break
      case 'ALL':
      default:
        break
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)
    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    // Apply Global Search
    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'ICD10') {
          return (
            (i.pdx && i.pdx.toLowerCase().includes(search)) ||
            i.allDx.some((dx) => dx.toLowerCase().includes(search))
          )
        }
        if (searchField === 'TYPE') return i.type && i.type.toLowerCase().includes(search)
        if (searchField === 'PTTYPE') {
          return (
            (i.pttypenameVisit && i.pttypenameVisit.toLowerCase().includes(search)) ||
            (i.pttypenamePatient && i.pttypenamePatient.toLowerCase().includes(search))
          )
        }
        if (searchField === 'REP') return i.rep && i.rep.toLowerCase().includes(search)

        // Default 'ALL'
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          i.allDx.some((dx) => dx.toLowerCase().includes(search)) ||
          (i.type && i.type.toLowerCase().includes(search)) ||
          (i.pttypenameVisit && i.pttypenameVisit.toLowerCase().includes(search)) ||
          (i.pttypenamePatient && i.pttypenamePatient.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.status && i.status.toLowerCase().includes(search)) ||
          (i.department && i.department.toLowerCase().includes(search))
        )
      })
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (valA == null) valA = ''
      if (valB == null) valB = ''

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = String(valB).toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index displayed rows
    const reindexed = filtered.map((item, idx) => ({
      ...item,
      no: idx + 1,
    }))

    const totalCount = reindexed.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let resultItems: T1dmGdmPdmRecipientItem[] = reindexed
    if (!exportAll) {
      const startIndex = (page - 1) * pageSize
      resultItems = reindexed.slice(startIndex, startIndex + pageSize)
    }

    return {
      categoryTitle,
      reportTitle,
      ds1,
      ds2,
      summary,
      items: resultItems,
      totalCount,
      totalPages,
      page,
      pageSize,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      repBreakdown,
    }
  }
}
