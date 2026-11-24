import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
} from './rcmDashboardService'
import {
  defaultRcmFundGateway,
  extractFundRawRows,
  resolveSeamlessFetcher,
  type RcmFundGatewayAdapter,
} from './rcmFundGatewayHelper'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'
import {
  buildRepBreakdownSummary,
  matchesRepFilter,
  parseRepFilterParam,
  type RepBreakdownSummary,
} from './rcmRepTagHelper'

// ── Types: ค้นหาจากรหัส ADP (OPD & IPD) ──────────────────────────────

export type PatientType = 'OPD' | 'IPD'

export type AdpSearchCardFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'
  | 'WITH_OPERATION'

export interface AdpSearchReportParams extends FiscalDateRangeParams {
  patientType?: PatientType
  adpCode?: string
  cardFilter?: AdpSearchCardFilter
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  reps?: string
  ucOnly?: boolean
}

export interface AdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface AdpMappingCheck {
  adpCodes: string[]
  isMapped: boolean
  mappedCount: number
  items: AdpMappingItem[]
}

export interface AdpSearchItem {
  no: number
  patientType: PatientType
  vn: string
  hn: string
  an: string | null
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  vstdate: string
  vsttime?: string
  admdate?: string | null
  dchdate?: string | null
  pttype: string
  pttypename: string
  pttype_eclaim_id?: string
  hipdataCode?: string | null
  hospmain?: string | null
  hospsub?: string | null
  eclaimPttypeName?: string | null
  gfmis?: string | null
  accountcode?: string | null
  accountname?: string | null
  authCode?: string | null
  ovstist?: string | null
  ovstost?: string | null
  department?: string | null
  clinic?: string | null
  symptom?: string | null
  diag?: string | null
  pdx?: string | null
  pdxname?: string | null
  sdx?: string | null
  operation?: string | null
  proc?: string | null
  nhsoAdpCode: string
  icode: string
  name: string
  listname?: string | null
  income: number
  nee: number
  terminalid?: string | null
  approvalcode?: string | null
  seamless?: string | null
  compensatedseamless?: number
  authencode?: string | null
  authenMethod?: string | null
  authenContact?: string | null
  rep?: string | null
  invoiceclaim?: string | null
  fund?: string | null
  subfund?: string | null
  projectcode?: string | null
  remark?: string | null
  compensated: number
  isCompensated: boolean
  isUc: boolean
  hasAuthen: boolean
  hasOperation: boolean
}

export interface AdpSearchSummary {
  totalRecords: number
  uniquePatients: number
  totalIncome: number
  totalCompensated: number
  totalDebt: number
  compensatedCount: number
  uncompensatedCount: number
  compensationRate: number
  withAuthenCount: number
  withoutAuthenCount: number
  authenRate: number
  ucCount: number
  ucRate: number
  withOperationCount: number
}

export interface AdpSearchReportResult {
  patientType: PatientType
  adpCode: string
  ds1: string
  ds2: string
  cardFilter: AdpSearchCardFilter
  search: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: AdpSearchSummary
  repBreakdown?: RepBreakdownSummary
  adpMapping: AdpMappingCheck
  items: AdpSearchItem[]
}

// ── Common ADP Code Presets for Quick Selection ──────────────────────

export interface AdpPreset {
  code: string
  title: string
  category: string
}

export interface AdpOption {
  code: string
  title: string
  category: string
  mappedCount?: number
}

