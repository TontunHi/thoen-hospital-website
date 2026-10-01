import { NextResponse } from 'next/server'
import { ClinicalRecordsService } from '@/lib/clinical/clinicalRecordsService'
import { verifyMemberSession } from '@/lib/memberAuth'
import { getCachedData } from '@/lib/cache'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET() {
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

    logThrottledAudit(
      'READ',
      'oapp',
      'Viewed appointment mismatch list (wrong examination room)',
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Appointment mismatch audit log failed'))

    const cacheKey = 'appointment-mismatch-data'

    const data = await getCachedData(
      cacheKey,
      () => ClinicalRecordsService.getAppointmentMismatches(),
      10000
    )

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Appointment mismatch API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการนัดผิดห้องตรวจ',
      },
      { status: 500 }
    )
  }
}
