import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RcmDashboardService } from '../rcmDashboardService'

vi.mock('@/lib/cache', () => ({
  getCachedData: vi.fn((key: string, fetcher: () => Promise<any>) => fetcher()),
}))

describe('RcmDashboardService.getPalliativeCareReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockRows = [
    {
      vn: '681010105235',
      cid: '3520800553276',
      hn: '0000063',
      ptname: 'นายธวัชชัย คำมา',
      vstdate: '2025-10-10',
      authencode: 'AUTH123',
      pttype: '10',
      inscl: 'UCS',
      pttypename: 'บัตรทอง ผู้พิการ ในเขต',
      address: '90 ม.06',
      tel: '0980012795',
      cc: 'มาตรวจตามนัด',
      room: 'ห้องตรวจ 1',
      spclty: 'ปฐมภูมิ',
      Diag: 'B24,Z016',
      Oper: '8744',
      Z515: 'Y',
      Dx: 'Y',
      Z718: 'Y',
      Cancer: 'N',
      Drug: 'N',
      death: 'N',
      death_date: null,
      OK: 'Y',
      compensated: 5000,
      rep_invoice: '620800048#189340934',
      eclaim_no: 'A0000031663#266284101',
      senddate: '25640802',
      status_Eclaim: '4 :: ผ่านการตรวจสอบจาก สปสช.(A)',
      filename_send: 'eclaim_11152_OP_APPEAL_CD_25640802_151746.ecd',
    },
    {
      vn: '681010105236',
      cid: '3520800123456',
      hn: '0000064',
      ptname: 'นางสมใจ สบายดี',
      vstdate: '2025-10-11',
      authencode: '',
      pttype: '01',
      inscl: 'OFC',
      pttypename: 'ข้าราชการ',
      address: '12 ม.01',
      tel: '0812345678',
      cc: 'ปวดหลังเรื้อรัง',
      room: 'ห้องตรวจ 2',
      spclty: 'อายุรกรรม',
      Diag: 'C180,D022',
      Oper: '',
      Z515: '',
      Dx: 'Y',
      Z718: '',
      Cancer: 'Y',
      Drug: 'Y',
      death: 'Y',
      death_date: '2025-10-15',
      OK: ' ',
      compensated: 0,
      rep_invoice: '',
      eclaim_no: '',
      senddate: null,
      status_Eclaim: '- :: ยังไม่ได้ส่ง',
      filename_send: '',
    },
    {
      vn: '681010105237',
      cid: '3520800999999',
      hn: '0000065',
      ptname: 'นายฟอกไต พิเศษ',
      vstdate: '2025-10-12',
      authencode: '',
      pttype: 'H1', // Excluded pttype
      inscl: 'UCS',
      pttypename: 'ฟอกไตสิทธิ์ บัตรทอง',
      address: '99 ม.09',
      tel: '0899999999',
      cc: 'ฟอกไต',
      room: 'ห้องฟอกไต',
      spclty: 'อายุรกรรม',
      Diag: 'N185',
      Oper: '',
      Z515: 'Y',
      Dx: 'Y',
      Z718: '',
      Cancer: '',
      Drug: '',
      death: 'N',
      death_date: null,
      OK: ' ',
      compensated: 0,
      rep_invoice: '',
      eclaim_no: '',
      senddate: null,
      status_Eclaim: '- :: ยังไม่ได้ส่ง',
      filename_send: '',
    },
  ]

  it('filters out excluded pttypes (H1, 35, 36) and calculates summary', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const result = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false },
      mockExecutor
    )

    expect(mockExecutor).toHaveBeenCalledTimes(1)
    // Row 3 with H1 should be excluded
    expect(result.items.length).toBe(2)
    expect(result.items.some((i) => i.pttype === 'H1')).toBe(false)
    expect(result.summary.totalVisits).toBe(2)
    expect(result.summary.totalPatients).toBe(2)
    expect(result.summary.paidCount).toBe(1)
    expect(result.summary.totalCompensated).toBe(5000)
    expect(result.summary.hasZ515Count).toBe(1)
    expect(result.summary.missingZ515Count).toBe(1)
    expect(result.summary.deceasedCount).toBe(1)

    // First item
    expect(result.items[0].pttype).toBe('10')
    expect(result.items[0].pttypename).toBe('บัตรทอง ผู้พิการ ในเขต')
    expect(result.items[0].error_name).toBe('')
    expect(result.items[0].senddate).toBe('2564-08-02')
    expect(result.items[0].ok).toBe('Y')
  })

  it('defaults to ucOnly=true and filters UCS only', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const result = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31' }, // ucOnly not specified -> defaults to true
      mockExecutor
    )

    expect(result.items.length).toBe(1)
    expect(result.items[0].inscl).toBe('UCS')
    expect(result.items[0].hn).toBe('0000063')
    expect(result.summary.totalVisits).toBe(1)
  })

  it('filters by Chronic correctly (Z718=Y and Dx=Y)', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const result = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, filterType: 'Chronic' },
      mockExecutor
    )

    expect(result.items.length).toBe(1)
    expect(result.items[0].hn).toBe('0000063')
    expect(result.items[0].z718).toBe('Y')
    expect(result.items[0].dx).toBe('Y')
  })

  it('filters by Opioid correctly (Cancer=Y and Drug=Y)', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const result = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, filterType: 'Opioid' },
      mockExecutor
    )

    expect(result.items.length).toBe(1)
    expect(result.items[0].hn).toBe('0000064')
    expect(result.items[0].cancer).toBe('Y')
    expect(result.items[0].drug).toBe('Y')
  })

  it('filters rows that have rep_invoice when hasRepInvoice is true', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const result = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, hasRepInvoice: true },
      mockExecutor
    )

    expect(result.items.length).toBe(1)
    expect(result.items[0].hn).toBe('0000063')
    expect(result.items[0].rep_invoice).toBe('620800048#189340934')
    expect(result.hasRepInvoice).toBe(true)
    expect(result.summary.totalVisits).toBe(1)
  })

  it('filters by multiple compensated amounts and includes availableCompensations', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    // Row 1 has compensated: 5000, Row 2 has 0
    const result = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, compensated: [5000] },
      mockExecutor
    )

    expect(result.items.length).toBe(1)
    expect(result.items[0].hn).toBe('0000063')
    expect(result.items[0].compensated).toBe(5000)
    expect(result.summary.totalCompensated).toBe(5000)
    expect(result.availableCompensations).toContain(1000)
    expect(result.availableCompensations).toContain(5000)
    expect(result.availableCompensations).toContain(9000)

    // Test with non-matching compensation
    const noMatchResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, compensated: '1000,2000' },
      mockExecutor
    )
    expect(noMatchResult.items.length).toBe(0)
    expect(noMatchResult.summary.totalVisits).toBe(0)
    expect(noMatchResult.summary.totalCompensated).toBe(0)
  })

  it('filters by deathStatus Y and N properly', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    // Filter deathStatus: 'Y' -> only row 2 (สมใจ สบายดี)
    const deathYResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, deathStatus: 'Y' },
      mockExecutor
    )
    expect(deathYResult.items.length).toBe(1)
    expect(deathYResult.items[0].hn).toBe('0000064')
    expect(deathYResult.items[0].death).toBe('Y')
    expect(deathYResult.deathStatus).toBe('Y')

    // Filter deathStatus: 'N' -> only row 1 (ธวัชชัย)
    const deathNResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, deathStatus: 'N' },
      mockExecutor
    )
    expect(deathNResult.items.length).toBe(1)
    expect(deathNResult.items[0].hn).toBe('0000063')
    expect(deathNResult.items[0].death).toBe('N')
    expect(deathNResult.deathStatus).toBe('N')
  })

  it('filters by paidStatus PAID and UNPAID properly', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    // Filter paidStatus: 'PAID' -> only row 1 (ธวัชชัย, ok: 'Y', compensated: 5000)
    const paidResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, paidStatus: 'PAID' },
      mockExecutor
    )
    expect(paidResult.items.length).toBe(1)
    expect(paidResult.items[0].hn).toBe('0000063')
    expect(paidResult.items[0].ok).toBe('Y')
    expect(paidResult.paidStatus).toBe('PAID')

    // Filter paidStatus: 'UNPAID' -> only row 2 (สมใจ, ok: ' ', compensated: 0)
    const unpaidResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, paidStatus: 'UNPAID' },
      mockExecutor
    )
    expect(unpaidResult.items.length).toBe(1)
    expect(unpaidResult.items[0].hn).toBe('0000064')
    expect(unpaidResult.items[0].ok).toBe('')
    expect(unpaidResult.paidStatus).toBe('UNPAID')
  })

  it('filters by compensated expressions (>=, >, =, 0, array) properly', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    // Filter compensated: '>=750' -> matches row 1 (5000 >= 750)
    const geResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, compensated: '>=750' },
      mockExecutor
    )
    expect(geResult.items.length).toBe(1)
    expect(geResult.items[0].hn).toBe('0000063')
    expect(geResult.items[0].compensated).toBe(5000)

    // Filter compensated: '>9000' -> no match
    const gtResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, compensated: '>9000' },
      mockExecutor
    )
    expect(gtResult.items.length).toBe(0)

    // Filter compensated: '=5000' -> matches row 1
    const eqResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, compensated: '=5000' },
      mockExecutor
    )
    expect(eqResult.items.length).toBe(1)
    expect(eqResult.items[0].compensated).toBe(5000)

    // Filter compensated: '0' -> matches row 2 (0)
    const zeroResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, compensated: '0' },
      mockExecutor
    )
    expect(zeroResult.items.length).toBe(1)
    expect(zeroResult.items[0].compensated).toBe(0)

    // Filter compensated: [5000] -> matches row 1
    const arrResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, compensated: [5000] },
      mockExecutor
    )
    expect(arrResult.items.length).toBe(1)
    expect(arrResult.items[0].compensated).toBe(5000)
  })

  it('filters by hn substring properly', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    // Filter hn: '63' -> matches row 1 (hn: '0000063')
    const result = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, hn: '63' },
      mockExecutor
    )
    expect(result.items.length).toBe(1)
    expect(result.items[0].hn).toBe('0000063')
    expect(result.hn).toBe('63')
  })

  it('handles empty database result gracefully', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([])

    const result = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31' },
      mockExecutor
    )

    expect(result.items.length).toBe(0)
    expect(result.summary.totalVisits).toBe(0)
    expect(result.summary.totalPatients).toBe(0)
    expect(result.summary.totalCompensated).toBe(0)
  })

  it('filters by z515Status Y and N properly', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    // Filter z515Status: 'Y' -> only row 1 (ธวัชชัย)
    const z515YResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, z515Status: 'Y' },
      mockExecutor
    )
    expect(z515YResult.items.length).toBe(1)
    expect(z515YResult.items[0].hn).toBe('0000063')
    expect(z515YResult.items[0].z515).toBe('Y')
    expect(z515YResult.z515Status).toBe('Y')

    // Filter z515Status: 'N' -> only row 2 (สมใจ, z515 is empty)
    const z515NResult = await RcmDashboardService.getPalliativeCareReport(
      { ds1: '2025-10-01', ds2: '2025-10-31', ucOnly: false, z515Status: 'N' },
      mockExecutor
    )
    expect(z515NResult.items.length).toBe(1)
    expect(z515NResult.items[0].hn).toBe('0000064')
    expect(z515NResult.items[0].z515).toBe('')
    expect(z515NResult.z515Status).toBe('N')
  })
})
