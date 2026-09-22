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

// POST: Upload PDF file to a folder
export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || !(await hasRduPermission(session))) {
      return NextResponse.json({ success: false, error: 'ไม่มีสิทธิ์อัปโหลดไฟล์' }, { status: 403 })
    }

    const formData = await request.formData()
    const folderId = formData.get('folder_id') as string
    const file = formData.get('file') as File | null
    const customDisplayName = formData.get('display_name') as string | null

    if (!folderId || !file) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุโฟลเดอร์และเลือกไฟล์ PDF' }, { status: 400 })
    }

    // Verify folder exists
    const folderRes = await queryMemberDb('SELECT folder_name FROM rdu_folders WHERE id = ?', [folderId])
    if (folderRes.length === 0) {
      return NextResponse.json({ success: false, error: 'ไม่พบโฟลเดอร์ที่ระบุ' }, { status: 404 })
    }

    const folderName = folderRes[0].folder_name

    // Check MIME type or extension
    const originalFileName = file.name
    const ext = path.extname(originalFileName).toLowerCase()
    if (ext !== '.pdf' && file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'รองรับเฉพาะไฟล์เอกสาร .pdf เท่านั้น' }, { status: 400 })
    }

    // Prepare display name (auto clean: e.g. Antibiogram_All.pdf -> Antibiogram All)
    let displayName = (customDisplayName || '').trim()
    if (!displayName) {
      const baseWithoutExt = path.basename(originalFileName, ext)
      displayName = baseWithoutExt.replace(/[_\-]+/g, ' ').trim()
    }

    // Prepare storage path
    const sanitizedFolderName = folderName.replace(/[\\/:*?"<>|]/g, '_')
    const folderDirPath = path.join(process.cwd(), 'public', 'documents', 'rdu', sanitizedFolderName)
    await fs.mkdir(folderDirPath, { recursive: true })

    // Safe disk filename
    const safeDiskFileName = `${Date.now()}_${originalFileName.replace(/[^a-zA-Z0-9ก-๙._\-]/g, '_')}`
    const targetFilePath = path.join(folderDirPath, safeDiskFileName)

    // Write file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(targetFilePath, buffer)

    // Relative web path for browser access
    const webFilePath = `/documents/rdu/${encodeURIComponent(sanitizedFolderName)}/${encodeURIComponent(safeDiskFileName)}`

    // Determine display_order
    const maxOrderRes = await queryMemberDb('SELECT MAX(display_order) as maxOrder FROM rdu_files WHERE folder_id = ?', [
      folderId
    ])
    const nextOrder = (maxOrderRes[0]?.maxOrder ?? -1) + 1

    // Insert into rdu_files
    const insertRes = await queryMemberDb(
      `INSERT INTO rdu_files (folder_id, display_name, file_name, file_path, file_size, display_order) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [folderId, displayName, safeDiskFileName, webFilePath, buffer.length, nextOrder]
    )

    return NextResponse.json({
      success: true,
      message: 'อัปโหลดไฟล์ PDF เรียบร้อยแล้ว',
      file: {
        id: (insertRes as any).insertId,
        folder_id: Number(folderId),
        display_name: displayName,
        file_name: safeDiskFileName,
        file_path: webFilePath,
        file_size: buffer.length,
        display_order: nextOrder
      }
    })
  } catch (error: any) {
    console.error('Error in POST /api/member/rdu/files:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' }, { status: 500 })
  }
}

// PUT: Edit file display name or reorder files
export async function PUT(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || !(await hasRduPermission(session))) {
      return NextResponse.json({ success: false, error: 'ไม่มีสิทธิ์แก้ไขข้อมูลไฟล์' }, { status: 403 })
    }

    const body = await request.json()

    // Case 1: Reorder files
    if (body.action === 'reorder' && Array.isArray(body.orders)) {
      for (const item of body.orders) {
        if (item.id !== undefined && item.display_order !== undefined) {
          await queryMemberDb('UPDATE rdu_files SET display_order = ? WHERE id = ?', [item.display_order, item.id])
        }
      }
      return NextResponse.json({ success: true, message: 'ปรับปรุงลำดับไฟล์เรียบร้อยแล้ว' })
    }

    // Case 2: Update display name
    const fileId = body.id
    const displayName = (body.display_name || '').trim()

    if (!fileId || !displayName) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุชื่อแสดงผลของไฟล์' }, { status: 400 })
    }

    await queryMemberDb('UPDATE rdu_files SET display_name = ? WHERE id = ?', [displayName, fileId])

    return NextResponse.json({ success: true, message: 'แก้ไขชื่อแสดงผลสำเร็จ' })
  } catch (error: any) {
    console.error('Error in PUT /api/member/rdu/files:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขไฟล์' }, { status: 500 })
  }
}

// DELETE: Delete file from disk and database
export async function DELETE(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || !(await hasRduPermission(session))) {
      return NextResponse.json({ success: false, error: 'ไม่มีสิทธิ์ลบไฟล์' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ id ของไฟล์' }, { status: 400 })
    }

    // Get file info and folder name
    const fileRes = await queryMemberDb(
      `SELECT f.id, f.file_name, d.folder_name 
       FROM rdu_files f 
       JOIN rdu_folders d ON f.folder_id = d.id 
       WHERE f.id = ?`,
      [fileId]
    )

    if (fileRes.length === 0) {
      return NextResponse.json({ success: false, error: 'ไม่พบไฟล์ที่ต้องการลบ' }, { status: 404 })
    }

    const { file_name, folder_name } = fileRes[0]

    // Delete DB record
    await queryMemberDb('DELETE FROM rdu_files WHERE id = ?', [fileId])

    // Delete physical file
    const sanitizedFolderName = folder_name.replace(/[\\/:*?"<>|]/g, '_')
    const physicalFilePath = path.join(process.cwd(), 'public', 'documents', 'rdu', sanitizedFolderName, file_name)

    try {
      await fs.unlink(physicalFilePath)
    } catch (err) {
      console.warn('Physical file not found or already deleted:', err)
    }

    return NextResponse.json({ success: true, message: 'ลบไฟล์เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error in DELETE /api/member/rdu/files:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบไฟล์' }, { status: 500 })
  }
}
