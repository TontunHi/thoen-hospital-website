import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    // 1. Authenticate user (Member)
    const memberSession = await verifyMemberSession()

    if (!memberSession) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    // 2. Validate input
    const { query } = await request.json()
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: 'กรุณากรอกหมายเลขบัตรประชาชน หรือ HN' },
        { status: 400 }
      )
    }

    const searchQuery = query.trim()

    // 3. Run search query in HOSxP
    const sql = `
      SELECT 
        o.cc,
        pt.hn,
        if((SELECT count(lo2.lab_order_number) FROM lab_head lh2 join lab_order lo2 on lh2.lab_order_number=lo2.lab_order_number WHERE lh2.vn=ov.an and lo2.confirm = 'Y' limit 1),(SELECT count(lo2.lab_order_number) from lab_head lh2 join lab_order lo2 on lh2.lab_order_number=lo2.lab_order_number where lh2.vn=ov.an and lo2.confirm = 'Y' limit 1),null) as clab2,
        if((SELECT count(lo.lab_order_number) from lab_head lh join lab_order lo on lh.lab_order_number=lo.lab_order_number where lh.vn=o.vn and lo.confirm = 'Y' limit 1)>0,(SELECT count(lo.lab_order_number) from lab_head lh join lab_order lo on lh.lab_order_number=lo.lab_order_number where lh.vn=o.vn and lo.confirm = 'Y' limit 1),null) as clab,
        if((SELECT count(o1.icode) from opitemrece o1 join drugitems d on o1.icode=d.icode where o1.vn=o.vn limit 1)>0,(SELECT count(o1.icode) from opitemrece o1 join drugitems d on o1.icode=d.icode where o1.vn=o.vn limit 1),null) as co1,
        if((SELECT count(o1.icode) from opitemrece o1 join drugitems d on o1.icode=d.icode where o1.an=ov.an limit 1)>0,(SELECT count(o1.icode) from opitemrece o1 join drugitems d on o1.icode=d.icode where o1.an=ov.an limit 1),null) as co2,
        ovs.name as status_name,
        o.vn,
        ov.an,
        pt.cid,
        concat(pt.pname,pt.fname,' ',pt.lname) as ptname, 
        year(o.vstdate)+543 as yearv, 
        case month(o.vstdate) 
          when '1' then 'ม.ค.' 
          when '2' then 'ก.พ.' 
          when '3' then 'มี.ค.' 
          when '4' then 'เม.ย.' 
          when '5' then 'พ.ค.' 
          when '6' then 'มิ.ย.' 
          when '7' then 'ก.ค.' 
          when '8' then 'ส.ค.' 
          when '9' then 'ก.ย.' 
          when '10' then 'ต.ค.' 
          when '11' then 'พ.ย.' 
          when '12' then 'ธ.ค.'
        end as monthv,
        day(o.vstdate) as dayv,  
        k.department 
      FROM opdscreen o 
      left outer join patient pt on o.hn=pt.hn 
      left outer join kskdepartment k on o.screen_dep=k.depcode 
      left outer join ovst ov on o.vn=ov.vn 
      left outer join ovstost ovs on ov.ovstost=ovs.ovstost 
      WHERE (pt.cid = ? or pt.hn = ?) 
      ORDER BY o.vn DESC
    `

    const results = await queryHosDb(sql, [searchQuery, searchQuery])

    if (!results || results.length === 0) {
      return NextResponse.json({
        success: true,
        patients: [],
        message: 'ไม่พบประวัติการรักษาของผู้ป่วยรายนี้'
      })
    }

    // Format results
    const patients = results.map((row: any) => ({
      hn: row.hn,
      cid: row.cid,
      ptname: row.ptname,
      vn: row.vn,
      an: row.an,
      dateText: `${row.dayv} ${row.monthv} ${row.yearv}`,
      department: row.department,
      cc: row.cc,
      statusName: row.status_name,
      opdDrugsCount: row.co1 || 0,
      opdLabsCount: row.clab || 0,
      ipdDrugsCount: row.co2 || 0,
      ipdLabsCount: row.clab2 || 0
    }))

    // Record audit log for PHI search compliance
    await logAudit(
      'READ',
      'patient_lab_history',
      `ค้นหาประวัติการรักษาและผลแลปสำหรับ: ${searchQuery} (พบ ${results?.length || 0} รายการ)`,
      memberSession
    )

    return NextResponse.json({
      success: true,
      patients
    })

  } catch (error: any) {
    console.error('Patient search API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบหลัก' },
      { status: 500 }
    )
  }
}
