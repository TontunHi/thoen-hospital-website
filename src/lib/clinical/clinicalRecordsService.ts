import { queryClinicalDb, fetchAppointmentMismatches } from '@/lib/clinicalDb'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

export interface PatientVisitSearchResult {
  hn: string
  cid: string
  ptname: string
  vn: string
  an?: string | null
  dateText: string
  department: string
  cc: string
  statusName: string
  opdDrugsCount: number
  opdLabsCount: number
  ipdDrugsCount: number
  ipdLabsCount: number
}

export interface VisitScreeningInfo {
  bps?: string | number | null
  bpd?: string | number | null
  bw?: string | number | null
  height?: string | number | null
  pulse?: string | number | null
  temperature?: string | number | null
  rr?: string | number | null
  cc?: string | null
  hpi?: string | null
  pe?: string | null
  pmh?: string | null
  department?: string | null
  dxMain?: string | null
  dxSub0?: string | null
  dxSub1?: string | null
  dxSub2?: string | null
}

export interface VisitDrugItem {
  dateText?: string
  name: string
  strength?: string | null
  qty: number | string
  units?: string | null
  usage?: string | null
}

export interface VisitLabItem {
  dateText?: string
  formName?: string | null
  itemName: string
  result: string
  refValue?: string | null
}

export interface OpdVisitDetails {
  type: 'OPD'
  patient: {
    hn: string
    cid: string
    name: string
    age: number
    dateText: string
  }
  screen: VisitScreeningInfo
  drugs: VisitDrugItem[]
  labs: VisitLabItem[]
  xray?: string | null
}

export interface IpdVisitDetails {
  type: 'IPD'
  patient: {
    hn: string
    cid: string
    name: string
    age: number
    dateText: string
    diagnosis?: string | null
  }
  drugs: VisitDrugItem[]
  labs: VisitLabItem[]
  xray?: string | null
}

export type VisitClinicalDetails = OpdVisitDetails | IpdVisitDetails

export interface LabTrackerPendingItem {
  hn: string
  patientName: string
  formName?: string | null
  orderTime: string
  receiveTime: string
  doctorName: string
}

export interface LabTrackerReportedItem {
  hn: string
  patientName: string
  reportTime: string
  ovstost?: string | null
  doctorName: string
}

export interface LabTrackerReportResult {
  senderName: string
  pending: LabTrackerPendingItem[]
  reported: LabTrackerReportedItem[]
}

export interface DoctorOrderStat {
  code: string
  name: string
  count: number
}

export interface LabTrackerDoctorsResult {
  doctors: DoctorOrderStat[]
  others: DoctorOrderStat[]
  totalCount: number
}

export interface LabTrackerDetailResult {
  hn: string
  patientName: string
  reported: Array<{
    formName?: string | null
    itemName: string
    result: string
    refValue?: string | null
  }>
  pending: Array<{
    formName?: string | null
    itemName: string
    isOutLab: string
  }>
}

export interface LoratadineDispenseItem {
  hn: string
  fullname: string
  age: number | string
  status: 'OPD' | 'IPD' | string
  vstdate: string
  rxdate: string
  rxtime: string
  qty: number
  doctorName: string
  department: string
}

export interface LoratadineDispenseSummary {
  items: LoratadineDispenseItem[]
  summary: {
    totalCount: number
    totalQty: number
    opdCount: number
    ipdCount: number
    adultCount: number
  }
}

