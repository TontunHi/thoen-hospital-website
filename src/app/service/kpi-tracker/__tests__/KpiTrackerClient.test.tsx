import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { KpiTrackerClient } from '../KpiTrackerClient'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/service/kpi-tracker',
}))

const mockIndicators = [
  {
    id: 1,
    topicId: 1,
    sequence: '1.1',
    category: 'ยุทธศาสตร์ที่1',
    subcategory: 'การพัฒนาบริการ',
    code: 'KPI-001',
    oldCode: null,
    title: 'ร้อยละความพึงพอใจของผู้รับบริการ',
    targetValue: 85,
    targetOperator: 'GTE',
    targetUnit: '%',
    targetLabel: '>= 85%',
    frequency: 'MONTHLY',
    indicatorType: 'ยุทธศาสตร์',
    isAutoCalc: true,
    numeratorName: 'จำนวนผู้พึงพอใจ',
    denominatorName: 'จำนวนผู้ตอบแบบสอบถามทั้งหมด',
    responsibleName: 'งานพัฒนาคุณภาพ',
    responsibleDepartment: 'กลุ่มงานยุทธศาสตร์',
    displayOrder: 1,
    currentEntry: {
      id: 101,
      indicatorId: 1,
      periodKey: '2569-M01',
      numeratorValue: 90,
      denominatorValue: 100,
      resultValue: 90,
      resultText: '90%',
      status: 'PASS',
      note: null,
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  },
  {
    id: 2,
    topicId: 1,
    sequence: '2.1',
    category: 'ยุทธศาสตร์ที่2',
    subcategory: 'การบริหารจัดการ',
    code: 'KPI-002',
    oldCode: null,
    title: 'อัตราการครองเตียง',
    targetValue: 80,
    targetOperator: 'LTE',
    targetUnit: '%',
    targetLabel: '<= 80%',
    frequency: 'MONTHLY',
    indicatorType: 'ยุทธศาสตร์',
    isAutoCalc: true,
    numeratorName: 'วันนอนจริง',
    denominatorName: 'วันนอนเป้าหมาย',
    responsibleName: 'งานบริหาร',
    responsibleDepartment: 'กลุ่มงานบริหารทั่วไป',
    displayOrder: 2,
    currentEntry: {
      id: 102,
      indicatorId: 2,
      periodKey: '2569-M01',
      numeratorValue: 75,
      denominatorValue: 100,
      resultValue: 75,
      resultText: '75%',
      status: 'PASS',
      note: null,
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  },
  {
    id: 3,
    topicId: 1,
    sequence: '3.1',
    category: 'หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ (Healthcare Results)',
    subcategory: 'ความปลอดภัยผู้ป่วย',
    code: 'KPI-003',
    oldCode: null,
    title: 'อัตราการติดเชื้อในโรงพยาบาล',
    targetValue: 1.5,
    targetOperator: 'LTE',
    targetUnit: '%',
    targetLabel: '<= 1.5%',
    frequency: 'MONTHLY',
    indicatorType: 'HA',
    isAutoCalc: false,
    numeratorName: null,
    denominatorName: null,
    responsibleName: 'งาน IC',
    responsibleDepartment: 'กลุ่มงานการพยาบาล',
    displayOrder: 3,
    currentEntry: {
      id: 103,
      indicatorId: 3,
      periodKey: '2569-M01',
      numeratorValue: null,
      denominatorValue: null,
      resultValue: 1.2,
      resultText: '1.2%',
      status: 'PASS',
      note: null,
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  },
]

const mockUser = {
  id: 1,
  username: 'admin',
  name: 'แอดมิน',
  role: 'ADMIN',
  department: 'IT',
  isAdmin: true,
}

describe('KpiTrackerClient - Category Multi-Selector Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/kpi/topics')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              fiscalYears: ['2569', '2568'],
              defaultYear: '2569',
              topics: [
                { id: 1, title: 'ตัวชี้วัดโรงพยาบาลเถิน 2569', fiscalYear: '2569', isCurrent: true }
              ]
            }
          })
        }
      }
      if (url.includes('/api/kpi/indicators')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              indicators: mockIndicators,
              categories: [
                'ยุทธศาสตร์ที่1',
                'ยุทธศาสตร์ที่2',
                'หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ (Healthcare Results)'
              ]
            }
          })
        }
      }
      if (url.includes('/api/kpi/stats')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              totalIndicators: 3,
              totalPass: 3,
              totalFail: 0,
              totalPending: 0,
              totalWaitingTarget: 0,
              evaluatedCount: 3,
              passRate: 100,
              categoryBreakdown: []
            }
          })
        }
      }
      return { ok: false, json: async () => ({}) }
    }))
  })

  it('renders multi-selector button with default "ทั้งหมด" label and opens popover', async () => {
    render(<KpiTrackerClient currentUser={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('ร้อยละความพึงพอใจของผู้รับบริการ')).toBeInTheDocument()
    })

    const triggerBtn = screen.getByRole('combobox', { name: /หมวดหมู่ \/ ยุทธศาสตร์/i })
    expect(triggerBtn).toHaveTextContent('ทั้งหมด (ทุกหมวดและทุกยุทธศาสตร์)')

    // Click trigger to open popover
    fireEvent.click(triggerBtn)
    expect(screen.getByRole('dialog', { name: 'เลือกหมวดหมู่และยุทธศาสตร์' })).toBeInTheDocument()
    expect(screen.getByText('กลุ่มยุทธศาสตร์')).toBeInTheDocument()
    expect(screen.getByText('หมวดหมู่คุณภาพ HA')).toBeInTheDocument()
  })

  it('filters indicators when multiple categories are selected', async () => {
    render(<KpiTrackerClient currentUser={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('ร้อยละความพึงพอใจของผู้รับบริการ')).toBeInTheDocument()
      expect(screen.getByText('อัตราการครองเตียง')).toBeInTheDocument()
      expect(screen.getByText('อัตราการติดเชื้อในโรงพยาบาล')).toBeInTheDocument()
    })

    const triggerBtn = screen.getByRole('combobox', { name: /หมวดหมู่ \/ ยุทธศาสตร์/i })
    fireEvent.click(triggerBtn)

    const dialog = screen.getByRole('dialog', { name: 'เลือกหมวดหมู่และยุทธศาสตร์' })

    // Select "ยุทธศาสตร์ที่1"
    const cat1Option = within(dialog).getByText('ยุทธศาสตร์ที่1')
    fireEvent.click(cat1Option)

    // Now only KPI-001 should be visible
    expect(screen.getByText('ร้อยละความพึงพอใจของผู้รับบริการ')).toBeInTheDocument()
    expect(screen.queryByText('อัตราการครองเตียง')).not.toBeInTheDocument()
    expect(screen.queryByText('อัตราการติดเชื้อในโรงพยาบาล')).not.toBeInTheDocument()

    // Also select "ยุทธศาสตร์ที่2" (multi selector)
    const cat2Option = within(dialog).getByText('ยุทธศาสตร์ที่2')
    fireEvent.click(cat2Option)

    // Now both KPI-001 and KPI-002 should be visible, but NOT KPI-003 (HA)
    expect(screen.getByText('ร้อยละความพึงพอใจของผู้รับบริการ')).toBeInTheDocument()
    expect(screen.getByText('อัตราการครองเตียง')).toBeInTheDocument()
    expect(screen.queryByText('อัตราการติดเชื้อในโรงพยาบาล')).not.toBeInTheDocument()

    // Trigger button should show count of 2
    expect(triggerBtn).toHaveTextContent('เลือก 2 หมวดหมู่ / ยุทธศาสตร์')

    // Active chips should be rendered
    const activeChipsSection = screen.getByLabelText('หมวดหมู่ที่เลือกกรอง')
    expect(activeChipsSection).toBeInTheDocument()
    expect(within(activeChipsSection).getByText('ยุทธศาสตร์ที่1')).toBeInTheDocument()
    expect(within(activeChipsSection).getByText('ยุทธศาสตร์ที่2')).toBeInTheDocument()

    // Click "ล้างตัวกรองทั้งหมด"
    const clearAllBtn = screen.getByRole('button', { name: 'ล้างตัวกรองทั้งหมด' })
    fireEvent.click(clearAllBtn)

    // All indicators should be visible again
    expect(screen.getByText('ร้อยละความพึงพอใจของผู้รับบริการ')).toBeInTheDocument()
    expect(screen.getByText('อัตราการครองเตียง')).toBeInTheDocument()
    expect(screen.getByText('อัตราการติดเชื้อในโรงพยาบาล')).toBeInTheDocument()
  })

  it('selects and deselects entire group when "เลือกทั้งกลุ่ม" is clicked', async () => {
    render(<KpiTrackerClient currentUser={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('ร้อยละความพึงพอใจของผู้รับบริการ')).toBeInTheDocument()
    })

    const triggerBtn = screen.getByRole('combobox', { name: /หมวดหมู่ \/ ยุทธศาสตร์/i })
    fireEvent.click(triggerBtn)

    // Find the group toggle buttons
    const groupToggleBtns = screen.getAllByRole('button', { name: 'เลือกทั้งกลุ่ม' })
    expect(groupToggleBtns.length).toBeGreaterThan(0)

    // Click toggle for strategy group
    fireEvent.click(groupToggleBtns[0])

    // Trigger button should show all strategies selected
    expect(triggerBtn).toHaveTextContent(/เลือก \d+ หมวดหมู่ \/ ยุทธศาสตร์/)

    // HA indicator should be filtered out
    expect(screen.queryByText('อัตราการติดเชื้อในโรงพยาบาล')).not.toBeInTheDocument()
  })
})

