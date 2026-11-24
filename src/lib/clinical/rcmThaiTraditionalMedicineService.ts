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

export interface TtmGatewayAdapter {
  getRcmExtraTtmTopic3Raw: typeof apiGateway.clinical.getRcmExtraTtmTopic3Raw
  getRcmExtraTtmTopic11Raw: typeof apiGateway.clinical.getRcmExtraTtmTopic11Raw
  getRcmExtraTtmVnHerbs: typeof apiGateway.clinical.getRcmExtraTtmVnHerbs
  seamlessFetcher?: SeamlessEnricherFetcher
}

const defaultTtmGateway: TtmGatewayAdapter = {
  getRcmExtraTtmTopic3Raw: (p) => apiGateway.clinical.getRcmExtraTtmTopic3Raw(p),
  getRcmExtraTtmTopic11Raw: (p) => apiGateway.clinical.getRcmExtraTtmTopic11Raw(p),
  getRcmExtraTtmVnHerbs: (vn) => apiGateway.clinical.getRcmExtraTtmVnHerbs(vn),
}

// ── 1. Types: หัวข้อที่ 3 รายชื่อผู้รับบริการแพทย์แผนไทยรวม ────────────────────────

export type Ttm3CardFilter =
  | 'ALL'
  | 'TREATMENT_DRUG'
  | 'TREATMENT_MASSAGE'
  | 'TREATMENT_COMPRESS'
  | 'TREATMENT_OTHER'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'

export type Ttm3PlaceFilter = 'ALL' | 'IN_HOSP' | 'OUT_HOSP'

export type Ttm3SortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'compensated'
  | 'pdx'
  | 'authencode'

