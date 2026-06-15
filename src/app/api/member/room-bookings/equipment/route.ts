import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }
    const equipment = await queryMemberDb('SELECT * FROM meeting_room_equipment ORDER BY name ASC')
    return NextResponse.json({ success: true, equipment })
  } catch (error) {
    console.error('Fetch equipment error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }
    const { name, quantity } = await request.json()
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    await queryMemberDb('INSERT INTO meeting_room_equipment (name, quantity) VALUES (?, ?)', [name.trim(), quantity !== undefined ? parseInt(quantity) : 0])
    return NextResponse.json({ success: true, message: 'เพิ่มรายการอุปกรณ์เรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Create equipment error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }
    const { id, name, quantity } = await request.json()
    if (!id || !name || name.trim() === '') {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    await queryMemberDb('UPDATE meeting_room_equipment SET name = ?, quantity = ? WHERE id = ?', [name.trim(), quantity !== undefined ? parseInt(quantity) : 0, id])
    return NextResponse.json({ success: true, message: 'แก้ไขข้อมูลอุปกรณ์เรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Update equipment error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขอุปกรณ์' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    await queryMemberDb('DELETE FROM meeting_room_equipment WHERE id = ?', [id])
    return NextResponse.json({ success: true, message: 'ลบรายการอุปกรณ์เรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Delete equipment error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบอุปกรณ์' }, { status: 500 })
  }
}
