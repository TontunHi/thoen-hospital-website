import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmDashboardService,
  QueryExecutor,
} from '../rcmDashboardService'

describe('RcmDashboardService', () => {
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
    it('queries and maps department SumAdjRW per month and overall total correctly', async () => {
      const mockDeptRows = [
        {
          เดือน: 'ต.ค.-67',
          อายุรกรรม: 120.4500,
          ศัลยกรรม: 45.1200,
          สูตินารีเวชกรรม: 12.3000,
          กุมารเวชกรรม: 30.1500,
          ออร์โธปิติกส์: 18.2200,
          ENT: 5.1000,
          จักษุ: 3.4000,
          อื่นๆ: 1.2000,
          ทันตกรรม: 0.5000,
          จิตเวช: 2.1000,
        },
        {
          เดือน: 'รวม',
          อายุรกรรม: 1200.4500,
          ศัลยกรรม: 450.1200,
          สูตินารีเวชกรรม: 120.3000,
          กุมารเวชกรรม: 300.1500,
          ออร์โธปิติกส์: 180.2200,
          ENT: 50.1000,
          จักษุ: 34.4000,
          อื่นๆ: 12.2000,
          ทันตกรรม: 5.5000,
          จิตเวช: 21.1000,
        },
      ]

      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue(mockDeptRows)

      const result = await RcmDashboardService.getIpdDepartmentAdjrw(
        { ds1: '2024-10-01', ds2: '2025-09-30' },
        mockExecutor
      )

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('dch_month AS `เดือน`'),
        ['2024-10-01', '2025-09-30', '2024-10-01', '2025-09-30']
      )

      expect(result).toHaveLength(2)
      expect(result[0].month).toBe('ต.ค.-67')
      expect(result[0].medicine).toBe(120.45)
      expect(result[0].surgery).toBe(45.12)
      expect(result[0].obgyn).toBe(12.3)
      expect(result[0].pediatrics).toBe(30.15)
      expect(result[0].orthopedics).toBe(18.22)
      expect(result[0].ent).toBe(5.1)
      expect(result[0].eye).toBe(3.4)
      expect(result[0].other).toBe(1.2)
      expect(result[0].dental).toBe(0.5)
      expect(result[0].psychiatry).toBe(2.1)
      expect(result[0].total).toBeCloseTo(238.54, 2)

      expect(result[1].month).toBe('รวม')
      expect(result[1].medicine).toBe(1200.45)
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
})



