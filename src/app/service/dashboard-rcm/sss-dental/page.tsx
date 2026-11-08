import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { RcmDashboardService, getDefaultFiscalYearDateRange, type SssDentalResult } from '@/lib/clinical/rcmDashboardService'
import SssDentalClient from './SssDentalClient'

export const metadata = {
  title: 'ทันตกรรมประกันสังคม (2.1.1.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานการให้บริการทันตกรรมสิทธิ์ประกันสังคม โรงพยาบาลเถิน จำแนกตามทันตแพทย์',
}

export default async function SssDentalPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData: SssDentalResult | null = null
  try {
    initialData = await RcmDashboardService.getSssDentalReport({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      fetchVisits: false,
    })
  } catch {
    initialData = null
  }

  return <SssDentalClient initialData={initialData} initialRange={defaultRange} />
}
