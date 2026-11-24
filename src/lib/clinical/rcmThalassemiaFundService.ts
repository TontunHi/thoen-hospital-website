import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
} from './rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'
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

export interface ThalassemiaFundGatewayAdapter {
  getRcmExtraThalassemiaFundOpdRaw: typeof apiGateway.clinical.getRcmExtraThalassemiaFundOpdRaw
  getRcmExtraThalassemiaFundIpdRaw: typeof apiGateway.clinical.getRcmExtraThalassemiaFundIpdRaw
  getRcmExtraThalassemiaAnDetailsRaw: typeof apiGateway.clinical.getRcmExtraThalassemiaAnDetailsRaw
  seamlessFetcher?: SeamlessEnricherFetcher
}

const defaultThalassemiaFundGateway: ThalassemiaFundGatewayAdapter = {
  getRcmExtraThalassemiaFundOpdRaw: (p) => apiGateway.clinical.getRcmExtraThalassemiaFundOpdRaw(p),
  getRcmExtraThalassemiaFundIpdRaw: (p) => apiGateway.clinical.getRcmExtraThalassemiaFundIpdRaw(p),
  getRcmExtraThalassemiaAnDetailsRaw: (an) => apiGateway.clinical.getRcmExtraThalassemiaAnDetailsRaw(an),
}

// ── Types: กองทุน Thalassemia (ผู้ป่วยนอก OPD & ผู้ป่วยใน IPD) ──────────────────────

export type ThalassemiaFundCardFilter =
  | 'ALL'
  | 'WITH_DRUG'
  | 'WITH_BLOOD'
  | 'WITH_FERRITIN'
  | 'WITH_HB_HCT'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'UC_ONLY'

export type ThalassemiaFundSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'AN'
  | 'ICD10'
  | 'ICD9'
  | 'DRUG'
  | 'BLOOD'
  | 'PTTYPE'

export type ThalassemiaOpdSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'icd10'
  | 'bloodQty'
  | 'compensated'

export type ThalassemiaIpdSortField =
  | 'dchdate'
  | 'admdate'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'icd10'
  | 'bloodQty'
  | 'compensated'

