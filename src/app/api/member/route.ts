import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

// Helper to verify member admin session
async function requireMemberAdmin(): Promise<
  { error: string; status: number; session?: never } |
  { error?: never; status?: never; session: { username: string; email: string; role: string } }
> {
  const session = await verifyMemberSession()
  if (!session) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน', status: 401 }
  }

  // Fetch role from DB to verify freshest credentials
  const users = await queryMemberDb(
    'SELECT role FROM members WHERE username = ? AND email = ?',
    [session.username, session.email]
  )

  if (!users || users.length === 0 || users[0].role !== 'admin') {
    return { error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้', status: 403 }
  }

  return { session }
}

// GET: Retrieve all members (admin only)
export async function GET() {
  try {
    const auth = await requireMemberAdmin()
    if (auth.error || !auth.session) {
      return NextResponse.json({ error: auth.error || 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: auth.status || 401 })
    }

    const members = await queryMemberDb(
      "SELECT id, username, email, name, department, position, salary_user, IF(salary_pass IS NULL OR salary_pass = '', NULL, '********') AS salary_pass, role, created_at, updated_at FROM members ORDER BY created_at DESC"
    )

    return NextResponse.json({ success: true, members })
  } catch (error: any) {
    console.error('Fetch members error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก' },
      { status: 500 }
    )
  }
}

// PUT: Update member details (admin only)
export async function PUT(request: Request) {
  try {
    const auth = await requireMemberAdmin()
    if (auth.error || !auth.session) {
      return NextResponse.json({ error: auth.error || 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: auth.status || 401 })
    }

    const body = await request.json()
    const { id, username, email, name, department, position, salary_user, salary_pass, role } = body

    if (!id || !username || !email || !role) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลที่จำเป็น' },
        { status: 400 }
      )
    }

    let finalRole = role
    if (auth.session.username) {
      const targetUser = await queryMemberDb('SELECT username, role FROM members WHERE id = ?', [id])
      if (targetUser && targetUser.length > 0 && targetUser[0].username === auth.session.username) {
        // Force role to remain unchanged when editing self
        finalRole = targetUser[0].role
      }
    }

    if (finalRole !== 'member' && finalRole !== 'admin') {
      return NextResponse.json(
        { error: 'สิทธิ์การใช้งานไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // Check for duplicate username or email (excluding current user ID)
    const duplicates = await queryMemberDb(
      'SELECT id FROM members WHERE (username = ? OR email = ?) AND id != ?',
      [username.trim(), email.trim(), id]
    )

    if (duplicates && duplicates.length > 0) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้งานหรืออีเมลนี้ถูกใช้งานแล้วในระบบ' },
        { status: 400 }
      )
    }

    // Retrieve existing salary password to preserve it if not changed (sent as '********')
    const existing = await queryMemberDb('SELECT salary_pass FROM members WHERE id = ? LIMIT 1', [id])
    const oldPass = existing.length > 0 ? existing[0].salary_pass : null
    const finalSalaryPass = (salary_pass === '********') ? oldPass : (salary_pass ? salary_pass.trim() : null)

    // Update member details
    await queryMemberDb(
      `UPDATE members 
       SET username = ?, email = ?, name = ?, department = ?, position = ?, salary_user = ?, salary_pass = ?, role = ?
       WHERE id = ?`,
       [
         username.trim(),
         email.trim(),
         name ? name.trim() : null,
         department ? department.trim() : null,
         position ? position.trim() : null,
         salary_user ? salary_user.trim() : null,
         finalSalaryPass,
         finalRole,
         id
       ]
     )

    return NextResponse.json({ success: true, message: 'แก้ไขข้อมูลสมาชิกเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Update member error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลสมาชิก' },
      { status: 500 }
    )
  }
}

// DELETE: Remove member (admin only)
export async function DELETE(request: Request) {
  try {
    const auth = await requireMemberAdmin()
    if (auth.error || !auth.session) {
      return NextResponse.json({ error: auth.error || 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: auth.status || 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบ ID สมาชิกที่จะลบ' }, { status: 400 })
    }

    // Prevent admin from deleting themselves
    if (auth.session.username) {
      const targetUser = await queryMemberDb('SELECT username FROM members WHERE id = ?', [id])
      if (targetUser && targetUser.length > 0 && targetUser[0].username === auth.session.username) {
        return NextResponse.json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' }, { status: 400 })
      }
    }

    await queryMemberDb('DELETE FROM members WHERE id = ?', [id])

    return NextResponse.json({ success: true, message: 'ลบสมาชิกเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Delete member error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูลสมาชิก' },
      { status: 500 }
    )
  }
}

// POST: Create a new member (admin only)
export async function POST(request: Request) {
  try {
    const auth = await requireMemberAdmin()
    if (auth.error || !auth.session) {
      return NextResponse.json({ error: auth.error || 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: auth.status || 401 })
    }

    const body = await request.json()
    const { username, email, name, department, position, salary_user, salary_pass, role } = body

    if (!username || !email || !role) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลที่จำเป็น' },
        { status: 400 }
      )
    }

    if (role !== 'member' && role !== 'admin') {
      return NextResponse.json(
        { error: 'สิทธิ์การใช้งานไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // Check for duplicate username or email
    const duplicates = await queryMemberDb(
      'SELECT id FROM members WHERE username = ? OR email = ?',
      [username.trim(), email.trim()]
    )

    if (duplicates && duplicates.length > 0) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้งานหรืออีเมลนี้ถูกใช้งานแล้วในระบบ' },
        { status: 400 }
      )
    }

    // Insert new member
    await queryMemberDb(
      `INSERT INTO members (username, email, name, department, position, salary_user, salary_pass, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username.trim(),
        email.trim(),
        name ? name.trim() : null,
        department ? department.trim() : null,
        position ? position.trim() : null,
        salary_user ? salary_user.trim() : null,
        salary_pass ? salary_pass.trim() : null,
        role
      ]
    )

    return NextResponse.json({ success: true, message: 'เพิ่มสมาชิกใหม่เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Create member error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างสมาชิกใหม่' },
      { status: 500 }
    )
  }
}
