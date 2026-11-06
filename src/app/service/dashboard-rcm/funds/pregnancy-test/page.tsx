import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'

export default async function DashboardRcmFundsPregnancyTestIndexPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  redirect('/service/dashboard-rcm/funds/pregnancy-test/1')
}
