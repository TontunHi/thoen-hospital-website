import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { MokService, MOK_CATEGORIES, CatchmentType } from '@/lib/clinical/mokService'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
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

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    const catchmentParam = (searchParams.get('catchment') || 'in_catchment') as CatchmentType
    const refresh = searchParams.get('refresh') === 'true'

    // Mode: Summary Counts across categories
    if (mode === 'summary') {
      const summaryCacheKey = `mok-summary-counts-${catchmentParam}`
      if (refresh) {
        invalidateCacheKey(summaryCacheKey)
      }

      const counts = await getCachedData(
        summaryCacheKey,
        () => MokService.fetchCategoryCounts(catchmentParam),
        60000 // 60s cache TTL for counts
      )

      return NextResponse.json({
        success: true,
        catchment: catchmentParam,
        counts,
      })
    }

    // Default: Category Patient Records
    const categoryParam = searchParams.get('category') || 'asthma'
    const validCategory = MOK_CATEGORIES.some((c) => c.id === categoryParam)
    if (!validCategory) {
      return NextResponse.json(
        { success: false, error: `Invalid category: ${categoryParam}` },
        { status: 400 }
      )
    }

    const cacheKey = `mok-${categoryParam}-${catchmentParam}`

    if (refresh) {
      invalidateCacheKey(cacheKey)
    }

    logThrottledAudit(
      'READ',
      'mok',
      `Viewed MOK category: ${categoryParam} (${catchmentParam})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'MOK audit log failed'))

    const data = await getCachedData(
      cacheKey,
      () => MokService.fetchCategoryRecords(categoryParam, catchmentParam),
      30000 // 30s cache TTL
    )

    return NextResponse.json({
      success: true,
      category: categoryParam,
      catchment: catchmentParam,
      total: data.length,
      data,
    })
  } catch (error: unknown) {
    logger.error({ error }, 'MOK API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลหมออนามัยครอบครัว (มอค.)',
      },
      { status: 500 }
    )
  }
}
