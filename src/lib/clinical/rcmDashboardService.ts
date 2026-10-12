import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData } from '@/lib/cache'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

// ── 1. SSS Dental Types ─────────────────────────────────────

export interface DentalDoctorSummaryItem {
  doctor_code: string
  doctor_name: string
  total_visits: number
  total_income: number
  total_uc_money: number
  total_rcpt_money: number
  total_discount: number
  total_debit: number
  monthly_income: Record<string, number>
  monthly_visits: Record<string, number>
}

export interface DentalPatientVisitItem {
  vn: string
  hn: string
  cid: string
  ptname: string
  sex: string
  age: number
  vstdate: string
  vsttime: string
  department: string
  pdx: string
  pdxname: string
  doctor_code: string
  doctor_name: string
  income: number
  uc_money: number
  discount_money: number
  paid_money: number
  rcpt_money: number
  debit: number
  rcpno: string
}

export interface SssDentalResult {
  months: string[]
  doctors: DentalDoctorSummaryItem[]
  monthlyTotals: Record<string, { income: number; visits: number }>
  grandTotal: {
    visits: number
    income: number
    uc_money: number
    rcpt_money: number
    discount: number
    debit: number
  }
  visits?: DentalPatientVisitItem[]
}

// ── 2. OPD Doctor Types ─────────────────────────────────────

export interface DoctorSummaryItem {
  doctor_code: string
  doctor_name: string
  total_visits: number
  total_income: number
  total_uc_money: number
  total_rcpt_money: number
  total_discount: number
  total_debit: number
  monthly_income: Record<string, number>
  monthly_visits: Record<string, number>
}

export interface PttypeOption {
  code: string
  name: string
}

export interface OpdDoctorSummaryResult {
  months: string[]
  doctors: DoctorSummaryItem[]
  monthlyTotals: Record<string, { income: number; visits: number }>
  grandTotal: {
    visits: number
    income: number
    uc_money: number
    rcpt_money: number
    discount: number
    debit: number
  }
  allPttypeOptions: PttypeOption[]
}

export interface OPDRecord {
  vn: string
  hn: string
  an: string
  cid: string
  ptname: string
  sex: string
  age: number
  vstdate: string
  vsttime: string
  department: string
  clinic: string
  pdx: string
  pdxname: string
  pttype: string
  pttypename: string
  pttype_eclaim_id: string
  pttype_eclaim_name: string
  accountcode: string
  income: number
  uc_money: number
  discount_money: number
  paid_money: number
  rcpt_money: number
  rcpno: string
  debit: number
  doctorname: string
  ct: number
  cm: number
}

// ── 3. IPD Types ────────────────────────────────────────────

export interface IPDRecord {
  an: string
  hn: string
  cid: string
  ptname: string
  sex: string
  age: number
  admdate: string
  dchdate: string
  los: number
  editdate: string | null
  summary_days: number | null
  ward: string
  ward_name: string
  bedno: string
  clinic: string
  prediag: string
  pdx: string
  pdxname: string
  sdx: string
  proc: string
  adjrw: number
  admdoctor: string
  dchdoctor: string
  authencode: string
  pttype: string
  pttypename: string
  pttype_eclaim_id: string
  accountcode: string
  hospmain: string
  hospsub: string
  dchstts: string
  dchtype: string
  status: string
  income: number
  uc_money: number
  discount_money: number
  paid_money: number
  rcpt_money: number
  rcpno: string
  debit: number
}

export interface IPDReportResult {
  count: number
  data: IPDRecord[]
}

// ── 4. Telegram Notification Types ─────────────────────────

export interface DoctorChartSummary {
  doctor_code: string
  doctor_name: string
  total_charts: number
  completed_charts: number
  uncompleted_charts: number
}

export interface IPDChartReportData {
  fiscalYear: number
  startDate: string
  endDate: string
  reportDateStr: string
  grandTotal: {
    total_charts: number
    completed_charts: number
    uncompleted_charts: number
    completed_percentage: number
  }
  doctors: DoctorChartSummary[]
}

// ── RcmDashboardService Implementation ─────────────────────

export class RcmDashboardService {
  /**
   * 2.1.1.1 รายงานการให้บริการทันตกรรมสิทธิ์ประกันสังคม จำแนกตามทันตแพทย์
   */
  static async getSssDentalReport(
    params: {
      ds1: string
      ds2: string
      doctorFilter?: string
      fetchVisits?: boolean
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<SssDentalResult> {
    const { ds1, ds2, doctorFilter = '', fetchVisits = false } = params
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
            LIMIT 1000
          `
          const vRows = await executor(visitQuery, visitParams)
          visitsData = vRows as DentalPatientVisitItem[]
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
  static async getOpdDoctorSummary(
    params: {
      ds1: string
      ds2: string
      eclaimsParam?: string
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<OpdDoctorSummaryResult> {
    const { ds1, ds2, eclaimsParam = '' } = params
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
          'o.vstdate BETWEEN ? AND ?',
          "IFNULL(o.an, '') = ''",
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
            DATE_FORMAT(o.vstdate, '%Y-%m') AS ym,
            COUNT(DISTINCT o.vn) AS visits,
            SUM(IFNULL(v.income, 0)) AS income,
            SUM(IFNULL(v.uc_money, 0)) AS uc_money,
            SUM(IFNULL(v.discount_money, 0)) AS discount_money,
            SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
            SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
          FROM ovst o
          INNER JOIN vn_stat v ON v.vn = o.vn
          INNER JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN doctor d ON d.code = o.doctor
          WHERE ${whereClauses.join(' AND ')}
          GROUP BY IFNULL(o.doctor, 'UNKNOWN'), IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')), DATE_FORMAT(o.vstdate, '%Y-%m')
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
  static async getOpdDetailedReport(
    params: {
      ds1: string
      ds2: string
      pttype?: string
      isAll?: boolean
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<OPDRecord[]> {
    const { ds1, ds2, pttype = '', isAll = false } = params
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
          LIMIT 1000
        `

        const queryParams = pttype ? [ds1, ds2, pttype] : [ds1, ds2]
        const rows = await executor(query, queryParams)
        return rows as OPDRecord[]
      },
      30000
    )
  }

  /**
   * 2.1.2.1 รายงานสรุปการให้บริการผู้ป่วยในโรงพยาบาลเถิน (IPD)
   */
  static async getIpdReport(
    params: {
      ds1: string
      ds2: string
      pttype?: string
    },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<IPDRecord[]> {
    const { ds1, ds2, pttype = '' } = params
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
        return rows as IPDRecord[]
      },
      30000
    )
  }

  /**
   * ดึงข้อมูลสรุปชาร์ตค้าง IPD แยกตามแพทย์ D/C สำหรับส่ง Telegram
   */
  static async getIpdDoctorChartSummary(
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
  static formatTelegramChartSummary(data: IPDChartReportData, portalUrl = ''): string {
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
}
