import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const ds1 = searchParams.get('ds1') || '2024-10-01'
    const ds2 = searchParams.get('ds2') || '2025-09-30'

    logThrottledAudit(
      'READ',
      'ipd_dept_adjrw',
      `Viewed IPD department SumAdjRW report (date: ${ds1} to ${ds2})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'IPD department SumAdjRW report audit log failed'))

    const rows = await RcmDashboardService.getIpdDepartmentAdjrw({ ds1, ds2 })

    return NextResponse.json({
      success: true,
      count: rows.length,
      data: rows,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/ipd-dept-adjrw Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล SumAdjRW แยกรายแผนก' },
      { status: 500 }
    )
  }
}
