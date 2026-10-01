import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PrintTaskClient from '@/app/member/inbox/[id]/print/PrintTaskClient'

export const dynamic = 'force-dynamic'

export default async function PrintMediaRequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  const { id: taskId } = await params

  return <PrintTaskClient taskId={taskId} />
}
