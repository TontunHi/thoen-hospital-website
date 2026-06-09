import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import NewPRRequestClient from './NewPRRequestClient'

export default async function NewPRRequestPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  // Get current logged-in member details to prefill the form
  const members = await queryMemberDb(
    'SELECT id, name, department, position, username FROM members WHERE username = ? AND email = ? LIMIT 1',
    [session.username, session.email]
  )

  if (members.length === 0) {
    redirect('/member/login')
  }

  const requester = members[0]

  return <NewPRRequestClient requester={requester} />
}
