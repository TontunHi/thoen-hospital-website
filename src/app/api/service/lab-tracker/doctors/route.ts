import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { verifyMemberSession } from '@/lib/memberAuth'
import { verifySession } from '@/lib/auth'

export async function GET() {
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

    // 2. Fetch doctors group (provider_type_code in '01','011','02')
    const opdDoctorsSql = `
      SELECT d.code, d.name, count(distinct(lh.hn)) as cc 
      FROM lab_head lh 
      left outer join doctor d on lh.doctor_code=d.code 
      WHERE lh.order_date = CURRENT_DATE() 
        and lh.department = 'OPD' 
        and d.name is not null 
        and d.provider_type_code in ('01','011','02') 
      GROUP BY lh.doctor_code 
      ORDER BY d.name
    `
    const doctors = await queryHosDb(opdDoctorsSql)

    // 3. Fetch nurses & other group (provider_type_code not in '01','011','02')
    const otherStaffSql = `
      SELECT d.code, d.name, count(distinct(lh.hn)) as cc 
      FROM lab_head lh 
      left outer join doctor d on lh.doctor_code=d.code 
      WHERE lh.order_date = CURRENT_DATE() 
        and lh.department = 'OPD' 
        and d.name is not null 
        and d.provider_type_code not in ('01','011','02') 
      GROUP BY lh.doctor_code 
      ORDER BY d.name
    `
    const others = await queryHosDb(otherStaffSql)

    // 4. Fetch total distinct patients ordered lab today
    const totalOrderedSql = `
      SELECT count(distinct(lh.hn)) as cc 
      FROM lab_head lh 
      left outer join doctor d on lh.doctor_code=d.code 
      WHERE lh.order_date = CURRENT_DATE() 
        and lh.department = 'OPD' 
        and d.name is not null
    `
    const allTotalData = await queryHosDb(totalOrderedSql)
    const totalOrderedCount = allTotalData[0]?.cc || 0

    return NextResponse.json({
      success: true,
      doctors: doctors.map((d: any) => ({ code: d.code, name: d.name, count: d.cc })),
      others: others.map((o: any) => ({ code: o.code, name: o.name, count: o.cc })),
      totalCount: totalOrderedCount
    })

  } catch (error: any) {
    console.error('HPH Lab Tracker Doctors API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายชื่อผู้สั่งตรวจ LAB' },
      { status: 500 }
    )
  }
}
