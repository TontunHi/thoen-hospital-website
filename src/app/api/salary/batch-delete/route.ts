import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roles'
import { querySalaryEditDb } from '@/lib/salaryDb'
import { logAudit } from '@/lib/audit'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('upload_salary')
    if (auth.error || !auth.session) {
      return auth.error
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'salary' or 'ot'

    if (!type || (type !== 'salary' && type !== 'ot')) {
      return NextResponse.json({ error: 'กรุณาระบุประเภทตารางข้อมูลที่ถูกต้อง (salary หรือ ot)' }, { status: 400 })
    }

    const tableName = type === 'salary' ? 'salary' : 'ot'

    // Find the latest inserted row with valid c1 date
    const latestRows = await querySalaryEditDb(
      `SELECT DATE_FORMAT(c1, '%Y-%m-%d') as latest_date, c1 as raw_c1 
       FROM ${tableName} 
       WHERE c1 IS NOT NULL 
         AND c1 != '0000-00-00' 
         AND TRIM(c1) != '' 
       ORDER BY id DESC 
       LIMIT 1`
    )

    if (!latestRows || latestRows.length === 0) {
      return NextResponse.json({
        success: true,
        latestBatch: null,
      })
    }

    const latestDate = latestRows[0].latest_date || (typeof latestRows[0].raw_c1 === 'string' ? latestRows[0].raw_c1.substring(0, 10) : '')

    if (!latestDate || latestDate === '0000-00-00') {
      return NextResponse.json({
        success: true,
        latestBatch: null,
      })
    }

    // Count records with this c1 date
    const countRows = await querySalaryEditDb(
      `SELECT COUNT(*) as total_count FROM ${tableName} WHERE DATE_FORMAT(c1, '%Y-%m-%d') = ? OR c1 = ?`,
      [latestDate, latestDate]
    )

    const totalCount = countRows[0]?.total_count || 0

    return NextResponse.json({
      success: true,
      latestBatch: {
        tableName,
        date: latestDate,
        count: totalCount,
      },
    })
  } catch (error: any) {
    console.error('Fetch latest salary batch error:', error)
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลชุดข้อมูลล่าสุดได้' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requirePermission('upload_salary')
    if (auth.error || !auth.session) {
      return auth.error
    }

    const body = await request.json()
    const { type, confirmedDate } = body

    if (!type || (type !== 'salary' && type !== 'ot')) {
      return NextResponse.json({ error: 'กรุณาระบุประเภทตารางข้อมูลที่ถูกต้อง (salary หรือ ot)' }, { status: 400 })
    }

    if (!confirmedDate || typeof confirmedDate !== 'string') {
      return NextResponse.json({ error: 'กรุณาระบุวันที่ของชุดข้อมูลที่ต้องการลบ' }, { status: 400 })
    }

    const tableName = type === 'salary' ? 'salary' : 'ot'

    // Double-check the latest row again to verify it matches confirmedDate
    const latestRows = await querySalaryEditDb(
      `SELECT DATE_FORMAT(c1, '%Y-%m-%d') as latest_date, c1 as raw_c1 
       FROM ${tableName} 
       WHERE c1 IS NOT NULL 
         AND c1 != '0000-00-00' 
         AND TRIM(c1) != '' 
       ORDER BY id DESC 
       LIMIT 1`
    )

    if (!latestRows || latestRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบชุดข้อมูลล่าสุดในตาราง' }, { status: 404 })
    }

    const currentLatestDate = latestRows[0].latest_date || (typeof latestRows[0].raw_c1 === 'string' ? latestRows[0].raw_c1.substring(0, 10) : '')

    if (currentLatestDate !== confirmedDate) {
      return NextResponse.json({
        error: `ข้อมูลมีการเปลี่ยนแปลง ชุดข้อมูลล่าสุดปัจจุบันคือวันที่ ${currentLatestDate} กรุณารีเฟรชและตรวจสอบอีกครั้ง`,
      }, { status: 409 })
    }

    // Check count before deletion
    const countRows = await querySalaryEditDb(
      `SELECT COUNT(*) as total_count FROM ${tableName} WHERE DATE_FORMAT(c1, '%Y-%m-%d') = ? OR c1 = ?`,
      [confirmedDate, confirmedDate]
    )
    const itemsToDelete = countRows[0]?.total_count || 0

    if (itemsToDelete === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการข้อมูลในวันที่ระบุ' }, { status: 404 })
    }

    // Execute deletion of all rows with this c1
    const deleteResult: any = await querySalaryEditDb(
      `DELETE FROM ${tableName} WHERE DATE_FORMAT(c1, '%Y-%m-%d') = ? OR c1 = ?`,
      [confirmedDate, confirmedDate]
    )

    const affectedRows = deleteResult?.affectedRows ?? itemsToDelete

    // Audit log
    await logAudit(
      'DELETE',
      tableName,
      `ลบชุดข้อมูล ${type.toUpperCase()} ล่าสุด วันที่ c1 = ${confirmedDate} จำนวน ${affectedRows} รายการ`,
      auth.session
    )

    return NextResponse.json({
      success: true,
      message: `ลบชุดข้อมูล ${type === 'salary' ? 'เงินเดือน' : 'ค่าเวร/OT'} ประจำงวดวันที่ ${confirmedDate} เรียบร้อยแล้ว ทั้งหมด ${affectedRows} รายการ`,
      deletedCount: affectedRows,
      deletedDate: confirmedDate,
    })
  } catch (error: any) {
    console.error('Delete salary batch error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบชุดข้อมูล' }, { status: 500 })
  }
}
