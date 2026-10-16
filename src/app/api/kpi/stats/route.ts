import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { KpiService } from '@/lib/kpi/kpiService'

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบ' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const topicIdStr = searchParams.get('topicId')
    if (!topicIdStr) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'กรุณาระบุ topicId' } },
        { status: 400 }
      )
    }

    const topicId = parseInt(topicIdStr, 10)
    const periodKey = searchParams.get('periodKey') || undefined

    const stats = await KpiService.getStats(topicId, periodKey)

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'เกิดข้อผิดพลาดในการคำนวณสถิติ' } },
      { status: 500 }
    )
  }
}
