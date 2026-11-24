import { getCachedData } from '@/lib/cache'
import {
  defaultRcmDashboardGateway,
  type RcmDashboardGatewayAdapter,
} from './gatewayAdapter'
import {
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
  resolveFiscalDateRange,
  formatThaiSex,
} from './typesAndHelpers'

/**
 * 2.1.1.1 รายงานการให้บริการทันตกรรมสิทธิ์ประกันสังคม จำแนกตามทันตแพทย์
 */
export async function getSssDentalReport(
  params: FiscalDateRangeParams & {
    doctorFilter?: string
    fetchVisits?: boolean
  },
  gateway: Partial<RcmDashboardGatewayAdapter> = {}
): Promise<SssDentalResult> {
  const gw = { ...defaultRcmDashboardGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const { doctorFilter = '', fetchVisits = false } = params
  const cacheKey = `rcm-sss-dental-${ds1}-${ds2}-${doctorFilter}-${fetchVisits}`

  return getCachedData(
    cacheKey,
    async () => {
      const { summaryRows, visitRows } = await gw.getRcmSssDentalRaw({
        startDate: ds1,
        endDate: ds2,
        doctorFilter: doctorFilter || undefined,
        fetchVisits,
      })

      const doctorMap: Record<string, DentalDoctorSummaryItem> = {}
      const monthsSet = new Set<string>()

      ;(summaryRows || []).forEach((row: any) => {
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
      if (fetchVisits && Array.isArray(visitRows)) {
        visitsData = (visitRows as any[]).map((r) => ({
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
    30000
  )
}

/**
 * 2.1.1.2 สรุปค่าบริการผู้ป่วยนอก OPD จำแนกรายแพทย์ และตัวเลือก 37 สิทธิ e-Claim
 */
export async function getOpdDoctorSummary(
  params: FiscalDateRangeParams & {
    eclaimsParam?: string
  },
  gateway: Partial<RcmDashboardGatewayAdapter> = {}
): Promise<OpdDoctorSummaryResult> {
  const gw = { ...defaultRcmDashboardGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const { eclaimsParam = '' } = params
  const cacheKey = `rcm-opd-doctor-summary-${ds1}-${ds2}-${eclaimsParam}`

  return getCachedData(
    cacheKey,
    async () => {
      const { allPttypeRows, rows } = await gw.getRcmOpdDoctorSummaryRaw({
        startDate: ds1,
        endDate: ds2,
        eclaimsParam: eclaimsParam || undefined,
      })

      const doctorMap: Record<string, DoctorSummaryItem> = {}
      const monthsSet = new Set<string>()

      ;(rows || []).forEach((row: any) => {
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
        allPttypeOptions: (allPttypeRows || []) as PttypeOption[],
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
  gateway: Partial<RcmDashboardGatewayAdapter> = {}
): Promise<OPDRecord[]> {
  const gw = { ...defaultRcmDashboardGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const { pttype = '', isAll = false } = params
  const cacheKey = `rcm-opd-detailed-${ds1}-${ds2}-${pttype}-${isAll}`

  return getCachedData(
    cacheKey,
    async () => {
      const rows = await gw.getRcmOpdDetailedRaw({
        startDate: ds1,
        endDate: ds2,
        pttype: pttype || undefined,
        isAll,
      })
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
  gateway: Partial<RcmDashboardGatewayAdapter> = {}
): Promise<OpdDepartmentSummaryItem[]> {
  const gw = { ...defaultRcmDashboardGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const cacheKey = `rcm-opd-dept-summary-v2-${ds1}-${ds2}`

  return getCachedData(
    cacheKey,
    async () => {
      const rows = (await gw.getRcmOpdDepartmentSummaryRaw({
        startDate: ds1,
        endDate: ds2,
      })) as OpdDepartmentSummaryQueryRow[]

      return (rows || []).map((r: OpdDepartmentSummaryQueryRow) => ({
        dept_group: String(r.dept_group || r['แผนก'] || ''),
        patients: Number(r.patients ?? r['จำนวนคน'] ?? 0),
        visits: Number(r.visits ?? r['จำนวนครั้ง'] ?? 0),
      }))
    },
    60_000 * 5
  )
}
