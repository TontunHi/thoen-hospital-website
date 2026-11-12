import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  type FiscalDateRangeParams,
  type QueryExecutor,
} from './rcmDashboardService'
import { isUniversalCoverageScheme } from './rcmOralCancerService'
import { matchesPttypeFilter } from './pttypeConstants'

// ── 1. Types & Constants ───────────────────────────────────────────────────────

export type ImcPatientType = 'IPD' | 'OPD'

export type ImcCardFilter =
  | 'ALL'
  | 'CHRONIC'
  | 'NOT_CHRONIC'
  | 'IN_WEB'
  | 'NOT_IN_WEB'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'

export type ImcSortField =
  | 'date'
  | 'an'
  | 'vn'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'income'
  | 'getprice'
  | 'compensated'
  | 'chronic'
  | 'web'
  | 'status'
  | 'rep'

export interface ImcReportParams extends FiscalDateRangeParams {
  patientType?: ImcPatientType
  cardFilter?: ImcCardFilter
  search?: string
  sortBy?: ImcSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  ucOnly?: boolean
}

export interface SeamlessRepBreakdown {
  rep: string
  fund: string | null
  type: string | null
  collected: number
  compensated: number
}

export interface ImcItem {
  no: number
  patientType: ImcPatientType
  vn: string | null
  an: string | null
  hn: string
  cid: string
  ptname: string
  age: number
  chronic: 'Y' | null
  web: 'Y' | null
  filetype: string
  date: string // vstdate for OPD, dchdate for IPD
  vstdate: string | null
  vsttime: string | null
  admdate: string | null
  dchdate: string | null
  los: number | null
  ward: string | null
  cc: string | null
  prediag: string | null
  authencode: string | null
  maininscl: string | null
  pttypename: string | null
  pttype_eclaim_id?: string | null
  department: string | null
  clinic: string | null
  ovstost: string | null
  dchstts: string | null
  dchtype: string | null
  dx: string | null
  op: string | null
  adjrw: number | null
  income: number
  status: string | null
  rep: string | null // e-Claim Rep (repeclaim → repdata → neweclaim → eclaimdb)
  compensated: number
  /** Seamless (DMIS) Reps จาก rcmdb.seamless จับคู่ด้วย VN (OPD) / AN (IPD) คั่นด้วย comma */
  repSeamless: string | null
  /** ยอดชดเชยจาก Seamless — แยกจาก compensated (e-Claim) เพื่อไม่ให้นับซ้ำ */
  compensatedSeamless: number
  /** ชื่อกองทุน Seamless (Fund) คั่นด้วย comma */
  seamlessFunds: string | null
  /** รายละเอียดยอดเงินแยกรายใบ Rep ของ Seamless */
  seamlessRepItems?: SeamlessRepBreakdown[]
  getprice: number // จากระบบ Web IMC (imc.amount)
  address: string | null
  tel: string | null
  isCompensated: boolean
  isUc: boolean
}

export interface ImcSummary {
  totalCases: number
  chronicCases: number
  chronicRate: number
  inWebCases: number
  inWebRate: number
  notInWebCases: number
  notInWebRate: number
  compensatedCases: number
  compensationRate: number
  totalCompensated: number
  totalGetprice: number
  totalIncome: number
  uncompensatedCases: number
  withAuthenCases: number
  withAuthenRate: number
  noAuthenCases: number
  ucCases: number
}

export interface ImcReportResult {
  categoryTitle: string
  subtopicTitle: string
  reportTitle: string
  patientType: ImcPatientType
  ds1: string
  ds2: string
  summary: ImcSummary
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
  cardFilter: ImcCardFilter
  search: string
  sortBy: ImcSortField
  sortOrder: 'asc' | 'desc'
  items: ImcItem[]
}

// ── 2. Service Implementation ─────────────────────────────────────────────────

