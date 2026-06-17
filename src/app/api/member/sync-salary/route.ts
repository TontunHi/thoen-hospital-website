import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { querySalaryDb } from '@/lib/salaryDb'

async function requireMemberAdmin(): Promise<
  { error: string; status: number; session?: never } |
  { error?: never; status?: never; session: { username: string; email: string; role: string } }
> {
  const session = await verifyMemberSession()
  if (!session) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน', status: 401 }
  }

  const users = await queryMemberDb(
    'SELECT role FROM members WHERE username = ? AND email = ?',
    [session.username, session.email]
  )

  if (!users || users.length === 0 || users[0].role !== 'admin') {
    return { error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้', status: 403 }
  }

  return { session }
}

export async function POST() {
  try {
    const auth = await requireMemberAdmin()
    if (auth.error || !auth.session) {
      return NextResponse.json({ error: auth.error || 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: auth.status || 401 })
    }

    // Fetch credentials from the external Salary database
    let salaryUsers: any[] = []
    try {
      salaryUsers = await querySalaryDb('SELECT user_name, user_pass FROM username')
    } catch (dbError: any) {
      console.error('External Salary DB fetch error:', dbError)
      return NextResponse.json(
        { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลระบบเงินเดือนได้ในขณะนี้' },
        { status: 500 }
      )
    }

    // Fetch existing members in the system
    const members = await queryMemberDb('SELECT id, username FROM members')
    const memberMap = new Map<string, number>()
    members.forEach((m) => {
      if (m.username) {
        memberMap.set(m.username.trim(), m.id)
      }
    })

    let matchedCount = 0
    let notMatchedCount = 0

    // Loop through salary credentials and update matching members
    for (const sUser of salaryUsers) {
      const username = sUser.user_name?.trim()
      const password = sUser.user_pass?.trim()
      if (!username) continue

      const memberId = memberMap.get(username)
      if (memberId !== undefined) {
        await queryMemberDb(
          'UPDATE members SET salary_user = ?, salary_pass = ? WHERE id = ?',
          [username, password, memberId]
        )
        matchedCount++
      } else {
        notMatchedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: 'ซิงค์ข้อมูลสลิปเงินเดือนเรียบร้อยแล้ว',
      stats: {
        matchedCount,
        notMatchedCount,
        totalSalaryUsers: salaryUsers.length,
      }
    })
  } catch (error: any) {
    console.error('Salary sync error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลระบบเงินเดือน' },
      { status: 500 }
    )
  }
}
