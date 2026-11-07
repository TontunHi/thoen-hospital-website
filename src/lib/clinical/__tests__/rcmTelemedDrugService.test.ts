import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmTelemedDrugService,
  isUniversalCoverageScheme,
} from '../rcmTelemedDrugService'

describe('RcmTelemedDrugService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isUniversalCoverageScheme', () => {
    it('returns true for UCS / WEL / UC in maininscl', () => {
      expect(isUniversalCoverageScheme('UCS', '')).toBe(true)
      expect(isUniversalCoverageScheme('WEL', '')).toBe(true)
      expect(isUniversalCoverageScheme('UC', '')).toBe(true)
    })

    it('returns true for Thai UC keywords in pttypename', () => {
      expect(isUniversalCoverageScheme('', 'บัตรทอง')).toBe(true)
      expect(isUniversalCoverageScheme('', 'ประกันสุขภาพถ้วนหน้า')).toBe(true)
      expect(isUniversalCoverageScheme('', '30 บาทรักษาทุกโรค')).toBe(true)
    })

    it('returns false for non-UC schemes', () => {
      expect(isUniversalCoverageScheme('SSS', 'ประกันสังคม')).toBe(false)
      expect(isUniversalCoverageScheme('OFC', 'ข้าราชการ')).toBe(false)
      expect(isUniversalCoverageScheme('', '')).toBe(false)
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped true when ADP code exists in s_drugitems', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '3002608',
          name: 'ค่าให้บริการ Telemedicine Project code',
          strength: '',
          nhso_adp_code: 'TELMED',
        },
      ])

      const result = await RcmTelemedDrugService.checkAdpMapping('TELMED', mockExecutor, true)
      expect(result.adpCode).toBe('TELMED')
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].icode).toBe('3002608')
    })

    it('returns isMapped false when database throws error', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('DB failure'))
      const result = await RcmTelemedDrugService.checkAdpMapping('DRUGP', mockExecutor, true)
      expect(result.adpCode).toBe('DRUGP')
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
    })
  })

  describe('getTelemedReport', () => {
    const mockRawRows = [
      {
        vn: '691107001',
        cid: '3520800111111',
        hn: '0011111',
        ptname: 'นายสมชาย ชาญชัย',
        sex_code: '1',
        birthday: '1980-01-01',
        age: 46,
        vstdate: '2026-11-07',
        vsttime: '09:00:00',
        ovstist: '5:บริการสาธารณสุขทางไกล',
        ovstist_export_code: '5',
        authencode: 'AUTH_TEL_01',
        maininscl: 'UCS',
        pttypename: '74:บัตรทอง',
        hospmain: '11152',
        hospsub: '11152',
        department: 'Telemed',
        clinic: 'ตรวจโรคทั่วไป',
        pdx: 'I10',
        income: 150,
        sum_price: 50,
        listname: 'ค่าให้บริการ Telemedicine Project code',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP123',
        compensated: 50,
        fund: 'OP',
        subfund: 'TELMED',
      },
      {
        vn: '691107002',
        cid: '3520800222222',
        hn: '0022222',
        ptname: 'นางสมหญิง มั่นคง',
        sex_code: '2',
        birthday: '1975-05-15',
        age: 51,
        vstdate: '2026-11-06',
        vsttime: '10:30:00',
        ovstist: '1:มาเอง',
        ovstist_export_code: '1',
        authencode: null,
        maininscl: 'OFC',
        pttypename: 'ข้าราชการ',
        hospmain: '11152',
        hospsub: '11152',
        department: 'OPD',
        clinic: 'อายุรกรรม',
        pdx: 'E119',
        income: 300,
        sum_price: 50,
        listname: 'ค่าให้บริการ Telemedicine Project code',
        status: '-:ยังไม่ได้ส่ง',
        rep: null,
        compensated: 0,
        fund: null,
        subfund: null,
      },
    ]

    it('generates report with summary stats and card filters correctly', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ORDER BY icode ASC')) {
          return Promise.resolve([
            { icode: '3002608', name: 'TelMed', strength: '', nhso_adp_code: 'TELMED' },
          ])
        }
        return Promise.resolve(mockRawRows)
      })

      const result = await RcmTelemedDrugService.getTelemedReport(
        {
          ds1: '2026-11-01',
          ds2: '2026-11-07',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.title).toBe('11.53 รายชื่อผู้ได้รับบริการ TelMed')
      expect(result.summary.totalVisits).toBe(2)
      expect(result.summary.uniquePatients).toBe(2)
      expect(result.summary.compensatedVisits).toBe(1)
      expect(result.summary.uncompensatedVisits).toBe(1)
      expect(result.summary.withAuthenCount).toBe(1)
      expect(result.summary.withoutAuthenCount).toBe(1)
      expect(result.summary.ucCount).toBe(1)
      expect(result.summary.exportCode5Count).toBe(1)
      expect(result.summary.totalSumPrice).toBe(100)
      expect(result.items.length).toBe(2)
    })

    it('filters by cardFilter COMPENSATED', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ORDER BY icode ASC')) {
          return Promise.resolve([])
        }
        return Promise.resolve(mockRawRows)
      })

      const result = await RcmTelemedDrugService.getTelemedReport(
        {
          ds1: '2026-11-01',
          ds2: '2026-11-07',
          cardFilter: 'COMPENSATED',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.items.length).toBe(1)
      expect(result.items[0].vn).toBe('691107001')
    })
  })

  describe('getPostalDrugReport', () => {
    const mockRawRows = [
      {
        vn: '691107003',
        cid: '3520800333333',
        hn: '0033333',
        ptname: 'นายประสิทธิ์ มีสุข',
        sex_code: '1',
        birthday: '1960-03-10',
        age: 66,
        vstdate: '2026-11-07',
        vsttime: '14:20:00',
        authencode: 'AUTH_DRUG_01',
        maininscl: 'UCS',
        pttypename: '74:บัตรทอง',
        department: 'ส่งยาให้ที่บ้าน',
        clinic: 'อายุรกรรม',
        pdx: 'I10',
        income: 500,
        sum_price: 50,
        listname: 'ค่าจัดส่งยาทางไปรษณีย์ Health Rider Project code',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP999',
        compensated: 50,
        fund: 'OP',
        subfund: 'DRUGP',
      },
    ]

    it('generates postal drug report correctly', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ORDER BY icode ASC')) {
          return Promise.resolve([
            { icode: '3002958', name: 'Postal Drug', strength: '', nhso_adp_code: 'DRUGP' },
          ])
        }
        return Promise.resolve(mockRawRows)
      })

      const result = await RcmTelemedDrugService.getPostalDrugReport(
        {
          ds1: '2026-11-01',
          ds2: '2026-11-07',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.title).toBe('11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์')
      expect(result.summary.totalVisits).toBe(1)
      expect(result.summary.withPriceCount).toBe(1)
      expect(result.summary.totalSumPrice).toBe(50)
      expect(result.items.length).toBe(1)
      expect(result.items[0].vn).toBe('691107003')
    })
  })
})
