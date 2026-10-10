import { getAuthenticatedMember } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { RduService } from '@/lib/rdu/rduService'
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

  // Fetch initial folders and files via RduService
  const initialFolders = await RduService.getFolderTree({ isActiveOnly: false })

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
