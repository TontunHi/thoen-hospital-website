import { NextResponse } from 'next/server'
import { IpdWardService } from '@/lib/clinical/ipdWardService'
import { getCachedData } from '@/lib/cache'
import { checkRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const rateCheck = await checkRateLimit({ key: 'status-or-query', maxAttempts: 60, windowSeconds: 60 })
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    const cacheKey = 'or-room-status-data'
    const data = await getCachedData(
      cacheKey,
      () => IpdWardService.getOrRoomStatus(),
      10000 // 10 seconds cache
    )

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    logger.error({ error }, 'OR status API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะห้องผ่าตัด',
      },
      { status: 500 }
    )
  }
}
