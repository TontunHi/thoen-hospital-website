import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData } from '@/lib/cache'
import {
  type QueryExecutor,
  type FiscalDateRangeParams,
  type SssDentalResult,
  type DentalDoctorSummaryItem,
  type DentalPatientVisitItem,
  type OpdDoctorSummaryResult,
  type DoctorSummaryItem,
  type PttypeOption,
  type OPDRecord,
  type OpdDepartmentSummaryItem,
  type OpdDepartmentSummaryQueryRow,
  type IPDRecord,
  type IPDReportResult,
  type DepartmentMetricData,
  type IpdDepartmentAdjrwItem,
  type IpdDepartmentAdjrwQueryRow,
  type DoctorChartSummary,
  type IPDChartReportData,
  type InvoiceSummaryResult,
  type InvoiceSummaryItem,
  type InvoiceSummaryGrandTotal,
  type InvoiceDetailResult,
  type InvoiceDetailItem,
  type PalliativeCareReportParams,
  type PalliativeCareResult,
  type PalliativeCareItem,
  type PalliativeCareSummary,
  type PalliativeCarePc1ReportParams,
  type PalliativeCarePc1Result,
  type PalliativeCarePc1Item,
  type PalliativeCarePc1Summary,
  type VnClinicalDetails,
  type VnScreenData,
  type VnDiagItem,
  type VnOrderItem,
  type VnOrderCategoryGroup,
  type VnOrderCategorySummary,
  CLINICAL_DEPARTMENT_DEFINITIONS,
  BASE_COMPENSATION_OPTIONS,
  resolveFiscalDateRange,
  formatThaiSex,
  buildDepartmentSqlCase,
  classifySpecialty,
  dateRangeToYymmList,
  buildInvoiceCountAndSummarySql,
  mapInvoiceFilteredSummary,
} from './typesAndHelpers'

  /**
   * 5.2.2.1 รายงานสรุปรายรับจาก Invoice (e-Claim Reconciliation Summary)
   */
