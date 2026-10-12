import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 })
    }

    const item = await equipmentBorrowService.getBorrowRequestById(id)
    if (!item) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลคำขอยืม' }, { status: 404 })
    }

    // Permission check: requester or manager
    const isRequester = item.requesterId === auth.member.id
    const canManage = auth.member.isAdmin || auth.member.can('manage_borrow') || auth.member.can('view_borrow_requests')
    if (!isRequester && !canManage) {
      return NextResponse.json({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลคำขอนี้' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: item })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการโหลดรายละเอียดคำขอยืม' },
      { status: 500 }
    )
  }
}