export class RcmImcService {
  /**
   * สร้างรายงานรายชื่อผู้รับบริการตามเกณฑ์ IMC
   * หัวข้อ: กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์
   * หัวข้อย่อย: รายงานบริการผู้ป่วย IMC
   * หัวข้อย่อยอีก: รายชื่อผู้รับบริการตามเกณฑ์ IMC
   */
  static async getImcReport(
    params: ImcReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<ImcReportResult> {
    const categoryTitle = 'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์'
    const subtopicTitle = 'รายงานบริการผู้ป่วย IMC'
    const reportTitle = 'รายชื่อผู้รับบริการตามเกณฑ์ IMC'

    const patientType: ImcPatientType = params.patientType === 'OPD' ? 'OPD' : 'IPD'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: ImcCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: ImcSortField = params.sortBy || 'date'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-fund-imc-${patientType}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const safeExecute = async (sql: string, sqlParams: any[] = [], opts?: any) => {
      try {
        return (await executor(sql, sqlParams, opts)) || []
      } catch (err: unknown) {
        console.warn(
          '[RcmImcService] Query error:',
          err instanceof Error ? err.message : String(err)
        )
        return []
      }
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const baseRows = await (async () => {
          if (executor === queryClinicalDb) {
            try {
              const gwRes = await apiGateway.clinical.getRcmFundData('imc', { ds1, ds2, patientType })
              if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows) && gwRes.data.rawRows.length > 0) {
                return gwRes.data.rawRows
              }
            } catch {
              // Fallback to executor query
            }
          }

          if (patientType === 'IPD') {
            return await this.fetchIpdData(ds1, ds2, executor, safeExecute)
          }
          return await this.fetchOpdData(ds1, ds2, executor, safeExecute)
        })()

        // Seamless (DMIS) Reps เป็นช่องทางเบิกแยกจาก e-Claim → แนบเพิ่มหลังได้ base rows
        // ไม่ว่าจะมาจาก Gateway หรือ query ในเครื่อง
        return await this.attachSeamlessReps(baseRows, patientType, safeExecute)
      },
      300000 // Cache TTL 5 minutes
    )

    // ── 3. Transform & Structure Domain Items ──────────────────────────────────
    const allItems: ImcItem[] = (rawRows || []).map((r, idx) => {
      const compensatedVal = Number(r.compensated || 0)
      const isCompensated = compensatedVal > 0 || Boolean(r.rep && String(r.rep).trim() !== '')
      const isUc = isUniversalCoverageScheme(r.maininscl, r.pttypename)
      const chronicVal = r.chronic === 'Y' ? 'Y' : null
      const webVal = r.web === 'Y' ? 'Y' : null

      let filetype = r.filetype ? String(r.filetype).trim() : 'HOSxP'
      if (filetype === 'ตรงกันทั้ง 2 ระบบ' || (webVal === 'Y' && filetype.includes('HOSxP'))) {
        filetype = 'ตรงกันทั้ง 2 ระบบ'
      } else if (webVal === 'Y') {
        filetype = 'Web'
      } else {
        filetype = 'HOSxP'
      }

      return {
        no: idx + 1,
        patientType,
        vn: r.vn ? String(r.vn).trim() : null,
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        age: Number(r.age || 0),
        chronic: chronicVal,
        web: webVal,
        filetype,
        date: String(r.date || r.dchdate || r.vstdate || ''),
        vstdate: r.vstdate ? String(r.vstdate) : null,
        vsttime: r.vsttime ? String(r.vsttime) : null,
        admdate: r.admdate ? String(r.admdate) : null,
        dchdate: r.dchdate ? String(r.dchdate) : null,
        los: r.los != null ? Number(r.los) : null,
        ward: r.ward ? String(r.ward).trim() : null,
        cc: r.cc ? String(r.cc).trim() : null,
        prediag: r.prediag ? String(r.prediag).trim() : null,
        authencode: r.authencode ? String(r.authencode).trim() : null,
        maininscl: r.maininscl ? String(r.maininscl).trim() : null,
        pttypename: r.pttypename ? String(r.pttypename).trim() : null,
        pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        ovstost: r.ovstost ? String(r.ovstost).trim() : null,
        dchstts: r.dchstts ? String(r.dchstts).trim() : null,
        dchtype: r.dchtype ? String(r.dchtype).trim() : null,
        dx: r.dx ? String(r.dx).trim() : null,
        op: r.op ? String(r.op).trim() : null,
        adjrw: r.adjrw != null ? Number(r.adjrw) : null,
        income: Number(r.income || 0),
        status: r.status ? String(r.status).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: compensatedVal,
        repSeamless: r.rep_seamless ? String(r.rep_seamless).trim() : null,
        compensatedSeamless: Number(r.compensated_seamless || 0),
        seamlessFunds: r.seamless_funds ? String(r.seamless_funds).trim() : null,
        seamlessRepItems: Array.isArray(r.seamless_rep_items) ? r.seamless_rep_items : [],
        getprice: Number(r.getprice || 0),
        address: r.address ? String(r.address).trim() : null,
        tel: r.tel ? String(r.tel).trim() : null,
        isCompensated,
        isUc,
      }
    })

    // ── 4. Calculate Summary KPI ──────────────────────────────────────────────
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    const totalCases = summaryCohort.length
    const chronicCases = summaryCohort.filter((i) => i.chronic === 'Y').length
    const inWebCases = summaryCohort.filter((i) => i.web === 'Y').length
    const notInWebCases = totalCases - inWebCases

    const compensatedCases = summaryCohort.filter((i) => i.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const totalCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalGetprice = summaryCohort.reduce((acc, i) => acc + i.getprice, 0)
    const totalIncome = summaryCohort.reduce((acc, i) => acc + i.income, 0)

    const withAuthenCases = summaryCohort.filter((i) => Boolean(i.authencode)).length
    const noAuthenCases = totalCases - withAuthenCases
    const ucCases = summaryCohort.filter((i) => i.isUc).length

    const summary: ImcSummary = {
      totalCases,
      chronicCases,
      chronicRate: totalCases > 0 ? Number(((chronicCases / totalCases) * 100).toFixed(1)) : 0,
      inWebCases,
      inWebRate: totalCases > 0 ? Number(((inWebCases / totalCases) * 100).toFixed(1)) : 0,
      notInWebCases,
      notInWebRate: totalCases > 0 ? Number(((notInWebCases / totalCases) * 100).toFixed(1)) : 0,
      compensatedCases,
      compensationRate: totalCases > 0 ? Number(((compensatedCases / totalCases) * 100).toFixed(1)) : 0,
      totalCompensated,
      totalGetprice,
      totalIncome,
      uncompensatedCases,
      withAuthenCases,
      withAuthenRate: totalCases > 0 ? Number(((withAuthenCases / totalCases) * 100).toFixed(1)) : 0,
      noAuthenCases,
      ucCases,
    }

    // ── 5. Filtering ──────────────────────────────────────────────────────────
    let filtered = [...summaryCohort]

    if (cardFilter === 'CHRONIC') {
      filtered = filtered.filter((i) => i.chronic === 'Y')
    } else if (cardFilter === 'NOT_CHRONIC') {
      filtered = filtered.filter((i) => i.chronic !== 'Y')
    } else if (cardFilter === 'IN_WEB') {
      filtered = filtered.filter((i) => i.web === 'Y')
    } else if (cardFilter === 'NOT_IN_WEB') {
      filtered = filtered.filter((i) => i.web !== 'Y')
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((i) => !i.isCompensated)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => Boolean(i.authencode))
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.authencode)
    }

    // Global Search across all fields
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          (i.vn && i.vn.toLowerCase().includes(search)) ||
          (i.an && i.an.toLowerCase().includes(search)) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.dx && i.dx.toLowerCase().includes(search)) ||
          (i.op && i.op.toLowerCase().includes(search)) ||
          (i.ward && i.ward.toLowerCase().includes(search)) ||
          (i.department && i.department.toLowerCase().includes(search)) ||
          (i.clinic && i.clinic.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.repSeamless && i.repSeamless.toLowerCase().includes(search)) ||
          (i.status && i.status.toLowerCase().includes(search)) ||
          (i.pttypename && i.pttypename.toLowerCase().includes(search)) ||
          (i.address && i.address.toLowerCase().includes(search)) ||
          (i.tel && i.tel.toLowerCase().includes(search))
        )
      })
    }

    // ── 6. Sorting ────────────────────────────────────────────────────────────
    filtered.sort((a, b) => {
      const valA = a[sortBy] ?? ''
      const valB = b[sortBy] ?? ''

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comp = valA.localeCompare(valB, 'th')
        return sortOrder === 'asc' ? comp : -comp
      }

      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })

    // ── 7. Pagination ─────────────────────────────────────────────────────────
    const totalCount = filtered.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    let pagedItems: ImcItem[]
    if (exportAll) {
      pagedItems = filtered.map((item, idx) => ({ ...item, no: idx + 1 }))
    } else {
      const startIndex = (page - 1) * pageSize
      pagedItems = filtered.slice(startIndex, startIndex + pageSize).map((item, idx) => ({
        ...item,
        no: startIndex + idx + 1,
      }))
    }

    return {
      categoryTitle,
      subtopicTitle,
      reportTitle,
      patientType,
      ds1,
      ds2,
      summary,
      totalCount,
      totalPages,
      page,
      pageSize,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      items: pagedItems,
    }
  }

  /**
   * แนบเลข Rep และยอดเงินแยกรายใบจากระบบ Seamless (rcmdb.seamless) ให้แต่ละแถว
   * - IPD จับคู่ด้วย AN, OPD จับคู่ด้วย VN (ระดับ visit — ไม่ใช้ HN เพื่อไม่ให้ Rep ของครั้งอื่นปนมา)
   * - GROUP BY (VN/AN, Rep) เพื่อให้เห็นยอดขอเบิก/ชดเชยและรายการบริการแยกตามแต่ละเลข Rep
   * - ล้มเหลวแบบ graceful: query พังก็คืน rows เดิม (Seamless เป็นข้อมูลเสริม)
   */
  private static async attachSeamlessReps(
    rows: any[],
    patientType: ImcPatientType,
    safeExecute: (sql: string, params?: any[], opts?: any) => Promise<any[]>
  ): Promise<any[]> {
    if (!Array.isArray(rows) || rows.length === 0) return rows || []

    const keyField = patientType === 'IPD' ? 'an' : 'vn'
    const keyColumn = patientType === 'IPD' ? 'AN' : 'VN'
    const keys = Array.from(
      new Set(rows.map((r: any) => String(r?.[keyField] ?? '').trim()).filter(Boolean))
    )
    if (keys.length === 0) return rows

    const CHUNK_SIZE = 1000
    const chunks: string[][] = []
    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
      chunks.push(keys.slice(i, i + CHUNK_SIZE))
    }

    const results = await Promise.all(
      chunks.map((chunk) =>
        safeExecute(
          `
          SELECT
            ${keyColumn} AS k,
            Rep AS rep,
            GROUP_CONCAT(DISTINCT Fund ORDER BY Fund SEPARATOR ', ') AS fund,
            GROUP_CONCAT(DISTINCT Type ORDER BY Type SEPARATOR ', ') AS type,
            SUM(IFNULL(Collected, 0)) AS collected,
            SUM(IFNULL(Compensated, 0)) AS compensated,
            GROUP_CONCAT(DISTINCT Rep ORDER BY Rep SEPARATOR ',') AS rep_seamless,
            GROUP_CONCAT(DISTINCT Fund ORDER BY Fund SEPARATOR ',') AS seamless_funds,
            SUM(IFNULL(Compensated, 0)) AS compensated_seamless
          FROM rcmdb.seamless
          WHERE ${keyColumn} IN (${chunk.map(() => '?').join(',')})
            AND IFNULL(Rep, '') <> ''
          GROUP BY ${keyColumn}, Rep
          ORDER BY Rep ASC
          `,
          chunk,
          { timeoutMs: 15000 }
        )
      )
    )

    const seamlessMap = new Map<
      string,
      {
        reps: Set<string>
        funds: Set<string>
        totalCompensated: number
        items: SeamlessRepBreakdown[]
      }
    >()

    for (const resRows of results) {
      for (const s of resRows || []) {
        if (!s || s.k == null) continue
        const key = String(s.k).trim()
        if (!key) continue

        let entry = seamlessMap.get(key)
        if (!entry) {
          entry = { reps: new Set(), funds: new Set(), totalCompensated: 0, items: [] }
          seamlessMap.set(key, entry)
        }

        // รองรับทั้งแถวระดับ (k, rep) จาก SQL จริง และแถวระดับ k จาก test mock เดิม
        if (s.rep) {
          const repCode = String(s.rep).trim()
          const compVal = Number(s.compensated ?? s.compensated_seamless ?? 0)
          const collVal = Number(s.collected ?? 0)
          const fundVal = s.fund ? String(s.fund).trim() : s.seamless_funds ? String(s.seamless_funds).trim() : null
          const typeVal = s.type ? String(s.type).trim() : null

          entry.reps.add(repCode)
          if (fundVal) {
            for (const f of fundVal.split(',').map((x: string) => x.trim()).filter(Boolean)) {
              entry.funds.add(f)
            }
          }
          entry.totalCompensated = Math.round((entry.totalCompensated + compVal) * 100) / 100
          entry.items.push({
            rep: repCode,
            fund: fundVal,
            type: typeVal,
            collected: Math.round(collVal * 100) / 100,
            compensated: Math.round(compVal * 100) / 100,
          })
        } else if (s.rep_seamless) {
          const repList = String(s.rep_seamless)
            .split(',')
            .map((x: string) => x.trim())
            .filter(Boolean)
          const compVal = Number(s.compensated_seamless ?? s.compensated ?? 0)
          const fundVal = s.seamless_funds ? String(s.seamless_funds).trim() : null

          for (const rCode of repList) entry.reps.add(rCode)
          if (fundVal) {
            for (const f of fundVal.split(',').map((x: string) => x.trim()).filter(Boolean)) {
              entry.funds.add(f)
            }
          }
          entry.totalCompensated = Math.round((entry.totalCompensated + compVal) * 100) / 100
          for (let i = 0; i < repList.length; i++) {
            entry.items.push({
              rep: repList[i],
              fund: fundVal,
              type: null,
              collected: 0,
              compensated: repList.length === 1 ? Math.round(compVal * 100) / 100 : 0,
            })
          }
        }
      }
    }

    if (seamlessMap.size === 0) return rows

    return rows.map((row: any) => {
      const s = seamlessMap.get(String(row?.[keyField] ?? '').trim())
      if (!s || s.reps.size === 0) return row
      return {
        ...row,
        rep_seamless: Array.from(s.reps).join(','),
        seamless_funds: s.funds.size > 0 ? Array.from(s.funds).join(', ') : null,
        compensated_seamless: s.totalCompensated,
        seamless_rep_items: s.items,
      }
    })
  }

  /**
   * ดึงข้อมูลผู้ป่วยใน (IPD) ตามเกณฑ์ IMC (ICD-10 I60-I64, S06, S14/S24/S34, S720-S722)
   */
  private static async fetchIpdData(
    ds1: string,
    ds2: string,
    executor: QueryExecutor,
    safeExecute: (sql: string, params?: any[], opts?: any) => Promise<any[]>
  ): Promise<any[]> {
    // 1. Candidate Discovery: Web candidates from rcmdb.imc_service + HOSxP candidates matching IMC ICD-10
    const sqlWebCandidates = `
      SELECT DISTINCT s.an, s.amount AS getprice
      FROM rcmdb.imc_service s
      WHERE s.dchdate BETWEEN ? AND ? AND IFNULL(s.an, '') <> ''
    `

    const sqlHosxpCandidates = `
      SELECT DISTINCT i.an
      FROM ipt i
      JOIN iptdiag dx ON dx.an = i.an
      WHERE i.dchdate BETWEEN ? AND ?
        AND dx.icd10 REGEXP 'I6[0-4]|S06|S[1-3]4|S72[0-2]'
    `

    const [webRes, hosxpRes] = await Promise.all([
      safeExecute(sqlWebCandidates, [ds1, ds2], { timeoutMs: 30000 }),
      safeExecute(sqlHosxpCandidates, [ds1, ds2], { timeoutMs: 30000 }),
    ])

    const webRows = (webRes as any[]) || []
    const hosxpRows = (hosxpRes as any[]) || []

    const webPriceMap = new Map<string, number>()
    for (const r of webRows) {
      if (r.an) {
        webPriceMap.set(String(r.an).trim(), Number(r.getprice || 0))
      }
    }

    const candidateAns = Array.from(
      new Set([
        ...hosxpRows.map((r: any) => String(r.an || '').trim()),
        ...webRows.map((r: any) => String(r.an || '').trim()),
      ])
    ).filter(Boolean)

    if (candidateAns.length === 0) {
      return []
    }

    const anPlaceholders = candidateAns.map(() => '?').join(',')

    // 2. Fetch full visit details and diagnosis
    const sqlIpdDetails = `
      SELECT 
        i.an,
        i.hn,
        IFNULL(pt.cid, '') AS cid,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        IFNULL(a.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate)) AS age,
        IF(cm.hn IS NOT NULL, 'Y', NULL) AS chronic,
        w.name AS ward,
        DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
        DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
        DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS date,
        a.admdate AS los,
        i.prediag,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        IFNULL(ptt.hipdata_code, '') AS maininscl,
        CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
        ptt.pttype_eclaim_id,
        ds.name AS dchstts,
        dt.name AS dchtype,
        (
          SELECT GROUP_CONCAT(CONCAT(dx.icd10, ': ', IFNULL(i10.name, '')) ORDER BY dx.diagtype ASC SEPARATOR ', ')
          FROM iptdiag dx
          LEFT JOIN icd101 i10 ON i10.code = dx.icd10
          WHERE dx.an = i.an
        ) AS dx,
        (
          SELECT GROUP_CONCAT(CONCAT(od.icd9, ': ', IFNULL(i9.name, '')) SEPARATOR ', ')
          FROM iptoprt od
          LEFT JOIN icd9cm1 i9 ON i9.code = od.icd9
          WHERE od.an = i.an
        ) AS op,
        i.adjrw,
        a.income,
        CONCAT(
          IFNULL(pt.addrpart, ''),
          IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
          IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
          IF(tmb.name IS NOT NULL, CONCAT(' ต.', tmb.name), ''),
          IF(amp.name IS NOT NULL, CONCAT(' อ.', amp.name), '')
        ) AS address,
        COALESCE(
          NULLIF(TRIM(pt.mobile_phone_number), ''),
          NULLIF(TRIM(pt.informtel), ''),
          NULLIF(TRIM(pt.hometel), ''),
          NULLIF(TRIM(pt.worktel), ''),
          ''
        ) AS tel
      FROM ipt i
      LEFT JOIN patient pt ON pt.hn = i.hn
      LEFT JOIN an_stat a ON a.an = i.an
      LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
      LEFT JOIN ward w ON w.ward = i.ward
      LEFT JOIN dchstts ds ON ds.dchstts = i.dchstts
      LEFT JOIN dchtype dt ON dt.dchtype = i.dchtype
      LEFT JOIN rcmdb.authencode cc ON (cc.vn = i.an OR cc.vn = i.vn)
      LEFT JOIN visit_pttype vt ON vt.vn = i.vn
      LEFT JOIN thaiaddress tmb ON tmb.chwpart = pt.chwpart AND tmb.amppart = pt.amppart AND tmb.tmbpart = pt.tmbpart
      LEFT JOIN thaiaddress amp ON amp.chwpart = pt.chwpart AND amp.amppart = pt.amppart AND amp.tmbpart = '00'
      LEFT JOIN clinicmember cm ON cm.hn = i.hn
        AND cm.clinic IN (
          SELECT clinic FROM clinic 
          WHERE name LIKE '%stroke%' OR name LIKE '%หลอดเลือดสมอง%' OR clinic = '023'
        )
      WHERE i.an IN (${anPlaceholders})
      GROUP BY i.an
      ORDER BY i.dchdate DESC;
    `

    // 3. NHSO, REP, eClaim reconciliation queries (department = 'IP')
    const sqlNhso = `
      SELECT an, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
             'NHSO :: มี Invoice แล้ว' AS statusname
      FROM rcmdb.repeclaim
      WHERE department = 'IP' AND an IN (${anPlaceholders})
        AND (errorcode = '' OR errorcode IS NULL)
      GROUP BY an
    `

    const sqlRep = `
      SELECT an,
             GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
             SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
             IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: มี Rep แล้ว', NULL) AS statusname
      FROM rcmdb.repdata
      WHERE department = 'IP' AND an IN (${anPlaceholders})
      GROUP BY an
    `

    const sqlNewEclaim = `
      SELECT Seq AS an, Rep AS rep, Income AS compensated, StatusName AS statusname
      FROM rcmdb.neweclaim
      WHERE Seq IN (${anPlaceholders})
    `

    const sqlEclaim = `
      SELECT m.an,
             SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
             SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
             SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
      FROM eclaimdb.m_registerdata m
      LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
      WHERE m.person_type = '2' AND m.an IN (${anPlaceholders})
      GROUP BY m.an
    `

    const [detailsRes, nhsoRes, repRes, newEclaimRes, eclaimRes] = await Promise.all([
      safeExecute(sqlIpdDetails, candidateAns, { timeoutMs: 30000 }),
      safeExecute(sqlNhso, candidateAns, { timeoutMs: 15000 }),
      safeExecute(sqlRep, candidateAns, { timeoutMs: 15000 }),
      safeExecute(sqlNewEclaim, candidateAns, { timeoutMs: 15000 }),
      safeExecute(sqlEclaim, candidateAns, { timeoutMs: 15000 }),
    ])

    const detailRows = (detailsRes as any[]) || []
    const nhsoMap = new Map((nhsoRes as any[] || []).map((r: any) => [String(r.an), r]))
    const repMap = new Map((repRes as any[] || []).map((r: any) => [String(r.an), r]))
    const newEclaimMap = new Map((newEclaimRes as any[] || []).map((r: any) => [String(r.an), r]))
    const eclaimMap = new Map((eclaimRes as any[] || []).map((r: any) => [String(r.an), r]))

    const hosxpAnSet = new Set(hosxpRows.map((r: any) => String(r.an || '').trim()))

    return detailRows.map((row: any) => {
      const anStr = String(row.an)
      const nhso = nhsoMap.get(anStr)
      const rep = repMap.get(anStr)
      const nn = newEclaimMap.get(anStr)
      const m = eclaimMap.get(anStr)

      const status = nhso?.statusname || rep?.statusname || nn?.statusname || m?.statusname || null
      const repNo = nhso?.rep || rep?.rep || nn?.rep || m?.rep || null
      const comp = Number(nhso?.compensated ?? rep?.compensated ?? nn?.compensated ?? m?.compensated ?? 0)

      const inHosxp = hosxpAnSet.has(anStr)
      const inWeb = webPriceMap.has(anStr)
      const getprice = webPriceMap.get(anStr) ?? 0

      return {
        ...row,
        web: inWeb ? 'Y' : null,
        filetype: inHosxp && inWeb ? 'ตรงกันทั้ง 2 ระบบ' : inWeb ? 'Web' : 'HOSxP',
        getprice,
        status,
        rep: repNo,
        compensated: comp,
      }
    })
  }

  /**
   * ดึงข้อมูลผู้ป่วยนอก (OPD) ตามเกณฑ์ IMC (ICD-10 I60-I64, S06, S14/S24/S34, S720-S722)
   */
  private static async fetchOpdData(
    ds1: string,
    ds2: string,
    executor: QueryExecutor,
    safeExecute: (sql: string, params?: any[], opts?: any) => Promise<any[]>
  ): Promise<any[]> {
    // 1. Candidate Discovery: Web candidates from rcmdb.imc_service + HOSxP candidates matching IMC ICD-10
    const sqlWebCandidates = `
      SELECT DISTINCT s.vn, s.amount AS getprice
      FROM rcmdb.imc_service s
      WHERE s.vstdate BETWEEN ? AND ? AND IFNULL(s.vn, '') <> ''
    `

    const sqlHosxpCandidates = `
      SELECT DISTINCT o.vn
      FROM ovst o
      JOIN ovstdiag dx ON dx.vn = o.vn
      WHERE o.vstdate BETWEEN ? AND ?
        AND dx.icd10 REGEXP 'I6[0-4]|S06|S[1-3]4|S72[0-2]'
    `

    const [webRes, hosxpRes] = await Promise.all([
      safeExecute(sqlWebCandidates, [ds1, ds2], { timeoutMs: 30000 }),
      safeExecute(sqlHosxpCandidates, [ds1, ds2], { timeoutMs: 30000 }),
    ])

    const webRows = (webRes as any[]) || []
    const hosxpRows = (hosxpRes as any[]) || []

    const webPriceMap = new Map<string, number>()
    for (const r of webRows) {
      if (r.vn) {
        webPriceMap.set(String(r.vn).trim(), Number(r.getprice || 0))
      }
    }

    const candidateVns = Array.from(
      new Set([
        ...hosxpRows.map((r: any) => String(r.vn || '').trim()),
        ...webRows.map((r: any) => String(r.vn || '').trim()),
      ])
    ).filter(Boolean)

    if (candidateVns.length === 0) {
      return []
    }

    const vnPlaceholders = candidateVns.map(() => '?').join(',')

    // 2. Fetch full visit details and diagnosis
    const sqlOpdDetails = `
      SELECT 
        o.vn,
        o.an,
        o.hn,
        IFNULL(pt.cid, '') AS cid,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
        IF(cm.hn IS NOT NULL, 'Y', NULL) AS chronic,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        s.cc,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        IFNULL(ptt.hipdata_code, '') AS maininscl,
        CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
        ptt.pttype_eclaim_id,
        IFNULL(dep.department, o.main_dep) AS department,
        IFNULL(spc.name, o.spclty) AS clinic,
        ost.name AS ovstost,
        (
          SELECT GROUP_CONCAT(CONCAT(dx.icd10, ': ', IFNULL(i10.name, '')) ORDER BY dx.diagtype ASC SEPARATOR ', ')
          FROM ovstdiag dx
          LEFT JOIN icd101 i10 ON i10.code = dx.icd10
          WHERE dx.vn = o.vn
        ) AS dx,
        (
          SELECT GROUP_CONCAT(CONCAT(od.icd9, ': ', IFNULL(i9.name, '')) SEPARATOR ', ')
          FROM doctor_operation od
          LEFT JOIN icd9cm1 i9 ON i9.code = od.icd9
          WHERE od.vn = o.vn
        ) AS op,
        v.income,
        CONCAT(
          IFNULL(pt.addrpart, ''),
          IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
          IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
          IF(tmb.name IS NOT NULL, CONCAT(' ต.', tmb.name), ''),
          IF(amp.name IS NOT NULL, CONCAT(' อ.', amp.name), '')
        ) AS address,
        COALESCE(
          NULLIF(TRIM(pt.mobile_phone_number), ''),
          NULLIF(TRIM(pt.informtel), ''),
          NULLIF(TRIM(pt.hometel), ''),
          NULLIF(TRIM(pt.worktel), ''),
          ''
        ) AS tel
      FROM ovst o
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN opdscreen s ON s.vn = o.vn
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
      LEFT JOIN spclty spc ON spc.spclty = o.spclty
      LEFT JOIN ovstost ost ON ost.ovstost = o.ovstost
      LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
      LEFT JOIN visit_pttype vt ON vt.vn = o.vn
      LEFT JOIN thaiaddress tmb ON tmb.chwpart = pt.chwpart AND tmb.amppart = pt.amppart AND tmb.tmbpart = pt.tmbpart
      LEFT JOIN thaiaddress amp ON amp.chwpart = pt.chwpart AND amp.amppart = pt.amppart AND amp.tmbpart = '00'
      LEFT JOIN clinicmember cm ON cm.hn = o.hn
        AND cm.clinic IN (
          SELECT clinic FROM clinic 
          WHERE name LIKE '%stroke%' OR name LIKE '%หลอดเลือดสมอง%' OR clinic = '023'
        )
      WHERE o.vn IN (${vnPlaceholders})
      GROUP BY o.vn
      ORDER BY o.vstdate DESC, o.vsttime DESC;
    `

    // 3. NHSO, REP, eClaim reconciliation queries (department = 'OP')
    const sqlNhso = `
      SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
             'NHSO :: มี Invoice แล้ว' AS statusname
      FROM rcmdb.repeclaim
      WHERE department = 'OP' AND vn IN (${vnPlaceholders})
        AND (errorcode = '' OR errorcode IS NULL)
      GROUP BY vn
    `

    const sqlRep = `
      SELECT vn,
             GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
             SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
             IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: มี Rep แล้ว', NULL) AS statusname
      FROM rcmdb.repdata
      WHERE department = 'OP' AND vn IN (${vnPlaceholders})
      GROUP BY vn
    `

    const sqlNewEclaim = `
      SELECT Seq AS vn, Rep AS rep, Income AS compensated, StatusName AS statusname
      FROM rcmdb.neweclaim
      WHERE Seq IN (${vnPlaceholders})
    `

    const sqlEclaim = `
      SELECT m.opdseq AS vn,
             SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
             SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
             SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
      FROM eclaimdb.m_registerdata m
      LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
      WHERE m.person_type = '1' AND m.opdseq IN (${vnPlaceholders})
      GROUP BY m.opdseq
    `

    const [detailsRes, nhsoRes, repRes, newEclaimRes, eclaimRes] = await Promise.all([
      safeExecute(sqlOpdDetails, candidateVns, { timeoutMs: 30000 }),
      safeExecute(sqlNhso, candidateVns, { timeoutMs: 15000 }),
      safeExecute(sqlRep, candidateVns, { timeoutMs: 15000 }),
      safeExecute(sqlNewEclaim, candidateVns, { timeoutMs: 15000 }),
      safeExecute(sqlEclaim, candidateVns, { timeoutMs: 15000 }),
    ])

    const detailRows = (detailsRes as any[]) || []
    const nhsoMap = new Map((nhsoRes as any[] || []).map((r: any) => [String(r.vn), r]))
    const repMap = new Map((repRes as any[] || []).map((r: any) => [String(r.vn), r]))
    const newEclaimMap = new Map((newEclaimRes as any[] || []).map((r: any) => [String(r.vn), r]))
    const eclaimMap = new Map((eclaimRes as any[] || []).map((r: any) => [String(r.vn), r]))

    const hosxpVnSet = new Set(hosxpRows.map((r: any) => String(r.vn || '').trim()))

    return detailRows.map((row: any) => {
      const vnStr = String(row.vn)
      const nhso = nhsoMap.get(vnStr)
      const rep = repMap.get(vnStr)
      const nn = newEclaimMap.get(vnStr)
      const m = eclaimMap.get(vnStr)

      const status = nhso?.statusname || rep?.statusname || nn?.statusname || m?.statusname || null
      const repNo = nhso?.rep || rep?.rep || nn?.rep || m?.rep || null
      const comp = Number(nhso?.compensated ?? rep?.compensated ?? nn?.compensated ?? m?.compensated ?? 0)

      const inHosxp = hosxpVnSet.has(vnStr)
      const inWeb = webPriceMap.has(vnStr)
      const getprice = webPriceMap.get(vnStr) ?? 0

      return {
        ...row,
        web: inWeb ? 'Y' : null,
        filetype: inHosxp && inWeb ? 'ตรงกันทั้ง 2 ระบบ' : inWeb ? 'Web' : 'HOSxP',
        getprice,
        status,
        rep: repNo,
        compensated: comp,
      }
    })
  }
}
