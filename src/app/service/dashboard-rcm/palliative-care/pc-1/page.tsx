import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PalliativeCarePc1Client from './PalliativeCarePc1Client'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: 'Palliative Care End Of Life (PC.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'บริการ Palliative Care End Of Life (PC.1) โรงพยาบาลเถิน',
}

export default async function PalliativeCarePc1Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData = null

  try {
    initialData = await RcmDashboardService.getPalliativeCarePc1Report({
      ds1: defaultRange.startDate,
      ds2: defaultRange.endDate,
      paidStatus: 'ALL',
    })
  } catch (error) {
    console.error('Failed to prefetch Palliative Care PC.1 SSR data:', error)
  }

  return <PalliativeCarePc1Client initialData={initialData} initialRange={defaultRange} />
}
