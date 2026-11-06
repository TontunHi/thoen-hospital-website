import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OralCancerScreeningClient, { parsePhysicalExam } from '../OralCancerScreeningClient'

const mockReportData = {
  ds1: '2026-10-01',
  ds2: '2026-10-31',
  cardFilter: 'ALL',
  ucOnly: false,
  searchField: 'ALL',
  search: '',
  sortBy: 'vstdate',
  sortOrder: 'desc',
  totalCount: 2,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  adpMapping: {
    isMapped: true,
    mappedCount: 1,
    items: [{ icode: '3009999', name: 'คัดกรองมะเร็งช่องปาก', strength: null, nhso_adp_code: '90004' }],
  },
  summary: {
    totalVisits: 2,
    uniquePatients: 2,
    compensatedVisits: 1,
    uncompensatedVisits: 1,
    compensationRate: 50.0,
    totalCompensated: 150.0,
    averageCompensated: 150.0,
    withAuthenCount: 1,
    withoutAuthenCount: 1,
    authenRate: 50.0,
    ucCount: 1,
    ucRate: 50.0,
    totalIncome: 500.0,
  },
  items: [
    {
      no: 1,
      vn: '691001083000',
      cid: '1529900012345',
      hn: '0012345',
      ptname: 'นายสมชาย ใจดี',
      age: 52,
      nation: 'ไทย',
      vstdate: '2026-10-01',
      vsttime: '08:30:00',
      authencode: 'AUTH1234',
      maininscl: 'UCS',
      isUc: true,
      pttypename: 'บัตรทอง ทั่วไป',
      department: 'งานทันตกรรม',
      clinic: 'ทันตกรรม',
      pdx: 'K132',
      dx0: null,
      dx1: null,
      dx2: null,
      dx3: null,
      dx4: null,
      dx5: null,
      sdx: null,
      op0: '8902',
      op1: null,
      op2: null,
      op3: null,
      op4: null,
      op5: null,
      ops: '8902',
      income: 300,
      listname: 'คัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก',
      status: 'Rep :: มี Rep แล้ว',
      rep: 'REP691001',
      compensated: 150,
      isCompensated: true,
      fund: 'OP_PP',
      subfund: 'ORAL_CA',
    },
    {
      no: 2,
      vn: '691002094500',
      cid: '1529900067890',
      hn: '0067890',
      ptname: 'นางสมศรี มีสุข',
      age: 45,
      nation: 'ไทย',
      vstdate: '2026-10-02',
      vsttime: '09:45:00',
      authencode: null,
      maininscl: 'OFC',
      isUc: false,
      pttypename: 'ข้าราชการ กรมบัญชีกลาง',
      department: 'งานทันตกรรม',
      clinic: 'ทันตกรรม',
      pdx: 'Z012',
      dx0: null,
      dx1: null,
      dx2: null,
      dx3: null,
      dx4: null,
      dx5: null,
      sdx: null,
      op0: null,
      op1: null,
      op2: null,
      op3: null,
      op4: null,
      op5: null,
      ops: null,
      income: 200,
      listname: 'คัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก',
      status: null,
      rep: null,
      compensated: 0,
      isCompensated: false,
      fund: null,
      subfund: null,
    },
  ],
}

