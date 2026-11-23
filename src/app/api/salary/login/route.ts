import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { salaryLoginSchema } from '@/lib/schemas/salary'
import { checkRateLimit } from '@/lib/rateLimit'
import { createSalarySession } from '@/lib/salaryAuth'
import { verifyMemberSession } from '@/lib/memberAuth'
import { SalaryPortalService } from '@/lib/salary/salaryPortalService'
import { logger } from '@/lib/logger'

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

    let authUser: { username: string; name: string } | null = null
    try {
      const res = await apiGateway.salary.verifyLogin(username, password)
      if (res?.user) {
        authUser = {
          username: res.user.username,
          name: res.user.name || res.user.username,
        }
      }
    } catch (dbError: unknown) {
      if ((dbError as { status?: number })?.status === 401) {
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' },
          { status: 401 }
        )
      }
      logger.error({ err: dbError }, 'Salary DB Connection Error')
      return NextResponse.json(
        {
          error:
            'ไม่สามารถเชื่อมต่อฐานข้อมูลระบบเงินเดือนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
        },
        { status: 500 }
      )
    }

    if (!authUser) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    await createSalarySession(
      authUser.username,
      authUser.name || authUser.username
    )

    try {
      const { logAudit } = await import('@/lib/audit')
      await logAudit(
        'LOGIN',
        'username',
        `User ${authUser.username} logged in to Salary portal manually`,
        { username: authUser.username, email: '' }
      )
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      name: authUser.name || authUser.username,
    })
  } catch (error) {
    logger.error({ err: error }, 'Salary login general error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูล' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const memberSession = await verifyMemberSession()
    if (!memberSession) {
      return NextResponse.json(
        { authenticated: false, error: 'กรุณาเข้าสู่ระบบหลักก่อน' },
        { status: 401 }
      )
    }

    const user = await SalaryPortalService.getStoredMemberSalaryCredentials(
      memberSession
    )
    if (!user) {
      return NextResponse.json(
        { authenticated: false, error: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' },
        { status: 401 }
      )
    }

    if (!user.salary_user || !user.salary_pass) {
      return NextResponse.json({
        authenticated: true,
        hasSalaryCredentials: false,
      })
    }

    let authUser: { username: string; name: string } | null = null
    try {
      const res = await apiGateway.salary.verifyLogin(
        user.salary_user,
        user.salary_pass
      )
      if (res?.user) {
        authUser = {
          username: res.user.username,
          name: res.user.name || res.user.username,
        }
      }
    } catch (dbError: unknown) {
      if ((dbError as { status?: number })?.status === 401) {
        return NextResponse.json(
          {
            error:
              'รหัสผ่านระบบเงินเดือนไม่ถูกต้อง หรือระบบภายนอกมีการเปลี่ยนแปลงข้อมูล',
          },
          { status: 401 }
        )
      }
      logger.error({ err: dbError }, 'SSO Salary DB Connection Error')
      return NextResponse.json(
        { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลระบบเงินเดือนได้ในขณะนี้' },
        { status: 500 }
      )
    }

    if (!authUser) {
      return NextResponse.json(
        {
          error:
            'รหัสผ่านระบบเงินเดือนไม่ถูกต้อง หรือระบบภายนอกมีการเปลี่ยนแปลงข้อมูล',
        },
        { status: 401 }
      )
    }

    await createSalarySession(authUser.username, authUser.name)

    try {
      const { logAudit } = await import('@/lib/audit')
      await logAudit(
        'LOGIN',
        'username',
        `User ${authUser.username} logged in to Salary portal via SSO`,
        { username: memberSession.username, email: memberSession.email }
      )
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      authenticated: true,
      hasSalaryCredentials: true,
      success: true,
      name: authUser.name || authUser.username,
    })
  } catch (error) {
    logger.error({ err: error }, 'SSO auto-login general error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบอัตโนมัติ' },
      { status: 500 }
    )
  }
}
