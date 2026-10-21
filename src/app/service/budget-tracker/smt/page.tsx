import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { SmtBudgetService } from '@/lib/budget/smtBudgetService'
import SmtBudgetTrackerClient from './SmtBudgetTrackerClient'

export const metadata = {
  title: 'ติดตามงบ สปสช. (SMT Dashboard) | โรงพยาบาลเถิน',
  description: 'ระบบติดตามและวิเคราะห์ข้อมูลงบประมาณจากระบบ Smart Monitoring & Tracking (SMT) สปสช.',
}

export default async function SmtBudgetTrackerPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  // Pre-fetch initial data for current fiscal year 2570 with fallback
  let initialData = null
  try {
    initialData = await SmtBudgetService.searchBudget({
      budgetYears: ['2570'],
      vendorId5Digit: '11152',
    })
  } catch (err) {
    // If upstream SMT is temporarily down, provide safe fallback
    initialData = {
      source: 'fallback_cache' as const,
      fetchedAt: Date.now(),
      summary: {
        recordCount: 0,
        totalAmount: 0,
        totalNetPayment: 0,
        totalWait: 0,
        totalDebt: 0,
        totalVat: 0,
        totalBond: 0,
        totalOdbt: 0,
      },
      datas: [],
    }
  }

  return (
    <SmtBudgetTrackerClient
      initialData={initialData}
      defaultVendorId="11152"
      defaultYears={['2570']}
    />
  )
}
