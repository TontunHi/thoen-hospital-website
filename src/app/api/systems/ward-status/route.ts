import { NextResponse } from 'next/server'
import { IpdWardService } from '@/lib/clinical/ipdWardService'
import { getCachedData } from '@/lib/cache'
import { checkRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const rateCheck = await checkRateLimit({
      key: 'systems-ward-status',
      maxAttempts: 60,
      windowSeconds: 60,
    })
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    const cacheKey = 'systems-ipd-ward-summary'
    const data = await getCachedData(
      cacheKey,
      () => IpdWardService.getWardSummary(),
      10000 // 10 seconds TTL
    )

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    logger.error({ error }, 'Systems ward status summary API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุปสถานะผู้ป่วยนอนรักษาพยาบาล',
      },
      { status: 500 }
    )
  }
}
