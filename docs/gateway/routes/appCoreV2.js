// Thoen Hospital API Gateway Plugin: App Core V2 (Member Profile/Admin, Screening Queues, KPI CRUD, Task Helpers & V2 Actions)
import crypto from 'crypto'

export default async function appCoreV2Routes(fastify, { pools }) {
  const { appPool } = pools

  // =========================================================================
  // 1. Member Profile, System Settings & Admin Member CRUD
  // =========================================================================

  fastify.put('/api/v1/app/members/profile-path', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'อัปเดต path รูปโปรไฟล์สมาชิก' }
  }, async (req, reply) => {
    try {
      const { username, profilePath } = req.body || {}
      if (!username || !profilePath) {
        reply.code(400); return { success: false, error: 'username and profilePath are required' }
      }
      await appPool.query('UPDATE members SET profile_path = ? WHERE username = ?', [profilePath, username])
      return { success: true, data: { path: profilePath } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/members/profile-path', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'อ่าน path รูปโปรไฟล์สมาชิกจาก username หรือ userId' }
  }, async (req, reply) => {
    try {
      let targetUsername = String(req.query?.username || '').trim()
      const userId = String(req.query?.userId || '').trim()
      if (userId) {
        const [users] = await appPool.query('SELECT username FROM members WHERE id = ? LIMIT 1', [userId])
        if (!users || users.length === 0) {
          reply.code(404); return { success: false, error: 'ไม่พบผู้ใช้ที่ระบุ' }
        }
        targetUsername = users[0].username
      }
      if (!targetUsername) {
        reply.code(400); return { success: false, error: 'username or userId required' }
      }
      const [rows] = await appPool.query('SELECT profile_path FROM members WHERE username = ? LIMIT 1', [targetUsername])
      return { success: true, data: { targetUsername, profilePath: rows?.[0]?.profile_path || null } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/members/by-username/:username', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ดึงข้อมูลสมาชิกและสิทธิ์ประจำตำแหน่งจาก username' }
  }, async (req, reply) => {
    try {
      const username = String(req.params?.username || '').trim()
      const [rows] = await appPool.query(
        'SELECT id, username, email, name, department, position, role, signature_path, profile_path FROM members WHERE username = ? LIMIT 1',
        [username]
      )
      if (!rows || rows.length === 0) {
        return { success: true, data: { member: null, permissions: [] } }
      }
      const member = rows[0]
      const pos = String(member.position || '').trim()
      let permissions = []
      if (pos) {
        const [permRows] = await appPool.query(
          'SELECT permission_key FROM position_permissions WHERE TRIM(position_name) = TRIM(?)',
          [pos]
        )
        permissions = (permRows || []).map((r) => r.permission_key)
      }
      return { success: true, data: { member, permissions } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.put('/api/v1/app/system-settings', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'บันทึกการตั้งค่าระบบสมาชิก' }
  }, async (req, reply) => {
    try {
      const settings = req.body?.settings || {}
      const keys = Object.keys(settings)
      for (const key of keys) {
        const val = settings[key] !== undefined && settings[key] !== null ? String(settings[key]) : ''
        await appPool.query(
          'INSERT INTO member_system_settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
          [key, val, val]
        )
      }
      return { success: true, data: { updatedKeys: keys } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/app/members/sync-salary-credentials', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ซิงค์บัญชีเงินเดือนเข้ากับตารางสมาชิก' }
  }, async (req, reply) => {
    try {
      const salaryUsers = Array.isArray(req.body?.salaryUsers) ? req.body.salaryUsers : []
      const [members] = await appPool.query('SELECT id, username FROM members')
      const memberMap = new Map()
      for (const m of members || []) {
        if (m.username) memberMap.set(String(m.username).trim(), m.id)
      }
      let matchedCount = 0
      let notMatchedCount = 0
      for (const sUser of salaryUsers) {
        const username = sUser?.user_name ? String(sUser.user_name).trim() : ''
        const password = sUser?.user_pass ? String(sUser.user_pass).trim() : ''
        if (!username) continue
        const memberId = memberMap.get(username)
        if (memberId !== undefined) {
          await appPool.query('UPDATE members SET salary_user = ?, salary_pass = ? WHERE id = ?', [
            username,
            password,
            memberId,
          ])
          matchedCount++
        } else {
          notMatchedCount++
        }
      }
      return {
        success: true,
        data: { matchedCount, notMatchedCount, totalSalaryUsers: salaryUsers.length },
      }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/admin/members', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'รายชื่อสมาชิกทั้งหมดสำหรับผู้ดูแลระบบ (masked salary_pass)' }
  }, async (_req, reply) => {
    try {
      const [rows] = await appPool.query(
        "SELECT id, username, email, name, department, position, salary_user, IF(salary_pass IS NULL OR salary_pass = '', NULL, '********') AS salary_pass, role, created_at, updated_at FROM members ORDER BY created_at DESC"
      )
      return { success: true, data: rows || [] }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/app/admin/members', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'สร้างสมาชิกใหม่โดยผู้ดูแลระบบ' }
  }, async (req, reply) => {
    try {
      const { username, email, name, department, position, salary_user, salary_pass, role } = req.body || {}
      if (!username || !email || !role) {
        reply.code(400); return { success: false, error: 'ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลที่จำเป็น' }
      }
      if (!['member', 'admin', 'subdistrict'].includes(role)) {
        reply.code(400); return { success: false, error: 'สิทธิ์การใช้งานไม่ถูกต้อง' }
      }
      const [dups] = await appPool.query(
        'SELECT id FROM members WHERE username = ? OR email = ?',
        [String(username).trim(), String(email).trim()]
      )
      if (dups && dups.length > 0) {
        reply.code(400); return { success: false, error: 'ชื่อผู้ใช้งานหรืออีเมลนี้ถูกใช้งานแล้วในระบบ' }
      }
      const [res] = await appPool.query(
        'INSERT INTO members (username, email, name, department, position, salary_user, salary_pass, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          String(username).trim(),
          String(email).trim(),
          name ? String(name).trim() : null,
          department ? String(department).trim() : null,
          position ? String(position).trim() : null,
          salary_user ? String(salary_user).trim() : null,
          salary_pass ? String(salary_pass).trim() : null,
          role,
        ]
      )
      return { success: true, data: { insertId: res.insertId } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.put('/api/v1/app/admin/members/:id', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'แก้ไขข้อมูลสมาชิกโดยผู้ดูแลระบบ' }
  }, async (req, reply) => {
    try {
      const id = req.params.id
      const { username, email, name, department, position, salary_user, salary_pass, role, actorUsername } = req.body || {}
      if (!id || !username || !email || !role) {
        reply.code(400); return { success: false, error: 'ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลที่จำเป็น' }
      }
      let finalRole = role
      if (actorUsername) {
        const [target] = await appPool.query('SELECT username, role FROM members WHERE id = ?', [id])
        if (target && target.length > 0 && target[0].username === actorUsername) {
          finalRole = target[0].role
        }
      }
      if (!['member', 'admin', 'subdistrict'].includes(finalRole)) {
        reply.code(400); return { success: false, error: 'สิทธิ์การใช้งานไม่ถูกต้อง' }
      }
      const [dups] = await appPool.query(
        'SELECT id FROM members WHERE (username = ? OR email = ?) AND id != ?',
        [String(username).trim(), String(email).trim(), id]
      )
      if (dups && dups.length > 0) {
        reply.code(400); return { success: false, error: 'ชื่อผู้ใช้งานหรืออีเมลนี้ถูกใช้งานแล้วในระบบ' }
      }
      const [existing] = await appPool.query('SELECT salary_pass FROM members WHERE id = ? LIMIT 1', [id])
      const oldPass = existing && existing.length > 0 ? existing[0].salary_pass : null
      const finalSalaryPass =
        salary_pass === '********' ? oldPass : salary_pass ? String(salary_pass).trim() : null

      await appPool.query(
        'UPDATE members SET username = ?, email = ?, name = ?, department = ?, position = ?, salary_user = ?, salary_pass = ?, role = ? WHERE id = ?',
        [
          String(username).trim(),
          String(email).trim(),
          name ? String(name).trim() : null,
          department ? String(department).trim() : null,
          position ? String(position).trim() : null,
          salary_user ? String(salary_user).trim() : null,
          finalSalaryPass,
          finalRole,
          id,
        ]
      )
      return { success: true, data: { finalRole } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.delete('/api/v1/app/admin/members/:id', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ลบสมาชิกโดยผู้ดูแลระบบ' }
  }, async (req, reply) => {
    try {
      const id = req.params.id
      const actorUsername = String(req.query?.actorUsername || '').trim()
      const [target] = await appPool.query('SELECT username FROM members WHERE id = ?', [id])
      const targetUsername = target && target.length > 0 ? target[0].username : null
      if (actorUsername && targetUsername === actorUsername) {
        reply.code(400); return { success: false, error: 'ไม่สามารถลบบัญชีของตัวเองได้' }
      }
      await appPool.query('DELETE FROM members WHERE id = ?', [id])
      return { success: true, data: { targetUsername } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // =========================================================================
  // 2. Screening Queue CRUD (Smart Card Field Screening)
  // =========================================================================

  fastify.get('/api/v1/app/screening-queues', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ดึงรายการคิวตรวจคัดกรองนอกพื้นที่' }
  }, async (req, reply) => {
    try {
      const { startSql, endSql, status, search, includePhoto, includeRawPayload, limit } = req.query || {}
      const whereClauses = []
      const params = []
      if (startSql && endSql) {
        whereClauses.push('created_at >= ?', 'created_at <= ?')
        params.push(startSql, endSql)
      }
      if (status && status !== 'ALL') {
        whereClauses.push('status = ?')
        params.push(status)
      }
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`
        whereClauses.push('(full_name LIKE ? OR cid LIKE ? OR vn LIKE ?)')
        params.push(q, q, q)
      }
      const fields = [
        'id', 'cid', 'title',
        'first_name AS firstName', 'last_name AS lastName', 'full_name AS fullName',
        'gender', 'birth_date AS birthDate', 'address',
        'status', 'vn', 'recorded_by AS recordedBy',
        'created_at AS createdAt', 'updated_at AS updatedAt',
      ]
      if (includePhoto === 'true') fields.push('photo_base64 AS photoBase64')
      if (includeRawPayload === 'true') fields.push('raw_payload AS rawPayload')
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
      const lim = Number(limit) > 0 ? `LIMIT ${Math.min(2000, Number(limit))}` : ''
      const [rows] = await appPool.query(
        `SELECT ${fields.join(', ')} FROM screening_queues ${whereSql} ORDER BY created_at DESC ${lim}`,
        params
      )
      return { success: true, data: rows || [] }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/screening-queues/:id', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ดึงรายละเอียดคิวตรวจคัดกรองตาม ID' }
  }, async (req, reply) => {
    try {
      const [rows] = await appPool.query(
        `SELECT id, cid, title, first_name AS firstName, last_name AS lastName, full_name AS fullName,
                gender, birth_date AS birthDate, address, photo_base64 AS photoBase64,
                raw_payload AS rawPayload, status, vn, recorded_by AS recordedBy,
                created_at AS createdAt, updated_at AS updatedAt
         FROM screening_queues WHERE id = ? LIMIT 1`,
        [req.params.id]
      )
      return { success: true, data: rows?.[0] || null }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/app/screening-queues/upsert', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'เพิ่มหรืออัปเดตคิวตรวจคัดกรองประจำวัน' }
  }, async (req, reply) => {
    try {
      const b = req.body || {}
      const [existingRows] = await appPool.query(
        `SELECT id, title, first_name AS firstName, last_name AS lastName, full_name AS fullName,
                gender, birth_date AS birthDate, address, photo_base64 AS photoBase64,
                raw_payload AS rawPayload, status, vn, recorded_by AS recordedBy
         FROM screening_queues
         WHERE cid = ? AND created_at >= ? AND created_at <= ?
         ORDER BY created_at DESC LIMIT 1`,
        [b.cid, b.startSql, b.endSql]
      )
      const existing = existingRows?.[0]
      let targetId
      if (existing) {
        const nextStatus = existing.status === 'CANCELLED' ? 'WAITING' : existing.status
        await appPool.query(
          `UPDATE screening_queues
           SET title = ?, first_name = ?, last_name = ?, full_name = ?,
               gender = ?, birth_date = ?, address = ?, photo_base64 = ?,
               raw_payload = ?, recorded_by = ?, status = ?, updated_at = NOW()
           WHERE id = ?`,
          [
            b.title ?? existing.title,
            b.firstName ?? existing.firstName,
            b.lastName ?? existing.lastName,
            b.fullName ?? existing.fullName,
            b.gender ?? existing.gender,
            b.birthDate ?? existing.birthDate,
            b.address ?? existing.address,
            b.photoBase64 ?? existing.photoBase64,
            b.rawPayload ?? existing.rawPayload,
            b.recordedBy ?? existing.recordedBy,
            nextStatus,
            existing.id,
          ]
        )
        targetId = existing.id
      } else {
        const [ins] = await appPool.query(
          `INSERT INTO screening_queues (
            cid, title, first_name, last_name, full_name,
            gender, birth_date, address, photo_base64, raw_payload,
            status, vn, recorded_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            b.cid, b.title ?? null, b.firstName ?? null, b.lastName ?? null, b.fullName,
            b.gender ?? null, b.birthDate ?? null, b.address ?? null, b.photoBase64 ?? null,
            b.rawPayload ?? null, b.status || 'WAITING', b.vn ?? null, b.recordedBy ?? null,
          ]
        )
        targetId = ins.insertId
      }
      const [rows] = await appPool.query(
        `SELECT id, cid, title, first_name AS firstName, last_name AS lastName, full_name AS fullName,
                gender, birth_date AS birthDate, address, photo_base64 AS photoBase64,
                raw_payload AS rawPayload, status, vn, recorded_by AS recordedBy,
                created_at AS createdAt, updated_at AS updatedAt
         FROM screening_queues WHERE id = ? LIMIT 1`,
        [targetId]
      )
      return { success: true, data: rows?.[0] || null }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.patch('/api/v1/app/screening-queues/:id/status', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'อัปเดตสถานะและ VN ของคิวตรวจคัดกรอง' }
  }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const { status, vn } = req.body || {}
      const [existing] = await appPool.query('SELECT id, vn FROM screening_queues WHERE id = ? LIMIT 1', [id])
      if (!existing || existing.length === 0) {
        reply.code(404); return { success: false, error: `ไม่พบคิวที่ต้องการอัปเดต (ID: ${id})` }
      }
      const nextVn = vn !== undefined ? vn : existing[0].vn
      await appPool.query('UPDATE screening_queues SET status = ?, vn = ?, updated_at = NOW() WHERE id = ?', [
        status,
        nextVn,
        id,
      ])
      const [rows] = await appPool.query(
        `SELECT id, cid, title, first_name AS firstName, last_name AS lastName, full_name AS fullName,
                gender, birth_date AS birthDate, address, photo_base64 AS photoBase64,
                raw_payload AS rawPayload, status, vn, recorded_by AS recordedBy,
                created_at AS createdAt, updated_at AS updatedAt
         FROM screening_queues WHERE id = ? LIMIT 1`,
        [id]
      )
      return { success: true, data: rows?.[0] || null }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/app/screening-queues/batch-status', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'อัปเดตสถานะคิวหลายรายการพร้อมกัน' }
  }, async (req, reply) => {
    try {
      const updates = Array.isArray(req.body?.updates) ? req.body.updates : []
      for (const u of updates) {
        await appPool.query('UPDATE screening_queues SET status = ?, vn = ?, updated_at = NOW() WHERE id = ?', [
          u.status,
          u.vn ?? null,
          u.id,
        ])
      }
      return { success: true, data: { updatedCount: updates.length } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.delete('/api/v1/app/screening-queues/cleanup', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ลบคิวตรวจคัดกรองเก่าเกินกำหนด' }
  }, async (req, reply) => {
    try {
      const days = Math.max(1, Number(req.query?.retentionDays || 30))
      const [res] = await appPool.query(
        'DELETE FROM screening_queues WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [days]
      )
      return { success: true, data: { count: Number(res?.affectedRows || 0) } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // =========================================================================
  // 3. KPI Topics, Indicators & Entries CRUD
  // =========================================================================

  fastify.get('/api/v1/app/kpi/fiscal-years', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'รายการปีงบประมาณ KPI ที่เปิดใช้งาน' }
  }, async (_req, reply) => {
    try {
      const [rows] = await appPool.query(
        'SELECT DISTINCT fiscal_year AS fiscalYear FROM kpi_topics WHERE is_active = 1 ORDER BY fiscal_year DESC'
      )
      return { success: true, data: (rows || []).map((r) => r.fiscalYear) }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/kpi/topics', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'รายการหัวข้อ KPI ตามปีงบประมาณ' }
  }, async (req, reply) => {
    try {
      const fiscalYear = req.query?.fiscalYear
      let sql = `
        SELECT t.id, t.fiscal_year AS fiscalYear, t.code, t.title, t.description, t.is_active AS isActive,
               (SELECT COUNT(*) FROM kpi_indicators i WHERE i.topic_id = t.id) AS indicatorCount
        FROM kpi_topics t WHERE t.is_active = 1
      `
      const params = []
      if (fiscalYear) {
        sql += ' AND t.fiscal_year = ?'
        params.push(fiscalYear)
      }
      sql += ' ORDER BY t.fiscal_year DESC, t.id ASC'
      const [rows] = await appPool.query(sql, params)
      return { success: true, data: rows || [] }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/kpi/topics/:topicId/categories', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'หมวดหมู่ตัวชี้วัดทั้งหมดในหัวข้อ KPI' }
  }, async (req, reply) => {
    try {
      const [rows] = await appPool.query(
        'SELECT DISTINCT category FROM kpi_indicators WHERE topic_id = ? ORDER BY category ASC',
        [req.params.topicId]
      )
      return { success: true, data: (rows || []).map((r) => r.category) }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/kpi/topics/:topicId/responsible-persons', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'รายชื่อผู้รับผิดชอบตัวชี้วัดในหัวข้อ KPI' }
  }, async (req, reply) => {
    try {
      const [rows] = await appPool.query(
        "SELECT DISTINCT responsible_name AS responsibleName FROM kpi_indicators WHERE topic_id = ? AND responsible_name IS NOT NULL AND responsible_name != '' ORDER BY responsible_name ASC",
        [req.params.topicId]
      )
      return { success: true, data: (rows || []).map((r) => r.responsibleName) }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/kpi/indicators', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ดึงรายการตัวชี้วัด KPI พร้อมผลบันทึกแต่ละงวด' }
  }, async (req, reply) => {
    try {
      const { topicId, fiscalYear, category, frequency, responsibleName, search } = req.query || {}
      let sql = `
        SELECT i.id, i.topic_id AS topicId, i.sequence, i.category, i.subcategory, i.code, i.old_code AS oldCode,
               i.frequency, i.title, i.numerator_name AS numeratorName, i.denominator_name AS denominatorName,
               i.target_raw AS targetRaw, i.target_operator AS targetOperator, i.target_value AS targetValue,
               i.target_unit AS targetUnit, i.responsible_name AS responsibleName, i.indicator_type AS indicatorType,
               i.display_order AS displayOrder,
               e.id AS entryId, e.period_key AS entryPeriodKey, e.period_label AS entryPeriodLabel,
               e.numerator_value AS entryNumeratorValue, e.denominator_value AS entryDenominatorValue,
               e.result_value AS entryResultValue, e.result_text AS entryResultText, e.status AS entryStatus,
               e.note AS entryNote, e.recorded_by_id AS entryRecordedById,
               COALESCE(m.name, e.recorded_by_name) AS entryRecordedByName,
               e.recorded_at AS entryRecordedAt, e.updated_at AS entryUpdatedAt
        FROM kpi_indicators i
        LEFT JOIN kpi_entries e ON e.indicator_id = i.id
      `
      const params = []
      if (fiscalYear) {
        sql += ' AND e.fiscal_year = ?'
        params.push(fiscalYear)
      }
      sql += ' LEFT JOIN members m ON m.id = e.recorded_by_id WHERE i.topic_id = ?'
      params.push(topicId)
      if (category) { sql += ' AND i.category = ?'; params.push(category) }
      if (frequency) { sql += ' AND i.frequency = ?'; params.push(frequency) }
      if (responsibleName) { sql += ' AND i.responsible_name LIKE ?'; params.push(`%${responsibleName}%`) }
      if (search) {
        sql += ' AND (i.title LIKE ? OR i.code LIKE ? OR i.subcategory LIKE ? OR i.responsible_name LIKE ?)'
        const s = `%${search}%`
        params.push(s, s, s, s)
      }
      sql += ` ORDER BY
        CASE WHEN i.sequence IS NULL OR TRIM(i.sequence) = '' THEN 2
             WHEN TRIM(i.sequence) REGEXP '^[0-9]' THEN 0
             ELSE 1 END ASC,
        CAST(i.sequence AS UNSIGNED) ASC, i.sequence ASC, i.display_order ASC, i.id ASC`
      const [rows] = await appPool.query(sql, params)
      return { success: true, data: rows || [] }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/kpi/indicators/:id', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ดึงรายละเอียดตัวชี้วัด KPI และผลบันทึกทั้งหมดตาม ID' }
  }, async (req, reply) => {
    try {
      const id = req.params.id
      const [[indRows], [entriesRows]] = await Promise.all([
        appPool.query(
          `SELECT i.id, i.topic_id AS topicId, i.sequence, i.category, i.subcategory, i.code, i.old_code AS oldCode,
                  i.frequency, i.title, i.numerator_name AS numeratorName, i.denominator_name AS denominatorName,
                  i.target_raw AS targetRaw, i.target_operator AS targetOperator, i.target_value AS targetValue,
                  i.target_unit AS targetUnit, i.responsible_name AS responsibleName, i.indicator_type AS indicatorType,
                  i.display_order AS displayOrder, t.fiscal_year AS fiscalYear
           FROM kpi_indicators i JOIN kpi_topics t ON t.id = i.topic_id WHERE i.id = ?`,
          [id]
        ),
        appPool.query(
          `SELECT e.id, e.indicator_id AS indicatorId, e.fiscal_year AS fiscalYear, e.period_key AS periodKey,
                  e.period_label AS periodLabel, e.numerator_value AS numeratorValue, e.denominator_value AS denominatorValue,
                  e.result_value AS resultValue, e.result_text AS resultText, e.status, e.note,
                  e.recorded_by_id AS recordedById, COALESCE(m.name, e.recorded_by_name) AS recordedByName,
                  e.recorded_at AS recordedAt, e.updated_at AS updatedAt
           FROM kpi_entries e LEFT JOIN members m ON m.id = e.recorded_by_id
           WHERE e.indicator_id = ? ORDER BY e.id ASC`,
          [id]
        ),
      ])
      if (!indRows || indRows.length === 0) return { success: true, data: null }
      return { success: true, data: { indicator: indRows[0], entries: entriesRows || [] } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/app/kpi/entries/save', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'บันทึกหรือแก้ไขผลตัวชี้วัด KPI ประจำงวด' }
  }, async (req, reply) => {
    try {
      const b = req.body || {}
      let authorName = b.recordedByName ?? null
      if (b.recordedById) {
        const [mRows] = await appPool.query('SELECT name FROM members WHERE id = ? LIMIT 1', [b.recordedById])
        if (mRows && mRows.length > 0 && mRows[0].name) authorName = mRows[0].name
      }
      const [existing] = await appPool.query(
        'SELECT id FROM kpi_entries WHERE indicator_id = ? AND period_key = ?',
        [b.indicatorId, b.periodKey]
      )
      let entryId
      if (existing && existing.length > 0) {
        entryId = existing[0].id
        await appPool.query(
          `UPDATE kpi_entries SET period_label = ?, numerator_value = ?, denominator_value = ?,
             result_value = ?, result_text = ?, status = ?, note = ?,
             recorded_by_id = ?, recorded_by_name = ?, recorded_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [
            b.periodLabel, b.numeratorValue ?? null, b.denominatorValue ?? null,
            b.resultValue ?? null, b.resultText ?? null, b.status, b.note ?? null,
            b.recordedById ?? null, authorName, entryId,
          ]
        )
      } else {
        const [ins] = await appPool.query(
          `INSERT INTO kpi_entries (
             indicator_id, fiscal_year, period_key, period_label,
             numerator_value, denominator_value, result_value, result_text,
             status, note, recorded_by_id, recorded_by_name, recorded_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            b.indicatorId, b.fiscalYear, b.periodKey, b.periodLabel,
            b.numeratorValue ?? null, b.denominatorValue ?? null, b.resultValue ?? null, b.resultText ?? null,
            b.status, b.note ?? null, b.recordedById ?? null, authorName,
          ]
        )
        entryId = ins.insertId
      }
      return { success: true, data: { entryId, authorName } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.put('/api/v1/app/kpi/indicators/:id/target', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'อัปเดตค่าเป้าหมายตัวชี้วัดและปรับสถานะ entries' }
  }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const { targetOperator, targetValue, targetUnit, targetRaw, entryStatusUpdates } = req.body || {}
      await appPool.query(
        'UPDATE kpi_indicators SET target_operator = ?, target_value = ?, target_unit = ?, target_raw = ?, updated_at = NOW() WHERE id = ?',
        [targetOperator ?? null, targetValue ?? null, targetUnit ?? null, targetRaw ?? null, id]
      )
      for (const u of Array.isArray(entryStatusUpdates) ? entryStatusUpdates : []) {
        await appPool.query('UPDATE kpi_entries SET status = ? WHERE id = ?', [u.status, u.id])
      }
      return { success: true, data: { updated: true } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/app/kpi/indicators', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'สร้างตัวชี้วัด KPI ใหม่' }
  }, async (req, reply) => {
    try {
      const b = req.body || {}
      const [res] = await appPool.query(
        `INSERT INTO kpi_indicators (
          topic_id, sequence, category, subcategory, code, old_code,
          frequency, title, numerator_name, denominator_name,
          target_raw, target_operator, target_value, target_unit,
          responsible_name, indicator_type, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          b.topicId, b.sequence ?? null, b.category, b.subcategory ?? null, b.code ?? null, b.oldCode ?? null,
          b.frequency, b.title, b.numeratorName ?? null, b.denominatorName ?? null,
          b.targetRaw ?? null, b.targetOperator ?? '>=', b.targetValue ?? null, b.targetUnit ?? '%',
          b.responsibleName ?? null, b.indicatorType ?? null, b.displayOrder ?? 999,
        ]
      )
      return { success: true, data: { insertId: res.insertId } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.put('/api/v1/app/kpi/indicators/:id', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'แก้ไขตัวชี้วัด KPI และปรับสถานะ entries' }
  }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const b = req.body || {}
      await appPool.query(
        `UPDATE kpi_indicators SET
          sequence = ?, category = ?, subcategory = ?, code = ?, old_code = ?,
          frequency = ?, title = ?, numerator_name = ?, denominator_name = ?,
          target_raw = ?, target_operator = ?, target_value = ?, target_unit = ?,
          responsible_name = ?, indicator_type = ?, display_order = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          b.sequence ?? null, b.category, b.subcategory ?? null, b.code ?? null, b.oldCode ?? null,
          b.frequency, b.title, b.numeratorName ?? null, b.denominatorName ?? null,
          b.targetRaw ?? null, b.targetOperator ?? null, b.targetValue ?? null, b.targetUnit ?? null,
          b.responsibleName ?? null, b.indicatorType ?? null, b.displayOrder ?? 999, id,
        ]
      )
      for (const u of Array.isArray(b.entryStatusUpdates) ? b.entryStatusUpdates : []) {
        await appPool.query('UPDATE kpi_entries SET status = ? WHERE id = ?', [u.status, u.id])
      }
      return { success: true, data: { updated: true } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.delete('/api/v1/app/kpi/indicators/:id', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ลบตัวชี้วัด KPI' }
  }, async (req, reply) => {
    try {
      await appPool.query('DELETE FROM kpi_indicators WHERE id = ?', [req.params.id])
      return { success: true, data: { deleted: true } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/app/kpi/topics/upsert-for-import', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'สร้างหรือล้างหัวข้อ KPI เพื่อนำเข้าข้อมูลชุดใหม่' }
  }, async (req, reply) => {
    try {
      const { fiscalYear, code, title, description } = req.body || {}
      const [existing] = await appPool.query(
        'SELECT id FROM kpi_topics WHERE fiscal_year = ? AND code = ?',
        [fiscalYear, code]
      )
      let topicId
      if (existing && existing.length > 0) {
        topicId = existing[0].id
        await appPool.query(
          'UPDATE kpi_topics SET title = ?, description = ?, is_active = 1 WHERE id = ?',
          [title, description ?? null, topicId]
        )
        await appPool.query('DELETE FROM kpi_indicators WHERE topic_id = ?', [topicId])
      } else {
        const [ins] = await appPool.query(
          'INSERT INTO kpi_topics (fiscal_year, code, title, description, is_active) VALUES (?, ?, ?, ?, 1)',
          [fiscalYear, code, title, description ?? null]
        )
        topicId = ins.insertId
      }
      return { success: true, data: { topicId } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // =========================================================================
  // 4. Task Inbox Auxiliary Endpoints (Work Summary, Media Requests, Preload)
  // =========================================================================

  fastify.get('/api/v1/app/tasks/work-summary', {
    schema: { tags: ['4. Website Application Services'], summary: 'สรุปยอดงานค้างและคำขอสมัครสมาชิกค้างอนุมัติของบุคลากร' }
  }, async (req, reply) => {
    try {
      const memberId = Number(req.query?.memberId || 0)
      let role = String(req.query?.role || '').trim()
      let position = String(req.query?.position || '').trim()
      if (memberId && !role && !position) {
        const [mRows] = await appPool.query('SELECT id, role, position FROM members WHERE id = ? LIMIT 1', [memberId])
        if (mRows && mRows.length > 0) {
          role = String(mRows[0].role || '').trim()
          position = String(mRows[0].position || '').trim()
        }
      }
      const [inboxRows] = await appPool.query(
        `SELECT COUNT(*) as cnt FROM inbox_tasks
         WHERE status = 'PENDING'
         AND (current_assignee = ? OR (\`current_role\` IS NOT NULL AND (\`current_role\` = ? OR \`current_role\` = ?)))`,
        [memberId, position, role]
      )
      let pendingRegistrationsCount = 0
      if (role === 'admin') {
        const [regRows] = await appPool.query(
          "SELECT COUNT(*) as cnt FROM member_registrations WHERE status = 'pending'"
        )
        pendingRegistrationsCount = Number(regRows?.[0]?.cnt || 0)
      }
      return {
        success: true,
        data: {
          pendingInboxCount: Number(inboxRows?.[0]?.cnt || 0),
          pendingRegistrationsCount,
        }
      }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/tasks/media-requests', {
    schema: { tags: ['4. Website Application Services'], summary: 'ดึงรายการคำขอผลิตสื่อประชาสัมพันธ์' }
  }, async (req, reply) => {
    try {
      const { requesterId, status, search, limit } = req.query || {}
      const whereClauses = ["t.task_type = 'MEDIA_REQUEST'"]
      const params = []
      if (requesterId) {
        whereClauses.push('t.requester_id = ?')
        params.push(Number(requesterId))
      }
      if (status) {
        whereClauses.push('t.status = ?')
        params.push(status)
      }
      if (search && String(search).trim()) {
        const s = `%${String(search).trim()}%`
        whereClauses.push('(t.task_no LIKE ? OR t.title LIKE ? OR t.requester_name LIKE ?)')
        params.push(s, s, s)
      }
      const lim = Math.min(500, Math.max(1, Number(limit || 50)))
      const [tasks] = await appPool.query(
        `SELECT t.id, t.task_no, t.task_type, t.title, t.description, t.urgency,
                t.requester_id, t.requester_name, t.requester_dept,
                t.status, t.current_step_no, t.current_assignee, t.\`current_role\`,
                t.custom_payload, t.created_at, t.updated_at,
                s.step_name as current_step_name
         FROM inbox_tasks t
         LEFT JOIN inbox_task_steps s ON t.id = s.task_id AND t.current_step_no = s.step_no
         WHERE ${whereClauses.join(' AND ')}
         ORDER BY
           CASE WHEN t.urgency = 'VERY_URGENT' THEN 1 WHEN t.urgency = 'URGENT' THEN 2 ELSE 3 END ASC,
           t.created_at DESC
         LIMIT ?`,
        [...params, lim]
      )
      return { success: true, data: tasks || [] }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/tasks/preload-repair-form', {
    schema: { tags: ['4. Website Application Services'], summary: 'โหลดข้อมูลตั้งต้นสำหรับฟอร์มแจ้งซ่อม (สมาชิก + สถานที่)' }
  }, async (req, reply) => {
    try {
      const username = String(req.query?.username || '').trim()
      const [[members], [locations]] = await Promise.all([
        appPool.query(
          'SELECT id, username, name, department, position, email FROM members WHERE username = ? LIMIT 1',
          [username]
        ),
        appPool.query(
          `SELECT id, room_name, floor_id, floor_name, building_id, building_name, full_name
           FROM hospital_locations WHERE is_active = 1
           ORDER BY building_name ASC, floor_id ASC, room_name ASC`
        ),
      ])
      return {
        success: true,
        data: {
          currentMember: members?.[0] || { id: 0, username, name: username, department: '', position: '' },
          initialLocations: locations || [],
        }
      }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/members/by-id/:id', {
    schema: { tags: ['3. Website Application (Members & CMS)'], summary: 'ดึงข้อมูลสมาชิกจาก ID' }
  }, async (req, reply) => {
    try {
      const [rows] = await appPool.query(
        'SELECT id, username, email, name, department, position, role, signature_path, profile_path FROM members WHERE id = ? LIMIT 1',
        [req.params.id]
      )
      return { success: true, data: rows?.[0] || null }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/app/tasks/workflow-action-v2', {
    schema: { tags: ['4. Website Application Services'], summary: 'ดำเนินการ Workflow Action V2 (Parity 100%)' }
  }, async (req, reply) => {
    const {
      taskId, action, comment, nextAssigneeId, partialEdits,
      holdReason, holdDetails, targetStepNo, sendToRequester,
      signaturePath, signatureHash, actor
    } = req.body || {}
    if (!taskId || !action || !actor?.id) {
      reply.code(400); return { success: false, error: 'taskId, action, and actor are required' }
    }
    const conn = await appPool.getConnection()
    try {
      await conn.beginTransaction()
      const [tasks] = await conn.query('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1 FOR UPDATE', [taskId])
      if (!tasks || tasks.length === 0) {
        await conn.rollback()
        reply.code(404); return { success: false, error: 'ไม่พบงานที่ระบุ' }
      }
      const task = tasks[0]
      const [steps] = await conn.query('SELECT * FROM inbox_task_steps WHERE task_id = ? ORDER BY step_no ASC', [taskId])
      const currentStep = steps.find((s) => s.step_no === task.current_step_no)
      if (!currentStep) {
        await conn.rollback()
        reply.code(400); return { success: false, error: 'ไม่พบขั้นตอนปัจจุบันของงาน' }
      }

      const actorName = actor.name || actor.username
      const nowStr = new Date().toISOString()

      if (partialEdits && typeof partialEdits === 'object' && Object.keys(partialEdits).length > 0) {
        let existingPayload = {}
        try { existingPayload = task.custom_payload ? (typeof task.custom_payload === 'string' ? JSON.parse(task.custom_payload) : task.custom_payload) : {} } catch {}
        const updatedPayload = { ...existingPayload, ...partialEdits }
        await conn.query('UPDATE inbox_tasks SET custom_payload = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(updatedPayload), taskId])
        task.custom_payload = JSON.stringify(updatedPayload)
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'PARTIAL_EDIT', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, actor.id, actorName, JSON.stringify({ changes: partialEdits, previous: existingPayload })]
        )
      }

      let isFinalStep = false
      let nextStepObj = null
      let targetStepObj = null
      let message = `ดำเนินการ ${action} สำเร็จ`

      if (action === 'HOLD') {
        let existingPayload = {}
        try { existingPayload = task.custom_payload ? (typeof task.custom_payload === 'string' ? JSON.parse(task.custom_payload) : task.custom_payload) : {} } catch {}
        const selectedReason = holdReason || comment || 'รอการจัดสรรงบ'
        const updatedPayload = {
          ...existingPayload,
          holdInfo: {
            reason: selectedReason,
            details: holdDetails?.trim() || null,
            heldAt: nowStr,
            heldById: actor.id,
            heldByName: actorName,
            heldByPosition: actor.position || null,
            previousStatus: task.status,
          },
        }
        await conn.query(`UPDATE inbox_tasks SET status = 'ON_HOLD', custom_payload = ?, updated_at = NOW() WHERE id = ?`, [JSON.stringify(updatedPayload), taskId])
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'HOLD_TASK', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, actor.id, actorName, JSON.stringify({ reason: selectedReason, details: holdDetails?.trim() || null, stepNo: currentStep.step_no, stepName: currentStep.step_name })]
        )
        message = 'พักงานเรียบร้อยแล้ว'
      } else if (action === 'RESUME') {
        let existingPayload = {}
        try { existingPayload = task.custom_payload ? (typeof task.custom_payload === 'string' ? JSON.parse(task.custom_payload) : task.custom_payload) : {} } catch {}
        const previousStatus = existingPayload.holdInfo?.previousStatus || (task.current_step_no > 1 ? 'IN_PROGRESS' : 'PENDING')
        const updatedPayload = { ...existingPayload, holdInfo: null, lastResumedAt: nowStr, lastResumedBy: actorName }
        await conn.query(`UPDATE inbox_tasks SET status = ?, custom_payload = ?, updated_at = NOW() WHERE id = ?`, [previousStatus, JSON.stringify(updatedPayload), taskId])
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'RESUME_TASK', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, actor.id, actorName, JSON.stringify({ restoredStatus: previousStatus, stepNo: currentStep.step_no, stepName: currentStep.step_name })]
        )
        message = 'ปลดพักงานและกลับมาดำเนินการต่อเรียบร้อยแล้ว'
      } else if (action === 'APPROVE') {
        await conn.query(
          `UPDATE inbox_task_steps SET status = 'COMPLETED', action_taken = 'APPROVE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?, signature_path = ?, signature_hash = ? WHERE id = ?`,
          [actor.id, actorName, comment || 'อนุมัติเรียบร้อย', signaturePath || null, signatureHash || null, currentStep.id]
        )
        const nextStep = steps.find((s) => s.step_no === task.current_step_no + 1)
        if (nextStep) {
          const nextAssignee = nextAssigneeId || nextStep.assigned_to_id || null
          await conn.query(
            `UPDATE inbox_tasks SET current_step_no = ?, current_assignee = ?, \`current_role\` = ?, status = 'PENDING', updated_at = NOW() WHERE id = ?`,
            [nextStep.step_no, nextAssignee, nextStep.assigned_role, taskId]
          )
          await conn.query(
            `UPDATE inbox_task_steps SET status = 'PENDING', assigned_to_id = ?, action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL WHERE id = ?`,
            [nextAssignee, nextStep.id]
          )
          nextStepObj = { ...nextStep, assigned_to_id: nextAssignee }
        } else {
          isFinalStep = true
          await conn.query(`UPDATE inbox_tasks SET status = 'APPROVED', current_assignee = NULL, \`current_role\` = NULL, updated_at = NOW() WHERE id = ?`, [taskId])
        }
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'APPROVE', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, actor.id, actorName, JSON.stringify({ stepNo: currentStep.step_no, stepName: currentStep.step_name, comment })]
        )
      } else if (action === 'REJECT') {
        await conn.query(
          `UPDATE inbox_task_steps SET status = 'REJECTED', action_taken = 'REJECT', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ? WHERE id = ?`,
          [actor.id, actorName, comment || 'ไม่อนุมัติ', currentStep.id]
        )
        await conn.query(`UPDATE inbox_tasks SET status = 'REJECTED', current_assignee = NULL, \`current_role\` = NULL, updated_at = NOW() WHERE id = ?`, [taskId])
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'REJECT', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, actor.id, actorName, JSON.stringify({ stepNo: currentStep.step_no, stepName: currentStep.step_name, comment })]
        )
      } else if (action === 'SEND_BACK') {
        const currentStepNo = task.current_step_no
        const isSendingToRequester = Boolean(sendToRequester || currentStepNo <= 1)
        let effectiveTargetStepNo = targetStepNo
        if (!isSendingToRequester && (!effectiveTargetStepNo || effectiveTargetStepNo >= currentStepNo)) {
          effectiveTargetStepNo = Math.max(1, currentStepNo - 1)
        }
        const targetStep = !isSendingToRequester && effectiveTargetStepNo ? steps.find((s) => s.step_no === effectiveTargetStepNo) : null
        targetStepObj = targetStep || null

        if (isSendingToRequester || !targetStep) {
          await conn.query(
            `UPDATE inbox_task_steps SET status = 'WAITING', action_taken = 'SEND_BACK', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ? WHERE id = ?`,
            [actor.id, actorName, comment || 'ส่งกลับแก้ไข', currentStep.id]
          )
          await conn.query(
            `UPDATE inbox_task_steps SET status = 'WAITING', action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL WHERE task_id = ? AND step_no > 1 AND id != ?`,
            [taskId, currentStep.id]
          )
          await conn.query(
            `UPDATE inbox_tasks SET status = 'SENT_BACK', current_step_no = 1, current_assignee = requester_id, \`current_role\` = NULL, updated_at = NOW() WHERE id = ?`,
            [taskId]
          )
          if (steps.length > 0) {
            await conn.query(
              `UPDATE inbox_task_steps SET status = 'PENDING', action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL WHERE task_id = ? AND step_no = 1`,
              [taskId]
            )
          }
        } else {
          await conn.query(
            `UPDATE inbox_task_steps SET status = 'WAITING', action_taken = 'SEND_BACK', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ? WHERE id = ?`,
            [actor.id, actorName, comment || 'ส่งกลับแก้ไข', currentStep.id]
          )
          await conn.query(
            `UPDATE inbox_task_steps SET status = 'WAITING', action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL WHERE task_id = ? AND step_no > ? AND id != ?`,
            [taskId, effectiveTargetStepNo, currentStep.id]
          )
          await conn.query(
            `UPDATE inbox_task_steps SET status = 'PENDING', action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL WHERE id = ?`,
            [targetStep.id]
          )
          await conn.query(
            `UPDATE inbox_tasks SET status = 'PENDING', current_step_no = ?, current_assignee = ?, \`current_role\` = ?, updated_at = NOW() WHERE id = ?`,
            [targetStep.step_no, targetStep.assigned_to_id || null, targetStep.assigned_role || null, taskId]
          )
        }
        const auditDetails = {
          stepNo: currentStep.step_no,
          stepName: currentStep.step_name,
          comment,
          targetStepNo: isSendingToRequester ? 1 : (effectiveTargetStepNo ?? Math.max(1, currentStepNo - 1)),
          targetStepName: isSendingToRequester ? 'ผู้ยื่นคำขอรับบริการ' : `ขั้นตอนที่ ${effectiveTargetStepNo ?? Math.max(1, currentStepNo - 1)}`,
        }
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'SEND_BACK', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, actor.id, actorName, JSON.stringify(auditDetails)]
        )
      } else if (action === 'COMPLETE') {
        const finalComment = comment?.trim() || 'ดำเนินการเสร็จสิ้นเรียบร้อย'
        let existingPayload = {}
        try { existingPayload = task.custom_payload ? (typeof task.custom_payload === 'string' ? JSON.parse(task.custom_payload) : task.custom_payload) : {} } catch {}
        const updatedPayload = {
          ...existingPayload,
          completedImmediately: true,
          completedAt: nowStr,
          completedBy: { id: actor.id, username: actor.username, name: actorName, position: actor.position || null },
          completedComment: finalComment,
        }
        await conn.query(
          `UPDATE inbox_tasks SET status = 'APPROVED', current_assignee = NULL, \`current_role\` = NULL, custom_payload = ?, updated_at = NOW() WHERE id = ?`,
          [JSON.stringify(updatedPayload), taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'COMPLETE', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, actor.id, actorName, JSON.stringify({ stepNo: currentStep.step_no, stepName: currentStep.step_name, comment })]
        )
      }

      await conn.commit()
      return { success: true, data: { message, isFinalStep, nextStep: nextStepObj, targetStep: targetStepObj } }
    } catch (err) {
      await conn.rollback()
      reply.code(500); return { success: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  fastify.post('/api/v1/app/tasks/repair-action-v2', {
    schema: { tags: ['4. Website Application Services'], summary: 'ดำเนินการงานซ่อม V2 (Parity 100%)' }
  }, async (req, reply) => {
    const { taskId, action, performer, payload = {} } = req.body || {}
    if (!taskId || !action || !performer?.id) {
      reply.code(400); return { success: false, error: 'taskId, action, and performer are required' }
    }
    const conn = await appPool.getConnection()
    try {
      await conn.beginTransaction()
      const [tasks] = await conn.query('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1 FOR UPDATE', [taskId])
      if (!tasks || tasks.length === 0) {
        await conn.rollback()
        reply.code(404); return { success: false, error: 'ไม่พบงานที่ระบุ' }
      }
      const task = tasks[0]
      const [repairRows] = await conn.query('SELECT * FROM repair_details WHERE task_id = ? LIMIT 1 FOR UPDATE', [taskId])
      if (!repairRows || repairRows.length === 0) {
        await conn.rollback()
        reply.code(404); return { success: false, error: 'ไม่พบรายละเอียดงานซ่อม' }
      }
      const performerName = performer.name || performer.username
      let message = 'ดำเนินการสำเร็จ'

      if (action === 'ACCEPT_JOB') {
        await conn.query(`UPDATE inbox_tasks SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ?`, [taskId])
        await conn.query(`UPDATE repair_details SET repair_status = 'IN_PROGRESS', updated_at = NOW() WHERE task_id = ?`, [taskId])
        await conn.query(`UPDATE inbox_task_steps SET status = 'IN_PROGRESS' WHERE task_id = ? AND step_no = 1`, [taskId])
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'ACCEPT_JOB', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, performer.id, performerName, JSON.stringify({ status: 'IN_PROGRESS', technician: performerName })]
        )
        message = 'รับงานซ่อมเรียบร้อยแล้ว'
      } else if (action === 'UPDATE_COWORKERS') {
        const { newCoWorkers } = payload
        await conn.query(`UPDATE repair_details SET co_workers = ?, updated_at = NOW() WHERE task_id = ?`, [JSON.stringify(newCoWorkers || []), taskId])
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'UPDATE_COWORKERS', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, performer.id, performerName, JSON.stringify({ co_workers: newCoWorkers || [] })]
        )
        message = 'อัปเดตรายชื่อผู้ร่วมงานสำเร็จ'
      } else if (action === 'SAVE_REPAIR_PROGRESS') {
        const { repairNature, isExternalRepair, externalVendorName, externalReason, costType, costAmount, foundProblem, solutionStep } = payload
        const newRepairStatus = isExternalRepair ? 'EXTERNAL_REPAIR' : 'IN_PROGRESS'
        await conn.query(
          `UPDATE repair_details
           SET repair_nature = ?, is_external_repair = ?, external_vendor_name = ?, external_reason = ?,
               cost_type = ?, cost_amount = ?, found_problem = ?, solution_step = ?, repair_status = ?, updated_at = NOW()
           WHERE task_id = ?`,
          [
            repairNature || 'NORMAL',
            isExternalRepair ? 1 : 0,
            externalVendorName?.trim() || null,
            externalReason?.trim() || null,
            costType || 'NO_COST',
            costType === 'HAS_COST' && costAmount ? Number(costAmount) : null,
            foundProblem?.trim() || null,
            solutionStep?.trim() || null,
            newRepairStatus,
            taskId,
          ]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'UPDATE_REPAIR_PROGRESS', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, performer.id, performerName, JSON.stringify({ isExternalRepair, externalVendorName, costType, costAmount, foundProblem, solutionStep })]
        )
        message = 'บันทึกข้อมูลผลการซ่อมเรียบร้อยแล้ว'
      } else if (action === 'COMPLETE_REPAIR') {
        const { foundProblem, solutionStep, costType, costAmount, repairNature } = payload
        await conn.query(
          `UPDATE repair_details
           SET repair_status = 'COMPLETED',
               repair_nature = COALESCE(?, repair_nature),
               found_problem = COALESCE(?, found_problem),
               solution_step = COALESCE(?, solution_step),
               cost_type = COALESCE(?, cost_type),
               cost_amount = CASE WHEN ? = 'HAS_COST' THEN ? ELSE cost_amount END,
               updated_at = NOW()
           WHERE task_id = ?`,
          [
            repairNature || null,
            foundProblem?.trim() || null,
            solutionStep?.trim() || null,
            costType || null,
            costType || null,
            costAmount ? Number(costAmount) : null,
            taskId,
          ]
        )
        await conn.query(`UPDATE inbox_tasks SET status = 'APPROVED', updated_at = NOW() WHERE id = ?`, [taskId])
        await conn.query(
          `UPDATE inbox_task_steps SET status = 'COMPLETED', action_taken = 'COMPLETE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = 'ดำเนินการซ่อมเสร็จสิ้นเรียบร้อย' WHERE task_id = ? AND step_no = 1`,
          [performer.id, performerName, taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'COMPLETE_REPAIR', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, performer.id, performerName, JSON.stringify({ status: 'COMPLETED' })]
        )
        message = 'บันทึกการซ่อมเสร็จสิ้นสมบูรณ์'
      } else if (action === 'CANCEL_JOB') {
        if (task.status === 'APPROVED' || task.status === 'REJECTED') {
          await conn.rollback()
          reply.code(400); return { success: false, error: 'ไม่สามารถยกเลิกงานที่เสร็จสิ้นหรือถูกยกเลิกไปแล้วได้' }
        }
        const isRequester = task.requester_id === performer.id
        const cancelReasonText = payload.reason?.trim() || (isRequester ? 'ผู้ยื่นคำขอยกเลิกรายการ' : 'ช่างปฏิเสธ/ยกเลิกงานซ่อม')
        await conn.query(`UPDATE inbox_tasks SET status = 'REJECTED', updated_at = NOW() WHERE id = ?`, [taskId])
        await conn.query(`UPDATE repair_details SET repair_status = 'CANCELLED', updated_at = NOW() WHERE task_id = ?`, [taskId])
        await conn.query(
          `UPDATE inbox_task_steps SET status = 'REJECTED', action_taken = 'REJECT', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ? WHERE task_id = ? AND step_no = 1`,
          [performer.id, performerName, cancelReasonText, taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details) VALUES (?, ?, 'CANCEL_REPAIR', ?, ?, ?)`,
          [crypto.randomUUID(), taskId, performer.id, performerName, JSON.stringify({ status: 'REJECTED', reason: cancelReasonText })]
        )
        message = 'ยกเลิกรายการแจ้งซ่อมเรียบร้อยแล้ว'
      }

      await conn.commit()
      return { success: true, data: { message } }
    } catch (err) {
      await conn.rollback()
      reply.code(500); return { success: false, error: err.message }
    } finally {
      conn.release()
    }
  })
}
