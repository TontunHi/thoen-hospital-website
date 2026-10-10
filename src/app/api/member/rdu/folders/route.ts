import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { RduService } from '@/lib/rdu/rduService'

// GET: List all folders with their files for the manager
export async function GET() {
  try {
    const { error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error) return error

    const folders = await RduService.getFolderTree({ isActiveOnly: false })
    return NextResponse.json({ success: true, folders })
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
    if (!folderName) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุชื่อโฟลเดอร์' }, { status: 400 })
    }

    const created = await RduService.createFolder(folderName)
    return NextResponse.json({ success: true, message: 'สร้างโฟลเดอร์เรียบร้อยแล้ว', folderId: created.id })
  } catch (error: any) {
    console.error('Error in POST /api/member/rdu/folders:', error)
    const status = error.message?.includes('มีโฟลเดอร์ชื่อนี้') ? 400 : 500
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการสร้างโฟลเดอร์' }, { status })
  }
}

// PUT: Update folder name or reorder folders
export async function PUT(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error || !member) return error

    const body = await request.json()
    if (body.action === 'reorder' && Array.isArray(body.orders)) {
      await RduService.reorderFolders(body.orders)
      return NextResponse.json({ success: true, message: 'ปรับปรุงลำดับโฟลเดอร์เรียบร้อยแล้ว' })
    }

    const folderId = body.id
    const newFolderName = (body.folder_name || '').trim()
    if (!folderId || !newFolderName) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    await RduService.updateFolder(folderId, newFolderName)
    return NextResponse.json({ success: true, message: 'แก้ไขชื่อโฟลเดอร์เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error in PUT /api/member/rdu/folders:', error)
    const status = error.message?.includes('ไม่พบ') ? 404 : error.message?.includes('มีโฟลเดอร์') ? 400 : 500
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขโฟลเดอร์' }, { status })
  }
}

// DELETE: Delete folder and its physical directory
export async function DELETE(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_rdu' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('id')
    if (!folderId) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ id ของโฟลเดอร์' }, { status: 400 })
    }

    await RduService.deleteFolder(Number(folderId))
    return NextResponse.json({ success: true, message: 'ลบโฟลเดอร์และไฟล์ทั้งหมดเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error in DELETE /api/member/rdu/folders:', error)
    const status = error.message?.includes('ไม่พบ') ? 404 : 500
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบโฟลเดอร์' }, { status })
  }
}
