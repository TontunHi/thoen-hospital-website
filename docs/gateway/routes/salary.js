/**
 * Salary Database Services (192.168.1.4)
 * Slips, Periods, Upload batch
 */
export default async function salaryRoutes(fastify, options) {
  const { pools } = options;
  const { salaryPool, salaryEditPool } = pools;

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

fastify.put('/api/v1/salary/periods/:id', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'แก้ไขรอบการจ่ายเงินเดือน',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      required: ['datein'],
      properties: {
        type: { type: 'string', default: '1' },
        datein: { type: 'string', description: 'YYYY-MM-DD' },
        notesalary: { type: ['string', 'null'] }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { type, datein, notesalary } = req.body || {}
  try {
    const [result] = await salaryEditPool.query(
      'UPDATE datein SET type = ?, datein = ?, notesalary = ? WHERE id = ?',
      [type ? String(type) : '1', datein, notesalary || null, id]
    )
    return { success: true, affectedRows: result.affectedRows }
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

// 2.5 Get Latest Batch Summary
fastify.get('/api/v1/salary/batch/summary/:type', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'ดึงข้อมูลสรุปของชุดงวดเงินเดือนหรือ OT ล่าสุดที่อัปโหลดเข้าตาราง',
    params: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['salary', 'ot'] }
      }
    }
  }
}, async (req, reply) => {
  const { type } = req.params
  const tableName = type === 'salary' ? 'salary' : 'ot'
  try {
    const [latestRows] = await salaryPool.query(
      `SELECT DATE_FORMAT(c1, '%Y-%m-%d') as latest_date, c1 as raw_c1 
       FROM ${tableName} 
       WHERE c1 IS NOT NULL 
         AND c1 != '0000-00-00' 
         AND TRIM(c1) != '' 
       ORDER BY id DESC 
       LIMIT 1`
    )

    if (!latestRows || latestRows.length === 0) {
      return { success: true, summary: null }
    }

    const latestDate =
      latestRows[0].latest_date ||
      (typeof latestRows[0].raw_c1 === 'string'
        ? latestRows[0].raw_c1.substring(0, 10)
        : '')

    if (!latestDate || latestDate === '0000-00-00') {
      return { success: true, summary: null }
    }

    const [countRows] = await salaryPool.query(
      `SELECT COUNT(*) as total_count FROM ${tableName} WHERE DATE_FORMAT(c1, '%Y-%m-%d') = ? OR c1 = ?`,
      [latestDate, latestDate]
    )

    const totalCount = countRows[0]?.total_count || 0

    return {
      success: true,
      summary: {
        tableName,
        date: latestDate,
        count: totalCount
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 2.6 Delete Latest Batch with Confirmed Date
fastify.delete('/api/v1/salary/batch/latest/:type', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'ลบชุดงวดเงินเดือนหรือ OT ล่าสุดแบบปลอดภัย (ต้องยืนยันวันที่ confirmedDate)',
    params: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['salary', 'ot'] }
      }
    },
    body: {
      type: 'object',
      required: ['confirmedDate'],
      properties: {
        confirmedDate: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { type } = req.params
  const { confirmedDate } = req.body || {}
  const tableName = type === 'salary' ? 'salary' : 'ot'

  if (!confirmedDate) {
    reply.code(400); return { success: false, error: 'confirmedDate required' }
  }

  try {
    const [latestRows] = await salaryPool.query(
      `SELECT DATE_FORMAT(c1, '%Y-%m-%d') as latest_date, c1 as raw_c1 
       FROM ${tableName} 
       WHERE c1 IS NOT NULL 
         AND c1 != '0000-00-00' 
         AND TRIM(c1) != '' 
       ORDER BY id DESC 
       LIMIT 1`
    )

    const latestDate =
      latestRows?.[0]?.latest_date ||
      (typeof latestRows?.[0]?.raw_c1 === 'string'
        ? latestRows[0].raw_c1.substring(0, 10)
        : '')

    if (!latestDate || latestDate !== confirmedDate) {
      reply.code(409); return {
        success: false,
        error: `ข้อมูลมีการเปลี่ยนแปลง ชุดข้อมูลล่าสุดปัจจุบันคือวันที่ ${latestDate || 'ไม่พบ'} กรุณารีเฟรชและตรวจสอบอีกครั้ง`
      }
    }

    const [deleteResult] = await salaryEditPool.query(
      `DELETE FROM ${tableName} WHERE DATE_FORMAT(c1, '%Y-%m-%d') = ? OR c1 = ?`,
      [confirmedDate, confirmedDate]
    )

    return {
      success: true,
      deletedCount: deleteResult.affectedRows || 0,
      deletedDate: confirmedDate,
      tableName
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 2.7 Get Salary Users Credentials for Sync
fastify.get('/api/v1/salary/users', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'ดึงรายชื่อ user_name และ user_pass สำหรับซิงค์กับระบบสมาชิก'
  }
}, async (req, reply) => {
  try {
    const [rows] = await salaryPool.query('SELECT user_name, user_pass FROM username')
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 2.8 Get Calendar for Current Month
fastify.get('/api/v1/salary/calendar', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'ดึงตารางกำหนดการเงินเดือนประจำเดือนปัจจุบัน (datein)'
  }
}, async (req, reply) => {
  try {
    const [rows] = await salaryPool.query(
      "SELECT id, type, DATE_FORMAT(datein, '%Y-%m-%d') as datein, notesalary FROM datein WHERE MONTH(datein) = MONTH(NOW()) AND YEAR(datein) = YEAR(NOW()) ORDER BY ABS(DAY(datein)) ASC"
    )
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

}
