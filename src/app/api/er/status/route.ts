import { NextResponse } from 'next/server'
import { queryErDb } from '@/lib/erDb'
import { verifyMemberSession } from '@/lib/memberAuth'

export async function GET() {
  try {
    const memberSession = await verifyMemberSession()

    if (!memberSession) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const allowedRoles = ['doctor', 'nurse', 'admin']
    if (!allowedRoles.includes(memberSession.role)) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      )
    }

    // 1. Fetch current active ER patients
    const activePatientsQuery = `
      SELECT 
        pt.hn,
        er.vn,
        concat(pt.pname, pt.fname) as ptname,
        YEAR(current_date)-YEAR(pt.birthday) as age,
        i.bedno,
        time(er.enter_er_time) as enter_time,
        er.er_list,
        eel.er_emergency_level_name,
        er.er_emergency_level_id,
        er.observe,
        edt.name as dch_type_name,
        w.name as wardname,
        h.name as hosname 
      FROM er_regist er 
      left outer join vn_stat vn on er.vn=vn.vn 
      left outer join patient pt on vn.hn=pt.hn 
      left outer join er_emergency_level eel on er.er_emergency_level_id=eel.er_emergency_level_id 
      left outer join er_dch_type edt on er.er_dch_type=edt.er_dch_type 
      left outer join an_stat an on er.vn=an.vn 
      left outer join iptadm i on an.an=i.an  
      left outer join ward w on an.ward=w.ward   
      left outer join referout r on vn.vn=r.vn 
      left outer join hospcode h on r.refer_hospcode=h.hospcode 
      WHERE er.vstdate = current_date 
        and ((er.er_dch_type in ('2','3','5','6','7','8','9') and w.name is null) and h.name is null) 
      ORDER BY er.enter_er_time DESC
    `
    const activePatients = await queryErDb(activePatientsQuery)

    // 2. Fetch active critical patients count (level 1 = Resuscitate)
    const criticalCount = activePatients.filter((p: any) => p.er_emergency_level_id === 1 || p.er_emergency_level_id === '1').length
    const emergencyCount = activePatients.filter((p: any) => p.er_emergency_level_id === 2 || p.er_emergency_level_id === '2').length
    const urgencyCount = activePatients.filter((p: any) => p.er_emergency_level_id === 3 || p.er_emergency_level_id === '3').length
    const semiUrgencyCount = activePatients.filter((p: any) => p.er_emergency_level_id === 4 || p.er_emergency_level_id === '4').length
    const nonUrgencyCount = activePatients.filter((p: any) => p.er_emergency_level_id === 5 || p.er_emergency_level_id === '5').length

    // 3. Fetch monthly statistics: Patient types
    const ptTypesQuery = `
      select count(er.vn) as v, ept.name 
      from er_regist er 
      left outer join er_period ep on er.er_period=ep.er_period 
      left outer join er_pt_type ept on er.er_pt_type=ept.er_pt_type 
      where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE() 
      group by er.er_pt_type
    `
    const ptTypes = await queryErDb(ptTypesQuery)

    // 4. Fetch monthly statistics: Emergency levels
    const emergencyLevelsQuery = `
      select count(er.vn) as v, ept.er_emergency_level_name 
      from er_regist er 
      left outer join er_period ep on er.er_period=ep.er_period 
      left outer join er_emergency_level ept on er.er_emergency_level_id=ept.er_emergency_level_id 
      where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE() 
        and er.er_emergency_level_id is not null 
      group by ept.er_emergency_level_name 
      order by ept.er_emergency_level_id
    `
    const emergencyLevels = await queryErDb(emergencyLevelsQuery)

    // 5. Fetch monthly statistics: Discharge types
    const dischargeTypesQuery = `
      select count(er.vn) as v, ept.name 
      from er_regist er 
      left outer join er_period ep on er.er_period=ep.er_period 
      left outer join er_dch_type ept on er.er_dch_type=ept.er_dch_type 
      where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE() 
        and ept.er_dch_type is not null 
      group by ept.name 
      order by ept.er_dch_type
    `
    const dischargeTypes = await queryErDb(dischargeTypesQuery)

    // 6. Return response
    return NextResponse.json({
      activePatients,
      summary: {
        totalActive: activePatients.length,
        critical: criticalCount,
        emergency: emergencyCount,
        urgency: urgencyCount,
        semiUrgency: semiUrgencyCount,
        nonUrgency: nonUrgencyCount
      },
      stats: {
        ptTypes,
        emergencyLevels,
        dischargeTypes
      }
    })
  } catch (error: any) {
    console.error('ER Status API Error:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลสถานะห้องฉุกเฉินได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    )
  }
}

