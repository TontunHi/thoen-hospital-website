import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { verifyMemberSession } from '@/lib/memberAuth'
import { verifySession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const adminSession = await verifySession()
    const memberSession = await verifyMemberSession()

    if (!adminSession && !memberSession) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const hn = searchParams.get('hn')

    if (!hn) {
      return NextResponse.json(
        { error: 'กรุณาระบุหมายเลข HN' },
        { status: 400 }
      )
    }

    // 3. Fetch reported labs for today (confirm = 'Y')
    const reportedSql = `
      SELECT lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
      l.lab_items_name, lo.lab_order_result, lh.form_name, l.lab_items_normal_value 
      FROM lab_head lh 
      left outer join lab_order lo on lh.lab_order_number=lo.lab_order_number 
      left outer join lab_items l on lo.lab_items_code=l.lab_items_code 
      left outer join patient pt on lh.hn=pt.hn 
      WHERE lh.hn = ? 
        and lh.order_date = CURRENT_DATE() 
        and lo.confirm = 'Y'
    `

    // 4. Fetch pending labs for today (confirm = 'N' and report_date is null)
    const pendingSql = `
      SELECT lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
      l.lab_items_name, l.items_is_outlab, lh.form_name, l.lab_items_normal_value 
      FROM lab_head lh 
      left outer join lab_order lo on lh.lab_order_number=lo.lab_order_number 
      left outer join lab_items l on lo.lab_items_code=l.lab_items_code 
      left outer join patient pt on lh.hn=pt.hn 
      WHERE lh.hn = ? 
        and lh.order_date = CURRENT_DATE() 
        and lo.confirm = 'N' 
        and lh.report_date is null
    `

    const [reportedRows, pendingRows] = await Promise.all([
      queryHosDb(reportedSql, [hn]),
      queryHosDb(pendingSql, [hn])
    ])

    // Extract patient name
    let patientName = 'ไม่ระบุชื่อ'
    if (reportedRows.length > 0) {
      patientName = reportedRows[0].ptname
    } else if (pendingRows.length > 0) {
      patientName = pendingRows[0].ptname
    }

    return NextResponse.json({
      success: true,
      hn,
      patientName,
      reported: reportedRows.map((r: any) => ({
        formName: r.form_name,
        itemName: r.lab_items_name,
        result: r.lab_order_result,
        refValue: r.lab_items_normal_value
      })),
      pending: pendingRows.map((r: any) => ({
        formName: r.form_name,
        itemName: r.lab_items_name,
        isOutLab: r.items_is_outlab || 'N'
      }))
    })

  } catch (error: any) {
    console.error('HPH Lab Tracker Detail API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดผล LAB' },
      { status: 500 }
    )
  }
}
