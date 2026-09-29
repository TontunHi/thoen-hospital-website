import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { DocumentStorage, StorageValidationError, sanitizeName } from '@/lib/storage/documentStorage'
import path from 'path'

// POST: Upload PDF file to a folder
export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error || !member) return error

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
    const originalFileName = file.name
    const ext = path.extname(originalFileName).toLowerCase()

    // Prepare display name (auto clean: e.g. Antibiogram_All.pdf -> Antibiogram All)
    let displayName = (customDisplayName || '').trim()
    if (!displayName) {
      const baseWithoutExt = path.basename(originalFileName, ext)
      displayName = baseWithoutExt.replace(/[_\-]+/g, ' ').trim()
    }

    const sanitizedFolderName = sanitizeName(folderName)
    const baseClean = sanitizeName(path.basename(originalFileName, ext))

    // Save using DocumentStorage
    const saved = await DocumentStorage.save(file, {
      destinationDir: `public/documents/rdu/${sanitizedFolderName}`,
      baseName: baseClean,
      allowedMimeTypes: ['application/pdf'],
      allowedExtensions: ['.pdf'],
      maxSizeBytes: 25 * 1024 * 1024,
      collisionStrategy: 'increment',
    })

    const maxOrderRes = await queryMemberDb('SELECT MAX(display_order) as maxOrder FROM rdu_files WHERE folder_id = ?', [
      folderId
    ])
    const nextOrder = (maxOrderRes[0]?.maxOrder ?? -1) + 1

    const insertRes = await queryMemberDb(
      `INSERT INTO rdu_files (folder_id, display_name, file_name, file_path, file_size, display_order) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [folderId, displayName, saved.fileName, saved.publicUrl, saved.fileSize, nextOrder]
    )
    const newFileId = (insertRes as any).insertId

    return NextResponse.json({
      success: true,
      message: 'อัปโหลดไฟล์ PDF เรียบร้อยแล้ว',
      file: {
        id: newFileId,
        folder_id: Number(folderId),
        display_name: displayName,
        file_name: saved.fileName,
        file_path: `/api/rdu/file/${newFileId}`,
        file_size: saved.fileSize,
        display_order: nextOrder
      }
    })
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    console.error('Error in POST /api/member/rdu/files:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' }, { status: 500 })
  }
}

// PUT: Edit file display name or reorder files
export async function PUT(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error || !member) return error

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
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ id ของไฟล์' }, { status: 400 })
    }

    const fileRes = await queryMemberDb(
      `SELECT f.id, f.file_name, f.file_path, d.folder_name 
       FROM rdu_files f 
       JOIN rdu_folders d ON f.folder_id = d.id 
       WHERE f.id = ?`,
      [fileId]
    )

    if (fileRes.length === 0) {
      return NextResponse.json({ success: false, error: 'ไม่พบไฟล์ที่ต้องการลบ' }, { status: 404 })
    }

    const { file_name, file_path, folder_name } = fileRes[0]

    // Delete DB record
    await queryMemberDb('DELETE FROM rdu_files WHERE id = ?', [fileId])

    // Delete physical file via DocumentStorage
    const targetPath = file_path || `/documents/rdu/${sanitizeName(folder_name)}/${file_name}`
    await DocumentStorage.delete(targetPath)

    return NextResponse.json({ success: true, message: 'ลบไฟล์เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error in DELETE /api/member/rdu/files:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบไฟล์' }, { status: 500 })
  }
}

