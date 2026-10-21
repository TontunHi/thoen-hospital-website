import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Rh1BudgetTrackerClient from '../rh1/Rh1BudgetTrackerClient'
import BudgetTrackerNav from '../BudgetTrackerNav'
import { Rh1BudgetService, THOEN_HOSPITAL_CODE } from '@/lib/budget/rh1BudgetService'

describe('BudgetTrackerNav Component', () => {
  it('renders navigation tabs for MIS HOS เขต 1, SMT Dashboard, MIS HOS สปสช., and Planfin', () => {
    render(<BudgetTrackerNav />)

    const rh1Tab = screen.getByRole('tab', { name: /ผลงานชดเชย เขต 1 \(MIS HOS เขต 1\)/ })
    const smtTab = screen.getByRole('tab', { name: /ติดตามงบ สปสช\. \(SMT Dashboard\)/ })
    const misHosTab = screen.getByRole('tab', { name: /MIS HOS สปสช\. \(ส่วนกลาง\)/ })
    const planfinTab = screen.getByRole('tab', { name: /แหล่งงบประมาณอื่น \(Planfin \/ งบลงทุน\)/ })

    expect(rh1Tab).toBeDefined()
    expect(smtTab).toBeDefined()
    expect(misHosTab).toBeDefined()
    expect(planfinTab).toBeDefined()
    expect(rh1Tab.getAttribute('href')).toBe('/service/budget-tracker/rh1')
    expect(smtTab.getAttribute('href')).toBe('/service/budget-tracker/smt')
    expect(misHosTab.getAttribute('href')).toBe('/service/budget-tracker/mishos')
    expect(planfinTab.getAttribute('href')).toBe('/service/budget-tracker/planfin')
  })
})

describe('Rh1BudgetTrackerClient Component', () => {
  const dataset2570 = Rh1BudgetService.getDataset('2570')
  const dataset2569 = Rh1BudgetService.getDataset('2569')
  const initialYears = ['2570', '2569']

  const defaultProps = {
    datasets: {
      '2570': dataset2570,
      '2569': dataset2569,
    },
    initialYears,
    defaultYear: '2570',
    defaultHospitalCode: THOEN_HOSPITAL_CODE,
  }

  it('renders fiscal year switcher and hospital focus banner for Thoen Hospital', () => {
    render(<Rh1BudgetTrackerClient {...defaultProps} />)

    expect(screen.getByText('ปีงบประมาณ:')).toBeDefined()
    expect(screen.getAllByText(/รพ.เถิน/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/ลำปาง/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders all 10 source navigation tabs and switches between them', () => {
    render(<Rh1BudgetTrackerClient {...defaultProps} />)

    // Check all 10 tab headers
    expect(screen.getByRole('tab', { name: /1\. ข้อมูลรายกองทุนย่อย/ })).toBeDefined()
    expect(screen.getByRole('tab', { name: /2\. ข้อมูลการเบิกชดเชยอวัยวะเทียม/ })).toBeDefined()
    expect(screen.getByRole('tab', { name: /3\. ข้อมูลการเบิกชดเชยกองทุนโรคไต/ })).toBeDefined()
    expect(screen.getByRole('tab', { name: /4\. ข้อมูลการเบิกชดเชยผ่าน MOPH CLAIM/ })).toBeDefined()
    expect(screen.getByRole('tab', { name: /5\. ข้อมูลการเบิกชดเชยผ่าน KTB Platform/ })).toBeDefined()
    expect(screen.getByRole('tab', { name: /6\. ข้อมูลการเบิกชดเชยกรมบัญชีกลาง/ })).toBeDefined()
    expect(screen.getByRole('tab', { name: /7\. ข้อมูลการเบิกชดเชย อปท\./ })).toBeDefined()
    expect(screen.getByRole('tab', { name: /8\. ภาพรวมการโอนเงิน/ })).toBeDefined()
    expect(screen.getByRole('tab', { name: /9\. สรุปข้อมูลวิเคราะห์รายโรงพยาบาล/ })).toBeDefined()
    expect(screen.getByRole('tab', { name: /10\. บทสรุปผู้บริหารรายโรงพยาบาล/ })).toBeDefined()

    // Click Tab 9: สรุปข้อมูลวิเคราะห์รายโรงพยาบาล
    const tab9 = screen.getByRole('tab', { name: /9\. สรุปข้อมูลวิเคราะห์รายโรงพยาบาล/ })
    fireEvent.click(tab9)
    expect(screen.getByText(/ผลงานของ รพ\.เถิน แยกตามแหล่งข้อมูล/)).toBeDefined()
    expect(screen.getByText(/เปรียบเทียบทุก รพ\. ในกลุ่ม/)).toBeDefined()

    // Click Tab 10: บทสรุปผู้บริหาร
    const tab10 = screen.getByRole('tab', { name: /10\. บทสรุปผู้บริหารรายโรงพยาบาล/ })
    fireEvent.click(tab10)
    expect(screen.getAllByText(/จุดเด่นที่ทำได้ดี/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/โอกาสพัฒนาเพิ่มรายได้/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/รายการที่ยังไม่ได้เริ่มเบิกชดเชย/).length).toBeGreaterThanOrEqual(1)
  }, 15000)

  it('renders complete original filter dropdowns', () => {
    render(<Rh1BudgetTrackerClient {...defaultProps} />)

    // Check filter labels
    expect(screen.getByText('หมวดข้อมูล / แหล่งงบประมาณ')).toBeDefined()
    expect(screen.getByText('กลุ่มเปรียบเทียบ')).toBeDefined()
    expect(screen.getAllByText('จังหวัด').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ขนาด (A–F3)').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('กลุ่มระดับบริการ (GroupName)').length).toBeGreaterThanOrEqual(1)

    // Fund and metric controls for Tab 1 (L2)
    expect(screen.getByText('วิเคราะห์แบบ')).toBeDefined()
    expect(screen.getByText('กองทุน / รายการ')).toBeDefined()
  })
})
