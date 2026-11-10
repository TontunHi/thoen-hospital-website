import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
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

    const originalFileName = file.name
    const ext = path.extname(originalFileName).toLowerCase()

    // Prepare display name (auto clean: e.g. Antibiogram_All.pdf -> Antibiogram All)
    let displayName = (customDisplayName || '').trim()
    if (!displayName) {
      const baseWithoutExt = path.basename(originalFileName, ext)
      displayName = baseWithoutExt.replace(/[_\-]+/g, ' ').trim()
    }

    // Save using DocumentStorage with folderId placeholder or direct save
    const baseClean = sanitizeName(path.basename(originalFileName, ext))
    const saved = await DocumentStorage.save(file, {
      destinationDir: `public/documents/rdu/folder_${folderId}`,
      baseName: baseClean,
      allowedMimeTypes: ['application/pdf'],
      allowedExtensions: ['.pdf'],
      maxSizeBytes: 25 * 1024 * 1024,
      collisionStrategy: 'increment',
    })

    const res = await apiGateway.app.createRduFile({
      folder_id: Number(folderId),
      display_name: displayName,
      file_name: saved.fileName,
      file_path: saved.publicUrl,
      file_size: saved.fileSize,
    })

    return NextResponse.json({
      success: true,
      message: 'อัปโหลดไฟล์ PDF เรียบร้อยแล้ว',
      file: res.file
    })
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    console.error('Error in POST /api/member/rdu/files:', error)
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' }, { status: 500 })
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
      await apiGateway.app.updateRduFile(0, {
        action: 'reorder',
        orders: body.orders
      })
      return NextResponse.json({ success: true, message: 'ปรับปรุงลำดับไฟล์เรียบร้อยแล้ว' })
    }

    // Case 2: Update display name
    const fileId = body.id
    const displayName = (body.display_name || '').trim()

    if (!fileId || !displayName) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุชื่อแสดงผลของไฟล์' }, { status: 400 })
    }

    await apiGateway.app.updateRduFile(fileId, {
      display_name: displayName
    })

    return NextResponse.json({ success: true, message: 'แก้ไขชื่อแสดงผลสำเร็จ' })
  } catch (error: any) {
    console.error('Error in PUT /api/member/rdu/files:', error)
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขไฟล์' }, { status: 500 })
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

    const res = await apiGateway.app.deleteRduFile(fileId)

    // Delete physical file via DocumentStorage
    if (res.file) {
      const { file_name, file_path, folder_name } = res.file
      const targetPath = file_path || `/documents/rdu/${sanitizeName(folder_name)}/${file_name}`
      await DocumentStorage.delete(targetPath).catch(() => {})
    }

    return NextResponse.json({ success: true, message: 'ลบไฟล์เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error in DELETE /api/member/rdu/files:', error)
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบไฟล์' }, { status: 500 })
  }
}
