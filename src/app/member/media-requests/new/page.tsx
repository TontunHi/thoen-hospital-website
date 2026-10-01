import { getAuthenticatedMember } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import MediaRequestFormClient from './MediaRequestFormClient'
import './mediaRequest.css'

export const dynamic = 'force-dynamic'

export default async function NewMediaRequestPage() {
  const member = await getAuthenticatedMember({
    requiredFeature: 'feature_media_request',
    redirectTo: '/unauthorized',
  })

  if (member.role === 'subdistrict') {
    redirect('/member')
  }

  const currentMember = {
    id: member.id,
    username: member.username,
    name: member.name || member.username,
    department: member.department || '',
    position: member.position || '',
  }

  return (
    <div className="mediaFormPageWrapper">
      <MediaRequestFormClient currentUser={currentMember} />
    </div>
  )
}