export const POPULAR_ADP_PRESETS: readonly AdpPreset[] = [
  { code: 'SPECC', title: 'ค่าบริการเก็บสิ่งส่งตรวจ Self test HPV / Projected code:SPECC', category: 'ตรวจทางห้องปฏิบัติการ' },
  { code: '14001', title: 'ยาเสริมธาตุเหล็ก (13-45 ปี)', category: 'ยา & เวชภัณฑ์' },
  { code: '12003', title: 'ตรวจ Fasting Plasma Glucose', category: 'ตรวจทางห้องปฏิบัติการ' },
  { code: '12004', title: 'ตรวจ Total Cholesterol / HDL', category: 'ตรวจทางห้องปฏิบัติการ' },
  { code: '90005', title: 'คัดกรองมะเร็งลำไส้ใหญ่ Fit test', category: 'คัดกรองมะเร็ง' },
  { code: '90004', title: 'คัดกรองรอยโรคมะเร็งช่องปาก (40+)', category: 'คัดกรองมะเร็ง' },
  { code: '1B005', title: 'ตรวจคัดกรองมะเร็งปากมดลูก HPV DNA', category: 'คัดกรองมะเร็ง' },
  { code: '1B004N', title: 'คัดกรองมะเร็งปากมดลูก ผลปกติ', category: 'คัดกรองมะเร็ง' },
  { code: '1B004P', title: 'คัดกรองมะเร็งปากมดลูก ผลผิดปกติ', category: 'คัดกรองมะเร็ง' },
  { code: '15001', title: 'เคลือบฟลูออไรด์ (กลุ่มเสี่ยง)', category: 'ทันตกรรม' },
  { code: '30011', title: 'ตรวจช่องปาก ขัดฟันหญิงตั้งครรภ์', category: 'แม่และเด็ก' },
  { code: '30015', title: 'ตรวจหลังคลอด', category: 'แม่และเด็ก' },
  { code: '30016', title: 'การจ่ายยา Triforine หลังคลอด', category: 'แม่และเด็ก' },
  { code: '31101', title: 'ตรวจการตั้งครรภ์ Pregnancy Test', category: 'แม่และเด็ก' },
  { code: '30014', title: 'ตรวจการตั้งครรภ์ UPT', category: 'แม่และเด็ก' },
  { code: '36318', title: 'ตรวจคัดกรองไวรัสตับอักเสบ B', category: 'คัดกรองโรคติดเชื้อ' },
  { code: '36319', title: 'ตรวจคัดกรองไวรัสตับอักเสบ C', category: 'คัดกรองโรคติดเชื้อ' },
  { code: '30313', title: 'คัดกรองธาลัสซีเมีย (DCIP / Hb typing)', category: 'ตรวจทางห้องปฏิบัติการ' },
  { code: 'H9449.1', title: 'บริการกายภาพบำบัดฟื้นฟู', category: 'ฟื้นฟูสมรรถภาพ' },
  { code: 'H0489', title: 'บริการฟื้นฟูสมรรถภาพทางการแพทย์', category: 'ฟื้นฟูสมรรถภาพ' },
  { code: 'TELMED', title: 'บริการแพทย์ทางไกล Telemedicine', category: 'บริการการแพทย์' },
  { code: 'DRUGP', title: 'จัดส่งยาทางไปรษณีย์', category: 'บริการการแพทย์' },
  { code: 'STEMI01', title: 'ยาละลายลิ่มเลือด Streptokinase', category: 'ยา & เวชภัณฑ์' },
] as const

// ── Helper: Parse ADP Codes ──────────────────────────────────────────

