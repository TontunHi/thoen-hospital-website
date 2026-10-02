import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { DocumentStorage } from '@/lib/storage/documentStorage'

// GET: List all folders with their files for the manager
export async function GET() {
  try {
    const { error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error) return error

    const folders = (await queryMemberDb('SELECT id, folder_name, display_order, is_active, created_at, updated_at FROM rdu_folders ORDER BY id DESC')) as any[]
    if (!folders || folders.length === 0) return NextResponse.json({ success: true, folders: [] })

    const folderIds = folders.map((f) => f.id)
    const placeholders = folderIds.map(() => '?').join(',')

    const files = (await queryMemberDb(`SELECT id, folder_id, display_name, file_name, file_path, file_size, display_order, created_at, updated_at FROM rdu_files WHERE folder_id IN (${placeholders}) ORDER BY display_order ASC, id ASC`, folderIds)) as any[]

    const filesByFolder: Record<number, any[]> = {}
    files.forEach((file) => {
      if (!filesByFolder[file.folder_id]) filesByFolder[file.folder_id] = []
      filesByFolder[file.folder_id].push(file)
    })

    const result = folders.map((folder) => ({ ...folder, files: filesByFolder[folder.id] || [] }))
    return NextResponse.json({ success: true, folders: result })
  } catch (error: any) {
    console.error('Error in GET /api/member/rdu/folders:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลโฟลเดอร์' }, { status: 500 })
  }
}

// POST: Create a new folder
export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error || !member) return error

    const body = await request.json()
    const folderName = (body.folder_name || '').trim()
    if (!folderName) return NextResponse.json({ success: false, error: 'กรุณาระบุชื่อโฟลเดอร์' }, { status: 400 })

    const existing = await queryMemberDb('SELECT id FROM rdu_folders WHERE folder_name = ?', [folderName])
    if (existing.length > 0) return NextResponse.json({ success: false, error: 'มีโฟลเดอร์ชื่อนี้อยู่ในระบบแล้ว' }, { status: 400 })

    const maxOrderRes = await queryMemberDb('SELECT MAX(display_order) as maxOrder FROM rdu_folders')
    const nextOrder = (maxOrderRes[0]?.maxOrder ?? -1) + 1

    const insertResult = await queryMemberDb('INSERT INTO rdu_folders (folder_name, display_order) VALUES (?, ?)', [folderName, nextOrder])

    const sanitizedFolderName = folderName.replace(/[\\/:*?"<>|]/g, '_')
    await DocumentStorage.createDirectory(`public/documents/rdu/${sanitizedFolderName}`)

    return NextResponse.json({ success: true, message: 'สร้างโฟลเดอร์เรียบร้อยแล้ว', folderId: (insertResult as any).insertId })
  } catch (error: any) {
    console.error('Error in POST /api/member/rdu/folders:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการสร้างโฟลเดอร์' }, { status: 500 })
  }
}

// PUT: Update folder name or reorder folders
export async function PUT(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error || !member) return error

    const body = await request.json()
    if (body.action === 'reorder' && Array.isArray(body.orders)) {
      for (const item of body.orders) {
        if (item.id !== undefined && item.display_order !== undefined) {
          await queryMemberDb('UPDATE rdu_folders SET display_order = ? WHERE id = ?', [item.display_order, item.id])
        }
      }
      return NextResponse.json({ success: true, message: 'ปรับปรุงลำดับโฟลเดอร์เรียบร้อยแล้ว' })
    }

    const folderId = body.id
    const newFolderName = (body.folder_name || '').trim()
    if (!folderId || !newFolderName) return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })

    const existing = await queryMemberDb('SELECT folder_name FROM rdu_folders WHERE id = ?', [folderId])
    if (existing.length === 0) return NextResponse.json({ success: false, error: 'ไม่พบโฟลเดอร์ที่ต้องการแก้ไข' }, { status: 404 })

    const oldFolderName = existing[0].folder_name

    if (oldFolderName !== newFolderName) {
      const checkDup = await queryMemberDb('SELECT id FROM rdu_folders WHERE folder_name = ? AND id != ?', [newFolderName, folderId])
      if (checkDup.length > 0) return NextResponse.json({ success: false, error: 'มีโฟลเดอร์ชื่อนี้อยู่แล้ว' }, { status: 400 })

      const oldSanitized = oldFolderName.replace(/[\\/:*?"<>|]/g, '_')
      const newSanitized = newFolderName.replace(/[\\/:*?"<>|]/g, '_')
      
      await DocumentStorage.renameDirectory(`public/documents/rdu/${oldSanitized}`, `public/documents/rdu/${newSanitized}`)

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
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('id')
    if (!folderId) return NextResponse.json({ success: false, error: 'กรุณาระบุ id ของโฟลเดอร์' }, { status: 400 })

    const folderRes = await queryMemberDb('SELECT folder_name FROM rdu_folders WHERE id = ?', [folderId])
    if (folderRes.length === 0) return NextResponse.json({ success: false, error: 'ไม่พบโฟลเดอร์' }, { status: 404 })

    await queryMemberDb('DELETE FROM rdu_folders WHERE id = ?', [folderId])
    
    const sanitized = folderRes[0].folder_name.replace(/[\\/:*?"<>|]/g, '_')
    await DocumentStorage.deleteDirectory(`public/documents/rdu/${sanitized}`)

    return NextResponse.json({ success: true, message: 'ลบโฟลเดอร์และไฟล์ทั้งหมดเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error in DELETE /api/member/rdu/folders:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบโฟลเดอร์' }, { status: 500 })
  }
}
