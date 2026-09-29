import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { querySalaryDb } from '@/lib/salaryDb'

export async function POST() {
  try {
    const { error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

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
