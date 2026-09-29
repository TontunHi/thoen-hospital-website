import { NextResponse } from 'next/server'
import { IpdWardService, BedOccupancyData } from '@/lib/clinical/ipdWardService'
import { verifyMemberSession } from '@/lib/memberAuth'
import { getCachedData } from '@/lib/cache'
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

    // No audit log — aggregate data only, no PII
    const cacheKey = 'bed-occupancy-data'
    const data = await getCachedData<BedOccupancyData>(
      cacheKey,
      () => IpdWardService.getBedOccupancyReport(),
      10000 // 10 seconds cache
    )

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Bed occupancy API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอัตราการครองเตียง',
      },
      { status: 500 }
    )
  }
}
