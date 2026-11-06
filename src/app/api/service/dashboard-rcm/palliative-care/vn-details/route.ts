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
    const vn = searchParams.get('vn')?.trim()

    if (!vn) {
      return NextResponse.json(
        { success: false, error: 'Bad Request: กรุณาระบุหมายเลข VN' },
        { status: 400 }
      )
    }

    logThrottledAudit(
      'READ',
      'palliative_care_vn_details',
      `Viewed Palliative Care clinical details for VN: ${vn}`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Palliative care VN details audit log failed'))

    const details = await RcmDashboardService.getVnClinicalDetails(vn)

    if (!details) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลการรับบริการสำหรับเลขที่ VN ที่ระบุ' },
        { status: 404 }
      )
    }

    if (details.header?.hn) {
      const { LtcRegistryService } = await import('@/lib/clinical/ltcRegistryService')
      try {
        details.header.isLtc = await LtcRegistryService.isPatientInLtc(details.header.hn)
      } catch (err) {
        logger.warn({ err }, 'Failed to check patient LTC status for VN details')
      }
    }

    return NextResponse.json({
      success: true,
      data: details,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/palliative-care/vn-details Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดภายในระบบในการดึงข้อมูล VN' },
      { status: 500 }
    )
  }
}
