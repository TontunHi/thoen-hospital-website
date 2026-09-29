import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'

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
        hasSalaryCredentials: member.hasSalaryCredentials,
        isWorkAuthorized,
        canCreateWork
      },
    })
  } catch (error: any) {
    console.error('Member me route error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการตรวจสอบเซสชัน' },
      { status: 500 }
    )
  }
}
