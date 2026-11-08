import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'

export default async function ImcIndexPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/rehabilitation/imc')
    return null
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
    return null
  }

  redirect('/service/dashboard-rcm/funds/rehabilitation/imc/eligible-patients')
  return null
}
