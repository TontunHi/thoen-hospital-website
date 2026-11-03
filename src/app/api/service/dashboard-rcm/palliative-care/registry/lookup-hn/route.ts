import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { PalliativeRegistryService } from '@/lib/clinical/palliativeRegistryService'
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
    const hn = searchParams.get('hn')?.trim()

    if (!hn) {
      return NextResponse.json(
        { success: false, error: 'Bad Request: กรุณาระบุหมายเลข HN' },
        { status: 400 }
      )
    }

    logThrottledAudit(
      'READ',
      'palliative_care_patient_lookup',
      `Looked up patient demographics and Palliative Care registration for HN: ${hn}`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Palliative care HN lookup audit log failed'))

    const patient = await PalliativeRegistryService.lookupPatientByHn(hn)

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
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/palliative-care/registry/lookup-hn Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วยจาก HOSxP' },
      { status: 500 }
    )
  }
}
