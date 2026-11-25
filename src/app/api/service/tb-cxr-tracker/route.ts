import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { verifyMemberSession, attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { getCachedData } from '@/lib/cache'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const memberSession = await verifyMemberSession()
    if (!memberSession) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || 'all') as 'all' | 'done' | 'missing'
    const hospcode = searchParams.get('hospcode') || undefined
    const search = searchParams.get('search') || undefined
    const startDate = searchParams.get('startDate') || undefined

    const cacheKey = `tb-cxr-tracker:${status}:${hospcode || ''}:${search || ''}:${startDate || ''}`
    const result = await getCachedData(
      cacheKey,
      () =>
        apiGateway.clinical.getTbCxrTracker({
          status,
          hospcode,
          search,
          startDate
        }),
      15_000
    )

    interface TbCxrRow {
      cxr_status?: string
      status?: string
      [key: string]: unknown
    }
    interface TbCxrSummary {
      total: number
      doneCount: number
      missingCount: number
      coveragePercentage: number
      statusBreakdown: Record<string, number>
    }

    let rows: TbCxrRow[] = []
    let count = 0
    let summary: TbCxrSummary | null = null

    if (Array.isArray(result)) {
      rows = result as TbCxrRow[]
      count = rows.length
      let done = 0
      let missing = 0
      const breakdown: Record<string, number> = {}
      for (const r of rows) {
        if (r.cxr_status === 'DONE') done++
        else missing++
        const st = r.status || 'ไม่ระบุ'
        breakdown[st] = (breakdown[st] || 0) + 1
      }
      summary = {
        total: count,
        doneCount: done,
        missingCount: missing,
        coveragePercentage: count > 0 ? parseFloat(((done / count) * 100).toFixed(1)) : 0,
        statusBreakdown: breakdown
      }
    } else if (result && typeof result === 'object') {
      const objResult = result as {
        items?: TbCxrRow[]
        data?: TbCxrRow[]
        count?: number
        summary?: TbCxrSummary | null
      }
      rows = objResult.items || objResult.data || []
      count = objResult.count ?? rows.length
      summary = objResult.summary ?? null
    }

    await logThrottledAudit(
      'READ',
      'tb_cxr_tracker',
      `เข้าดูระบบติดตามการทำ CXR ผู้ป่วย TB (สถานะ: ${status}, ผลลัพธ์ ${count} รายการ)`,
      memberSession
    )

    const response = NextResponse.json({
      success: true,
      count,
      summary,
      data: rows
    })

    return attachRenewedMemberSessionCookie(response, memberSession)
  } catch (error: unknown) {
    logger.error({ error }, 'TB CXR Tracker API Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการติดตาม CXR จาก API Gateway' },
      { status: 500 }
    )
  }
}