describe('OralCancerScreeningClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('vn-details')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                header: {
                  vn: '691001083000',
                  hn: '0012345',
                  cid: '1529900012345',
                  ptname: 'นายสมชาย ใจดี',
                  age: 52,
                  sex: 'ชาย',
                  vstdate: '2026-10-01',
                  vsttime: '08:30:00',
                  pttypename: 'บัตรทอง',
                  department: 'งานทันตกรรม',
                  clinic: 'ทันตกรรม',
                },
                diagnoses: [
                  {
                    icd10: 'K132',
                    icd_name: 'Leukoplakia',
                    diagtype: '1',
                    diagtype_name: 'Principal Diagnosis',
                    doctor_name: 'ทพ. สมเกียรติ ฟันสวย',
                  },
                ],
                screen: {
                  bps: 120,
                  bpd: 80,
                  pulse: 72,
                  cc: 'มาตรวจสุขภาพช่องปากประจำปี',
                  hpi: 'ตรวจพบฝ้าขาวที่กระพุ้งแก้ม',
                  pe: 'U/D: HT\r\n\r\nI/O:\r\n- 42-43 edentulous area, normal soft tissue\r\n\r\nTx: Q4 Surgical debridement\r\n- Flap operation\r\n\r\nPlan: ตัดไหม',
                  bw: 65,
                  height: 168,
                  bmi: 23.0,
                  rr: 18,
                  temperature: 36.6,
                  spo2: 98,
                  fbs: null,
                  pmh: 'โรคประจำตัว HT\r\nปฏิเสธการแพ้ยา',
                  screen_dep: null,
                  screen_dep_name: null,
                  symptom: null,
                },
                orders: {
                  items: [],
                  categories: [],
                  total_price: 300,
                  total_items: 1,
                  total_paid: 0,
                  total_claim: 300,
                },
              },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockReportData }),
      })
    })
  })

  it('renders title, badge, and date tabs in exact order: กำหนดเอง, เดือน, ปีงบประมาณ', async () => {
    render(<OralCancerScreeningClient />)

    expect(
      await screen.findByRole('heading', { level: 1, name: /12.1 คัดกรองรอยโรคมะเร็งช่องปาก/ })
    ).toBeInTheDocument()

    // Assert date tabs order: กำหนดเอง -> เดือน -> ปีงบประมาณ
    const dateTabs = screen.getAllByRole('tab')
    expect(dateTabs).toHaveLength(3)
    expect(dateTabs[0]).toHaveTextContent('กำหนดเอง')
    expect(dateTabs[1]).toHaveTextContent('เดือน')
    expect(dateTabs[2]).toHaveTextContent('ปีงบประมาณ')
  })

  it('renders interactive KPI summary cards and enables filtering via card click', async () => {
    render(<OralCancerScreeningClient />)

    // Wait for data fetch
    expect(await screen.findByText('นายสมชาย ใจดี')).toBeInTheDocument()

    // KPI cards
    const allCard = screen.getByRole('button', { name: /ตัวกรอง: ผู้รับบริการทั้งหมด/ })
    const compCard = screen.getByRole('button', { name: /ตัวกรอง: ได้รับการชดเชยแล้ว/ })
    const uncompCard = screen.getByRole('button', { name: /ตัวกรอง: รอชดเชย \/ ยังไม่ชดเชย/ })
    const authenCard = screen.getByRole('button', { name: /ตัวกรอง: มี Authen Code/ })
    const noAuthenCard = screen.getByRole('button', { name: /ตัวกรอง: ไม่มี Authen Code/ })
    const ucCard = screen.getByRole('button', { name: /ตัวกรอง: สิทธิบัตรทอง/ })

    expect(allCard).toBeInTheDocument()
    expect(compCard).toBeInTheDocument()
    expect(uncompCard).toBeInTheDocument()
    expect(authenCard).toBeInTheDocument()
    expect(noAuthenCard).toBeInTheDocument()
    expect(ucCard).toBeInTheDocument()

    // Click on compensated card to trigger filter
    fireEvent.click(compCard)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardFilter=COMPENSATED'),
        expect.any(Object)
      )
    })
  })

  it('filters data by search input', async () => {
    render(<OralCancerScreeningClient />)

    expect(await screen.findByText('นายสมชาย ใจดี')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/พิมพ์คำค้นหา/i)
    fireEvent.change(searchInput, { target: { value: '0012345' } })

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=0012345'),
          expect.any(Object)
        )
      },
      { timeout: 1000 }
    )
  })

  it('opens detail modal when clicking record row directly', async () => {
    render(<OralCancerScreeningClient />)

    const patientRow = await screen.findByText('นายสมชาย ใจดี')
    expect(patientRow).toBeInTheDocument()

    // Click the record row directly
    fireEvent.click(patientRow)

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: /รายละเอียดการรับบริการคัดกรองมะเร็งช่องปาก/,
      })
    ).toBeInTheDocument()

    // Assert CID displays without delimiter
    expect(screen.getAllByText('1529900012345').length).toBeGreaterThan(0)
    expect(screen.queryByText('1-5299-00012-34-5')).not.toBeInTheDocument()

    // Switch to clinical tab
    const clinicalTabBtn = screen.getByRole('button', { name: /เวชระเบียนคลินิก \(HOSxP\)/ })
    fireEvent.click(clinicalTabBtn)

    expect(await screen.findByText('ทพ. สมเกียรติ ฟันสวย')).toBeInTheDocument()
    expect(screen.getByText('มาตรวจสุขภาพช่องปากประจำปี')).toBeInTheDocument()

    // Assert Structured PE rendered
    expect(screen.getByText(/โรคประจำตัว \(Underlying Disease\)/)).toBeInTheDocument()
    expect(screen.getByText(/การตรวจภายในช่องปาก \(Intraoral Exam\)/)).toBeInTheDocument()
    expect(screen.getByText(/การรักษา \/ หัตถการผ่าตัดและตัดชิ้นเนื้อ/)).toBeInTheDocument()

    // Toggle to raw text view
    const rawBtn = screen.getByRole('button', { name: 'ข้อความต้นฉบับ' })
    fireEvent.click(rawBtn)
    expect(screen.getByText(/42-43 edentulous area, normal soft tissue/)).toBeInTheDocument()

    // Toggle back to structured view
    const structuredBtn = screen.getByRole('button', { name: /จัดหมวดหมู่อ่านง่าย/ })
    fireEvent.click(structuredBtn)
    expect(screen.getByText(/การตรวจภายในช่องปาก \(Intraoral Exam\)/)).toBeInTheDocument()
  })

  it('displays warning banner when ADP 90004 mapping is missing', async () => {
    ;(global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              ...mockReportData,
              adpMapping: { isMapped: false, mappedCount: 0, items: [] },
            },
          }),
      })
    )

    render(<OralCancerScreeningClient />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ยังไม่ได้ Map ADP Code: ไม่พบรหัส 90004'
    )
  })
})

