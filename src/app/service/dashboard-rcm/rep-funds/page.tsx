import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { RcmRepFundsService, type RepFundsSummaryResult } from '@/lib/clinical/rcmRepFundsService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import RepFundsClient from './RepFundsClient'

export const metadata = {
  title: 'ข้อมูล Rep แต่ละกองทุน (3.1.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานการชดเชยค่าบริการทางการแพทย์จาก สปสช. (REP) จำแนกตามกองทุนหลัก กองทุนย่อย และระบบค้นหารายบุคคล (HN + วันที่)',
}

export default async function RepFundsPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData: RepFundsSummaryResult | null = null

  try {
    // getRepFundsSummary() calls getAvailableYears() internally and applies the same fallback
    // — no need to fetch years separately here (avoids a waterfall round-trip)
    initialData = await RcmRepFundsService.getRepFundsSummary({
      department: 'ALL',
    })
  } catch {
    initialData = null
  }

  return <RepFundsClient initialSummary={initialData} initialRange={defaultRange} />
}
