import { NextResponse } from 'next/server'
import { querySalaryDb } from '@/lib/salaryDb'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' },
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
      sameSite: 'lax',
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