export interface ThalassemiaFundReportParams extends FiscalDateRangeParams {
  cardFilter?: ThalassemiaFundCardFilter
  pttypes?: string
  ucOnly?: boolean
  searchField?: ThalassemiaFundSearchField
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface ThalassemiaOpdItem {
  no: number
  vn: string
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  vstdate: string
  vsttime: string
  pttypename: string
  pttype_eclaim_id?: string | null
  department: string | null
  clinic: string | null
  icd10: string | null
  icd9: string | null
  drugname: string | null
  hasDrug: boolean
  blood: string | null
  bloodDate: string | null
  bloodQty: number
  hasBlood: boolean
  ferritinResult: string | null
  ferritinDate: string | null
  hbResult: string | null
  hbDate: string | null
  hctResult: string | null
  hctDate: string | null
  authencode: string | null
  seamless: string | null
  rep: string | null
  status: string | null
  compensated: number
  isCompensated: boolean
  isUc: boolean
}

export interface ThalassemiaIpdItem {
  no: number
  an: string
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  admdate: string
  dchdate: string
  pttypename: string
  pttype_eclaim_id?: string | null
  ward: string | null
  icd10: string | null
  icd9: string | null
  drugname: string | null
  hasDrug: boolean
  blood: string | null
  bloodDate: string | null
  bloodQty: number
  hasBlood: boolean
  ferritinResult: string | null
  ferritinDate: string | null
  hbResult: string | null
  hbDate: string | null
  hctResult: string | null
  hctDate: string | null
  seamless: string | null
  rep: string | null
  status: string | null
  compensated: number
  isCompensated: boolean
  isUc: boolean
}

export interface ThalassemiaFundSummary {
  totalCases: number
  uniquePatients: number
  drugCases: number
  drugRate: number
  bloodCases: number
  bloodRate: number
  totalBloodUnits: number
  ferritinCases: number
  ferritinRate: number
  hbHctCases: number
  hbHctRate: number
  compensatedCases: number
  uncompensatedCases: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  ucCases: number
  ucRate: number
}

export interface ThalassemiaOpdReportResult {
  ds1: string
  ds2: string
  cardFilter: ThalassemiaFundCardFilter
  search: string
  sortBy: ThalassemiaOpdSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: ThalassemiaFundSummary
  items: ThalassemiaOpdItem[]
  repBreakdown?: RepBreakdownSummary
}

export interface ThalassemiaIpdReportResult {
  ds1: string
  ds2: string
  cardFilter: ThalassemiaFundCardFilter
  search: string
  sortBy: ThalassemiaIpdSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: ThalassemiaFundSummary
  items: ThalassemiaIpdItem[]
  repBreakdown?: RepBreakdownSummary
}

export interface AnClinicalDetails {
  header: {
    an: string
    hn: string
    cid: string
    ptname: string
    sex: string
    age: number
    admdate: string
    dchdate: string
    pttypename: string
    ward: string
  }
  diagnoses: {
    icd10: string
    icdName: string
    diagtype: string
    diagtypeName: string
    doctorName: string
  }[]
  procedures: {
    icd9: string
    icd9Name: string
    opdate: string
    doctorName: string
  }[]
  orders: {
    icode: string
    itemName: string
    strength: string | null
    units: string | null
    qty: number
    unitprice: number
    sumPrice: number
    paidstName: string
    incomeName: string
    isDrug: boolean
  }[]
}

// ── Service Implementation ────────────────────────────────────────────────────────

export class RcmThalassemiaFundService {
  /**
   * 1. รายงานผู้ป่วยนอก Thalassemia (OPD)
   * - ผู้ป่วยโรคโลหิตจางธาลัสซีเมีย (ICD10 D56, D582)
   * - ได้รับยาขับเหล็ก (Deferasirox, Deferipron, Desferrioxamin) หรือ ได้รับการให้เลือด (ADP 232xxxx)
   * - ผลตรวจ Lab: Ferritin, Hb, Hct
   */
  static async getOpdReport(
    params: ThalassemiaFundReportParams,
    gateway: Partial<ThalassemiaFundGatewayAdapter> = {}
  ): Promise<ThalassemiaOpdReportResult> {
    const gw = { ...defaultThalassemiaFundGateway, ...gateway }
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: ThalassemiaFundCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy = (params.sortBy as ThalassemiaOpdSortField) || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-thalassemia-fund-opd-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () =>
        ((await gw.getRcmExtraThalassemiaFundOpdRaw({
          startDate: ds1,
          endDate: ds2,
          refresh: Boolean(params.refresh),
        })) as any[]) || [],
      600000
    )

