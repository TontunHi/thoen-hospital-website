import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { MemberProfileService } from '@/lib/auth/memberProfileService'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    return NextResponse.json({ success: true, settings: member.settings })
  } catch (error) {
    logger.error({ err: error }, 'Fetch settings error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const body = (await request.json()) as Record<string, unknown>
    await MemberProfileService.updateSystemSettings(body, {
      username: member.username,
      email: member.email,
    })

    return NextResponse.json({
      success: true,
      message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว',
    })
  } catch (error) {
    logger.error({ err: error }, 'Save settings error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า' },
      { status: 500 }
    )
  }
}