export function parseAdpCodes(rawInput?: string): string[] {
  if (!rawInput) return ['SPECC']
  const codes = rawInput
    .split(/[,;\s]+/)
    .map((c) => c.replace(/['"`]/g, '').trim())
    .filter(Boolean)
  return codes.length > 0 ? Array.from(new Set(codes)) : ['SPECC']
}

export function isUniversalCoverageScheme(maininscl?: string | null, pttypename?: string | null): boolean {
  const m = (maininscl || '').trim().toUpperCase()
  if (m === 'UCS' || m === 'WEL' || m === 'UC') return true
  const n = (pttypename || '').trim()
  if (
    n.includes('บัตรทอง') ||
    n.includes('ประกันสุขภาพถ้วนหน้า') ||
    n.includes('30 บาท') ||
    n.includes('ท.01') ||
    n.includes('ท.02') ||
    n.includes('ท.03')
  ) {
    return true
  }
  return false
}

// ── Service Implementation ───────────────────────────────────────────

export interface AdpSearchGatewayAdapter extends RcmFundGatewayAdapter {
  checkMultiAdpMapping?: (adpCodes: string[]) => Promise<{
    isMapped: boolean
    mappedCount: number
    items: Array<Record<string, any>>
  }>
  getAvailableAdpCodes?: () => Promise<{
    success?: boolean
    data: Array<{ code: string; title: string; mappedCount: number }>
  }>
}

const defaultAdpSearchGateway: AdpSearchGatewayAdapter = {
  ...defaultRcmFundGateway,
  checkMultiAdpMapping: (adpCodes) => apiGateway.clinical.checkMultiAdpMapping(adpCodes),
  getAvailableAdpCodes: () => apiGateway.clinical.getAvailableAdpCodes(),
}

export class RcmAdpSearchService {
  /**
   * Pre-check mapping of specified NHSO ADP Code(s) in `s_drugitems` table via API Gateway.
   */
  static async checkAdpMapping(
    adpCodes: string[],
    gateway: AdpSearchGatewayAdapter = defaultAdpSearchGateway,
    refresh = false
  ): Promise<AdpMappingCheck> {
    const cleanCodes = adpCodes.map((c) => c.trim()).filter(Boolean)
    if (cleanCodes.length === 0) {
      return {
        adpCodes: [],
        isMapped: false,
        mappedCount: 0,
        items: [],
      }
    }

    const cacheKey = `rcm:adp_search:mapping:${[...cleanCodes].sort().join('_')}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => {
        try {
          const gwRes = gateway.checkMultiAdpMapping
            ? await gateway.checkMultiAdpMapping(cleanCodes)
            : cleanCodes.length === 1
            ? await gateway.getAdpMapping(cleanCodes[0])
            : await defaultAdpSearchGateway.checkMultiAdpMapping!(cleanCodes)
          const items: AdpMappingItem[] = (gwRes?.items || []).map((r: any) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))
          return {
            adpCodes: cleanCodes,
            isMapped: items.length > 0,
            mappedCount: items.length,
            items,
          }
        } catch {
          return {
            adpCodes: cleanCodes,
            isMapped: false,
            mappedCount: 0,
            items: [],
          }
        }
      },
      600 // Cache for 10 minutes
    )
  }

  /**
   * Get available ADP code options, merging known presets with mapped codes in s_drugitems via API Gateway.
   */
  static async getAvailableAdpCodes(
    gateway: AdpSearchGatewayAdapter = defaultAdpSearchGateway,
    refresh = false
  ): Promise<AdpOption[]> {
    const cacheKey = 'rcm:adp_search:available_options'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => {
        try {
          const fn = gateway.getAvailableAdpCodes ?? defaultAdpSearchGateway.getAvailableAdpCodes!
          const gwRes = await fn()
          const rows = Array.isArray(gwRes?.data) ? gwRes.data : []
          const dbOptionsMap = new Map<string, { title: string; count: number }>()
          for (const r of rows) {
            const code = String(r.code || '').trim()
            if (code) {
              dbOptionsMap.set(code, {
                title: String(r.title || '').trim(),
                count: Number(r.mappedCount || 0),
              })
            }
          }

          const result: AdpOption[] = []
          const addedCodes = new Set<string>()

          for (const p of POPULAR_ADP_PRESETS) {
            const dbInfo = dbOptionsMap.get(p.code)
            result.push({
              code: p.code,
              title: p.title || dbInfo?.title || p.code,
              category: p.category,
              mappedCount: dbInfo?.count ?? 0,
            })
            addedCodes.add(p.code)
          }

          for (const [code, info] of dbOptionsMap.entries()) {
            if (!addedCodes.has(code)) {
              result.push({
                code,
                title: info.title || code,
                category: 'รายการในฐานข้อมูล รพ.',
                mappedCount: info.count,
              })
              addedCodes.add(code)
            }
          }

          return result
        } catch {
          return POPULAR_ADP_PRESETS.map((p) => ({
            code: p.code,
            title: p.title,
            category: p.category,
            mappedCount: 0,
          }))
        }
      },
      3600 // 1 hour cache
    )
  }

  /**
   * Main report query for OPD & IPD search by ADP Code via API Gateway.
   */
  static async getAdpSearchReport(
    params: AdpSearchReportParams = {},
    gateway: AdpSearchGatewayAdapter = defaultAdpSearchGateway
  ): Promise<AdpSearchReportResult> {
    const patientType: PatientType = params.patientType === 'IPD' ? 'IPD' : 'OPD'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const adpCodes = parseAdpCodes(params.adpCode)
    const cardFilter: AdpSearchCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy = params.sortBy || (patientType === 'IPD' ? 'dchdate' : 'vstdate')
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc'
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)
    const refresh = Boolean(params.refresh)

    // Check ADP mapping
    const adpMapping = await this.checkAdpMapping(adpCodes, gateway, refresh)

    // Fetch items based on patientType
    const rawItems =
      patientType === 'IPD'
        ? await this.fetchIpdRecords(ds1, ds2, adpCodes, gateway, refresh)
        : await this.fetchOpdRecords(ds1, ds2, adpCodes, gateway, refresh)

    const allItems = await enrichItemsWithSeamlessCache(
      `rcm:adp_search:${patientType}:${ds1}:${ds2}:${adpCodes.slice().sort().join('_')}`,
      rawItems,
      resolveSeamlessFetcher(gateway, defaultAdpSearchGateway),
      refresh
    )

    // Dual-mode summaryCohort filtering (pttypes takes precedence, ucOnly fallback)
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((it) =>
        matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, params.pttypes, it.isUc, it.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((it) => it.isUc)
    }

    // Compute summary over summaryCohort before filtering by cardFilter or search
    const summary = this.computeSummary(summaryCohort)
    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedRepsList = parseRepFilterParam(params.reps)

    // Apply Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((it) => it.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((it) => !it.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((it) => it.hasAuthen)
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((it) => !it.hasAuthen)
    } else if (cardFilter === 'UC_ONLY') {
      filtered = filtered.filter((it) => it.isUc)
    } else if (cardFilter === 'WITH_OPERATION') {
      filtered = filtered.filter((it) => it.hasOperation)
    }
    if (selectedRepsList.length > 0) {
      filtered = filtered.filter((it) => matchesRepFilter(it, selectedRepsList))
    }

    // Apply Global Search (HN, CID, Name, VN/AN, pttype, diag, icode, name, adp_code, seamless rep)
    if (search) {
      filtered = filtered.filter((it) => {
        return (
          matchesSeamlessRepSearch(it, search) ||
          it.hn.toLowerCase().includes(search) ||
          it.cid.toLowerCase().includes(search) ||
          it.ptname.toLowerCase().includes(search) ||
          it.vn.toLowerCase().includes(search) ||
          (it.an && it.an.toLowerCase().includes(search)) ||
          it.pttypename.toLowerCase().includes(search) ||
          it.nhsoAdpCode.toLowerCase().includes(search) ||
          it.icode.toLowerCase().includes(search) ||
          it.name.toLowerCase().includes(search) ||
          (it.diag && it.diag.toLowerCase().includes(search)) ||
          (it.pdx && it.pdx.toLowerCase().includes(search)) ||
          (it.pdxname && it.pdxname.toLowerCase().includes(search)) ||
          (it.department && it.department.toLowerCase().includes(search)) ||
          (it.clinic && it.clinic.toLowerCase().includes(search))
        )
      })
    }

    // Sort items
    filtered.sort((a, b) => {
      let valA: any = (a as any)[sortBy]
      let valB: any = (b as any)[sortBy]

      if (valA == null) valA = ''
      if (valB == null) valB = ''

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
    })

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    // Assign sequential numbering & paginate
    const paginatedItems = exportAll
      ? filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
      : filtered
          .slice((page - 1) * pageSize, page * pageSize)
          .map((item, idx) => ({ ...item, no: (page - 1) * pageSize + idx + 1 }))

    return {
      patientType,
      adpCode: adpCodes.join(', '),
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
      repBreakdown,
      adpMapping,
      items: paginatedItems,
    }
  }

  /**
   * OPD Query via API Gateway Named Endpoint.
   */
  private static async fetchOpdRecords(
    ds1: string,
    ds2: string,
    adpCodes: string[],
    gateway: AdpSearchGatewayAdapter,
    refresh = false
  ): Promise<AdpSearchItem[]> {
    if (adpCodes.length === 0) return []

    const cacheKey = `rcm:adp_search:opd:${ds1}:${ds2}:${[...adpCodes].sort().join('_')}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => {
        const gwRes = await gateway.getRcmFundData('adp-search', {
          ds1,
          ds2,
          patientType: 'OPD',
          adpCode: adpCodes.join(','),
        })
        const rows = extractFundRawRows(gwRes)

        return (rows || []).map((r: any, idx: number) => {
          const compensated = parseFloat(r.compensated || 0)
          const isCompensated = compensated > 0
          const authencode = r.authencode ? String(r.authencode).trim() : null
          const hasAuthen = Boolean(authencode && authencode !== '' && authencode !== '-')
          const pttypename = String(r.pttypename || '').trim()
          const hipdataCode = r.hipdata_code ? String(r.hipdata_code).trim() : null
          const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
          const isUc = (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) || isUniversalCoverageScheme(hipdataCode, pttypename)
          const diagStr = r.diag ? String(r.diag).trim() : null

          return {
            no: idx + 1,
            patientType: 'OPD' as PatientType,
            vn: String(r.vn || '').trim(),
            hn: String(r.hn || '').trim(),
            an: r.an ? String(r.an).trim() : null,
            cid: String(r.cid || '').trim(),
            ptname: String(r.ptname || '').trim(),
            sex: formatThaiSex(r.sex_code),
            birthday: r.birthday ? String(r.birthday).trim() : null,
            age: Number(r.age) || 0,
            vstdate: String(r.vstdate || '').trim(),
            vsttime: r.vsttime ? String(r.vsttime).trim() : undefined,
            admdate: null,
            dchdate: null,
            pttype: String(r.pttype || '').trim(),
            pttypename,
            pttype_eclaim_id: pttypeEclaimId,
            hipdataCode,
            hospmain: r.hospmain ? String(r.hospmain).trim() : null,
            hospsub: r.hospsub ? String(r.hospsub).trim() : null,
            eclaimPttypeName: r.pttype_eclaim_name ? String(r.pttype_eclaim_name).trim() : null,
            gfmis: r.gfmis ? String(r.gfmis).trim() : null,
            accountcode: r.accountcode ? String(r.accountcode).trim() : null,
            accountname: r.accountname ? String(r.accountname).trim() : null,
            authCode: r.auth_code ? String(r.auth_code).trim() : null,
            ovstist: r.ovstist ? String(r.ovstist).trim() : null,
            ovstost: r.ovstost ? String(r.ovstost).trim() : null,
            department: r.department ? String(r.department).trim() : null,
            clinic: r.clinic ? String(r.clinic).trim() : null,
            symptom: r.symptom ? String(r.symptom).trim() : null,
            diag: diagStr,
            pdx: null,
            pdxname: null,
            sdx: null,
            operation: r.operation ? String(r.operation).trim() : null,
            proc: null,
            nhsoAdpCode: String(r.nhso_adp_code || '').trim(),
            icode: String(r.icode || '').trim(),
            name: String(r.item_name || '').trim(),
            listname: r.listname ? String(r.listname).trim() : null,
            income: parseFloat(r.income || 0),
            nee: parseFloat(r.nee || 0),
            terminalid: r.terminalid ? String(r.terminalid).trim() : null,
            approvalcode: r.approvalcode ? String(r.approvalcode).trim() : null,
            seamless: r.seamless ? String(r.seamless).trim() : null,
            compensatedseamless: r.compensatedseamless ? parseFloat(r.compensatedseamless) : 0,
            authencode,
            authenMethod: r.authen_method ? String(r.authen_method).trim() : null,
            authenContact: r.authen_contact ? String(r.authen_contact).trim() : null,
            rep: r.rep ? String(r.rep).trim() : null,
            invoiceclaim: r.invoiceclaim ? String(r.invoiceclaim).trim() : null,
            fund: r.fund ? String(r.fund).trim() : null,
            subfund: r.subfund ? String(r.subfund).trim() : null,
            projectcode: r.projectcode ? String(r.projectcode).trim() : null,
            remark: r.remark ? String(r.remark).trim() : null,
            compensated,
            isCompensated,
            isUc,
            hasAuthen,
            hasOperation: Boolean(r.operation && String(r.operation).trim() !== '' && String(r.operation).trim() !== '-'),
          }
        })
      },
      300 // Cache 5 minutes
    )
  }

  /**
   * IPD Query via API Gateway Named Endpoint.
   */
  private static async fetchIpdRecords(
    ds1: string,
    ds2: string,
    adpCodes: string[],
    gateway: AdpSearchGatewayAdapter,
    refresh = false
  ): Promise<AdpSearchItem[]> {
    if (adpCodes.length === 0) return []

    const cacheKey = `rcm:adp_search:ipd:${ds1}:${ds2}:${[...adpCodes].sort().join('_')}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => {
        const gwRes = await gateway.getRcmFundData('adp-search', {
          ds1,
          ds2,
          patientType: 'IPD',
          adpCode: adpCodes.join(','),
        })
        const rows = extractFundRawRows(gwRes)

        return (rows || []).map((r: any, idx: number) => {
          const compensated = parseFloat(r.compensated || 0)
          const isCompensated = compensated > 0
          const pttypename = String(r.pttypename || '').trim()
          const hipdataCode = r.hipdata_code ? String(r.hipdata_code).trim() : null
          const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
          const isUc = (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) || isUniversalCoverageScheme(hipdataCode, pttypename)
          const procStr = r.proc_ops ? String(r.proc_ops).trim() : null
          const hasOperation = Boolean(procStr && procStr !== '' && procStr !== '-')

          return {
            no: idx + 1,
            patientType: 'IPD' as PatientType,
            vn: String(r.an || '').trim(), // Use AN as primary key identifier for IPD
            hn: String(r.hn || '').trim(),
            an: String(r.an || '').trim(),
            cid: String(r.cid || '').trim(),
            ptname: String(r.ptname || '').trim(),
            sex: formatThaiSex(r.sex_code),
            birthday: r.birthday ? String(r.birthday).trim() : null,
            age: Number(r.age) || 0,
            vstdate: String(r.dchdate || r.admdate || '').trim(),
            admdate: r.admdate ? String(r.admdate).trim() : null,
            dchdate: r.dchdate ? String(r.dchdate).trim() : null,
            pttype: String(r.pttype || '').trim(),
            pttypename,
            pttype_eclaim_id: pttypeEclaimId,
            hipdataCode,
            hospmain: null,
            hospsub: null,
            eclaimPttypeName: r.pttype_eclaim_name ? String(r.pttype_eclaim_name).trim() : null,
            gfmis: r.gfmis ? String(r.gfmis).trim() : null,
            accountcode: r.accountcode ? String(r.accountcode).trim() : null,
            accountname: r.accountname ? String(r.accountname).trim() : null,
            authCode: null,
            ovstist: null,
            ovstost: null,
            department: r.department ? String(r.department).trim() : null,
            clinic: null,
            symptom: null,
            diag: r.pdx ? String(r.pdx).trim() : null,
            pdx: r.pdx ? String(r.pdx).trim() : null,
            pdxname: r.pdxname ? String(r.pdxname).trim() : null,
            sdx: r.sdx ? String(r.sdx).trim() : null,
            operation: procStr,
            proc: procStr,
            nhsoAdpCode: String(r.nhso_adp_code || '').trim(),
            icode: String(r.icode || '').trim(),
            name: String(r.item_name || '').trim(),
            listname: r.listname ? String(r.listname).trim() : null,
            income: parseFloat(r.income || 0),
            nee: parseFloat(r.nee || 0),
            terminalid: null,
            approvalcode: null,
            seamless: null,
            compensatedseamless: 0,
            authencode: null,
            authenMethod: null,
            authenContact: null,
            rep: r.rep ? String(r.rep).trim() : null,
            invoiceclaim: r.invoiceclaim ? String(r.invoiceclaim).trim() : null,
            fund: r.fund ? String(r.fund).trim() : null,
            subfund: r.subfund ? String(r.subfund).trim() : null,
            projectcode: r.projectcode ? String(r.projectcode).trim() : null,
            remark: r.remark ? String(r.remark).trim() : null,
            compensated,
            isCompensated,
            isUc,
            hasAuthen: false,
            hasOperation,
          }
        })
      },
      300 // Cache 5 minutes
    )
  }

  /**
   * Calculate summary KPI metrics across items.
   */
  private static computeSummary(items: AdpSearchItem[]): AdpSearchSummary {
    const totalRecords = items.length
    const uniqueHns = new Set<string>()
    let totalIncome = 0
    let totalCompensated = 0
    let totalDebt = 0
    let compensatedCount = 0
    let withAuthenCount = 0
    let ucCount = 0
    let withOperationCount = 0

    for (const it of items) {
      if (it.hn) uniqueHns.add(it.hn)
      totalIncome += it.income
      totalCompensated += it.compensated
      totalDebt += it.nee

      if (it.isCompensated) compensatedCount++
      if (it.hasAuthen) withAuthenCount++
      if (it.isUc) ucCount++
      if (it.hasOperation) withOperationCount++
    }

    const uncompensatedCount = totalRecords - compensatedCount
    const compensationRate = totalRecords > 0 ? (compensatedCount / totalRecords) * 100 : 0
    const withoutAuthenCount = totalRecords - withAuthenCount
    const authenRate = totalRecords > 0 ? (withAuthenCount / totalRecords) * 100 : 0
    const ucRate = totalRecords > 0 ? (ucCount / totalRecords) * 100 : 0

    return {
      totalRecords,
      uniquePatients: uniqueHns.size,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalCompensated: Math.round(totalCompensated * 100) / 100,
      totalDebt: Math.round(totalDebt * 100) / 100,
      compensatedCount,
      uncompensatedCount,
      compensationRate: Math.round(compensationRate * 10) / 10,
      withAuthenCount,
      withoutAuthenCount,
      authenRate: Math.round(authenRate * 10) / 10,
      ucCount,
      ucRate: Math.round(ucRate * 10) / 10,
      withOperationCount,
    }
  }
}
