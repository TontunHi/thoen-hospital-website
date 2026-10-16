import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmDashboardService, getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
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
    const mode = searchParams.get('mode') === 'detail' ? 'detail' : 'summary'
    const department = searchParams.get('department')?.toUpperCase() === 'IP' ? 'IP' : 'OP'

    const defaultRange = getDefaultFiscalYearDateRange()
    const ds1 = searchParams.get('ds1') || defaultRange.startDate
    const ds2 = searchParams.get('ds2') || defaultRange.endDate

    logThrottledAudit(
      'READ',
      'rcm_invoice_summary',
      `Viewed RCM invoice summary ${department} (${mode}, date: ${ds1} to ${ds2})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'RCM invoice summary audit log failed'))

    if (mode === 'detail') {
      const pttype = searchParams.get('pttype') || undefined
      const search = searchParams.get('search') || undefined
      const page = parseInt(searchParams.get('page') || '1', 10)
      const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
      const exportAll = searchParams.get('exportAll') === 'true' || searchParams.get('exportAll') === '1'

      const result = await RcmDashboardService.getInvoiceDetails({
        department,
        ds1,
        ds2,
        pttype,
        search,
        page,
        pageSize,
        exportAll,
      })

      return NextResponse.json({
        success: true,
        data: result,
      })
    }

    const result = await RcmDashboardService.getInvoiceSummary({
      department,
      ds1,
      ds2,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/invoice-summary Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานสรุปรายรับจาก Invoice (5.2.2.1)' },
      { status: 500 }
    )
  }
}
