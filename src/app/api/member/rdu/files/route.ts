import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { RduService } from '@/lib/rdu/rduService'
import { StorageValidationError } from '@/lib/storage/documentStorage'

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

    const uploaded = await RduService.uploadFile({
      folderId: Number(folderId),
      file,
      customDisplayName,
    })

    return NextResponse.json({
      success: true,
      message: 'อัปโหลดไฟล์ PDF เรียบร้อยแล้ว',
      file: uploaded,
    })
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    console.error('Error in POST /api/member/rdu/files:', error)
    const status = error.message?.includes('ไม่พบโฟลเดอร์') ? 404 : 500
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' }, { status })
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
      await RduService.reorderFiles(body.orders)
      return NextResponse.json({ success: true, message: 'ปรับปรุงลำดับไฟล์เรียบร้อยแล้ว' })
    }

    // Case 2: Update display name
    const fileId = body.id
    const displayName = (body.display_name || '').trim()

    if (!fileId || !displayName) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุชื่อแสดงผลของไฟล์' }, { status: 400 })
    }

    await RduService.updateFileDisplayName(Number(fileId), displayName)
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

    await RduService.deleteFile(Number(fileId))
    return NextResponse.json({ success: true, message: 'ลบไฟล์เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error in DELETE /api/member/rdu/files:', error)
    const status = error.message?.includes('ไม่พบไฟล์') ? 404 : 500
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบไฟล์' }, { status })
  }
}
