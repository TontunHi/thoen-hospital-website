import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'

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
    const vn = searchParams.get('vn')
    const an = searchParams.get('an')

    if (!vn && !an) {
      return NextResponse.json(
        { error: 'กรุณาระบุหมายเลข VN หรือ AN' },
        { status: 400 }
      )
    }

    if (vn) {
      // ─── OPD Visit Details (vn) ───
      
      // Patient Info
      const patientSql = `
        SELECT o.hn, pt.cid, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
        YEAR(CURDATE())-YEAR(pt.birthday) as ptage, o.vn,
        year(o.vstdate)+543 as yearv, 
        case month(o.vstdate) 
          when '1' then 'ม.ค.' when '2' then 'ก.พ.' when '3' then 'มี.ค.' when '4' then 'เม.ย.' when '5' then 'พ.ค.' when '6' then 'มิ.ย.' when '7' then 'ก.ค.' when '8' then 'ส.ค.' when '9' then 'ก.ย.' when '10' then 'ต.ค.' when '11' then 'พ.ย.' when '12' then 'ธ.ค.'
        end as monthv,
        day(o.vstdate) as dayv 
        FROM opdscreen o 
        join patient pt on pt.hn=o.hn 
        WHERE vn = ?
      `
      const patients = await queryHosDb(patientSql, [vn])
      if (patients.length === 0) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลการตรวจรักษา OPD นี้' }, { status: 404 })
      }
      const patient = patients[0]

      // Screen info & Diagnosis
      const screenSql = `
        SELECT 
          concat(ic1.code,' : ',ic1.name) as dx0name,
          concat(ic2.code,' : ',ic2.name) as dx1name,
          concat(ic3.code,' : ',ic3.name) as dx2name,
          o.pe,
          concat(ic.code,' : ',ic.name) as name,
          o.bpd, o.bps, o.bw, o.cc, o.pulse, o.temperature, o.rr, o.height, o.bmi, o.hpi, o.pmh,
          k.department 
        FROM opdscreen o  
        left outer join kskdepartment k on o.screen_dep=k.depcode 
        left outer join vn_stat vn on o.vn=vn.vn 
        left outer join icd101 ic on vn.pdx=ic.code 
        left outer join icd101 ic1 on vn.dx0=ic1.code 
        left outer join icd101 ic2 on vn.dx1=ic2.code 
        left outer join icd101 ic3 on vn.dx2=ic3.code 
        WHERE o.vn = ?
      `
      const screenData = await queryHosDb(screenSql, [vn])
      const screen = screenData[0] || {}

      // Drugs
      const drugSql = `
        SELECT dr.name1, d.strength, dr.name2, dr.name3, d.name, o.qty, d.units,
        su.sp_name as sname, su.name1 as sname1, su.name2 as sname2, su.name3 as sname3 
        FROM opitemrece o  
        join drugitems d on o.icode=d.icode 
        left outer join drugusage dr on o.drugusage=dr.drugusage 
        left outer join sp_use su on o.sp_use=su.sp_use 
        WHERE vn = ? and o.qty <> '0'
      `
      const drugs = await queryHosDb(drugSql, [vn])

      // Labs
      const labSql = `
        SELECT lh.vn, lh.hn, l.lab_items_name, lo.lab_order_result, lh.form_name, l.lab_items_normal_value 
        FROM lab_head lh 
        left outer join lab_order lo on lh.lab_order_number=lo.lab_order_number 
        left outer join lab_items l on lo.lab_items_code=l.lab_items_code 
        WHERE lh.vn = ? and lo.confirm = 'Y' and lo.lab_order_result is not null
      `
      const labs = await queryHosDb(labSql, [vn])

      // X-ray
      const xraySql = `select xray_list from xray_head WHERE vn = ?`
      const xrays = await queryHosDb(xraySql, [vn])
      const xray = xrays[0]?.xray_list || null

      // Record audit log for OPD detail view
      await logAudit(
        'READ',
        'patient_lab_history',
        `เข้าดูรายละเอียดเวชระเบียน/ผลแลป OPD VN: ${vn} (HN: ${patient.hn})`,
        memberSession
      )

      return NextResponse.json({
        type: 'OPD',
        patient: {
          hn: patient.hn,
          cid: patient.cid,
          name: patient.ptname,
          age: patient.ptage,
          dateText: `${patient.dayv} ${patient.monthv} ${patient.yearv}`
        },
        screen: {
          bps: screen.bps,
          bpd: screen.bpd,
          bw: screen.bw,
          height: screen.height,
          pulse: screen.pulse,
          temperature: screen.temperature,
          rr: screen.rr,
          cc: screen.cc,
          hpi: screen.hpi,
          pe: screen.pe,
          pmh: screen.pmh,
          department: screen.department,
          dxMain: screen.name,
          dxSub0: screen.dx0name,
          dxSub1: screen.dx1name,
          dxSub2: screen.dx2name
        },
        drugs: drugs.map((d: any) => ({
          name: d.name,
          strength: d.strength,
          qty: d.qty,
          units: d.units,
          usage: [d.name1, d.name2, d.name3, d.sname1, d.sname2, d.sname3].filter(Boolean).join(' ')
        })),
        labs: labs.map((l: any) => ({
          formName: l.form_name,
          itemName: l.lab_items_name,
          result: l.lab_order_result,
          refValue: l.lab_items_normal_value
        })),
        xray
      })
    } else {
      // ─── IPD Admission Details (an) ───

      // Patient Info & Diagnosis
      const patientSql = `
        SELECT concat(ic.code,' : ',ic.tname) as tname, o.hn, pt.cid, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
        YEAR(CURDATE())-YEAR(pt.birthday) as ptage, o.vn,
        year(o.regdate)+543 as yearv, 
        case month(o.regdate) 
          when '1' then 'ม.ค.' when '2' then 'ก.พ.' when '3' then 'มี.ค.' when '4' then 'เม.ย.' when '5' then 'พ.ค.' when '6' then 'มิ.ย.' when '7' then 'ก.ค.' when '8' then 'ส.ค.' when '9' then 'ก.ย.' when '10' then 'ต.ค.' when '11' then 'พ.ย.' when '12' then 'ธ.ค.'
        end as monthv,
        day(o.regdate) as dayv 
        FROM an_stat o 
        join patient pt on pt.hn=o.hn  
        left outer join icd101 ic on o.pdx=ic.code 
        WHERE o.an = ?
      `
      const patients = await queryHosDb(patientSql, [an])
      if (patients.length === 0) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลการรักษา IPD นี้' }, { status: 404 })
      }
      const patient = patients[0]

      // Drugs
      const drugSql = `
        SELECT dr.name1, d.strength, dr.name2, dr.name3, d.name, o.qty, d.units,
        year(o.rxdate)+543 as yearv, 
        case month(o.rxdate) 
          when '1' then 'ม.ค.' when '2' then 'ก.พ.' when '3' then 'มี.ค.' when '4' then 'เม.ย.' when '5' then 'พ.ค.' when '6' then 'มิ.ย.' when '7' then 'ก.ค.' when '8' then 'ส.ค.' when '9' then 'ก.ย.' when '10' then 'ต.ค.' when '11' then 'พ.ย.' when '12' then 'ธ.ค.'
        end as monthv,
        day(o.rxdate) as dayv 
        FROM opitemrece o  
        join drugitems d on o.icode=d.icode 
        left outer join drugusage dr on o.drugusage=dr.drugusage 
        WHERE o.an = ? and o.qty <> '0' 
        ORDER BY o.rxdate
      `
      const drugs = await queryHosDb(drugSql, [an])

      // Labs
      const labSql = `
        SELECT lh.vn, lh.hn, l.lab_items_name, lo.lab_order_result, lh.form_name, l.lab_items_normal_value,
        year(lh.report_date)+543 as yearv, 
        case month(lh.report_date) 
          when '1' then 'ม.ค.' when '2' then 'ก.พ.' when '3' then 'มี.ค.' when '4' then 'เม.ย.' when '5' then 'พ.ค.' when '6' then 'มิ.ย.' when '7' then 'ก.ค.' when '8' then 'ส.ค.' when '9' then 'ก.ย.' when '10' then 'ต.ค.' when '11' then 'พ.ย.' when '12' then 'ธ.ค.'
        end as monthv,
        day(lh.report_date) as dayv 
        FROM lab_head lh 
        left outer join lab_order lo on lh.lab_order_number=lo.lab_order_number 
        left outer join lab_items l on lo.lab_items_code=l.lab_items_code 
        WHERE lh.vn = ? and lo.confirm = 'Y' 
        ORDER BY lh.report_date
      `
      const labs = await queryHosDb(labSql, [an])

      // X-ray
      const xraySql = `SELECT xray_list FROM xray_head WHERE vn = ?`
      const xrays = await queryHosDb(xraySql, [an])
      const xray = xrays[0]?.xray_list || null

      // Record audit log for IPD detail view
      await logAudit(
        'READ',
        'patient_lab_history',
        `เข้าดูรายละเอียดเวชระเบียน/ผลแลป IPD AN: ${an} (HN: ${patient.hn})`,
        memberSession
      )

      return NextResponse.json({
        type: 'IPD',
        patient: {
          hn: patient.hn,
          cid: patient.cid,
          name: patient.ptname,
          age: patient.ptage,
          dateText: `${patient.dayv} ${patient.monthv} ${patient.yearv}`,
          diagnosis: patient.tname
        },
        drugs: drugs.map((d: any) => ({
          dateText: `${d.dayv} ${d.monthv} ${d.yearv}`,
          name: d.name,
          strength: d.strength,
          qty: d.qty,
          units: d.units,
          usage: [d.name1, d.name2, d.name3].filter(Boolean).join(' ')
        })),
        labs: labs.map((l: any) => ({
          dateText: `${l.dayv} ${l.monthv} ${l.yearv}`,
          formName: l.form_name,
          itemName: l.lab_items_name,
          result: l.lab_order_result,
          refValue: l.lab_items_normal_value
        })),
        xray
      })
    }
  } catch (error: any) {
    console.error('Patient detail API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียด' },
      { status: 500 }
    )
  }
}
