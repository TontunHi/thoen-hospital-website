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
   * 2.1.1.1 รายงานการให้บริการทันตกรรมสิทธิ์ประกันสังคม จำแนกตามทันตแพทย์
   */
export async function getSssDentalReport(
    params: FiscalDateRangeParams & {
      doctorFilter?: string
      fetchVisits?: boolean
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<SssDentalResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const { doctorFilter = '', fetchVisits = false } = params
    const cacheKey = `rcm-sss-dental-${ds1}-${ds2}-${doctorFilter}-${fetchVisits}`

    return getCachedData(
      cacheKey,
      async () => {
        const summaryWhere = [
          'o.vstdate BETWEEN ? AND ?',
          "IFNULL(o.an, '') = ''",
          "o.pttype = '00'", // สิทธิประกันสังคมทำฟัน
        ]
        const summaryParams: any[] = [ds1, ds2]

        if (doctorFilter) {
          summaryWhere.push('o.doctor = ?')
          summaryParams.push(doctorFilter)
        }

        const summaryQuery = `
          SELECT 
            IFNULL(o.doctor, 'UNKNOWN') AS doctor_code,
            IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')) AS doctor_name,
            DATE_FORMAT(o.vstdate, '%Y-%m') AS ym,
            COUNT(DISTINCT o.vn) AS visits,
            SUM(IFNULL(v.income, 0)) AS income,
            SUM(IFNULL(v.uc_money, 0)) AS uc_money,
            SUM(IFNULL(v.discount_money, 0)) AS discount_money,
            SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
            SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
          FROM ovst o
          INNER JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN doctor d ON d.code = o.doctor
          WHERE ${summaryWhere.join(' AND ')}
          GROUP BY IFNULL(o.doctor, 'UNKNOWN'), IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')), DATE_FORMAT(o.vstdate, '%Y-%m')
          ORDER BY doctor_name ASC, ym ASC
        `

        const summaryRows = await executor(summaryQuery, summaryParams)

        const doctorMap: Record<string, DentalDoctorSummaryItem> = {}
        const monthsSet = new Set<string>()

        summaryRows.forEach((row: any) => {
          const docCode = row.doctor_code
          const ym = row.ym
          monthsSet.add(ym)

          if (!doctorMap[docCode]) {
            doctorMap[docCode] = {
              doctor_code: docCode,
              doctor_name: row.doctor_name,
              total_visits: 0,
              total_income: 0,
              total_uc_money: 0,
              total_rcpt_money: 0,
              total_discount: 0,
              total_debit: 0,
              monthly_income: {},
              monthly_visits: {},
            }
          }

          const inc = Number(row.income) || 0
          const vis = Number(row.visits) || 0

          doctorMap[docCode].total_visits += vis
          doctorMap[docCode].total_income += inc
          doctorMap[docCode].total_uc_money += Number(row.uc_money) || 0
          doctorMap[docCode].total_rcpt_money += Number(row.rcpt_money) || 0
          doctorMap[docCode].total_discount += Number(row.discount_money) || 0
          doctorMap[docCode].total_debit += Number(row.debit) || 0

          doctorMap[docCode].monthly_income[ym] = (doctorMap[docCode].monthly_income[ym] || 0) + inc
          doctorMap[docCode].monthly_visits[ym] = (doctorMap[docCode].monthly_visits[ym] || 0) + vis
        })

        const doctors = Object.values(doctorMap).sort((a, b) => b.total_income - a.total_income)
        const months = Array.from(monthsSet).sort()

        const monthlyTotals: Record<string, { income: number; visits: number }> = {}
        months.forEach((m) => {
          monthlyTotals[m] = { income: 0, visits: 0 }
          doctors.forEach((d) => {
            monthlyTotals[m].income += d.monthly_income[m] || 0
            monthlyTotals[m].visits += d.monthly_visits[m] || 0
          })
        })

        const grandTotal = {
          visits: doctors.reduce((sum, d) => sum + d.total_visits, 0),
          income: doctors.reduce((sum, d) => sum + d.total_income, 0),
          uc_money: doctors.reduce((sum, d) => sum + d.total_uc_money, 0),
          rcpt_money: doctors.reduce((sum, d) => sum + d.total_rcpt_money, 0),
          discount: doctors.reduce((sum, d) => sum + d.total_discount, 0),
          debit: doctors.reduce((sum, d) => sum + d.total_debit, 0),
        }

        let visitsData: DentalPatientVisitItem[] | undefined
        if (fetchVisits) {
          const visitWhere = [
            'o.vstdate BETWEEN ? AND ?',
            "IFNULL(o.an, '') = ''",
            "o.pttype = '00'",
          ]
          const visitParams: any[] = [ds1, ds2]

          if (doctorFilter) {
            visitWhere.push('o.doctor = ?')
            visitParams.push(doctorFilter)
          }

          const visitQuery = `
            SELECT 
              o.vn,
              o.hn,
              IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
              IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              IFNULL(k.department, o.main_dep) AS department,
              IFNULL(v.pdx, '') AS pdx,
              IFNULL(icd.name, v.pdx) AS pdxname,
              IFNULL(o.doctor, '') AS doctor_code,
              IFNULL(d.name, o.doctor) AS doctor_name,
              IFNULL(v.income, 0) AS income,
              IFNULL(v.uc_money, 0) AS uc_money,
              IFNULL(v.discount_money, 0) AS discount_money,
              IFNULL(v.paid_money, 0) AS paid_money,
              IFNULL(v.rcpt_money, 0) AS rcpt_money,
              (IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit,
              IFNULL(v.rcpno_list, '') AS rcpno
            FROM ovst o
            INNER JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
            LEFT JOIN icd101 icd ON icd.code = v.pdx
            LEFT JOIN doctor d ON d.code = o.doctor
            WHERE ${visitWhere.join(' AND ')}
            ORDER BY o.vstdate DESC, o.vsttime DESC
          `
          const vRows = await executor(visitQuery, visitParams)
          visitsData = (vRows as any[]).map((r) => ({
            ...r,
            sex: formatThaiSex(r.sex_code, r.sex),
          })) as DentalPatientVisitItem[]
        }

        return {
          months,
          doctors,
          monthlyTotals,
          grandTotal,
          visits: visitsData,
        }
      },
      30000 // Cache TTL 30s
    )
  }

  /**
   * 2.1.1.2 สรุปค่าบริการผู้ป่วยนอก OPD จำแนกรายแพทย์ และตัวเลือก 37 สิทธิ e-Claim
   */
export async function getOpdDoctorSummary(
    params: FiscalDateRangeParams & {
      eclaimsParam?: string
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<OpdDoctorSummaryResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const { eclaimsParam = '' } = params
    const cacheKey = `rcm-opd-doctor-summary-${ds1}-${ds2}-${eclaimsParam}`

    return getCachedData(
      cacheKey,
      async () => {
        // ดึง 37 สิทธิมาตรฐาน e-Claim
        const allPttypeQuery = `
          SELECT 
            code, 
            name
          FROM pttype_eclaim 
          ORDER BY CAST(code AS UNSIGNED), code ASC
        `
        const allPttypeRows = (await executor(allPttypeQuery)) as PttypeOption[]

        const whereClauses: string[] = [
          'v.vstdate BETWEEN ? AND ?',
        ]
        const queryParams: any[] = [ds1, ds2]

        if (eclaimsParam && eclaimsParam.trim() !== '') {
          const list = eclaimsParam
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          if (list.length > 0) {
            whereClauses.push(
              `ptt.pttype_eclaim_id IN (${list.map(() => '?').join(',')})`
            )
            queryParams.push(...list)
          }
        }

        const query = `
          SELECT 
            IFNULL(o.doctor, 'UNKNOWN') AS doctor_code,
            IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')) AS doctor_name,
            DATE_FORMAT(v.vstdate, '%Y-%m') AS ym,
            COUNT(v.vn) AS visits,
            SUM(IFNULL(v.income, 0)) AS income,
            SUM(IFNULL(v.uc_money, 0)) AS uc_money,
            SUM(IFNULL(v.discount_money, 0)) AS discount_money,
            SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
            SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
          FROM vn_stat v
          INNER JOIN ovst o ON o.vn = v.vn AND (o.an IS NULL OR o.an = '')
          INNER JOIN pttype ptt ON ptt.pttype = v.pttype
          LEFT JOIN doctor d ON d.code = o.doctor
          WHERE ${whereClauses.join(' AND ')}
          GROUP BY IFNULL(o.doctor, 'UNKNOWN'), IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')), DATE_FORMAT(v.vstdate, '%Y-%m')
          ORDER BY doctor_name ASC, ym ASC
        `

        const rows = await executor(query, queryParams)

        const doctorMap: Record<string, DoctorSummaryItem> = {}
        const monthsSet = new Set<string>()

        rows.forEach((row: any) => {
          const docCode = row.doctor_code
          const ym = row.ym
          monthsSet.add(ym)

          if (!doctorMap[docCode]) {
            doctorMap[docCode] = {
              doctor_code: docCode,
              doctor_name: row.doctor_name,
              total_visits: 0,
              total_income: 0,
              total_uc_money: 0,
              total_rcpt_money: 0,
              total_discount: 0,
              total_debit: 0,
              monthly_income: {},
              monthly_visits: {},
            }
          }

          const inc = Number(row.income) || 0
          const vis = Number(row.visits) || 0

          doctorMap[docCode].total_visits += vis
          doctorMap[docCode].total_income += inc
          doctorMap[docCode].total_uc_money += Number(row.uc_money) || 0
          doctorMap[docCode].total_rcpt_money += Number(row.rcpt_money) || 0
          doctorMap[docCode].total_discount += Number(row.discount_money) || 0
          doctorMap[docCode].total_debit += Number(row.debit) || 0

          doctorMap[docCode].monthly_income[ym] = (doctorMap[docCode].monthly_income[ym] || 0) + inc
          doctorMap[docCode].monthly_visits[ym] = (doctorMap[docCode].monthly_visits[ym] || 0) + vis
        })

        const doctors = Object.values(doctorMap).sort((a, b) => b.total_income - a.total_income)
        const months = Array.from(monthsSet).sort()

        const monthlyTotals: Record<string, { income: number; visits: number }> = {}
        months.forEach((m) => {
          monthlyTotals[m] = { income: 0, visits: 0 }
          doctors.forEach((d) => {
            monthlyTotals[m].income += d.monthly_income[m] || 0
            monthlyTotals[m].visits += d.monthly_visits[m] || 0
          })
        })

        const grandTotal = {
          visits: doctors.reduce((sum, d) => sum + d.total_visits, 0),
          income: doctors.reduce((sum, d) => sum + d.total_income, 0),
          uc_money: doctors.reduce((sum, d) => sum + d.total_uc_money, 0),
          rcpt_money: doctors.reduce((sum, d) => sum + d.total_rcpt_money, 0),
          discount: doctors.reduce((sum, d) => sum + d.total_discount, 0),
          debit: doctors.reduce((sum, d) => sum + d.total_debit, 0),
        }

        return {
          months,
          doctors,
          monthlyTotals,
          grandTotal,
          allPttypeOptions: allPttypeRows,
        }
      },
      30000
    )
  }

  /**
   * รายงานผู้ป่วยนอก OPD รายละเอียด (กรณีต้องการดูรายคน)
   */
export async function getOpdDetailedReport(
    params: FiscalDateRangeParams & {
      pttype?: string
      isAll?: boolean
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<OPDRecord[]> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const { pttype = '', isAll = false } = params
    const cacheKey = `rcm-opd-detailed-${ds1}-${ds2}-${pttype}-${isAll}`

    return getCachedData(
      cacheKey,
      async () => {
        const query = `
          SELECT 
            o.vn,
            o.hn,
            IFNULL(o.an, '') AS an,
            IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            IFNULL(pt.sex, '') AS sex_code,
            CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
            IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            IFNULL(k.department, o.main_dep) AS department,
            IFNULL(sp.name, o.spclty) AS clinic,
            IFNULL(v.pdx, '') AS pdx,
            IFNULL(icd.name, v.pdx) AS pdxname,
            IFNULL(o.pttype, '') AS pttype,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(e.name, '') AS pttype_eclaim_name,
            IFNULL(e.ar_opd, '') AS accountcode,
            IFNULL(v.income, 0) AS income,
            IFNULL(v.uc_money, 0) AS uc_money,
            IFNULL(v.discount_money, 0) AS discount_money,
            IFNULL(v.paid_money, 0) AS paid_money,
            IFNULL(v.rcpt_money, 0) AS rcpt_money,
            IFNULL(v.rcpno_list, '') AS rcpno,
            (IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit,
            IFNULL(d.name, o.doctor) AS doctorname,
            0 AS ct,
            0 AS cm
          FROM ovst o
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
          LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
          LEFT JOIN spclty sp ON sp.spclty = o.spclty
          LEFT JOIN icd101 icd ON icd.code = v.pdx
          LEFT JOIN doctor d ON d.code = o.doctor
          WHERE o.vstdate BETWEEN ? AND ?
          ${!isAll ? "AND IFNULL(o.an, '') = ''" : ''}
          ${pttype ? 'AND o.pttype = ?' : ''}
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC
        `

        const queryParams = pttype ? [ds1, ds2, pttype] : [ds1, ds2]
        const rows = await executor(query, queryParams)
        return (rows as any[]).map((r) => ({
          ...r,
          sex: formatThaiSex(r.sex_code, r.sex),
        })) as OPDRecord[]
      },
      30000
    )
  }

  /**
   * สรุปจำนวนผู้รับบริการผู้ป่วยนอก (OPD) แยกรายแผนก และแถวสรุปรวมทั้งโรงพยาบาล
   */
export async function getOpdDepartmentSummary(
    params: FiscalDateRangeParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<OpdDepartmentSummaryItem[]> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cacheKey = `rcm-opd-dept-summary-v2-${ds1}-${ds2}`

    return getCachedData(
      cacheKey,
      async () => {
        const opdDeptCase = buildDepartmentSqlCase('o', 's', 'label')
        const query = `
          SELECT 
            dept_group,
            COUNT(DISTINCT t.hn) AS patients,
            COUNT(DISTINCT t.vn) AS visits
          FROM (
            SELECT 
              o.hn,
              o.vn,
              ${opdDeptCase} AS dept_group
            FROM ovst o
            LEFT JOIN spclty s ON s.spclty = o.spclty
            WHERE o.vstdate BETWEEN ? AND ?
          ) t
          GROUP BY dept_group

          UNION ALL

          -- แถวสรุปรวมทั้งโรงพยาบาล
          SELECT 
            'รวมทั้งหมด' AS dept_group,
            COUNT(DISTINCT o.hn) AS patients,
            COUNT(DISTINCT o.vn) AS visits
          FROM ovst o
          WHERE o.vstdate BETWEEN ? AND ?
          ORDER BY dept_group;
        `

        const rows = (await executor(query, [ds1, ds2, ds1, ds2])) as OpdDepartmentSummaryQueryRow[]

        return rows.map((r: OpdDepartmentSummaryQueryRow) => ({
          dept_group: String(r.dept_group || r['แผนก'] || ''),
          patients: Number(r.patients ?? r['จำนวนคน'] ?? 0),
          visits: Number(r.visits ?? r['จำนวนครั้ง'] ?? 0),
        }))
      },
      60_000 * 5 // 5 minutes TTL (300_000ms)
    )
  }
