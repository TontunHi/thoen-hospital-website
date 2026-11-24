import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { GatewayUnavailableError } from '@/lib/apiGateway'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { RcmFundsRepReconcileService } from '@/lib/clinical/rcmFundsRepReconcileService'

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
        { success: false, error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const vn = searchParams.get('vn')?.trim()

    if (!vn || !/^[A-Za-z0-9_:-]{4,30}$/.test(vn)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_VN', message: 'กรุณาระบุหมายเลข VN หรือ AN ที่ถูกต้อง' } },
        { status: 400 }
      )
    }

    logThrottledAudit(
      'READ',
      'rcm_funds_rep_reconcile_vn_details',
      `Viewed unified funds REP visit details for key: ${vn}`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Funds REP VN details audit log failed'))

    const details = await RcmFundsRepReconcileService.getVnReconcileDetails(vn)

    if (!details) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลการรับบริการและรายการ REP สำหรับรายการนี้' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: details,
    })
  } catch (error: unknown) {
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
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/rep-reconcile/vn-details Error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเวชระเบียนและรายการ REP' },
      },
      { status: 500 }
    )
  }
}