export async function getInvoiceSummary(
    params: {
      department?: 'OP' | 'IP'
      ds1?: string
      ds2?: string
      dateType?: 'bill_date' | 'admdate'
    } = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<InvoiceSummaryResult> {
    const department = params.department === 'IP' ? 'IP' : 'OP'
    const dateType = params.dateType === 'admdate' ? 'admdate' : 'bill_date'
    const dateCol = dateType === 'admdate' ? 'admdate' : 'bill_date'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const filterStart = dateType === 'admdate' ? `${ds1} 00:00:00` : ds1
    const filterEnd = dateType === 'admdate' ? `${ds2} 23:59:59` : ds2
    const cacheKey = `rcm-invoice-summary-${department}-${dateType}-${ds1}-${ds2}`

    return getCachedData(
      cacheKey,
      async () => {
        // In production with default queryClinicalDb executor, use dedicated Gateway endpoint
        if (executor === queryClinicalDb) {
          try {
            const gwRes = await apiGateway.clinical.getRcmInvoiceSummary({
              department,
              startDate: ds1,
              endDate: ds2,
              dateType,
            })
            if (gwRes && gwRes.items) {
              return {
                department,
                ds1,
                ds2,
                dateType,
                items: gwRes.items.filter((r) => Number(r.visit || 0) > 0),
                grandTotal: gwRes.grandTotal,
              }
            }
          } catch {
            // Fall back to parameterized query via executor if dedicated endpoint is pending reload
          }
        }

        const queryParams: any[] = [filterStart, filterEnd]
        let query = ''

        if (department === 'OP') {
          query = `
            SELECT 
              COALESCE(t.pttype_eclaim_id, 'UNKNOWN') as code,
              COALESCE(a.name, 'ไม่ระบุกลุ่มสิทธิ e-Claim') as name,
              t.visit,
              t.receipt,
              t.compensated,
              t.down,
              t.up,
              t.debit
            FROM (
              SELECT 
                ptt.pttype_eclaim_id,
                COUNT(t.vn) as visit,
                ROUND(SUM(t.receipt), 2) as receipt,
                ROUND(SUM(t.compensated), 2) as compensated,
                ROUND(SUM(t.down), 2) as down,
                ROUND(SUM(t.up), 2) as up,
                ROUND(SUM(t.debit), 2) as debit
              FROM (
                SELECT 
                  t.vn,
                  o.pttype,
                  SUM(t.compensated) as compensated,
                  SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)) as receipt,
                  v.income - v.rcpt_money as debit,
                  CASE 
                    WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                    WHEN SUM(t.compensated) - (v.income - v.rcpt_money) > 0 THEN SUM(t.compensated) - (v.income - v.rcpt_money)
                    ELSE 0 
                  END as down,
                  CASE
                    WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                    WHEN SUM(t.compensated) - (v.income - v.rcpt_money) < 0 THEN SUM(t.compensated) - (v.income - v.rcpt_money)
                    ELSE 0 
                  END as up
                FROM rcmdb.repeclaim t
                LEFT JOIN hos.ovst o ON o.vn = t.vn
                LEFT JOIN hos.vn_stat v ON v.vn = o.vn
                WHERE t.department = 'OP'
                  AND t.${dateCol} BETWEEN ? AND ?
                GROUP BY t.vn, o.pttype, v.income, v.rcpt_money
              ) t
              LEFT JOIN hos.pttype ptt ON ptt.pttype = t.pttype
              GROUP BY ptt.pttype_eclaim_id
            ) t
            LEFT JOIN hos.pttype_eclaim a ON a.code = t.pttype_eclaim_id
            WHERE t.visit > 0
            ORDER BY t.visit DESC, code ASC;
          `
        } else {
          query = `
            SELECT 
              COALESCE(t.pttype_eclaim_id, 'UNKNOWN') as code,
              COALESCE(a.name, 'ไม่ระบุกลุ่มสิทธิ e-Claim') as name,
              t.visit,
              t.receipt,
              t.compensated,
              t.down,
              t.up,
              t.debit
            FROM (
              SELECT 
                ptt.pttype_eclaim_id,
                COUNT(t.an) as visit,
                ROUND(SUM(t.receipt), 2) as receipt,
                ROUND(SUM(t.compensated), 2) as compensated,
                ROUND(SUM(t.down), 2) as down,
                ROUND(SUM(t.up), 2) as up,
                ROUND(SUM(t.debit), 2) as debit
              FROM (
                SELECT 
                  t.an,
                  i.pttype,
                  SUM(t.compensated) as compensated,
                  SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)) as receipt,
                  a.income - a.rcpt_money as debit,
                  CASE 
                    WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                    WHEN SUM(t.compensated) - (a.income - a.rcpt_money) > 0 THEN SUM(t.compensated) - (a.income - a.rcpt_money)
                    ELSE 0 
                  END as down,
                  CASE
                    WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                    WHEN SUM(t.compensated) - (a.income - a.rcpt_money) < 0 THEN SUM(t.compensated) - (a.income - a.rcpt_money)
                    ELSE 0 
                  END as up
                FROM rcmdb.repeclaim t
                LEFT JOIN hos.ipt i ON i.an = t.an
                LEFT JOIN hos.an_stat a ON a.an = i.an
                WHERE t.department = 'IP'
                  AND t.${dateCol} BETWEEN ? AND ?
                GROUP BY t.an, i.pttype, a.income, a.rcpt_money
              ) t
              LEFT JOIN hos.pttype ptt ON ptt.pttype = t.pttype
              GROUP BY ptt.pttype_eclaim_id
            ) t
            LEFT JOIN hos.pttype_eclaim a ON a.code = t.pttype_eclaim_id
            WHERE t.visit > 0
            ORDER BY t.visit DESC, code ASC;
          `
        }

        const rows = (await executor(query, queryParams)) as any[]

        let grandVisit = 0
        let grandReceipt = 0
        let grandCompensated = 0
        let grandDown = 0
        let grandUp = 0
        let grandDebit = 0

        const items: InvoiceSummaryItem[] = rows
          .filter((r) => Number(r.visit || 0) > 0)
          .map((r) => {
            const visit = Number(r.visit || 0)
            const receipt = Number(r.receipt || 0)
            const compensated = Number(r.compensated || 0)
            const down = Number(r.down || 0)
            const up = Number(r.up || 0)
            const debit = Number(r.debit || 0)

            grandVisit += visit
            grandReceipt += receipt
            grandCompensated += compensated
            grandDown += down
            grandUp += up
            grandDebit += debit

            return {
              code: String(r.code || ''),
              name: String(r.name || ''),
              visit,
              receipt: Math.round(receipt * 100) / 100,
              compensated: Math.round(compensated * 100) / 100,
              down: Math.round(down * 100) / 100,
              up: Math.round(up * 100) / 100,
              debit: Math.round(debit * 100) / 100,
            }
          })

        return {
          department,
          ds1,
          ds2,
          items,
          grandTotal: {
            visit: grandVisit,
            receipt: Math.round(grandReceipt * 100) / 100,
            compensated: Math.round(grandCompensated * 100) / 100,
            down: Math.round(grandDown * 100) / 100,
            up: Math.round(grandUp * 100) / 100,
            debit: Math.round(grandDebit * 100) / 100,
          },
        }
      },
      60_000 * 3 // 3 minutes TTL (180_000ms)
    )
  }

  /**
   * 5.2.2.1 รายชื่อผู้ป่วยและรายละเอียดการชดเชย Invoice (Drill-down Patient List)
   */
export async function getInvoiceDetails(
    params: {
      department?: 'OP' | 'IP'
      ds1?: string
      ds2?: string
      pttype?: string
      search?: string
      page?: number
      pageSize?: number
      exportAll?: boolean
      dateType?: 'bill_date' | 'admdate'
    } = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<InvoiceDetailResult> {
    const department = params.department === 'IP' ? 'IP' : 'OP'
    const dateType = params.dateType === 'admdate' ? 'admdate' : 'bill_date'
    const dateCol = dateType === 'admdate' ? 'admdate' : 'bill_date'
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const filterStart = dateType === 'admdate' ? `${ds1} 00:00:00` : ds1
    const filterEnd = dateType === 'admdate' ? `${ds2} 23:59:59` : ds2
    const pttype = (params.pttype || '').trim()
    const search = (params.search || '').trim()
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = params.exportAll ? 1000000 : Math.max(1, Number(params.pageSize || 50))
    const offset = (page - 1) * pageSize

    const pttypeClause = pttype ? 'AND ptt.pttype_eclaim_id = ?' : ''
    let searchClause = ''
    const searchParams: any[] = []

    if (search) {
      searchClause = `AND (
        t.hn LIKE ? OR 
        ${department === 'OP' ? 't.vn' : 't.an'} LIKE ? OR 
        t.ptname LIKE ? OR 
        t.pid LIKE ? OR 
        t.rep LIKE ? OR 
        t.bill LIKE ?
      )`
      const s = `%${search}%`
      searchParams.push(s, s, s, s, s, s)
    }

    const filterParams: any[] = [filterStart, filterEnd]
    if (pttype) filterParams.push(pttype)
    if (search) filterParams.push(...searchParams)

    const countAndSummarySql = buildInvoiceCountAndSummarySql(
      department,
      dateCol,
      pttypeClause,
      searchClause
    )

    // In production with default queryClinicalDb executor, use dedicated Gateway endpoint
    if (executor === queryClinicalDb) {
      try {
        const gwRes = await apiGateway.clinical.getRcmInvoiceDetails({
          department,
          startDate: ds1,
          endDate: ds2,
          pttype: pttype || undefined,
          search: search || undefined,
          page,
          pageSize,
          exportAll: params.exportAll,
          dateType,
        })
        if (gwRes && Array.isArray(gwRes.items)) {
          let filteredSummary = gwRes.filteredSummary
          if (!filteredSummary && !params.exportAll) {
            const summaryCacheKey = `rcm-invoice-detail-summary-${department}-${dateType}-${ds1}-${ds2}-${pttype}-${search}`
            filteredSummary = await getCachedData(
              summaryCacheKey,
              async () => {
                const summaryRows = (await executor(countAndSummarySql, filterParams)) as Record<string, unknown>[]
                return mapInvoiceFilteredSummary(summaryRows?.[0])
              },
              60_000 * 3
            )
          }

          return {
            department,
            ds1,
            ds2,
            dateType,
            pttype: pttype || undefined,
            items: gwRes.items as InvoiceDetailItem[],
            totalCount: Number(gwRes.totalCount || 0),
            totalPages: Number(gwRes.totalPages || 1),
            page: Number(gwRes.page || page),
            pageSize: Number(gwRes.pageSize || pageSize),
            filteredSummary,
          }
        }
      } catch {
        // Fall back to parameterized query via executor if dedicated endpoint is pending reload
      }
    }

    // 2. Fetch data query
    let dataSql = ''
    const dataParams: any[] = [...filterParams, pageSize, offset]

    if (department === 'OP') {
      dataSql = `
        SELECT STRAIGHT_JOIN 
          t.vn as vnOrAn,
          t.pid as cid,
          t.hn,
          t.ptname,
          DATE_FORMAT(t.admdate, '%Y-%m-%d') as vstdate,
          DATE_FORMAT(t.admdate, '%T') as vsttime,
          ROUND(SUM(t.compensated), 2) as compensated,
          ROUND(SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)), 2) as fund_money,
          ROUND(v.income, 2) as income_hosxp,
          ROUND(v.rcpt_money, 2) as rcpt_money,
          ROUND(v.income - v.rcpt_money, 2) as debit_hosxp,
          ROUND(SUM(t.hc), 2) as hc,
          ROUND(SUM(t.ae), 2) as ae,
          ROUND(SUM(t.inst), 2) as inst,
          ROUND(SUM(t.op), 2) as op,
          ROUND(SUM(t.ip), 2) as ip,
          ROUND(SUM(t.drug), 2) as drug,
          ROUND(SUM(t.dmis), 2) as dmis,
          CASE 
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (v.income - v.rcpt_money) > 0 THEN ROUND(SUM(t.compensated) - (v.income - v.rcpt_money), 2)
            ELSE 0 
          END as down,
          CASE
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (v.income - v.rcpt_money) < 0 THEN ROUND(SUM(t.compensated) - (v.income - v.rcpt_money), 2)
            ELSE 0 
          END as up,
          GROUP_CONCAT(DISTINCT t.rep ORDER BY t.rep) as rep,
          GROUP_CONCAT(DISTINCT t.bill ORDER BY t.rep) as bill,
          GROUP_CONCAT(DISTINCT DATE_FORMAT(t.bill_date, '%Y-%m-%d') ORDER BY t.rep) as billdate,
          ptt.pttype_eclaim_id,
          o.pttype
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ovst o ON o.vn = t.vn
        LEFT JOIN hos.vn_stat v ON v.vn = o.vn
        LEFT JOIN hos.pttype ptt ON ptt.pttype = o.pttype
        WHERE t.department = 'OP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause}
        GROUP BY t.vn, t.pid, t.hn, t.ptname, t.admdate, v.income, v.rcpt_money, ptt.pttype_eclaim_id, o.pttype
        ORDER BY t.admdate DESC, t.vn DESC
        LIMIT ? OFFSET ?;
      `
    } else {
      dataSql = `
        SELECT STRAIGHT_JOIN 
          t.an as vnOrAn,
          t.pid as cid,
          t.hn,
          t.ptname,
          DATE_FORMAT(t.admdate, '%Y-%m-%d') as admdate,
          DATE_FORMAT(t.dchdate, '%Y-%m-%d') as dchdate,
          ROUND(SUM(t.compensated), 2) as compensated,
          ROUND(SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)), 2) as fund_money,
          ROUND(a.income, 2) as income_hosxp,
          ROUND(a.rcpt_money, 2) as rcpt_money,
          ROUND(a.income - a.rcpt_money, 2) as debit_hosxp,
          ROUND(SUM(t.hc), 2) as hc,
          ROUND(SUM(t.ae), 2) as ae,
          ROUND(SUM(t.inst), 2) as inst,
          ROUND(SUM(t.op), 2) as op,
          ROUND(SUM(t.ip), 2) as ip,
          ROUND(SUM(t.drug), 2) as drug,
          ROUND(SUM(t.dmis), 2) as dmis,
          CASE 
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (a.income - a.rcpt_money) > 0 THEN ROUND(SUM(t.compensated) - (a.income - a.rcpt_money), 2)
            ELSE 0 
          END as down,
          CASE
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (a.income - a.rcpt_money) < 0 THEN ROUND(SUM(t.compensated) - (a.income - a.rcpt_money), 2)
            ELSE 0 
          END as up,
          GROUP_CONCAT(DISTINCT t.rep ORDER BY t.rep) as rep,
          GROUP_CONCAT(DISTINCT t.bill ORDER BY t.rep) as bill,
          GROUP_CONCAT(DISTINCT DATE_FORMAT(t.bill_date, '%Y-%m-%d') ORDER BY t.rep) as billdate,
          ptt.pttype_eclaim_id,
          i.pttype
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ipt i ON i.an = t.an
        LEFT JOIN hos.an_stat a ON a.an = i.an
        LEFT JOIN hos.pttype ptt ON ptt.pttype = i.pttype
        WHERE t.department = 'IP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause}
        GROUP BY t.an, t.pid, t.hn, t.ptname, t.admdate, t.dchdate, a.income, a.rcpt_money, ptt.pttype_eclaim_id, i.pttype
        ORDER BY t.admdate DESC, t.an DESC
        LIMIT ? OFFSET ?;
      `
    }

    const [countRes, rows] = (await Promise.all([
      executor(countAndSummarySql, filterParams),
      executor(dataSql, dataParams),
    ])) as [Record<string, unknown>[], any[]]

    const totalCount = Number(countRes?.[0]?.total || 0)
    const totalPages = Math.ceil(totalCount / pageSize) || 1
    const filteredSummary = mapInvoiceFilteredSummary(countRes?.[0])

    const items: InvoiceDetailItem[] = rows.map((r, idx) => ({
      no: offset + idx + 1,
      vnOrAn: String(r.vnOrAn || ''),
      cid: String(r.cid || ''),
      hn: String(r.hn || ''),
      ptname: String(r.ptname || ''),
      vstdate: r.vstdate ? String(r.vstdate) : undefined,
      vsttime: r.vsttime ? String(r.vsttime) : undefined,
      admdate: r.admdate ? String(r.admdate) : undefined,
      dchdate: r.dchdate ? String(r.dchdate) : undefined,
      income_hosxp: Number(r.income_hosxp || 0),
      rcpt_money: Number(r.rcpt_money || 0),
      debit_hosxp: Number(r.debit_hosxp || 0),
      compensated: Number(r.compensated || 0),
      fund_money: Number(r.fund_money || 0),
      hc: Number(r.hc || 0),
      ae: Number(r.ae || 0),
      inst: Number(r.inst || 0),
      op: Number(r.op || 0),
      ip: Number(r.ip || 0),
      drug: Number(r.drug || 0),
      dmis: Number(r.dmis || 0),
      down: Number(r.down || 0),
      up: Number(r.up || 0),
      rep: String(r.rep || ''),
      bill: String(r.bill || ''),
      billdate: String(r.billdate || ''),
      pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id) : undefined,
      pttype: r.pttype ? String(r.pttype) : undefined,
    }))

    return {
      department,
      ds1,
      ds2,
      dateType,
      pttype: pttype || undefined,
      totalCount,
      page,
      pageSize,
      totalPages,
      items,
      filteredSummary,
    }
  }
