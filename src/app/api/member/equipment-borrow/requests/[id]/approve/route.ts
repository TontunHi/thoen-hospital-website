import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMemberApi({ requiredPermission: 'manage_borrow' })
  if (auth.error) return auth.error

  try {
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 })
    }

    const updated = await equipmentBorrowService.approveAndDispenseRequest(id, {
      id: auth.member.id,
      name: auth.member.name,
      username: auth.member.username,
      role: auth.member.role,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการอนุมัติคำขอ' },
      { status: 400 }
    )
  }
}
