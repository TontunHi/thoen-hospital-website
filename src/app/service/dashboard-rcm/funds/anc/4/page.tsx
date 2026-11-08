import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AncService30011Client from './AncService30011Client'
import { RcmAncService } from '@/lib/clinical/rcmAncService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: '2.4 บริการฝากครรภ์ (ANC 30011) | กองทุน Dashboard-RCM',
  description:
    'รายงาน 2.4 บริการฝากครรภ์ (ANC) รหัส ADP 30011 ตรวจสอบการสั่งใช้รหัส ADP การวินิจฉัย หัตถการ และการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function AncService30011Page() {
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
    initialData = await RcmAncService.getService30011Report({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      compensationFilter: 'ALL',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
    })
  } catch (error) {
    console.error('Failed to prefetch ANC 30011 SSR data:', error)
  }

  return <AncService30011Client initialData={initialData} initialRange={defaultRange} />
}
