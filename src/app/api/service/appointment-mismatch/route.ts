import { NextResponse } from 'next/server'
import { fetchAppointmentMismatches } from '@/lib/clinicalDb'
import { verifyMemberSession } from '@/lib/memberAuth'
import { getCachedData } from '@/lib/cache'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface AppointmentMismatch {
  hn: string
  department: string
  vstdate: string
  nextdate: string
  appUser: string
}

interface AppointmentMismatchResponse {
  totalMismatches: number
  updatedAt: string
  mismatches: AppointmentMismatch[]
}

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
    ).catch(err => logger.error({ err }, 'Appointment mismatch audit log failed'))

    const cacheKey = 'appointment-mismatch-data'

    const data = await getCachedData<AppointmentMismatchResponse>(cacheKey, async () => {
      const mismatches = await fetchAppointmentMismatches()

      return {
        totalMismatches: mismatches.length,
        updatedAt: new Date().toISOString(),
        mismatches,
      }
    }, 10000) // 10 seconds cache

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
