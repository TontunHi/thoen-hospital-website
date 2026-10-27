import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { verifyMemberSession, attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'

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

    const result = await apiGateway.clinical.getTbCxrTracker({
      status,
      hospcode,
      search,
      startDate
    })

    await logThrottledAudit(
      'READ',
      'tb_cxr_tracker',
      `เข้าดูระบบติดตามการทำ CXR ผู้ป่วย TB (สถานะ: ${status}, ผลลัพธ์ ${result.count || 0} รายการ)`,
      memberSession
    )

    const response = NextResponse.json({
      success: true,
      count: result.count,
      summary: result.summary,
      data: result.data
    })

    return attachRenewedMemberSessionCookie(response, memberSession)
  } catch (error: any) {
    console.error('TB CXR Tracker API Error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการติดตาม CXR จาก API Gateway' },
      { status: 500 }
    )
  }
}
