import { NextResponse } from 'next/server'
import { destroyMemberSession, verifyMemberSession } from '@/lib/memberAuth'

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
        console.error('Failed to log logout event:', auditErr)
      }
    }
    await destroyMemberSession()
    return NextResponse.json({ success: true, message: 'ออกจากระบบเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Member logout error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการออกจากระบบ' },
      { status: 500 }
    )
  }
}