    // Map rows into domain objects
    let allItems: ThalassemiaOpdItem[] = rawRows.map((r, idx) => {
      const hasDrug = Boolean(r.drugname && String(r.drugname).trim().length > 0)
      const hasBlood = Boolean(r.blood && String(r.blood).trim().length > 0)
      const compensated = Number(r.compensated || 0)
      const rep = r.rep ? String(r.rep).trim() : null
      const isCompensated = compensated > 0 || Boolean(rep && rep.length > 0)
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc =
        (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) ||
        String(r.maininscl || '').trim() === 'UCS' ||
        String(r.pttypename || '').includes('บัตรทอง') ||
        String(r.pttypename || '').includes('ประกันสุขภาพ')

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        hn: String(r.hn || ''),
        cid: String(r.cid || ''),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code),
        birthday: r.birthday ? String(r.birthday) : null,
        age: Number(r.age || 0),
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        pttypename: String(r.pttypename || ''),
        pttype_eclaim_id: pttypeEclaimId,
        department: r.department ? String(r.department) : null,
        clinic: r.clinic ? String(r.clinic) : null,
        icd10: r.icd10 ? String(r.icd10) : null,
        icd9: r.icd9 ? String(r.icd9) : null,
        drugname: r.drugname ? String(r.drugname) : null,
        hasDrug,
        blood: r.blood ? String(r.blood) : null,
        bloodDate: r.blood_date ? String(r.blood_date) : null,
        bloodQty: Number(r.blood_qty || 0),
        hasBlood,
        ferritinResult: r.ferritin_result ? String(r.ferritin_result) : null,
        ferritinDate: r.ferritin_date ? String(r.ferritin_date) : null,
        hbResult: r.hb_result ? String(r.hb_result) : null,
        hbDate: r.hb_date ? String(r.hb_date) : null,
        hctResult: r.hct_result ? String(r.hct_result) : null,
        hctDate: r.hct_date ? String(r.hct_date) : null,
        authencode: r.authencode ? String(r.authencode).trim() : null,
        seamless: r.seamless ? String(r.seamless).trim() : null,
        rep,
        status: r.status ? String(r.status).trim() : null,
        compensated,
        isCompensated,
        isUc,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, gw.seamlessFetcher, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Summary across summaryCohort
    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    const drugCases = summaryCohort.filter((i) => i.hasDrug).length
    const bloodCases = summaryCohort.filter((i) => i.hasBlood).length
    const totalBloodUnits = summaryCohort.reduce((acc, cur) => acc + cur.bloodQty, 0)
    const ferritinCases = summaryCohort.filter((i) => Boolean(i.ferritinResult)).length
    const hbHctCases = summaryCohort.filter((i) => Boolean(i.hbResult || i.hctResult)).length
    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const totalCompensated = summaryCohort.reduce((acc, cur) => acc + cur.compensated, 0)
    const averageCompensated = compensatedCases > 0 ? totalCompensated / compensatedCases : 0
    const ucCases = summaryCohort.filter((i) => i.isUc).length

    const summary: ThalassemiaFundSummary = {
      totalCases,
      uniquePatients,
      drugCases,
      drugRate: totalCases > 0 ? (drugCases / totalCases) * 100 : 0,
      bloodCases,
      bloodRate: totalCases > 0 ? (bloodCases / totalCases) * 100 : 0,
      totalBloodUnits,
      ferritinCases,
      ferritinRate: totalCases > 0 ? (ferritinCases / totalCases) * 100 : 0,
      hbHctCases,
      hbHctRate: totalCases > 0 ? (hbHctCases / totalCases) * 100 : 0,
      compensatedCases,
      uncompensatedCases,
      compensationRate: totalCases > 0 ? (compensatedCases / totalCases) * 100 : 0,
      totalCompensated,
      averageCompensated,
      ucCases,
      ucRate: totalCases > 0 ? (ucCases / totalCases) * 100 : 0,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Apply Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'WITH_DRUG') {
      filtered = filtered.filter((i) => i.hasDrug)
    } else if (cardFilter === 'WITH_BLOOD') {
      filtered = filtered.filter((i) => i.hasBlood)
    } else if (cardFilter === 'WITH_FERRITIN') {
      filtered = filtered.filter((i) => Boolean(i.ferritinResult))
    } else if (cardFilter === 'WITH_HB_HCT') {
      filtered = filtered.filter((i) => Boolean(i.hbResult || i.hctResult))
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    // Apply Unified Search
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.icd10 && i.icd10.toLowerCase().includes(search)) ||
          (i.icd9 && i.icd9.toLowerCase().includes(search)) ||
          (i.drugname && i.drugname.toLowerCase().includes(search)) ||
          (i.blood && i.blood.toLowerCase().includes(search)) ||
          i.pttypename.toLowerCase().includes(search)
        )
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'vstdate') {
        cmp = a.vstdate.localeCompare(b.vstdate)
      } else if (sortBy === 'vsttime') {
        cmp = a.vsttime.localeCompare(b.vsttime)
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname)
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'bloodQty') {
        cmp = a.bloodQty - b.bloodQty
      } else if (sortBy === 'compensated') {
        cmp = a.compensated - b.compensated
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Pagination
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const pagedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    // Re-index displayed records
    pagedItems.forEach((it, idx) => {
      it.no = exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1
    })

    return {
      ds1,
      ds2,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      summary,
      items: pagedItems,
      repBreakdown,
    }
  }

  /**
   * 2. รายงานผู้ป่วยใน Thalassemia (IPD)
   * - ผู้ป่วยในโรคโลหิตจางธาลัสซีเมีย (ICD10 D56, D582)
   * - ได้รับการให้เลือด (ICD-9 9904 หรือ ADP 232xxxx) หรือ ได้รับยาขับเหล็ก
   * - ผลตรวจ Lab: Ferritin, Hb, Hct
   */
  static async getIpdReport(
    params: ThalassemiaFundReportParams,
    gateway: Partial<ThalassemiaFundGatewayAdapter> = {}
  ): Promise<ThalassemiaIpdReportResult> {
    const gw = { ...defaultThalassemiaFundGateway, ...gateway }
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: ThalassemiaFundCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy = (params.sortBy as ThalassemiaIpdSortField) || 'dchdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-thalassemia-fund-ipd-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () =>
        ((await gw.getRcmExtraThalassemiaFundIpdRaw({
          startDate: ds1,
          endDate: ds2,
          refresh: Boolean(params.refresh),
        })) as any[]) || [],
      600000
    )

    // Map rows into domain objects
    let allItems: ThalassemiaIpdItem[] = rawRows.map((r, idx) => {
      const hasDrug = Boolean(r.drugname && String(r.drugname).trim().length > 0)
      const hasBlood =
        Boolean(r.blood && String(r.blood).trim().length > 0) ||
        Boolean(r.icd9 && String(r.icd9).includes('9904'))
      const compensated = Number(r.compensated || 0)
      const rep = r.rep ? String(r.rep).trim() : null
      const isCompensated = compensated > 0 || Boolean(rep && rep.length > 0)
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc =
        (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) ||
        String(r.maininscl || '').trim() === 'UCS' ||
        String(r.pttypename || '').includes('บัตรทอง') ||
        String(r.pttypename || '').includes('ประกันสุขภาพ')

      return {
        no: idx + 1,
        an: String(r.an || ''),
        hn: String(r.hn || ''),
        cid: String(r.cid || ''),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code),
        birthday: r.birthday ? String(r.birthday) : null,
        age: Number(r.age || 0),
        admdate: String(r.admdate || ''),
        dchdate: String(r.dchdate || ''),
        pttypename: String(r.pttypename || ''),
        pttype_eclaim_id: pttypeEclaimId,
        ward: r.ward ? String(r.ward) : null,
        icd10: r.icd10 ? String(r.icd10) : null,
        icd9: r.icd9 ? String(r.icd9) : null,
        drugname: r.drugname ? String(r.drugname) : null,
        hasDrug,
        blood: r.blood ? String(r.blood) : null,
        bloodDate: r.blood_date ? String(r.blood_date) : null,
        bloodQty: Number(r.blood_qty || 0),
        hasBlood,
        ferritinResult: r.ferritin_result ? String(r.ferritin_result) : null,
        ferritinDate: r.ferritin_date ? String(r.ferritin_date) : null,
        hbResult: r.hb_result ? String(r.hb_result) : null,
        hbDate: r.hb_date ? String(r.hb_date) : null,
        hctResult: r.hct_result ? String(r.hct_result) : null,
        hctDate: r.hct_date ? String(r.hct_date) : null,
        seamless: r.seamless ? String(r.seamless).trim() : null,
        rep,
        status: r.status ? String(r.status).trim() : null,
        compensated,
        isCompensated,
        isUc,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, gw.seamlessFetcher, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Summary across summaryCohort
    const totalCases = summaryCohort.length
    const uniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    const drugCases = summaryCohort.filter((i) => i.hasDrug).length
    const bloodCases = summaryCohort.filter((i) => i.hasBlood).length
    const totalBloodUnits = summaryCohort.reduce((acc, cur) => acc + cur.bloodQty, 0)
    const ferritinCases = summaryCohort.filter((i) => Boolean(i.ferritinResult)).length
    const hbHctCases = summaryCohort.filter((i) => Boolean(i.hbResult || i.hctResult)).length
    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const totalCompensated = summaryCohort.reduce((acc, cur) => acc + cur.compensated, 0)
    const averageCompensated = compensatedCases > 0 ? totalCompensated / compensatedCases : 0
    const ucCases = summaryCohort.filter((i) => i.isUc).length

    const summary: ThalassemiaFundSummary = {
      totalCases,
      uniquePatients,
      drugCases,
      drugRate: totalCases > 0 ? (drugCases / totalCases) * 100 : 0,
      bloodCases,
      bloodRate: totalCases > 0 ? (bloodCases / totalCases) * 100 : 0,
      totalBloodUnits,
      ferritinCases,
      ferritinRate: totalCases > 0 ? (ferritinCases / totalCases) * 100 : 0,
      hbHctCases,
      hbHctRate: totalCases > 0 ? (hbHctCases / totalCases) * 100 : 0,
      compensatedCases,
      uncompensatedCases,
      compensationRate: totalCases > 0 ? (compensatedCases / totalCases) * 100 : 0,
      totalCompensated,
      averageCompensated,
      ucCases,
      ucRate: totalCases > 0 ? (ucCases / totalCases) * 100 : 0,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Apply Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'WITH_DRUG') {
      filtered = filtered.filter((i) => i.hasDrug)
    } else if (cardFilter === 'WITH_BLOOD') {
      filtered = filtered.filter((i) => i.hasBlood)
    } else if (cardFilter === 'WITH_FERRITIN') {
      filtered = filtered.filter((i) => Boolean(i.ferritinResult))
    } else if (cardFilter === 'WITH_HB_HCT') {
      filtered = filtered.filter((i) => Boolean(i.hbResult || i.hctResult))
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((i) => i.isUc)
    }

    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    // Apply Unified Search
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.an.toLowerCase().includes(search) ||
          (i.icd10 && i.icd10.toLowerCase().includes(search)) ||
          (i.icd9 && i.icd9.toLowerCase().includes(search)) ||
          (i.drugname && i.drugname.toLowerCase().includes(search)) ||
          (i.blood && i.blood.toLowerCase().includes(search)) ||
          i.pttypename.toLowerCase().includes(search)
        )
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'dchdate') {
        cmp = a.dchdate.localeCompare(b.dchdate)
      } else if (sortBy === 'admdate') {
        cmp = a.admdate.localeCompare(b.admdate)
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname)
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'bloodQty') {
        cmp = a.bloodQty - b.bloodQty
      } else if (sortBy === 'compensated') {
        cmp = a.compensated - b.compensated
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Pagination
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const pagedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    // Re-index displayed records
    pagedItems.forEach((it, idx) => {
      it.no = exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1
    })

    return {
      ds1,
      ds2,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      summary,
      items: pagedItems,
      repBreakdown,
    }
  }

  /**
   * 3. รายละเอียดเวชระเบียนผู้ป่วยในระดับ Admission (AN Clinical Details)
   * สำหรับแสดงผลใน Modal รายละเอียดเมื่อคลิกที่ record ในตาราง IPD
   */
  static async getAnClinicalDetails(
    an: string,
    gateway: Partial<ThalassemiaFundGatewayAdapter> = {}
  ): Promise<AnClinicalDetails | null> {
    const gw = { ...defaultThalassemiaFundGateway, ...gateway }
    const cleanAn = (an || '').trim()
    if (!cleanAn) return null

    const { headerRows, diagRows, oprtRows, orderRows } = await gw.getRcmExtraThalassemiaAnDetailsRaw(cleanAn)

    if (!headerRows || headerRows.length === 0) {
      return null
    }

    const h = headerRows[0] as any
    return {
      header: {
        an: String(h.an || cleanAn),
        hn: String(h.hn || ''),
        cid: String(h.cid || ''),
        ptname: String(h.ptname || '').trim(),
        sex: String(h.sex || '-'),
        age: Number(h.age || 0),
        admdate: String(h.admdate || ''),
        dchdate: String(h.dchdate || ''),
        pttypename: String(h.pttypename || ''),
        ward: String(h.ward || ''),
      },
      diagnoses: (diagRows || []).map((d: any) => ({
        icd10: String(d.icd10 || ''),
        icdName: String(d.icd_name || d.icd10 || ''),
        diagtype: String(d.diagtype || ''),
        diagtypeName: String(d.diagtype_name || ''),
        doctorName: String(d.doctor_name || ''),
      })),
      procedures: (oprtRows || []).map((op: any) => ({
        icd9: String(op.icd9 || ''),
        icd9Name: String(op.icd9_name || op.icd9 || ''),
        opdate: String(op.opdate || ''),
        doctorName: String(op.doctor_name || ''),
      })),
      orders: (orderRows || []).map((o: any) => ({
        icode: String(o.icode || ''),
        itemName: String(o.item_name || o.icode || ''),
        strength: o.strength ? String(o.strength) : null,
        units: o.units ? String(o.units) : null,
        qty: Number(o.qty || 0),
        unitprice: Number(o.unitprice || 0),
        sumPrice: Number(o.sum_price || 0),
        paidstName: String(o.paidst_name || ''),
        incomeName: String(o.income_name || ''),
        isDrug: Boolean(o.is_drug === 1),
      })),
    }
  }
}
