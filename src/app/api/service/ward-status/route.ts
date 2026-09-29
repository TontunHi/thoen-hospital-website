import { NextResponse } from 'next/server'
import { IpdWardService } from '@/lib/clinical/ipdWardService'
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

    logThrottledAudit(
      'READ',
      'an_stat',
      'Viewed IPD ward status and admitted patient list',
      { username: session.username, email: session.email }
    ).catch(err => logger.error({ err }, 'Ward status audit log failed'))

    const cacheKey = 'ipd-ward-status-data'
    const data = await getCachedData(
      cacheKey,
      () => IpdWardService.getWardPatientRoster(),
      10000 // 10 seconds cache
    )

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    logger.error({ error }, 'Ward status API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะผู้ป่วยนอนรักษาพยาบาล',
      },
      { status: 500 }
    )
  }
}
