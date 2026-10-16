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
    const fiscalYear = searchParams.get('fiscalYear') || undefined

    const [fiscalYears, topics] = await Promise.all([
      KpiService.getFiscalYears(),
      KpiService.getTopics(fiscalYear),
    ])

    return NextResponse.json({
      success: true,
      data: {
        fiscalYears,
        topics,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล' } },
      { status: 500 }
    )
  }
}
