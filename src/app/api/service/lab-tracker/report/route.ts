import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { verifyMemberSession } from '@/lib/memberAuth'

export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const memberSession = await verifyMemberSession()

    if (!memberSession) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const doctorCode = searchParams.get('id')

    let pendingSql = ''
    let reportedSql = ''
    let params: any[] = []

    if (doctorCode && doctorCode !== 'all') {
      // Fetch for a specific doctor
      pendingSql = `
        SELECT d.code, d.name, lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
        time(lh.order_time) as order_time, lh.form_name, time(lh.receive_time) as receive_time 
        FROM lab_head lh  
        left outer join patient pt on lh.hn=pt.hn 
        left outer join doctor d on lh.doctor_code=d.code 
        WHERE lh.order_date = CURRENT_DATE() 
          and lh.department = 'OPD' 
          and d.name is not null 
          and lh.report_date is null 
          and d.code = ? 
        GROUP BY lh.hn 
        ORDER BY lh.lab_order_number ASC
      `
      reportedSql = `
        SELECT d.code, d.name, lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
        time(lh.report_time) as report_time, lh.lab_order_number, ovst.ovstost 
        FROM lab_head lh  
        left outer join patient pt on lh.hn=pt.hn 
        left outer join ovst ovst on lh.hn=ovst.hn 
        left outer join doctor d on lh.doctor_code=d.code 
        WHERE lh.order_date = CURRENT_DATE() 
          and lh.department = 'OPD' 
          and d.name is not null 
          and lh.report_date is not null 
          and d.code = ? 
        GROUP BY lh.hn 
        ORDER BY lh.report_time DESC
      `
      params = [doctorCode]
    } else {
      // Fetch for all doctor orders
      pendingSql = `
        SELECT d.code, substring_index(d.name, ' ', 1) as name, lh.hn, 
        concat(pt.pname, pt.fname) as ptname, time(lh.order_time) as order_time,
        time(lh.receive_time) as receive_time, lh.form_name 
        FROM lab_head lh  
        left outer join patient pt on lh.hn=pt.hn 
        left outer join doctor d on lh.doctor_code=d.code 
        WHERE lh.order_date = CURRENT_DATE() 
          and lh.department = 'OPD' 
          and d.name is not null 
          and lh.report_date is null  
        GROUP BY lh.hn 
        ORDER BY lh.lab_order_number ASC
      `
      reportedSql = `
        SELECT d.code, substring_index(d.name, ' ', 1) as name, lh.hn, 
        concat(pt.pname, pt.fname) as ptname, time(lh.report_time) as report_time,
        lh.lab_order_number, ovst.ovstost 
        FROM lab_head lh  
        left outer join patient pt on lh.hn=pt.hn 
        left outer join ovst ovst on lh.hn=ovst.hn 
        left outer join doctor d on lh.doctor_code=d.code 
        WHERE lh.order_date = CURRENT_DATE() 
          and lh.department = 'OPD' 
          and d.name is not null 
          and lh.report_date is not null 
        GROUP BY lh.hn 
        ORDER BY lh.report_time DESC
      `
      params = []
    }

    const [pendingRows, reportedRows] = await Promise.all([
      queryHosDb(pendingSql, params),
      queryHosDb(reportedSql, params)
    ])

    // Get ordering doctor/staff name from first record if searching for a doctor
    let senderName = 'ทั้งหมด'
    if (doctorCode && doctorCode !== 'all' && (pendingRows.length > 0 || reportedRows.length > 0)) {
      senderName = pendingRows[0]?.name || reportedRows[0]?.name || 'ผู้สั่งตรวจ'
    }

    return NextResponse.json({
      success: true,
      senderName,
      pending: pendingRows.map((r: any) => ({
        hn: r.hn,
        patientName: r.ptname,
        formName: r.form_name,
        orderTime: r.order_time || '-',
        receiveTime: r.receive_time || '-',
        doctorName: r.name || ''
      })),
      reported: reportedRows.map((r: any) => ({
        hn: r.hn,
        patientName: r.ptname,
        reportTime: r.report_time || '-',
        ovstost: r.ovstost,
        doctorName: r.name || ''
      }))
    })

  } catch (error: any) {
    console.error('HPH Lab Tracker Report API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงรายการความคืบหน้าของ LAB' },
      { status: 500 }
    )
  }
}
