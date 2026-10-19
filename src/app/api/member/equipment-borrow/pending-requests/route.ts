import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'

/**
 * Task-based Route: Fetch Pending Borrow Requests for Approval
 * Access: Approver / Manager (manage_borrow permission or Admin)
 */
export async function GET(request: Request) {
  const auth = await requireMemberApi({ requiredPermission: 'manage_borrow' })
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const result = await equipmentBorrowService.getPendingRequests({ search, page, limit })
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการโหลดรายการรออนุมัติ' },
      { status: 500 }
    )
  }
}
