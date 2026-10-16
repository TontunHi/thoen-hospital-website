import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import mysql from 'mysql2/promise'
import 'dotenv/config'

const fastify = Fastify({
  logger: { level: 'info' }
})

await fastify.register(cors, { origin: true })
await fastify.register(rateLimit, { max: 600, timeWindow: '1 minute' })

// ------------------------------------------------------------------
// Swagger / OpenAPI Documentation
// ------------------------------------------------------------------
await fastify.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Thoen Hospital Unified API Gateway',
      description: 'ระบบศูนย์กลางเชื่อมต่อข้อมูลโรงพยาบาลเถิน (HOSxP, Salary, และ Website Application) ปลอดภัย ได้มาตรฐาน พร้อม In-Memory Caching',
      version: '1.0.0'
    },
    servers: [
      { url: '/', description: 'Current Gateway Server' }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          name: 'x-api-key',
          in: 'header',
          description: 'กรุณาระบุ x-api-key ที่ได้รับมอบหมายเพื่อยืนยันสิทธิ์การใช้งาน'
        }
      }
    },
    security: [{ ApiKeyAuth: [] }]
  }
})

await fastify.register(fastifySwaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  },
  staticCSP: false
})

// ------------------------------------------------------------------
// Database Connection Pools (3 Databases)
// ------------------------------------------------------------------
const hosPool = mysql.createPool({
  host: process.env.HOSXP_DB_HOST || '192.168.1.4',
  port: parseInt(process.env.HOSXP_DB_PORT || '3306', 10),
  user: process.env.HOSXP_DB_USER || 'guest',
  password: process.env.HOSXP_DB_PASSWORD || 'guest',
  database: process.env.HOSXP_DB_NAME || 'hos',
  charset: process.env.HOSXP_DB_CHARSET || 'tis620',
  connectionLimit: 25,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 5000
})

const salaryPool = mysql.createPool({
  host: process.env.SALARY_DB_HOST || '192.168.1.4',
  port: parseInt(process.env.SALARY_DB_PORT || '3306', 10),
  user: process.env.SALARY_DB_USER || 'guest',
  password: process.env.SALARY_DB_PASSWORD || 'guest',
  database: process.env.SALARY_DB_NAME || 'salary',
  charset: process.env.SALARY_DB_CHARSET || 'tis620',
  connectionLimit: 15,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 5000
})

const salaryEditPool = mysql.createPool({
  host: process.env.SALARY_EDIT_DB_HOST || '192.168.1.4',
  port: parseInt(process.env.SALARY_EDIT_DB_PORT || '3306', 10),
  user: process.env.SALARY_EDIT_DB_USER || 'salary',
  password: process.env.SALARY_EDIT_DB_PASSWORD || 'Thlp11152*',
  database: process.env.SALARY_EDIT_DB_NAME || 'salary',
  charset: process.env.SALARY_EDIT_DB_CHARSET || 'tis620',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 5000
})

const appPool = mysql.createPool({
  host: process.env.APP_DB_HOST || '192.168.1.7',
  port: parseInt(process.env.APP_DB_PORT || '3306', 10),
  user: process.env.APP_DB_USER || 'prnew',
  password: process.env.APP_DB_PASSWORD || 'PRnew11152@',
  database: process.env.APP_DB_NAME || 'thoen_hospital_website',
  charset: 'utf8mb4',
  timezone: '+07:00',
  dateStrings: true,
  connectionLimit: 25,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 5000
})

// Ensure utf8mb4 on every acquired connection to bypass MariaDB global init_connect='SET NAMES tis620'
appPool.on('connection', (conn) => {
  conn.query('SET NAMES utf8mb4', () => {})
})


// In-Memory Short-Lived Caching
const cache = new Map()
function getCached(key, ttlMs, fetcher) {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return Promise.resolve(hit.data)
  return fetcher().then(data => {
    cache.set(key, { data, expiresAt: now + ttlMs })
    if (cache.size > 500) {
      for (const [k, v] of cache.entries()) {
        if (v.expiresAt <= now) cache.delete(k)
      }
    }
    return data
  })
}

