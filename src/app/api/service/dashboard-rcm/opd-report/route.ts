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
    const ds1 = searchParams.get('ds1') || '2026-09-10'
    const ds2 = searchParams.get('ds2') || '2026-09-10'
    const pttype = searchParams.get('pttype') || ''
    const isAll = searchParams.get('all') === 'true'

    logThrottledAudit(
      'READ',
      'opd_detailed_report',
      `Viewed OPD detailed report (date: ${ds1} to ${ds2}, pttype: ${pttype || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'OPD report audit log failed'))

    const rows = await RcmDashboardService.getOpdDetailedReport({
      ds1,
      ds2,
      pttype,
      isAll,
    })

    return NextResponse.json({
      success: true,
      count: rows.length,
      data: rows,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/opd-report Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานการตรวจ OPD' },
      { status: 500 }
    )
  }
}
