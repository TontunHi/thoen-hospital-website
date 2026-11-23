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
   * 2.1.2.1 รายงานสรุปการให้บริการผู้ป่วยในโรงพยาบาลเถิน (IPD)
   */
export async function getIpdReport(
    params: FiscalDateRangeParams & {
      pttype?: string
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IPDRecord[]> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const { pttype = '' } = params
    const cacheKey = `rcm-ipd-report-${ds1}-${ds2}-${pttype}`

    return getCachedData(
      cacheKey,
      async () => {
        const query = `
          SELECT 
            i.an,
            i.hn,
            IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            IFNULL(pt.sex, '') AS sex_code,
            CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
            IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
            DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
            DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
            IFNULL(DATEDIFF(i.dchdate, i.regdate), 0) AS los,
            DATE_FORMAT(idx.modify_datetime, '%Y-%m-%d') AS editdate,
            DATEDIFF(idx.modify_datetime, i.dchdate) AS summary_days,
            IFNULL(i.ward, '') AS ward,
            IFNULL(w.name, i.ward) AS ward_name,
            '' AS bedno,
            IFNULL(sp.name, i.spclty) AS clinic,
            IFNULL(i.prediag, '') AS prediag,
            IFNULL(a.pdx, '') AS pdx,
            IFNULL(icd.name, a.pdx) AS pdxname,
            '' AS sdx,
            '' AS proc,
            IFNULL(i.adjrw, 0) AS adjrw,
            IFNULL(d1.name, i.admdoctor) AS admdoctor,
            IFNULL(d2.name, i.dch_doctor) AS dchdoctor,
            '' AS authencode,
            IFNULL(i.pttype, '') AS pttype,
            IFNULL(ptt.name, i.pttype) AS pttypename,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(e.ar_ipd, '') AS accountcode,
            '' AS hospmain,
            '' AS hospsub,
            IFNULL(ds.name, i.dchstts) AS dchstts,
            IFNULL(dt.name, i.dchtype) AS dchtype,
            IF(idx.modify_datetime IS NOT NULL, 'สรุปผลแล้ว', 'รอสรุป') AS status,
            IFNULL(a.income, 0) AS income,
            IFNULL(a.uc_money, 0) AS uc_money,
            IFNULL(a.discount_money, 0) AS discount_money,
            IFNULL(a.paid_money, 0) AS paid_money,
            IFNULL(a.rcpt_money, 0) AS rcpt_money,
            IFNULL(a.rcpno_list, '') AS rcpno,
            (IFNULL(a.income, 0) - IFNULL(a.discount_money, 0) - IFNULL(a.rcpt_money, 0)) AS debit
          FROM ipt i
          LEFT JOIN an_stat a ON a.an = i.an
          LEFT JOIN patient pt ON i.hn = pt.hn
          LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
          LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
          LEFT JOIN ward w ON w.ward = i.ward
          LEFT JOIN spclty sp ON sp.spclty = i.spclty
          LEFT JOIN icd101 icd ON icd.code = a.pdx
          LEFT JOIN doctor d1 ON d1.code = i.admdoctor
          LEFT JOIN doctor d2 ON d2.code = i.dch_doctor
          LEFT JOIN dchstts ds ON ds.dchstts = i.dchstts
          LEFT JOIN dchtype dt ON dt.dchtype = i.dchtype
          LEFT JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
          WHERE i.dchdate BETWEEN ? AND ?
          ${pttype ? 'AND i.pttype = ?' : ''}
          GROUP BY i.an
          ORDER BY i.dchdate DESC, i.an DESC
        `

        const queryParams = pttype ? [ds1, ds2, pttype] : [ds1, ds2]
        const rows = await executor(query, queryParams)
        return (rows as any[]).map((r) => ({
          ...r,
          sex: formatThaiSex(r.sex_code, r.sex),
        })) as IPDRecord[]
      },
      30000
    )
  }

  /**
   * 2.1.2.2 จำนวน SumAdjRW แยกรายแผนก IPD
   */
export async function getIpdDepartmentAdjrw(
    params: FiscalDateRangeParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IpdDepartmentAdjrwItem[]> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cacheKey = `rcm-ipd-dept-adjrw-v2-${ds1}-${ds2}`

    const DEPT_KEYS = [
      'medicine',
      'surgery',
      'obgyn',
      'pediatrics',
      'orthopedics',
      'ent',
      'eye',
      'other',
      'dental',
      'psychiatry',
    ] as const

    const createDefaultDepts = (): Record<string, DepartmentMetricData> => ({
      medicine: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      surgery: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      obgyn: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      pediatrics: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      orthopedics: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      ent: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      eye: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      other: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      dental: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
      psychiatry: { patients: 0, visits: 0, adjrw: 0, cmi: 0 },
    })

    return getCachedData(
      cacheKey,
      async () => {
        const ipdDeptCase = buildDepartmentSqlCase('i', 's', 'key')
        const query = `
          SELECT 
            CASE WHEN MONTH(i.dchdate) >= 10 THEN MONTH(i.dchdate) - 9 ELSE MONTH(i.dchdate) + 3 END AS sort_order,
            CONCAT(
              ELT(MONTH(i.dchdate), 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'),
              '-',
              RIGHT(YEAR(i.dchdate) + 543, 2)
            ) AS dch_month,
            ${ipdDeptCase} AS dept_key,
            COUNT(DISTINCT i.hn) AS patients,
            COUNT(DISTINCT i.an) AS visits,
            ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
            ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
          FROM ipt i
          LEFT JOIN spclty s ON s.spclty = i.spclty
          WHERE i.dchdate BETWEEN ? AND ?
          GROUP BY YEAR(i.dchdate), MONTH(i.dchdate), dept_key

          UNION ALL

          -- สรุปภาพรวมรายเดือน (total per month)
          SELECT 
            CASE WHEN MONTH(i.dchdate) >= 10 THEN MONTH(i.dchdate) - 9 ELSE MONTH(i.dchdate) + 3 END AS sort_order,
            CONCAT(
              ELT(MONTH(i.dchdate), 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'),
              '-',
              RIGHT(YEAR(i.dchdate) + 543, 2)
            ) AS dch_month,
            'total' AS dept_key,
            COUNT(DISTINCT i.hn) AS patients,
            COUNT(DISTINCT i.an) AS visits,
            ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
            ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
          FROM ipt i
          LEFT JOIN spclty s ON s.spclty = i.spclty
          WHERE i.dchdate BETWEEN ? AND ?
          GROUP BY YEAR(i.dchdate), MONTH(i.dchdate)

          UNION ALL

          -- สรุปภาพรวมทั้งปี แยกรายแผนก (total per department for full period)
          SELECT 
            99 AS sort_order,
            'รวม' AS dch_month,
            ${ipdDeptCase} AS dept_key,
            COUNT(DISTINCT i.hn) AS patients,
            COUNT(DISTINCT i.an) AS visits,
            ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
            ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
          FROM ipt i
          LEFT JOIN spclty s ON s.spclty = i.spclty
          WHERE i.dchdate BETWEEN ? AND ?
          GROUP BY dept_key

          UNION ALL

          -- แถวสรุปรวมทั้งหมดของ รพ. ตลอดช่วงเวลา (grand total)
          SELECT 
            99 AS sort_order,
            'รวม' AS dch_month,
            'total' AS dept_key,
            COUNT(DISTINCT i.hn) AS patients,
            COUNT(DISTINCT i.an) AS visits,
            ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
            ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
          FROM ipt i
          LEFT JOIN spclty s ON s.spclty = i.spclty
          WHERE i.dchdate BETWEEN ? AND ?

          ORDER BY sort_order, dept_key
        `

        const rows = (await executor(query, [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2])) as IpdDepartmentAdjrwQueryRow[]

        // Handle legacy flat format if returned (for mock tests)
        if (
          rows.length > 0 &&
          ('อายุรกรรม' in rows[0] || 'medicine' in rows[0]) &&
          !('dept_key' in rows[0])
        ) {
          return rows.map((r: IpdDepartmentAdjrwQueryRow) => {
            const total_patients = Number(r['คนรวม'] ?? r.total_patients ?? 0)
            const total_visits = Number(r['ครั้งรวม'] ?? r.total_visits ?? 0)
            const adjrw_sum = Number(r['AdjRW รวม'] ?? r.adjrw_sum ?? 0)
            const cmi = Number(r['CMI รวม'] ?? r.cmi ?? 0)

            const depts = createDefaultDepts()
            const deptMapping: [keyof typeof depts, string][] = [
              ['medicine', 'อายุรกรรม'],
              ['surgery', 'ศัลยกรรม'],
              ['obgyn', 'สูตินารีเวชกรรม'],
              ['pediatrics', 'กุมารเวชกรรม'],
              ['orthopedics', 'ออร์โธปิติกส์'],
              ['ent', 'ENT'],
              ['eye', 'จักษุ'],
              ['other', 'อื่นๆ'],
              ['dental', 'ทันตกรรม'],
              ['psychiatry', 'จิตเวช'],
            ]

            for (const [k, name] of deptMapping) {
              const val = Number(r[name] ?? r[k] ?? 0)
              const p = Number(r[`${name}_คน`] ?? r[`${k}_patients`] ?? 0)
              const v = Number(r[`${name}_ครั้ง`] ?? r[`${k}_visits`] ?? 0)
              const c = Number(r[`${name}_cmi`] ?? r[`${k}_cmi`] ?? (v > 0 ? val / v : 0))
              depts[k] = {
                patients: p,
                visits: v,
                adjrw: val,
                cmi: Number(c.toFixed(4)),
              }
            }

            const medicine = depts.medicine.adjrw
            const surgery = depts.surgery.adjrw
            const obgyn = depts.obgyn.adjrw
            const pediatrics = depts.pediatrics.adjrw
            const orthopedics = depts.orthopedics.adjrw
            const ent = depts.ent.adjrw
            const eye = depts.eye.adjrw
            const other = depts.other.adjrw
            const dental = depts.dental.adjrw
            const psychiatry = depts.psychiatry.adjrw

            const sumOfDepts = Number(
              (
                medicine +
                surgery +
                obgyn +
                pediatrics +
                orthopedics +
                ent +
                eye +
                other +
                dental +
                psychiatry
              ).toFixed(4)
            )
            const total = adjrw_sum > 0 ? adjrw_sum : sumOfDepts

            return {
              month: String(r['เดือน'] ?? r.dch_month ?? r.month ?? ''),
              total_patients,
              total_visits,
              adjrw_sum: total,
              cmi: cmi > 0 ? cmi : total_visits > 0 ? Number((total / total_visits).toFixed(4)) : 0,
              medicine,
              surgery,
              obgyn,
              pediatrics,
              orthopedics,
              ent,
              eye,
              other,
              dental,
              psychiatry,
              total,
              depts,
            }
          })
        }

        // New grouped query format
        const monthsMap = new Map<string, IpdDepartmentAdjrwItem>()
        const monthOrder: string[] = []

        for (const r of rows) {
          const monthName = String(r.dch_month ?? r['เดือน'] ?? '')
          if (!monthName) continue

          if (!monthsMap.has(monthName)) {
            monthOrder.push(monthName)
            monthsMap.set(monthName, {
              month: monthName,
              total_patients: 0,
              total_visits: 0,
              adjrw_sum: 0,
              cmi: 0,
              medicine: 0,
              surgery: 0,
              obgyn: 0,
              pediatrics: 0,
              orthopedics: 0,
              ent: 0,
              eye: 0,
              other: 0,
              dental: 0,
              psychiatry: 0,
              total: 0,
              depts: createDefaultDepts(),
            })
          }

          const item = monthsMap.get(monthName)!
          const key = String(r.dept_key ?? '')
          const patients = Number(r.patients ?? r['คน'] ?? 0)
          const visits = Number(r.visits ?? r['ครั้ง'] ?? 0)
          const adjrw = Number(r.adjrw ?? r['adjrw'] ?? 0)
          const cmi = Number(r.cmi ?? r['cmi'] ?? 0)

          if (key === 'total') {
            item.total_patients = patients
            item.total_visits = visits
            item.adjrw_sum = adjrw
            item.cmi = cmi
            item.total = adjrw
          } else if (key in item.depts) {
            item.depts[key] = { patients, visits, adjrw, cmi }
            if (key in item) {
              ;(item as any)[key] = adjrw
            }
          }
        }

        // Finalize any missing totals
        for (const item of monthsMap.values()) {
          if (item.adjrw_sum === 0) {
            let sumAdj = 0
            for (const k of DEPT_KEYS) {
              sumAdj += item.depts[k].adjrw
            }
            item.adjrw_sum = Number(sumAdj.toFixed(4))
            item.total = item.adjrw_sum
          }
          if (item.cmi === 0 && item.total_visits > 0) {
            item.cmi = Number((item.adjrw_sum / item.total_visits).toFixed(4))
          }
        }

        return monthOrder.map((m) => monthsMap.get(m)!)
      },
      30000
    )
  }

  /**
   * ดึงข้อมูลสรุปชาร์ตค้าง IPD แยกตามแพทย์ D/C สำหรับส่ง Telegram
   */
export async function getIpdDoctorChartSummary(
    targetDate: Date = new Date(),
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IPDChartReportData> {
    const calYear = targetDate.getFullYear()
    const month = targetDate.getMonth() + 1
    const fiscalYear = month >= 10 ? calYear + 1 : calYear
    const startDate = `${fiscalYear - 1}-10-01`
    const endDate = `${fiscalYear}-09-30`

    const docQuery = `
      SELECT 
        IFNULL(i.dch_doctor, 'UNKNOWN') AS doctor_code,
        IFNULL(d2.name, IFNULL(i.dch_doctor, 'ไม่ระบุแพทย์')) AS doctor_name,
        COUNT(DISTINCT i.an) AS total_charts,
        COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NOT NULL THEN i.an END) AS completed_charts,
        COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NULL THEN i.an END) AS uncompleted_charts
      FROM ipt i
      LEFT JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
      LEFT JOIN doctor d2 ON d2.code = i.dch_doctor
      WHERE i.dchdate BETWEEN ? AND ?
      GROUP BY IFNULL(i.dch_doctor, 'UNKNOWN'), IFNULL(d2.name, IFNULL(i.dch_doctor, 'ไม่ระบุแพทย์'))
      HAVING uncompleted_charts > 0
      ORDER BY uncompleted_charts DESC, total_charts DESC
    `
    const docRows = await executor(docQuery, [startDate, endDate])

    const grandQuery = `
      SELECT 
        COUNT(DISTINCT i.an) AS total_charts,
        COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NOT NULL THEN i.an END) AS completed_charts,
        COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NULL THEN i.an END) AS uncompleted_charts
      FROM ipt i
      LEFT JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
      WHERE i.dchdate BETWEEN ? AND ?
    `
    const grandRows = await executor(grandQuery, [startDate, endDate])
    const grand = grandRows[0] || { total_charts: 0, completed_charts: 0, uncompleted_charts: 0 }

    const totalCharts = Number(grand.total_charts) || 0
    const completedCharts = Number(grand.completed_charts) || 0
    const uncompletedCharts = Number(grand.uncompleted_charts) || 0
    const completedPercentage = totalCharts > 0 ? (completedCharts / totalCharts) * 100 : 0

    const doctors: DoctorChartSummary[] = docRows.map((r: any) => ({
      doctor_code: r.doctor_code,
      doctor_name: r.doctor_name,
      total_charts: Number(r.total_charts) || 0,
      completed_charts: Number(r.completed_charts) || 0,
      uncompleted_charts: Number(r.uncompleted_charts) || 0,
    }))

    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ]
    const reportDateStr = `${targetDate.getDate()} ${thaiMonths[targetDate.getMonth()]} ${targetDate.getFullYear() + 543}`

    return {
      fiscalYear: fiscalYear + 543,
      startDate,
      endDate,
      reportDateStr,
      grandTotal: {
        total_charts: totalCharts,
        completed_charts: completedCharts,
        uncompleted_charts: uncompletedCharts,
        completed_percentage: completedPercentage,
      },
      doctors,
    }
  }

  /**
   * แปลงข้อมูลชาร์ตค้างเป็นข้อความ HTML สำหรับส่ง Telegram
   */
export function formatTelegramChartSummary(data: IPDChartReportData, portalUrl = ''): string {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`
    const thaiMonthsShort = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ]
    const shortDateStr = `${now.getDate()} ${thaiMonthsShort[now.getMonth()]} ${String(now.getFullYear() + 543).slice(-2)}`
    const shortFyStr = `ปีงบ ${String(data.fiscalYear).slice(-2)}`

    let msg = `🏥 <b>สรุปชาร์ต IPD ค้างสรุป</b>\n`
    msg += `📅 ${shortDateStr} | ${timeStr} | ${shortFyStr}\n`
    msg += `━━━━━━━━━━━━━━━\n`
    msg += `📊 รวม <b>${data.grandTotal.total_charts.toLocaleString()}</b> ชาร์ต | สรุปแล้ว <b>${data.grandTotal.completed_charts.toLocaleString()}</b> (${data.grandTotal.completed_percentage.toFixed(1)}%)\n`
    msg += `⏳ ค้าง <b>${data.grandTotal.uncompleted_charts.toLocaleString()}</b> ชาร์ต จาก <b>${data.doctors.length}</b> ท่าน\n`
    msg += `━━━━━━━━━━━━━━━\n\n`

    if (data.doctors.length === 0) {
      msg += `✅ <i>ไม่มีแพทย์ที่มีชาร์ตค้างสรุปในขณะนี้</i>\n`
      msg += `━━━━━━━━━━━━━━━`
      return msg
    }

    data.doctors.forEach((doc, idx) => {
      msg += `${idx + 1}. ${doc.doctor_name}\n`
      msg += `   ✅ ลง ${doc.completed_charts.toLocaleString()}/${doc.total_charts.toLocaleString()} ชาร์ต • ⏳ ยังไม่ได้สรุป <b>${doc.uncompleted_charts.toLocaleString()}</b> ชาร์ต\n\n`
    })

    msg += `━━━━━━━━━━━━━━━\n`
    if (portalUrl) {
      msg += `🌐 สามารถกดดู Dashboard : \n${portalUrl}`
    } else {
      msg += `🌐 ตรวจสอบสถานะได้ที่ระบบ Dashboard-RCM โรงพยาบาลเถิน`
    }
    return msg
  }
