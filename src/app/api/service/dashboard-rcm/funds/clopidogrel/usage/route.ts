import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmClopidogrelService } from '@/lib/clinical/rcmClopidogrelService'
import { clopidogrelReportQuerySchema, validateSearchParams } from '@/lib/clinical/rcmValidation'
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
    const validation = validateSearchParams(clopidogrelReportQuerySchema, searchParams)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: validation.error } },
        { status: 400 }
      )
    }

    const params = validation.data

    logThrottledAudit(
      'READ',
      'rcm_funds_clopidogrel_usage',
      `Viewed Clopidogrel drug usage report (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, filter: ${params.cardFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Clopidogrel drug usage audit log failed'))

    const result = await RcmClopidogrelService.getClopidogrelReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('CLOPIDOGREL USAGE API ROUTE ERROR:', err)
    logger.error({ error: err.message, stack: err.stack }, 'GET /api/service/dashboard-rcm/funds/clopidogrel/usage Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `เกิดข้อผิดพลาดในการดึงข้อมูลรายงานการใช้ยา Clopidogrel: ${err.message}`,
        },
      },
      { status: 500 }
    )
  }
}
