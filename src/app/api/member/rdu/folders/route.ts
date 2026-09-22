import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import fs from 'fs/promises'
import path from 'path'

// Helper: Check RDU permissions
async function hasRduPermission(session: { username: string; email: string; role: string }) {
  if (session.role === 'admin') return true
  const members = await queryMemberDb('SELECT position FROM members WHERE username = ? LIMIT 1', [session.username])
  const userPosition = members[0]?.position?.trim()
  if (!userPosition) return false
  const rduPerms = await queryMemberDb(
    "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'manage_rdu' AND TRIM(position_name) = TRIM(?)",
    [userPosition]
  )
  return (rduPerms[0]?.count || 0) > 0
}

// GET: List all folders with their files for the manager
export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session || !(await hasRduPermission(session))) {
      return NextResponse.json({ success: false, error: 'ไม่มีสิทธิ์เข้าถึงส่วนนี้' }, { status: 403 })
    }

    const folders = (await queryMemberDb(
      'SELECT id, folder_name, display_order, is_active, created_at, updated_at FROM rdu_folders ORDER BY id DESC'
    )) as any[]

    if (!folders || folders.length === 0) {
      return NextResponse.json({ success: true, folders: [] })
    }

    const folderIds = folders.map((f) => f.id)
    const placeholders = folderIds.map(() => '?').join(',')

    const files = (await queryMemberDb(
      `SELECT id, folder_id, display_name, file_name, file_path, file_size, display_order, created_at, updated_at 
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

    const result = folders.map((folder) => ({
      ...folder,
      files: filesByFolder[folder.id] || []
    }))

    return NextResponse.json({ success: true, folders: result })
  } catch (error: any) {
    console.error('Error in GET /api/member/rdu/folders:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลโฟลเดอร์' }, { status: 500 })
  }
}

// POST: Create a new folder
export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || !(await hasRduPermission(session))) {
      return NextResponse.json({ success: false, error: 'ไม่มีสิทธิ์สร้างโฟลเดอร์' }, { status: 403 })
    }

    const body = await request.json()
    const folderName = (body.folder_name || '').trim()

    if (!folderName) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุชื่อโฟลเดอร์' }, { status: 400 })
    }

    // Check duplicate
    const existing = await queryMemberDb('SELECT id FROM rdu_folders WHERE folder_name = ?', [folderName])
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: 'มีโฟลเดอร์ชื่อนี้อยู่ในระบบแล้ว' }, { status: 400 })
    }

    // Get max display_order
    const maxOrderRes = await queryMemberDb('SELECT MAX(display_order) as maxOrder FROM rdu_folders')
    const nextOrder = (maxOrderRes[0]?.maxOrder ?? -1) + 1

    // Insert into DB
    const insertResult = await queryMemberDb(
      'INSERT INTO rdu_folders (folder_name, display_order) VALUES (?, ?)',
      [folderName, nextOrder]
    )

    // Create physical directory on disk
    const sanitizedFolderName = folderName.replace(/[\\/:*?"<>|]/g, '_')
    const physicalDirPath = path.join(process.cwd(), 'public', 'documents', 'rdu', sanitizedFolderName)
    await fs.mkdir(physicalDirPath, { recursive: true })

    return NextResponse.json({
      success: true,
      message: 'สร้างโฟลเดอร์เรียบร้อยแล้ว',
      folderId: (insertResult as any).insertId
    })
  } catch (error: any) {
    console.error('Error in POST /api/member/rdu/folders:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการสร้างโฟลเดอร์' }, { status: 500 })
  }
}

// PUT: Update folder name or reorder folders
export async function PUT(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || !(await hasRduPermission(session))) {
      return NextResponse.json({ success: false, error: 'ไม่มีสิทธิ์แก้ไขโฟลเดอร์' }, { status: 403 })
    }

    const body = await request.json()

    // Case 1: Reorder multiple folders: { action: 'reorder', orders: [{ id: 1, display_order: 0 }, ...] }
    if (body.action === 'reorder' && Array.isArray(body.orders)) {
      for (const item of body.orders) {
        if (item.id !== undefined && item.display_order !== undefined) {
          await queryMemberDb('UPDATE rdu_folders SET display_order = ? WHERE id = ?', [
            item.display_order,
            item.id
          ])
        }
      }
      return NextResponse.json({ success: true, message: 'ปรับปรุงลำดับโฟลเดอร์เรียบร้อยแล้ว' })
    }

    // Case 2: Update folder name
    const folderId = body.id
    const newFolderName = (body.folder_name || '').trim()

    if (!folderId || !newFolderName) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    const existing = await queryMemberDb('SELECT folder_name FROM rdu_folders WHERE id = ?', [folderId])
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: 'ไม่พบโฟลเดอร์ที่ต้องการแก้ไข' }, { status: 404 })
    }

    const oldFolderName = existing[0].folder_name

    if (oldFolderName !== newFolderName) {
      // Check collision
      const checkDup = await queryMemberDb('SELECT id FROM rdu_folders WHERE folder_name = ? AND id != ?', [
        newFolderName,
        folderId
      ])
      if (checkDup.length > 0) {
        return NextResponse.json({ success: false, error: 'มีโฟลเดอร์ชื่อนี้อยู่แล้ว' }, { status: 400 })
      }

      // Rename physical folder if exists
      const oldSanitized = oldFolderName.replace(/[\\/:*?"<>|]/g, '_')
      const newSanitized = newFolderName.replace(/[\\/:*?"<>|]/g, '_')
      const oldPath = path.join(process.cwd(), 'public', 'documents', 'rdu', oldSanitized)
      const newPath = path.join(process.cwd(), 'public', 'documents', 'rdu', newSanitized)

      try {
        await fs.access(oldPath)
        await fs.rename(oldPath, newPath)
      } catch (err) {
        // If oldPath does not exist, ensure newPath exists
        await fs.mkdir(newPath, { recursive: true })
      }

      // Update file_paths in rdu_files
      const files = await queryMemberDb('SELECT id, file_name FROM rdu_files WHERE folder_id = ?', [folderId])
      for (const f of files) {
        const updatedFilePath = `/documents/rdu/${encodeURIComponent(newSanitized)}/${encodeURIComponent(f.file_name)}`
        await queryMemberDb('UPDATE rdu_files SET file_path = ? WHERE id = ?', [updatedFilePath, f.id])
      }

      await queryMemberDb('UPDATE rdu_folders SET folder_name = ? WHERE id = ?', [newFolderName, folderId])
    }

    return NextResponse.json({ success: true, message: 'แก้ไขชื่อโฟลเดอร์เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error in PUT /api/member/rdu/folders:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขโฟลเดอร์' }, { status: 500 })
  }
}

// DELETE: Delete folder and its physical directory
export async function DELETE(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || !(await hasRduPermission(session))) {
      return NextResponse.json({ success: false, error: 'ไม่มีสิทธิ์ลบโฟลเดอร์' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('id')

    if (!folderId) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ id ของโฟลเดอร์' }, { status: 400 })
    }

    const folderRes = await queryMemberDb('SELECT folder_name FROM rdu_folders WHERE id = ?', [folderId])
    if (folderRes.length === 0) {
      return NextResponse.json({ success: false, error: 'ไม่พบโฟลเดอร์' }, { status: 404 })
    }

    const folderName = folderRes[0].folder_name

    // Delete folder record from database (cascade deletes files)
    await queryMemberDb('DELETE FROM rdu_folders WHERE id = ?', [folderId])

    // Delete physical folder on disk
    const sanitized = folderName.replace(/[\\/:*?"<>|]/g, '_')
    const physicalPath = path.join(process.cwd(), 'public', 'documents', 'rdu', sanitized)
    try {
      await fs.rm(physicalPath, { recursive: true, force: true })
    } catch (err) {
      console.warn('Could not remove physical folder:', err)
    }

    return NextResponse.json({ success: true, message: 'ลบโฟลเดอร์และไฟล์ทั้งหมดเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error in DELETE /api/member/rdu/folders:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบโฟลเดอร์' }, { status: 500 })
  }
}
