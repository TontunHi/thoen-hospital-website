import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import { getErrorMessage } from '@/lib/http/apiResponse'

export async function GET() {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const stats = await equipmentBorrowService.getBorrowDashboardStats()
    return NextResponse.json({ success: true, data: stats })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'เกิดข้อผิดพลาดในการโหลดสถิติ') },
      { status: 500 }
    )
  }
}