describe('parsePhysicalExam helper', () => {
  it('correctly parses dental clinical sections from sample VN 691028063848', () => {
    const rawPe = `U/D: HT

I/O:
- 42-43 edentulous area, normal soft tissue, pus D/C from buccal aspect
- 44-46 edentulous area, bad granulation tissue at crestal, with pus D/C
- 48 edentulous area, bad granulation tissue seen at crestal

OPG. Periapical:
- No residual root
- Radiolucent area of old Ext socket, no corticated border

Hx of Tx:
- ต้นเดือน 2/69 -> Ext 42 43 44
- 16/2/69 -> Ext 45 46 47 48
- 07/4/69 -> SR residual root 46 + enuc lesion 44-46 area -> patho: abscess and granulation tissue
- Pus on and off มาเรื่อยๆ

DDx:
1. Infected granulation tissue
2. Residual cyst

Tx: Q4 Surgical debridement + excisional biopsy
- LA c 4% articaine HCl c 1:100,000 epi 1.7x3 ml
- Flap operation
- Enucleation intrabony lesion from 42-43 area
- Photo

N/V: ตัดไหม
Plan long term F/U ดู bone healing ต่อไป`

    const sections = parsePhysicalExam(rawPe)
    expect(sections).toHaveLength(7)
    expect(sections[0].title).toBe('โรคประจำตัว (Underlying Disease)')
    expect(sections[0].badgeText).toBe('ประวัติโรค')
    expect(sections[0].items).toContain('HT')

    expect(sections[1].title).toBe('การตรวจภายในช่องปาก (Intraoral Exam)')
    expect(sections[1].badgeText).toBe('ตรวจในช่องปาก')
    expect(sections[1].items).toHaveLength(3)

    expect(sections[2].title).toBe('ภาพถ่ายรังสี / เอกซเรย์ (OPG & Periapical Film)')
    expect(sections[2].badgeText).toBe('รังสีวินิจฉัย')

    expect(sections[3].title).toBe('ประวัติการรักษาเดิม (Treatment History)')
    expect(sections[3].badgeText).toBe('ประวัติการรักษา')

    expect(sections[4].title).toBe('การวินิจฉัยแยกโรค (Differential Diagnosis)')
    expect(sections[4].badgeText).toBe('ข้อวินิจฉัย')

    expect(sections[5].title).toBe('การรักษา / หัตถการผ่าตัดและตัดชิ้นเนื้อ (Treatment & Biopsy)')
    expect(sections[5].badgeText).toBe('หัตถการ/ผ่าตัด')

    expect(sections[6].title).toBe('แผนการรักษาต่อเนื่องและการนัดหมาย (Plan / Next Visit)')
    expect(sections[6].badgeText).toBe('แผนการดูแล')
    expect(sections[6].items).toEqual(['ตัดไหม', 'long term F/U ดู bone healing ต่อไป'])
  })

  it('handles empty or null string gracefully', () => {
    expect(parsePhysicalExam(null)).toEqual([])
    expect(parsePhysicalExam('')).toEqual([])
    expect(parsePhysicalExam('   ')).toEqual([])
  })

  it('handles unstructured text as general exam notes', () => {
    const raw = 'ตรวจช่องปากทั่วไป ไม่พบรอยโรคผิดปกติ เยื่อบุผิวสีชมพู'
    const sections = parsePhysicalExam(raw)
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('บันทึกการตรวจร่างกายทั่วไป')
    expect(sections[0].items).toEqual(['ตรวจช่องปากทั่วไป ไม่พบรอยโรคผิดปกติ เยื่อบุผิวสีชมพู'])
  })
})
