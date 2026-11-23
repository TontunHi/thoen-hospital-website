import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import {
  MemberProfileError,
  MemberProfileService,
} from '@/lib/auth/memberProfileService'
import { logger } from '@/lib/logger'

export async function POST() {
  try {
    const { error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const stats = await MemberProfileService.syncSalaryCredentials()

    return NextResponse.json({
      success: true,
      message: 'ซิงค์ข้อมูลสลิปเงินเดือนเรียบร้อยแล้ว',
      stats,
    })
  } catch (error) {
    if (error instanceof MemberProfileError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Salary sync error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลระบบเงินเดือน' },
      { status: 500 }
    )
  }
}
