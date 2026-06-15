import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }
    const settings = await queryMemberDb('SELECT config_key, config_value FROM meeting_room_settings')
    
    // Convert array to key-value object
    const config: Record<string, string> = {}
    settings.forEach((s) => {
      config[s.config_key] = s.config_value
    })

    return NextResponse.json({ success: true, settings: config })
  } catch (error) {
    console.error('Fetch settings error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }
    const body = await request.json()
    
    // Save each config key-value
    for (const key of Object.keys(body)) {
      await queryMemberDb(
        `INSERT INTO meeting_room_settings (config_key, config_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE config_value = ?`,
        [key, body[key]?.toString() || '', body[key]?.toString() || '']
      )
    }

    return NextResponse.json({ success: true, message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Save settings error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า' }, { status: 500 })
  }
}
