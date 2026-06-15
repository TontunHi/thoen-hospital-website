import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }
    const food = await queryMemberDb('SELECT * FROM meeting_room_food ORDER BY name ASC')
    return NextResponse.json({ success: true, food })
  } catch (error) {
    console.error('Fetch food error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอาหาร' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }
    const { name } = await request.json()
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    await queryMemberDb('INSERT INTO meeting_room_food (name, category, time_period, quantity) VALUES (?, "", "", 0)', [name.trim()])
    return NextResponse.json({ success: true, message: 'เพิ่มรายการอาหารเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Create food error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเพิ่มรายการอาหาร' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }
    const { id, name } = await request.json()
    if (!id || !name || name.trim() === '') {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    await queryMemberDb('UPDATE meeting_room_food SET name = ?, category = "", time_period = "", quantity = 0 WHERE id = ?', [name.trim(), id])
    return NextResponse.json({ success: true, message: 'แก้ไขข้อมูลอาหารเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Update food error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขรายการอาหาร' }, { status: 500 })
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

    await queryMemberDb('DELETE FROM meeting_room_food WHERE id = ?', [id])
    return NextResponse.json({ success: true, message: 'ลบรายการอาหารเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Delete food error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบรายการอาหาร' }, { status: 500 })
  }
}
