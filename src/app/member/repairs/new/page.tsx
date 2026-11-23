import { verifyMemberSession } from '@/lib/memberAuth'
import { TaskInboxApiService } from '@/lib/inbox/taskInboxApiService'
import { redirect } from 'next/navigation'
import RepairFormClient from './RepairFormClient'

export const dynamic = 'force-dynamic'

export default async function NewRepairPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  const { currentMember, initialLocations } =
    await TaskInboxApiService.getNewRepairFormPreloadData(session.username)

  return (
    <div className="repairPageWrapper">
      <RepairFormClient
        currentUser={currentMember}
        initialLocations={initialLocations}
      />
    </div>
  )
}
