import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearMemoryCache } from '@/lib/cache'
import {
  RcmFamilyPlanningService,
  getAdpCodeForReport,
  getExpectedDxForReport,
  getReportTitle,
  evaluateFamilyPlanningDiscrepancy,
} from '../rcmFamilyPlanningService'

describe('RcmFamilyPlanningService Domain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  it('resolves correct ADP code, Dx, and title for 9.3.1, 9.3.2, 9.4, 9.5, 9.6, and 9.7', () => {
    expect(getAdpCodeForReport('9.3.1')).toBe('FP002_1')
    expect(getAdpCodeForReport('9.3.2')).toBe('FP002_2')
    expect(getAdpCodeForReport('9.4')).toBe('FP003_1')
    expect(getAdpCodeForReport('9.3.4')).toBe('FP003_1')
    expect(getAdpCodeForReport('9.5')).toBe('FP003_2')
    expect(getAdpCodeForReport('9.3.5')).toBe('FP003_2')
    expect(getAdpCodeForReport('9.6')).toBe('FP003_3')
    expect(getAdpCodeForReport('9.3.6')).toBe('FP003_3')
    expect(getAdpCodeForReport('9.7')).toBe('FP003_4')
    expect(getAdpCodeForReport('9.3.7')).toBe('FP003_4')
    expect(getExpectedDxForReport('9.3.1')).toBe('Z308')
    expect(getExpectedDxForReport('9.4')).toBe('Z304')
    expect(getExpectedDxForReport('9.3.4')).toBe('Z304')
    expect(getExpectedDxForReport('9.5')).toBe('Z304')
    expect(getExpectedDxForReport('9.3.5')).toBe('Z304')
    expect(getExpectedDxForReport('9.6')).toBe('Z304')
    expect(getExpectedDxForReport('9.3.6')).toBe('Z304')
    expect(getExpectedDxForReport('9.7')).toBe('Z304')
    expect(getExpectedDxForReport('9.3.7')).toBe('Z304')
    expect(getReportTitle('9.3.1')).toContain('9.3.1 รายการฝังยาคุม')
    expect(getReportTitle('9.3.2')).toContain('9.3.2 รายการถอดยาคุม')
    expect(getReportTitle('9.4')).toContain('9.4 รายการยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม')
    expect(getReportTitle('9.5')).toContain('9.5 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดียว')
    expect(getReportTitle('9.6')).toContain('9.6 ยาเม็ดคุมกำเนิดชนิดฉุกเฉิน')
    expect(getReportTitle('9.7')).toContain('9.7 ยาฉีดคุมกำเนิด')
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

  it('generates 9.4 oral contraceptives OPD report with Dx Z304 validation logic', async () => {
    const mockRows = [
      {
        vn: '6911020001',
        cid: '1509900111222',
        hn: '0011222',
        ptname: 'นาง สมศรี มั่นใจ',
        sex: 'หญิง',
        age: 25,
        vstdate: '2026-11-04',
        vsttime: '09:30:00',
        pttypename: 'UCS:บัตรทอง',
        claimcode: 'AUTH888111',
        department: 'ห้องตรวจวางแผนครอบครัว',
        clinic: 'สูติ-นรีเวชกรรม',
        cc: 'รับยาคุมกำเนิดชนิดเม็ด',
        income: 300,
        dx: 'Z304',
        op: null,
        drug: 'Microgynon 30 ED 28 tab',
        money_eclaim: 300,
        money_rep: 300,
        money_invoice: 300,
        rep: 'REP691102',
        status: 'NHSO :: ได้รับ Invoice',
      },
      {
        vn: '6911020002',
        cid: '1509900333444',
        hn: '0033444',
        ptname: 'นางสาว อำนวย พร',
        sex: 'หญิง',
        age: 21,
        vstdate: '2026-11-03',
        vsttime: '10:15:00',
        pttypename: 'UCS:บัตรทอง',
        claimcode: null,
        department: 'ห้องตรวจวางแผนครอบครัว',
        clinic: 'สูติ-นรีเวชกรรม',
        cc: 'ขอรับยาเม็ดคุมกำเนิด',
        income: 300,
        dx: 'Z308', // Has Z308 instead of Z304!
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
      .mockResolvedValueOnce([{ icode: '1500099', name: 'Microgynon 30 ED', nhso_adp_code: 'FP003_1' }])
      .mockResolvedValueOnce(mockRows)

    const result = await RcmFamilyPlanningService.getFamilyPlanningReport(
      {
        reportType: '9.4',
        patientType: 'OPD',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        refresh: true,
      },
      mockExecutor
    )

    expect(result.reportType).toBe('9.4')
    expect(result.adpCode).toBe('FP003_1')
    expect(result.items).toHaveLength(2)

    // First case: has Z304 and drug
    const passItem = result.items.find((i: { vn: string }) => i.vn === '6911020001')!
    expect(passItem).toBeDefined()
    expect(passItem.errorDx).toBeNull()
    expect(passItem.errorDrug).toBeNull()
    expect(passItem.hasError).toBe(false)
    expect(passItem.isCompensated).toBe(true)

    // Second case: missing Z304 (has Z308) and missing drug
    const failItem = result.items.find((i: { vn: string }) => i.vn === '6911020002')!
    expect(failItem).toBeDefined()
    expect(failItem.errorDx).toBe('ไม่พบ Dx Z304')
    expect(failItem.errorDrug).toBe('ไม่พบค่าบริการ')
    expect(failItem.hasError).toBe(true)
    expect(failItem.isCompensated).toBe(false)
  })

  it('generates 9.5 single hormone pill OPD report with Dx Z304 validation logic', async () => {
    const mockRows = [
      {
        vn: '6911025001',
        cid: '1509900987654',
        hn: '0098765',
        ptname: 'นาง สุภาพร มั่นคง',
        sex: 'หญิง',
        age: 26,
        vstdate: '2026-11-05',
        vsttime: '09:15:00',
        pttypename: 'UCS:บัตรทอง',
        claimcode: 'AUTH999222',
        department: 'ห้องตรวจวางแผนครอบครัว',
        clinic: 'สูติ-นรีเวชกรรม',
        cc: 'รับยาคุมกำเนิดฮอร์โมนเดี่ยว',
        income: 300,
        dx: 'Z304',
        op: null,
        drug: 'Exluton 0.5 mg 28 tab',
        money_eclaim: 300,
        money_rep: 300,
        money_invoice: 300,
        rep: 'REP691105',
        status: 'NHSO :: ได้รับ Invoice',
      },
      {
        vn: '6911025002',
        cid: '1509900123999',
        hn: '0012399',
        ptname: 'นางสาว พรทิพย์ สดใส',
        sex: 'หญิง',
        age: 22,
        vstdate: '2026-11-04',
        vsttime: '10:30:00',
        pttypename: 'UCS:บัตรทอง',
        claimcode: null,
        department: 'ห้องตรวจวางแผนครอบครัว',
        clinic: 'สูติ-นรีเวชกรรม',
        cc: 'ขอรับยาเม็ดคุมกำเนิดให้นมบุตร',
        income: 300,
        dx: 'Z308', // Has Z308 instead of Z304!
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
      .mockResolvedValueOnce([{ icode: '1500005', name: 'Exluton', nhso_adp_code: 'FP003_2' }])
      .mockResolvedValueOnce(mockRows)

    const result = await RcmFamilyPlanningService.getFamilyPlanningReport(
      {
        reportType: '9.5',
        patientType: 'OPD',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        refresh: true,
      },
      mockExecutor
    )

    expect(result.reportType).toBe('9.5')
    expect(result.adpCode).toBe('FP003_2')
    expect(result.items).toHaveLength(2)

    const passItem = result.items.find((i: { vn: string }) => i.vn === '6911025001')!
    expect(passItem).toBeDefined()
    expect(passItem.errorDx).toBeNull()
    expect(passItem.errorDrug).toBeNull()
    expect(passItem.hasError).toBe(false)
    expect(passItem.isCompensated).toBe(true)

    const failItem = result.items.find((i: { vn: string }) => i.vn === '6911025002')!
    expect(failItem).toBeDefined()
    expect(failItem.errorDx).toBe('ไม่พบ Dx Z304')
    expect(failItem.errorDrug).toBe('ไม่พบค่าบริการ')
    expect(failItem.hasError).toBe(true)
    expect(failItem.isCompensated).toBe(false)
  })

  it('generates 9.6 emergency contraceptive OPD report with Dx Z304 validation logic', async () => {
    const mockRows = [
      {
        vn: '6911030001',
        cid: '1509900555666',
        hn: '0055666',
        ptname: 'นางสาว กานดา สดใส',
        sex: 'หญิง',
        age: 21,
        vstdate: '2026-11-05',
        vsttime: '09:30:00',
        pttypename: 'UCS:บัตรทอง',
        claimcode: 'AUTH999111',
        department: 'ห้องตรวจวางแผนครอบครัว',
        clinic: 'สูติ-นรีเวชกรรม',
        cc: 'ขอรับยาเม็ดคุมกำเนิดฉุกเฉิน',
        income: 300,
        dx: 'Z304',
        op: null,
        drug: 'Postinor 0.75 mg 2 tab',
        money_eclaim: 300,
        money_rep: 300,
        money_invoice: 300,
        rep: 'REP691103',
        status: 'NHSO :: ได้รับ Invoice',
      },
      {
        vn: '6911030002',
        cid: '1509900777888',
        hn: '0077888',
        ptname: 'นางสาว สุพรรณี ชูใจ',
        sex: 'หญิง',
        age: 22,
        vstdate: '2026-11-04',
        vsttime: '10:15:00',
        pttypename: 'UCS:บัตรทอง',
        claimcode: null,
        department: 'ห้องตรวจวางแผนครอบครัว',
        clinic: 'สูติ-นรีเวชกรรม',
        cc: 'ปรึกษาการคุมกำเนิดฉุกเฉิน',
        income: 300,
        dx: 'Z308', // Has Z308 instead of Z304!
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
      .mockResolvedValueOnce([{ icode: '1500088', name: 'Postinor', nhso_adp_code: 'FP003_3' }])
      .mockResolvedValueOnce(mockRows)

    const result = await RcmFamilyPlanningService.getFamilyPlanningReport(
      {
        reportType: '9.6',
        patientType: 'OPD',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        refresh: true,
      },
      mockExecutor
    )

    expect(result.reportType).toBe('9.6')
    expect(result.adpCode).toBe('FP003_3')
    expect(result.items).toHaveLength(2)

    const passItem = result.items.find((i: { vn: string }) => i.vn === '6911030001')!
    expect(passItem).toBeDefined()
    expect(passItem.errorDx).toBeNull()
    expect(passItem.errorDrug).toBeNull()
    expect(passItem.hasError).toBe(false)
    expect(passItem.isCompensated).toBe(true)

    const failItem = result.items.find((i: { vn: string }) => i.vn === '6911030002')!
    expect(failItem).toBeDefined()
    expect(failItem.errorDx).toBe('ไม่พบ Dx Z304')
    expect(failItem.errorDrug).toBe('ไม่พบค่าบริการ')
    expect(failItem.hasError).toBe(true)
    expect(failItem.isCompensated).toBe(false)
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

  describe('9.1 บริการวางแผนครอบครัวและการป้องกันการตั้งครรภ์ไม่พึงประสงค์', () => {
    it('evaluates discrepancy rules accurately per FoxPro specification', () => {
      // 1. Dx present, but no service
      expect(evaluateFamilyPlanningDiscrepancy(false, true, false, null, null)).toBe(
        'พบ Dx การคุมกำเนิด แต่ไม่พบการบริการ'
      )

      // 2. IUD service (FP001 / 20003) but missing procedure 697
      expect(
        evaluateFamilyPlanningDiscrepancy(true, true, false, 'FP001:ห่วงอนามัย', '9923')
      ).toBe('ใส่ห่วง แต่ไม่พบหัตถการ')
      expect(
        evaluateFamilyPlanningDiscrepancy(true, true, false, '20003:ใส่ห่วง', '')
      ).toBe('ใส่ห่วง แต่ไม่พบหัตถการ')

      // 3. Implant service (FP002 / 20004) but missing procedure 992
      expect(
        evaluateFamilyPlanningDiscrepancy(true, true, false, 'FP002_1:ฝังยาคุม', '697')
      ).toBe('ฝังยาคุม แต่ไม่พบหัตถการ')
      expect(
        evaluateFamilyPlanningDiscrepancy(true, true, false, '20004:ฝังยาคุม', null)
      ).toBe('ฝังยาคุม แต่ไม่พบหัตถการ')

      // 4. Contraceptive drug present, but no service (and no Dx)
      expect(
        evaluateFamilyPlanningDiscrepancy(false, false, true, null, null)
      ).toBe('พบรายการยาคุมกำเนิด แต่ไม่พบการบริการ')

      // 5. Service present, but no Dx
      expect(
        evaluateFamilyPlanningDiscrepancy(true, false, false, 'FP003_1:DMPA', null)
      ).toBe('พบรายการบริการ แต่ไม่พบ Dx')

      // Normal valid case
      expect(
        evaluateFamilyPlanningDiscrepancy(true, true, true, 'FP002_1:ฝังยาคุม', '9923')
      ).toBeNull()
    })

    it('queries and filters 9.1 family planning report with format, status, and error options', async () => {
      const mockRawRows = [
        {
          vn: '670001',
          cid: '1509900000001',
          hn: '0000001',
          ptname: 'สมหญิง รักสงบ',
          sex: 'หญิง',
          age: 25,
          nation: 'ไทย',
          vstdate: '2024-10-10',
          vsttime: '09:00:00',
          cc: 'ฉีดยาคุม',
          authencode: 'AUTH001',
          pttypename: 'UCS:บัตรทอง',
          pdx: 'Z300',
          icd10: 'Z300',
          op: '992',
          income: 300,
          doctorname: 'หมอสมชาย',
          listname: 'FP003_1:DMPA',
          drugname: 'DMPA#1',
          status: 'NHSO :: มี Invoice แล้ว',
          rep: 'REP001',
          compensated: 250,
        },
        {
          vn: '670002',
          cid: '1509900000002',
          hn: '0000002',
          ptname: 'มาลัย ชูใจ',
          sex: 'หญิง',
          age: 22,
          nation: 'ไทย',
          vstdate: '2024-10-11',
          vsttime: '10:00:00',
          cc: 'ขอใส่ห่วง',
          authencode: null,
          pttypename: 'UCS:บัตรทอง',
          pdx: 'Z301',
          icd10: 'Z301',
          op: null,
          income: 800,
          doctorname: 'หมอสมหญิง',
          listname: 'FP001:ห่วงอนามัย',
          drugname: null,
          status: '-::ยังไม่ได้ส่ง',
          rep: null,
          compensated: 0,
        },
      ]

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([
          { icode: '1', name: 'DMPA', strength: '150 mg', nhso_adp_code: 'FP003_1' },
        ])
        .mockResolvedValueOnce(mockRawRows)

      const result = await RcmFamilyPlanningService.getFamilyPlanning91Report(
        {
          startDate: '2024-10-01',
          endDate: '2024-10-31',
          format: 'NEW_ECLAIM',
          status: '-::ยังไม่ได้ส่ง',
          refresh: true,
        },
        mockExecutor
      )

      expect(result.format).toBe('NEW_ECLAIM')
      expect(result.summary.totalVisits).toBe(2)
      // Filtered by status: '-::ยังไม่ได้ส่ง'
      expect(result.items).toHaveLength(1)
      expect(result.items[0].vn).toBe('670002')
      expect(result.items[0].errorname).toBe('ใส่ห่วง แต่ไม่พบหัตถการ')
      expect(result.items[0].hasError).toBe(true)
    })

    it('filters records by purpose: 9.3.1.1 excludes removal-only records, 9.3.1.2 excludes insertion-only records', async () => {
      const mockRawRows = [
        // Case 1: Insertion only (FP002_1 + FP002)
        {
          vn: '690001',
          cid: '1509900000001',
          hn: '000001',
          ptname: 'คนไข้ ฝังยาคุม',
          vstdate: '2026-11-01',
          dx: 'Z308',
          drug: 'Implanon NXT 68 mg',
          all_adp_codes: 'FP002_1,FP002',
          income: 2500,
          status: 'NHSO :: ได้รับ Invoice',
        },
        // Case 2: Removal only (FP002_2 + 71691)
        {
          vn: '690002',
          cid: '1509900000002',
          hn: '000002',
          ptname: 'คนไข้ ถอดยาคุม',
          vstdate: '2026-11-02',
          dx: 'Z308',
          drug: 'ค่าถอดยาฝังคุมกำเนิด',
          all_adp_codes: 'FP002_2,71691',
          income: 500,
          status: 'Rep :: ได้รับ Rep แล้ว',
        },
        // Case 3: Both Insertion and Removal (FP002_1 + FP002_2)
        {
          vn: '690003',
          cid: '1509900000003',
          hn: '000003',
          ptname: 'คนไข้ ถอดและฝังใหม่',
          vstdate: '2026-11-03',
          dx: 'Z308',
          drug: 'Implanon NXT 68 mg, ค่าถอดยาฝังคุมกำเนิด',
          all_adp_codes: 'FP002_1,FP002_2',
          income: 3000,
          status: 'NHSO :: ได้รับ Invoice',
        },
        // Case 4: Missing both (Z308 but no services at all)
        {
          vn: '690004',
          cid: '1509900000004',
          hn: '000004',
          ptname: 'คนไข้ ไม่ได้สั่งยา/ค่าบริการ',
          vstdate: '2026-11-04',
          dx: 'Z308',
          drug: null,
          all_adp_codes: '55020',
          income: 50,
          status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
        },
      ]

      // Test 9.3.1.1 (Implant Insertion)
      const mockExecutor1 = vi
        .fn()
        .mockResolvedValueOnce([{ icode: '1', name: 'Implanon', nhso_adp_code: 'FP002_1' }])
        .mockResolvedValueOnce(mockRawRows)

      const resultInsertion = await RcmFamilyPlanningService.getFamilyPlanningReport(
        {
          reportType: '9.3.1.1',
          startDate: '2026-11-01',
          endDate: '2026-11-05',
          refresh: true,
        },
        mockExecutor1
      )

      // Should exclude Case 2 (removal only) -> 3 cases remain (Case 4, Case 3, Case 1 descending by vstdate)
      expect(resultInsertion.items).toHaveLength(3)
      expect(resultInsertion.items.map((i: any) => i.vn)).toEqual(['690004', '690003', '690001'])
      // Case 4 should still be flagged with errorDrug: 'ไม่พบค่าบริการ'
      const itemMissingIns = resultInsertion.items.find((i: any) => i.vn === '690004')
      expect(itemMissingIns?.errorDrug).toBe('ไม่พบค่าบริการ')

      // Test 9.3.1.2 (Implant Removal)
      clearMemoryCache()
      const mockExecutor2 = vi
        .fn()
        .mockResolvedValueOnce([{ icode: '2', name: 'ค่าถอด', nhso_adp_code: 'FP002_2' }])
        .mockResolvedValueOnce(mockRawRows)

      const resultRemoval = await RcmFamilyPlanningService.getFamilyPlanningReport(
        {
          reportType: '9.3.1.2',
          startDate: '2026-11-01',
          endDate: '2026-11-05',
          refresh: true,
        },
        mockExecutor2
      )

      // Should exclude Case 1 (insertion only) -> 3 cases remain (Case 4, Case 3, Case 2 descending by vstdate)
      expect(resultRemoval.items).toHaveLength(3)
      expect(resultRemoval.items.map((i: any) => i.vn)).toEqual(['690004', '690003', '690002'])
      // Case 4 should still be flagged with errorDrug: 'ไม่พบค่าบริการ'
      const itemMissingRem = resultRemoval.items.find((i: any) => i.vn === '690004')
      expect(itemMissingRem?.errorDrug).toBe('ไม่พบค่าบริการ')
    })

    it('filters family planning 9.3 records by pttypes parameter', async () => {
      clearMemoryCache()
      const mockRawRows = [
        {
          vn: '690011',
          hn: '000011',
          vstdate: '2026-11-01',
          dx: 'Z308',
          drug: 'Implanon NXT 68 mg',
          all_adp_codes: 'FP002_1',
          pttypename: 'UC ใน CUP',
          pttype_eclaim_id: '01',
        },
        {
          vn: '690012',
          hn: '000012',
          vstdate: '2026-11-02',
          dx: 'Z308',
          drug: 'Implanon NXT 68 mg',
          all_adp_codes: 'FP002_1',
          pttypename: 'ประกันสังคม',
          pttype_eclaim_id: '10',
        },
      ]

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce([{ icode: '1', name: 'Implanon', nhso_adp_code: 'FP002_1' }])
        .mockResolvedValueOnce(mockRawRows)

      const res = await RcmFamilyPlanningService.getFamilyPlanningReport(
        {
          reportType: '9.3.1.1',
          startDate: '2026-11-01',
          endDate: '2026-11-05',
          pttypes: '01,02',
          refresh: true,
        },
        mockExecutor
      )

      expect(res.items).toHaveLength(1)
      expect(res.items[0].vn).toBe('690011')
      expect(res.summary.totalCases).toBe(1)
    })
  })
})

