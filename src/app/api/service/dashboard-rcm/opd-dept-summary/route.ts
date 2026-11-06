import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmDashboardService, getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import { validateSearchParams, opdDeptSummaryQuerySchema } from '@/lib/clinical/rcmValidation'
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
    const validation = validateSearchParams(opdDeptSummaryQuerySchema, searchParams)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    const defaultRange = getDefaultFiscalYearDateRange()
    const ds1 = validation.data.ds1 || defaultRange.startDate
    const ds2 = validation.data.ds2 || defaultRange.endDate
    const spclty = validation.data.spclty

    logThrottledAudit(
      'READ',
      'opd_dept_summary',
      `Viewed OPD department summary report (date: ${ds1} to ${ds2})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'OPD department summary report audit log failed'))

    const rows = await RcmDashboardService.getOpdDepartmentSummary({ ds1, ds2 })

    return NextResponse.json({
      success: true,
      count: rows.length,
      data: rows,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/opd-dept-summary Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วยนอก (OPD) แยกรายแผนก' },
      { status: 500 }
    )
  }
}
