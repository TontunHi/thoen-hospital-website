import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { apiGateway } from '@/lib/apiGateway'

async function checkFinanceAccess() {
  const session = await verifyMemberSession()
  if (!session) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน', status: 401 }
  }

  const users = await queryMemberDb(
    'SELECT role, position FROM members WHERE username = ? AND email = ?',
    [session.username, session.email]
  )

  if (!users || users.length === 0) {
    return { error: 'ไม่พบข้อมูลสมาชิกในระบบ', status: 403 }
  }

  const member = users[0]
  let isFinance = member.role === 'admin' || (member.position && member.position.includes('เจ้าพนักงานการเงินและบัญชี'))

  if (!isFinance && member.position) {
    const finPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'upload_salary' AND TRIM(position_name) = TRIM(?)",
      [member.position]
    )
    isFinance = (finPerms[0]?.count || 0) > 0
  }

  if (!isFinance) {
    return { error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้', status: 403 }
  }

  return { success: true }
}

export async function GET() {
  try {
    const auth = await checkFinanceAccess()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const periods = await apiGateway.salary.getPeriods()
    return NextResponse.json({ success: true, periods })
  } catch (error: any) {
    console.error('Fetch salary periods error:', error)
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลรอบการจ่ายเงินได้' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await checkFinanceAccess()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { type, datein, notesalary } = body

    if (!type || !datein) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลประเภทและวันที่ให้ครบถ้วน' }, { status: 400 })
    }

    await apiGateway.salary.createPeriod({
      type: type.toString(),
      datein,
      notesalary: notesalary || ''
    })

    return NextResponse.json({ success: true, message: 'บันทึกรอบการจ่ายเงินสำเร็จ' })
  } catch (error: any) {
    console.error('Create salary period error:', error)
    return NextResponse.json({ error: 'ไม่สามารถบันทึกรอบการจ่ายเงินได้' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await checkFinanceAccess()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { id, type, datein, notesalary } = body

    if (!id || !type || !datein) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลรหัสรอบ ประเภท และวันที่ให้ครบถ้วน' }, { status: 400 })
    }

    await apiGateway.salary.updatePeriod(id, {
      type: type.toString(),
      datein,
      notesalary: notesalary || null
    })

    return NextResponse.json({ success: true, message: 'แก้ไขรอบการจ่ายเงินสำเร็จ' })
  } catch (error: any) {
    console.error('Update salary period error:', error)
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขรอบการจ่ายเงินได้' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await checkFinanceAccess()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ไม่ระบุรหัสของรอบการจ่ายเงินที่ต้องการลบ' }, { status: 400 })
    }

    await apiGateway.salary.deletePeriod(id)

    return NextResponse.json({ success: true, message: 'ลบรอบการจ่ายเงินเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Delete salary period error:', error)
    return NextResponse.json({ error: 'ไม่สามารถลบรอบการจ่ายเงินได้' }, { status: 500 })
  }
}
