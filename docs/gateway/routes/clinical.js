/**
 * Clinical Services Routes (HOSxP 192.168.1.4)
 * ER, IPD, Appointments, Lab, Drugs, TB, RCM Invoices
 */
export default async function clinicalRoutes(fastify, options) {
  const { pools, getCached } = options;
  const { hosPool } = pools;

// 1.1 ER Status & TV Mode
fastify.get('/api/v1/clinical/er/status', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'สถานะห้องฉุกเฉินและระดับคัดกรอง Triage (รองรับ TV Mode)',
    querystring: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: 'ใส่ "tv" เพื่อดึงรายชื่อคนไข้จริงสำหรับจอทีวี' }
      }
    }
  }
}, async (req, reply) => {
  const isTvMode = req.query?.mode === 'tv'
  try {
    const data = await getCached(`er-status-${isTvMode ? 'tv' : 'summary'}`, 8000, async () => {
      const [levels] = await hosPool.query(`
        SELECT eel.er_emergency_level_id, eel.er_emergency_level_name, count(er.vn) as total
        FROM er_emergency_level eel
        LEFT JOIN er_regist er ON eel.er_emergency_level_id = er.er_emergency_level_id 
          AND er.vstdate = CURRENT_DATE 
          AND (er.er_leave_status_id IS NULL OR er.er_leave_status_id = '')
        GROUP BY eel.er_emergency_level_id, eel.er_emergency_level_name
        ORDER BY eel.er_emergency_level_id
      `)
      let activePatients = []
      if (isTvMode) {
        const [patients] = await hosPool.query(`
          SELECT pt.hn, er.vn, concat(coalesce(pt.pname, ''), coalesce(pt.fname, ''), ' ', coalesce(pt.lname, '')) as ptname,
            YEAR(current_date)-YEAR(pt.birthday) as age, i.bedno, time(er.enter_er_time) as enter_time,
            er.er_list, eel.er_emergency_level_name, er.er_emergency_level_id, er.observe, edt.name as dch_type_name
          FROM er_regist er 
          LEFT JOIN vn_stat vn ON er.vn = vn.vn 
          LEFT JOIN patient pt ON vn.hn = pt.hn 
          LEFT JOIN er_emergency_level eel ON er.er_emergency_level_id = eel.er_emergency_level_id 
          LEFT JOIN er_dch_type edt ON er.er_dch_type = edt.er_dch_type 
          LEFT JOIN an_stat an ON er.vn = an.vn 
          LEFT JOIN iptadm i ON an.an = i.an  
          WHERE er.vstdate = CURRENT_DATE 
            AND (er.er_leave_status_id IS NULL OR er.er_leave_status_id = '')
          ORDER BY er.enter_er_time DESC
        `)
        activePatients = patients
      }
      return { levels, activePatients, timestamp: new Date().toISOString() }
    })
    return { success: true, data }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.2 IPD Ward Bed Occupancy
fastify.get('/api/v1/clinical/ipd/occupancy', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'อัตราการครองเตียงผู้ป่วยในรายตึก (IPD Wards Occupancy)'
  }
}, async (req, reply) => {
  try {
    const data = await getCached('ipd-occupancy', 10000, async () => {
      const sql = `
        SELECT w.ward, w.name as ward_name, w.shortname, count(i.an) as admitted_patients
        FROM ward w LEFT JOIN ipt i ON w.ward = i.ward AND i.dchdate IS NULL
        GROUP BY w.ward, w.name, w.shortname ORDER BY w.ward
      `
      const [rows] = await hosPool.query(sql)
      return rows
    })
    return { success: true, data }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.3 IPD Ward Roster
fastify.get('/api/v1/clinical/ipd/ward-roster', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'รายชื่อผู้ป่วยที่นอนพักรักษาตัวในหอผู้ป่วยใน (Grouped by Ward & Bed)'
  }
}, async (req, reply) => {
  try {
    const sql = `
      SELECT pt.hn, TRIM(CONCAT(COALESCE(pt.pname, ''), ' ', COALESCE(pt.fname, ''))) AS ptname,
        TIMESTAMPDIFF(YEAR, pt.birthday, CURRENT_DATE()) AS age,
        DATE_FORMAT(an.regdate, '%Y-%m-%d') AS regdate,
        DATEDIFF(CURRENT_DATE(), an.regdate) AS admit_days,
        p.bedno, an.ward
      FROM an_stat an
      LEFT OUTER JOIN patient pt ON an.hn = pt.hn
      LEFT OUTER JOIN iptadm p ON an.an = p.an
      WHERE an.dchdate IS NULL AND an.ward IN ('02', '04', '05', '06', '09')
      ORDER BY p.bedno ASC
    `
    const [rows] = await hosPool.query(sql)
    return { success: true, totalPatients: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.4 Appointments Search
fastify.get('/api/v1/clinical/appointments', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'ค้นหารายการนัดหมายแพทย์ (ตามวันที่, HN, หรือเลขบัตรประชาชน)',
    querystring: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'วันที่นัด (YYYY-MM-DD)' },
        hn: { type: 'string', description: 'เลขประจำตัวผู้ป่วย HN' },
        cid: { type: 'string', description: 'เลขประจำตัวประชาชน 13 หลัก' }
      }
    }
  }
}, async (req, reply) => {
  const { date = '', hn = '', cid = '' } = req.query || {}
  try {
    let sql = `
      SELECT o.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname, pt.cid,
        o.vstdate, o.nextdate, o.nexttime, k.department, o.app_user, o.app_cause
      FROM oapp o LEFT JOIN patient pt ON o.hn = pt.hn LEFT JOIN kskdepartment k ON o.depcode = k.depcode WHERE 1=1
    `
    const params = []
    if (hn) { sql += ' AND o.hn = ?'; params.push(hn) }
    else if (cid) { sql += ' AND pt.cid = ?'; params.push(cid) }
    else if (date) { sql += ' AND o.nextdate = ?'; params.push(date) }
    else { sql += ' AND o.nextdate = CURRENT_DATE' }
    sql += ' ORDER BY o.nexttime ASC, o.hn ASC LIMIT 300'
    const [rows] = await hosPool.query(sql, params)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.5 Appointment Mismatches
fastify.get('/api/v1/clinical/appointments/mismatches', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'ตรวจสอบรายการนัดในห้องตรวจที่ปิดใช้งานแล้ว'
  }
}, async (req, reply) => {
  try {
    const sql = `
      SELECT o.hn, o.vstdate, o.nextdate, k.department, o.app_user
      FROM oapp o LEFT OUTER JOIN kskdepartment k ON o.depcode = k.depcode
      WHERE o.nextdate > CURRENT_DATE AND (k.depcode_active IS NULL OR k.depcode_active = '')
      ORDER BY o.app_user
    `
    const [rows] = await hosPool.query(sql)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.6 Lab Tracker Orders
fastify.get('/api/v1/clinical/lab/tracker', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'ติดตามสถานะคำสั่งตรวจแล็บประจำวัน (Lab Orders Tracker)',
    querystring: {
      type: 'object',
      properties: {
        date: { type: 'string' },
        vn: { type: 'string' },
        hn: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { date = '', vn = '', hn = '' } = req.query || {}
  try {
    let sql = `
      SELECT lh.lab_order_number, lh.vn, lh.hn, lh.order_date, lh.order_time,
        lh.receive_date, lh.receive_time, lh.report_date, lh.report_time, lh.order_department, d.name as doctor_name
      FROM lab_head lh LEFT JOIN doctor d ON lh.doctor_code = d.code WHERE 1=1
    `
    const params = []
    if (vn) { sql += ' AND lh.vn = ?'; params.push(vn) }
    else if (hn) { sql += ' AND lh.hn = ?'; params.push(hn) }
    else { sql += ' AND lh.order_date = ?'; params.push(date || new Date().toISOString().slice(0, 10)) }
    sql += ' ORDER BY lh.order_time DESC LIMIT 200'
    const [rows] = await hosPool.query(sql, params)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.7 Lab Tracker Detail by HN
fastify.get('/api/v1/clinical/lab/detail/:hn', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'ดึงรายละเอียดผลแล็บประจำวันของคนไข้ (Reported & Pending)',
    params: {
      type: 'object',
      properties: { hn: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { hn } = req.params
  try {
    const reportedSql = `
      SELECT lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
        l.lab_items_name, lo.lab_order_result, lh.form_name, l.lab_items_normal_value 
      FROM lab_head lh 
      LEFT JOIN lab_order lo ON lh.lab_order_number=lo.lab_order_number 
      LEFT JOIN lab_items l ON lo.lab_items_code=l.lab_items_code 
      LEFT JOIN patient pt ON lh.hn=pt.hn 
      WHERE lh.hn = ? AND lh.order_date = CURRENT_DATE() AND lo.confirm = 'Y'
    `
    const pendingSql = `
      SELECT lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
        l.lab_items_name, l.items_is_outlab, lh.form_name, l.lab_items_normal_value 
      FROM lab_head lh 
      LEFT JOIN lab_order lo ON lh.lab_order_number=lo.lab_order_number 
      LEFT JOIN lab_items l ON lo.lab_items_code=l.lab_items_code 
      LEFT JOIN patient pt ON lh.hn=pt.hn 
      WHERE lh.hn = ? AND lh.order_date = CURRENT_DATE() AND lo.confirm = 'N' AND lh.report_date is null
    `
    const [reportedRows] = await hosPool.query(reportedSql, [hn])
    const [pendingRows] = await hosPool.query(pendingSql, [hn])
    return {
      success: true,
      hn,
      reported: reportedRows,
      pending: pendingRows
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.8 Drug Dispensing Status Queue (Paid & Printed)
fastify.get('/api/v1/clinical/drugs/status', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'สถานะคิวจ่ายยาผู้ป่วยนอกห้องยา (รอจัดยา vs กำลังจัดยา)'
  }
}, async (req, reply) => {
  try {
    const data = await getCached('drug-dispense-status', 10000, async () => {
      const queryPaid = `
        SELECT pt.hn, TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''), ' ', COALESCE(pt.lname, ''))) AS ptname,
          TIME_FORMAT(st.service7, '%H:%i:%s') AS service_time,
          TIMEDIFF(CURRENT_TIME(), st.service7) AS timelast,
          COALESCE(k.department, 'ไม่ระบุ') AS department
        FROM opitemrece o
        LEFT JOIN patient pt ON o.hn = pt.hn
        LEFT JOIN service_time st ON o.vn = st.vn
        LEFT JOIN kskdepartment k ON o.dep_code = k.depcode
        WHERE o.vstdate = CURRENT_DATE() AND o.icode LIKE '1%' AND (st.service6 IS NULL AND st.service7 IS NOT NULL)
        GROUP BY o.hn, pt.pname, pt.fname, pt.lname, st.service7, k.department
        ORDER BY TIMEDIFF(CURRENT_TIME(), st.service7) DESC LIMIT 50
      `
      const queryPrinted = `
        SELECT pt.hn, TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''), ' ', COALESCE(pt.lname, ''))) AS ptname,
          TIME_FORMAT(st.service6, '%H:%i:%s') AS service_time,
          TIMEDIFF(CURRENT_TIME(), st.service6) AS timelast
        FROM opitemrece o
        LEFT JOIN patient pt ON o.hn = pt.hn
        LEFT JOIN service_time st ON o.vn = st.vn
        WHERE o.vstdate = CURRENT_DATE() AND o.icode LIKE '1%' AND (st.service6 IS NOT NULL AND st.service8 IS NULL)
        GROUP BY o.hn, pt.pname, pt.fname, pt.lname, st.service6
        ORDER BY TIMEDIFF(CURRENT_TIME(), st.service6) DESC LIMIT 50
      `
      const [paid] = await hosPool.query(queryPaid)
      const [printed] = await hosPool.query(queryPrinted)
      return { paid, printed, updatedAt: new Date().toISOString() }
    })
    return { success: true, data }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.9 Loratadine Dispensing Monitor
fastify.get('/api/v1/clinical/drugs/loratadine', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'ติดตามการจ่ายยาลอราทาดีน (Loratadine Monitor)',
    querystring: {
      type: 'object',
      properties: {
        age: { type: 'string', default: 'adult', description: '"adult" หรือ "all"' }
      }
    }
  }
}, async (req, reply) => {
  const { age = 'adult' } = req.query || {}
  try {
    let ageClause = ''
    if (age === 'adult') ageClause = 'AND (YEAR(o.vstdate) - YEAR(p.birthday)) > 19'
    const sql = `
      SELECT o.hn, YEAR(o.vstdate) - YEAR(p.birthday) AS age,
        CONCAT(p.pname, p.fname, ' ', p.lname) AS fullname,
        IF(o.vn IS NULL, 'IPD', 'OPD') AS status,
        o.vstdate, o.rxdate, TIME_FORMAT(o.rxtime, '%H:%i:%s') AS rxtime, o.qty,
        COALESCE(d.name, 'ไม่ระบุ') AS doctor_name, COALESCE(k.department, 'ไม่ระบุ') AS department
      FROM opitemrece o
      LEFT JOIN patient p ON o.hn = p.hn
      LEFT JOIN doctor d ON o.doctor = d.code
      LEFT JOIN kskdepartment k ON o.dep_code = k.depcode
      WHERE o.icode = '1460211' AND o.vstdate = CURDATE() ${ageClause}
      ORDER BY o.rxtime DESC LIMIT 200
    `
    const [rows] = await hosPool.query(sql)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.10 RCM OPD Department Summary
fastify.get('/api/v1/clinical/rcm/opd-dept-summary', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'รายงานผู้ป่วยนอกแยกตามแผนก (RCM OPD Summary)',
    querystring: {
      type: 'object',
      properties: {
        startDate: { type: 'string' },
        endDate: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { startDate = '', endDate = '' } = req.query || {}
  try {
    const ds1 = startDate || new Date().toISOString().slice(0, 10)
    const ds2 = endDate || ds1
    const sql = `
      SELECT k.department, count(v.vn) as total_visits, count(distinct v.hn) as total_patients
      FROM ovst v
      LEFT JOIN kskdepartment k ON v.cur_dep = k.depcode
      WHERE v.vstdate BETWEEN ? AND ?
      GROUP BY k.department
      ORDER BY total_visits DESC
    `
    const [rows] = await hosPool.query(sql, [ds1, ds2])
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.11 RCM IPD Department AdjRW Summary
fastify.get('/api/v1/clinical/rcm/ipd-dept-adjrw', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'รายงานผู้ป่วยใน ค่าน้ำหนักสัมพัทธ์ AdjRW และ CMI (RCM IPD AdjRW)',
    querystring: {
      type: 'object',
      properties: {
        startDate: { type: 'string' },
        endDate: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { startDate = '', endDate = '' } = req.query || {}
  try {
    const ds1 = startDate || new Date().toISOString().slice(0, 10)
    const ds2 = endDate || ds1
    const sql = `
      SELECT w.name as ward_name, count(i.an) as total_admissions,
        round(sum(coalesce(i.adjrw, 0)), 4) as total_adjrw,
        round(avg(coalesce(i.adjrw, 0)), 4) as cmi
      FROM ipt i
      LEFT JOIN ward w ON i.ward = w.ward
      WHERE i.dchdate BETWEEN ? AND ?
      GROUP BY w.name
      ORDER BY total_admissions DESC
    `
    const [rows] = await hosPool.query(sql, [ds1, ds2])
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})


// ------------------------------------------------------------------
// 1.12 TB Chest X-Ray Screening Tracker (ระบบติดตามการทำ CXR ในกลุ่มผู้ป่วย TB)
// ------------------------------------------------------------------
function getHospitalStatus(chw, amp, tmb, moo) {
  if (chw !== '52' || amp !== '08') return '\u0e2d\u0e22\u0e39\u0e48\u0e15\u0e48\u0e32\u0e07\u0e2d\u0e33\u0e40\u0e20\u0e2d/\u0e15\u0e48\u0e32\u0e07\u0e08\u0e31\u0e07\u0e2b\u0e27\u0e31\u0e14';
  const m = String(moo || '').padStart(2, '0');
  if (tmb === '01') {
    if (['01','06','07','08','12','13'].includes(m)) return '\u0e23\u0e1e.\u0e40\u0e16\u0e34\u0e19';
    if (['02','03','04','05','09','10','11','14'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e40\u0e14\u0e48\u0e19\u0e41\u0e01\u0e49\u0e27';
  }
  if (tmb === '02') {
    if (['01','04','05','06'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e40\u0e14\u0e48\u0e19\u0e0a\u0e31\u0e22';
    if (['02','03','07','08'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e41\u0e21\u0e48\u0e27\u0e30\u0e2b\u0e25\u0e27\u0e07';
  }
  if (tmb === '03') {
    if (['01','02','05','07','08'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e41\u0e21\u0e48\u0e1b\u0e30\u0e2b\u0e25\u0e27\u0e07';
    if (['03','04','06','09','10'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e17\u0e48\u0e32\u0e21\u0e30\u0e40\u0e01\u0e27\u0e4b\u0e19';
  }
  if (tmb === '04') {
    if (['01','02','05','06','09'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e41\u0e21\u0e48\u0e21\u0e2d\u0e01\u0e01\u0e25\u0e32\u0e07';
    if (['03','04','07','08','10'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e01\u0e38\u0e48\u0e21\u0e40\u0e19\u0e34\u0e49\u0e07';
  }
  if (tmb === '05') {
    if (['01','08','14'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e2b\u0e19\u0e2d\u0e07\u0e2b\u0e2d\u0e22';
    if (['04','06','10','11'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e1b\u0e32\u0e07\u0e2d\u0e49\u0e32';
    if (['02','03','12'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e2a\u0e30\u0e40\u0e25\u0e35\u0e22\u0e21\u0e2b\u0e27\u0e32\u0e19';
    if (['05','09','13'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e2b\u0e2d\u0e23\u0e1a';
    if (['07'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e17\u0e48\u0e32\u0e40\u0e01\u0e27\u0e35\u0e22\u0e19';
  }
  if (tmb === '06') {
    if (['01','02','03','04','08','09','11','12'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e2b\u0e49\u0e27\u0e22\u0e41\u0e01\u0e49\u0e27';
    if (['05','06','07','10'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e19\u0e32\u0e40\u0e1a\u0e35\u0e49\u0e22\u0e2b\u0e25\u0e27\u0e07';
  }
  if (tmb === '07') {
    if (['01','02','06','08','09','10','11'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e41\u0e21\u0e48\u0e16\u0e2d\u0e14';
    if (['03','04','05','07','12','13'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e19\u0e32\u0e1a\u0e49\u0e32\u0e19\u0e44\u0e23\u0e48';
  }
  if (tmb === '08') {
    if (['01','02','03','04','05','08','10','13'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e14\u0e2d\u0e19\u0e41\u0e01\u0e49\u0e27';
    if (['06','07','09','11','12','14'].includes(m)) return '\u0e23\u0e1e.\u0e2a\u0e15.\u0e27\u0e31\u0e07\u0e2b\u0e34\u0e19';
  }
  return '\u0e2d\u0e22\u0e39\u0e48\u0e15\u0e48\u0e32\u0e07\u0e2d\u0e33\u0e40\u0e20\u0e2d/\u0e15\u0e48\u0e32\u0e07\u0e08\u0e31\u0e07\u0e2b\u0e27\u0e31\u0e14';
}

// 1.12 TB Chest X-Ray Screening Tracker
fastify.get('/api/v1/clinical/tb/cxr-tracker', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'TB Chest X-Ray Screening Tracker',
    description: 'Track TB screening and CXR status with filters',
    querystring: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'done', 'missing'], default: 'all' },
        startDate: { type: 'string', default: '2026-10-01' },
        hospcode: { type: 'string' },
        search: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { status = 'all', startDate = '2026-10-01', hospcode, search } = req.query || {}
  const conn = await hosPool.getConnection()
  try {
    const queryParams = [startDate]
    let whereClauses = []

    if (status === 'done') {
      whereClauses.push('xr.report_date IS NOT NULL')
    } else if (status === 'missing') {
      whereClauses.push('xr.report_date IS NULL')
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`
      whereClauses.push('(c.cid LIKE ? OR hp.hn LIKE ? OR hp.fname LIKE ? OR hp.lname LIKE ?)')
      queryParams.push(s, s, s, s)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const sql = `
SELECT 
  c.id,
  c.risk_type,
  hp.pname AS title,
  hp.fname AS fname,
  hp.lname AS lname,
  c.cid,
  IF(hp.sex=1,"M","F") AS gender,
  CONCAT(YEAR(hp.birthday),DATE_FORMAT(hp.birthday,"%m%d")) AS born,
  hp.addrpart AS addr,
  hp.moopart AS mu,
  hp.chwpart,
  hp.amppart,
  hp.tmbpart,
  hp.moopart,
  pv.name AS province_id,
  ap.name AS amphur_id,
  tb.name AS tambol_id,
  tb.full_name AS full_name,
  ec.emp_citizenship_name AS people_type,
  c.race_id,
  hp.hn,
  p.name AS inccl_id,
  c.contact_date,
  c.symptom_screen,
  CONCAT(YEAR(xr.report_date),DATE_FORMAT(xr.report_date,"%m%d")) AS cxr_date,
  IF(xr.report_date IS NOT NULL, 'DONE', 'MISSING') AS cxr_status,
  c.cxr_result,
  c.cxr_abnormal_result,
  c.dx,
  c.icd10,
  c.hba1c,
  c.immunno_discase,
  c.b24,
  c.b24_ch,
  c.note,
  YEAR(CURDATE())-YEAR(hp.birthday) AS age
FROM CID.cid_link_tb c
LEFT JOIN patient hp ON c.cid=hp.cid
LEFT JOIN emp_citizenship ec ON hp.citizenship=ec.emp_citizenship_id
LEFT JOIN pttype p ON hp.pttype=p.pttype
LEFT JOIN thaiaddress pv ON pv.chwpart=hp.chwpart AND pv.codetype=1
LEFT JOIN thaiaddress ap ON ap.chwpart=hp.chwpart AND ap.amppart=hp.amppart AND ap.codetype=2
LEFT JOIN thaiaddress tb ON tb.chwpart=hp.chwpart AND tb.amppart=hp.amppart AND tb.tmbpart=hp.tmbpart AND tb.codetype=3
LEFT JOIN (
    SELECT hn, MAX(report_date) AS report_date
    FROM xray_report
    WHERE xray_items_code IN ('48','49','139','142','205','208')
      AND confirm='Y'
      AND report_date >= ?
    GROUP BY hn
) xr ON xr.hn = hp.hn
${whereSql}
ORDER BY c.id ASC
    `
    const [rawRows] = await conn.query(sql, queryParams)

    let doneCount = 0
    let missingCount = 0
    const statusBreakdown = {}
    const filteredRows = []

    const targetHospcode = hospcode ? hospcode.trim() : null

    for (const r of rawRows) {
      const st = getHospitalStatus(r.chwpart, r.amppart, r.tmbpart, r.moopart)
      const home = `${r.addr || ''} \u0e2b\u0e21\u0e39\u0e48\u0e17\u0e35\u0e48 ${r.mu || ''} ${r.full_name || ''}`.trim()

      if (r.cxr_status === 'DONE') doneCount++
      else missingCount++
      statusBreakdown[st] = (statusBreakdown[st] || 0) + 1

      if (!targetHospcode || st === targetHospcode) {
        filteredRows.push({
          ...r,
          status: st,
          home
        })
      }
    }

    const total = rawRows.length
    const coveragePercentage = total > 0 ? parseFloat(((doneCount / total) * 100).toFixed(1)) : 0

    return {
      success: true,
      data: {
        count: filteredRows.length,
        summary: {
          total,
          doneCount,
          missingCount,
          coveragePercentage,
          statusBreakdown
        },
        items: filteredRows
      }
    }
  } catch (err) {
    reply.code(500)
    return { success: false, error: err.message }
  } finally {
    conn.release()
  }
})


// 1.13 Outreach Screening Visit Verification (Check Medical Record & Today Visit)
fastify.post('/api/v1/clinical/screening/verify-visits', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'ตรวจสอบเวชระเบียนและสถานะการเปิด Visit สำหรับระบบคัดกรองตรวจนอกพื้นที่ (Screening Queue)',
    description: 'รับรายการเลขประจำตัวประชาชน (CIDs) เพื่อตรวจสอบว่ามีประวัติในเวชระเบียน (patient) หรือไม่ และมีประวัติการเปิด Visit วันนี้ (vn_stat where vstdate = CURRENT_DATE) หรือไม่ พร้อมส่งคืนสถานะ (NO_RECORD, WAITING, VISIT_OPENED), HN, และ VN',
    body: {
      type: 'object',
      required: ['cids'],
      properties: {
        cids: {
          type: 'array',
          items: { type: 'string' },
          description: 'รายการเลขประจำตัวประชาชน 13 หลัก'
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          count: { type: 'integer' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                cid: { type: 'string' },
                hn: { type: 'string' },
                vn: { type: 'string' },
                hasPatientRecord: { type: 'boolean' },
                hasVisitToday: { type: 'boolean' },
                status: { type: 'string', enum: ['NO_RECORD', 'WAITING', 'VISIT_OPENED'] }
              }
            }
          }
        }
      }
    }
  }
}, async (req, reply) => {
  const { cids = [] } = req.body || {}
  if (!Array.isArray(cids)) {
    reply.code(400); return { success: false, error: 'cids array required' }
  }
  const cleanCids = Array.from(new Set(cids.map((c) => String(c || '').trim()).filter(Boolean)))
  if (cleanCids.length === 0) {
    return { success: true, count: 0, data: [] }
  }

  try {
    const results = []
    const chunkSize = 50
    for (let i = 0; i < cleanCids.length; i += chunkSize) {
      const chunk = cleanCids.slice(i, i + chunkSize)
      const placeholders = chunk.map(() => '?').join(', ')
      const sql = `
        SELECT 
          p.cid,
          MAX(p.hn) AS hn,
          MAX(v.vn) AS vn
        FROM patient p
        LEFT JOIN vn_stat v ON v.hn = p.hn AND v.vstdate = CURRENT_DATE()
        WHERE p.cid IN (${placeholders})
        GROUP BY p.cid
      `
      const [rows] = await hosPool.query(sql, chunk)
      const rowMap = new Map()
      for (const row of rows || []) {
        const rowCid = String(row.cid || '').trim()
        if (rowCid) {
          rowMap.set(rowCid, {
            hn: row.hn ? String(row.hn).trim() : null,
            vn: row.vn ? String(row.vn).trim() : null
          })
        }
      }

      for (const cid of chunk) {
        const found = rowMap.get(cid)
        if (!found) {
          results.push({
            cid,
            hn: undefined,
            vn: undefined,
            hasPatientRecord: false,
            hasVisitToday: false,
            status: 'NO_RECORD'
          })
        } else if (found.vn) {
          results.push({
            cid,
            hn: found.hn,
            vn: found.vn,
            hasPatientRecord: true,
            hasVisitToday: true,
            status: 'VISIT_OPENED'
          })
        } else {
          results.push({
            cid,
            hn: found.hn,
            vn: undefined,
            hasPatientRecord: true,
            hasVisitToday: false,
            status: 'WAITING'
          })
        }
      }
    }

    return { success: true, count: results.length, data: results }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.14 RCM Invoice Summary (5.2.2.1 รายงานสรุปรายรับจาก Invoice e-Claim)
fastify.get('/api/v1/clinical/rcm/invoice-summary', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: '5.2.2.1 รายงานสรุปรายรับจาก Invoice (e-Claim) เปรียบเทียบลูกหนี้และเงินชดเชย',
    description: 'รายงานเปรียบเทียบลูกหนี้ค่ารักษาพยาบาล HOSxP กับยอดเงินชดเชยที่ สปสช./กองทุน จ่ายจริง จำแนกตามกลุ่มสิทธิ e-Claim (OPD/IPD)',
    querystring: {
      type: 'object',
      properties: {
        department: { type: 'string', enum: ['OP', 'IP'], default: 'OP', description: 'ประเภทผู้ป่วย OP (ผู้ป่วยนอก) หรือ IP (ผู้ป่วยใน)' },
        startDate: { type: 'string', description: 'วันที่เริ่มต้นค้นหา Statement (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'วันที่สิ้นสุดค้นหา Statement (YYYY-MM-DD)' },
        dateType: { type: 'string', enum: ['bill_date', 'admdate'], default: 'bill_date', description: 'กรองตามวันที่ bill_date (วันที่ออก Invoice) หรือ admdate (วันที่รับบริการ)' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          count: { type: 'integer' },
          data: {
            type: 'object',
            properties: {
              department: { type: 'string' },
              ds1: { type: 'string' },
              ds2: { type: 'string' },
              dateType: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    name: { type: 'string' },
                    visit: { type: 'number' },
                    receipt: { type: 'number' },
                    compensated: { type: 'number' },
                    down: { type: 'number' },
                    up: { type: 'number' },
                    debit: { type: 'number' }
                  }
                }
              },
              grandTotal: {
                type: 'object',
                properties: {
                  visit: { type: 'number' },
                  receipt: { type: 'number' },
                  compensated: { type: 'number' },
                  down: { type: 'number' },
                  up: { type: 'number' },
                  debit: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }
}, async (req, reply) => {
  const { department = 'OP', startDate = '', endDate = '', dateType = 'bill_date' } = req.query || {}
  const dept = department === 'IP' ? 'IP' : 'OP'
  const dateCol = dateType === 'admdate' ? 'admdate' : 'bill_date'
  const ds1 = startDate || new Date().toISOString().slice(0, 10)
  const ds2 = endDate || ds1
  const filterStart = dateType === 'admdate' ? `${ds1} 00:00:00` : ds1
  const filterEnd = dateType === 'admdate' ? `${ds2} 23:59:59` : ds2

  try {
    let query = ''
    const queryParams = [filterStart, filterEnd]

    if (dept === 'OP') {
      query = `
        SELECT 
          COALESCE(t.pttype_eclaim_id, 'UNKNOWN') as code,
          COALESCE(a.name, 'ไม่ระบุกลุ่มสิทธิ e-Claim') as name,
          t.visit,
          t.receipt,
          t.compensated,
          t.down,
          t.up,
          t.debit
        FROM (
          SELECT 
            ptt.pttype_eclaim_id,
            COUNT(t.vn) as visit,
            ROUND(SUM(t.receipt), 2) as receipt,
            ROUND(SUM(t.compensated), 2) as compensated,
            ROUND(SUM(t.down), 2) as down,
            ROUND(SUM(t.up), 2) as up,
            ROUND(SUM(t.debit), 2) as debit
          FROM (
            SELECT 
              t.vn,
              o.pttype,
              SUM(t.compensated) as compensated,
              SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)) as receipt,
              v.income - v.rcpt_money as debit,
              CASE 
                WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                WHEN SUM(t.compensated) - (v.income - v.rcpt_money) > 0 THEN SUM(t.compensated) - (v.income - v.rcpt_money)
                ELSE 0 
              END as down,
              CASE
                WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                WHEN SUM(t.compensated) - (v.income - v.rcpt_money) < 0 THEN SUM(t.compensated) - (v.income - v.rcpt_money)
                ELSE 0 
              END as up
            FROM rcmdb.repeclaim t
            LEFT JOIN hos.ovst o ON o.vn = t.vn
            LEFT JOIN hos.vn_stat v ON v.vn = o.vn
            WHERE t.department = 'OP'
              AND t.${dateCol} BETWEEN ? AND ?
            GROUP BY t.vn, o.pttype, v.income, v.rcpt_money
          ) t
          LEFT JOIN hos.pttype ptt ON ptt.pttype = t.pttype
          GROUP BY ptt.pttype_eclaim_id
        ) t
        LEFT JOIN hos.pttype_eclaim a ON a.code = t.pttype_eclaim_id
        WHERE t.visit > 0
        ORDER BY t.visit DESC, code ASC;
      `
    } else {
      query = `
        SELECT 
          COALESCE(t.pttype_eclaim_id, 'UNKNOWN') as code,
          COALESCE(a.name, 'ไม่ระบุกลุ่มสิทธิ e-Claim') as name,
          t.visit,
          t.receipt,
          t.compensated,
          t.down,
          t.up,
          t.debit
        FROM (
          SELECT 
            ptt.pttype_eclaim_id,
            COUNT(t.an) as visit,
            ROUND(SUM(t.receipt), 2) as receipt,
            ROUND(SUM(t.compensated), 2) as compensated,
            ROUND(SUM(t.down), 2) as down,
            ROUND(SUM(t.up), 2) as up,
            ROUND(SUM(t.debit), 2) as debit
          FROM (
            SELECT 
              t.an,
              i.pttype,
              SUM(t.compensated) as compensated,
              SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)) as receipt,
              a.income - a.rcpt_money as debit,
              CASE 
                WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                WHEN SUM(t.compensated) - (a.income - a.rcpt_money) > 0 THEN SUM(t.compensated) - (a.income - a.rcpt_money)
                ELSE 0 
              END as down,
              CASE
                WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
                WHEN SUM(t.compensated) - (a.income - a.rcpt_money) < 0 THEN SUM(t.compensated) - (a.income - a.rcpt_money)
                ELSE 0 
              END as up
            FROM rcmdb.repeclaim t
            LEFT JOIN hos.ipt i ON i.an = t.an
            LEFT JOIN hos.an_stat a ON a.an = i.an
            WHERE t.department = 'IP'
              AND t.${dateCol} BETWEEN ? AND ?
            GROUP BY t.an, i.pttype, a.income, a.rcpt_money
          ) t
          LEFT JOIN hos.pttype ptt ON ptt.pttype = t.pttype
          GROUP BY ptt.pttype_eclaim_id
        ) t
        LEFT JOIN hos.pttype_eclaim a ON a.code = t.pttype_eclaim_id
        WHERE t.visit > 0
        ORDER BY t.visit DESC, code ASC;
      `
    }

    const [rows] = await hosPool.query(query, queryParams)

    let grandVisit = 0
    let grandReceipt = 0
    let grandCompensated = 0
    let grandDown = 0
    let grandUp = 0
    let grandDebit = 0

    const items = (rows || []).map((r) => {
      const visit = Number(r.visit || 0)
      const receipt = Number(r.receipt || 0)
      const compensated = Number(r.compensated || 0)
      const down = Number(r.down || 0)
      const up = Number(r.up || 0)
      const debit = Number(r.debit || 0)

      grandVisit += visit
      grandReceipt += receipt
      grandCompensated += compensated
      grandDown += down
      grandUp += up
      grandDebit += debit

      return {
        code: String(r.code || ''),
        name: String(r.name || ''),
        visit,
        receipt: Math.round(receipt * 100) / 100,
        compensated: Math.round(compensated * 100) / 100,
        down: Math.round(down * 100) / 100,
        up: Math.round(up * 100) / 100,
        debit: Math.round(debit * 100) / 100,
      }
    })

    return {
      success: true,
      count: items.length,
      data: {
        department: dept,
        ds1,
        ds2,
        dateType,
        items,
        grandTotal: {
          visit: grandVisit,
          receipt: Math.round(grandReceipt * 100) / 100,
          compensated: Math.round(grandCompensated * 100) / 100,
          down: Math.round(grandDown * 100) / 100,
          up: Math.round(grandUp * 100) / 100,
          debit: Math.round(grandDebit * 100) / 100,
        }
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 1.15 RCM Invoice Patient Details (5.2.2.1 รายชื่อผู้ป่วยและรายละเอียดการชดเชย Invoice)
fastify.get('/api/v1/clinical/rcm/invoice-details', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: '5.2.2.1 รายชื่อผู้ป่วยและรายละเอียดการชดเชย Invoice (Drill-down Patient List)',
    description: 'ดึงรายชื่อผู้ป่วย ข้อมูลการชดเชยราย Visit/Invoice พร้อมหมวดกองทุนย่อยและผลต่างลูกหนี้',
    querystring: {
      type: 'object',
      properties: {
        department: { type: 'string', enum: ['OP', 'IP'], default: 'OP' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        pttype: { type: 'string', description: 'รหัสกลุ่มสิทธิ e-Claim (เช่น UCS, SSS, OFC)' },
        search: { type: 'string', description: 'คำค้นหา HN, VN, AN, ชื่อ, CID, REP, Bill' },
        page: { type: 'integer', default: 1 },
        pageSize: { type: 'integer', default: 50 },
        exportAll: { type: 'boolean', default: false },
        dateType: { type: 'string', enum: ['bill_date', 'admdate'], default: 'bill_date', description: 'กรองตามวันที่ bill_date หรือ admdate' }
      }
    }
  }
}, async (req, reply) => {
  const {
    department = 'OP',
    startDate = '',
    endDate = '',
    pttype = '',
    search = '',
    page = 1,
    pageSize = 50,
    exportAll = false,
    dateType = 'bill_date'
  } = req.query || {}

  const dept = department === 'IP' ? 'IP' : 'OP'
  const dateCol = dateType === 'admdate' ? 'admdate' : 'bill_date'
  const ds1 = startDate || new Date().toISOString().slice(0, 10)
  const ds2 = endDate || ds1
  const filterStart = dateType === 'admdate' ? `${ds1} 00:00:00` : ds1
  const filterEnd = dateType === 'admdate' ? `${ds2} 23:59:59` : ds2
  const cleanPttype = String(pttype || '').trim()
  const cleanSearch = String(search || '').trim()
  const pageNum = Math.max(1, Number(page || 1))
  const limitNum = exportAll ? 10000 : Math.max(1, Math.min(200, Number(pageSize || 50)))
  const offsetNum = (pageNum - 1) * limitNum

  const pttypeClause = cleanPttype ? 'AND ptt.pttype_eclaim_id = ?' : ''
  let searchClause = ''
  const searchParams = []

  if (cleanSearch) {
    searchClause = `AND (
      t.hn LIKE ? OR 
      ${dept === 'OP' ? 't.vn' : 't.an'} LIKE ? OR 
      t.ptname LIKE ? OR 
      t.pid LIKE ? OR 
      t.rep LIKE ? OR 
      t.bill LIKE ?
    )`
    const s = `%${cleanSearch}%`
    searchParams.push(s, s, s, s, s, s)
  }

  try {
    // 1. Count query
    let countSql = ''
    const countParams = [filterStart, filterEnd]
    if (cleanPttype) countParams.push(cleanPttype)
    if (cleanSearch) countParams.push(...searchParams)

    if (dept === 'OP') {
      countSql = `
        SELECT STRAIGHT_JOIN COUNT(DISTINCT t.vn) as total
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ovst o ON o.vn = t.vn
        LEFT JOIN hos.pttype ptt ON ptt.pttype = o.pttype
        WHERE t.department = 'OP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause};
      `
    } else {
      countSql = `
        SELECT STRAIGHT_JOIN COUNT(DISTINCT t.an) as total
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ipt i ON i.an = t.an
        LEFT JOIN hos.pttype ptt ON ptt.pttype = i.pttype
        WHERE t.department = 'IP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause};
      `
    }

    const [countRows] = await hosPool.query(countSql, countParams)
    const totalCount = Number(countRows?.[0]?.total || 0)
    const totalPages = Math.ceil(totalCount / limitNum) || 1

    // 2. Data rows query
    let dataSql = ''
    const dataParams = [filterStart, filterEnd]
    if (cleanPttype) dataParams.push(cleanPttype)
    if (cleanSearch) dataParams.push(...searchParams)
    dataParams.push(limitNum, offsetNum)

    if (dept === 'OP') {
      dataSql = `
        SELECT STRAIGHT_JOIN 
          t.vn as vnOrAn,
          t.pid as cid,
          t.hn,
          t.ptname,
          DATE_FORMAT(t.admdate, '%d/%m/%Y') as vstdate,
          DATE_FORMAT(t.admdate, '%H:%i:%s') as vsttime,
          o.pttype,
          ptt.pttype_eclaim_id,
          ROUND(SUM(t.compensated), 2) as compensated,
          ROUND(SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)), 2) as fund_money,
          ROUND(v.income, 2) as income_hosxp,
          ROUND(v.rcpt_money, 2) as rcpt_money,
          ROUND(v.income - v.rcpt_money, 2) as debit_hosxp,
          ROUND(SUM(t.hc), 2) as hc,
          ROUND(SUM(t.ae), 2) as ae,
          ROUND(SUM(t.inst), 2) as inst,
          ROUND(SUM(t.op), 2) as op,
          ROUND(SUM(t.ip), 2) as ip,
          ROUND(SUM(t.drug), 2) as drug,
          ROUND(SUM(t.dmis), 2) as dmis,
          ROUND(CASE 
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (v.income - v.rcpt_money) > 0 THEN SUM(t.compensated) - (v.income - v.rcpt_money)
            ELSE 0 
          END, 2) as down,
          ROUND(CASE
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (v.income - v.rcpt_money) < 0 THEN SUM(t.compensated) - (v.income - v.rcpt_money)
            ELSE 0 
          END, 2) as up,
          GROUP_CONCAT(DISTINCT t.rep ORDER BY t.rep SEPARATOR ', ') as rep,
          GROUP_CONCAT(DISTINCT t.bill ORDER BY t.rep SEPARATOR ', ') as bill,
          GROUP_CONCAT(DISTINCT DATE_FORMAT(t.bill_date, '%d/%m/%Y') ORDER BY t.rep SEPARATOR ', ') as billdate
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ovst o ON o.vn = t.vn
        LEFT JOIN hos.vn_stat v ON v.vn = o.vn
        LEFT JOIN hos.pttype ptt ON ptt.pttype = o.pttype
        WHERE t.department = 'OP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause}
        GROUP BY t.vn, t.pid, t.hn, t.ptname, t.admdate, o.pttype, ptt.pttype_eclaim_id, v.income, v.rcpt_money
        ORDER BY t.hn ASC, t.vn ASC
        LIMIT ? OFFSET ?;
      `
    } else {
      dataSql = `
        SELECT STRAIGHT_JOIN 
          t.an as vnOrAn,
          t.pid as cid,
          t.hn,
          t.ptname,
          DATE_FORMAT(t.admdate, '%d/%m/%Y') as admdate,
          DATE_FORMAT(i.dchdate, '%d/%m/%Y') as dchdate,
          i.pttype,
          ptt.pttype_eclaim_id,
          ROUND(SUM(t.compensated), 2) as compensated,
          ROUND(SUM(t.hc + t.inst + t.ae + t.inst + t.drug + t.dmis + COALESCE(t.ontop, 0) + IF(t.fund IS NOT NULL, t.op, 0) + IF(t.fund IS NOT NULL, t.ip, 0)), 2) as fund_money,
          ROUND(a.income, 2) as income_hosxp,
          ROUND(a.rcpt_money, 2) as rcpt_money,
          ROUND(a.income - a.rcpt_money, 2) as debit_hosxp,
          ROUND(SUM(t.hc), 2) as hc,
          ROUND(SUM(t.ae), 2) as ae,
          ROUND(SUM(t.inst), 2) as inst,
          ROUND(SUM(t.op), 2) as op,
          ROUND(SUM(t.ip), 2) as ip,
          ROUND(SUM(t.drug), 2) as drug,
          ROUND(SUM(t.dmis), 2) as dmis,
          ROUND(CASE 
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (a.income - a.rcpt_money) > 0 THEN SUM(t.compensated) - (a.income - a.rcpt_money)
            ELSE 0 
          END, 2) as down,
          ROUND(CASE
            WHEN IFNULL(SUM(t.compensated), 0) = 0 THEN 0
            WHEN SUM(t.compensated) - (a.income - a.rcpt_money) < 0 THEN SUM(t.compensated) - (a.income - a.rcpt_money)
            ELSE 0 
          END, 2) as up,
          GROUP_CONCAT(DISTINCT t.rep ORDER BY t.rep SEPARATOR ', ') as rep,
          GROUP_CONCAT(DISTINCT t.bill ORDER BY t.rep SEPARATOR ', ') as bill,
          GROUP_CONCAT(DISTINCT DATE_FORMAT(t.bill_date, '%d/%m/%Y') ORDER BY t.rep SEPARATOR ', ') as billdate
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ipt i ON i.an = t.an
        LEFT JOIN hos.an_stat a ON a.an = i.an
        LEFT JOIN hos.pttype ptt ON ptt.pttype = i.pttype
        WHERE t.department = 'IP'
          AND t.${dateCol} BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause}
        GROUP BY t.an, t.pid, t.hn, t.ptname, t.admdate, i.dchdate, i.pttype, ptt.pttype_eclaim_id, a.income, a.rcpt_money
        ORDER BY t.an ASC
        LIMIT ? OFFSET ?;
      `
    }

    const [rows] = await hosPool.query(dataSql, dataParams)

    const items = (rows || []).map((r, idx) => ({
      no: offsetNum + idx + 1,
      vnOrAn: String(r.vnOrAn || ''),
      cid: String(r.cid || ''),
      hn: String(r.hn || ''),
      ptname: String(r.ptname || ''),
      vstdate: r.vstdate ? String(r.vstdate) : undefined,
      vsttime: r.vsttime ? String(r.vsttime) : undefined,
      admdate: r.admdate ? String(r.admdate) : undefined,
      dchdate: r.dchdate ? String(r.dchdate) : undefined,
      pttype: String(r.pttype || ''),
      pttype_eclaim_id: String(r.pttype_eclaim_id || ''),
      compensated: Number(r.compensated || 0),
      fund_money: Number(r.fund_money || 0),
      income_hosxp: Number(r.income_hosxp || 0),
      rcpt_money: Number(r.rcpt_money || 0),
      debit_hosxp: Number(r.debit_hosxp || 0),
      hc: Number(r.hc || 0),
      ae: Number(r.ae || 0),
      inst: Number(r.inst || 0),
      op: Number(r.op || 0),
      ip: Number(r.ip || 0),
      drug: Number(r.drug || 0),
      dmis: Number(r.dmis || 0),
      down: Number(r.down || 0),
      up: Number(r.up || 0),
      rep: String(r.rep || ''),
      bill: String(r.bill || ''),
      billdate: String(r.billdate || ''),
    }))

    return {
      success: true,
      count: items.length,
      totalCount,
      totalPages,
      page: pageNum,
      pageSize: limitNum,
      dateType,
      data: {
        items,
        totalCount,
        totalPages,
        page: pageNum,
        pageSize: limitNum,
        dateType
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})



}
