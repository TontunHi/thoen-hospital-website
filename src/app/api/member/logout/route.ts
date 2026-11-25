import { NextResponse } from 'next/server'
import { destroyMemberSession, verifyMemberSession } from '@/lib/memberAuth'
import { destroySalarySession } from '@/lib/salaryAuth'
import { logger } from '@/lib/logger'

export async function POST() {
  try {
    const session = await verifyMemberSession()
    if (session) {
      try {
        const { logAudit } = await import('@/lib/audit')
        await logAudit(
          'LOGOUT',
          'members',
          `User ${session.username} logged out`,
          session
        )
      } catch (auditErr) {
        logger.error({ auditErr }, 'Failed to log logout event')
      }
    }
    await destroyMemberSession()
    await destroySalarySession()
    return NextResponse.json({ success: true, message: 'ออกจากระบบเรียบร้อยแล้ว' })
  } catch (error: unknown) {
    logger.error({ error }, 'Member logout error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการออกจากระบบ' },
      { status: 500 }
    )
  }
}
