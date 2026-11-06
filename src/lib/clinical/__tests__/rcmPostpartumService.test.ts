import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RcmPostpartumService } from '../rcmPostpartumService'

describe('RcmPostpartumService (Postpartum Funds)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('7.2 การตรวจหลังคลอด ADP 30015', () => {
    it('checks 30015 ADP code mapping correctly when items exist', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '3002461',
          name: 'ตรวจหลังคลอด (Z390-391-392) 30015 Project code',
          strength: '',
          nhso_adp_code: '30015',
        },
      ])

      const res = await RcmPostpartumService.check30015AdpMapping(mockExecutor)
      expect(res.isMapped).toBe(true)
      expect(res.mappedCount).toBe(1)
      expect(res.items[0].icode).toBe('3002461')
      expect(res.items[0].nhso_adp_code).toBe('30015')
    })

    it('handles empty ADP 30015 mapping gracefully', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const res = await RcmPostpartumService.check30015AdpMapping(mockExecutor)
      expect(res.isMapped).toBe(false)
      expect(res.mappedCount).toBe(0)
      expect(res.items).toEqual([])
    })

    it('processes and aggregates 30015 service report with KPIs, filters, and sorting', async () => {
      const mockRows = [
        {
          vn: '691026082902',
          cid: '1640900058814',
          hn: '0003172',
          ptname: 'น.ส.พิมพ์พิไล ชานก',
          age: 34,
          nation: 'ไทย',
          vstdate: '2026-10-26',
          vsttime: '08:29:02',
          authencode: 'AUTH001',
          pttypename: 'บัตรทอง 30บาท ในเขต',
          department: '512 จุดซักประวัติ สูตินารีเวช',
          clinic: 'นรีเวชกรรม',
          pdx: 'Z390',
          dx0: null,
          dx1: null,
          dx2: null,
          dx3: null,
          dx4: null,
          dx5: null,
          op0: null,
          op1: null,
          op2: null,
          op3: null,
          op4: null,
          op5: null,
          listname: 'ตรวจหลังคลอด (Z390-391-392) 30015 Project code',
          listname1: '3002541:ยาTriferdine หลังคลอด',
          status: 'Rep :: มี Rep แล้ว',
          rep: '691000220',
          compensated: 285,
          fund: 'DM22',
          subfund: 'PP_ANC_PNC',
        },
        {
          vn: '691027091500',
          cid: '1640900099999',
          hn: '0004999',
          ptname: 'นางสมพร สุขเกษม',
          age: 28,
          nation: 'ไทย',
          vstdate: '2026-10-27',
          vsttime: '09:15:00',
          authencode: null,
          pttypename: 'ชำระเงินเอง',
          department: '512 จุดซักประวัติ สูตินารีเวช',
          clinic: 'นรีเวชกรรม',
          pdx: 'Z391',
          dx0: null,
          dx1: null,
          dx2: null,
          dx3: null,
          dx4: null,
          dx5: null,
          op0: '8901',
          op1: null,
          op2: null,
          op3: null,
          op4: null,
          op5: null,
          listname: 'ตรวจหลังคลอด (Z390-391-392) 30015 Project code',
          listname1: null,
          status: null,
          rep: null,
          compensated: 0,
          fund: null,
          subfund: null,
        },
      ]

      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ORDER BY icode ASC')) {
          return Promise.resolve([
            { icode: '3002461', name: 'ตรวจหลังคลอด', strength: '', nhso_adp_code: '30015' },
          ])
        }
        return Promise.resolve(mockRows)
      })

      const result = await RcmPostpartumService.getService72Report(
        { ds1: '2026-10-01', ds2: '2026-10-31', refresh: true },
        mockExecutor
      )

      expect(result.summary.totalVisits).toBe(2)
      expect(result.summary.uniquePatients).toBe(2)
      expect(result.summary.compensatedVisits).toBe(1)
      expect(result.summary.uncompensatedVisits).toBe(1)
      expect(result.summary.totalCompensated).toBe(285)
      expect(result.summary.averageCompensated).toBe(285)
      expect(result.summary.compensationRate).toBe(50)
      expect(result.summary.withAuthenCount).toBe(1)
      expect(result.summary.withoutAuthenCount).toBe(1)
      expect(result.summary.withPdxCount).toBe(2)
      expect(result.summary.withOpCount).toBe(1)
      expect(result.items.length).toBe(2)
    })

    it('filters 30015 by COMPENSATED, UNCOMPENSATED, and search queries', async () => {
      const mockRows = [
        {
          vn: '691026082902',
          cid: '1640900058814',
          hn: '0003172',
          ptname: 'น.ส.พิมพ์พิไล ชานก',
          vstdate: '2026-10-26',
          compensated: 285,
          pdx: 'Z390',
        },
        {
          vn: '691027091500',
          cid: '1640900099999',
          hn: '0004999',
          ptname: 'นางสมพร สุขเกษม',
          vstdate: '2026-10-27',
          compensated: 0,
          pdx: 'Z391',
        },
      ]

      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ORDER BY icode ASC')) return Promise.resolve([])
        return Promise.resolve(mockRows)
      })

      const compOnly = await RcmPostpartumService.getService72Report(
        { ds1: '2026-10-01', ds2: '2026-10-31', compensationFilter: 'COMPENSATED', refresh: true },
        mockExecutor
      )
      expect(compOnly.items.length).toBe(1)
      expect(compOnly.items[0].hn).toBe('0003172')

      const searchHn = await RcmPostpartumService.getService72Report(
        { ds1: '2026-10-01', ds2: '2026-10-31', searchField: 'HN', search: '0004999', refresh: true },
        mockExecutor
      )
      expect(searchHn.items.length).toBe(1)
      expect(searchHn.items[0].ptname).toBe('นางสมพร สุขเกษม')
    })
  })

  describe('7.3 การจ่ายยา Triforine ADP 30016', () => {
    it('checks 30016 ADP code mapping correctly when items exist', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        { icode: '1540013', name: 'triferdine(ไตรเฟอร์ดีน)', strength: '0.15+60.18+0.4', nhso_adp_code: '30016' },
        { icode: '3002541', name: 'ยาTriferdine หลังคลอด', strength: '', nhso_adp_code: '30016' },
      ])

      const res = await RcmPostpartumService.check30016AdpMapping(mockExecutor)
      expect(res.isMapped).toBe(true)
      expect(res.mappedCount).toBe(2)
      expect(res.items[0].icode).toBe('1540013')
      expect(res.items[1].name).toBe('ยาTriferdine หลังคลอด')
    })

    it('handles empty ADP code mapping gracefully', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const res = await RcmPostpartumService.check30016AdpMapping(mockExecutor)
      expect(res.isMapped).toBe(false)
      expect(res.mappedCount).toBe(0)
      expect(res.items).toEqual([])
    })

    it('processes and aggregates 30016 service report with KPIs, filters, and sorting', async () => {
      const mockRows = [
        {
          vn: '671002083018',
          cid: '1520800121698',
          hn: '0005401',
          ptname: 'น.ส.สิรินทรา พุทธิหน๋อย',
          age: 28,
          nation: 'ไทย',
          vstdate: '2024-10-02',
          vsttime: '08:30:18',
          authencode: 'AUTH001',
          pttypename: 'บัตรอนามัยมารดา',
          department: '512 จุดซักประวัติ สูตินารีเวช',
          clinic: 'สูติกรรม',
          pdx: 'Z392',
          dx0: null,
          dx1: null,
          dx2: null,
          dx3: null,
          dx4: null,
          dx5: null,
          op0: null,
          op1: null,
          op2: null,
          op3: null,
          op4: null,
          op5: null,
          listname: 'triferdine(ไตรเฟอร์ดีน) 0.15+60.18+0.4',
          listname1: '3000009:Albumin',
          status: 'NHSO :: มี Invoice แล้ว',
          rep: '671000033',
          compensated: 360,
          fund: 'DM14',
          subfund: 'PNC',
        },
        {
          vn: '671002083019',
          cid: '1520800999999',
          hn: '0005402',
          ptname: 'นางสมหญิง ทดสอบ',
          age: 32,
          nation: 'ไทย',
          vstdate: '2024-10-03',
          vsttime: '09:15:00',
          authencode: null,
          pttypename: 'จ่ายเงินเอง',
          department: '512 จุดซักประวัติ สูตินารีเวช',
          clinic: 'สูติกรรม',
          pdx: 'Z391',
          dx0: null,
          dx1: null,
          dx2: null,
          dx3: null,
          dx4: null,
          dx5: null,
          op0: '9929',
          op1: null,
          op2: null,
          op3: null,
          op4: null,
          op5: null,
          listname: 'triferdine(ไตรเฟอร์ดีน) 0.15+60.18+0.4',
          listname1: null,
          status: null,
          rep: null,
          compensated: 0,
          fund: null,
          subfund: null,
        },
      ]

      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ORDER BY icode ASC')) {
          return Promise.resolve([
            { icode: '1540013', name: 'triferdine', strength: '0.15', nhso_adp_code: '30016' },
          ])
        }
        return Promise.resolve(mockRows)
      })

      const result = await RcmPostpartumService.getService30016Report(
        {
          startDate: '2024-10-01',
          endDate: '2024-10-31',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.summary.totalVisits).toBe(2)
      expect(result.summary.uniquePatients).toBe(2)
      expect(result.summary.compensatedVisits).toBe(1)
      expect(result.summary.uncompensatedVisits).toBe(1)
      expect(result.summary.totalCompensated).toBe(360)
      expect(result.summary.compensationRate).toBe(50)
      expect(result.summary.withAuthenCount).toBe(1)
      expect(result.summary.withoutAuthenCount).toBe(1)
      expect(result.summary.withPdxCount).toBe(2)
      expect(result.summary.withOpCount).toBe(1)
      expect(result.items.length).toBe(2)
    })

    it('filters 30016 by COMPENSATED, UNCOMPENSATED, and search queries', async () => {
      const mockRows = [
        {
          vn: '671002083018',
          cid: '1520800121698',
          hn: '0005401',
          ptname: 'น.ส.สิรินทรา พุทธิหน๋อย',
          vstdate: '2024-10-02',
          compensated: 360,
          pdx: 'Z392',
        },
        {
          vn: '671002083019',
          cid: '1520800999999',
          hn: '0005402',
          ptname: 'นางสมหญิง ทดสอบ',
          vstdate: '2024-10-03',
          compensated: 0,
          pdx: 'Z391',
        },
      ]

      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ORDER BY icode ASC')) return Promise.resolve([])
        return Promise.resolve(mockRows)
      })

      const compensatedOnly = await RcmPostpartumService.getService30016Report(
        {
          startDate: '2024-10-01',
          endDate: '2024-10-31',
          compensationFilter: 'COMPENSATED',
          refresh: true,
        },
        mockExecutor
      )
      expect(compensatedOnly.items.length).toBe(1)
      expect(compensatedOnly.items[0].hn).toBe('0005401')

      const searchHn = await RcmPostpartumService.getService30016Report(
        {
          startDate: '2024-10-01',
          endDate: '2024-10-31',
          searchField: 'HN',
          search: '0005402',
          refresh: true,
        },
        mockExecutor
      )
      expect(searchHn.items.length).toBe(1)
      expect(searchHn.items[0].ptname).toBe('นางสมหญิง ทดสอบ')
    })
  })
})
