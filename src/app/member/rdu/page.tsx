import { getAuthenticatedMember } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
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
  const folders = (await queryMemberDb(
    'SELECT id, folder_name, display_order, is_active FROM rdu_folders ORDER BY id DESC'
  )) as any[]

  let initialFolders: any[] = []

  if (folders && folders.length > 0) {
    const folderIds = folders.map((f) => f.id)
    const placeholders = folderIds.map(() => '?').join(',')
    const files = (await queryMemberDb(
      `SELECT id, folder_id, display_name, file_name, file_path, file_size, display_order, created_at 
       FROM rdu_files 
       WHERE folder_id IN (${placeholders}) 
       ORDER BY display_order ASC, id ASC`,
      folderIds
    )) as any[]

    const filesByFolder: Record<number, any[]> = {}
    files.forEach((file) => {
      if (!filesByFolder[file.folder_id]) {
        filesByFolder[file.folder_id] = []
      }
      filesByFolder[file.folder_id].push(file)
    })

    initialFolders = folders.map((f) => ({
      ...f,
      files: filesByFolder[f.id] || []
    }))
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