describe('KpiTrackerClient - Dynamic Stats Summary based on Filters', () => {
  const dynamicMockIndicators = [
    {
      id: 1,
      topicId: 1,
      sequence: '1.1',
      category: 'ยุทธศาสตร์ที่1',
      subcategory: 'การพัฒนาบริการ',
      code: 'KPI-001',
      oldCode: null,
      title: 'ความพึงพอใจของผู้รับบริการ',
      targetValue: 85,
      targetOperator: 'GTE',
      targetUnit: '%',
      targetLabel: '>= 85%',
      frequency: 'รายเดือน',
      indicatorType: 'ยุทธศาสตร์',
      isAutoCalc: true,
      numeratorName: 'จำนวนผู้พึงพอใจ',
      denominatorName: 'จำนวนผู้ตอบแบบสอบถามทั้งหมด',
      responsibleName: 'แอดมิน',
      responsibleDepartment: 'กลุ่มงานยุทธศาสตร์',
      displayOrder: 1,
      currentEntry: {
        id: 101,
        indicatorId: 1,
        periodKey: '2569-M01',
        resultValue: 90,
        resultText: '90%',
        status: 'PASS',
        note: null,
        updatedAt: '2026-10-15T00:00:00.000Z',
      },
    },
    {
      id: 2,
      topicId: 1,
      sequence: '1.2',
      category: 'ยุทธศาสตร์ที่1',
      subcategory: 'การเงิน',
      code: 'KPI-002',
      oldCode: null,
      title: 'ตัวชี้วัดยังไม่มีรายงานผล',
      targetValue: 80,
      targetOperator: 'GTE',
      targetUnit: '%',
      targetLabel: '>= 80%',
      frequency: 'รายไตรมาส',
      indicatorType: 'ยุทธศาสตร์',
      isAutoCalc: false,
      numeratorName: null,
      denominatorName: null,
      responsibleName: 'ฝ่ายการเงิน',
      responsibleDepartment: 'กลุ่มงานบริหารทั่วไป',
      displayOrder: 2,
      currentEntry: null, // ไม่มีรายงาน
    },
    {
      id: 3,
      topicId: 1,
      sequence: '2.1',
      category: 'ยุทธศาสตร์ที่2',
      subcategory: 'วิจัย',
      code: 'KPI-003',
      oldCode: null,
      title: 'ตัวชี้วัดรอกำหนดเป้าหมาย',
      targetValue: null,
      targetOperator: null,
      targetUnit: null,
      targetLabel: null,
      frequency: 'ราย 6 เดือน',
      indicatorType: 'ยุทธศาสตร์',
      isAutoCalc: false,
      numeratorName: null,
      denominatorName: null,
      responsibleName: 'ฝ่ายวิจัย',
      responsibleDepartment: 'กลุ่มงานยุทธศาสตร์',
      displayOrder: 3,
      currentEntry: {
        id: 103,
        indicatorId: 3,
        periodKey: '2569-H1',
        resultValue: 5,
        resultText: '5 โครงการ',
        status: 'WAITING_TARGET',
        note: null,
        updatedAt: '2026-10-15T00:00:00.000Z',
      },
    },
    {
      id: 4,
      topicId: 1,
      sequence: '3.1',
      category: 'หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ (Healthcare Results)',
      subcategory: 'ความปลอดภัย',
      code: 'KPI-004',
      oldCode: null,
      title: 'อัตราการติดเชื้อรุนแรง',
      targetValue: 1.0,
      targetOperator: 'LTE',
      targetUnit: '%',
      targetLabel: '<= 1.0%',
      frequency: 'รายปี',
      indicatorType: 'HA',
      isAutoCalc: false,
      numeratorName: null,
      denominatorName: null,
      responsibleName: 'งาน IC',
      responsibleDepartment: 'กลุ่มงานการพยาบาล',
      displayOrder: 4,
      currentEntry: {
        id: 104,
        indicatorId: 4,
        periodKey: '2569-Y',
        resultValue: 2.5,
        resultText: '2.5%',
        status: 'FAIL',
        note: null,
        updatedAt: '2026-10-15T00:00:00.000Z',
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/kpi/topics')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              fiscalYears: ['2569'],
              defaultYear: '2569',
              topics: [
                { id: 1, title: 'ตัวชี้วัดโรงพยาบาลเถิน 2569', fiscalYear: '2569', isCurrent: true }
              ]
            }
          })
        }
      }
      if (url.includes('/api/kpi/indicators')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              indicators: dynamicMockIndicators,
              categories: [
                'ยุทธศาสตร์ที่1',
                'ยุทธศาสตร์ที่2',
                'หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ (Healthcare Results)'
              ]
            }
          })
        }
      }
      if (url.includes('/api/kpi/stats')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              totalIndicators: 4,
              totalPass: 1,
              totalFail: 1,
              totalPending: 1,
              totalWaitingTarget: 1,
              evaluatedCount: 2,
              passRate: 50,
              categoryBreakdown: []
            }
          })
        }
      }
      return { ok: false, json: async () => ({}) }
    }))
  })

  it('updates stat cards dynamically when filters are changed', async () => {
    render(<KpiTrackerClient currentUser={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('ความพึงพอใจของผู้รับบริการ')).toBeInTheDocument()
    })

    const statSection = screen.getByRole('region', { name: 'สรุปสถิติตัวชี้วัด' })
    
    const findStatValue = (label: string) => {
      const labelEl = within(statSection).getByText(label)
      const card = labelEl.closest('.kpiStatCard')!
      return card.querySelector('.kpiStatCardValue')!.textContent
    }
    
    // Initially: 4 total, 1 no report, 1 waiting target
    expect(findStatValue('ทั้งหมด')).toBe('4')
    expect(findStatValue('ไม่มีรายงาน')).toBe('1')
    expect(findStatValue('ยังไม่ระบุสถานะ')).toBe('1')

    // 1. Filter by category: "ยุทธศาสตร์ที่1" (contains KPI-001 [PASS] and KPI-002 [noReport])
    const catTrigger = screen.getByRole('combobox', { name: /หมวดหมู่ \/ ยุทธศาสตร์/i })
    fireEvent.click(catTrigger)
    const dialog = screen.getByRole('dialog', { name: 'เลือกหมวดหมู่และยุทธศาสตร์' })
    const cat1Option = within(dialog).getByText('ยุทธศาสตร์ที่1')
    fireEvent.click(cat1Option)

    // Now total should be 2, noReport should be 1, unspecified should be 0
    expect(findStatValue('ทั้งหมด')).toBe('2')
    expect(findStatValue('ไม่มีรายงาน')).toBe('1')
    expect(findStatValue('ยังไม่ระบุสถานะ')).toBe('0')
    expect(within(statSection).getByText('ตัวชี้วัดตามตัวกรองที่เลือก')).toBeInTheDocument()

    // Clear category filter
    const clearAllChips = screen.getByRole('button', { name: 'ล้างตัวกรองทั้งหมด' })
    fireEvent.click(clearAllChips)

    // 2. Filter by search input
    const searchInput = screen.getByPlaceholderText('ค้นหาชื่อตัวชี้วัด...')
    fireEvent.change(searchInput, { target: { value: 'รอกำหนดเป้าหมาย' } })

    await waitFor(() => {
      // KPI-003 is the only match (total = 1, noReport = 0, unspecified = 1)
      expect(findStatValue('ทั้งหมด')).toBe('1')
      expect(findStatValue('ไม่มีรายงาน')).toBe('0')
      expect(findStatValue('ยังไม่ระบุสถานะ')).toBe('1')
      expect(screen.getByText('ตัวชี้วัดรอกำหนดเป้าหมาย')).toBeInTheDocument()
    })

    // Clear search and wait for all indicators to reappear
    fireEvent.change(searchInput, { target: { value: '' } })
    await waitFor(() => {
      expect(findStatValue('ทั้งหมด')).toBe('4')
    })

    // 3. Filter by tab "ที่ฉันรับผิดชอบ" (matches 'แอดมิน' -> only KPI-001: total 1, noReport 0, unspecified 0)
    const myTab = screen.getByRole('button', { name: 'ที่ฉันรับผิดชอบ' })
    fireEvent.click(myTab)

    await waitFor(() => {
      expect(findStatValue('ทั้งหมด')).toBe('1')
      expect(findStatValue('ไม่มีรายงาน')).toBe('0')
      expect(findStatValue('ยังไม่ระบุสถานะ')).toBe('0')
      expect(screen.getByText('ความพึงพอใจของผู้รับบริการ')).toBeInTheDocument()
      expect(screen.queryByText('ตัวชี้วัดยังไม่มีรายงานผล')).not.toBeInTheDocument()
    })
  })

  it('displays answer and bottom-right timestamp for answered indicators, and hides them when waiting for a new round', async () => {
    render(<KpiTrackerClient currentUser={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('ความพึงพอใจของผู้รับบริการ')).toBeInTheDocument()
    })

    // Header has "ผลงาน" column
    expect(screen.getByRole('columnheader', { name: 'ผลงาน' })).toBeInTheDocument()

    // KPI-001 has answer: 90% and timestamp (rendered in both desktop cell and mobile card)
    expect(screen.getAllByText('90%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/ตอบเมื่อ 15 ต\.ค\. 2569/).length).toBeGreaterThanOrEqual(1)

    // KPI-003 has answer: 5 โครงการ and timestamp
    expect(screen.getAllByText('5 โครงการ').length).toBeGreaterThanOrEqual(1)

    // KPI-002 has no answer for this round -> shows '-' and does not have timestamp
    expect(screen.getByText('ตัวชี้วัดยังไม่มีรายงานผล')).toBeInTheDocument()
    const kpi2Row = screen.getByText('ตัวชี้วัดยังไม่มีรายงานผล').closest('.kpiGridRow')! as HTMLElement
    expect(within(kpi2Row).queryByText(/ตอบเมื่อ/)).not.toBeInTheDocument()
    expect(within(kpi2Row).getAllByText('ไม่มีรายงาน').length).toBeGreaterThanOrEqual(1)
  })
})

