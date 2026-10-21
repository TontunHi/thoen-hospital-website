import { Rh1BudgetService, THOEN_HOSPITAL_CODE } from '@/lib/budget/rh1BudgetService'
import Rh1BudgetTrackerClient from './Rh1BudgetTrackerClient'

export const metadata = {
  title: 'ผลงานชดเชย เขต 1 (MIS HOS เขต 1) | โรงพยาบาลเถิน',
  description: 'ระบบติดตามและกำกับผลงานงบประมาณรายกองทุน โรงพยาบาลเถิน เปรียบเทียบมาตรฐานเขตสุขภาพที่ 1',
}

export default async function Rh1BudgetTrackerPage() {
  const initialYears = Rh1BudgetService.getAvailableFiscalYears()
  const defaultYear = initialYears.includes('2570') ? '2570' : initialYears[0] || '2569'

  const dataset2570 = Rh1BudgetService.getDataset('2570')
  const dataset2569 = Rh1BudgetService.getDataset('2569')

  return (
    <Rh1BudgetTrackerClient
      datasets={{
        '2570': dataset2570,
        '2569': dataset2569,
      }}
      initialYears={initialYears}
      defaultYear={defaultYear}
      defaultHospitalCode={THOEN_HOSPITAL_CODE}
    />
  )
}
