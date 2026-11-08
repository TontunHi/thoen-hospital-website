import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PostpartumService72Client from './PostpartumService72Client'
import { RcmPostpartumService } from '@/lib/clinical/rcmPostpartumService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: '7.2 บริการตรวจหลังคลอด (30015) | กองทุน Dashboard-RCM',
  description:
    'รายงาน 7.2 บริการตรวจหลังคลอด รหัส ADP 30015 ตรวจสอบการสั่งใช้รหัส ADP การวินิจฉัย หัตถการ และการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function PostpartumService72Page() {
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
    initialData = await RcmPostpartumService.getService72Report({
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
    console.error('Failed to prefetch Postpartum 7.2 SSR data:', error)
  }

  return <PostpartumService72Client initialData={initialData} initialRange={defaultRange} />
}
