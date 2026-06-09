import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import ApprovalsInboxClient from './ApprovalsInboxClient'

export default async function MemberApprovalsInboxPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <ApprovalsInboxClient />
}
