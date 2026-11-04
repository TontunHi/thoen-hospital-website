import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { salaryLoginSchema } from '@/lib/schemas/salary'
import { checkRateLimit } from '@/lib/rateLimit'
import { createSalarySession } from '@/lib/salaryAuth'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'


export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    const parsed = salaryLoginSchema.safeParse({ username, password })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const rateCheck = await checkRateLimit({
      key: 'salary-login',
      identifier: username,
      maxAttempts: 5,
      windowSeconds: 300,
    })
    if (!rateCheck.allowed) return rateCheck.response!

    // Connect to external database via Gateway and verify credentials
    let authUser: { username: string; name: string } | null = null
    try {
      const res = await apiGateway.salary.verifyLogin(username, password)
      if (res?.user) {
        authUser = { username: res.user.username, name: res.user.name || res.user.username }
      }
    } catch (dbError: any) {
      if (dbError?.status === 401) {
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' },
          { status: 401 }
        )
      }
      console.error('Salary DB Connection Error:', dbError)
      return NextResponse.json(
        { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลระบบเงินเดือนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' },
        { status: 500 }
      )
    }

    if (!authUser) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    const user = { user_name: authUser.username, name: authUser.name }

    // Set secure signed browser session cookie
    await createSalarySession(user.user_name, user.name || user.user_name)

    // Log login event
    try {
      const { logAudit } = await import('@/lib/audit')
      await logAudit(
        'LOGIN',
        'username',
        `User ${user.user_name} logged in to Salary portal manually`,
        { username: user.user_name, email: '' }
      )
    } catch (e) {}

    return NextResponse.json({ success: true, name: user.name || user.user_name })
  } catch (error: any) {
    console.error('Salary login general error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูล' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // 1. Verify the Member portal session
    const memberSession = await verifyMemberSession()
    if (!memberSession) {
      return NextResponse.json(
        { authenticated: false, error: 'กรุณาเข้าสู่ระบบหลักก่อน' },
        { status: 401 }
      )
    }

    // 2. Fetch the stored salary credentials from member database
    const users = await queryMemberDb(
      'SELECT salary_user, salary_pass FROM members WHERE username = ? AND email = ? LIMIT 1',
      [memberSession.username, memberSession.email]
    )

    if (!users || users.length === 0) {
      return NextResponse.json(
        { authenticated: false, error: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' },
        { status: 401 }
      )
    }

    const user = users[0]

    // If credentials are not saved in member portal yet, return success: false but authenticated: true
    if (!user.salary_user || !user.salary_pass) {
      return NextResponse.json({
        authenticated: true,
        hasSalaryCredentials: false,
      })
    }

    // 3. Connect to external database and verify
    let authUser: { username: string; name: string } | null = null
    try {
      const res = await apiGateway.salary.verifyLogin(user.salary_user, user.salary_pass)
      if (res?.user) {
        authUser = { username: res.user.username, name: res.user.name || res.user.username }
      }
    } catch (dbError: any) {
      if (dbError?.status === 401) {
        return NextResponse.json(
          { error: 'รหัสผ่านระบบเงินเดือนไม่ถูกต้อง หรือระบบภายนอกมีการเปลี่ยนแปลงข้อมูล' },
          { status: 401 }
        )
      }
      console.error('SSO Salary DB Connection Error:', dbError)
      return NextResponse.json(
        { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลระบบเงินเดือนได้ในขณะนี้' },
        { status: 500 }
      )
    }

    if (!authUser) {
      return NextResponse.json(
        { error: 'รหัสผ่านระบบเงินเดือนไม่ถูกต้อง หรือระบบภายนอกมีการเปลี่ยนแปลงข้อมูล' },
        { status: 401 }
      )
    }

    // 4. Set secure signed browser session cookie for Salary portal
    await createSalarySession(authUser.username, authUser.name)

    // Log login event
    try {
      const { logAudit } = await import('@/lib/audit')
      await logAudit(
        'LOGIN',
        'username',
        `User ${authUser.username} logged in to Salary portal via SSO`,
        { username: memberSession.username, email: memberSession.email }
      )
    } catch (e) {}

    return NextResponse.json({
      authenticated: true,
      hasSalaryCredentials: true,
      success: true,
      name: authUser.name || authUser.username
    })
  } catch (error: any) {
    console.error('SSO auto-login general error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบอัตโนมัติ' },
      { status: 500 }
    )
  }
}


