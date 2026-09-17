import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
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
      // Query mirrors PHP index.php lines 71-75:
      // Find appointments where the department code is inactive/unset,
      // meaning the appointment was made to a wrong examination room.
      // This prevents the auto-send examination system from working.
      const sql = `
        SELECT 
          o.hn,
          o.vstdate,
          o.nextdate,
          k.department,
          o.app_user
        FROM oapp o
        LEFT OUTER JOIN kskdepartment k ON o.depcode = k.depcode
        WHERE o.nextdate > CURRENT_DATE
          AND (k.depcode_active IS NULL OR k.depcode_active = '')
        ORDER BY o.app_user
      `

      const rows = await queryHosDb(sql)

      const mismatches: AppointmentMismatch[] = rows.map((row: Record<string, unknown>) => ({
        hn: String(row.hn || ''),
        department: row.department ? String(row.department).trim() : '',
        vstdate: row.vstdate ? String(row.vstdate) : '',
        nextdate: row.nextdate ? String(row.nextdate) : '',
        appUser: row.app_user ? String(row.app_user).trim() : '',
      }))

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
