import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearMemoryCache } from '@/lib/cache'
import { RcmImcService } from '../rcmImcService'
import { createMockRcmFundGateway } from './rcmGatewayTestHelper'

describe('RcmImcService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  it('handles IPD empty candidates gracefully', async () => {
    const mockGateway = createMockRcmFundGateway({ rawRows: [] })

    const result = await RcmImcService.getImcReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        patientType: 'IPD',
      },
      mockGateway
    )

    expect(result.patientType).toBe('IPD')
    expect(result.categoryTitle).toBe('กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์')
    expect(result.subtopicTitle).toBe('รายงานบริการผู้ป่วย IMC')
    expect(result.reportTitle).toBe('รายชื่อผู้รับบริการตามเกณฑ์ IMC')
    expect(result.totalCount).toBe(0)
    expect(result.items).toHaveLength(0)
    expect(result.summary.totalCases).toBe(0)
    expect(result.summary.chronicCases).toBe(0)
    expect(result.summary.inWebCases).toBe(0)
  })

  it('fetches, aggregates and reconciles IPD IMC candidates correctly', async () => {
    const mockGateway = createMockRcmFundGateway({
      rawRows: [
        {
          an: '690001',
          hn: '000001',
          cid: '1529900123456',
          ptname: 'นายสมชาย ใจดี',
          age: 65,
          chronic: 'Y',
          web: 'Y',
          filetype: 'ตรงกันทั้ง 2 ระบบ',
          ward: 'หอผู้ป่วยชาย',
          admdate: '2026-10-01',
          dchdate: '2026-10-05',
          date: '2026-10-05',
          los: 4,
          prediag: 'Stroke',
          authencode: 'AUTH123456',
          maininscl: 'UCS',
          pttypename: '10:บัตรทอง',
          dchstts: 'ทุเลา',
          dchtype: 'แพทย์อนุญาต',
          dx: 'I63.9: Cerebral infarction',
          op: '99.04: Packed cell transfusion',
          adjrw: 1.85,
          income: 12500,
          getprice: 1500,
          rep: 'REP2610-001',
          compensated: 12000,
          status: 'NHSO :: มี Invoice แล้ว',
          address: '12 ม.1 ต.ล้อมแรด อ.เถิน',
          tel: '0812345678',
        },
        {
          an: '690002',
          hn: '000002',
          cid: '1529900234567',
          ptname: 'นางสมศรี รักเรียน',
          age: 70,
          chronic: null,
          web: 'Y',
          filetype: 'Web',
          ward: 'หอผู้ป่วยหญิง',
          admdate: '2026-10-10',
          dchdate: '2026-10-18',
          date: '2026-10-18',
          los: 8,
          prediag: 'Hip fracture',
          authencode: null,
          maininscl: 'UCS',
          pttypename: '10:บัตรทอง',
          dchstts: 'ทุเลา',
          dchtype: 'แพทย์อนุญาต',
          dx: 'S72.0: Fracture of neck of femur',
          op: '79.35: Open reduction of fracture',
          adjrw: 2.15,
          income: 28000,
          getprice: 2000,
          rep: null,
          compensated: 0,
          status: null,
          address: '55 ม.3 ต.แม่ปะ อ.เถิน',
          tel: '0898765432',
        },
        {
          an: '690003',
          hn: '000003',
          cid: '1529900345678',
          ptname: 'นายประสิทธิ์ มั่นคง',
          age: 58,
          chronic: 'Y',
          web: null,
          filetype: 'HOSxP',
          ward: 'หอผู้ป่วยชาย',
          admdate: '2026-10-20',
          dchdate: '2026-10-25',
          date: '2026-10-25',
          los: 5,
          prediag: 'Head injury',
          authencode: 'AUTH789012',
          maininscl: 'OFC',
          pttypename: '21:ข้าราชการ',
          dchstts: 'ทุเลา',
          dchtype: 'แพทย์อนุญาต',
          dx: 'S06.0: Concussion',
          op: null,
          adjrw: 1.12,
          income: 8900,
          getprice: 0,
          rep: null,
          compensated: 0,
          status: null,
          address: '99 ม.2 ต.สบปราบ',
          tel: '0823456789',
        },
      ],
    })

    const result = await RcmImcService.getImcReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        patientType: 'IPD',
        page: 1,
        pageSize: 50,
      },
      mockGateway
    )

    expect(result.totalCount).toBe(3)
    expect(result.summary.totalCases).toBe(3)
    expect(result.summary.chronicCases).toBe(2)
    expect(result.summary.inWebCases).toBe(2) // 690001, 690002
    expect(result.summary.notInWebCases).toBe(1) // 690003
    expect(result.summary.compensatedCases).toBe(1) // 690001
    expect(result.summary.uncompensatedCases).toBe(2)
    expect(result.summary.withAuthenCases).toBe(2)
    expect(result.summary.totalCompensated).toBe(12000)
    expect(result.summary.totalGetprice).toBe(3500)

    const item1 = result.items.find((i) => i.an === '690001')
    expect(item1).toBeDefined()
    expect(item1?.chronic).toBe('Y')
    expect(item1?.web).toBe('Y')
    expect(item1?.filetype).toBe('ตรงกันทั้ง 2 ระบบ')
    expect(item1?.getprice).toBe(1500)
    expect(item1?.isCompensated).toBe(true)
    expect(item1?.status).toBe('NHSO :: มี Invoice แล้ว')

    const item2 = result.items.find((i) => i.an === '690002')
    expect(item2?.web).toBe('Y')
    expect(item2?.chronic).toBeNull()

    const item3 = result.items.find((i) => i.an === '690003')
    expect(item3?.web).toBeNull()
    expect(item3?.filetype).toBe('HOSxP')
  })

  it('filters by cardFilter (CHRONIC, IN_WEB, COMPENSATED, WITH_AUTHEN)', async () => {
    const mockGateway = createMockRcmFundGateway({
      rawRows: [
        {
          an: '690001',
          hn: '001',
          cid: '1111111111111',
          ptname: 'คนไข้ หนึ่ง',
          chronic: 'Y',
          web: 'Y',
          filetype: 'ตรงกันทั้ง 2 ระบบ',
          dchdate: '2026-10-01',
          date: '2026-10-01',
          authencode: 'AUTH1',
          income: 1000,
          getprice: 1000,
          rep: 'REP01',
          compensated: 1000,
          status: 'Rep',
        },
        {
          an: '690002',
          hn: '002',
          cid: '2222222222222',
          ptname: 'คนไข้ สอง',
          chronic: null,
          web: null,
          filetype: 'HOSxP',
          dchdate: '2026-10-02',
          date: '2026-10-02',
          authencode: null,
          income: 2000,
          getprice: 0,
          rep: null,
          compensated: 0,
          status: null,
        },
      ],
    })

    const chronicRes = await RcmImcService.getImcReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        patientType: 'IPD',
        cardFilter: 'CHRONIC',
      },
      mockGateway
    )
    expect(chronicRes.items).toHaveLength(1)
    expect(chronicRes.items[0].an).toBe('690001')

    const webRes = await RcmImcService.getImcReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        patientType: 'IPD',
        cardFilter: 'IN_WEB',
      },
      mockGateway
    )
    expect(webRes.items).toHaveLength(1)
    expect(webRes.items[0].an).toBe('690001')

    const notWebRes = await RcmImcService.getImcReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        patientType: 'IPD',
        cardFilter: 'NOT_IN_WEB',
      },
      mockGateway
    )
    expect(notWebRes.items).toHaveLength(1)
    expect(notWebRes.items[0].an).toBe('690002')

    const compRes = await RcmImcService.getImcReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        patientType: 'IPD',
        cardFilter: 'COMPENSATED',
      },
      mockGateway
    )
    expect(compRes.items).toHaveLength(1)
    expect(compRes.items[0].an).toBe('690001')

    const uncompRes = await RcmImcService.getImcReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        patientType: 'IPD',
        cardFilter: 'UNCOMPENSATED',
      },
      mockGateway
    )
    expect(uncompRes.items).toHaveLength(1)
    expect(uncompRes.items[0].an).toBe('690002')
  })

  it('filters by global search across name, HN, CID, diagnosis, etc.', async () => {
    const mockGateway = createMockRcmFundGateway({
      rawRows: [
        {
          an: '690001',
          hn: '001111',
          cid: '1529900111111',
          ptname: 'นายสมชาย ดีงาม',
          dx: 'I63.0',
          dchdate: '2026-10-01',
          date: '2026-10-01',
        },
        {
          an: '690002',
          hn: '002222',
          cid: '1529900222222',
          ptname: 'นางมาลี มีสุข',
          dx: 'S72.1',
          dchdate: '2026-10-02',
          date: '2026-10-02',
        },
      ],
    })

    const searchRes = await RcmImcService.getImcReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        patientType: 'IPD',
        search: 'มาลี',
      },
      mockGateway
    )

    expect(searchRes.items).toHaveLength(1)
    expect(searchRes.items[0].hn).toBe('002222')
  })

  it('fetches and reconciles OPD IMC candidates correctly', async () => {
    const mockGateway = createMockRcmFundGateway({
      rawRows: [
        {
          vn: '691001',
          hn: '000010',
          cid: '1529900999888',
          ptname: 'นายทองดี บุญมี',
          age: 62,
          chronic: 'Y',
          web: 'Y',
          filetype: 'ตรงกันทั้ง 2 ระบบ',
          vstdate: '2026-10-05',
          date: '2026-10-05',
          vsttime: '08:30:00',
          cc: 'อ่อนแรงซีกซ้าย มาตรวจติดตาม',
          authencode: 'AUTHOPD1',
          maininscl: 'UCS',
          pttypename: '10:บัตรทอง',
          department: 'เวชศาสตร์ฟื้นฟู',
          clinic: 'คลินิกกายภาพบำบัด',
          ovstost: 'กลับบ้าน',
          dx: 'I69.3: Sequelae of cerebral infarction',
          op: null,
          income: 1500,
          getprice: 800,
          rep: 'REPOPD-01',
          compensated: 1200,
          status: 'NHSO :: มี Invoice แล้ว',
          address: '10 ม.4 ต.เถินบุรี',
          tel: '0811112233',
        },
        {
          vn: '691002',
          hn: '000020',
          cid: '1529900888777',
          ptname: 'นางทองหล่อ มีทรัพย์',
          age: 55,
          chronic: null,
          web: null,
          filetype: 'HOSxP',
          vstdate: '2026-10-06',
          date: '2026-10-06',
          vsttime: '09:15:00',
          cc: 'กระดูกสะโพกหัก มาตัดไหม',
          authencode: null,
          maininscl: 'SSS',
          pttypename: '30:ประกันสังคม',
          department: 'ศัลยกรรมกระดูก',
          clinic: 'ออร์โธปิดิกส์',
          ovstost: 'กลับบ้าน',
          dx: 'S72.0: Fracture of neck of femur',
          op: null,
          income: 900,
          getprice: 0,
          rep: null,
          compensated: 0,
          status: null,
          address: '88 ม.5 ต.ล้อมแรด',
          tel: '0822223344',
        },
      ],
    })

    const opdResult = await RcmImcService.getImcReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        patientType: 'OPD',
      },
      mockGateway
    )

    expect(opdResult.patientType).toBe('OPD')
    expect(opdResult.totalCount).toBe(2)
    expect(opdResult.summary.totalCases).toBe(2)
    expect(opdResult.summary.chronicCases).toBe(1)
    expect(opdResult.summary.inWebCases).toBe(1)
    expect(opdResult.summary.compensatedCases).toBe(1)
    expect(opdResult.summary.totalCompensated).toBe(1200)

    const opdItem1 = opdResult.items.find((i) => i.vn === '691001')
    expect(opdItem1).toBeDefined()
    expect(opdItem1?.vsttime).toBe('08:30:00')
    expect(opdItem1?.cc).toBe('อ่อนแรงซีกซ้าย มาตรวจติดตาม')
    expect(opdItem1?.department).toBe('เวชศาสตร์ฟื้นฟู')
  })

  describe('Seamless Rep enrichment (from Gateway V2)', () => {
    it('maps Seamless Reps from Gateway rows and keeps their amount out of e-Claim totals', async () => {
      const mockGateway = createMockRcmFundGateway({
        rawRows: [
          {
            vn: '681003123142',
            hn: '0070210',
            cid: '1',
            ptname: 'ก ข',
            date: '2025-10-03',
            vstdate: '2025-10-03',
            rep: '681000024',
            compensated: 500,
            status: 'NHSO :: มี Invoice แล้ว',
            rep_seamless: 'DDSA68103100077,DDSA69093000090',
            seamless_funds: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
            compensated_seamless: 1350,
          },
          {
            vn: '690101000001',
            hn: '0000002',
            cid: '2',
            ptname: 'ค ง',
            date: '2026-01-01',
            vstdate: '2026-01-01',
            rep: null,
            compensated: 0,
            rep_seamless: null,
            compensated_seamless: 0,
          },
        ],
      })

      const res = await RcmImcService.getImcReport(
        { startDate: '2025-10-01', endDate: '2026-09-30', patientType: 'OPD' },
        mockGateway
      )

      const multi = res.items.find((i) => i.vn === '681003123142')
      expect(multi?.rep).toBe('681000024')
      expect(multi?.repSeamless).toBe('DDSA68103100077,DDSA69093000090')
      expect(multi?.compensatedSeamless).toBe(1350)
      expect(multi?.seamlessFunds).toBe('ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ')

      const none = res.items.find((i) => i.vn === '690101000001')
      expect(none?.repSeamless).toBeNull()
      expect(none?.compensatedSeamless).toBe(0)

      // e-Claim totals are untouched by Seamless amounts
      expect(res.summary.totalCompensated).toBe(500)
    })

    it('matches a Seamless Rep number in global search', async () => {
      const mockGateway = createMockRcmFundGateway({
        rawRows: [
          {
            vn: '681003123142',
            hn: '0070210',
            cid: '1',
            ptname: 'ก ข',
            date: '2025-10-03',
            vstdate: '2025-10-03',
            rep_seamless: 'DDSA68103100077',
            compensated_seamless: 100,
          },
          {
            vn: '690101000001',
            hn: '0000002',
            cid: '2',
            ptname: 'ค ง',
            date: '2026-01-01',
            vstdate: '2026-01-01',
          },
        ],
      })

      const res = await RcmImcService.getImcReport(
        { startDate: '2025-10-01', endDate: '2026-09-30', patientType: 'OPD', search: 'ddsa6810' },
        mockGateway
      )

      expect(res.items).toHaveLength(1)
      expect(res.items[0].hn).toBe('0070210')
    })

    it('still returns the report when Seamless fields are absent', async () => {
      const mockGateway = createMockRcmFundGateway({
        rawRows: [
          { vn: '681003123142', hn: '0070210', cid: '1', ptname: 'ก ข', date: '2025-10-03', vstdate: '2025-10-03' },
          { vn: '690101000001', hn: '0000002', cid: '2', ptname: 'ค ง', date: '2026-01-01', vstdate: '2026-01-01' },
        ],
      })

      const res = await RcmImcService.getImcReport(
        { startDate: '2025-10-01', endDate: '2026-09-30', patientType: 'OPD' },
        mockGateway
      )

      expect(res.totalCount).toBe(2)
      expect(res.items.every((i) => i.repSeamless === null)).toBe(true)
    })

    it('maps IPD Seamless Rep fields properly', async () => {
      const mockGateway = createMockRcmFundGateway({
        rawRows: [
          {
            an: '690001',
            hn: '001',
            cid: '1',
            ptname: 'ก ข',
            date: '2026-10-01',
            rep_seamless: 'DTDT69010100001',
            compensated_seamless: 200,
          },
        ],
      })

      const res = await RcmImcService.getImcReport(
        { startDate: '2026-10-01', endDate: '2027-09-30', patientType: 'IPD' },
        mockGateway
      )

      expect(res.items[0].repSeamless).toBe('DTDT69010100001')
      expect(res.items[0].compensatedSeamless).toBe(200)
    })
  })
})
