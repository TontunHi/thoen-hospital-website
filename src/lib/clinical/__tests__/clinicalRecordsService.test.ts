import { describe, it, expect, vi } from 'vitest'
import { ClinicalRecordsService } from '../clinicalRecordsService'

describe('ClinicalRecordsService', () => {
  describe('searchPatientVisits', () => {
    it('returns empty array when query is empty or whitespace', async () => {
      const searchPatientVisits = vi.fn()
      const result = await ClinicalRecordsService.searchPatientVisits('   ', { searchPatientVisits })
      expect(result).toEqual([])
      expect(searchPatientVisits).not.toHaveBeenCalled()
    })

    it('fetches HOSxP search visits via Gateway and formats patient records correctly', async () => {
      const searchPatientVisits = vi.fn().mockResolvedValue([
        {
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
        },
      ])

      const result = await ClinicalRecordsService.searchPatientVisits('0012345', { searchPatientVisits })

      expect(searchPatientVisits).toHaveBeenCalledWith('0012345')
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
      const getVisitClinicalDetails = vi.fn()
      const result = await ClinicalRecordsService.getVisitClinicalDetails({}, { getVisitClinicalDetails })
      expect(result).toBeNull()
      expect(getVisitClinicalDetails).not.toHaveBeenCalled()
    })

    it('returns structured OPD visit details via Gateway', async () => {
      const getVisitClinicalDetails = vi.fn().mockResolvedValue({
        type: 'OPD',
        patient: {
          hn: '0012345',
          cid: '1529900112233',
          name: 'นายสมชาย ใจดี',
          age: 45,
          dateText: '30 ก.ย. 2569',
        },
        screen: {
          bps: 120,
          bpd: 80,
          bw: 65,
          pulse: 78,
          temperature: 36.6,
          cc: 'ตรวจสุขภาพ',
          department: 'OPD 1',
          dxMain: 'J00 : Acute nasopharyngitis',
        },
        drugs: [
          {
            name: 'Paracetamol 500 mg',
            strength: '500 mg',
            qty: 10,
            units: 'เม็ด',
            usage: 'รับประทานครั้งละ 1 เม็ด',
          },
        ],
        labs: [
          {
            formName: 'CBC',
            itemName: 'WBC',
            result: '6500',
            refValue: '4000-10000',
          },
        ],
        xray: 'Chest PA Upright normal',
      })

      const result = await ClinicalRecordsService.getVisitClinicalDetails(
        { vn: '690930001' },
        { getVisitClinicalDetails }
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

    it('returns structured IPD admission details for an via Gateway', async () => {
      const getVisitClinicalDetails = vi.fn().mockResolvedValue({
        type: 'IPD',
        patient: {
          hn: '0012345',
          cid: '1529900112233',
          name: 'นายสมชาย ใจดี',
          age: 45,
          dateText: '30 ก.ย. 2569',
          diagnosis: 'I10 : Essential hypertension',
        },
        drugs: [{ name: 'Amlodipine 5 mg', strength: '5 mg', qty: 30, units: 'เม็ด', dateText: '30 ก.ย. 2569' }],
        labs: [{ formName: 'Electrolyte', itemName: 'Potassium', result: '4.2', refValue: '3.5-5.0' }],
        xray: null,
      })

      const result = await ClinicalRecordsService.getVisitClinicalDetails(
        { an: '690001' },
        { getVisitClinicalDetails }
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
    it('aggregates pending and reported lab orders correctly via Gateway', async () => {
      const getLabTrackerReport = vi.fn().mockResolvedValue({
        pendingRows: [
          {
            hn: '0012345',
            ptname: 'นายสมชาย',
            form_name: 'CBC',
            order_time: '09:00:00',
            receive_time: '09:15:00',
            name: 'นพ.ใจดี',
          },
        ],
        reportedRows: [
          {
            hn: '0098765',
            ptname: 'นางสมหญิง',
            report_time: '09:30:00',
            ovstost: '01',
            name: 'นพ.ใจดี',
          },
        ],
      })

      const report = await ClinicalRecordsService.getLabTrackerReport('all', { getLabTrackerReport })
      expect(report.pending).toHaveLength(1)
      expect(report.reported).toHaveLength(1)
      expect(report.pending[0].patientName).toBe('นายสมชาย')
      expect(report.reported[0].patientName).toBe('นางสมหญิง')
    })

    it('aggregates doctor ordering statistics via Gateway', async () => {
      const getLabTrackerDoctors = vi.fn().mockResolvedValue({
        doctors: [{ code: 'DOC01', name: 'นพ.เอก', cc: 15 }],
        others: [{ code: 'NUR01', name: 'พว.สมศรี', cc: 5 }],
        totalCount: 20,
      })

      const stats = await ClinicalRecordsService.getLabTrackerDoctors({ getLabTrackerDoctors })
      expect(stats.doctors).toHaveLength(1)
      expect(stats.doctors[0].name).toBe('นพ.เอก')
      expect(stats.others[0].name).toBe('พว.สมศรี')
      expect(stats.totalCount).toBe(20)
    })
  })

  describe('getLoratadineDispenseSummary', () => {
    it('computes summary statistics for Loratadine dispensing correctly via Gateway', async () => {
      const getLoratadineMonitor = vi.fn().mockResolvedValue([
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
      ])

      const result = await ClinicalRecordsService.getLoratadineDispenseSummary('all', { getLoratadineMonitor })

      expect(result.summary.totalCount).toBe(2)
      expect(result.summary.totalQty).toBe(30)
      expect(result.summary.opdCount).toBe(1)
      expect(result.summary.ipdCount).toBe(1)
      expect(result.summary.adultCount).toBe(1)
    })
  })
})