export interface Ttm3ReportParams extends FiscalDateRangeParams {
  cardFilter?: Ttm3CardFilter
  place?: Ttm3PlaceFilter
  pttypes?: string
  ucOnly?: boolean
  treatmentType?: string // '1'..'7'
  search?: string
  sortBy?: Ttm3SortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface TtmHerbDrugItem {
  icode?: string
  drug: string
  name?: string
  strength?: string | null
  units: string | null
  ttmt_code?: string
  did?: string | null
  category_id?: number | null
  qty: number
  unitprice?: number
  sumprice?: number
}

export interface Ttm3Item {
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
  servicedate: string | null
  authencode: string | null
  maininscl: string
  pttype_eclaim_id: string
  isUc: boolean
  pttypename: string
  department: string | null
  clinic: string | null
  place: 'Y' | 'N' // Y = ใน รพ., N = นอก รพ.
  placeLabel: string // 'ในสถานบริการ' | 'นอกสถานบริการ'
  // 7 Treatments
  treatment1: 'Y' | 'N' // ยา
  treatment2: 'Y' | 'N' // นวด
  treatment3: 'Y' | 'N' // ประคบ
  treatment4: 'Y' | 'N' // อบ
  treatment5: 'Y' | 'N' // ทับหม้อเกลือ
  treatment6: 'Y' | 'N' // สมาธิบำบัด
  treatment7: 'Y' | 'N' // อื่นๆ
  treatmentNames: string | null
  herbDrugs: string | null
  pdx: string | null
  dx0: string | null
  dx1: string | null
  dx2: string | null
  dx3: string | null
  dx4: string | null
  dx5: string | null
  income: number
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  seamlessPayno: string | null
  seamlessCompensated: number | null
}

export interface Ttm3Summary {
  totalVisits: number
  uniquePatients: number
  treatmentDrugCount: number // ยา (T1)
  treatmentMassageCount: number // นวด (T2)
  treatmentCompressCount: number // ประคบ (T3)
  treatmentOtherCount: number // อบ/ทับหม้อเกลือ/สมาธิ/อื่นๆ (T4-T7)
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  inHospCount: number
  outHospCount: number
  ucCount: number
  totalIncome: number
}

export interface Ttm3ReportResult {
  title: string
  categoryTitle: string
  ds1: string
  ds2: string
  cardFilter: Ttm3CardFilter
  place: Ttm3PlaceFilter
  ucOnly: boolean
  search: string
  sortBy: Ttm3SortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: Ttm3Summary
  items: Ttm3Item[]
  repBreakdown?: RepBreakdownSummary
}

// ── 2. Types: หัวข้อที่ 11 รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ ──────────────

export type Ttm11CardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'HIP_UCS'
  | 'HIP_WEL'
  | 'WITH_INVOICE'

export type Ttm11SortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'totalQty'
  | 'totalDrugAmount'
  | 'compensated'
  | 'pdx'
  | 'authCode'

export interface Ttm11ReportParams extends FiscalDateRangeParams {
  cardFilter?: Ttm11CardFilter
  pttypes?: string
  ucOnly?: boolean
  search?: string
  sortBy?: Ttm11SortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  reps?: string
}

export interface Ttm11DrugItem {
  icode: string
  name: string
  strength: string | null
  units: string | null
  ttmt_code: string
  did: string | null
  category_id: number | null
  qty: number
  unitprice: number
  sumprice: number
}

export interface Ttm11Item {
  no: number
  vn: string
  hn: string
  an: string | null
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  vstdate: string
  vsttime: string
  authCode: string | null
  authenEndpoint: string | null
  hipdataCode: string
  hipdataLabel: string
  pttype_eclaim_id: string
  isUc: boolean
  pttypename: string
  department: string | null
  hospmain: string | null
  hospsub: string | null
  pdx: string | null
  dx0: string | null
  dx1: string | null
  dx2: string | null
  dx3: string | null
  dx4: string | null
  dx5: string | null
  income: number
  drugNames: string
  ttmtCodes: string
  totalQty: number
  totalDrugAmount: number
  itemCount: number
  drugItems: Ttm11DrugItem[]
  rep: string | null
  compensated: number
  fund: string | null
  subfund: string | null
  errorcode: string | null
  repInvoice: string | null
  compensatedInvoice: number | null
  isCompensated: boolean
  hasInvoice: boolean
  status: string | null
}

export interface Ttm11Summary {
  totalVisits: number
  uniquePatients: number
  totalDispensedUnits: number
  totalDrugAmount: number
  compensatedVisits: number
  uncompensatedVisits: number
  compensationRate: number
  totalCompensated: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucsCount: number
  welCount: number
  invoiceCount: number
}

export interface Ttm11ReportResult {
  title: string
  categoryTitle: string
  ds1: string
  ds2: string
  cardFilter: Ttm11CardFilter
  search: string
  sortBy: Ttm11SortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: Ttm11Summary
  items: Ttm11Item[]
  repBreakdown?: RepBreakdownSummary
}

// ── 3. Helper Functions ──────────────────────────────────────────────────────────

function checkIsUc(maininscl?: string | null, pttypename?: string | null, pttypeEclaimId?: string | null): boolean {
  if (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) return true
  if (maininscl) {
    const code = maininscl.toUpperCase().trim()
    if (code === 'UCS' || code === 'WEL' || code === 'UC') return true
  }
  if (pttypename) {
    const text = pttypename.toLowerCase()
    if (
      text.includes('บัตรทอง') ||
      text.includes('ประกันสุขภาพถ้วนหน้า') ||
      text.includes('30 บาท') ||
      text.includes('uc')
    ) {
      return true
    }
  }
  return false
}

// ── 4. Service Implementation ───────────────────────────────────────────────────

export class RcmThaiTraditionalMedicineService {
  /**
   * หัวข้อที่ 3: รายชื่อผู้รับบริการแพทย์แผนไทยรวม
   * - ผู้ป่วยที่เข้ารับบริการในคลินิกแพทย์แผนไทย (health_med_service)
   * - จำแนกการรักษา 7 ด้าน (ยา, นวด, ประคบ, อบ, ทับหม้อเกลือ, สมาธิบำบัด, อื่นๆ)
   * - รองรับการกรองตามสถานที่ (ใน รพ./นอก รพ.), การชดเชย, Authen Code
   */
  static async getReportTopic3(
    params: Ttm3ReportParams,
    gateway: Partial<TtmGatewayAdapter> = {}
  ): Promise<Ttm3ReportResult> {
    const gw = { ...defaultTtmGateway, ...gateway }
    const categoryTitle = 'บริการแพทย์แผนไทย และการแพทย์ทางเลือก'
    const reportTitle = 'รายชื่อผู้รับบริการแพทย์แผนไทยรวม'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: Ttm3CardFilter = params.cardFilter || 'ALL'
    const placeFilter: Ttm3PlaceFilter = params.place || 'ALL'
    const ucOnly = Boolean(params.ucOnly)
    const treatmentType = (params.treatmentType || '').trim()
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: Ttm3SortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ttm-topic3-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () =>
        ((await gw.getRcmExtraTtmTopic3Raw({
          startDate: ds1,
          endDate: ds2,
          refresh: Boolean(params.refresh),
        })) as any[]) || [],
      600000
    )

