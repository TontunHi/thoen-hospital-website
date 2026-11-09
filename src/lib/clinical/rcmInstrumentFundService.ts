import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
  type QueryExecutor,
} from './rcmDashboardService'
import { isUniversalCoverageScheme } from './rcmOralCancerService'
import { matchesPttypeFilter, isUcEclaimCode } from './pttypeConstants'

// ── 1. Types & Interfaces ───────────────────────────────────────────────────

export type InstrumentPatientType = 'OPD' | 'IPD'

export type InstrumentCardFilter =
  | 'ALL'
  | 'OA'
  | 'DM'
  | 'OTHER'
  | 'COMPENSATED'
  | 'INVOICE'
  | 'REP'
  | 'UNSENT'
  | 'DISCREPANCY'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type InstrumentSortField =
  | 'date'
  | 'time'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'vn'
  | 'an'
  | 'room'
  | 'ward'
  | 'pttypename'
  | 'instrument'
  | 'money_hosxp'
  | 'debit'
  | 'money_eclaim'
  | 'money_rep'
  | 'money_invoice'
  | 'diff_money'
  | 'status'
  | 'authencode'

export interface InstrumentItemParsedItem {
  adpCode: string
  name: string
  price: number
}

export interface InstrumentItem {
  no: number
  patientType: InstrumentPatientType
  vn?: string
  an?: string
  hn: string
  cid: string
  ptname: string
  sex: string
  vstdate?: string
  vsttime?: string
  admdate?: string
  dchdate?: string
  date: string
  time?: string
  room?: string | null
  ward?: string | null
  inscl: string | null
  pttypename: string
  authencode: string | null
  money_hosxp: number
  discount_money: number
  rcpt_money: number
  debit: number
  rcpno: string | null
  instrument: number
  list: string | null
  items: InstrumentItemParsedItem[]
  oa: 'Y' | null
  dm: 'Y' | null
  itemCount: number
  money_eclaim: number
  money_rep: number
  money_invoice: number
  diff_money: number
  eclaim_status: string | null
  status: string
  statusCode: 'INVOICE' | 'REP' | 'ECLAIM' | 'UNSENT'
  isDiscrepancy: boolean
  isCompensated: boolean
  isUc: boolean
  pttype_eclaim_id?: string
}

export interface InstrumentSummary {
  totalCases: number
  totalUniquePatients: number
  totalInstrumentHosp: number
  totalDebit: number
  oaCases: number
  oaAmount: number
  dmCases: number
  dmAmount: number
  otherCases: number
  otherAmount: number
  compensatedCases: number
  totalCompensated: number
  invoiceCases: number
  invoiceAmount: number
  repCases: number
  repAmount: number
  unsentCases: number
  unsentAmount: number
  discrepancyCases: number
  authenCases: number
  authenRate: number
  ucCases: number
  ucRate: number
}

export interface InstrumentAdpMappingItem {
  icode: string
  name: string
  nhso_adp_code: string
  nhso_adp_type_id?: number
}

export interface InstrumentAdpMappingCheck {
  isMapped: boolean
  mappedCount: number
  items: InstrumentAdpMappingItem[]
}

export interface InstrumentReportParams extends FiscalDateRangeParams {
  patientType?: InstrumentPatientType
  cardFilter?: InstrumentCardFilter
  search?: string
  sortBy?: InstrumentSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  ucOnly?: boolean
}

export interface InstrumentReportResponse {
  items: InstrumentItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  summary: InstrumentSummary
  dateRange: {
    startDate: string
    endDate: string
  }
  adpMapping: InstrumentAdpMappingCheck
}

// ── 2. Helper Functions ─────────────────────────────────────────────────────

/**
 * แปลงสตริงรายการอุปกรณ์ที่ GROUP_CONCAT มา เช่น
 * "7004:ข้อเข่าเทียม#12000.00, 7005:เบ้ารองข้อเข่า#5000.00"
 * ให้เป็น Array ของ Object เพื่อนำไปแสดงผลสวยงามใน Modal และตาราง
 */
