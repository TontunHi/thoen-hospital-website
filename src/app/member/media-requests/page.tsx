import { getAuthenticatedMember } from '@/lib/memberAuth'
import { TaskInboxApiService } from '@/lib/inbox/taskInboxApiService'
import { redirect } from 'next/navigation'
import MediaRequestsListClient from './MediaRequestsListClient'
import './mediaRequests.css'

export const dynamic = 'force-dynamic'

export default async function MediaRequestsPage() {
  const member = await getAuthenticatedMember({
    requiredFeature: 'feature_media_request',
    redirectTo: '/unauthorized',
  })

  if (member.role === 'subdistrict') {
    redirect('/member')
  }

  const { parsedTasks, canViewAll } =
    await TaskInboxApiService.getInitialMediaRequestsForMember(member)

  return (
    <div className="mediaRequestsPageContainer">
      <MediaRequestsListClient initialTasks={parsedTasks} canViewAll={canViewAll} />
    </div>
  )
}
