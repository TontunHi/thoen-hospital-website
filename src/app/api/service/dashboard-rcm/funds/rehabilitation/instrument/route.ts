import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  RcmInstrumentFundService,
  type InstrumentReportParams,
} from '@/lib/clinical/rcmInstrumentFundService'
import { instrumentReportQuerySchema, validateSearchParams } from '@/lib/clinical/rcmValidation'
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
    const validation = validateSearchParams(instrumentReportQuerySchema, searchParams)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: validation.error } },
        { status: 400 }
      )
    }

    const params = validation.data as InstrumentReportParams

    logThrottledAudit(
      'READ',
      'rcm_funds_rehab_instrument',
      `Viewed Instrument & Prostheses report (type: ${params.patientType || 'OPD'}, range: ${params.ds1 || 'default'} to ${params.ds2 || 'default'}, filter: ${params.cardFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Instrument & Prostheses audit log failed'))

    const result = await RcmInstrumentFundService.getReportData(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error(
      { error: err.message },
      'GET /api/service/dashboard-rcm/funds/rehabilitation/instrument Error'
    )
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานกองทุนอวัยวะเทียมและอุปกรณ์ (11.29)',
        },
      },
      { status: 500 }
    )
  }
}
