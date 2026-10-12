import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'

export async function GET() {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const stats = await equipmentBorrowService.getBorrowDashboardStats()
    return NextResponse.json({ success: true, data: stats })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการโหลดสถิติ' },
      { status: 500 }
    )
  }
}
