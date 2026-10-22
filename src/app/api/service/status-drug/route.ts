import { NextResponse } from 'next/server'
import { outpatientDrugService } from '@/lib/clinical/outpatientDrugService'
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
      'opitemrece',
      'Viewed drug dispensing status and outpatient prescription queue',
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Drug status audit log failed'))

    const cacheKey = 'drug-dispense-status-data'
    const data = await getCachedData(
      cacheKey,
      () => outpatientDrugService.getDrugDispenseQueue(),
      10000 // 10s TTL cache
    )

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    logger.error({ error }, 'Drug status API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะการจ่ายยา',
      },
      { status: 500 }
    )
  }
}
