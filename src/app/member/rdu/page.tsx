import { getAuthenticatedMember } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
import { redirect } from 'next/navigation'
import RduManagerClient from './RduManagerClient'
import './rdu-manager.css'

export const dynamic = 'force-dynamic'

export default async function RduManagerPage() {
  const member = await getAuthenticatedMember({
    requiredPermission: 'manage_rdu',
    redirectTo: '/unauthorized',
  })

  if (!member.hasAccess('feature_rdu')) {
    redirect('/member')
  }

  // Fetch initial folders and files (latest to oldest)
  let initialFolders: any[] = []
  try {
    initialFolders = await apiGateway.app.getRduTree({ includeInactive: true })
  } catch (err) {
    console.error('Failed to load initial RDU folders:', err)
  }

  return (
    <div className="rduManagerContainer">
      <div className="glowOrb rduOrb1"></div>
      <div className="glowOrb rduOrb2"></div>
      <div className="rduManagerWrapper">
        <RduManagerClient initialFolders={initialFolders} userRole={member.role} />
      </div>
    </div>
  )
}
