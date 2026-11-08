import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'

export default async function ClopidogrelIndexPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/clopidogrel/usage')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  redirect('/service/dashboard-rcm/funds/clopidogrel/usage')
}
