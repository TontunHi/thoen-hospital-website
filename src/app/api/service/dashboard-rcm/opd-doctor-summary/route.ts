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

    if (session.role === 'subdistrict') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const ds1 = searchParams.get('ds1') || '2025-10-01'
    const ds2 = searchParams.get('ds2') || '2026-09-30'
    const eclaims = searchParams.get('eclaims') || searchParams.get('pttypes') || ''

    logThrottledAudit(
      'READ',
      'opd_doctor_summary',
      `Viewed OPD doctor summary report (date: ${ds1} to ${ds2}, eclaims: ${eclaims || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'OPD doctor summary audit log failed'))

    const result = await RcmDashboardService.getOpdDoctorSummary({
      ds1,
      ds2,
      eclaimsParam: eclaims,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/opd-doctor-summary Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานผู้ป่วยนอกรายแพทย์' },
      { status: 500 }
    )
  }
}
