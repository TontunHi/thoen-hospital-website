import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PrintTaskClient from './PrintTaskClient'

export const dynamic = 'force-dynamic'

export default async function PrintTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  const { id } = await params

  return <PrintTaskClient taskId={id} />
}
