import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearMemoryCache } from '@/lib/cache'
import {
  RcmAdpSearchService,
  parseAdpCodes,
  isUniversalCoverageScheme,
  type AdpSearchReportParams,
} from '../rcmAdpSearchService'

describe('RcmAdpSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  describe('parseAdpCodes', () => {
    it('returns default SPECC when input is undefined or empty', () => {
      expect(parseAdpCodes(undefined)).toEqual(['SPECC'])
      expect(parseAdpCodes('')).toEqual(['SPECC'])
      expect(parseAdpCodes('   ')).toEqual(['SPECC'])
    })

    it('parses single ADP code cleanly', () => {
      expect(parseAdpCodes('12003')).toEqual(['12003'])
      expect(parseAdpCodes(' 14001 ')).toEqual(['14001'])
    })

    it('parses multiple ADP codes separated by comma or space and removes duplicates', () => {
      expect(parseAdpCodes('14001, 12003, 12004')).toEqual(['14001', '12003', '12004'])
      expect(parseAdpCodes('14001 14001 12003')).toEqual(['14001', '12003'])
    })
  })

  describe('isUniversalCoverageScheme', () => {
    it('returns true for UCS / WEL / UC', () => {
      expect(isUniversalCoverageScheme('UCS', '')).toBe(true)
      expect(isUniversalCoverageScheme('WEL', '')).toBe(true)
      expect(isUniversalCoverageScheme('UC', '')).toBe(true)
    })

    it('returns true for Thai UC keywords in pttypename', () => {
      expect(isUniversalCoverageScheme('', 'บัตรทอง')).toBe(true)
      expect(isUniversalCoverageScheme('', 'ประกันสุขภาพถ้วนหน้า')).toBe(true)
      expect(isUniversalCoverageScheme('', '30 บาทรักษาทุกโรค')).toBe(true)
    })

    it('returns false for SSS or OFC', () => {
      expect(isUniversalCoverageScheme('SSS', 'ประกันสังคม')).toBe(false)
      expect(isUniversalCoverageScheme('OFC', 'ข้าราชการ')).toBe(false)
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped true when ADP codes exist in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '1540012',
          name: 'Ferrous Fumarate 200 mg',
          strength: '200 mg',
          nhso_adp_code: '14001',
        },
      ])

      const result = await RcmAdpSearchService.checkAdpMapping(['14001'], mockExecutor, true)
      expect(result.adpCodes).toEqual(['14001'])
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].icode).toBe('1540012')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('FROM s_drugitems'),
        ['14001']
      )
    })

    it('returns isMapped false when no items match', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])
      const result = await RcmAdpSearchService.checkAdpMapping(['99999'], mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
    })
  })

  describe('getAdpSearchReport - OPD', () => {
    it('executes OPD query and calculates summary metrics correctly', async () => {
      const mockExecutor = vi.fn()

      // First call: checkAdpMapping
      mockExecutor.mockResolvedValueOnce([
        {
          icode: '1540012',
          name: 'Ferrous Fumarate 200 mg',
          strength: '200 mg',
          nhso_adp_code: '14001',
        },
      ])

      // Second call: OPD query rows
      mockExecutor.mockResolvedValueOnce([
        {
          vn: '680101001',
          hn: '0011223',
          an: null,
          cid: '1529900123456',
          ptname: 'นาย สมชาย ใจดี',
          sex_code: '1',
          birthday: '1985-05-10',
          age: 40,
          vstdate: '2025-01-01',
          vsttime: '08:30:00',
          pttype: '10',
          hipdata_code: 'UCS',
          pttypename: 'บัตรทอง',
          department: 'เวชปฏิบัติทั่วไป',
          clinic: 'OPD',
          symptom: 'มาตรวจตามนัด',
          diag: 'E11.9(1)',
          listname: '1540012:Ferrous, 1000001:Paracetamol',
          icode: '1540012',
          nhso_adp_code: '14001',
          item_name: 'Ferrous Fumarate 200 mg',
          income: 350.0,
          nee: 0,
          authencode: 'AUTH123456',
          compensated: 300.0,
        },
        {
          vn: '680101002',
          hn: '0011224',
          an: null,
          cid: '1529900654321',
          ptname: 'นาง สมศรี มีสุข',
          sex_code: '2',
          birthday: '1990-08-15',
          age: 35,
          vstdate: '2025-01-02',
          vsttime: '09:15:00',
          pttype: '30',
          hipdata_code: 'SSS',
          pttypename: 'ประกันสังคม',
          department: 'ทันตกรรม',
          clinic: 'Dental',
          symptom: 'ปวดฟัน',
          diag: 'K02.1(1)',
          listname: '1540012:Ferrous',
          icode: '1540012',
          nhso_adp_code: '14001',
          item_name: 'Ferrous Fumarate 200 mg',
          income: 500.0,
          nee: 200.0,
          authencode: null,
          compensated: 0,
        },
      ])

      const params: AdpSearchReportParams = {
        patientType: 'OPD',
        adpCode: '14001',
        refresh: true,
      }

      const result = await RcmAdpSearchService.getAdpSearchReport(params, mockExecutor)

      expect(result.patientType).toBe('OPD')
      expect(result.totalCount).toBe(2)
      expect(result.summary.totalRecords).toBe(2)
      expect(result.summary.uniquePatients).toBe(2)
      expect(result.summary.compensatedCount).toBe(1)
      expect(result.summary.uncompensatedCount).toBe(1)
      expect(result.summary.compensationRate).toBe(50)
      expect(result.summary.withAuthenCount).toBe(1)
      expect(result.summary.withoutAuthenCount).toBe(1)
      expect(result.summary.authenRate).toBe(50)
      expect(result.summary.ucCount).toBe(1)
      expect(result.summary.totalIncome).toBe(850)
      expect(result.summary.totalCompensated).toBe(300)
      expect(result.summary.totalDebt).toBe(200)

      expect(result.items[0].no).toBe(1)
      expect(result.items[0].hn).toBe('0011224') // Sorted by vstdate desc (2025-01-02 before 2025-01-01)
      expect(result.items[0].sex).toBe('หญิง')
      expect(result.items[1].sex).toBe('ชาย')
    })

    it('filters items correctly with cardFilter=COMPENSATED', async () => {
      const mockExecutor = vi.fn()
      mockExecutor.mockResolvedValueOnce([
        { icode: '1540012', name: 'Ferrous', strength: '', nhso_adp_code: '14001' },
      ])
      mockExecutor.mockResolvedValueOnce([
        {
          vn: '680101001',
          hn: '0011223',
          cid: '1529900123456',
          ptname: 'นาย สมชาย',
          vstdate: '2025-01-01',
          pttype: '10',
          compensated: 300,
        },
        {
          vn: '680101002',
          hn: '0011224',
          cid: '1529900654321',
          ptname: 'นาง สมศรี',
          vstdate: '2025-01-02',
          pttype: '30',
          compensated: 0,
        },
      ])

      const result = await RcmAdpSearchService.getAdpSearchReport(
        { patientType: 'OPD', adpCode: '14001', cardFilter: 'COMPENSATED', refresh: true },
        mockExecutor
      )

      expect(result.totalCount).toBe(1)
      expect(result.items[0].hn).toBe('0011223')
      expect(result.items[0].compensated).toBe(300)
    })

    it('filters items correctly with search term', async () => {
      const mockExecutor = vi.fn()
      mockExecutor.mockResolvedValueOnce([
        { icode: '1540012', name: 'Ferrous', strength: '', nhso_adp_code: '14001' },
      ])
      mockExecutor.mockResolvedValueOnce([
        {
          vn: '680101001',
          hn: '0011223',
          cid: '1529900123456',
          ptname: 'นาย สมชาย ใจดี',
          vstdate: '2025-01-01',
          pttype: '10',
          pttypename: 'บัตรทอง',
        },
        {
          vn: '680101002',
          hn: '0011224',
          cid: '1529900654321',
          ptname: 'นาง สมศรี มีสุข',
          vstdate: '2025-01-02',
          pttype: '30',
          pttypename: 'ประกันสังคม',
        },
      ])

      const result = await RcmAdpSearchService.getAdpSearchReport(
        { patientType: 'OPD', adpCode: '14001', search: 'สมศรี', refresh: true },
        mockExecutor
      )

      expect(result.totalCount).toBe(1)
      expect(result.items[0].ptname).toBe('นาง สมศรี มีสุข')
    })
  })

  describe('getAdpSearchReport - IPD', () => {
    it('executes IPD query and maps fields properly', async () => {
      const mockExecutor = vi.fn()
      mockExecutor.mockResolvedValueOnce([
        { icode: '1540012', name: 'Ferrous', strength: '', nhso_adp_code: '14001' },
      ])
      mockExecutor.mockResolvedValueOnce([
        {
          an: '6800001',
          hn: '0011223',
          cid: '1529900123456',
          ptname: 'นาย สมชาย ใจดี',
          sex_code: '1',
          birthday: '1985-05-10',
          age: 40,
          admdate: '2025-01-01',
          dchdate: '2025-01-05',
          pttype: '10',
          hipdata_code: 'UCS',
          pttypename: 'บัตรทอง',
          department: 'ตึกผู้ป่วยในชาย',
          pdx: 'A09.0',
          pdxname: 'Gastroenteritis',
          sdx: 'E86(2)',
          proc_ops: '96.07',
          icode: '1540012',
          nhso_adp_code: '14001',
          item_name: 'Ferrous Fumarate 200 mg',
          income: 4500.0,
          nee: 0,
          compensated: 4200.0,
        },
      ])

      const result = await RcmAdpSearchService.getAdpSearchReport(
        { patientType: 'IPD', adpCode: '14001', refresh: true },
        mockExecutor
      )

      expect(result.patientType).toBe('IPD')
      expect(result.totalCount).toBe(1)
      expect(result.items[0].an).toBe('6800001')
      expect(result.items[0].admdate).toBe('2025-01-01')
      expect(result.items[0].dchdate).toBe('2025-01-05')
      expect(result.items[0].pdx).toBe('A09.0')
      expect(result.items[0].hasOperation).toBe(true)
      expect(result.summary.withOperationCount).toBe(1)
    })

    it('filters IPD records with pttypes and recalculates summary', async () => {
      const mixedIpdRows = [
        {
          an: '690001',
          hn: '0011111',
          cid: '1529900011111',
          ptname: 'นาย ก',
          sex_code: '1',
          birthday: '1980-01-01',
          age: 46,
          regdate: '2026-10-01',
          dchdate: '2026-10-05',
          pttype: '10',
          pttypename: 'บัตรทอง',
          pttype_eclaim_id: '01',
          hipdata_code: 'UCS',
          income: 10000,
          compensated: 8000,
          pdx: 'I21.0',
        },
        {
          an: '690002',
          hn: '0022222',
          cid: '1529900022222',
          ptname: 'นาย ข',
          sex_code: '1',
          birthday: '1975-01-01',
          age: 51,
          regdate: '2026-10-02',
          dchdate: '2026-10-06',
          pttype: '30',
          pttypename: 'ประกันสังคม',
          pttype_eclaim_id: '30',
          hipdata_code: 'SSS',
          income: 5000,
          compensated: 4000,
          pdx: 'K29.0',
        },
      ]

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([{ icode: '1540012', name: 'Ferrous', strength: '', nhso_adp_code: '14001' }])
        .mockResolvedValueOnce(mixedIpdRows)

      const res = await RcmAdpSearchService.getAdpSearchReport(
        {
          patientType: 'IPD',
          adpCode: '14001',
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          pttypes: '01,02',
          refresh: true,
        },
        mockExecutor
      )

      expect(res.items).toHaveLength(1)
      expect(res.items[0].an).toBe('690001')
      expect(res.summary.totalRecords).toBe(1)
      expect(res.summary.totalIncome).toBe(10000)
    })

    it('falls back to ucOnly when pttypes is omitted', async () => {
      const mixedIpdRows = [
        {
          an: '690001',
          hn: '0011111',
          cid: '1529900011111',
          ptname: 'นาย ก',
          sex_code: '1',
          birthday: '1980-01-01',
          age: 46,
          regdate: '2026-10-01',
          dchdate: '2026-10-05',
          pttype: '10',
          pttypename: 'บัตรทอง',
          pttype_eclaim_id: '01',
          hipdata_code: 'UCS',
          income: 10000,
          compensated: 8000,
        },
        {
          an: '690002',
          hn: '0022222',
          cid: '1529900022222',
          ptname: 'นาย ข',
          sex_code: '1',
          birthday: '1975-01-01',
          age: 51,
          regdate: '2026-10-02',
          dchdate: '2026-10-06',
          pttype: '30',
          pttypename: 'ประกันสังคม',
          pttype_eclaim_id: '30',
          hipdata_code: 'SSS',
          income: 5000,
          compensated: 4000,
        },
      ]

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([{ icode: '1540012', name: 'Ferrous', strength: '', nhso_adp_code: '14001' }])
        .mockResolvedValueOnce(mixedIpdRows)

      const res = await RcmAdpSearchService.getAdpSearchReport(
        {
          patientType: 'IPD',
          adpCode: '14001',
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          ucOnly: true,
          refresh: true,
        },
        mockExecutor
      )

      expect(res.items).toHaveLength(1)
      expect(res.items[0].an).toBe('690001')
      expect(res.summary.totalRecords).toBe(1)
    })
  })

  describe('getAvailableAdpCodes', () => {
    it('returns merged preset options and database options', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          code: '14001',
          title: 'Ferrous Fumarate 200 mg',
          mappedCount: 2,
        },
        {
          code: '99988',
          title: 'Custom Hospital Special Drug',
          mappedCount: 1,
        },
      ])

      const options = await RcmAdpSearchService.getAvailableAdpCodes(mockExecutor, true)
      expect(options.length).toBeGreaterThan(0)
      const found14001 = options.find((o) => o.code === '14001')
      expect(found14001).toBeDefined()
      expect(found14001?.mappedCount).toBe(2)

      const foundCustom = options.find((o) => o.code === '99988')
      expect(foundCustom).toBeDefined()
      expect(foundCustom?.title).toBe('Custom Hospital Special Drug')
      expect(foundCustom?.category).toBe('รายการในฐานข้อมูล รพ.')
    })

    it('falls back to default presets if query fails', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('DB Timeout'))
      const options = await RcmAdpSearchService.getAvailableAdpCodes(mockExecutor, true)
      expect(options.length).toBeGreaterThan(0)
      expect(options.some((o) => o.code === '14001')).toBe(true)
    })
  })
})
