import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import RduManagerClient from './RduManagerClient'
import './rdu-manager.css'

export const dynamic = 'force-dynamic'

export default async function RduManagerPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  // Get member details including position from DB
  const members = await queryMemberDb(
    'SELECT id, username, name, position, role FROM members WHERE username = ? LIMIT 1',
    [session.username]
  )

  if (!members || members.length === 0) {
    redirect('/member/login')
  }

  const member = members[0]

  // Check permission: admin or manage_rdu
  let isAuthorized = member.role === 'admin'
  if (!isAuthorized && member.position) {
    const rduPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'manage_rdu' AND TRIM(position_name) = TRIM(?)",
      [member.position]
    )
    isAuthorized = (rduPerms[0]?.count || 0) > 0
  }

  if (!isAuthorized) {
    redirect('/unauthorized')
  }

  // Check if feature is enabled by admin
  const settingsRows = await queryMemberDb("SELECT config_value FROM member_system_settings WHERE config_key = 'feature_rdu'")
  const isFeatureEnabled = settingsRows.length === 0 || settingsRows[0].config_value !== '0'

  if (!isFeatureEnabled && member.role !== 'admin') {
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
