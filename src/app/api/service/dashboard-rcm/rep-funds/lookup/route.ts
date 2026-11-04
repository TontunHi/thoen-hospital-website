import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmRepFundsService } from '@/lib/clinical/rcmRepFundsService'
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

    if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const hn = searchParams.get('hn') || undefined
    const ptName = searchParams.get('ptName') || undefined
    const serviceDate = searchParams.get('serviceDate') || undefined

    if (!hn && !ptName && !serviceDate) {
      return NextResponse.json({
        success: true,
        claims: [],
      })
    }

    logThrottledAudit(
      'READ',
      'rep_patient_lookup',
      'Looked up patient REP claims',
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'REP lookup audit log failed'))

    const claims = await RcmRepFundsService.lookupPatientClaims({
      hn,
      ptName,
      serviceDate,
    })

    return NextResponse.json({
      success: true,
      count: claims.length,
      claims,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/rep-funds/lookup Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลคนไข้' },
      { status: 500 }
    )
  }
}
