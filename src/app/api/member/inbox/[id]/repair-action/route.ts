import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { executeRepairAction } from '@/lib/taskInboxService'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id: taskId } = await params
    const body = await request.json()
    const { action, ...payload } = body

    if (!action) {
      return NextResponse.json({ error: 'กรุณาระบุ Action ที่ต้องการดำเนินการ' }, { status: 400 })
    }

    // Fetch current member record
    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]

    const result = await executeRepairAction({
      taskId,
      action,
      performer: currentMember,
      payload,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode || 400 })
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    })
  } catch (error: any) {
    console.error('Repair action error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการทำรายการ: ' + (error?.message || '') },
      { status: 500 }
    )
  }
}
