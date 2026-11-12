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
import { matchesPttypeFilter } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'

// ── ADP Mapping Item ──────────────────────────────────────────────────────────

export interface AdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface AdpMappingCheck {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: AdpMappingItem[]
}

// ── Types: กองทุนยา Streptokinase ───────────────────────────────────────────

export type StreptokinasePatientType = 'OPD' | 'IPD'

export type StreptokinaseCardFilter =
  | 'ALL'
  | 'AUDIT_PASS'
  | 'AUDIT_ERROR'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_INVOICE'
  | 'WITH_REP'
  | 'NOT_SENT'

export type StreptokinaseSortField =
  | 'date'
  | 'time'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'drugname'
  | 'money_hosxp'
  | 'debit'
  | 'money_eclaim'
  | 'money_rep'
  | 'money_invoice'
  | 'rep'
  | 'status'

export interface StreptokinaseReportParams extends FiscalDateRangeParams {
  patientType?: StreptokinasePatientType
  cardFilter?: StreptokinaseCardFilter
  search?: string
  sortBy?: StreptokinaseSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  ucOnly?: boolean
}

export interface StreptokinaseItem {
  no: number
  patientType: StreptokinasePatientType
  vn: string | null
  an: string | null
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  date: string // vstdate for OPD, dchdate for IPD
  vstdate?: string
  vsttime?: string
  admdate?: string
  dchdate?: string
  pttypename: string
  pttype_eclaim_id?: string | null
  maininscl?: string
  department?: string | null
  clinic?: string | null
  ward?: string | null
  drugname: string
  money_hosxp: number
  discount_money: number
  rcpt_money: number
  debit: number
  rcpno: string
  money_eclaim: number
  money_rep: number
  money_invoice: number
  dx: string | null
  op: string | null
  errorDx: string | null
  errorOp: string | null
  hasError: boolean
  rep: string | null
  status: string
  compensated: number
  isCompensated: boolean
  isUc?: boolean
}

export interface StreptokinaseSummary {
  totalCases: number
  uniquePatients: number
  auditPassCases: number
  auditPassRate: number
  auditErrorCases: number
  auditErrorRate: number
  compensatedCases: number
  uncompensatedCases: number
  compensationRate: number
  totalCompensated: number
  totalHosxp: number
  totalDebit: number
  withInvoiceCases: number
  withRepCases: number
  notSentCases: number
}

