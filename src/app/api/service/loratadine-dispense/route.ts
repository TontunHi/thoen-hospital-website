import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'

export async function GET(request: Request) {
  try {
    // 1. Authenticate user (Hospital Staff/Member)
    const memberSession = await verifyMemberSession()

    if (!memberSession) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters (filter: 'adult' for > 19 yrs or 'all')
    const { searchParams } = new URL(request.url)
    const ageFilter = searchParams.get('age') || 'adult'

    let ageClause = ''
    if (ageFilter === 'adult') {
      ageClause = 'AND (YEAR(o.vstdate) - YEAR(p.birthday)) > 19'
    }

    // 3. Query Loratadine (icode = '1460211') dispensed today from HOSxP
    const sql = `
      SELECT 
        o.hn,
        YEAR(o.vstdate) - YEAR(p.birthday) AS age,
        CONCAT(p.pname, p.fname, ' ', p.lname) AS fullname,
        IF(o.vn IS NULL, 'IPD', 'OPD') AS status,
        o.vstdate,
        o.rxdate,
        TIME_FORMAT(o.rxtime, '%H:%i:%s') AS rxtime,
        o.qty,
        COALESCE(d.name, 'ไม่ระบุผู้สั่งตรวจ/จ่ายยา') AS doctor_name,
        COALESCE(k.department, 'ไม่ระบุแผนก') AS department
      FROM opitemrece o
      LEFT JOIN patient p ON o.hn = p.hn
      LEFT JOIN doctor d ON o.doctor = d.code
      LEFT JOIN kskdepartment k ON o.dep_code = k.depcode
      WHERE o.icode = '1460211'
        AND o.vstdate = CURDATE()
        ${ageClause}
      ORDER BY o.rxtime DESC
    `

    const rows = await queryHosDb(sql)

    // 4. Compute daily statistics
    const totalCount = rows.length
    const totalQty = rows.reduce((sum, item: any) => sum + (Number(item.qty) || 0), 0)
    const opdCount = rows.filter((item: any) => item.status === 'OPD').length
    const ipdCount = rows.filter((item: any) => item.status === 'IPD').length
    const adultCount = rows.filter((item: any) => Number(item.age) > 19).length

    // 5. Record audit log
    await logAudit(
      'READ',
      'loratadine_dispense_log',
      `เข้าดูรายการจ่ายยาลอราทาดีน (พบ ${totalCount} รายการ, เงื่อนไขอายุ: ${ageFilter})`,
      memberSession
    )

    return NextResponse.json({
      success: true,
      items: rows.map((r: any) => ({
        hn: r.hn,
        fullname: r.fullname,
        age: r.age,
        status: r.status,
        vstdate: r.vstdate,
        rxdate: r.rxdate,
        rxtime: r.rxtime ? r.rxtime.substring(0, 5) + ' น.' : '-',
        qty: Number(r.qty) || 0,
        doctorName: r.doctor_name,
        department: r.department,
      })),
      summary: {
        totalCount,
        totalQty,
        opdCount,
        ipdCount,
        adultCount,
      },
    })
  } catch (error: any) {
    console.error('Loratadine Dispense API Error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจ่ายยาจากระบบหลัก' },
      { status: 500 }
    )
  }
}