// Authentication Security Hook
const API_KEY = process.env.GATEWAY_API_KEY || 'thoen_gw_sec_7a8b9c2d1e0f3456'
fastify.addHook('onRequest', async (req, reply) => {
  if (req.url === '/health' || req.url === '/' || req.url.startsWith('/docs')) return
  const clientKey = req.headers['x-api-key'] || req.query?.apiKey
  if (!clientKey || clientKey !== API_KEY) {
    reply.code(401).send({ success: false, error: 'Unauthorized: Invalid or missing x-api-key' })
  }
})

// ==================================================================
// SECTION 0: Health & Audit
// ==================================================================
fastify.get('/health', {
  schema: {
    tags: ['0. Health & Monitoring'],
    summary: 'ตรวจสอบสถานะและความเร็ว Latency ของทั้ง 3 ฐานข้อมูล'
  }
}, async (req, reply) => {
  try {
    const t0 = Date.now(); await hosPool.query('SELECT 1'); const hosMs = Date.now() - t0
    const t1 = Date.now(); await salaryPool.query('SELECT 1'); const salMs = Date.now() - t1
    const t2 = Date.now(); await appPool.query('SELECT 1'); const appMs = Date.now() - t2
    return {
      status: 'UP',
      service: 'Thoen Hospital Unified API Gateway',
      databases: {
        hosxp: { host: '192.168.1.4:3306', database: 'hos', connected: true, latencyMs: hosMs },
        salary: { host: '192.168.1.4:3306', database: 'salary', connected: true, latencyMs: salMs },
        website: { host: '192.168.1.7:3306', database: 'thoen_hospital_website', connected: true, latencyMs: appMs }
      },
      uptime: process.uptime()
    }
  } catch (err) {
    reply.code(503); return { status: 'DOWN', error: err.message }
  }
})

