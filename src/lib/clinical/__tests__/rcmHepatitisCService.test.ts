import { describe, it, expect, vi } from 'vitest'
import {
  RcmHepatitisCService,
  isUniversalCoverageScheme,
} from '../rcmHepatitisCService'

describe('RcmHepatitisCService', () => {
  describe('isUniversalCoverageScheme', () => {
    it('returns true for UCS / WEL / UC in maininscl', () => {
      expect(isUniversalCoverageScheme('UCS', '')).toBe(true)
      expect(isUniversalCoverageScheme('WEL', '')).toBe(true)
      expect(isUniversalCoverageScheme('UC', '')).toBe(true)
      expect(isUniversalCoverageScheme(' ucs ', '')).toBe(true)
    })

    it('returns true for Thai pttypename with บัตรทอง or ประกันสุขภาพถ้วนหน้า', () => {
      expect(isUniversalCoverageScheme(null, 'สิทธิประกันสุขภาพถ้วนหน้า')).toBe(true)
      expect(isUniversalCoverageScheme(null, 'บัตรทอง (ท.74)')).toBe(true)
      expect(isUniversalCoverageScheme(null, '30 บาทรักษาทุกโรค')).toBe(true)
    })

    it('returns false for non-UC schemes', () => {
      expect(isUniversalCoverageScheme('OFC', 'ข้าราชการ กรมบัญชีกลาง')).toBe(false)
      expect(isUniversalCoverageScheme('SSS', 'ประกันสังคม')).toBe(false)
      expect(isUniversalCoverageScheme(null, null)).toBe(false)
    })
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped = true when s_drugitems contains ADP 36333', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '1590001',
          name: 'HCV RNA Viral Load (36333)',
          strength: null,
          nhso_adp_code: '36333',
        },
      ])

      const result = await RcmHepatitisCService.checkAdpMapping('36333', mockExecutor, true)
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].icode).toBe('1590001')
    })

    it('returns isMapped = false when no rows match', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const result = await RcmHepatitisCService.checkAdpMapping('36333', mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
    })

    it('handles database errors gracefully and returns isMapped = false', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('DB Timeout'))

      const result = await RcmHepatitisCService.checkAdpMapping('36333', mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
    })
  })

  describe('getHepatitisCReport', () => {
    const sampleDbRows = [
      {
        vn: '691001083000',
        cid: '1529900123456',
        hn: '0012345',
        ptname: 'นายสมชาย ใจดี',
        sex_code: '1',
        age: 45,
        vstdate: '2026-10-01',
        vsttime: '08:30:00',
        authencode: 'AUTH123456',
        maininscl: 'UCS',
        pttypename: 'บัตรทอง',
        cc: 'มาตรวจติดตามผลตับอักเสบซี',
        department: 'OPD ทั่วไป',
        clinic: 'อายุรกรรม',
        pdx: 'B182',
        dx0: 'Z711',
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
        income: 1800,
        labresult: 'Detected 1,500,000 IU/mL',
        listname: 'HCV RNA Quantitative',
        listname1: 'ค่าบริการตรวจทางห้องปฏิบัติการ',
        status: 'Rep :: มี Rep แล้ว',
        rep: 'REP-HCV-001',
        compensated: 1600,
        agency: 'NHSO',
        fund: 'กองทุนเฉพาะ',
        subfund: 'Hepatitis C',
        errorcode: null,
        transactiontype: null,
        status_sm: 'ชดเชยแล้ว',
        rep_sm: 'SM-69-001',
        compensated_sm: 1600,
        address: '123 ม.1 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
        mobile: '0812345678',
        tel: '054123456',
      },
      {
        vn: '691002094500',
        cid: '1529900987654',
        hn: '0067890',
        ptname: 'นางสมศรี มีสุข',
        sex_code: '2',
        age: 52,
        vstdate: '2026-10-02',
        vsttime: '09:45:00',
        authencode: null,
        maininscl: 'OFC',
        pttypename: 'ข้าราชการ',
        cc: 'ตรวจสุขภาพประจำปี',
        department: 'OPD ทั่วไป',
        clinic: 'อายุรกรรม',
        pdx: 'B182',
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
        income: 1800,
        labresult: 'Not Detected',
        listname: 'HCV RNA Quantitative',
        listname1: null,
        status: '-::ยังไม่ได้ส่ง',
        rep: null,
        compensated: 0,
        agency: null,
        fund: null,
        subfund: null,
        errorcode: null,
        transactiontype: null,
        status_sm: null,
        rep_sm: null,
        compensated_sm: 0,
        address: '45/2 ม.3 ต.แม่ปะ อ.เถิน จ.ลำปาง',
        mobile: '0898765432',
        tel: null,
      },
      {
        vn: '691003112000',
        cid: '1529900555666',
        hn: '0011223',
        ptname: 'นายประสิทธิ์ มั่นคง',
        sex_code: '1',
        age: 38,
        vstdate: '2026-10-03',
        vsttime: '11:20:00',
        authencode: 'AUTH999888',
        maininscl: 'WEL',
        pttypename: 'บัตรทอง ผู้มีรายได้น้อย',
        cc: 'เจาะเลือดตรวจยืนยัน HCV RNA',
        department: 'OPD ทั่วไป',
        clinic: 'อายุรกรรม',
        pdx: 'B182',
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
        income: 1800,
        labresult: null, // ยังไม่มีผล lab
        listname: 'HCV RNA Quantitative',
        listname1: null,
        status: 'NHSO :: มี Invoice แล้ว',
        rep: 'INV-69-100',
        compensated: 1600,
        agency: 'NHSO',
        fund: 'กองทุนเฉพาะ',
        subfund: 'Hepatitis C',
        errorcode: null,
        transactiontype: null,
        status_sm: null,
        rep_sm: null,
        compensated_sm: 0,
        address: '99 ม.5 ต.เถินบุรี อ.เถิน จ.ลำปาง',
        mobile: null,
        tel: '054999888',
      },
    ]

    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM s_drugitems WHERE TRIM(nhso_adp_code)')) {
        return [
          {
            icode: '1590001',
            name: 'HCV RNA Viral Load (36333)',
            strength: null,
            nhso_adp_code: '36333',
          },
        ]
      }
      return sampleDbRows
    })

    it('generates report with correct summary KPIs and items', async () => {
      const res = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          refresh: true,
        },
        mockExecutor
      )

      expect(res.title).toBe('23.4 ตรวจยืนยันไวรัสตับ C HCV RNA')
      expect(res.adpCode).toBe('36333')
      expect(res.summary.totalVisits).toBe(3)
      expect(res.summary.uniquePatients).toBe(3)
      expect(res.summary.compensatedVisits).toBe(2) // row 1 (1600) + row 3 (1600)
      expect(res.summary.uncompensatedVisits).toBe(1) // row 2
      expect(res.summary.totalCompensated).toBe(3200)
      expect(res.summary.withAuthenCount).toBe(2) // row 1, row 3
      expect(res.summary.withoutAuthenCount).toBe(1) // row 2
      expect(res.summary.ucCount).toBe(2) // row 1 (UCS), row 3 (WEL)
      expect(res.summary.withLabCount).toBe(2) // row 1, row 2
      expect(res.summary.seamlessCount).toBe(1) // row 1
      expect(res.summary.totalSeamlessCompensated).toBe(1600)
      expect(res.items.length).toBe(3)
    })

    it('filters correctly by cardFilter: COMPENSATED', async () => {
      const res = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          cardFilter: 'COMPENSATED',
          refresh: true,
        },
        mockExecutor
      )

      expect(res.totalCount).toBe(2)
      expect(res.items.map((i) => i.vn)).toEqual(['691003112000', '691001083000'])
    })

    it('filters correctly by cardFilter: UNCOMPENSATED', async () => {
      const res = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          cardFilter: 'UNCOMPENSATED',
          refresh: true,
        },
        mockExecutor
      )

      expect(res.totalCount).toBe(1)
      expect(res.items[0].vn).toBe('691002094500')
    })

    it('filters correctly by cardFilter: WITH_AUTHEN and NO_AUTHEN', async () => {
      const authenRes = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          cardFilter: 'WITH_AUTHEN',
          refresh: true,
        },
        mockExecutor
      )
      expect(authenRes.totalCount).toBe(2)

      const noAuthenRes = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          cardFilter: 'NO_AUTHEN',
          refresh: true,
        },
        mockExecutor
      )
      expect(noAuthenRes.totalCount).toBe(1)
      expect(noAuthenRes.items[0].vn).toBe('691002094500')
    })

    it('filters correctly by cardFilter: WITH_LAB', async () => {
      const res = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          cardFilter: 'WITH_LAB',
          refresh: true,
        },
        mockExecutor
      )

      expect(res.totalCount).toBe(2)
      expect(res.items.map((i) => i.vn)).toEqual(['691002094500', '691001083000'])
    })

    it('filters correctly by cardFilter: SEAMLESS', async () => {
      const res = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          cardFilter: 'SEAMLESS',
          refresh: true,
        },
        mockExecutor
      )

      expect(res.totalCount).toBe(1)
      expect(res.items[0].vn).toBe('691001083000')
    })

    it('searches globally across patient name, CID, HN, and Lab result', async () => {
      const searchByName = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          search: 'สมศรี',
          refresh: true,
        },
        mockExecutor
      )
      expect(searchByName.totalCount).toBe(1)
      expect(searchByName.items[0].hn).toBe('0067890')

      const searchByLab = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          search: 'Detected',
          refresh: true,
        },
        mockExecutor
      )
      expect(searchByLab.totalCount).toBe(2) // 'Detected' and 'Not Detected'
    })

    it('supports pagination and exportAll', async () => {
      const page1 = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          page: 1,
          pageSize: 2,
          refresh: true,
        },
        mockExecutor
      )
      expect(page1.items.length).toBe(2)
      expect(page1.totalPages).toBe(2)

      const exportRes = await RcmHepatitisCService.getHepatitisCReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          adpCode: '36333',
          exportAll: true,
          refresh: true,
        },
        mockExecutor
      )
      expect(exportRes.items.length).toBe(3)
    })
  })
})
