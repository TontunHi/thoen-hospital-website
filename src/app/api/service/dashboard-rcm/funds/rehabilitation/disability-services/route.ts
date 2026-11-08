import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  RcmRehabilitationService,
  type RehabReportParams,
} from '@/lib/clinical/rcmRehabilitationService'
import { rehabReportQuerySchema, validateSearchParams } from '@/lib/clinical/rcmValidation'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบสมาชิกก่อนใช้งาน' },
        },
        { status: 401 }
      )
    }

    if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลกองทุน RCM' },
        },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const validation = validateSearchParams(rehabReportQuerySchema, searchParams)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: validation.error } },
        { status: 400 }
      )
    }

    const params = validation.data as RehabReportParams

    logThrottledAudit(
      'READ',
      'rcm_funds_rehab_disability_services',
      `Viewed Rehabilitation Disability Services report (${params.startDate || params.ds1 || 'default'} to ${params.endDate || params.ds2 || 'default'}, filter: ${params.cardFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Rehabilitation Disability Services audit log failed'))

    const result = await RcmRehabilitationService.getDisabilityServicesReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error(
      { error: err.message },
      'GET /api/service/dashboard-rcm/funds/rehabilitation/disability-services Error'
    )
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability (11.47.3)',
        },
      },
      { status: 500 }
    )
  }
}