fastify.post('/api/v1/audit/log', {
  schema: {
    tags: ['0. Health & Monitoring'],
    summary: 'บันทึกประวัติการทำรายการความปลอดภัย (Audit Log)',
    body: {
      type: 'object',
      required: ['actionType'],
      properties: {
        actionType: { type: 'string', description: 'ประเภทการกระทำ เช่น AUTH_LOGIN, VIEW_PHI, EDIT_MEMBER' },
        targetTable: { type: 'string', description: 'ชื่อตารางเป้าหมาย' },
        actionDetails: { type: 'string', description: 'รายละเอียด' },
        username: { type: 'string' },
        email: { type: 'string' },
        ipAddress: { type: 'string' },
        userAgent: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { actionType, targetTable = '', actionDetails = '', username = 'system', email = '', ipAddress = '', userAgent = '' } = req.body || {}
  try {
    const [result] = await appPool.query(
      'INSERT INTO audit_logs (action_type, target_table, action_details, username, email, ip_address, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [actionType, targetTable, actionDetails, username, email, ipAddress, userAgent]
    )
    return { success: true, logId: result.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// ==================================================================
// SECTION 1: HOSxP Clinical Services (192.168.1.4)
// ==================================================================

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

// 1.12 Universal Read-Only Query for HOSxP
fastify.post('/api/v1/clinical/query', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'Universal Read-Only Query สำหรับดึงตารางใดก็ได้ใน HOSxP (เฉพาะ SELECT)',
    body: {
      type: 'object',
      required: ['sql'],
      properties: {
        sql: { type: 'string', description: 'คำสั่ง SELECT SQL' },
        params: { type: 'array', description: 'พารามิเตอร์ binding ป้องกัน SQL Injection' }
      }
    }
  }
}, async (req, reply) => {
  const { sql, params = [] } = req.body || {}
  if (!sql || typeof sql !== 'string') { reply.code(400); return { success: false, error: 'SQL query required' } }
  const trimmed = sql.trim().toUpperCase()
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('EXPLAIN') && !trimmed.startsWith('SHOW')) {
    reply.code(403); return { success: false, error: 'Forbidden: Only SELECT/EXPLAIN queries allowed' }
  }
  if (/;\s*\S/.test(sql)) {
    reply.code(403); return { success: false, error: 'Forbidden: Multi-statements not allowed' }
  }
  try {
    const [rows] = await hosPool.query(sql, params)
    return { success: true, count: Array.isArray(rows) ? rows.length : 1, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
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
        endDate: { type: 'string', description: 'วันที่สิ้นสุดค้นหา Statement (YYYY-MM-DD)' }
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
  const { department = 'OP', startDate = '', endDate = '' } = req.query || {}
  const dept = department === 'IP' ? 'IP' : 'OP'
  const ds1 = startDate || new Date().toISOString().slice(0, 10)
  const ds2 = endDate || ds1

  try {
    let query = ''
    const queryParams = [ds1, ds2]

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
              AND t.bill_date BETWEEN ? AND ?
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
              AND t.bill_date BETWEEN ? AND ?
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
        exportAll: { type: 'boolean', default: false }
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
    exportAll = false
  } = req.query || {}

  const dept = department === 'IP' ? 'IP' : 'OP'
  const ds1 = startDate || new Date().toISOString().slice(0, 10)
  const ds2 = endDate || ds1
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
    const countParams = [ds1, ds2]
    if (cleanPttype) countParams.push(cleanPttype)
    if (cleanSearch) countParams.push(...searchParams)

    if (dept === 'OP') {
      countSql = `
        SELECT COUNT(DISTINCT t.vn) as total
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ovst o ON o.vn = t.vn
        LEFT JOIN hos.pttype ptt ON ptt.pttype = o.pttype
        WHERE t.department = 'OP'
          AND t.bill_date BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause};
      `
    } else {
      countSql = `
        SELECT COUNT(DISTINCT t.an) as total
        FROM rcmdb.repeclaim t
        LEFT JOIN hos.ipt i ON i.an = t.an
        LEFT JOIN hos.pttype ptt ON ptt.pttype = i.pttype
        WHERE t.department = 'IP'
          AND t.bill_date BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause};
      `
    }

    const [countRows] = await hosPool.query(countSql, countParams)
    const totalCount = Number(countRows?.[0]?.total || 0)
    const totalPages = Math.ceil(totalCount / limitNum) || 1

    // 2. Data rows query
    let dataSql = ''
    const dataParams = [ds1, ds2]
    if (cleanPttype) dataParams.push(cleanPttype)
    if (cleanSearch) dataParams.push(...searchParams)
    dataParams.push(limitNum, offsetNum)

    if (dept === 'OP') {
      dataSql = `
        SELECT 
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
          AND t.bill_date BETWEEN ? AND ?
          ${pttypeClause}
          ${searchClause}
        GROUP BY t.vn, t.pid, t.hn, t.ptname, t.admdate, o.pttype, ptt.pttype_eclaim_id, v.income, v.rcpt_money
        ORDER BY t.hn ASC, t.vn ASC
        LIMIT ? OFFSET ?;
      `
    } else {
      dataSql = `
        SELECT 
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
          AND t.bill_date BETWEEN ? AND ?
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
      data: {
        items,
        totalCount,
        totalPages,
        page: pageNum,
        pageSize: limitNum
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})



// ==================================================================
// SECTION 2: Salary Database Services (192.168.1.4)
// ==================================================================

// 2.1 Verify Login
fastify.post('/api/v1/salary/verify-login', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'ตรวจสอบสิทธิ์การเข้าสู่ระบบเงินเดือน (username & password)',
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string' },
        password: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { username, password } = req.body || {}
  if (!username || !password) { reply.code(400); return { success: false, error: 'Username and password required' } }
  try {
    const [rows] = await salaryPool.query(
      'SELECT id, user_name, name, status FROM username WHERE user_name = ? AND user_pass = ? LIMIT 1',
      [username, password]
    )
    if (rows.length === 0) {
      reply.code(401); return { success: false, error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' }
    }
    return { success: true, user: { username: rows[0].user_name, name: rows[0].name, status: rows[0].status } }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 2.2 Get Slips
fastify.get('/api/v1/salary/records/:username', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'ดึงประวัติสลิปเงินเดือนและค่าล่วงเวลา (OT) ตามเลขบัตรประชาชน',
    params: {
      type: 'object',
      properties: { username: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { username } = req.params
  try {
    const [salaryRows] = await salaryPool.query('SELECT * FROM salary WHERE c2 = ? ORDER BY c1 DESC', [username])
    const [otRows] = await salaryPool.query('SELECT * FROM ot WHERE c2 = ? ORDER BY c1 DESC', [username])
    return { success: true, username, salaryCount: salaryRows.length, otCount: otRows.length, data: { salary: salaryRows, ot: otRows } }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 2.3 Periods
fastify.get('/api/v1/salary/periods', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'ดึงรายการรอบการจ่ายเงินเดือน (datein)'
  }
}, async (req, reply) => {
  try {
    const [rows] = await salaryPool.query("SELECT id, type, DATE_FORMAT(datein, '%Y-%m-%d') as datein, notesalary FROM datein ORDER BY datein DESC, id DESC LIMIT 24")
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/salary/periods', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'สร้างรอบการจ่ายเงินเดือนใหม่ (สำหรับเจ้าหน้าที่การเงิน)',
    body: {
      type: 'object',
      required: ['datein', 'notesalary'],
      properties: {
        type: { type: 'string', default: '1' },
        datein: { type: 'string', description: 'YYYY-MM-DD' },
        notesalary: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { type, datein, notesalary } = req.body || {}
  if (!datein || !notesalary) { reply.code(400); return { success: false, error: 'datein and notesalary required' } }
  try {
    const [result] = await salaryEditPool.query('INSERT INTO datein (type, datein, notesalary) VALUES (?, ?, ?)', [type || '1', datein, notesalary])
    return { success: true, insertId: result.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.delete('/api/v1/salary/periods/:id', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'ลบรอบการจ่ายเงินเดือน',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    await salaryEditPool.query('DELETE FROM datein WHERE id = ?', [id])
    return { success: true, deletedId: id }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 2.4 Batch Upload Salary/OT
fastify.post('/api/v1/salary/upload-batch', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'อัปโหลดชุดข้อมูลเงินเดือน/OT แบบหลายแถว (สำหรับงานการเงิน)',
    body: {
      type: 'object',
      required: ['targetTable', 'rows'],
      properties: {
        targetTable: { type: 'string', enum: ['salary', 'ot'] },
        rows: { type: 'array' }
      }
    }
  }
}, async (req, reply) => {
  const { targetTable, rows } = req.body || {}
  if (!['salary', 'ot'].includes(targetTable) || !Array.isArray(rows) || rows.length === 0) {
    reply.code(400); return { success: false, error: 'Invalid payload' }
  }
  try {
    let insertedCount = 0
    for (const row of rows) {
      const keys = Object.keys(row)
      const values = Object.values(row)
      const placeholders = keys.map(() => '?').join(', ')
      const sql = `INSERT INTO ${targetTable} (${keys.join(', ')}) VALUES (${placeholders})`
      await salaryEditPool.query(sql, values)
      insertedCount++
    }
    return { success: true, insertedCount }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/salary/query', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'Universal Read-Only Query สำหรับฐานข้อมูล salary'
  }
}, async (req, reply) => {
  const { sql, params = [] } = req.body || {}
  if (!sql || typeof sql !== 'string') { reply.code(400); return { success: false, error: 'SQL query required' } }
  const trimmed = sql.trim().toUpperCase()
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('EXPLAIN') && !trimmed.startsWith('SHOW')) {
    reply.code(403); return { success: false, error: 'Forbidden: Only SELECT/EXPLAIN queries allowed' }
  }
  try {
    const [rows] = await salaryPool.query(sql, params)
    return { success: true, count: Array.isArray(rows) ? rows.length : 1, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 2.7 Parameterized Execute for Salary DB (INSERT / UPDATE / DELETE)
fastify.post('/api/v1/salary/execute', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'Universal Parameterized Execute สำหรับฐานข้อมูล salary (INSERT / UPDATE / DELETE)',
    body: {
      type: 'object',
      required: ['sql'],
      properties: {
        sql: { type: 'string', description: 'คำสั่ง INSERT, UPDATE หรือ DELETE' },
        params: { type: 'array', description: 'พารามิเตอร์ binding' }
      }
    }
  }
}, async (req, reply) => {
  const { sql, params = [] } = req.body || {}
  if (!sql || typeof sql !== 'string') { reply.code(400); return { success: false, error: 'SQL query required' } }
  const trimmed = sql.trim().toUpperCase()
  const forbiddenKeywords = ['DROP ', 'TRUNCATE ', 'ALTER ', 'GRANT ', 'REVOKE ', 'CREATE USER']
  if (forbiddenKeywords.some(kw => trimmed.includes(kw))) {
    reply.code(403); return { success: false, error: 'Forbidden: DDL operations are not allowed' }
  }
  if (!trimmed.startsWith('INSERT') && !trimmed.startsWith('UPDATE') && !trimmed.startsWith('DELETE')) {
    reply.code(403); return { success: false, error: 'Forbidden: Only INSERT/UPDATE/DELETE queries allowed' }
  }
  try {
    const [res] = await salaryEditPool.query(sql, params)
    return {
      success: true,
      affectedRows: res.affectedRows,
      insertId: res.insertId || null
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// ==================================================================
// SECTION 3: Members & Staff Management (192.168.1.7)
// ==================================================================


// 3.1 List Members
fastify.get('/api/v1/app/members', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ดึงรายชื่อสมาชิก/บุคลากรทั้งหมด'
  }
}, async (req, reply) => {
  try {
    const [rows] = await appPool.query(
      "SELECT id, username, email, name, department, position, salary_user, role, created_at, updated_at FROM members ORDER BY created_at DESC"
    )
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.2 Get Member by ID
fastify.get('/api/v1/app/members/:id', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ดึงข้อมูลสมาชิกรายบุคคลตาม ID',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query(
      "SELECT id, username, email, name, department, position, salary_user, role, created_at, updated_at FROM members WHERE id = ? LIMIT 1",
      [id]
    )
    if (rows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบสมาชิก' }
    }
    return { success: true, data: rows[0] }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.3 Create Member
fastify.post('/api/v1/app/members', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'เพิ่มสมาชิกใหม่เข้าสู่ระบบ',
    body: {
      type: 'object',
      required: ['username', 'email', 'role'],
      properties: {
        username: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        department: { type: 'string' },
        position: { type: 'string' },
        role: { type: 'string', enum: ['member', 'admin', 'subdistrict'], default: 'member' },
        salary_user: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { username, email, name = null, department = null, position = null, role = 'member', salary_user = null } = req.body || {}
  try {
    const [dup] = await appPool.query('SELECT id FROM members WHERE username = ? OR email = ? LIMIT 1', [username, email])
    if (dup.length > 0) {
      reply.code(400); return { success: false, error: 'ชื่อผู้ใช้งานหรืออีเมลนี้มีอยู่ในระบบแล้ว' }
    }
    const [res] = await appPool.query(
      'INSERT INTO members (username, email, name, department, position, role, salary_user, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [username.trim(), email.trim(), name, department, position, role, salary_user]
    )
    return { success: true, insertId: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.4 Update Member
fastify.put('/api/v1/app/members/:id', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'แก้ไขข้อมูลสมาชิก (Edit Member)',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        department: { type: 'string' },
        position: { type: 'string' },
        role: { type: 'string', enum: ['member', 'admin', 'subdistrict'] },
        salary_user: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { username, email, name, department, position, role, salary_user } = req.body || {}
  try {
    const [existing] = await appPool.query('SELECT id FROM members WHERE id = ? LIMIT 1', [id])
    if (existing.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบสมาชิกที่ต้องการแก้ไข' }
    }
    if (username || email) {
      const [dup] = await appPool.query('SELECT id FROM members WHERE (username = ? OR email = ?) AND id != ? LIMIT 1', [username || '', email || '', id])
      if (dup.length > 0) {
        reply.code(400); return { success: false, error: 'ชื่อผู้ใช้งานหรืออีเมลนี้มีอยู่ในระบบแล้ว' }
      }
    }
    await appPool.query(
      `UPDATE members 
       SET username = COALESCE(?, username), email = COALESCE(?, email), name = COALESCE(?, name),
           department = COALESCE(?, department), position = COALESCE(?, position),
           role = COALESCE(?, role), salary_user = COALESCE(?, salary_user), updated_at = NOW()
       WHERE id = ?`,
      [username, email, name, department, position, role, salary_user, id]
    )
    return { success: true, message: 'แก้ไขข้อมูลสมาชิกสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.5 Delete Member
fastify.delete('/api/v1/app/members/:id', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ลบสมาชิกออกจากระบบ (Delete Member)',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [res] = await appPool.query('DELETE FROM members WHERE id = ?', [id])
    if (res.affectedRows === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบสมาชิกที่จะลบ' }
    }
    return { success: true, message: 'ลบสมาชิกเรียบร้อยแล้ว' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.6 Member Permissions
fastify.get('/api/v1/app/members/:id/permissions', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ดึงรายการสิทธิ์เฉพาะบุคคลของสมาชิก',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query('SELECT permission_key, created_at, created_by FROM member_permissions WHERE member_id = ?', [id])
    return { success: true, memberId: id, permissions: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/members/:id/permissions', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'มอบสิทธิ์เฉพาะบุคคลให้แก่สมาชิก',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      required: ['permissionKey'],
      properties: {
        permissionKey: { type: 'string' },
        createdBy: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { permissionKey, createdBy = 'admin' } = req.body || {}
  try {
    await appPool.query(
      'INSERT INTO member_permissions (member_id, permission_key, created_by, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE created_by = ?',
      [id, permissionKey, createdBy, createdBy]
    )
    return { success: true, message: 'มอบสิทธิ์สำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.delete('/api/v1/app/members/:id/permissions/:key', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'เพิกถอนสิทธิ์เฉพาะบุคคลของสมาชิก',
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id, key } = req.params
  try {
    await appPool.query('DELETE FROM member_permissions WHERE member_id = ? AND permission_key = ?', [id, key])
    return { success: true, message: 'เพิกถอนสิทธิ์สำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// ==================================================================
// SECTION 4: Website Core Application (CMS, News, Slides, Assets, Tasks)
// ==================================================================

// 4.1 News List & Create
fastify.get('/api/v1/app/news', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการข่าวสาร/ประชาสัมพันธ์ (มีแคช 30 วิ)',
    querystring: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        limit: { type: 'string', default: '10' }
      }
    }
  }
}, async (req, reply) => {
  const { category = '', limit = '10' } = req.query || {}
  try {
    const cacheKey = `app-news-${category}-${limit}`
    const data = await getCached(cacheKey, 30000, async () => {
      let sql = 'SELECT id, title, slug, category, view_count, created_at FROM news'
      const params = []
      if (category) { sql += ' WHERE category = ?'; params.push(category) }
      sql += ' ORDER BY created_at DESC LIMIT ?'; params.push(parseInt(limit, 10))
      const [rows] = await appPool.query(sql, params)
      return rows
    })
    return { success: true, count: data.length, data }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/news', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'สร้างข่าวสาร/กิจกรรมใหม่',
    body: {
      type: 'object',
      required: ['title', 'slug', 'category', 'startDate', 'endDate'],
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        category: { type: 'string' },
        youtubeLink: { type: 'string' },
        startDate: { type: 'string', description: 'YYYY-MM-DD HH:mm:ss' },
        endDate: { type: 'string', description: 'YYYY-MM-DD HH:mm:ss' }
      }
    }
  }
}, async (req, reply) => {
  const { title, slug, category, youtubeLink = null, startDate, endDate } = req.body || {}
  try {
    const [res] = await appPool.query(
      'INSERT INTO news (title, slug, category, youtube_link, start_date, end_date, view_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())',
      [title, slug, category, youtubeLink, startDate, endDate]
    )
    return { success: true, insertId: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.2 News Detail & Update & Delete
fastify.get('/api/v1/app/news/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายละเอียดข่าวสารตาม ID (พร้อมอัปเดตยอดวิวอัตโนมัติ)',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query('SELECT * FROM news WHERE id = ? LIMIT 1', [id])
    if (rows.length === 0) { reply.code(404); return { success: false, error: 'ไม่พบข่าว' } }
    appPool.query('UPDATE news SET view_count = view_count + 1 WHERE id = ?', [id]).catch(() => {})
    const [attachments] = await appPool.query('SELECT id, file_path, file_type, original_name FROM attachments WHERE news_id = ?', [id])
    return { success: true, data: { ...rows[0], attachments } }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.put('/api/v1/app/news/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขข้อมูลข่าวสาร',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        category: { type: 'string' },
        youtubeLink: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { title, category, youtubeLink, startDate, endDate } = req.body || {}
  try {
    await appPool.query(
      `UPDATE news SET 
         title = COALESCE(?, title),
         category = COALESCE(?, category),
         youtube_link = COALESCE(?, youtube_link),
         start_date = COALESCE(?, start_date),
         end_date = COALESCE(?, end_date),
         updated_at = NOW()
       WHERE id = ?`,
      [title, category, youtubeLink, startDate, endDate, id]
    )
    return { success: true, message: 'แก้ไขข่าวสารสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.delete('/api/v1/app/news/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบข่าวสารและไฟล์แนบ',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    await appPool.query('DELETE FROM attachments WHERE news_id = ?', [id])
    await appPool.query('DELETE FROM news WHERE id = ?', [id])
    return { success: true, message: 'ลบข่าวสารสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.3 Hero Slides
fastify.get('/api/v1/app/slides', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงแบนเนอร์สไลด์หน้าแรก (มีแคช 60 วิ)'
  }
}, async (req, reply) => {
  try {
    const data = await getCached('app-slides', 60000, async () => {
      const [rows] = await appPool.query('SELECT id, title, image_path, link_url, display_order, duration FROM hero_slides ORDER BY display_order ASC')
      return rows
    })
    return { success: true, count: data.length, data }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/slides', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'เพิ่มภาพสไลด์แบนเนอร์ใหม่',
    body: {
      type: 'object',
      required: ['imagePath', 'startDate', 'endDate'],
      properties: {
        title: { type: 'string' },
        imagePath: { type: 'string' },
        linkUrl: { type: 'string' },
        displayOrder: { type: 'integer', default: 0 },
        duration: { type: 'integer', default: 6 },
        startDate: { type: 'string' },
        endDate: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { title = '', imagePath, linkUrl = '', displayOrder = 0, duration = 6, startDate, endDate } = req.body || {}
  try {
    const [res] = await appPool.query(
      'INSERT INTO hero_slides (title, image_path, link_url, display_order, duration, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [title, imagePath, linkUrl, displayOrder, duration, startDate, endDate]
    )
    return { success: true, insertId: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.delete('/api/v1/app/slides/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบภาพสไลด์แบนเนอร์',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    await appPool.query('DELETE FROM hero_slides WHERE id = ?', [id])
    return { success: true, message: 'ลบสไลด์สำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.4 Hospital Assets
fastify.get('/api/v1/app/assets', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ค้นหาทะเบียนครุภัณฑ์โรงพยาบาล',
    querystring: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        category: { type: 'string' },
        limit: { type: 'string', default: '50' }
      }
    }
  }
}, async (req, reply) => {
  const { search = '', category = '', limit = '50' } = req.query || {}
  try {
    let sql = 'SELECT id, article_num, fsn_num, name, category, brand, model, location_full_name, status, is_loanable FROM hospital_assets WHERE 1=1'
    const params = []
    if (search) { sql += ' AND (article_num LIKE ? OR name LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
    if (category) { sql += ' AND category = ?'; params.push(category) }
    sql += ' ORDER BY id DESC LIMIT ?'; params.push(parseInt(limit, 10))
    const [rows] = await appPool.query(sql, params)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.5 Hospital Events
fastify.get('/api/v1/app/events', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการปฏิทินกิจกรรมโรงพยาบาล'
  }
}, async (req, reply) => {
  try {
    const [rows] = await appPool.query(
      'SELECT id, title, location, banner_url, event_start_date, event_end_date, status, fiscal_year FROM hospital_events ORDER BY event_start_date DESC LIMIT 30'
    )
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.6 Inbox Tasks (Workflows & Repairs)
fastify.get('/api/v1/app/tasks', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการงานสารบรรณ/งานซ่อม/คำขอยืมอุปกรณ์ (Task Inbox)',
    querystring: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'string', default: '30' }
      }
    }
  }
}, async (req, reply) => {
  const { type = '', status = '', limit = '30' } = req.query || {}
  try {
    let sql = 'SELECT id, task_no, task_type, title, urgency, status, requester_name, requester_dept, current_step_no, created_at FROM inbox_tasks WHERE 1=1'
    const params = []
    if (type) { sql += ' AND task_type = ?'; params.push(type) }
    if (status) { sql += ' AND status = ?'; params.push(status) }
    sql += ' ORDER BY created_at DESC LIMIT ?'; params.push(parseInt(limit, 10))
    const [rows] = await appPool.query(sql, params)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.7 Contact Messages
fastify.get('/api/v1/app/contact-messages', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงข้อความติดต่อจากประชาชนหน้าเว็บไซต์'
  }
}, async (req, reply) => {
  try {
    const [rows] = await appPool.query('SELECT id, name, email, phone, message, is_read, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 50')
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/contact-messages', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ส่งข้อความติดต่อสอบถามจากประชาชน',
    body: {
      type: 'object',
      required: ['name', 'email', 'message'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        message: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { name, email, phone = '', message } = req.body || {}
  try {
    const [res] = await appPool.query('INSERT INTO contact_messages (name, email, phone, message, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())', [name, email, phone, message])
    return { success: true, messageId: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.8 Member Registration Requests
fastify.get('/api/v1/app/registrations', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงคำขอสมัครสมาชิกใหม่ของบุคลากร (รอการตรวจสอบ)'
  }
}, async (req, reply) => {
  try {
    const [rows] = await appPool.query('SELECT * FROM member_registrations ORDER BY created_at DESC LIMIT 50')
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.9 Universal Read-Only Query for Website DB
fastify.post('/api/v1/app/query', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'Universal Read-Only Query สำหรับฐานข้อมูล thoen_hospital_website (เฉพาะ SELECT)'
  }
}, async (req, reply) => {
  const { sql, params = [] } = req.body || {}
  if (!sql || typeof sql !== 'string') { reply.code(400); return { success: false, error: 'SQL query required' } }
  const trimmed = sql.trim().toUpperCase()
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('EXPLAIN') && !trimmed.startsWith('SHOW')) {
    reply.code(403); return { success: false, error: 'Forbidden: Only SELECT/EXPLAIN queries allowed' }
  }
  try {
    const [rows] = await appPool.query(sql, params)
    return { success: true, count: Array.isArray(rows) ? rows.length : 1, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.10 Universal Parameterized Execute (INSERT / UPDATE / DELETE)
fastify.post('/api/v1/app/execute', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'Universal Parameterized Execute สำหรับคำสั่งแก้ไขข้อมูล (INSERT / UPDATE / DELETE)',
    body: {
      type: 'object',
      required: ['sql'],
      properties: {
        sql: { type: 'string', description: 'คำสั่ง INSERT, UPDATE หรือ DELETE' },
        params: { type: 'array', description: 'พารามิเตอร์ binding' }
      }
    }
  }
}, async (req, reply) => {
  const { sql, params = [] } = req.body || {}
  if (!sql || typeof sql !== 'string') { reply.code(400); return { success: false, error: 'SQL query required' } }
  const trimmed = sql.trim().toUpperCase()
  const forbiddenKeywords = ['DROP ', 'TRUNCATE ', 'ALTER ', 'GRANT ', 'REVOKE ', 'CREATE USER']
  if (forbiddenKeywords.some(kw => trimmed.includes(kw))) {
    reply.code(403); return { success: false, error: 'Forbidden: DDL operations are not allowed' }
  }
  if (!trimmed.startsWith('INSERT') && !trimmed.startsWith('UPDATE') && !trimmed.startsWith('DELETE')) {
    reply.code(403); return { success: false, error: 'Forbidden: Only INSERT/UPDATE/DELETE queries allowed' }
  }
  try {
    const [res] = await appPool.query(sql, params)
    return {
      success: true,
      affectedRows: res.affectedRows,
      insertId: res.insertId || null
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.11 Universal Interactive Transaction for Multi-step Operations
fastify.post('/api/v1/app/transaction', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'Universal Transaction สำหรับคำสั่งหลายรายการที่ต้องทำพร้อมกันแบบ Atomic (Rollback อัตโนมัติเมื่อผิดพลาด)',
    body: {
      type: 'object',
      required: ['statements'],
      properties: {
        statements: {
          type: 'array',
          items: {
            type: 'object',
            required: ['sql'],
            properties: {
              sql: { type: 'string' },
              params: { type: 'array' }
            }
          }
        }
      }
    }
  }
}, async (req, reply) => {
  const { statements } = req.body || {}
  if (!Array.isArray(statements) || statements.length === 0) {
    reply.code(400); return { success: false, error: 'Statements array required' }
  }
  const connection = await appPool.getConnection()
  try {
    await connection.beginTransaction()
    const results = []
    for (const stmt of statements) {
      const [res] = await connection.query(stmt.sql, stmt.params || [])
      results.push({ affectedRows: res.affectedRows, insertId: res.insertId || null })
    }
    await connection.commit()
    return { success: true, count: results.length, results }
  } catch (err) {
    await connection.rollback()
    reply.code(500); return { success: false, error: err.message }
  } finally {
    connection.release()
  }
})

// ------------------------------------------------------------------
// Start Server
// ------------------------------------------------------------------
const port = parseInt(process.env.PORT || '8443', 10)
const host = process.env.HOST || '0.0.0.0'
try {
  await fastify.listen({ port, host })
  console.log(`Thoen Unified API Gateway running on http://${host}:${port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
