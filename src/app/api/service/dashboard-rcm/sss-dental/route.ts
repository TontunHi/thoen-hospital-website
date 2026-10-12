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
    const ds1 = searchParams.get('ds1') || '2025-10-01'
    const ds2 = searchParams.get('ds2') || '2026-09-30'
    const doctor = searchParams.get('doctor') || ''
    const visits = searchParams.get('visits') === 'true'

    logThrottledAudit(
      'READ',
      'sss_dental',
      `Viewed SSS dental report (date: ${ds1} to ${ds2})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'SSS dental audit log failed'))

    const result = await RcmDashboardService.getSssDentalReport({
      ds1,
      ds2,
      doctorFilter: doctor,
      fetchVisits: visits,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/sss-dental Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานทันตกรรมประกันสังคม' },
      { status: 500 }
    )
  }
}
