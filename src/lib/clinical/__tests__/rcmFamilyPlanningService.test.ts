import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmFamilyPlanningService,
  getAdpCodeForReport,
  getReportTitle,
} from '../rcmFamilyPlanningService'

describe('RcmFamilyPlanningService Domain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves correct ADP code and title for 9.3.1 and 9.3.2', () => {
    expect(getAdpCodeForReport('9.3.1')).toBe('FP002_1')
    expect(getAdpCodeForReport('9.3.2')).toBe('FP002_2')
    expect(getReportTitle('9.3.1')).toContain('9.3.1 รายการฝังยาคุม')
    expect(getReportTitle('9.3.2')).toContain('9.3.2 รายการถอดยาคุม')
  })

  it('checks ADP mapping in s_drugitems correctly', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([
      {
        icode: '1500001',
        name: 'Implanon NXT',
        strength: '68 mg',
        nhso_adp_code: 'FP002_1',
      },
    ])

    const res = await RcmFamilyPlanningService.checkFamilyPlanningAdpMapping('FP002_1', mockExecutor)

    expect(res.isMapped).toBe(true)
    expect(res.mappedCount).toBe(1)
    expect(res.items[0].name).toBe('Implanon NXT')
    expect(mockExecutor).toHaveBeenCalledWith(
      expect.stringContaining('WHERE TRIM(nhso_adp_code) = ?'),
      ['FP002_1'],
      expect.anything()
    )
  })

  it('handles unmapped ADP code gracefully', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([])

    const res = await RcmFamilyPlanningService.checkFamilyPlanningAdpMapping('FP002_9', mockExecutor)

    expect(res.isMapped).toBe(false)
    expect(res.mappedCount).toBe(0)
    expect(res.items).toHaveLength(0)
  })

  it('generates 9.3.1 OPD report with FoxPro validation logic and summary KPIs', async () => {
    const mockRows = [
      {
        vn: '6911010001',
        cid: '1509900123456',
        hn: '0012345',
        ptname: 'นางสาว สมศรี รักดี',
        sex: 'หญิง',
        age: 24,
        vstdate: '2026-11-02',
        vsttime: '09:30:00',
        pttypename: 'UCS:บัตรทอง',
        claimcode: 'AUTH123456',
        department: 'ห้องตรวจวางแผนครอบครัว',
        clinic: 'สูติ-นรีเวชกรรม',
        cc: 'มาฝังยาคุมกำเนิด',
        income: 2500,
        dx: 'Z308, N920',
        op: '9923',
        drug: 'Implanon NXT 68 mg',
        money_eclaim: 2500,
        money_rep: 2500,
        money_invoice: 2500,
        rep: 'REP691101',
        status: 'NHSO :: ได้รับ Invoice',
      },
      {
        vn: '6911010002',
        cid: '1509900654321',
        hn: '0054321',
        ptname: 'นางสาว มาลี มีใจ',
        sex: 'หญิง',
        age: 19,
        vstdate: '2026-11-01',
        vsttime: '10:15:00',
        pttypename: 'UCS:บัตรทอง',
        claimcode: null,
        department: 'ห้องตรวจวางแผนครอบครัว',
        clinic: 'สูติ-นรีเวชกรรม',
        cc: 'ปรึกษาคุมกำเนิด',
        income: 2500,
        dx: 'N920', // Missing Z308!
        op: null,
        drug: '', // Missing drug!
        money_eclaim: 0,
        money_rep: 0,
        money_invoice: 0,
        rep: null,
        status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
      },
    ]

    const mockExecutor = vi
      .fn()
      // First call for mapping check
      .mockResolvedValueOnce([
        { icode: '1500001', name: 'Implanon NXT', strength: '68 mg', nhso_adp_code: 'FP002_1' },
      ])
      // Second call for queryOpdRows
      .mockResolvedValueOnce(mockRows)

    const res = await RcmFamilyPlanningService.getFamilyPlanningReport(
      {
        reportType: '9.3.1',
        patientType: 'OPD',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        refresh: true,
      },
      mockExecutor
    )

    expect(res.reportType).toBe('9.3.1')
    expect(res.patientType).toBe('OPD')
    expect(res.totalCount).toBe(2)
    expect(res.summary.totalCases).toBe(2)
    expect(res.summary.uniquePatients).toBe(2)
    expect(res.summary.compensatedCases).toBe(1)
    expect(res.summary.unsentCases).toBe(1)
    expect(res.summary.errorDxCount).toBe(1)
    expect(res.summary.errorDrugCount).toBe(1)
    expect(res.summary.hasErrorCount).toBe(1)
    expect(res.summary.totalCompensated).toBe(2500)

    // Check item 1 (complete)
    const item1 = res.items[0]
    expect(item1.errorDx).toBeNull()
    expect(item1.errorDrug).toBeNull()
    expect(item1.hasError).toBe(false)
    expect(item1.isCompensated).toBe(true)

    // Check item 2 (errors)
    const item2 = res.items[1]
    expect(item2.errorDx).toBe('ไม่พบ Dx Z308')
    expect(item2.errorDrug).toBe('ไม่พบค่าบริการ')
    expect(item2.hasError).toBe(true)
    expect(item2.isCompensated).toBe(false)
  })

  it('filters by interactive card filter correctly (ERROR_DX, COMPENSATED, etc.)', async () => {
    const mockRows = [
      {
        vn: 'VN1',
        cid: '111',
        hn: 'HN1',
        ptname: 'Patient 1',
        sex: 'หญิง',
        age: 20,
        vstdate: '2026-11-01',
        vsttime: '09:00:00',
        pttypename: 'UCS',
        income: 1000,
        dx: 'Z308',
        drug: 'Implant',
        money_invoice: 1000,
        status: 'NHSO :: ได้รับ Invoice',
      },
      {
        vn: 'VN2',
        cid: '222',
        hn: 'HN2',
        ptname: 'Patient 2',
        sex: 'หญิง',
        age: 21,
        vstdate: '2026-11-02',
        vsttime: '10:00:00',
        pttypename: 'UCS',
        income: 1000,
        dx: 'K290', // Missing Z308
        drug: 'Implant',
        money_invoice: 0,
        status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
      },
    ]

    const mockExecutor = vi
      .fn()
      .mockResolvedValueOnce([{ icode: '1', name: 'Implant', nhso_adp_code: 'FP002_1' }])
      .mockResolvedValueOnce(mockRows)

    const resErrorDx = await RcmFamilyPlanningService.getFamilyPlanningReport(
      {
        reportType: '9.3.1',
        patientType: 'OPD',
        cardFilter: 'ERROR_DX',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        refresh: true,
      },
      mockExecutor
    )

    expect(resErrorDx.items).toHaveLength(1)
    expect(resErrorDx.items[0].vn).toBe('VN2')
  })

  describe('9.2 บริการใส่ห่วงอนามัย (IUD Insertion Service)', () => {
    it('checks IUD ADP mapping for codes 20003, FP001, 71681, 71682', async () => {
      const mockAdpRows = [
        { icode: '3000091', name: 'ค่าใส่ห่วง ไม่รวม IUD', strength: '', nhso_adp_code: '71681' },
        { icode: '3000798', name: 'ห่วงอนามัย', strength: '', nhso_adp_code: 'FP001' },
      ]
      const mockExecutor = vi.fn().mockResolvedValueOnce(mockAdpRows)

      const mapping = await RcmFamilyPlanningService.checkIudAdpMapping(mockExecutor)
      expect(mapping.isMapped).toBe(true)
      expect(mapping.mappedCount).toBe(2)
      expect(mapping.adpCodes).toEqual(['20003', 'FP001', '71681', '71682'])
    })

    it('queries and evaluates OPD IUD insertion records with FoxPro business rules', async () => {
      const mockOpdRows = [
        {
          vn: '670819075401',
          cid: '3520800227001',
          hn: '0055801',
          ptname: 'นางสมพร สุขสวัสดิ์',
          sex: 'หญิง',
          age: 32,
          vstdate: '2024-08-19',
          vsttime: '08:30:00',
          pttypename: 'บัตรทอง',
          claimcode: 'AUTH01',
          department: 'สูตินรีเวช',
          clinic: 'นรีเวชกรรม',
          cc: 'ใส่ห่วงอนามัย',
          income: 800,
          dx: 'Z301, N920', // Has Z301
          op: '697',        // Has Op 697
          drug: 'ห่วงอนามัย TCu380A', // Has drug
          money_eclaim: 800,
          money_rep: 800,
          money_invoice: 800,
          rep: 'REP001',
          status: 'Rep :: ได้รับ Rep แล้ว',
        },
        {
          vn: '670819075402',
          cid: '3520800227002',
          hn: '0055802',
          ptname: 'นางมะลิ วันเพ็ญ',
          sex: 'หญิง',
          age: 45,
          vstdate: '2024-08-20',
          vsttime: '09:00:00',
          pttypename: 'บัตรทอง',
          claimcode: null,
          department: 'สูตินรีเวช',
          clinic: 'นรีเวชกรรม',
          cc: 'เอาห่วงออก',
          income: 350,
          dx: 'Z308', // Missing Z301
          op: '8926', // Missing Op 697
          drug: '',   // Missing drug
          money_eclaim: 0,
          money_rep: 0,
          money_invoice: 0,
          rep: null,
          status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
        },
      ]

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([{ icode: '3000798', name: 'ห่วงอนามัย', nhso_adp_code: 'FP001' }])
        .mockResolvedValueOnce(mockOpdRows)

      const result = await RcmFamilyPlanningService.getIudReport(
        {
          patientType: 'OPD',
          cardFilter: 'ALL',
          startDate: '2024-08-01',
          endDate: '2024-08-31',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.summary.totalCases).toBe(2)
      expect(result.summary.compensatedCases).toBe(1)
      expect(result.summary.uncompensatedCases).toBe(1)
      expect(result.summary.errorDxCount).toBe(1)
      expect(result.summary.errorOpCount).toBe(1)
      expect(result.summary.errorDrugCount).toBe(1)
      expect(result.summary.completeCount).toBe(1)

      // Verify complete case
      const completeItem = result.items.find((i) => i.vn === '670819075401')!
      expect(completeItem.errorDx).toBeNull()
      expect(completeItem.errorOp).toBeNull()
      expect(completeItem.errorDrug).toBeNull()
      expect(completeItem.hasError).toBe(false)
      expect(completeItem.isCompensated).toBe(true)

      // Verify warning case
      const warningItem = result.items.find((i) => i.vn === '670819075402')!
      expect(warningItem.errorDx).toBe('ไม่พบ Dx Z301')
      expect(warningItem.errorOp).toBe('ไม่พบ Op 697')
      expect(warningItem.errorDrug).toBe('ไม่พบค่าบริการ')
      expect(warningItem.hasError).toBe(true)
      expect(warningItem.isCompensated).toBe(false)
    })

    it('filters IUD items correctly by cardFilter: COMPLETE and HAS_ERROR', async () => {
      const mockOpdRows = [
        {
          vn: 'VN1',
          cid: '111',
          hn: 'HN1',
          ptname: 'Pass Case',
          vstdate: '2024-08-19',
          dx: 'Z301',
          op: '697',
          drug: 'IUD',
          money_rep: 500,
          status: 'Rep :: ได้รับ Rep แล้ว',
        },
        {
          vn: 'VN2',
          cid: '222',
          hn: 'HN2',
          ptname: 'Fail Case',
          vstdate: '2024-08-20',
          dx: 'Z308',
          op: '8876',
          drug: '',
          money_rep: 0,
          status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
        },
      ]

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockOpdRows)

      const result = await RcmFamilyPlanningService.getIudReport(
        {
          patientType: 'OPD',
          cardFilter: 'COMPLETE',
          startDate: '2024-08-01',
          endDate: '2024-08-31',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0].vn).toBe('VN1')
      expect(result.items[0].hasError).toBe(false)
    })
  })
})