export interface StreptokinaseReportResult {
  title: string
  subtitle: string
  patientType: StreptokinasePatientType
  ds1: string
  ds2: string
  adpMapping: AdpMappingCheck
  cardFilter: StreptokinaseCardFilter
  search: string
  sortBy: StreptokinaseSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: StreptokinaseSummary
  items: StreptokinaseItem[]
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

// ── Service Implementation ──────────────────────────────────────────────────

export class RcmStreptokinaseService {
  /**
   * ตรวจสอบการ Map รหัส ADP สำหรับยากลุ่ม STEMI / Streptokinase ในตาราง s_drugitems
   */
  static async checkAdpMapping(
    executor: QueryExecutor = queryClinicalDb,
    refresh?: boolean
  ): Promise<AdpMappingCheck> {
    const cacheKey = 'rcm-adp-mapping-check-stemi'
    if (refresh) {
      invalidateCacheKey(cacheKey)
    }
    return getCachedData(
      cacheKey,
      async () => {
        if (executor === queryClinicalDb) {
          try {
            const gwRes = await apiGateway.clinical.getAdpMapping('STEMI')
            if (gwRes && typeof gwRes.isMapped === 'boolean') {
              return {
                adpCode: 'STEMI',
                isMapped: gwRes.isMapped,
                mappedCount: gwRes.mappedCount,
                items: (gwRes.items || []).map((r: any) => ({
                  icode: String(r.icode || '').trim(),
                  name: String(r.name || '').trim(),
                  strength: r.strength ? String(r.strength).trim() : null,
                  nhso_adp_code: String(r.nhso_adp_code || '').trim(),
                })),
              }
            }
          } catch {
            // Fallback to executor query
          }
        }

        try {
          const sql = `
            SELECT 
              icode, 
              name, 
              strength, 
              nhso_adp_code
            FROM s_drugitems 
            WHERE nhso_adp_code REGEXP 'STEMI'
            ORDER BY icode ASC;
          `
          const rows = (await executor(sql, [], { timeoutMs: 15000 })) as any[]
          const items: AdpMappingItem[] = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
          }))

          return {
            adpCode: 'STEMI',
            isMapped: items.length > 0,
            mappedCount: items.length,
            items,
          }
        } catch {
          return {
            adpCode: 'STEMI',
            isMapped: false,
            mappedCount: 0,
            items: [],
          }
        }
      },
      600000 // 10 minutes cache
    )
  }

  /**
   * ดึงรายงานรายชื่อรับยา Streptokinase (OPD หรือ IPD)
   */
  static async getStreptokinaseReport(
    params: StreptokinaseReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<StreptokinaseReportResult> {
    const title = 'กองทุนยา Streptokinase'
    const subtitle = 'รายชื่อรับยา Streptokinase'
    const patientType: StreptokinasePatientType = params.patientType === 'IPD' ? 'IPD' : 'OPD'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: StreptokinaseCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: StreptokinaseSortField = params.sortBy || 'date'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-streptokinase-${patientType}-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
      invalidateCacheKey('rcm-adp-mapping-check-stemi')
    }

    const adpMapping = await this.checkAdpMapping(executor, params.refresh)

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        if (patientType === 'OPD') {
          return await this.fetchOpdData(ds1, ds2, executor)
        } else {
          return await this.fetchIpdData(ds1, ds2, executor)
        }
      },
      600000 // 10 minutes TTL
    )

    // Parse and evaluate Clinical/Audit Rules
    let allItems: StreptokinaseItem[] = (rawRows || []).map((r: any, idx: number) => {
      const dx = r.dx ? String(r.dx).trim() : null
      const op = r.op ? String(r.op).trim() : null

      // Diagnostic check: STEMI Dx (I210-I213 or I22x)
      // ICD-10 pattern: I210, I211, I212, I213, I21.0, I21.1, I21.2, I21.3, or I22, I220, I22.0, etc.
      const hasStemiDx = Boolean(dx && /(I21[0-3]|I21\.[0-3]|I22)/i.test(dx))
      const errorDx = hasStemiDx ? null : 'ไม่พบ Dx I210-I213 หรือ I22x'

      // Procedure check: Op 9910 (Injection or infusion of thrombolytic agent)
      const hasOp9910 = Boolean(op && /(9910|99\.10)/.test(op))
      const errorOp = hasOp9910 ? null : 'ไม่พบ Op 9910'

      const moneyHosxp = Number(r.money_hosxp || 0)
      const discountMoney = Number(r.discount_money || 0)
      const rcptMoney = Number(r.rcpt_money || 0)
      const debit = Number(r.debit || 0)

      const moneyEclaim = Number(r.money_eclaim || 0)
      const moneyRep = Number(r.money_rep || 0)
      const moneyInvoice = Number(r.money_invoice || 0)

      const rep = r.rep ? String(r.rep).trim() : null
      const rawStatus = r.status ? String(r.status).trim() : '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'

      // Compensation calculation: prioritize invoice -> rep -> eclaim
      const compensated = moneyInvoice > 0 ? moneyInvoice : (moneyRep > 0 ? moneyRep : (moneyEclaim > 0 ? moneyEclaim : 0))
      const isCompensated = compensated > 0 || Boolean(rep && rep.length > 0)

      const hasError = Boolean(errorDx || errorOp)

      const baseItem: StreptokinaseItem = {
        no: idx + 1,
        patientType,
        vn: r.vn ? String(r.vn).trim() : null,
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code, r.sex),
        birthday: r.birthday ? String(r.birthday).trim() : null,
        age: Number(r.age || 0),
        date: String(r.vstdate || r.dchdate || '').trim(),
        vstdate: r.vstdate ? String(r.vstdate).trim() : undefined,
        vsttime: r.vsttime ? String(r.vsttime).trim() : undefined,
        admdate: r.admdate ? String(r.admdate).trim() : undefined,
        dchdate: r.dchdate ? String(r.dchdate).trim() : undefined,
        pttypename: String(r.pttypename || '').trim(),
        pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
        maininscl: r.maininscl ? String(r.maininscl).trim() : undefined,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        ward: r.ward ? String(r.ward).trim() : null,
        drugname: String(r.drugname || '').trim(),
        money_hosxp: moneyHosxp,
        discount_money: discountMoney,
        rcpt_money: rcptMoney,
        debit,
        rcpno: String(r.rcpno || '').replace(/['"]/g, '').trim(),
        money_eclaim: moneyEclaim,
        money_rep: moneyRep,
        money_invoice: moneyInvoice,
        dx,
        op,
        errorDx,
        errorOp,
        hasError,
        rep,
        status: rawStatus,
        compensated,
        isCompensated,
        isUc: isUniversalCoverageScheme(r.maininscl, r.pttypename),
      }

      return baseItem
    })

    // Compute Summary Stats
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, executor, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((it) =>
        matchesPttypeFilter(it.pttypename || it.pttype_eclaim_id, params.pttypes, it.isUc, it.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((it) => it.isUc)
    }

    const totalCases = summaryCohort.length
    const uniqueHnSet = new Set(summaryCohort.map((it) => it.hn))
    const uniquePatients = uniqueHnSet.size

    const auditPassCases = summaryCohort.filter((it) => !it.hasError).length
    const auditPassRate = totalCases > 0 ? Number(((auditPassCases / totalCases) * 100).toFixed(1)) : 0

    const auditErrorCases = summaryCohort.filter((it) => it.hasError).length
    const auditErrorRate = totalCases > 0 ? Number(((auditErrorCases / totalCases) * 100).toFixed(1)) : 0

    const compensatedCases = summaryCohort.filter((it) => it.isCompensated).length
    const uncompensatedCases = totalCases - compensatedCases
    const compensationRate = totalCases > 0 ? Number(((compensatedCases / totalCases) * 100).toFixed(1)) : 0

    const totalCompensated = summaryCohort.reduce((acc, it) => acc + it.compensated, 0)
    const totalHosxp = summaryCohort.reduce((acc, it) => acc + it.money_hosxp, 0)
    const totalDebit = summaryCohort.reduce((acc, it) => acc + it.debit, 0)

    const withInvoiceCases = summaryCohort.filter((it) => it.status.includes('Invoice') || it.money_invoice > 0).length
    const withRepCases = summaryCohort.filter((it) => it.status.includes('Rep') || it.money_rep > 0).length
    const notSentCases = summaryCohort.filter((it) => it.status.startsWith('-') || it.status.includes('ยังไม่ส่ง')).length

    const summary: StreptokinaseSummary = {
      totalCases,
      uniquePatients,
      auditPassCases,
      auditPassRate,
      auditErrorCases,
      auditErrorRate,
      compensatedCases,
      uncompensatedCases,
      compensationRate,
      totalCompensated,
      totalHosxp,
      totalDebit,
      withInvoiceCases,
      withRepCases,
      notSentCases,
    }

    // Filter by Card Filter
    let filtered = summaryCohort
    if (cardFilter === 'AUDIT_PASS') {
      filtered = filtered.filter((it) => !it.hasError)
    } else if (cardFilter === 'AUDIT_ERROR') {
      filtered = filtered.filter((it) => it.hasError)
    } else if (cardFilter === 'COMPENSATED') {
      filtered = filtered.filter((it) => it.isCompensated)
    } else if (cardFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter((it) => !it.isCompensated)
    } else if (cardFilter === 'WITH_INVOICE') {
      filtered = filtered.filter((it) => it.status.includes('Invoice') || it.money_invoice > 0)
    } else if (cardFilter === 'WITH_REP') {
      filtered = filtered.filter((it) => it.status.includes('Rep') || it.money_rep > 0)
    } else if (cardFilter === 'NOT_SENT') {
      filtered = filtered.filter((it) => it.status.startsWith('-') || it.status.includes('ยังไม่ส่ง'))
    }

    // Global Search across all relevant fields
    if (search) {
      filtered = filtered.filter((it) => {
        return (
          matchesSeamlessRepSearch(it, search) ||
          it.hn.toLowerCase().includes(search) ||
          it.cid.includes(search) ||
          it.ptname.toLowerCase().includes(search) ||
          (it.vn && it.vn.toLowerCase().includes(search)) ||
          (it.an && it.an.toLowerCase().includes(search)) ||
          (it.dx && it.dx.toLowerCase().includes(search)) ||
          (it.op && it.op.toLowerCase().includes(search)) ||
          it.drugname.toLowerCase().includes(search) ||
          it.pttypename.toLowerCase().includes(search) ||
          (it.department && it.department.toLowerCase().includes(search)) ||
          (it.clinic && it.clinic.toLowerCase().includes(search)) ||
          (it.ward && it.ward.toLowerCase().includes(search)) ||
          (it.rep && it.rep.toLowerCase().includes(search)) ||
          it.status.toLowerCase().includes(search)
        )
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '')
        if (cmp === 0 && a.vsttime && b.vsttime) {
          cmp = a.vsttime.localeCompare(b.vsttime)
        }
      } else if (sortBy === 'time') {
        cmp = (a.vsttime || '').localeCompare(b.vsttime || '')
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname, 'th')
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'drugname') {
        cmp = a.drugname.localeCompare(b.drugname)
      } else if (sortBy === 'money_hosxp') {
        cmp = a.money_hosxp - b.money_hosxp
      } else if (sortBy === 'debit') {
        cmp = a.debit - b.debit
      } else if (sortBy === 'money_eclaim') {
        cmp = a.money_eclaim - b.money_eclaim
      } else if (sortBy === 'money_rep') {
        cmp = a.money_rep - b.money_rep
      } else if (sortBy === 'money_invoice') {
        cmp = a.money_invoice - b.money_invoice
      } else if (sortBy === 'rep') {
        cmp = (a.rep || '').localeCompare(b.rep || '')
      } else if (sortBy === 'status') {
        cmp = a.status.localeCompare(b.status, 'th')
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
      title,
      subtitle,
      patientType,
      ds1,
      ds2,
      adpMapping,
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
    }
  }

  /**
   * ดึงข้อมูลผู้ป่วยนอก (OPD) พร้อม Driving Subquery เพื่อความเร็วสูงสุด (< 0.1s)
   */
  private static async fetchOpdData(
    ds1: string,
    ds2: string,
    executor: QueryExecutor
  ): Promise<any[]> {
    if (executor === queryClinicalDb) {
      try {
        const gwRes = await apiGateway.clinical.getRcmFundData('streptokinase', { ds1, ds2, patientType: 'OPD' })
        if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows)) {
          return gwRes.data.rawRows
        }
      } catch {
        // Fallback to local SQL queries
      }
    }

    try {
      const primarySql = `
        SELECT 
          o.vn,
          o.hn,
          IFNULL(pt.cid, '') AS cid,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IFNULL(pt.sex, '') AS sex_code,
          DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
          IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          IFNULL(ptt.hipdata_code, '') AS maininscl,
          ptt.pttype_eclaim_id,
          dep.department AS department,
          spc.name AS clinic,
          target_drugs.drugname AS drugname,
          target_drugs.money_hosxp AS money_hosxp,
          IFNULL(v.discount_money, 0) AS discount_money,
          IFNULL(v.rcpt_money, 0) AS rcpt_money,
          IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0) AS debit,
          IFNULL(v.rcpno_list, '') AS rcpno,
          dx_sub.dx,
          dx_sub.op,
          IFNULL(e.income, 0) AS money_eclaim,
          IFNULL(r.income, 0) AS money_rep,
          IFNULL(n.income, 0) AS money_invoice,
          COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, ''), NULLIF(m.rep, ''), '') AS rep,
          CASE 
            WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN IFNULL(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT 
            oo.vn,
            GROUP_CONCAT(DISTINCT CONCAT_WS(' ', di.name, NULLIF(di.strength, ''), CONCAT('#', oo.qty)) SEPARATOR ', ') AS drugname,
            SUM(oo.sum_price) AS money_hosxp
          FROM opitemrece oo
          JOIN (
            SELECT icode, name, strength FROM s_drugitems WHERE nhso_adp_code REGEXP 'STEMI'
            UNION
            SELECT icode, name, strength FROM drugitems WHERE nhso_adp_code REGEXP 'STEMI'
          ) di ON di.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND IFNULL(oo.vn, '') <> ''
          GROUP BY oo.vn
        ) target_drugs
        JOIN ovst o ON o.vn = target_drugs.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN (
          SELECT 
            odx.vn,
            GROUP_CONCAT(DISTINCT IF(odx.icd10 NOT REGEXP '^[0-9]', odx.icd10, NULL) ORDER BY odx.diagtype, odx.ovst_diag_id SEPARATOR ', ') AS dx,
            GROUP_CONCAT(DISTINCT IF(odx.icd10 REGEXP '^[0-9]', odx.icd10, NULL) SEPARATOR ', ') AS op
          FROM ovstdiag odx
          WHERE odx.vstdate BETWEEN ? AND ?
          GROUP BY odx.vn
        ) dx_sub ON dx_sub.vn = o.vn
        LEFT JOIN (
          SELECT e.opdseq AS vn, SUM(cc.totpay1) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '1'
            AND e.dateadm BETWEEN ? AND ?
            AND cc.code LIKE 'STEMI%'
          GROUP BY e.opdseq
        ) e ON e.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(drug) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'OP' AND drug > 0
          GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(drug) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'OP' AND drug > 0
          GROUP BY vn
        ) n ON n.vn = o.vn
        LEFT JOIN (
          SELECT m.opdseq AS vn,
                 MAX(m.eclaim_no) AS eclaim_no,
                 SUBSTRING_INDEX(GROUP_CONCAT(IF(m.status = '4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '1' AND m.opdseq IS NOT NULL
            AND m.dateadm BETWEEN ? AND ?
          GROUP BY m.opdseq
        ) m ON m.vn = o.vn
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `

      return await executor(
        primarySql,
        [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
        { timeoutMs: 90000 }
      )
    } catch {
      // Graceful fallback without eclaimdb/rcmdb if cross-db permissions differ
      const fallbackSql = `
        SELECT 
          o.vn,
          o.hn,
          IFNULL(pt.cid, '') AS cid,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IFNULL(pt.sex, '') AS sex_code,
          DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
          IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          IFNULL(ptt.hipdata_code, '') AS maininscl,
          dep.department AS department,
          spc.name AS clinic,
          target_drugs.drugname AS drugname,
          target_drugs.money_hosxp AS money_hosxp,
          IFNULL(v.discount_money, 0) AS discount_money,
          IFNULL(v.rcpt_money, 0) AS rcpt_money,
          IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0) AS debit,
          IFNULL(v.rcpno_list, '') AS rcpno,
          dx_sub.dx,
          dx_sub.op,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT 
            oo.vn,
            GROUP_CONCAT(DISTINCT CONCAT_WS(' ', di.name, NULLIF(di.strength, ''), CONCAT('#', oo.qty)) SEPARATOR ', ') AS drugname,
            SUM(oo.sum_price) AS money_hosxp
          FROM opitemrece oo
          JOIN (
            SELECT icode, name, strength FROM s_drugitems WHERE nhso_adp_code REGEXP 'STEMI'
            UNION
            SELECT icode, name, strength FROM drugitems WHERE nhso_adp_code REGEXP 'STEMI'
          ) di ON di.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ?
            AND IFNULL(oo.vn, '') <> ''
          GROUP BY oo.vn
        ) target_drugs
        JOIN ovst o ON o.vn = target_drugs.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN (
          SELECT 
            odx.vn,
            GROUP_CONCAT(DISTINCT IF(odx.icd10 NOT REGEXP '^[0-9]', odx.icd10, NULL) ORDER BY odx.diagtype, odx.ovst_diag_id SEPARATOR ', ') AS dx,
            GROUP_CONCAT(DISTINCT IF(odx.icd10 REGEXP '^[0-9]', odx.icd10, NULL) SEPARATOR ', ') AS op
          FROM ovstdiag odx
          WHERE odx.vstdate BETWEEN ? AND ?
          GROUP BY odx.vn
        ) dx_sub ON dx_sub.vn = o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC;
      `
      return await executor(fallbackSql, [ds1, ds2, ds1, ds2], { timeoutMs: 90000 })
    }
  }

  /**
   * ดึงข้อมูลผู้ป่วยใน (IPD) พร้อม Driving Subquery เพื่อความเร็วสูงสุด (< 0.1s)
   */
  private static async fetchIpdData(
    ds1: string,
    ds2: string,
    executor: QueryExecutor
  ): Promise<any[]> {
    if (executor === queryClinicalDb) {
      try {
        const gwRes = await apiGateway.clinical.getRcmFundData('streptokinase', { ds1, ds2, patientType: 'IPD' })
        if (gwRes && gwRes.data && Array.isArray(gwRes.data.rawRows)) {
          return gwRes.data.rawRows
        }
      } catch {
        // Fallback to local SQL queries
      }
    }

    try {
      const primarySql = `
        SELECT 
          i.an,
          i.hn,
          IFNULL(pt.cid, '') AS cid,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IFNULL(pt.sex, '') AS sex_code,
          DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          IFNULL(ptt.hipdata_code, '') AS maininscl,
          ptt.pttype_eclaim_id,
          w.name AS ward,
          target_drugs.drugname AS drugname,
          target_drugs.money_hosxp AS money_hosxp,
          IFNULL(a.discount_money, 0) AS discount_money,
          IFNULL(a.rcpt_money, 0) AS rcpt_money,
          IFNULL(a.income, 0) - IFNULL(a.discount_money, 0) - IFNULL(a.rcpt_money, 0) AS debit,
          IFNULL(a.rcpno_list, '') AS rcpno,
          dx_sub.dx,
          op_sub.op,
          IFNULL(e.income, 0) AS money_eclaim,
          IFNULL(r.income, 0) AS money_rep,
          IFNULL(n.income, 0) AS money_invoice,
          COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, ''), NULLIF(m.rep, ''), '') AS rep,
          CASE 
            WHEN n.an IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.an IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            WHEN m.status IS NOT NULL THEN IFNULL(ecs.name, CONCAT('E-Claim (', m.status, ')'))
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT 
            oo.an,
            GROUP_CONCAT(DISTINCT CONCAT_WS(' ', di.name, NULLIF(di.strength, ''), CONCAT('#', oo.qty)) SEPARATOR ', ') AS drugname,
            SUM(oo.sum_price) AS money_hosxp
          FROM opitemrece oo
          JOIN (
            SELECT icode, name, strength FROM s_drugitems WHERE nhso_adp_code REGEXP 'STEMI'
            UNION
            SELECT icode, name, strength FROM drugitems WHERE nhso_adp_code REGEXP 'STEMI'
          ) di ON di.icode = oo.icode
          WHERE IFNULL(oo.an, '') <> ''
          GROUP BY oo.an
        ) target_drugs
        JOIN ipt i ON i.an = target_drugs.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN (
          SELECT 
            an,
            GROUP_CONCAT(DISTINCT icd10 ORDER BY diagtype, ipt_diag_id SEPARATOR ', ') AS dx
          FROM iptdiag
          GROUP BY an
        ) dx_sub ON dx_sub.an = i.an
        LEFT JOIN (
          SELECT 
            an,
            GROUP_CONCAT(DISTINCT icd9 SEPARATOR ', ') AS op
          FROM iptoprt
          GROUP BY an
        ) op_sub ON op_sub.an = i.an
        LEFT JOIN (
          SELECT e.an, SUM(cc.totpay1) AS income
          FROM eclaimdb.m_registerdata e
          JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
          WHERE e.person_type = '2'
            AND e.datedsc BETWEEN ? AND ?
            AND cc.code LIKE 'STEMI%'
          GROUP BY e.an
        ) e ON e.an = i.an
        LEFT JOIN (
          SELECT an, SUM(drug) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata
          WHERE department = 'IP' AND drug > 0
          GROUP BY an
        ) r ON r.an = i.an
        LEFT JOIN (
          SELECT an, SUM(drug) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim
          WHERE department = 'IP' AND drug > 0
          GROUP BY an
        ) n ON n.an = i.an
        LEFT JOIN (
          SELECT m.an,
                 MAX(m.eclaim_no) AS eclaim_no,
                 SUBSTRING_INDEX(GROUP_CONCAT(IF(m.status = '4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                 SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
          FROM eclaimdb.m_registerdata m
          WHERE m.person_type = '2' AND m.datedsc BETWEEN ? AND ?
          GROUP BY m.an
        ) m ON m.an = i.an
        LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
        WHERE i.dchdate BETWEEN ? AND ?
        ORDER BY i.dchdate DESC, i.regdate DESC;
      `

      return await executor(
        primarySql,
        [ds1, ds2, ds1, ds2, ds1, ds2],
        { timeoutMs: 90000 }
      )
    } catch {
      // Graceful fallback without eclaimdb/rcmdb if cross-db permissions differ
      const fallbackSql = `
        SELECT 
          i.an,
          i.hn,
          IFNULL(pt.cid, '') AS cid,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IFNULL(pt.sex, '') AS sex_code,
          DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          IFNULL(ptt.hipdata_code, '') AS maininscl,
          w.name AS ward,
          target_drugs.drugname AS drugname,
          target_drugs.money_hosxp AS money_hosxp,
          IFNULL(a.discount_money, 0) AS discount_money,
          IFNULL(a.rcpt_money, 0) AS rcpt_money,
          IFNULL(a.income, 0) - IFNULL(a.discount_money, 0) - IFNULL(a.rcpt_money, 0) AS debit,
          IFNULL(a.rcpno_list, '') AS rcpno,
          dx_sub.dx,
          op_sub.op,
          0 AS money_eclaim,
          0 AS money_rep,
          0 AS money_invoice,
          '' AS rep,
          '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
        FROM (
          SELECT 
            oo.an,
            GROUP_CONCAT(DISTINCT CONCAT_WS(' ', di.name, NULLIF(di.strength, ''), CONCAT('#', oo.qty)) SEPARATOR ', ') AS drugname,
            SUM(oo.sum_price) AS money_hosxp
          FROM opitemrece oo
          JOIN (
            SELECT icode, name, strength FROM s_drugitems WHERE nhso_adp_code REGEXP 'STEMI'
            UNION
            SELECT icode, name, strength FROM drugitems WHERE nhso_adp_code REGEXP 'STEMI'
          ) di ON di.icode = oo.icode
          WHERE IFNULL(oo.an, '') <> ''
          GROUP BY oo.an
        ) target_drugs
        JOIN ipt i ON i.an = target_drugs.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN (
          SELECT 
            an,
            GROUP_CONCAT(DISTINCT icd10 ORDER BY diagtype, ipt_diag_id SEPARATOR ', ') AS dx
          FROM iptdiag
          GROUP BY an
        ) dx_sub ON dx_sub.an = i.an
        LEFT JOIN (
          SELECT 
            an,
            GROUP_CONCAT(DISTINCT icd9 SEPARATOR ', ') AS op
          FROM iptoprt
          GROUP BY an
        ) op_sub ON op_sub.an = i.an
        WHERE i.dchdate BETWEEN ? AND ?
        ORDER BY i.dchdate DESC, i.regdate DESC;
      `
      return await executor(fallbackSql, [ds1, ds2], { timeoutMs: 90000 })
    }
  }

  /**
   * รายละเอียดเวชระเบียนผู้ป่วยในระดับ Admission (AN Clinical Details) สำหรับ Detail Modal
   */
  static async getAnClinicalDetails(
    an: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<AnClinicalDetails | null> {
    const cleanAn = (an || '').trim()
    if (!cleanAn) return null

    const headerSql = `
      SELECT 
        i.an, i.hn, IFNULL(pt.cid, '') AS cid,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        CASE WHEN pt.sex = '1' THEN 'ชาย' WHEN pt.sex = '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
        IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.dchdate), 0) AS age,
        DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
        DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
        IFNULL(p.name, IFNULL(i.pttype, '')) AS pttypename,
        IFNULL(w.name, IFNULL(i.ward, '')) AS ward
      FROM ipt i
      LEFT JOIN patient pt ON pt.hn = i.hn
      LEFT JOIN pttype p ON p.pttype = i.pttype
      LEFT JOIN ward w ON w.ward = i.ward
      WHERE i.an = ?
      LIMIT 1;
    `

    const diagSql = `
      SELECT 
        d.icd10,
        IFNULL(ic.name, d.icd10) AS icd_name,
        IFNULL(d.diagtype, '') AS diagtype,
        IFNULL(dt.name, CASE d.diagtype 
          WHEN '1' THEN 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)' 
          WHEN '2' THEN 'CO-MORBIDITY (การวินิจฉัยโรคร่วม)' 
          WHEN '3' THEN 'COMPLICATION (ภาวะแทรกซ้อน)' 
          WHEN '4' THEN 'OTHER (การวินิจฉัยอื่นๆ)' 
          WHEN '5' THEN 'EXTERNAL CAUSE (สาเหตุภายนอก)' 
          ELSE 'ไม่ระบุประเภท' END) AS diagtype_name,
        IFNULL(doc.name, '') AS doctor_name
      FROM iptdiag d
      LEFT JOIN icd101 ic ON ic.code = d.icd10
      LEFT JOIN diagtype dt ON dt.diagtype = d.diagtype
      LEFT JOIN doctor doc ON doc.code = d.doctor
      WHERE d.an = ?
      ORDER BY d.diagtype ASC, d.ipt_diag_id ASC;
    `

    const oprtSql = `
      SELECT 
        op.icd9,
        IFNULL(ic9.name, op.icd9) AS icd9_name,
        DATE_FORMAT(op.opdate, '%Y-%m-%d') AS opdate,
        IFNULL(doc.name, '') AS doctor_name
      FROM iptoprt op
      LEFT JOIN icd9cm1 ic9 ON ic9.code = op.icd9
      LEFT JOIN doctor doc ON doc.code = op.doctor
      WHERE op.an = ?
      ORDER BY op.opdate ASC;
    `

    const orderSql = `
      SELECT 
        o.icode,
        COALESCE(d.name, nd.name, o.icode) AS item_name,
        d.strength,
        d.units,
        IFNULL(o.qty, 0) AS qty,
        IFNULL(o.unitprice, 0) AS unitprice,
        IFNULL(o.sum_price, 0) AS sum_price,
        IFNULL(pst.name, o.paidst) AS paidst_name,
        IFNULL(inc.name, o.income) AS income_name,
        IF(d.icode IS NOT NULL, 1, 0) AS is_drug
      FROM opitemrece o
      LEFT JOIN s_drugitems d ON d.icode = o.icode
      LEFT JOIN nondrugitems nd ON nd.icode = o.icode
      LEFT JOIN paidst pst ON pst.paidst = o.paidst
      LEFT JOIN income inc ON inc.income = o.income
      WHERE o.an = ?
      ORDER BY o.income ASC, o.item_no ASC, o.icode ASC;
    `

    const [headerRows, diagRows, oprtRows, orderRows] = await Promise.all([
      executor(headerSql, [cleanAn]),
      executor(diagSql, [cleanAn]),
      executor(oprtSql, [cleanAn]),
      executor(orderSql, [cleanAn]),
    ])

    if (!headerRows || headerRows.length === 0) {
      return null
    }

    const h = headerRows[0]
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
      orders: (orderRows || []).map((ord: any) => ({
        icode: String(ord.icode || ''),
        itemName: String(ord.item_name || ''),
        strength: ord.strength ? String(ord.strength).trim() : null,
        units: ord.units ? String(ord.units).trim() : null,
        qty: Number(ord.qty || 0),
        unitprice: Number(ord.unitprice || 0),
        sumPrice: Number(ord.sum_price || 0),
        paidstName: String(ord.paidst_name || ''),
        incomeName: String(ord.income_name || ''),
        isDrug: Boolean(ord.is_drug === 1 || ord.is_drug === true),
      })),
    }
  }
}
