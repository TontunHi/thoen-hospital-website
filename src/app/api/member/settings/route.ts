import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'

export async function GET() {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    return NextResponse.json({ success: true, settings: member.settings })
  } catch (error) {
    console.error('Fetch settings error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const body = await request.json()
    
    // Save each config key-value
    for (const key of Object.keys(body)) {
      await queryMemberDb(
        `INSERT INTO member_system_settings (config_key, config_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE config_value = ?`,
        [key, body[key]?.toString() || '', body[key]?.toString() || '']
      )
    }

    await logAudit(
      'UPDATE_SETTINGS',
      'member_system_settings',
      `Admin updated system settings (${Object.keys(body).join(', ')})`,
      { username: member.username, email: member.email }
    )

    return NextResponse.json({ success: true, message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Save settings error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า' }, { status: 500 })
  }
}
