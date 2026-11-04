import { NextResponse } from 'next/server'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

/**
 * PDPA Audit Log Retention API Endpoint
 * 
 * Complies with Thai PDPA & Hospital Auditing standards:
 * - Retention threshold must be at least 90 days.
 * - Requires Admin role session.
 * - Records an audit log entry upon deletion.
 */

export async function GET(request: Request) {
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const retentionDays = Math.max(90, parseInt(searchParams.get('days') || '90', 10))

    const countRows: any = await queryMemberDb(
      'SELECT COUNT(*) as expiredCount FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [retentionDays]
    )
    const expiredCount = countRows[0]?.expiredCount || 0

    return NextResponse.json({
      success: true,
      retentionDays,
      expiredCount,
      minRetentionDays: 90
    })
  } catch (error: any) {
    console.error('Check expired audit logs error:', error)
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถตรวจสอบจำนวนข้อมูลที่หมดอายุได้' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    let retentionDays = 90
    try {
      const body = await request.json()
      if (typeof body.retentionDays === 'number') {
        retentionDays = body.retentionDays
      }
    } catch {
      // Body is optional, defaults to 90
    }

    if (retentionDays < 90) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ระยะเวลาจัดเก็บขั้นต่ำต้องไม่น้อยกว่า 90 วันตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)' 
        },
        { status: 400 }
      )
    }

    // 1. ตรวจสอบจำนวนรายการที่หมดอายุ
    const countRows: any = await queryMemberDb(
      'SELECT COUNT(*) as expiredCount FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [retentionDays]
    )
    const expiredCount = countRows[0]?.expiredCount || 0

    if (expiredCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'ไม่มีรายการประวัติที่เก่าเกินเกณฑ์ที่กำหนด (ฐานข้อมูลสะอาดแล้ว)',
        expiredCount: 0,
        purgedCount: 0,
        retentionDays
      })
    }

    // 2. ลบเป็น Batch (Batch ละ 5,000 แถว) เพื่อป้องกัน DB Lock
    let totalPurged = 0
    while (totalPurged < expiredCount) {
      const result: any = await queryMemberDb(
        'DELETE FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 5000',
        [retentionDays]
      )
      const affected = result?.affectedRows || 0
      if (affected === 0) break
      totalPurged += affected
    }

    // 3. บันทึก Audit Log การล้างข้อมูลประวัติโดย Admin
    const adminUser = auth.session.username
    const adminEmail = auth.session.email
    await queryMemberDb(
      `INSERT INTO audit_logs (username, email, action_type, target_table, action_details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        adminUser,
        adminEmail,
        'DELETE',
        'audit_logs',
        `PDPA Maintenance: ล้างประวัติการใช้งานที่เก่ากว่า ${retentionDays} วัน จำนวน ${totalPurged} รายการ`,
        '127.0.0.1',
        'Web Admin Portal / PDPA Maintenance'
      ]
    )

    return NextResponse.json({
      success: true,
      message: `ล้างประวัติการใช้งานที่เก่ากว่า ${retentionDays} วัน สำเร็จแล้วจำนวน ${totalPurged.toLocaleString()} รายการ`,
      expiredCount,
      purgedCount: totalPurged,
      retentionDays
    })
  } catch (error: any) {
    console.error('Purge audit logs error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการล้างประวัติการใช้งานระบบ' },
      { status: 500 }
    )
  }
}
