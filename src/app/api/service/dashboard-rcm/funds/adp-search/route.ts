import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmAdpSearchService } from '@/lib/clinical/rcmAdpSearchService'
import { adpSearchQuerySchema, validateSearchParams } from '@/lib/clinical/rcmValidation'
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

    if (searchParams.get('options') === 'true') {
      const options = await RcmAdpSearchService.getAvailableAdpCodes()
      return NextResponse.json({ success: true, data: options })
    }

    const validation = validateSearchParams(adpSearchQuerySchema, searchParams)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: validation.error } },
        { status: 400 }
      )
    }

    const params = validation.data

    logThrottledAudit(
      'READ',
      'rcm_funds_adp_search',
      `Viewed ADP Search report (type: ${params.patientType}, ADP: ${params.adpCode || '14001'}, range: ${params.ds1 || 'default'} to ${params.ds2 || 'default'}, filter: ${params.cardFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'ADP search audit log failed'))

    const result = await RcmAdpSearchService.getAdpSearchReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message, stack: err.stack }, 'GET /api/service/dashboard-rcm/funds/adp-search Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานการค้นหาจากรหัส ADP',
        },
      },
      { status: 500 }
    )
  }
}
