import { describe, it, expect, vi } from 'vitest'
import {
  ClinicalRecordsService,
  QueryExecutor,
} from '../clinicalRecordsService'

describe('ClinicalRecordsService', () => {
  describe('searchPatientVisits', () => {
    it('returns empty array when query is empty or whitespace', async () => {
      const mockExecutor: QueryExecutor = vi.fn()
      const result = await ClinicalRecordsService.searchPatientVisits('   ', mockExecutor)
      expect(result).toEqual([])
      expect(mockExecutor).not.toHaveBeenCalled()
    })

    it('executes HOSxP search query and formats patient records correctly', async () => {
      const fakeRows = [
        {
          hn: '0012345',
          cid: '1529900112233',
          ptname: 'นายสมชาย ใจดี',
          vn: '690930001',
          an: null,
          dayv: '30',
          monthv: 'ก.ย.',
          yearv: '2569',
          department: 'ห้องตรวจโรคทั่วไป',
          cc: 'มีไข้ ไอ เจ็บคอ',
          status_name: 'ตรวจเสร็จสิ้น',
          co1: 2,
          clab: 1,
          co2: null,
          clab2: null,
        },
      ]

      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue(fakeRows)
      const result = await ClinicalRecordsService.searchPatientVisits('0012345', mockExecutor)

      expect(mockExecutor).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        hn: '0012345',
        cid: '1529900112233',
        ptname: 'นายสมชาย ใจดี',
        vn: '690930001',
        an: null,
        dateText: '30 ก.ย. 2569',
        department: 'ห้องตรวจโรคทั่วไป',
        cc: 'มีไข้ ไอ เจ็บคอ',
        statusName: 'ตรวจเสร็จสิ้น',
        opdDrugsCount: 2,
        opdLabsCount: 1,
        ipdDrugsCount: 0,
        ipdLabsCount: 0,
      })
    })
  })

  describe('getVisitClinicalDetails', () => {
    it('returns null if neither vn nor an is provided', async () => {
      const mockExecutor: QueryExecutor = vi.fn()
      const result = await ClinicalRecordsService.getVisitClinicalDetails({}, mockExecutor)
      expect(result).toBeNull()
      expect(mockExecutor).not.toHaveBeenCalled()
    })

    it('returns structured OPD visit details with diagnoses, drugs, labs, and xray', async () => {
      const mockExecutor: QueryExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM opdscreen o \n        join patient pt')) {
          return Promise.resolve([
            {
              hn: '0012345',
              cid: '1529900112233',
              ptname: 'นายสมชาย ใจดี',
              ptage: 45,
              vn: '690930001',
              dayv: '30',
              monthv: 'ก.ย.',
              yearv: '2569',
            },
          ])
        }
        if (sql.includes('concat(ic1.code')) {
          return Promise.resolve([
            {
              bps: 120,
              bpd: 80,
              bw: 65,
              pulse: 78,
              temperature: 36.6,
              cc: 'ตรวจสุขภาพ',
              department: 'OPD 1',
              name: 'J00 : Acute nasopharyngitis',
            },
          ])
        }
        if (sql.includes('FROM opitemrece o  \n        join drugitems d')) {
          return Promise.resolve([
            {
              name: 'Paracetamol 500 mg',
              strength: '500 mg',
              qty: 10,
              units: 'เม็ด',
              name1: 'รับประทานครั้งละ 1 เม็ด',
            },
          ])
        }
        if (sql.includes('FROM lab_head lh \n        left outer join lab_order lo')) {
          return Promise.resolve([
            {
              form_name: 'CBC',
              lab_items_name: 'WBC',
              lab_order_result: '6500',
              lab_items_normal_value: '4000-10000',
            },
          ])
        }
        if (sql.includes('xray_head')) {
          return Promise.resolve([{ xray_list: 'Chest PA Upright normal' }])
        }
        return Promise.resolve([])
      })

      const result = await ClinicalRecordsService.getVisitClinicalDetails(
        { vn: '690930001' },
        mockExecutor
      )

      expect(result).not.toBeNull()
      expect(result?.type).toBe('OPD')
      if (result?.type === 'OPD') {
        expect(result.patient.hn).toBe('0012345')
        expect(result.patient.age).toBe(45)
        expect(result.screen.dxMain).toBe('J00 : Acute nasopharyngitis')
        expect(result.drugs).toHaveLength(1)
        expect(result.drugs[0].name).toBe('Paracetamol 500 mg')
        expect(result.labs).toHaveLength(1)
        expect(result.labs[0].result).toBe('6500')
        expect(result.xray).toBe('Chest PA Upright normal')
      }
    })

    it('returns structured IPD admission details for an', async () => {
      const mockExecutor: QueryExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM an_stat o \n        join patient pt')) {
          return Promise.resolve([
            {
              hn: '0012345',
              cid: '1529900112233',
              ptname: 'นายสมชาย ใจดี',
              ptage: 45,
              vn: '690930001',
              dayv: '30',
              monthv: 'ก.ย.',
              yearv: '2569',
              tname: 'I10 : Essential hypertension',
            },
          ])
        }
        if (sql.includes('FROM opitemrece o  \n        join drugitems d')) {
          return Promise.resolve([
            {
              name: 'Amlodipine 5 mg',
              strength: '5 mg',
              qty: 30,
              units: 'เม็ด',
              dayv: '30',
              monthv: 'ก.ย.',
              yearv: '2569',
            },
          ])
        }
        if (sql.includes('FROM lab_head lh \n        left outer join lab_order lo')) {
          return Promise.resolve([
            {
              form_name: 'Electrolyte',
              lab_items_name: 'Potassium',
              lab_order_result: '4.2',
              lab_items_normal_value: '3.5-5.0',
              dayv: '30',
              monthv: 'ก.ย.',
              yearv: '2569',
            },
          ])
        }
        return Promise.resolve([])
      })

      const result = await ClinicalRecordsService.getVisitClinicalDetails(
        { an: '690001' },
        mockExecutor
      )

      expect(result?.type).toBe('IPD')
      if (result?.type === 'IPD') {
        expect(result.patient.diagnosis).toBe('I10 : Essential hypertension')
        expect(result.drugs[0].name).toBe('Amlodipine 5 mg')
        expect(result.labs[0].itemName).toBe('Potassium')
      }
    })
  })

  describe('getLabTrackerReport and getLabTrackerDoctors', () => {
    it('aggregates pending and reported lab orders correctly', async () => {
      const mockExecutor: QueryExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('lh.report_date is null')) {
          return Promise.resolve([
            {
              hn: '0012345',
              ptname: 'นายสมชาย',
              form_name: 'CBC',
              order_time: '09:00:00',
              receive_time: '09:15:00',
              name: 'นพ.ใจดี',
            },
          ])
        }
        if (sql.includes('lh.report_date is not null')) {
          return Promise.resolve([
            {
              hn: '0098765',
              ptname: 'นางสมหญิง',
              report_time: '09:30:00',
              ovstost: '01',
              name: 'นพ.ใจดี',
            },
          ])
        }
        return Promise.resolve([])
      })

      const report = await ClinicalRecordsService.getLabTrackerReport('all', mockExecutor)
      expect(report.pending).toHaveLength(1)
      expect(report.reported).toHaveLength(1)
      expect(report.pending[0].patientName).toBe('นายสมชาย')
      expect(report.reported[0].patientName).toBe('นางสมหญิง')
    })

    it('aggregates doctor ordering statistics', async () => {
      const mockExecutor: QueryExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("not in ('01','011','02')")) {
          return Promise.resolve([{ code: 'NUR01', name: 'พว.สมศรี', cc: 5 }])
        }
        if (sql.includes("in ('01','011','02')")) {
          return Promise.resolve([{ code: 'DOC01', name: 'นพ.เอก', cc: 15 }])
        }
        if (sql.includes('count(distinct(lh.hn))')) {
          return Promise.resolve([{ cc: 20 }])
        }
        return Promise.resolve([])
      })

      const stats = await ClinicalRecordsService.getLabTrackerDoctors(mockExecutor)
      expect(stats.doctors).toHaveLength(1)
      expect(stats.doctors[0].name).toBe('นพ.เอก')
      expect(stats.others[0].name).toBe('พว.สมศรี')
      expect(stats.totalCount).toBe(20)
    })
  })

  describe('getLoratadineDispenseSummary', () => {
    it('computes summary statistics for Loratadine dispensing correctly', async () => {
      const fakeRows = [
        {
          hn: '001',
          fullname: 'นายหนึ่ง ทดสอบ',
          age: 35,
          status: 'OPD',
          vstdate: '2026-09-30',
          rxdate: '2026-09-30',
          rxtime: '10:15:00',
          qty: 10,
          doctor_name: 'นพ.ทดสอบ',
          department: 'ห้องตรวจ 1',
        },
        {
          hn: '002',
          fullname: 'นางสอง ทดสอบ',
          age: 15,
          status: 'IPD',
          vstdate: '2026-09-30',
          rxdate: '2026-09-30',
          rxtime: '11:00:00',
          qty: 20,
          doctor_name: 'พญ.ทดสอบ',
          department: 'หอผู้ป่วยใน',
        },
      ]

      const mockExecutor: QueryExecutor = vi.fn().mockResolvedValue(fakeRows)
      const result = await ClinicalRecordsService.getLoratadineDispenseSummary('all', mockExecutor)

      expect(result.summary.totalCount).toBe(2)
      expect(result.summary.totalQty).toBe(30)
      expect(result.summary.opdCount).toBe(1)
      expect(result.summary.ipdCount).toBe(1)
      expect(result.summary.adultCount).toBe(1)
    })
  })
})
