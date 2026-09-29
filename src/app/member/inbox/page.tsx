import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import InboxClient from './InboxClient'
import './inbox.css'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  return (
    <div className="inboxPageContainer">
      <InboxClient sessionUser={session} />
    </div>
  )
}
