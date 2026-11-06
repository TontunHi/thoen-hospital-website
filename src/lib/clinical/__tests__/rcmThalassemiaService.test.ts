import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmThalassemiaService,
  determineLabStatus,
} from '../rcmThalassemiaService'
import { invalidateCacheKey } from '@/lib/cache'

describe('RcmThalassemiaService (Fund 3. Thalassemia in Pregnancy)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCacheKey('rcm-thalassemia-adp-mapping-check')
    invalidateCacheKey('rcm-thalassemia-report-2026-05-01-2026-05-31')
    invalidateCacheKey('rcm-thalassemia-report-2026-06-01-2026-06-30')
  })

  describe('determineLabStatus helper', () => {
    it('returns NO_LAB when both labname and labresult are missing', () => {
      expect(determineLabStatus(null, null)).toBe('NO_LAB')
      expect(determineLabStatus('', '')).toBe('NO_LAB')
    })

    it('returns PENDING when lab is ordered but result is pending or null', () => {
      expect(determineLabStatus('DCIP', null)).toBe('PENDING')
      expect(determineLabStatus('DCIP', '')).toBe('PENDING')
      expect(determineLabStatus('DCIP', 'รอผล')).toBe('PENDING')
    })

    it('returns NORMAL for negative or normal results', () => {
      expect(determineLabStatus('DCIP', 'Negative')).toBe('NORMAL')
      expect(determineLabStatus('OF', 'Normal')).toBe('NORMAL')
      expect(determineLabStatus('Hemoglobin typing', 'A2A')).toBe('NORMAL')
    })

    it('returns RISK for positive or abnormal results', () => {
      expect(determineLabStatus('DCIP', 'Positive')).toBe('RISK')
      expect(determineLabStatus('DCIP', 'Weakly Positive')).toBe('RISK')
      expect(determineLabStatus('Hemoglobin typing', 'E trait')).toBe('RISK')
      expect(determineLabStatus('Hemoglobin typing', 'Beta-thal/Hb E')).toBe('RISK')
    })
  })

  describe('checkThalassemiaAdpMapping', () => {
    it('returns isMapped: true when 30313 or 37532 exists in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        { icode: '3000227', name: 'Hemoglobin typing', strength: '', nhso_adp_code: '30313' },
        { icode: '3000748', name: 'DCIP', strength: '', nhso_adp_code: '30313' },
      ])

      const result = await RcmThalassemiaService.checkThalassemiaAdpMapping(mockExecutor)
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(2)
      expect(result.items[0].name).toBe('Hemoglobin typing')
    })

    it('returns isMapped: false when no matching ADP codes exist', async () => {
      invalidateCacheKey('rcm-thalassemia-adp-mapping-check')
      const mockExecutor = vi.fn().mockResolvedValue([])

      const result = await RcmThalassemiaService.checkThalassemiaAdpMapping(mockExecutor)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
      expect(result.items).toHaveLength(0)
    })
  })

  describe('getThalassemiaReport', () => {
    it('executes SQL, processes rows, and calculates summary metrics properly', async () => {
      const mockRows = [
        {
          person_id: 1,
          ancno: 101,
          cid: '1520800000001',
          hn: '0050001',
          ptname: 'นาง สุดา สุขใจ',
          age: 28,
          pttypename: 'บัตรทอง รพ.เถิน',
          address: '10 ม.2 ต.ล้อมแรด',
          labor_date: '2026-05-10',
          labor_type: 'NORMAL',
          labour_type_id: 1,
          hospital: 'โรงพยาบาลเถิน',
          labour_hospcode: '11152',
          preg_no: 1,
          lmp: '2025-08-01',
          edc: '2026-05-08',
          labcode: '2128',
          labname: 'DCIP',
          labresult: 'DCIP: Negative',
          lab_order_date: '2025-10-15',
          ordered_adp_items: 'DCIP',
        },
        {
          person_id: 2,
          ancno: 102,
          cid: '1520800000002',
          hn: '0050002',
          ptname: 'นาง กานดา มีสุข',
          age: 32,
          pttypename: 'จ่ายตรง',
          address: '20 ม.4 ต.เถินบุรี',
          labor_date: '2026-05-12',
          labor_type: 'CESAREAN',
          labour_type_id: 2,
          hospital: 'โรงพยาบาลเถิน',
          labour_hospcode: '11152',
          preg_no: 2,
          lmp: '2025-08-05',
          edc: '2026-05-12',
          labcode: '2128',
          labname: 'DCIP',
          labresult: 'DCIP: Positive',
          lab_order_date: '2025-10-20',
          ordered_adp_items: 'DCIP, Hemoglobin typing',
        },
        {
          person_id: 3,
          ancno: 103,
          cid: '1520800000003',
          hn: '0050003',
          ptname: 'น.ส. มาลี ใจดี',
          age: 22,
          pttypename: 'บัตรทอง รพ.เถิน',
          address: '30 ม.1 ต.แม่มอก',
          labor_date: '2026-05-15',
          labor_type: 'NORMAL',
          labour_type_id: 1,
          hospital: 'โรงพยาบาลลำปาง',
          labour_hospcode: '10672',
          preg_no: 1,
          lmp: '2025-08-10',
          edc: '2026-05-17',
          labcode: null,
          labname: null,
          labresult: null,
          lab_order_date: null,
          ordered_adp_items: null,
        },
      ]

      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) {
          return Promise.resolve([
            { icode: '3000748', name: 'DCIP', strength: '', nhso_adp_code: '30313' },
          ])
        }
        return Promise.resolve(mockRows)
      })

      const report = await RcmThalassemiaService.getThalassemiaReport(
        { ds1: '2026-05-01', ds2: '2026-05-31', cardFilter: 'ALL', refresh: true },
        mockExecutor
      )

      expect(report.totalCount).toBe(3)
      expect(report.summary.totalMothers).toBe(3)
      expect(report.summary.screenedCount).toBe(2)
      expect(report.summary.unscreenedCount).toBe(1)
      expect(report.summary.normalCount).toBe(1)
      expect(report.summary.riskCount).toBe(1)
      expect(report.summary.thoenHospitalCount).toBe(2)
      expect(report.summary.otherHospitalCount).toBe(1)
      expect(report.summary.normalLaborCount).toBe(2)
      expect(report.summary.cesareanLaborCount).toBe(1)
      expect(report.items[0].no).toBe(1)
    })

    it('filters items correctly by cardFilter: RISK and laborTypeFilter', async () => {
      const mockRows = [
        {
          person_id: 1,
          ancno: 101,
          hn: '0050001',
          ptname: 'นาง สุดา สุขใจ',
          labor_date: '2026-06-10',
          labor_type: 'NORMAL',
          hospital: 'โรงพยาบาลเถิน',
          labour_hospcode: '11152',
          labname: 'DCIP',
          labresult: 'DCIP: Negative',
        },
        {
          person_id: 2,
          ancno: 102,
          hn: '0050002',
          ptname: 'นาง กานดา มีสุข',
          labor_date: '2026-06-12',
          labor_type: 'CESAREAN',
          hospital: 'โรงพยาบาลเถิน',
          labour_hospcode: '11152',
          labname: 'DCIP',
          labresult: 'DCIP: Positive',
        },
      ]

      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM s_drugitems')) return Promise.resolve([])
        return Promise.resolve(mockRows)
      })

      const riskReport = await RcmThalassemiaService.getThalassemiaReport(
        { ds1: '2026-06-01', ds2: '2026-06-30', cardFilter: 'RISK', refresh: true },
        mockExecutor
      )

      expect(riskReport.items).toHaveLength(1)
      expect(riskReport.items[0].ptname).toBe('นาง กานดา มีสุข')
      expect(riskReport.items[0].lab_status).toBe('RISK')
    })
  })
})