export const ClinicalRecordsService = {
  /**
   * Search patient clinical visits by Thai Citizen ID (CID) or Hospital Number (HN)
   */
  async searchPatientVisits(
    query: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PatientVisitSearchResult[]> {
    const trimmed = (query || '').trim()
    if (!trimmed) {
      return []
    }

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

    const results = await executor(sql, [trimmed, trimmed])
    if (!results || !Array.isArray(results)) {
      return []
    }

    return results.map((row: any) => ({
      hn: String(row.hn || ''),
      cid: String(row.cid || ''),
      ptname: String(row.ptname || ''),
      vn: String(row.vn || ''),
      an: row.an ? String(row.an) : null,
      dateText: `${row.dayv || ''} ${row.monthv || ''} ${row.yearv || ''}`.trim(),
      department: String(row.department || ''),
      cc: String(row.cc || ''),
      statusName: String(row.status_name || ''),
      opdDrugsCount: Number(row.co1) || 0,
      opdLabsCount: Number(row.clab) || 0,
      ipdDrugsCount: Number(row.co2) || 0,
      ipdLabsCount: Number(row.clab2) || 0,
    }))
  },

  /**
   * Fetch comprehensive OPD or IPD clinical visit details (screening, diagnoses, lab orders, prescriptions, X-ray)
   */
  async getVisitClinicalDetails(
    params: { vn?: string | null; an?: string | null },
    executor: QueryExecutor = queryClinicalDb
  ): Promise<VisitClinicalDetails | null> {
    const vn = params.vn?.trim()
    const an = params.an?.trim()

    if (!vn && !an) {
      return null
    }

    if (vn) {
      // ─── OPD Visit Details (vn) ───
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
      const patients = await executor(patientSql, [vn])
      if (!patients || patients.length === 0) {
        return null
      }
      const patient = patients[0]

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
      const screenData = await executor(screenSql, [vn])
      const screen = screenData[0] || {}

      const drugSql = `
        SELECT dr.name1, d.strength, dr.name2, dr.name3, d.name, o.qty, d.units,
        su.sp_name as sname, su.name1 as sname1, su.name2 as sname2, su.name3 as sname3 
        FROM opitemrece o  
        join drugitems d on o.icode=d.icode 
        left outer join drugusage dr on o.drugusage=dr.drugusage 
        left outer join sp_use su on o.sp_use=su.sp_use 
        WHERE vn = ? and o.qty <> '0'
      `
      const drugs = await executor(drugSql, [vn])

      const labSql = `
        SELECT lh.vn, lh.hn, l.lab_items_name, lo.lab_order_result, lh.form_name, l.lab_items_normal_value 
        FROM lab_head lh 
        left outer join lab_order lo on lh.lab_order_number=lo.lab_order_number 
        left outer join lab_items l on lo.lab_items_code=l.lab_items_code 
        WHERE lh.vn = ? and lo.confirm = 'Y' and lo.lab_order_result is not null
      `
      const labs = await executor(labSql, [vn])

      const xraySql = `select xray_list from xray_head WHERE vn = ?`
      const xrays = await executor(xraySql, [vn])
      const xray = xrays[0]?.xray_list || null

      return {
        type: 'OPD',
        patient: {
          hn: String(patient.hn || ''),
          cid: String(patient.cid || ''),
          name: String(patient.ptname || ''),
          age: Number(patient.ptage) || 0,
          dateText: `${patient.dayv || ''} ${patient.monthv || ''} ${patient.yearv || ''}`.trim(),
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
          dxSub2: screen.dx2name,
        },
        drugs: (drugs || []).map((d: any) => ({
          name: String(d.name || ''),
          strength: d.strength,
          qty: d.qty,
          units: d.units,
          usage: [d.name1, d.name2, d.name3, d.sname1, d.sname2, d.sname3].filter(Boolean).join(' '),
        })),
        labs: (labs || []).map((l: any) => ({
          formName: l.form_name,
          itemName: String(l.lab_items_name || ''),
          result: String(l.lab_order_result || ''),
          refValue: l.lab_items_normal_value,
        })),
        xray,
      }
    } else {
      // ─── IPD Admission Details (an) ───
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
      const patients = await executor(patientSql, [an])
      if (!patients || patients.length === 0) {
        return null
      }
      const patient = patients[0]

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
      const drugs = await executor(drugSql, [an])

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
      const labs = await executor(labSql, [an])

      const xraySql = `SELECT xray_list FROM xray_head WHERE vn = ?`
      const xrays = await executor(xraySql, [an])
      const xray = xrays[0]?.xray_list || null

      return {
        type: 'IPD',
        patient: {
          hn: String(patient.hn || ''),
          cid: String(patient.cid || ''),
          name: String(patient.ptname || ''),
          age: Number(patient.ptage) || 0,
          dateText: `${patient.dayv || ''} ${patient.monthv || ''} ${patient.yearv || ''}`.trim(),
          diagnosis: patient.tname || null,
        },
        drugs: (drugs || []).map((d: any) => ({
          dateText: `${d.dayv || ''} ${d.monthv || ''} ${d.yearv || ''}`.trim(),
          name: String(d.name || ''),
          strength: d.strength,
          qty: d.qty,
          units: d.units,
          usage: [d.name1, d.name2, d.name3].filter(Boolean).join(' '),
        })),
        labs: (labs || []).map((l: any) => ({
          dateText: `${l.dayv || ''} ${l.monthv || ''} ${l.yearv || ''}`.trim(),
          formName: l.form_name,
          itemName: String(l.lab_items_name || ''),
          result: String(l.lab_order_result || ''),
          refValue: l.lab_items_normal_value,
        })),
        xray,
      }
    }
  },

  /**
   * Fetch today's lab tracking report (pending vs reported orders)
   */
  async getLabTrackerReport(
    doctorCode?: string | null,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<LabTrackerReportResult> {
    let pendingSql = ''
    let reportedSql = ''
    let params: any[] = []

    if (doctorCode && doctorCode !== 'all') {
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
      executor(pendingSql, params),
      executor(reportedSql, params),
    ])

    let senderName = 'ทั้งหมด'
    if (doctorCode && doctorCode !== 'all' && (pendingRows.length > 0 || reportedRows.length > 0)) {
      senderName = pendingRows[0]?.name || reportedRows[0]?.name || 'ผู้สั่งตรวจ'
    }

    return {
      senderName,
      pending: (pendingRows || []).map((r: any) => ({
        hn: String(r.hn || ''),
        patientName: String(r.ptname || ''),
        formName: r.form_name || null,
        orderTime: r.order_time || '-',
        receiveTime: r.receive_time || '-',
        doctorName: String(r.name || ''),
      })),
      reported: (reportedRows || []).map((r: any) => ({
        hn: String(r.hn || ''),
        patientName: String(r.ptname || ''),
        reportTime: r.report_time || '-',
        ovstost: r.ovstost || null,
        doctorName: String(r.name || ''),
      })),
    }
  },

  /**
   * Fetch doctors and staff ordering labs today
   */
  async getLabTrackerDoctors(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<LabTrackerDoctorsResult> {
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
    const totalOrderedSql = `
      SELECT count(distinct(lh.hn)) as cc 
      FROM lab_head lh 
      left outer join doctor d on lh.doctor_code=d.code 
      WHERE lh.order_date = CURRENT_DATE() 
        and lh.department = 'OPD' 
        and d.name is not null
    `

    const [doctors, others, totalData] = await Promise.all([
      executor(opdDoctorsSql),
      executor(otherStaffSql),
      executor(totalOrderedSql),
    ])

    return {
      doctors: (doctors || []).map((d: any) => ({
        code: String(d.code || ''),
        name: String(d.name || ''),
        count: Number(d.cc) || 0,
      })),
      others: (others || []).map((o: any) => ({
        code: String(o.code || ''),
        name: String(o.name || ''),
        count: Number(o.cc) || 0,
      })),
      totalCount: Number(totalData[0]?.cc) || 0,
    }
  },

  /**
   * Fetch lab tracker details by patient HN for today
   */
  async getLabTrackerDetails(
    hn: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<LabTrackerDetailResult | null> {
    const trimmedHn = (hn || '').trim()
    if (!trimmedHn) return null

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
      executor(reportedSql, [trimmedHn]),
      executor(pendingSql, [trimmedHn]),
    ])

    let patientName = 'ไม่ระบุชื่อ'
    if (reportedRows && reportedRows.length > 0) {
      patientName = reportedRows[0].ptname
    } else if (pendingRows && pendingRows.length > 0) {
      patientName = pendingRows[0].ptname
    }

    return {
      hn: trimmedHn,
      patientName,
      reported: (reportedRows || []).map((r: any) => ({
        formName: r.form_name || null,
        itemName: String(r.lab_items_name || ''),
        result: String(r.lab_order_result || ''),
        refValue: r.lab_items_normal_value || null,
      })),
      pending: (pendingRows || []).map((r: any) => ({
        formName: r.form_name || null,
        itemName: String(r.lab_items_name || ''),
        isOutLab: String(r.items_is_outlab || 'N'),
      })),
    }
  },

  /**
   * Fetch Loratadine dispensing monitor data
   */
  async getLoratadineDispenseSummary(
    ageFilter: string = 'adult',
    executor: QueryExecutor = queryClinicalDb
  ): Promise<LoratadineDispenseSummary> {
    let ageClause = ''
    if (ageFilter === 'adult') {
      ageClause = 'AND (YEAR(o.vstdate) - YEAR(p.birthday)) > 19'
    }

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

    const rows = (await executor(sql)) || []

    const totalCount = rows.length
    const totalQty = rows.reduce((sum, item: any) => sum + (Number(item.qty) || 0), 0)
    const opdCount = rows.filter((item: any) => item.status === 'OPD').length
    const ipdCount = rows.filter((item: any) => item.status === 'IPD').length
    const adultCount = rows.filter((item: any) => Number(item.age) > 19).length

    return {
      items: rows.map((r: any) => ({
        hn: String(r.hn || ''),
        fullname: String(r.fullname || ''),
        age: r.age,
        status: r.status,
        vstdate: String(r.vstdate || ''),
        rxdate: String(r.rxdate || ''),
        rxtime: r.rxtime ? String(r.rxtime).substring(0, 5) + ' น.' : '-',
        qty: Number(r.qty) || 0,
        doctorName: String(r.doctor_name || ''),
        department: String(r.department || ''),
      })),
      summary: {
        totalCount,
        totalQty,
        opdCount,
        ipdCount,
        adultCount,
      },
    }
  },

  /**
   * Fetch appointment mismatches (wrong examination room)
   */
  async getAppointmentMismatches(
    fetcher: () => Promise<any[]> = fetchAppointmentMismatches
  ) {
    const mismatches = await fetcher()
    return {
      totalMismatches: mismatches.length,
      updatedAt: new Date().toISOString(),
      mismatches,
    }
  },
}
