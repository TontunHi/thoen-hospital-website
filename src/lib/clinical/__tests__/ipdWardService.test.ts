import { describe, it, expect } from 'vitest'
import {
  IpdWardService,
  resolveWardGroupId,
  maskPatientName,
  WARD_SECTIONS,
  TOTAL_HOSPITAL_BEDS,
} from '../ipdWardService'

describe('IpdWardService Unit Tests', () => {
  describe('resolveWardGroupId', () => {
    it('should map Ward 06 beds 1-20 to w1', () => {
      expect(resolveWardGroupId('06', 'W01')).toBe('w1')
      expect(resolveWardGroupId('06', 'W15')).toBe('w1')
      expect(resolveWardGroupId('06', 'W20')).toBe('w1')
    })

    it('should map Ward 06 beds 21-40 to w2', () => {
      expect(resolveWardGroupId('06', 'W21')).toBe('w2')
      expect(resolveWardGroupId('06', 'W35')).toBe('w2')
      expect(resolveWardGroupId('06', 'W40')).toBe('w2')
    })

    it('should map Ward 06 isolation beds (Wย) to w3', () => {
      expect(resolveWardGroupId('06', 'Wย01')).toBe('w3')
      expect(resolveWardGroupId('06', 'Wย-02')).toBe('w3')
    })

    it('should map other wards to their respective groups', () => {
      expect(resolveWardGroupId('05', 'ICU-1')).toBe('icu')
      expect(resolveWardGroupId('04', 'V01')).toBe('special')
      expect(resolveWardGroupId('02', 'C01')).toBe('lr')
      expect(resolveWardGroupId('09', 'RB-01')).toBe('surgery')
    })

    it('should return other for unrecognized wards', () => {
      expect(resolveWardGroupId('99', 'B01')).toBe('other')
    })
  })

  describe('maskPatientName (PDPA compliant)', () => {
    it('should return dash for empty or null names', () => {
      expect(maskPatientName(null)).toBe('-')
      expect(maskPatientName('')).toBe('-')
      expect(maskPatientName(undefined)).toBe('-')
    })

    it('should append asterisks for short names', () => {
      expect(maskPatientName('สม')).toBe('สม***')
    })

    it('should mask name keeping first 3 chars and asterisks', () => {
      expect(maskPatientName('นายสมชาย')).toBe('นาย***')
      expect(maskPatientName('นางสาววิภาดา')).toBe('นาง***')
    })
  })

  describe('getWardSummary', () => {
    it('should aggregate patient counts into correct ward sections', async () => {
      const mockRows = [
        { ward: '06', bedno: 'W05' },
        { ward: '06', bedno: 'W10' },
        { ward: '06', bedno: 'W25' },
        { ward: '06', bedno: 'Wย01' },
        { ward: '05', bedno: 'ICU-1' },
        { ward: '04', bedno: 'V01' },
        { ward: '02', bedno: 'C01' },
        { ward: '09', bedno: 'RB01' },
      ]

      const mockExecutor = async () => mockRows

      const result = await IpdWardService.getWardSummary(mockExecutor)

      expect(result.totalPatients).toBe(8)
      expect(result.sections).toHaveLength(WARD_SECTIONS.length)

      const w1 = result.sections.find((s) => s.id === 'w1')
      const w2 = result.sections.find((s) => s.id === 'w2')
      const w3 = result.sections.find((s) => s.id === 'w3')
      const icu = result.sections.find((s) => s.id === 'icu')

      expect(w1?.count).toBe(2)
      expect(w2?.count).toBe(1)
      expect(w3?.count).toBe(1)
      expect(icu?.count).toBe(1)
    })
  })

  describe('getWardPatientRoster', () => {
    it('should group patient records into sections with admit days and PDPA masking', async () => {
      const mockRows = [
        {
          hn: '123456',
          ptname: 'นายสมชาย',
          age: 45,
          regdate: '2026-09-25',
          admit_days: 4,
          bedno: 'W02',
          ward: '06',
        },
        {
          hn: '654321',
          ptname: 'นางสมหญิง',
          age: 60,
          regdate: '2026-09-27',
          admit_days: 2,
          bedno: 'ICU-2',
          ward: '05',
        },
      ]

      const mockExecutor = async () => mockRows

      const result = await IpdWardService.getWardPatientRoster(mockExecutor)

      expect(result.totalPatients).toBe(2)

      const w1 = result.sections.find((s) => s.id === 'w1')
      const icu = result.sections.find((s) => s.id === 'icu')

      expect(w1?.patients).toHaveLength(1)
      expect(w1?.patients[0].hn).toBe('123456')
      expect(w1?.patients[0].admitDays).toBe(4)

      expect(icu?.patients).toHaveLength(1)
      expect(icu?.patients[0].bedno).toBe('ICU-2')
    })
  })

  describe('getBedOccupancyReport', () => {
    it('should calculate bed occupancy correctly across wards', async () => {
      const mockExecutor = async (sql: string) => {
        if (sql.includes('COUNT(DISTINCT o.hn) AS opdCount')) {
          return [{ opdCount: 150 }]
        }
        if (sql.includes('SELECT i.ward, COUNT(i.an) AS occupiedBeds')) {
          return [
            { ward: '06', occupiedBeds: 20 },
            { ward: '05', occupiedBeds: 4 },
            { ward: '04', occupiedBeds: 5 },
            { ward: '02', occupiedBeds: 2 },
            { ward: '09', occupiedBeds: 10 },
          ]
        }
        if (sql.includes("WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%'")) {
          return [{ occupiedBeds: 5, personCount: 6 }]
        }
        if (sql.includes("AND ip.bedno LIKE 'C0%'")) {
          return [{ occupiedBeds: 1 }]
        }
        if (sql.includes("AND ip.bedno LIKE 'CP%'")) {
          return [{ occupiedBeds: 1 }]
        }
        if (sql.includes('SELECT i.ward, COUNT(i.an) AS admitCount')) {
          return [{ ward: '06', admitCount: 3 }]
        }
        if (sql.includes('SELECT i.ward, COUNT(i.an) AS dischargeCount')) {
          return [{ ward: '06', dischargeCount: 2 }]
        }
        if (sql.includes('SUM(admdate) AS totalAdmDays')) {
          return [{ totalAdmDays: 1200, daysInMonth: 30 }]
        }
        if (sql.includes('SELECT COUNT(i.an) AS onVentilator')) {
          return [{ onVentilator: 2 }]
        }
        return []
      }

      const result = await IpdWardService.getBedOccupancyReport(mockExecutor)

      expect(result.totalBeds).toBe(TOTAL_HOSPITAL_BEDS)
      expect(result.opdPatientCount).toBe(150)
      expect(result.wards).toHaveLength(5)

      const icu = result.wards.find((w) => w.id === '05')
      expect(icu?.extra?.onVentilator).toBe(2)
      expect(icu?.extra?.ciCount).toBe(2) // 4 occupied - 2 on ventilator = 2 CI
    })
  })

  describe('getOrRoomStatus', () => {
    it('should return waiting, in-progress, and recovery lists with masked names', async () => {
      const mockExecutor = async (sql: string) => {
        if (sql.includes("AND op.status_id IN ('1')")) {
          return [
            {
              hn: '111111',
              ptname: 'นายกานต์',
              age_text: 35,
              room_name: 'OR-1',
              request_time: '09:00',
              status_name: 'รอผ่าตัด',
            },
          ]
        }
        if (sql.includes("AND op.status_id IN ('2')")) {
          return [
            {
              hn: '222222',
              ptname: 'นางสมใจ',
              age_text: 50,
              room_name: 'OR-2',
              request_time: '08:30',
              status_name: 'กำลังผ่าตัด',
            },
          ]
        }
        if (sql.includes("AND op.status_id IN ('3')")) {
          return [
            {
              hn: '333333',
              ptname: 'นายสมบัติ',
              age_text: 62,
              room_name: 'OR-1',
              request_time: '07:45',
              status_name: 'ผ่าตัดเสร็จ/พักฟื้น',
            },
          ]
        }
        return []
      }

      const result = await IpdWardService.getOrRoomStatus(mockExecutor)

      expect(result.total).toBe(3)
      expect(result.waiting).toHaveLength(1)
      expect(result.waiting[0].ptname).toBe('นาย***')
      expect(result.inProgress).toHaveLength(1)
      expect(result.recovery).toHaveLength(1)
    })
  })
})
