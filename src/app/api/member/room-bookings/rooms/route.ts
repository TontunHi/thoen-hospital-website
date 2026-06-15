import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }
    const rooms = await queryMemberDb('SELECT * FROM meeting_rooms ORDER BY name ASC')
    return NextResponse.json({ success: true, rooms })
  } catch (error) {
    console.error('Fetch rooms error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลห้องประชุม' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }
    const { name, is_active } = await request.json()
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'กรุณากรอกชื่อห้องประชุม' }, { status: 400 })
    }

    await queryMemberDb('INSERT INTO meeting_rooms (name, is_active) VALUES (?, ?)', [name.trim(), is_active ? 1 : 0])
    return NextResponse.json({ success: true, message: 'เพิ่มห้องประชุมเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Create room error:', error)
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'มีชื่อห้องประชุมนี้อยู่ในระบบแล้ว' }, { status: 400 })
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเพิ่มห้องประชุม' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }
    const { id, name, is_active } = await request.json()
    if (!id || !name || name.trim() === '') {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    await queryMemberDb('UPDATE meeting_rooms SET name = ?, is_active = ? WHERE id = ?', [name.trim(), is_active ? 1 : 0, id])
    return NextResponse.json({ success: true, message: 'แก้ไขข้อมูลห้องประชุมเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Update room error:', error)
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'มีชื่อห้องประชุมนี้อยู่ในระบบแล้ว' }, { status: 400 })
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขห้องประชุม' }, { status: 500 })
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

    await queryMemberDb('DELETE FROM meeting_rooms WHERE id = ?', [id])
    return NextResponse.json({ success: true, message: 'ลบห้องประชุมเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Delete room error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบห้องประชุม' }, { status: 500 })
  }
}
