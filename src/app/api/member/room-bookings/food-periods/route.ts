import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }
    const periods = await queryMemberDb('SELECT * FROM meeting_room_food_periods ORDER BY name ASC')
    return NextResponse.json({ success: true, periods })
  } catch (error) {
    console.error('Fetch periods error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลช่วงเวลา' }, { status: 500 })
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
      return NextResponse.json({ error: 'กรุณากรอกชื่อช่วงเวลาอาหาร' }, { status: 400 })
    }

    await queryMemberDb('INSERT INTO meeting_room_food_periods (name) VALUES (?)', [name.trim()])
    return NextResponse.json({ success: true, message: 'เพิ่มช่วงเวลาอาหารเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Create period error:', error)
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'มีช่วงเวลานี้อยู่ในระบบแล้ว' }, { status: 400 })
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเพิ่มช่วงเวลา' }, { status: 500 })
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

    await queryMemberDb('UPDATE meeting_room_food_periods SET name = ? WHERE id = ?', [name.trim(), id])
    return NextResponse.json({ success: true, message: 'แก้ไขข้อมูลช่วงเวลาเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Update period error:', error)
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'มีช่วงเวลานี้อยู่ในระบบแล้ว' }, { status: 400 })
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขช่วงเวลา' }, { status: 500 })
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

    await queryMemberDb('DELETE FROM meeting_room_food_periods WHERE id = ?', [id])
    return NextResponse.json({ success: true, message: 'ลบช่วงเวลาอาหารเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Delete period error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบช่วงเวลา' }, { status: 500 })
  }
}
