import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmDashboardService,
  QueryExecutor,
  getDefaultFiscalYearDateRange,
  resolveFiscalDateRange,
  buildDepartmentSqlCase,
  classifySpecialty,
  CLINICAL_DEPARTMENT_DEFINITIONS,
} from '../rcmDashboardService'
import { clearMemoryCache } from '@/lib/cache'

describe('RcmDashboardService', () => {
  beforeEach(() => {
    clearMemoryCache()
  })

  describe('getSssDentalReport', () => {
    it('aggregates doctor summaries and computes grand totals correctly', async () => {
      const mockRows = [
        {
          doctor_code: 'DOC01',
          doctor_name: 'ทพ. สมเกียรติ มั่นคง',
          ym: '2025-10',
          visits: 12,
          income: 15000,
          uc_money: 12000,
          discount_money: 0,
          rcpt_money: 2000,
          debit: 1000,
        },
        {
          doctor_code: 'DOC01',
          doctor_name: 'ทพ. สมเกียรติ มั่นคง',
          ym: '2025-11',
          visits: 8,
          income: 10000,
          uc_money: 8000,
          discount_money: 0,
          rcpt_money: 1000,
          debit: 1000,
        },
        {
          doctor_code: 'DOC02',
          doctor_name: 'ทพญ. กานดา วัฒนา',
          ym: '2025-10',
          visits: 15,
          income: 20000,
          uc_money: 18000,
          discount_money: 0,
          rcpt_money: 2000,
          debit: 0,
        },
      ]

      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue(mockRows)

      const result = await RcmDashboardService.getSssDentalReport(
        { ds1: '2025-10-01', ds2: '2025-11-30' },
        mockExecutor
      )

      expect(result.doctors).toHaveLength(2)

      // Sorted by total_income desc: DOC01 has 25,000, DOC02 has 20,000
      expect(result.doctors[0].doctor_code).toBe('DOC01')
      expect(result.doctors[0].total_income).toBe(25000)
      expect(result.doctors[0].total_visits).toBe(20)
      expect(result.doctors[0].monthly_income['2025-10']).toBe(15000)
      expect(result.doctors[0].monthly_income['2025-11']).toBe(10000)

      expect(result.doctors[1].doctor_code).toBe('DOC02')
      expect(result.doctors[1].total_income).toBe(20000)

      // Grand total check
      expect(result.grandTotal.visits).toBe(35)
      expect(result.grandTotal.income).toBe(45000)
      expect(result.grandTotal.uc_money).toBe(38000)
      expect(result.grandTotal.rcpt_money).toBe(5000)
      expect(result.grandTotal.debit).toBe(2000)
    })
  })

  describe('getOpdDoctorSummary', () => {
    it('filters eclaim groups and calculates totals correctly', async () => {
      const mockPttypes = [
        { code: '16', name: 'เบิกต้นสังกัด' },
        { code: '17', name: 'เบิกจ่ายตรงกรมบัญชีกลาง' },
      ]
      const mockRows = [
        {
          doctor_code: 'DOC_OPD_1',
          doctor_name: 'นพ. วรพจน์ มิตรภาพ',
          ym: '2025-10',
          visits: 50,
          income: 120000,
          uc_money: 110000,
          discount_money: 0,
          rcpt_money: 10000,
          debit: 0,
        },
      ]

      const mockExecutor: QueryExecutor = vi
        .fn()
        .mockImplementation(async (sql: string) => {
          if (sql.includes('FROM pttype_eclaim')) {
            return mockPttypes
          }
          return mockRows
        })

      const result = await RcmDashboardService.getOpdDoctorSummary(
        { ds1: '2025-10-01', ds2: '2025-10-31', eclaimsParam: '16,17' },
        mockExecutor
      )

      expect(result.allPttypeOptions).toHaveLength(2)
      expect(result.doctors).toHaveLength(1)
      expect(result.doctors[0].doctor_name).toBe('นพ. วรพจน์ มิตรภาพ')
      expect(result.grandTotal.visits).toBe(50)
      expect(result.grandTotal.income).toBe(120000)
    })
  })

  describe('getIpdReport', () => {
    it('queries and returns mapped IPD records correctly', async () => {
      const mockIpdRows = [
        {
          an: '670001',
          hn: '001122',
          cid: '1529900112233',
          ptname: 'นายทองดี มีทรัพย์',
          sex: 'ชาย',
          age: 62,
          admdate: '2026-09-01',
          dchdate: '2026-09-05',
          los: 4,
          editdate: '2026-09-08',
          summary_days: 3,
          ward: '01',
          ward_name: 'หอผู้ป่วยอายุรกรรมชาย',
          pdx: 'J189',
          pdxname: 'Pneumonia',
          adjrw: 1.452,
          dchdoctor: 'นพ. วรพจน์ มิตรภาพ',
          pttype: '10',
          pttypename: 'บัตรทอง',
          status: 'สรุปผลแล้ว',
          income: 18500,
          uc_money: 18500,
          discount_money: 0,
          paid_money: 0,
          rcpt_money: 0,
          debit: 0,
        },
      ]

      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue(mockIpdRows)

      const result = await RcmDashboardService.getIpdReport(
        { ds1: '2026-09-01', ds2: '2026-09-10' },
        mockExecutor
      )

      expect(result).toHaveLength(1)
      expect(result[0].an).toBe('670001')
      expect(result[0].cid).toBe('1529900112233')
      expect(result[0].los).toBe(4)
      expect(result[0].adjrw).toBe(1.452)
      expect(result[0].summary_days).toBe(3)
    })
  })

  describe('getIpdDepartmentAdjrw', () => {
    it('queries and maps department metrics (patients, visits, adjrw, cmi) per month and overall total correctly', async () => {
      const mockDeptRows = [
        {
          sort_order: 1,
          dch_month: 'ต.ค.-67',
          dept_key: 'medicine',
          patients: 50,
          visits: 60,
          adjrw: 120.45,
          cmi: 2.0075,
        },
        {
          sort_order: 1,
          dch_month: 'ต.ค.-67',
          dept_key: 'surgery',
          patients: 20,
          visits: 25,
          adjrw: 45.12,
          cmi: 1.8048,
        },
        {
          sort_order: 1,
          dch_month: 'ต.ค.-67',
          dept_key: 'total',
          patients: 150,
          visits: 180,
          adjrw: 238.54,
          cmi: 1.3252,
        },
        {
          sort_order: 99,
          dch_month: 'รวม',
          dept_key: 'medicine',
          patients: 500,
          visits: 600,
          adjrw: 1200.45,
          cmi: 2.0008,
        },
        {
          sort_order: 99,
          dch_month: 'รวม',
          dept_key: 'surgery',
          patients: 200,
          visits: 250,
          adjrw: 450.12,
          cmi: 1.8005,
        },
        {
          sort_order: 99,
          dch_month: 'รวม',
          dept_key: 'total',
          patients: 1500,
          visits: 1800,
          adjrw: 2385.4,
          cmi: 1.3252,
        },
      ]

      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue(mockDeptRows)

      const result = await RcmDashboardService.getIpdDepartmentAdjrw(
        { ds1: '2024-10-01', ds2: '2025-09-30' },
        mockExecutor
      )

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('dept_key'),
        [
          '2024-10-01',
          '2025-09-30',
          '2024-10-01',
          '2025-09-30',
          '2024-10-01',
          '2025-09-30',
          '2024-10-01',
          '2025-09-30',
        ]
      )

      expect(result).toHaveLength(2)
      // Month row
      expect(result[0].month).toBe('ต.ค.-67')
      expect(result[0].total_patients).toBe(150)
      expect(result[0].total_visits).toBe(180)
      expect(result[0].adjrw_sum).toBeCloseTo(238.54, 2)
      expect(result[0].cmi).toBeCloseTo(1.3252, 4)
      expect(result[0].medicine).toBe(120.45)
      expect(result[0].surgery).toBe(45.12)
      // Check depts object
      expect(result[0].depts.medicine).toEqual({
        patients: 50,
        visits: 60,
        adjrw: 120.45,
        cmi: 2.0075,
      })
      expect(result[0].depts.surgery).toEqual({
        patients: 20,
        visits: 25,
        adjrw: 45.12,
        cmi: 1.8048,
      })

      // Total summary row
      expect(result[1].month).toBe('รวม')
      expect(result[1].total_patients).toBe(1500)
      expect(result[1].total_visits).toBe(1800)
      expect(result[1].adjrw_sum).toBeCloseTo(2385.4, 2)
      expect(result[1].cmi).toBeCloseTo(1.3252, 4)
      expect(result[1].medicine).toBe(1200.45)
      expect(result[1].depts.medicine).toEqual({
        patients: 500,
        visits: 600,
        adjrw: 1200.45,
        cmi: 2.0008,
      })
      expect(result[1].depts.surgery).toEqual({
        patients: 200,
        visits: 250,
        adjrw: 450.12,
        cmi: 1.8005,
      })
    })

    it('supports legacy flat row format with backwards compatibility', async () => {
      const mockFlatRows = [
        {
          เดือน: 'ต.ค.-67',
          คนรวม: 150,
          ครั้งรวม: 180,
          'AdjRW รวม': 238.54,
          'CMI รวม': 1.3252,
          อายุรกรรม: 120.45,
          ศัลยกรรม: 45.12,
          สูตินารีเวชกรรม: 12.3,
          กุมารเวชกรรม: 30.15,
          ออร์โธปิติกส์: 18.22,
          ENT: 5.1,
          จักษุ: 3.4,
          อื่นๆ: 1.2,
          ทันตกรรม: 0.5,
          จิตเวช: 2.1,
        },
      ]

      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue(mockFlatRows)
      const result = await RcmDashboardService.getIpdDepartmentAdjrw(
        { ds1: '2023-10-01', ds2: '2024-09-30' },
        mockExecutor
      )

      expect(result).toHaveLength(1)
      expect(result[0].month).toBe('ต.ค.-67')
      expect(result[0].medicine).toBe(120.45)
      expect(result[0].depts.medicine.adjrw).toBe(120.45)
    })
  })

  describe('Telegram chart notification formatting', () => {
    it('formats HTML message correctly for Telegram delivery', () => {
      const mockReportData = {
        fiscalYear: 2569,
        startDate: '2025-10-01',
        endDate: '2026-09-30',
        reportDateStr: '12 ตุลาคม 2569',
        grandTotal: {
          total_charts: 100,
          completed_charts: 85,
          uncompleted_charts: 15,
          completed_percentage: 85,
        },
        doctors: [
          {
            doctor_code: 'DOC01',
            doctor_name: 'นพ. วรพจน์ มิตรภาพ',
            total_charts: 40,
            completed_charts: 30,
            uncompleted_charts: 10,
          },
        ],
      }

      const msg = RcmDashboardService.formatTelegramChartSummary(
        mockReportData,
        'https://thlp.moph.go.th/service/dashboard-rcm/ipd'
      )

      expect(msg).toContain('สรุปชาร์ต IPD ค้างสรุป')
      expect(msg).toContain('รวม <b>100</b> ชาร์ต')
      expect(msg).toContain('ค้าง <b>15</b> ชาร์ต')
      expect(msg).toContain('นพ. วรพจน์ มิตรภาพ')
      expect(msg).toContain('https://thlp.moph.go.th/service/dashboard-rcm/ipd')
    })

    it('queries and aggregates incomplete charts by doctor correctly', async () => {
      const mockDocRows = [
        {
          doctor_code: 'DOC_1',
          doctor_name: 'พญ. วรินทร ถาคร',
          total_charts: 42,
          completed_charts: 27,
          uncompleted_charts: 15,
        },
      ]
      const mockGrandRows = [
        {
          total_charts: 261,
          completed_charts: 195,
          uncompleted_charts: 66,
        },
      ]

      const mockExecutor: QueryExecutor = vi
        .fn()
        .mockImplementation(async (sql: string) => {
          if (sql.includes('HAVING uncompleted_charts > 0')) {
            return mockDocRows
          }
          return mockGrandRows
        })

      const targetDate = new Date(2026, 9, 12) // Oct 12, 2026 -> FY 2570
      const result = await RcmDashboardService.getIpdDoctorChartSummary(targetDate, mockExecutor)

      expect(result.fiscalYear).toBe(2570)
      expect(result.grandTotal.total_charts).toBe(261)
      expect(result.grandTotal.completed_charts).toBe(195)
      expect(result.grandTotal.uncompleted_charts).toBe(66)
      expect(result.grandTotal.completed_percentage).toBeCloseTo(74.71, 1)
      expect(result.doctors).toHaveLength(1)
      expect(result.doctors[0].doctor_name).toBe('พญ. วรินทร ถาคร')
      expect(result.doctors[0].uncompleted_charts).toBe(15)
    })
  })

  describe('getOpdDepartmentSummary', () => {
    it('returns parsed OPD department summary rows and total correctly', async () => {
      const mockRows = [
        { dept_group: '01. อายุรกรรม', patients: 1250, visits: 2400 },
        { dept_group: '02. ศัลยกรรม', patients: 600, visits: 950 },
        { dept_group: 'รวมทั้งหมด', patients: 1850, visits: 3350 },
      ]

      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue(mockRows)

      const result = await RcmDashboardService.getOpdDepartmentSummary(
        { ds1: '2024-10-01', ds2: '2025-09-30' },
        mockExecutor
      )

      expect(mockExecutor).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(3)
      expect(result[0].dept_group).toBe('01. อายุรกรรม')
      expect(result[0].patients).toBe(1250)
      expect(result[0].visits).toBe(2400)
      expect(result[2].dept_group).toBe('รวมทั้งหมด')
      expect(result[2].patients).toBe(1850)
      expect(result[2].visits).toBe(3350)
    })

    it('handles empty response gracefully', async () => {
      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue([])

      const result = await RcmDashboardService.getOpdDepartmentSummary(
        { ds1: '2025-10-01', ds2: '2026-09-30' },
        mockExecutor
      )

      expect(result).toEqual([])
    })

    it('accepts strongly-typed FiscalDateRange with startDate and endDate', async () => {
      const mockRows = [
        { dept_group: '01. อายุรกรรม', patients: 10, visits: 20 },
      ]
      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue(mockRows)

      const result = await RcmDashboardService.getOpdDepartmentSummary(
        { startDate: '2026-10-01', endDate: '2027-09-30' },
        mockExecutor
      )

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('ovst'),
        ['2026-10-01', '2027-09-30', '2026-10-01', '2027-09-30']
      )
      expect(result).toHaveLength(1)
      expect(result[0].dept_group).toBe('01. อายุรกรรม')
    })

    it('defaults to active fiscal year when params are empty', async () => {
      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue([])
      const expectedRange = getDefaultFiscalYearDateRange()

      await RcmDashboardService.getOpdDepartmentSummary({}, mockExecutor)

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('ovst'),
        [expectedRange.startDate, expectedRange.endDate, expectedRange.startDate, expectedRange.endDate]
      )
    })
  })

  describe('FiscalDateRange domain logic', () => {
    it('calculates Thai fiscal year bounds correctly across month boundaries', () => {
      // In October, fiscal year is year + 1
      const octDate = new Date('2026-10-15T00:00:00+07:00')
      const octRange = getDefaultFiscalYearDateRange(octDate)
      expect(octRange.startDate).toBe('2026-10-01')
      expect(octRange.endDate).toBe('2027-09-30')

      // In September, fiscal year is current calendar year
      const sepDate = new Date('2026-09-20T00:00:00+07:00')
      const sepRange = getDefaultFiscalYearDateRange(sepDate)
      expect(sepRange.startDate).toBe('2025-10-01')
      expect(sepRange.endDate).toBe('2026-09-30')

      // In January, fiscal year is current calendar year
      const janDate = new Date('2026-01-10T00:00:00+07:00')
      const janRange = getDefaultFiscalYearDateRange(janDate)
      expect(janRange.startDate).toBe('2025-10-01')
      expect(janRange.endDate).toBe('2026-09-30')
    })

    it('resolves explicit params over default range', () => {
      const explicit = resolveFiscalDateRange({ startDate: '2025-01-01', endDate: '2025-01-31' })
      expect(explicit.startDate).toBe('2025-01-01')
      expect(explicit.endDate).toBe('2025-01-31')

      const legacy = resolveFiscalDateRange({ ds1: '2025-02-01', ds2: '2025-02-28' })
      expect(legacy.startDate).toBe('2025-02-01')
      expect(legacy.endDate).toBe('2025-02-28')

      const empty = resolveFiscalDateRange()
      const expected = getDefaultFiscalYearDateRange()
      expect(empty.startDate).toBe(expected.startDate)
      expect(empty.endDate).toBe(expected.endDate)
    })
  })

  describe('Specialty Classification Domain', () => {
    it('defines exactly 10 clinical specialties', () => {
      expect(CLINICAL_DEPARTMENT_DEFINITIONS).toHaveLength(10)
    })

    it('correctly classifies all 10 hospital specialties in memory', () => {
      // 1. Medicine
      expect(classifySpecialty('01', 'แผนกอายุรกรรม').key).toBe('medicine')
      expect(classifySpecialty('21', 'อายุรศาสตร์').key).toBe('medicine')
      expect(classifySpecialty('99', 'คลินิกอายุรกรรมพิเศษ').key).toBe('medicine')

      // 2. Surgery (excluding orthopedics keywords)
      expect(classifySpecialty('02', 'ศัลยกรรมทั่วไป').key).toBe('surgery')
      expect(classifySpecialty('08', 'ศัลยกรรมกระดูก').key).toBe('orthopedics')
      expect(classifySpecialty('99', 'ศัลยกรรมกระดูก').key).toBe('orthopedics')
      expect(classifySpecialty('99', 'ศัลยกรรมออร์โธปิดิกส์').key).toBe('orthopedics')

      // 3. Obgyn
      expect(classifySpecialty('03', 'สูติ-นรีเวช').key).toBe('obgyn')
      expect(classifySpecialty('04', 'นรีเวชกรรม').key).toBe('obgyn')

      // 4. Pediatrics
      expect(classifySpecialty('05', 'กุมารเวชกรรม').key).toBe('pediatrics')
      expect(classifySpecialty('99', 'คลินิกเด็กและกุมาร').key).toBe('pediatrics')

      // 5. Orthopedics
      expect(classifySpecialty('08', 'กระดูกและข้อ').key).toBe('orthopedics')

      // 6. ENT
      expect(classifySpecialty('06', 'หู คอ จมูก').key).toBe('ent')
      expect(classifySpecialty('99', 'โสต ศอ นาสิก').key).toBe('ent')
      expect(classifySpecialty('99', 'คลินิก ENT').key).toBe('ent')

      // 7. Eye
      expect(classifySpecialty('07', 'จักษุวิทยา').key).toBe('eye')

      // 8. Dental
      expect(classifySpecialty('11', 'ทันตกรรม').key).toBe('dental')

      // 9. Psychiatry
      expect(classifySpecialty('09', 'จิตเวชและสุขภาพจิต').key).toBe('psychiatry')

      // 10. Other
      expect(classifySpecialty('99', 'เวชศาสตร์ฟื้นฟู').key).toBe('other')
      expect(classifySpecialty(null, null).key).toBe('other')
    })

    it('builds valid SQL CASE statement for keys and labels', () => {
      const keySql = buildDepartmentSqlCase('i', 's', 'key')
      expect(keySql).toContain("i.spclty IN ('01', '21')")
      expect(keySql).toContain("s.name LIKE '%อายุร%'")
      expect(keySql).toContain("'medicine'")
      expect(keySql).toContain("'surgery'")
      expect(keySql).toContain("'other'")

      const labelSql = buildDepartmentSqlCase('o', 's', 'label')
      expect(labelSql).toContain("o.spclty IN ('01', '21')")
      expect(labelSql).toContain("'01. อายุรกรรม'")
      expect(labelSql).toContain("'02. ศัลยกรรม'")
      expect(labelSql).toContain("'10. อื่นๆ'")
    })
  })
})



