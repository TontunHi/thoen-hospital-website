import { getAuthenticatedMember } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import TaskDetailClient from './TaskDetailClient'
import '../inbox.css'

export const dynamic = 'force-dynamic'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const member = await getAuthenticatedMember()
  if (!member) {
    redirect('/member/login')
  }

  const { id } = await params

  return (
    <div className="inboxPageContainer">
      <TaskDetailClient taskId={id} sessionUser={member.toDto()} />
    </div>
  )
}
