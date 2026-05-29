import { NextResponse } from 'next/server'
import { querySalaryDb } from '@/lib/salaryDb'
import { cookies } from 'next/headers'
import { salaryLoginSchema } from '@/lib/schemas/salary'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const rateCheck = await checkRateLimit({ key: 'salary-login', maxAttempts: 5, windowSeconds: 900 })
    if (!rateCheck.allowed) return rateCheck.response!

    const body = await request.json()
    const { username, password } = body

    const parsed = salaryLoginSchema.safeParse({ username, password })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    // Connect to external database and search for the user
    // We select user_name, name (assuming column name is 'name' or similar) from 'username' table
    let rows: any[] = []
    try {
      rows = await querySalaryDb(
        'SELECT user_name, name FROM username WHERE user_name = ? AND user_pass = ? LIMIT 1',
        [username, password]
      )
    } catch (dbError: any) {
      console.error('Salary DB Connection Error:', dbError)
      return NextResponse.json(
        { error: `ไม่สามารถเชื่อมต่อฐานข้อมูลระบบเงินเดือนได้ (192.168.1.4): ${dbError.message || dbError}` },
        { status: 500 }
      )
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    const user = rows[0]

    // Set browser session cookie
    const cookieStore = await cookies()
    cookieStore.set('salary_user_session', JSON.stringify({
      username: user.user_name,
      name: user.name || user.user_name // Fallback to username if name is empty
    }), {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1800,
    })

    return NextResponse.json({ success: true, name: user.name || user.user_name })
  } catch (error: any) {
    console.error('Salary login general error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูล' },
      { status: 500 }
    )
  }
}
