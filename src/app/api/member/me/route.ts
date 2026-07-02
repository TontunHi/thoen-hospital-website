import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET() {
  try {
    const session = await verifyMemberSession()

    if (!session) {
      return NextResponse.json(
        { authenticated: false, error: 'ไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ' },
        { status: 200 }
      )
    }

    // Retrieve fresh info from database (including salary credentials status and role)
    const users = await queryMemberDb(
      'SELECT username, email, name, department, position, salary_user, salary_pass, role FROM members WHERE username = ? AND email = ?',
      [session.username, session.email]
    )

    if (!users || users.length === 0) {
      return NextResponse.json(
        { authenticated: false, error: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' },
        { status: 200 }
      )
    }

    const user = users[0]
    const position = (user.position || '').trim()

    // Query dynamic work system permissions from database
    let isWorkAuthorized = user.role === 'admin'
    let canCreateWork = user.role === 'admin'

    if (!isWorkAuthorized && position) {
      const perms = await queryMemberDb(
        "SELECT permission_key FROM position_permissions WHERE TRIM(position_name) = TRIM(?)",
        [position]
      )
      const keys = perms.map((p) => p.permission_key)
      if (keys.includes('create_work') || keys.includes('view_all_work')) {
        isWorkAuthorized = true
      }
      if (keys.includes('create_work')) {
        canCreateWork = true
      }
    }

    return NextResponse.json({
      authenticated: true,
      member: {
        username: user.username,
        email: user.email,
        name: user.name,
        department: user.department,
        position: user.position || '',
        role: user.role || 'member',
        hasSalaryCredentials: !!(user.salary_user && user.salary_pass),
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
