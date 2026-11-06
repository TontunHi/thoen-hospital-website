import { NextResponse } from 'next/server'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { LtcRegistryService } from '@/lib/clinical/ltcRegistryService'
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

    const member = await fetchAuthenticatedMember(session.username, session.email)
    const canAccess =
      member?.isAdmin ||
      member?.can('manage_ltc_registry') ||
      member?.can('edit_ltc_registry') ||
      member?.can('view_ltc_registry')

    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: คุณไม่มีสิทธิ์เข้าถึงข้อมูลผู้ป่วยสำหรับ LTC' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const hn = searchParams.get('hn')?.trim()

    if (!hn) {
      return NextResponse.json(
        { success: false, error: 'Bad Request: กรุณาระบุหมายเลข HN' },
        { status: 400 }
      )
    }

    logThrottledAudit(
      'READ',
      'long_term_care_patient_lookup',
      `Looked up patient demographics for LTC HN: ${hn}`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'LTC HN lookup audit log failed'))

    const patient = await LtcRegistryService.lookupPatientByHn(hn)

    if (!patient) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลผู้ป่วยสำหรับ HN นี้ในระบบ HOSxP' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: patient,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/palliative-care/ltc-registry/lookup-hn Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วยจาก HOSxP' },
      { status: 500 }
    )
  }
}
