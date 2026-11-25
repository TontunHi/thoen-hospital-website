import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const { member, error } = await requireMemberApi()

    if (error || !member) {
      return NextResponse.json(
        { authenticated: false, error: 'ไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ' },
        { status: 200 }
      )
    }

    const isWorkAuthorized = member.role === 'admin' || member.can('create_work') || member.can('view_all_work')
    const canCreateWork = member.role === 'admin' || member.can('create_work')

    return NextResponse.json({
      authenticated: true,
      member: {
        id: member.id,
        username: member.username,
        email: member.email,
        name: member.name,
        department: member.department,
        position: member.position,
        role: member.role,
        hasProfileImage: Boolean(member.profilePath),
        hasSalaryCredentials: member.hasSalaryCredentials,
        isWorkAuthorized,
        canCreateWork
      },
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Member me route error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการตรวจสอบเซสชัน' },
      { status: 500 }
    )
  }
}
