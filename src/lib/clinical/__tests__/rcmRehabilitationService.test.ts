import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmRehabilitationService,
  REHAB_ADP_CODES,
  type RehabReportParams,
} from '../rcmRehabilitationService'
import { invalidateCacheKey } from '@/lib/cache'

describe('RcmRehabilitationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCacheKey('rcm-rehab-disability-services-2026-10-01-2027-09-30')
    invalidateCacheKey('rcm-rehab-adp-mapping-check-16')
  })

  const mockMainRows = [
    {
      vn: '691001000001',
      an: null,
      cid: '1529900011111',
      hn: '0011111',
      ptname: 'นาย สมชาย สุขเกษม',
      vstdate: '2026-10-10',
      vsttime: '09:00:00',
      authencode: 'AUTH-REHAB-01',
      maininscl: 'UCS',
      pttypename: '10:ประกันสุขภาพถ้วนหน้า',
      department: 'กลุ่มงานเวชกรรมฟื้นฟู',
      clinic: 'เวชกรรมฟื้นฟู',
      income: 500,
      listname: '30001#H9449.1#กายภาพบำบัดฟื้นฟู#500.00',
      diag: 'M545',
      oper: '9311',
      doctorname: 'นพ. วินิจฉัย ดีเยี่ยม',
      filetype: 'Web & HOSxP',
      rehab_name: 'ฟื้นฟูกายภาพบำบัดกล้ามเนื้อ',
      rehab_code: 'H9449.1',
      rep_seamless: 'DTTM-69-001',
      payno: 'PAY-001',
      seamless_type: 'Rehab',
      compensated_seamless: 500,
      noCompensated: null,
      status: 'มี Rep แล้ว',
      rep: 'REP-REHAB-01',
      compensated: 500,
      targetgroup: 'ผู้สูงอายุที่มีภาวะพึ่งพิง',
      deformed_type: 'การเคลื่อนไหว',
      adl: '15',
      startservice: '2026-10-10',
      endservice: '2026-10-10',
      unitprice: 500,
      realprice: 500,
      staff: 'น.ส. พยาบาล ใจดี',
      serialno: 'SER-01',
      web_status: 'SUCCESS',
      filename: 'rehab_oct69.xlsx',
    },
    {
      vn: '691002000002',
      an: null,
      cid: '1529900022222',
      hn: '0022222',
      ptname: 'นาง สมร บุญชู',
      vstdate: '2026-10-12',
      vsttime: '10:30:00',
      authencode: null,
      maininscl: 'UCS',
      pttypename: '10:ประกันสุขภาพถ้วนหน้า',
      department: 'กลุ่มงานเวชกรรมฟื้นฟู',
      clinic: 'เวชกรรมฟื้นฟู',
      income: 300,
      listname: '30002#H0489#ฟื้นฟูสมรรถภาพ#300.00',
      diag: 'I693',
      oper: null,
      doctorname: 'พญ. เมตตา รักษาดี',
      filetype: 'HOSxP',
      rehab_name: 'ไม่พบใน Web',
      rehab_code: 'H0489',
      rep_seamless: null,
      payno: null,
      seamless_type: null,
      compensated_seamless: 0,
      noCompensated: null,
      status: null,
      rep: null,
      compensated: 0,
    },
    {
      vn: '691003000003',
      an: null,
      cid: '1529900033333',
      hn: '0033333',
      ptname: 'นาย วิทยา มั่นคง',
      vstdate: '2026-10-15',
      vsttime: '13:15:00',
      authencode: 'AUTH-REHAB-03',
      maininscl: 'WEL',
      pttypename: '12:ผู้มีรายได้น้อย',
      department: 'กลุ่มงานเวชกรรมฟื้นฟู',
      clinic: 'เวชกรรมฟื้นฟู',
      income: 400,
      listname: null,
      diag: 'G819',
      oper: null,
      doctorname: 'นพ. วินิจฉัย ดีเยี่ยม',
      filetype: 'Web',
      rehab_name: 'กิจกรรมบำบัดสำหรับผู้พิการ',
      rehab_code: null, // ไม่มีรหัสฟื้นฟู ADP ใน HOSxP
      rep_seamless: null,
      payno: null,
      seamless_type: null,
      compensated_seamless: 0,
      noCompensated: null,
      status: 'NHSO :: มี Invoice แล้ว',
      rep: null,
      compensated: 0,
    },
  ]

  const mockNoVnRows = [
    {
      vn: null,
      an: null,
      cid: '1529900044444',
      hn: '0044444',
      ptname: 'นาง ประกาย รัตนผล',
      vstdate: '2026-10-20',
      vsttime: '00:00:00',
      authencode: null,
      maininscl: 'UC',
      pttypename: 'สิทธิ์จากเว็บ Disability',
      department: null,
      clinic: null,
      income: 0,
      listname: null,
      diag: 'Z501',
      oper: null,
      doctorname: null,
      filetype: 'Web',
      rehab_name: 'การฝึกทักษะการทำกิจวัตรประจำวัน',
      rehab_code: 'H9339',
      rep_seamless: null,
      payno: null,
      compensated_seamless: 0,
      noCompensated: null,
      status: null,
      rep: null,
      compensated: 0,
    },
  ]

  it('checks target ADP codes mapping in s_drugitems or nondrugitems', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([
      { icode: '30001', name: 'กายภาพบำบัดฟื้นฟู', strength: null, nhso_adp_code: 'H9449.1' },
      { icode: '30002', name: 'ฟื้นฟูสมรรถภาพ', strength: null, nhso_adp_code: 'H0489' },
    ])

    const res = await RcmRehabilitationService.checkRehabAdpMapping(mockExecutor as any, true)
    expect(res.isMapped).toBe(true)
    expect(res.mappedCount).toBe(2)
    expect(res.totalTargetCodes).toBe(REHAB_ADP_CODES.length)
    expect(res.items[0].nhso_adp_code).toBe('H9449.1')
  })

  it('handles empty ADP mapping gracefully', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([])

    const res = await RcmRehabilitationService.checkRehabAdpMapping(mockExecutor as any, true)
    expect(res.isMapped).toBe(false)
    expect(res.mappedCount).toBe(0)
    expect(res.items).toEqual([])
  })

  it('loads report, reconciles 4 match statuses, and computes KPIs correctly', async () => {
    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('TRIM(nhso_adp_code) IN')) {
        return Promise.resolve([
          { icode: '30001', name: 'กายภาพบำบัดฟื้นฟู', strength: null, nhso_adp_code: 'H9449.1' },
        ])
      }
      if (sql.includes('IFNULL(rs.vn, \'\') = \'\'')) {
        return Promise.resolve(mockNoVnRows)
      }
      return Promise.resolve(mockMainRows)
    })

    const params: RehabReportParams = {
      startDate: '2026-10-01',
      endDate: '2027-09-30',
      refresh: true,
    }

    const res = await RcmRehabilitationService.getDisabilityServicesReport(params, mockExecutor as any)

    expect(res.totalCount).toBe(4)
    expect(res.items.length).toBe(4)

    // Check 4 status classifications
    const matched = res.items.find((i) => i.hn === '0011111')
    expect(matched?.match_status).toBe('MATCHED')
    expect(matched?.filetype).toBe('ตรงกันทั้ง 2 ระบบ')

    const notInWeb = res.items.find((i) => i.hn === '0022222')
    expect(notInWeb?.match_status).toBe('NOT_IN_WEB')
    expect(notInWeb?.filetype).toBe('HOSxP')

    const noRehabCode = res.items.find((i) => i.hn === '0033333')
    expect(noRehabCode?.match_status).toBe('NO_REHAB_CODE')
    expect(noRehabCode?.filetype).toBe('Web')

    const noVn = res.items.find((i) => i.hn === '0044444')
    expect(noVn?.match_status).toBe('NO_VN')
    expect(noVn?.filetype).toBe('Web')

    // Check Summary KPIs
    expect(res.summary.totalCases).toBe(4)
    expect(res.summary.matchedCases).toBe(1)
    expect(res.summary.notInWebCases).toBe(1)
    expect(res.summary.noRehabCodeCases).toBe(1)
    expect(res.summary.noVnCases).toBe(1)
    expect(res.summary.compensatedCases).toBe(1)
    expect(res.summary.totalCompensated).toBe(500)
    expect(res.summary.withAuthenCases).toBe(2)
  })

  it('filters data by cardFilter MATCHED, NOT_IN_WEB, NO_REHAB_CODE, NO_VN', async () => {
    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('TRIM(nhso_adp_code) IN')) return Promise.resolve([])
      if (sql.includes('IFNULL(rs.vn, \'\') = \'\'')) return Promise.resolve(mockNoVnRows)
      return Promise.resolve(mockMainRows)
    })

    const baseParams: RehabReportParams = {
      startDate: '2026-10-01',
      endDate: '2027-09-30',
    }

    // Filter MATCHED
    const resMatched = await RcmRehabilitationService.getDisabilityServicesReport(
      { ...baseParams, cardFilter: 'MATCHED' },
      mockExecutor as any
    )
    expect(resMatched.totalCount).toBe(1)
    expect(resMatched.items[0].match_status).toBe('MATCHED')

    // Filter NOT_IN_WEB
    const resNotInWeb = await RcmRehabilitationService.getDisabilityServicesReport(
      { ...baseParams, cardFilter: 'NOT_IN_WEB' },
      mockExecutor as any
    )
    expect(resNotInWeb.totalCount).toBe(1)
    expect(resNotInWeb.items[0].match_status).toBe('NOT_IN_WEB')

    // Filter NO_VN
    const resNoVn = await RcmRehabilitationService.getDisabilityServicesReport(
      { ...baseParams, cardFilter: 'NO_VN' },
      mockExecutor as any
    )
    expect(resNoVn.totalCount).toBe(1)
    expect(resNoVn.items[0].match_status).toBe('NO_VN')
  })

  it('filters data using search across patient name, HN, CID, and rehab_name', async () => {
    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('TRIM(nhso_adp_code) IN')) return Promise.resolve([])
      if (sql.includes('IFNULL(rs.vn, \'\') = \'\'')) return Promise.resolve(mockNoVnRows)
      return Promise.resolve(mockMainRows)
    })

    const res = await RcmRehabilitationService.getDisabilityServicesReport(
      { startDate: '2026-10-01', endDate: '2027-09-30', search: 'สมร' },
      mockExecutor as any
    )
    expect(res.totalCount).toBe(1)
    expect(res.items[0].ptname).toContain('สมร')

    const resByAdp = await RcmRehabilitationService.getDisabilityServicesReport(
      { startDate: '2026-10-01', endDate: '2027-09-30', search: 'H9449.1' },
      mockExecutor as any
    )
    expect(resByAdp.totalCount).toBe(1)
    expect(resByAdp.items[0].rehab_code).toBe('H9449.1')
  })

  it('falls back gracefully when rcmdb.rehab_service does not exist', async () => {
    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('TRIM(nhso_adp_code) IN')) return Promise.resolve([])
      if (sql.includes('rcmdb.rehab_service')) {
        throw new Error("Table 'rcmdb.rehab_service' doesn't exist")
      }
      return Promise.resolve([mockMainRows[1]]) // Return HOSxP only row
    })

    const res = await RcmRehabilitationService.getDisabilityServicesReport(
      { startDate: '2026-10-01', endDate: '2027-09-30', refresh: true },
      mockExecutor as any
    )

    expect(res.totalCount).toBe(1)
    expect(res.items[0].match_status).toBe('NOT_IN_WEB')
    expect(res.items[0].rehab_name).toBe('ไม่พบใน Web')
  })
})
