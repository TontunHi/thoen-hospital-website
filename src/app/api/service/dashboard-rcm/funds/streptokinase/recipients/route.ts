import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmStreptokinaseService } from '@/lib/clinical/rcmStreptokinaseService'
import { streptokinaseReportQuerySchema } from '@/lib/clinical/rcmValidation'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบสมาชิกก่อนใช้งาน' } },
        { status: 401 }
      )
    }

    if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลกองทุน RCM' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const rawParams = Object.fromEntries(searchParams.entries())
    const parsed = streptokinaseReportQuerySchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_streptokinase_report',
      `Viewed Streptokinase drug fund report (${params.patientType}) (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, filter: ${params.cardFilter}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Streptokinase report audit log failed'))

    const result = await RcmStreptokinaseService.getStreptokinaseReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/streptokinase/recipients Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานกองทุนยา Streptokinase',
        },
      },
      { status: 500 }
    )
  }
}
