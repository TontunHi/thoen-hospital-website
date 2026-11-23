import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { GatewayTimeoutError, GatewayUnavailableError } from '@/lib/apiGateway'
import {
  RcmOpdDebtRegistryService,
  type OpdDebtRegistryParams,
} from '@/lib/clinical/rcmOpdDebtRegistryService'
import {
  opdDebtRegistryQuerySchema,
  validateSearchParams,
} from '@/lib/clinical/rcmValidation'
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
          error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลระบบ RCM' },
        },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const validation = validateSearchParams(opdDebtRegistryQuerySchema, searchParams)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: validation.error } },
        { status: 400 }
      )
    }

    const params = validation.data as OpdDebtRegistryParams

    logThrottledAudit(
      'READ',
      'rcm_opd_debt_registry',
      `Viewed OPD Debt Registry (2.1.1.3) report (range: ${params.ds1 || 'default'} to ${params.ds2 || 'default'}, filter: ${params.cardFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'OPD Debt Registry audit log failed'))

    const result = await RcmOpdDebtRegistryService.getReportData(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    if (error instanceof GatewayTimeoutError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GATEWAY_TIMEOUT',
            message: 'การดึงข้อมูลใช้เวลานานเกินกำหนด กรุณาลองเลือกช่วงเวลาเป็นรายเดือน',
          },
        },
        { status: 504 }
      )
    }

    if (error instanceof GatewayUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GATEWAY_UNAVAILABLE',
            message: 'ไม่สามารถเชื่อมต่อ API Gateway ของโรงพยาบาลได้ในขณะนี้',
          },
        },
        { status: 503 }
      )
    }

    const err = error as Error
    logger.error(
      { error: err.message },
      'GET /api/service/dashboard-rcm/opd-debt-registry Error'
    )
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลทะเบียนตั้งหนี้ผู้ป่วยนอก (2.1.1.3)',
        },
      },
      { status: 500 }
    )
  }
}
