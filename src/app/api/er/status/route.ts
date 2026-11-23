import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { fetchErLiveStatusData, formatErStatusForViewer } from '@/lib/erDb'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const isTvMode = searchParams.get('mode') === 'tv'

    const memberSession = await verifyMemberSession()
    const isStaff = Boolean(
      memberSession && ['doctor', 'nurse', 'admin', 'member'].includes(memberSession.role)
    )

    if (memberSession && isStaff) {
      logThrottledAudit(
        'READ',
        'er_regist',
        'Viewed ER live status and active patient registry',
        { username: memberSession.username, email: memberSession.email }
      ).catch((err) => logger.error({ err }, 'ER status audit log failed'))
    } else if (isTvMode) {
      logThrottledAudit(
        'READ',
        'er_regist',
        'Viewed ER live status via TV display mode (unauthenticated)',
        { username: 'TV_DISPLAY', email: '' }
      ).catch((err) => logger.error({ err }, 'ER status TV mode audit log failed'))
    }

    const erData = await fetchErLiveStatusData()
    return NextResponse.json(formatErStatusForViewer(erData, { isStaff, isTvMode }))
  } catch (error) {
    logger.error({ error }, 'ER Status API Error')
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลสถานะห้องฉุกเฉินได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    )
  }
}
