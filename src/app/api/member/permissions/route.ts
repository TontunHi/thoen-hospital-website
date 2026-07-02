import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

// GET: Retrieve all permissions & a list of unique member positions
export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้' }, { status: 403 })
    }

    // 1. Fetch current mappings
    const mappings = await queryMemberDb(
      'SELECT id, permission_key, position_name FROM position_permissions ORDER BY permission_key, position_name'
    )

    // 2. Fetch list of unique positions from members table to assist in UI selection
    const positionsResult = await queryMemberDb(
      'SELECT DISTINCT TRIM(position) as position FROM members WHERE position IS NOT NULL AND TRIM(position) != "" ORDER BY position'
    )
    const availablePositions = positionsResult.map((r) => r.position)

    return NextResponse.json({
      success: true,
      mappings,
      availablePositions
    })
  } catch (error: any) {
    console.error('Fetch permissions error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์' }, { status: 500 })
  }
}

// POST: Add a new position-permission mapping
export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงการจัดการสิทธิ์' }, { status: 403 })
    }

    const { permission_key, position_name } = await request.json()

    if (!permission_key || !position_name || !position_name.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุสิทธิ์และชื่อตำแหน่งงาน' }, { status: 400 })
    }

    await queryMemberDb(
      'INSERT IGNORE INTO position_permissions (permission_key, position_name) VALUES (?, ?)',
      [permission_key, position_name.trim()]
    )

    return NextResponse.json({ success: true, message: 'เพิ่มสิทธิ์สำหรับตำแหน่งสำเร็จ' })
  } catch (error: any) {
    console.error('Add permission error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเพิ่มสิทธิ์' }, { status: 500 })
  }
}

// DELETE: Remove a position-permission mapping
export async function DELETE(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงการจัดการสิทธิ์' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const permission_key = searchParams.get('permission_key')
    const position_name = searchParams.get('position_name')

    if (!permission_key || !position_name) {
      return NextResponse.json({ error: 'พารามิเตอร์ไม่ครบถ้วน' }, { status: 400 })
    }

    await queryMemberDb(
      'DELETE FROM position_permissions WHERE permission_key = ? AND position_name = ?',
      [permission_key, position_name]
    )

    return NextResponse.json({ success: true, message: 'ลบสิทธิ์สำหรับตำแหน่งสำเร็จ' })
  } catch (error: any) {
    console.error('Delete permission error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบสิทธิ์' }, { status: 500 })
  }
}