    // Map rows to typed items
    let allItems: Ttm3Item[] = (rawRows || []).map((row, idx) => {
      const pttypeEclaimId = String(row.pttype_eclaim_id || '').trim()
      const isUc = checkIsUc(row.maininscl, row.pttypename, pttypeEclaimId)
      const place = row.place === 'N' ? 'N' : 'Y'
      const compensated = Number(row.compensated || 0)
      const isCompensated = compensated > 0

      return {
        no: idx + 1,
        vn: String(row.vn || '').trim(),
        hn: String(row.hn || '').trim(),
        cid: String(row.cid || '').trim(),
        ptname: String(row.ptname || '').trim(),
        sex: formatThaiSex(row.sex_code),
        birthday: row.birthday ? String(row.birthday).trim() : null,
        age: Number(row.age || 0),
        vstdate: String(row.vstdate || '').trim(),
        vsttime: String(row.vsttime || '').trim(),
        servicedate: row.servicedate ? String(row.servicedate).trim() : null,
        authencode: row.authencode ? String(row.authencode).trim() : null,
        maininscl: String(row.maininscl || '').trim(),
        pttype_eclaim_id: pttypeEclaimId,
        isUc,
        pttypename: String(row.pttypename || '').trim(),
        department: row.department ? String(row.department).trim() : null,
        clinic: row.clinic ? String(row.clinic).trim() : null,
        place,
        placeLabel: place === 'N' ? 'นอกสถานบริการ' : 'ในสถานบริการ',
        treatment1: row.treatment1 === 'Y' ? 'Y' : 'N',
        treatment2: row.treatment2 === 'Y' ? 'Y' : 'N',
        treatment3: row.treatment3 === 'Y' ? 'Y' : 'N',
        treatment4: row.treatment4 === 'Y' ? 'Y' : 'N',
        treatment5: row.treatment5 === 'Y' ? 'Y' : 'N',
        treatment6: row.treatment6 === 'Y' ? 'Y' : 'N',
        treatment7: row.treatment7 === 'Y' ? 'Y' : 'N',
        treatmentNames: row.treatment_names ? String(row.treatment_names).trim() : null,
        herbDrugs: row.herb_drugs ? String(row.herb_drugs).trim() : null,
        pdx: row.pdx ? String(row.pdx).trim() : null,
        dx0: row.dx0 ? String(row.dx0).trim() : null,
        dx1: row.dx1 ? String(row.dx1).trim() : null,
        dx2: row.dx2 ? String(row.dx2).trim() : null,
        dx3: row.dx3 ? String(row.dx3).trim() : null,
        dx4: row.dx4 ? String(row.dx4).trim() : null,
        dx5: row.dx5 ? String(row.dx5).trim() : null,
        income: Number(row.income || 0),
        status: row.status ? String(row.status).trim() : 'ยังไม่ได้ส่ง',
        rep: row.rep ? String(row.rep).trim() : null,
        compensated,
        isCompensated,
        seamlessPayno: row.seamless_payno ? String(row.seamless_payno).trim() : null,
        seamlessCompensated: row.seamless_compensated != null ? Number(row.seamless_compensated) : null,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, gw.seamlessFetcher, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Summary across summaryCohort
    const totalVisits = summaryCohort.length
    const uniquePatientSet = new Set<string>()
    let treatmentDrugCount = 0
    let treatmentMassageCount = 0
    let treatmentCompressCount = 0
    let treatmentOtherCount = 0
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let inHospCount = 0
    let outHospCount = 0
    let ucCount = 0
    let totalIncome = 0

    for (const item of summaryCohort) {
      if (item.hn) uniquePatientSet.add(item.hn)
      if (item.treatment1 === 'Y') treatmentDrugCount++
      if (item.treatment2 === 'Y') treatmentMassageCount++
      if (item.treatment3 === 'Y') treatmentCompressCount++
      if (
        item.treatment4 === 'Y' ||
        item.treatment5 === 'Y' ||
        item.treatment6 === 'Y' ||
        item.treatment7 === 'Y'
      ) {
        treatmentOtherCount++
      }
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCount++
      if (item.place === 'Y') inHospCount++
      else outHospCount++
      if (item.isUc) ucCount++
      totalIncome += item.income
    }

    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0

    const summary: Ttm3Summary = {
      totalVisits,
      uniquePatients: uniquePatientSet.size,
      treatmentDrugCount,
      treatmentMassageCount,
      treatmentCompressCount,
      treatmentOtherCount,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      inHospCount,
      outHospCount,
      ucCount,
      totalIncome,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Apply Filters
    let filtered = summaryCohort

    // 1. Card Filter
    if (cardFilter === 'TREATMENT_DRUG') {
      filtered = filtered.filter((i) => i.treatment1 === 'Y')
    } else if (cardFilter === 'TREATMENT_MASSAGE') {
      filtered = filtered.filter((i) => i.treatment2 === 'Y')
    } else if (cardFilter === 'TREATMENT_COMPRESS') {
      filtered = filtered.filter((i) => i.treatment3 === 'Y')
    } else if (cardFilter === 'TREATMENT_OTHER') {
      filtered = filtered.filter(
        (i) =>
          i.treatment4 === 'Y' ||
          i.treatment5 === 'Y' ||
          i.treatment6 === 'Y' ||
          i.treatment7 === 'Y'
      )
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    }

    // 2. Place Filter
    if (placeFilter === 'IN_HOSP') {
      filtered = filtered.filter((i) => i.place === 'Y')
    } else if (placeFilter === 'OUT_HOSP') {
      filtered = filtered.filter((i) => i.place === 'N')
    }

    // 3. Specific Treatment Type Filter ('1'..'7')
    if (treatmentType) {
      if (treatmentType === '1') filtered = filtered.filter((i) => i.treatment1 === 'Y')
      else if (treatmentType === '2') filtered = filtered.filter((i) => i.treatment2 === 'Y')
      else if (treatmentType === '3') filtered = filtered.filter((i) => i.treatment3 === 'Y')
      else if (treatmentType === '4') filtered = filtered.filter((i) => i.treatment4 === 'Y')
      else if (treatmentType === '5') filtered = filtered.filter((i) => i.treatment5 === 'Y')
      else if (treatmentType === '6') filtered = filtered.filter((i) => i.treatment6 === 'Y')
      else if (treatmentType === '7') filtered = filtered.filter((i) => i.treatment7 === 'Y')
    }

    // 5. Global Search across HN, CID, Name, VN, PDX, Authen Code, Rep, Treatment
    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    if (search) {
      filtered = filtered.filter((i) => {
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.pttypename && i.pttypename.toLowerCase().includes(search)) ||
          (i.herbDrugs && i.herbDrugs.toLowerCase().includes(search)) ||
          (i.treatmentNames && i.treatmentNames.toLowerCase().includes(search))
        )
      })
    }

    // 6. Sorting
    filtered.sort((a, b) => {
      let va: any = a[sortBy]
      let vb: any = b[sortBy]

      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()

      if (va < vb) return sortOrder === 'asc' ? -1 : 1
      if (va > vb) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index row numbers
    filtered.forEach((item, idx) => {
      item.no = idx + 1
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pagedItems = filtered
    if (!exportAll) {
      const startIndex = (page - 1) * pageSize
      pagedItems = filtered.slice(startIndex, startIndex + pageSize)
    }

    return {
      title: reportTitle,
      categoryTitle,
      ds1,
      ds2,
      cardFilter,
      place: placeFilter,
      ucOnly,
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
   * หัวข้อที่ 11: รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ
   * - ผู้ป่วยสิทธิบัตรทอง (UCS, WEL) ที่ได้รับยาสมุนไพร (ttmt_code is not null, sks_product_category_id in (4,3))
   * - ตรวจสอบยอดชดเชย REP และ REP Invoice
   */
  static async getReportTopic11(
    params: Ttm11ReportParams,
    gateway: Partial<TtmGatewayAdapter> = {}
  ): Promise<Ttm11ReportResult> {
    const gw = { ...defaultTtmGateway, ...gateway }
    const categoryTitle = 'บริการแพทย์แผนไทย และการแพทย์ทางเลือก'
    const reportTitle = 'รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: Ttm11CardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: Ttm11SortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ttm-topic11-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () =>
        ((await gw.getRcmExtraTtmTopic11Raw({
          startDate: ds1,
          endDate: ds2,
          refresh: Boolean(params.refresh),
        })) as any[]) || [],
      600000
    )

    // Map rows to typed items
    let allItems: Ttm11Item[] = (rawRows || []).map((row, idx) => {
      const drugItems: Ttm11DrugItem[] = []

      const compensated = Number(row.compensated || 0)
      const compensatedInvoice = row.compensated_invoice != null ? Number(row.compensated_invoice) : null
      const isCompensated = compensated > 0 || (compensatedInvoice != null && compensatedInvoice > 0)
      const hasInvoice = Boolean(row.rep_invoice)
      const hipdataCode = String(row.hipdata_code || '').trim().toUpperCase()
      const pttypename = String(row.pttypename || '').trim()
      const pttypeEclaimId = String(row.pttype_eclaim_id || '').trim()
      const isUc = checkIsUc(hipdataCode, pttypename, pttypeEclaimId)
      const hipdataLabel =
        hipdataCode === 'UCS'
          ? 'บัตรทอง (UCS)'
          : hipdataCode === 'WEL'
          ? 'ผู้มีรายได้น้อย/ผู้สูงอายุ (WEL)'
          : hipdataCode

      return {
        no: idx + 1,
        vn: String(row.vn || '').trim(),
        hn: String(row.hn || '').trim(),
        an: row.an ? String(row.an).trim() : null,
        cid: String(row.cid || '').trim(),
        ptname: String(row.ptname || '').trim(),
        sex: formatThaiSex(row.sex_code),
        birthday: row.birthday ? String(row.birthday).trim() : null,
        age: Number(row.age || 0),
        vstdate: String(row.vstdate || '').trim(),
        vsttime: String(row.vsttime || '').trim(),
        authCode: row.auth_code ? String(row.auth_code).trim() : null,
        authenEndpoint: row.authen_endpoint ? String(row.authen_endpoint).trim() : null,
        hipdataCode,
        hipdataLabel,
        pttype_eclaim_id: pttypeEclaimId,
        isUc,
        pttypename,
        department: row.department ? String(row.department).trim() : null,
        hospmain: row.hospmain ? String(row.hospmain).trim() : null,
        hospsub: row.hospsub ? String(row.hospsub).trim() : null,
        pdx: row.pdx ? String(row.pdx).trim() : null,
        dx0: row.dx0 ? String(row.dx0).trim() : null,
        dx1: row.dx1 ? String(row.dx1).trim() : null,
        dx2: row.dx2 ? String(row.dx2).trim() : null,
        dx3: row.dx3 ? String(row.dx3).trim() : null,
        dx4: row.dx4 ? String(row.dx4).trim() : null,
        dx5: row.dx5 ? String(row.dx5).trim() : null,
        income: Number(row.income || 0),
        drugNames: String(row.drug_names || '').trim(),
        ttmtCodes: String(row.ttmt_codes || '').trim(),
        totalQty: Number(row.total_qty || 0),
        totalDrugAmount: Number(row.total_drug_amount || 0),
        itemCount: Number(row.item_count || drugItems.length),
        drugItems,
        rep: row.rep ? String(row.rep).trim() : null,
        compensated,
        fund: row.fund ? String(row.fund).trim() : null,
        subfund: row.subfund ? String(row.subfund).trim() : null,
        errorcode: row.errorcode ? String(row.errorcode).trim() : null,
        repInvoice: row.rep_invoice ? String(row.rep_invoice).trim() : null,
        compensatedInvoice,
        isCompensated,
        hasInvoice,
        status: row.status ? String(row.status).trim() : 'ยังไม่ได้ส่ง',
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

    // Compute summary across summaryCohort
    const totalVisits = summaryCohort.length
    const uniquePatientSet = new Set<string>()
    let totalDispensedUnits = 0
    let totalDrugAmount = 0
    let compensatedVisits = 0
    let totalCompensated = 0
    let withAuthenCount = 0
    let ucsCount = 0
    let welCount = 0
    let invoiceCount = 0

    for (const item of summaryCohort) {
      if (item.hn) uniquePatientSet.add(item.hn)
      totalDispensedUnits += item.totalQty
      totalDrugAmount += item.totalDrugAmount
      if (item.isCompensated) {
        compensatedVisits++
        totalCompensated += item.compensated || item.compensatedInvoice || 0
      }
      if (item.authCode || item.authenEndpoint) withAuthenCount++
      if (item.hipdataCode === 'UCS') ucsCount++
      else if (item.hipdataCode === 'WEL') welCount++
      if (item.hasInvoice) invoiceCount++
    }

    const uncompensatedVisits = totalVisits - compensatedVisits
    const compensationRate = totalVisits > 0 ? (compensatedVisits / totalVisits) * 100 : 0
    const withoutAuthenCount = totalVisits - withAuthenCount
    const authenRate = totalVisits > 0 ? (withAuthenCount / totalVisits) * 100 : 0

    const summary: Ttm11Summary = {
      totalVisits,
      uniquePatients: uniquePatientSet.size,
      totalDispensedUnits,
      totalDrugAmount,
      compensatedVisits,
      uncompensatedVisits,
      compensationRate,
      totalCompensated,
      withAuthenCount,
      withoutAuthenCount,
      authenRate,
      ucsCount,
      welCount,
      invoiceCount,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Filter
    let filtered = summaryCohort

    // 1. Card Filter
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authCode || i.authenEndpoint))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authCode && !i.authenEndpoint)
    } else if (cardFilter === 'HIP_UCS') {
      filtered = filtered.filter((i) => i.hipdataCode === 'UCS')
    } else if (cardFilter === 'HIP_WEL') {
      filtered = filtered.filter((i) => i.hipdataCode === 'WEL')
    } else if (cardFilter === 'WITH_INVOICE') {
      filtered = filtered.filter((i) => i.hasInvoice)
    }

    // 2. Global Search
    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    if (search) {
      filtered = filtered.filter((i) => {
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.an && i.an.toLowerCase().includes(search)) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.authCode && i.authCode.toLowerCase().includes(search)) ||
          (i.authenEndpoint && i.authenEndpoint.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.repInvoice && i.repInvoice.toLowerCase().includes(search)) ||
          (i.drugNames && i.drugNames.toLowerCase().includes(search)) ||
          (i.ttmtCodes && i.ttmtCodes.toLowerCase().includes(search))
        )
      })
    }

    // 3. Sorting
    filtered.sort((a, b) => {
      let va: any = a[sortBy]
      let vb: any = b[sortBy]

      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()

      if (va < vb) return sortOrder === 'asc' ? -1 : 1
      if (va > vb) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index
    filtered.forEach((item, idx) => {
      item.no = idx + 1
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let pagedItems = filtered
    if (!exportAll) {
      const startIndex = (page - 1) * pageSize
      pagedItems = filtered.slice(startIndex, startIndex + pageSize)
    }

    return {
      title: reportTitle,
      categoryTitle,
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
   * Helper to fetch specific herbal medicines prescribed for a VN
   * (Matches Proc ShowDrug from FoxPro)
   */
  static async getVnHerbalDrugs(
    vn: string,
    gateway: Partial<TtmGatewayAdapter> = {}
  ): Promise<TtmHerbDrugItem[]> {
    const gw = { ...defaultTtmGateway, ...gateway }
    const cleanVn = (vn || '').trim()
    if (!cleanVn) return []

    const rows = ((await gw.getRcmExtraTtmVnHerbs(cleanVn)) as any[]) || []
    return rows.map((r) => ({
      icode: String(r.icode || '').trim(),
      drug: String(r.drug || '').trim(),
      name: String(r.name || '').trim(),
      strength: r.strength ? String(r.strength).trim() : null,
      units: r.units ? String(r.units).trim() : null,
      ttmt_code: String(r.ttmt_code || '').trim(),
      did: r.did ? String(r.did).trim() : null,
      category_id: r.category_id != null ? Number(r.category_id) : null,
      qty: Number(r.qty || 0),
      unitprice: Number(r.unitprice || 0),
      sumprice: Number(r.sumprice || 0),
    }))
  }
}