export function parseInstrumentItemList(rawList: string | null | undefined): InstrumentItemParsedItem[] {
  if (!rawList || typeof rawList !== 'string') return []
  const parts = rawList.split(',').map((p) => p.trim()).filter(Boolean)
  const result: InstrumentItemParsedItem[] = []

  for (const part of parts) {
    // format: adpCode:name#price
    const hashIdx = part.lastIndexOf('#')
    let mainPart = part
    let price = 0
    if (hashIdx !== -1) {
      price = parseFloat(part.slice(hashIdx + 1).replace(/,/g, '')) || 0
      mainPart = part.slice(0, hashIdx).trim()
    }
    const colonIdx = mainPart.indexOf(':')
    if (colonIdx !== -1) {
      const adpCode = mainPart.slice(0, colonIdx).trim()
      const name = mainPart.slice(colonIdx + 1).trim()
      result.push({ adpCode, name, price })
    } else {
      result.push({ adpCode: '-', name: mainPart, price })
    }
  }

  return result
}

/**
 * ตัดเครื่องหมายคำพูดรอบเลขที่ใบเสร็จ
 */
function cleanRcpno(rcpno: string | null | undefined): string | null {
  if (!rcpno) return null
  const cleaned = rcpno.replace(/["']/g, '').trim()
  return cleaned.length > 0 ? cleaned : null
}

// ── 3. Main Service ─────────────────────────────────────────────────────────

export class RcmInstrumentFundService {
  /**
   * ตรวจสอบว่าในระบบ HOSxP มีการ Map ADP Code ประเภทอวัยวะเทียมและอุปกรณ์ (nhso_adp_type_id = 2) หรือไม่
   */
  static async checkAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh = false
  ): Promise<InstrumentAdpMappingCheck> {
    const cacheKey = 'rcm:instrument:adp-mapping-check'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    return getCachedData(
      cacheKey,
      async () => {
        if (executor === queryClinicalDb) {
          try {
            const gwRes = await apiGateway.clinical.getAdpMapping('INSTRUMENT')
            if (gwRes && typeof gwRes.isMapped === 'boolean') {
              return {
                isMapped: gwRes.isMapped,
                mappedCount: gwRes.mappedCount,
                items: (gwRes.items || []).map((r: any) => ({
                  icode: String(r.icode || ''),
                  name: String(r.name || ''),
                  nhso_adp_code: String(r.nhso_adp_code || ''),
                  nhso_adp_type_id: Number(r.nhso_adp_type_id || 2),
                })),
              }
            }
          } catch {
            // Fallback to executor query
          }
        }

        try {
          const sql = `
            SELECT icode, name, nhso_adp_code, nhso_adp_type_id
            FROM nondrugitems
            WHERE nhso_adp_type_id = 2
            ORDER BY nhso_adp_code ASC
          `
          const rows = (await executor(sql, [], { timeoutMs: 15000 })) as any[]
          const items: InstrumentAdpMappingItem[] = (rows || []).map((r) => ({
            icode: String(r.icode || ''),
            name: String(r.name || ''),
            nhso_adp_code: String(r.nhso_adp_code || ''),
            nhso_adp_type_id: Number(r.nhso_adp_type_id || 2),
          }))

          return {
            isMapped: items.length > 0,
            mappedCount: items.length,
            items,
          }
        } catch {
          return {
            isMapped: true, // Graceful fallback
            mappedCount: 0,
            items: [],
          }
        }
      },
      86400000 // Cache 24 hours
    )
  }

  /**
   * ดึงข้อมูลรายงานรายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์ (ทั้ง OPD และ IPD)
   */
  static async getReportData(
    params: InstrumentReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<InstrumentReportResponse> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const patientType: InstrumentPatientType = params.patientType === 'IPD' ? 'IPD' : 'OPD'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(10, Number(params.pageSize || 50)))
    const cardFilter: InstrumentCardFilter = params.cardFilter || 'ALL'
    const search = params.search ? params.search.trim().toLowerCase() : ''
    const sortBy: InstrumentSortField = params.sortBy || 'date'
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc'
    const exportAll = Boolean(params.exportAll)
    const refresh = Boolean(params.refresh)

    const cacheKey = `rcm:instrument-fund:${patientType}:${ds1}:${ds2}`
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    // ขนานการดึง Check ADP Mapping พร้อม Query หลัก
    const [rawRows, adpMapping] = await Promise.all([
      getCachedData(
        cacheKey,
        async () => {
          if (executor === queryClinicalDb) {
            try {
              const gwRes = await apiGateway.clinical.getRcmFundData('instrument', { ds1, ds2, patientType })
              if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows)) {
                return gwRes.data.rawRows
              }
            } catch {
              // Fallback to executor query
            }
          }

          if (patientType === 'OPD') {
            const opdSql = `
              SELECT
                o.vn,
                pt.cid,
                o.hn,
                CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS ptname,
                pt.sex AS sex_code,
                DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
                DATE_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
                ptt.hipdata_code AS inscl,
                ptt.name AS pttypename,
                IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
                dep.department AS room,
                COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
                v.income AS money_hosxp,
                v.discount_money,
                v.rcpt_money,
                (v.income - v.discount_money - v.rcpt_money) AS debit,
                v.rcpno_list AS rcpno,
                inst.instrument,
                inst.list,
                inst.oa,
                inst.dm,
                inst.item_count,
                COALESCE(e.eclaim_money, 0) AS money_eclaim,
                COALESCE(r.income, 0) AS money_rep,
                COALESCE(n.income, 0) AS money_invoice,
                e.status AS eclaim_status,
                e.statusname AS eclaim_statusname
              FROM ovst o
              JOIN (
                SELECT
                  oo.vn,
                  SUM(oo.sum_price) AS instrument,
                  COUNT(DISTINCT oo.icode) AS item_count,
                  GROUP_CONCAT(DISTINCT CONCAT(d.nhso_adp_code, ':', d.name, '#', ROUND(oo.sum_price, 2)) SEPARATOR ', ') AS list,
                  MAX(IF(d.nhso_adp_code REGEXP '^700[4-5]', 'Y', NULL)) AS oa,
                  MAX(IF(d.nhso_adp_code REGEXP '^8612|^8813|^8814', 'Y', NULL)) AS dm
                FROM (
                  SELECT icode, nhso_adp_code, name
                  FROM nondrugitems
                  WHERE nhso_adp_type_id = 2
                ) d
                JOIN opitemrece oo ON oo.icode = d.icode
                WHERE oo.vstdate BETWEEN ? AND ?
                  AND IFNULL(oo.vn, '') <> ''
                GROUP BY oo.vn
              ) inst ON inst.vn = o.vn
              LEFT JOIN patient pt ON pt.hn = o.hn
              LEFT JOIN vn_stat v ON v.vn = o.vn
              LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
              LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
              LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
              LEFT JOIN visit_pttype vt ON vt.vn = o.vn
              LEFT JOIN (
                SELECT
                  e.opdseq AS vn,
                  SUBSTRING_INDEX(GROUP_CONCAT(e.status ORDER BY e.eclaim_no DESC), ',', 1) AS status,
                  SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, e.status) ORDER BY e.eclaim_no DESC), ',', 1) AS statusname,
                  SUM(cc.totpay1) AS eclaim_money
                FROM eclaimdb.m_registerdata e
                JOIN eclaimdb.m_instrument cc ON cc.eclaim_no = e.eclaim_no
                LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = e.status
                WHERE e.person_type = '1'
                  AND IFNULL(e.opdseq, '') <> ''
                GROUP BY e.opdseq
              ) e ON e.vn = o.vn
              LEFT JOIN (
                SELECT
                  vn,
                  MAX(inst + catinst) AS income,
                  GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
                FROM rcmdb.repdata
                WHERE department = 'OP'
                  AND (inst > 0 OR catinst > 0)
                GROUP BY vn
              ) r ON r.vn = o.vn
              LEFT JOIN (
                SELECT
                  vn,
                  MAX(inst + catinst) AS income,
                  GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
                FROM rcmdb.repeclaim
                WHERE department = 'OP'
                  AND (inst > 0 OR catinst > 0)
                GROUP BY vn
              ) n ON n.vn = o.vn
              WHERE o.vstdate BETWEEN ? AND ?
                AND IFNULL(o.an, '') = ''
              GROUP BY o.vn
              ORDER BY o.vstdate DESC, o.vsttime DESC;
            `
            const rows = (await executor(
              opdSql,
              [ds1, ds2, ds1, ds2],
              { timeoutMs: 90000 }
            )) as any[]
            return rows || []
          } else {
            const ipdSql = `
              SELECT
                i.an,
                i.hn,
                pt.cid,
                CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS ptname,
                pt.sex AS sex_code,
                DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
                DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
                w.name AS ward,
                ptt.hipdata_code AS inscl,
                ptt.name AS pttypename,
                IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
                COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
                a.income AS money_hosxp,
                a.discount_money,
                a.rcpt_money,
                (a.income - a.discount_money - a.rcpt_money) AS debit,
                a.rcpno_list AS rcpno,
                inst.instrument,
                inst.list,
                inst.oa,
                inst.dm,
                inst.item_count,
                COALESCE(e.eclaim_money, 0) AS money_eclaim,
                COALESCE(r.income, 0) AS money_rep,
                COALESCE(n.income, 0) AS money_invoice,
                e.status AS eclaim_status,
                e.statusname AS eclaim_statusname
              FROM ipt i
              JOIN (
                SELECT
                  oo.an,
                  SUM(oo.sum_price) AS instrument,
                  COUNT(DISTINCT oo.icode) AS item_count,
                  GROUP_CONCAT(DISTINCT CONCAT(d.nhso_adp_code, ':', d.name, '#', ROUND(oo.sum_price, 2)) SEPARATOR ', ') AS list,
                  MAX(IF(d.nhso_adp_code REGEXP '^700[4-5]', 'Y', NULL)) AS oa,
                  MAX(IF(d.nhso_adp_code REGEXP '^8612|^8813|^8814', 'Y', NULL)) AS dm
                FROM (
                  SELECT icode, nhso_adp_code, name
                  FROM nondrugitems
                  WHERE nhso_adp_type_id = 2
                ) d
                JOIN opitemrece oo ON oo.icode = d.icode
                JOIN ipt i2 ON i2.an = oo.an
                WHERE i2.dchdate BETWEEN ? AND ?
                  AND IFNULL(oo.an, '') <> ''
                GROUP BY oo.an
              ) inst ON inst.an = i.an
              LEFT JOIN patient pt ON pt.hn = i.hn
              LEFT JOIN an_stat a ON a.an = i.an
              LEFT JOIN ward w ON w.ward = i.ward
              LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
              LEFT JOIN rcmdb.authencode cc ON cc.vn = i.an
              LEFT JOIN visit_pttype vt ON vt.vn = i.vn
              LEFT JOIN (
                SELECT
                  e.an,
                  SUBSTRING_INDEX(GROUP_CONCAT(e.status ORDER BY e.eclaim_no DESC), ',', 1) AS status,
                  SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, e.status) ORDER BY e.eclaim_no DESC), ',', 1) AS statusname,
                  SUM(cc.totpay1) AS eclaim_money
                FROM eclaimdb.m_registerdata e
                JOIN eclaimdb.m_instrument cc ON cc.eclaim_no = e.eclaim_no
                LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = e.status
                WHERE e.person_type = '2'
                  AND IFNULL(e.an, '') <> ''
                GROUP BY e.an
              ) e ON e.an = i.an
              LEFT JOIN (
                SELECT
                  an,
                  MAX(inst + catinst) AS income,
                  GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
                FROM rcmdb.repdata
                WHERE department = 'IP'
                  AND (inst > 0 OR catinst > 0)
                GROUP BY an
              ) r ON r.an = i.an
              LEFT JOIN (
                SELECT
                  an,
                  MAX(inst + catinst) AS income,
                  GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
                FROM rcmdb.repeclaim
                WHERE department = 'IP'
                  AND (inst > 0 OR catinst > 0)
                GROUP BY an
              ) n ON n.an = i.an
              WHERE i.dchdate BETWEEN ? AND ?
              GROUP BY i.an
              ORDER BY i.dchdate DESC, i.regdate DESC;
            `
            const rows = (await executor(
              ipdSql,
              [ds1, ds2, ds1, ds2],
              { timeoutMs: 90000 }
            )) as any[]
            return rows || []
          }
        },
        600000 // Cache 10 minutes
      ),
      this.checkAdpMapping(executor, refresh),
    ])

    // แปลง Raw Rows เข้าสู่ Typed Domain Objects
    const allItems: InstrumentItem[] = (rawRows || []).map((r: any, idx: number) => {
      const moneyInvoice = Number(r.money_invoice || 0)
      const moneyRep = Number(r.money_rep || 0)
      const moneyEclaim = Number(r.money_eclaim || 0)
      const instrument = Number(r.instrument || 0)

      let status = '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
      let statusCode: 'INVOICE' | 'REP' | 'ECLAIM' | 'UNSENT' = 'UNSENT'

      if (moneyInvoice > 0) {
        status = 'NHSO :: ได้รับ Invoice แล้ว'
        statusCode = 'INVOICE'
      } else if (moneyRep > 0) {
        status = 'Rep :: ได้รับ Rep แล้ว'
        statusCode = 'REP'
      } else if (r.eclaim_status) {
        const rawStatus = r.eclaim_statusname || r.eclaim_status
        status = String(rawStatus).includes('::') ? String(rawStatus) : `E-Claim :: ${rawStatus}`
        statusCode = 'ECLAIM'
      }

      const isDiscrepancy = moneyEclaim > 0 && Math.abs(instrument - moneyEclaim) > 0.01
      const isCompensated = moneyInvoice > 0 || moneyRep > 0
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc = (pttypeEclaimId && isUcEclaimCode(pttypeEclaimId)) || isUniversalCoverageScheme(r.inscl, r.pttypename)
      const date = patientType === 'OPD' ? String(r.vstdate || '') : String(r.dchdate || r.admdate || '')
      const time = patientType === 'OPD' ? String(r.vsttime || '') : undefined
      const diffMoney = moneyInvoice > 0 ? moneyInvoice - instrument : (moneyEclaim > 0 ? moneyEclaim - instrument : 0)

      return {
        no: idx + 1,
        patientType,
        vn: r.vn ? String(r.vn) : undefined,
        an: r.an ? String(r.an) : undefined,
        hn: String(r.hn || ''),
        cid: String(r.cid || ''),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code),
        vstdate: r.vstdate ? String(r.vstdate) : undefined,
        vsttime: r.vsttime ? String(r.vsttime) : undefined,
        admdate: r.admdate ? String(r.admdate) : undefined,
        dchdate: r.dchdate ? String(r.dchdate) : undefined,
        date,
        time,
        room: r.room ? String(r.room) : null,
        ward: r.ward ? String(r.ward) : null,
        inscl: r.inscl ? String(r.inscl).trim() : null,
        pttypename: String(r.pttypename || ''),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        money_hosxp: Number(r.money_hosxp || 0),
        discount_money: Number(r.discount_money || 0),
        rcpt_money: Number(r.rcpt_money || 0),
        debit: Number(r.debit || 0),
        rcpno: cleanRcpno(r.rcpno),
        instrument,
        list: r.list ? String(r.list) : null,
        items: parseInstrumentItemList(r.list),
        oa: r.oa === 'Y' ? 'Y' : null,
        dm: r.dm === 'Y' ? 'Y' : null,
        itemCount: Number(r.item_count || 0),
        money_eclaim: moneyEclaim,
        money_rep: moneyRep,
        money_invoice: moneyInvoice,
        diff_money: diffMoney,
        eclaim_status: r.eclaim_status ? String(r.eclaim_status) : null,
        status,
        statusCode,
        isDiscrepancy,
        isCompensated,
        isUc,
        pttype_eclaim_id: pttypeEclaimId,
      }
    })

    // กรองระดับ Cohort ด้วยสิทธิ์การรักษา (pttypes มาก่อน, รองรับ ucOnly fallback)
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter(i.pttypename || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // คำนวณ Summary ทั่วทั้ง Cohort (ก่อนกรอง cardFilter และค้นหา)
    const totalCases = summaryCohort.length
    const totalUniquePatients = new Set(summaryCohort.map((i) => i.hn)).size
    const totalInstrumentHosp = summaryCohort.reduce((acc, i) => acc + i.instrument, 0)
    const totalDebit = summaryCohort.reduce((acc, i) => acc + i.debit, 0)

    const oaItems = summaryCohort.filter((i) => i.oa === 'Y')
    const oaCases = oaItems.length
    const oaAmount = oaItems.reduce((acc, i) => acc + i.instrument, 0)

    const dmItems = summaryCohort.filter((i) => i.dm === 'Y')
    const dmCases = dmItems.length
    const dmAmount = dmItems.reduce((acc, i) => acc + i.instrument, 0)

    const otherItems = summaryCohort.filter((i) => i.oa !== 'Y' && i.dm !== 'Y')
    const otherCases = otherItems.length
    const otherAmount = otherItems.reduce((acc, i) => acc + i.instrument, 0)

    const invoiceItems = summaryCohort.filter((i) => i.statusCode === 'INVOICE')
    const invoiceCases = invoiceItems.length
    const invoiceAmount = invoiceItems.reduce((acc, i) => acc + i.money_invoice, 0)

    const repItems = summaryCohort.filter((i) => i.statusCode === 'REP')
    const repCases = repItems.length
    const repAmount = repItems.reduce((acc, i) => acc + i.money_rep, 0)

    const compensatedItems = summaryCohort.filter((i) => i.isCompensated)
    const compensatedCases = compensatedItems.length
    const totalCompensated = compensatedItems.reduce((acc, i) => acc + (i.money_invoice || i.money_rep || 0), 0)

    const unsentItems = summaryCohort.filter((i) => i.statusCode === 'UNSENT')
    const unsentCases = unsentItems.length
    const unsentAmount = unsentItems.reduce((acc, i) => acc + i.instrument, 0)

    const discrepancyItems = summaryCohort.filter((i) => i.isDiscrepancy)
    const discrepancyCases = discrepancyItems.length

    const authenItems = summaryCohort.filter((i) => Boolean(i.authencode && i.authencode.length > 0))
    const authenCases = authenItems.length
    const authenRate = totalCases > 0 ? (authenCases / totalCases) * 100 : 0

    const ucItems = summaryCohort.filter((i) => i.isUc)
    const ucCases = ucItems.length
    const ucRate = totalCases > 0 ? (ucCases / totalCases) * 100 : 0

    const summary: InstrumentSummary = {
      totalCases,
      totalUniquePatients,
      totalInstrumentHosp,
      totalDebit,
      oaCases,
      oaAmount,
      dmCases,
      dmAmount,
      otherCases,
      otherAmount,
      compensatedCases,
      totalCompensated,
      invoiceCases,
      invoiceAmount,
      repCases,
      repAmount,
      unsentCases,
      unsentAmount,
      discrepancyCases,
      authenCases,
      authenRate,
      ucCases,
      ucRate,
    }

    // กรองตาม Card Filter
    let filtered = summaryCohort
    switch (cardFilter) {
      case 'OA':
        filtered = filtered.filter((i) => i.oa === 'Y')
        break
      case 'DM':
        filtered = filtered.filter((i) => i.dm === 'Y')
        break
      case 'OTHER':
        filtered = filtered.filter((i) => i.oa !== 'Y' && i.dm !== 'Y')
        break
      case 'COMPENSATED':
        filtered = filtered.filter((i) => i.isCompensated)
        break
      case 'INVOICE':
        filtered = filtered.filter((i) => i.statusCode === 'INVOICE')
        break
      case 'REP':
        filtered = filtered.filter((i) => i.statusCode === 'REP')
        break
      case 'UNSENT':
        filtered = filtered.filter((i) => i.statusCode === 'UNSENT')
        break
      case 'DISCREPANCY':
        filtered = filtered.filter((i) => i.isDiscrepancy)
        break
      case 'WITH_AUTHEN':
        filtered = filtered.filter((i) => Boolean(i.authencode && i.authencode.length > 0))
        break
      case 'NO_AUTHEN':
        filtered = filtered.filter((i) => !i.authencode || i.authencode.length === 0)
        break
      case 'UC_ONLY':
        filtered = filtered.filter((i) => i.isUc)
        break
      case 'ALL':
      default:
        break
    }

    // กรองตาม Unified Global Search
    if (search.length > 0) {
      filtered = filtered.filter((i) => {
        return (
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          (i.vn && i.vn.toLowerCase().includes(search)) ||
          (i.an && i.an.toLowerCase().includes(search)) ||
          i.pttypename.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.list && i.list.toLowerCase().includes(search)) ||
          (i.room && i.room.toLowerCase().includes(search)) ||
          (i.ward && i.ward.toLowerCase().includes(search))
        )
      })
    }

    // เรียงลำดับ (Sorting)
    filtered.sort((a, b) => {
      let valA: any
      let valB: any

      switch (sortBy) {
        case 'date':
          valA = a.date
          valB = b.date
          break
        case 'time':
          valA = a.time || ''
          valB = b.time || ''
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
        case 'vn':
          valA = a.vn || ''
          valB = b.vn || ''
          break
        case 'an':
          valA = a.an || ''
          valB = b.an || ''
          break
        case 'room':
          valA = a.room || ''
          valB = b.room || ''
          break
        case 'ward':
          valA = a.ward || ''
          valB = b.ward || ''
          break
        case 'pttypename':
          valA = a.pttypename
          valB = b.pttypename
          break
        case 'instrument':
          valA = a.instrument
          valB = b.instrument
          break
        case 'money_hosxp':
          valA = a.money_hosxp
          valB = b.money_hosxp
          break
        case 'debit':
          valA = a.debit
          valB = b.debit
          break
        case 'money_eclaim':
          valA = a.money_eclaim
          valB = b.money_eclaim
          break
        case 'money_rep':
          valA = a.money_rep
          valB = b.money_rep
          break
        case 'money_invoice':
          valA = a.money_invoice
          valB = b.money_invoice
          break
        case 'diff_money':
          valA = a.diff_money
          valB = b.diff_money
          break
        case 'status':
          valA = a.status
          valB = b.status
          break
        case 'authencode':
          valA = a.authencode || ''
          valB = b.authencode || ''
          break
        default:
          valA = a.date
          valB = b.date
          break
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    const total = filtered.length
    const totalPages = Math.ceil(total / pageSize) || 1

    // แบ่งหน้า หรือส่งออกทั้งหมด (Server-Side Bounded Pagination)
    let pagedItems = filtered
    if (!exportAll) {
      const startIndex = (page - 1) * pageSize
      pagedItems = filtered.slice(startIndex, startIndex + pageSize)
    }

    // กำหนดลำดับแถว (No.)
    const finalItems = pagedItems.map((item, idx) => ({
      ...item,
      no: exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1,
    }))

    return {
      items: finalItems,
      total,
      page,
      pageSize,
      totalPages,
      summary,
      dateRange: {
        startDate: ds1,
        endDate: ds2,
      },
      adpMapping,
    }
  }
}
