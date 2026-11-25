/**
 * Phase 3B: Staff Registrations & Telegram Bot Core Routes
 * Zero-SQL Named Endpoints for thoen-api-gateway-v2
 */
import crypto from 'crypto'

async function withUtf8Conn(pool, fn) {
  const conn = await pool.getConnection()
  try {
    await conn.query('SET NAMES utf8mb4')
    return await fn(conn)
  } finally {
    conn.release()
  }
}

async function withUtf8Tx(pool, fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('SET NAMES utf8mb4')
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    try { await conn.rollback() } catch {}
    throw err
  } finally {
    conn.release()
  }
}

const REG_UPDATE_FIELDS = [
  ['status', 'status'],
  ['rejectReason', 'reject_reason'],
  ['approvedBy', 'approved_by'],
  ['approvedAt', 'approved_at'],
  ['title', 'title'],
  ['firstNameTh', 'first_name_th'],
  ['lastNameTh', 'last_name_th'],
  ['firstNameEn', 'first_name_en'],
  ['lastNameEn', 'last_name_en'],
  ['nickname', 'nickname'],
  ['licenseNo', 'license_no'],
  ['birthDate', 'birth_date'],
  ['startDate', 'start_date'],
  ['containDate', 'contain_date'],
  ['department', 'department'],
  ['position', 'position'],
  ['level', 'level'],
  ['personnelGroup', 'personnel_group'],
  ['personnelGroupOther', 'personnel_group_other'],
  ['hosxpUser', 'hosxp_user'],
  ['hosxpPass', 'hosxp_pass'],
  ['email', 'email'],
  ['phone', 'phone'],
  ['lineId', 'line_id'],
  ['housingLocation', 'housing_location'],
]

export default async function appIntegrationsV2Routes(fastify, opts) {
  const appPool = opts.appPool || opts.pools?.appPool

  // =========================================================================
  // 1. STAFF REGISTRATIONS
  // =========================================================================

  fastify.get('/api/v1/app/v2/registrations/existing-member', { schema: { tags: ['08. Auth, Members & Permissions'], summary: 'ตรวจสอบสมาชิกเดิมจากเลขบัตรประชาชนหรืออีเมลก่อนสมัครใหม่' } }, async (req, reply) => {
    try {
      const citizenId = req.query?.citizenId ? String(req.query.citizenId).trim() : ''
      const email = req.query?.email ? String(req.query.email).trim() : ''
      const conds = []
      const params = []
      if (citizenId) { conds.push('username = ?'); params.push(citizenId) }
      if (email) { conds.push('LOWER(email) = LOWER(?)'); params.push(email) }
      if (conds.length === 0) return { success: true, data: null }
      const [rows] = await appPool.query(
        `SELECT id, username, email FROM members WHERE ${conds.join(' OR ')} LIMIT 1`,
        params
      )
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/registrations/pending', { schema: { tags: ['08. Auth, Members & Permissions'], summary: 'ตรวจสอบคำขอสมัครสมาชิกที่ค้างพิจารณาซ้ำซ้อน' } }, async (req, reply) => {
    try {
      const citizenId = req.query?.citizenId ? String(req.query.citizenId).trim() : ''
      const email = req.query?.email ? String(req.query.email).trim() : ''
      const excludeId = req.query?.excludeId ? Number(req.query.excludeId) : undefined
      const conds = []
      const params = []
      if (citizenId) { conds.push('citizen_id = ?'); params.push(citizenId) }
      if (email) { conds.push('LOWER(email) = LOWER(?)'); params.push(email) }
      if (conds.length === 0) return { success: true, data: null }
      let sql = `SELECT id, citizen_id AS citizenId, email FROM member_registrations WHERE status = 'pending' AND (${conds.join(' OR ')})`
      if (excludeId) { sql += ' AND id != ?'; params.push(excludeId) }
      sql += ' LIMIT 1'
      const [rows] = await appPool.query(sql, params)
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/registrations', { schema: { tags: ['08. Auth, Members & Permissions'], summary: 'ส่งคำขอลงทะเบียนสมาชิกใหม่ (V2)' } }, async (req, reply) => {
    try {
      const d = req.body || {}
      const vehiclesJson = d.vehicles ? JSON.stringify(d.vehicles) : null
      const insertId = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO member_registrations (
            citizen_id, title, first_name_th, last_name_th, first_name_en, last_name_en,
            nickname, license_no, birth_date, start_date, contain_date, department,
            position, level, personnel_group, personnel_group_other, has_hosxp,
            hosxp_user, hosxp_pass, email, phone, line_id, in_hospital_housing,
            housing_location, has_vehicle, vehicles, status, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, 'pending', NOW(), NOW()
          )`,
          [
            d.citizenId, d.title, d.firstNameTh, d.lastNameTh, d.firstNameEn, d.lastNameEn,
            d.nickname, d.licenseNo || null, d.birthDate, d.startDate, d.containDate || null, d.department,
            d.position, d.level, d.personnelGroup, d.personnelGroupOther || null, d.hasHosxp ? 1 : 0,
            d.hosxpUser || null, d.hosxpPass || null, d.email, d.phone, d.lineId || null,
            d.inHospitalHousing ? 1 : 0, d.housingLocation || null, d.hasVehicle ? 1 : 0, vehiclesJson,
          ]
        )
        return res.insertId
      })
      return { success: true, data: { id: insertId } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/registrations', { schema: { tags: ['08. Auth, Members & Permissions'], summary: 'ดึงรายการคำขอสมัครสมาชิกทั้งหมดพร้อมค้นหาและแบ่งหน้า' } }, async (req, reply) => {
    try {
      const page = Math.max(1, Number(req.query?.page || 1))
      const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 20)))
      const offset = (page - 1) * limit
      const status = req.query?.status ? String(req.query.status) : ''
      const search = req.query?.search ? String(req.query.search).trim() : ''

      const whereClauses = []
      const params = []
      if (status && status !== 'all') {
        whereClauses.push('status = ?')
        params.push(status)
      }
      if (search) {
        const s = `%${search}%`
        whereClauses.push(`(
          citizen_id LIKE ? OR first_name_th LIKE ? OR last_name_th LIKE ? OR
          first_name_en LIKE ? OR last_name_en LIKE ? OR email LIKE ? OR
          department LIKE ? OR position LIKE ? OR phone LIKE ?
        )`)
        params.push(s, s, s, s, s, s, s, s, s)
      }
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
      const [[countRows], [itemRows]] = await Promise.all([
        appPool.query(`SELECT COUNT(*) AS total FROM member_registrations ${whereSql}`, params),
        appPool.query(
          `SELECT * FROM member_registrations ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        ),
      ])
      return {
        success: true,
        data: {
          items: itemRows || [],
          total: Number(countRows?.[0]?.total || 0),
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/registrations/:id', { schema: { tags: ['08. Auth, Members & Permissions'], summary: 'ดึงรายละเอียดคำขอสมัครสมาชิกตาม ID' } }, async (req, reply) => {
    try {
      const id = Number(req.params?.id)
      const [rows] = await appPool.query('SELECT * FROM member_registrations WHERE id = ? LIMIT 1', [id])
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/registrations/:id', { schema: { tags: ['08. Auth, Members & Permissions'], summary: 'อัปเดตสถานะการอนุมัติหรือปฏิเสธคำขอสมัครสมาชิก' } }, async (req, reply) => {
    try {
      const id = Number(req.params?.id)
      const d = req.body || {}
      const fields = []
      const params = []
      for (const [k, col] of REG_UPDATE_FIELDS) {
        if (d[k] !== undefined) { fields.push(`${col} = ?`); params.push(d[k]) }
      }
      if (d.hasHosxp !== undefined) { fields.push('has_hosxp = ?'); params.push(d.hasHosxp ? 1 : 0) }
      if (d.inHospitalHousing !== undefined) { fields.push('in_hospital_housing = ?'); params.push(d.inHospitalHousing ? 1 : 0) }
      if (d.hasVehicle !== undefined) { fields.push('has_vehicle = ?'); params.push(d.hasVehicle ? 1 : 0) }
      if (d.vehicles !== undefined) {
        fields.push('vehicles = ?')
        params.push(d.vehicles ? JSON.stringify(d.vehicles) : null)
      }
      if (fields.length > 0) {
        fields.push('updated_at = NOW()')
        params.push(id)
        await withUtf8Conn(appPool, async (conn) => {
          await conn.query(`UPDATE member_registrations SET ${fields.join(', ')} WHERE id = ?`, params)
        })
      }
      return { success: true, data: { id } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/registrations/:id', { schema: { tags: ['08. Auth, Members & Permissions'], summary: 'ลบรายการคำขอสมัครสมาชิก' } }, async (req, reply) => {
    try {
      const id = Number(req.params?.id)
      await appPool.query('DELETE FROM member_registrations WHERE id = ?', [id])
      return { success: true, data: { deleted: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/registrations/create-member', { schema: { tags: ['08. Auth, Members & Permissions'], summary: 'สร้างบัญชีสมาชิกจริงจากคำขอสมัครที่ได้รับอนุมัติ' } }, async (req, reply) => {
    try {
      const { username, email, name, department, position, role } = req.body || {}
      const memberId = await withUtf8Conn(appPool, async (conn) => {
        await conn.query(
          `INSERT INTO members (username, email, name, department, position, role, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             email = VALUES(email),
             name = VALUES(name),
             department = VALUES(department),
             position = VALUES(position),
             updated_at = NOW()`,
          [username, email, name, department, position, role]
        )
        const [rows] = await conn.query('SELECT id FROM members WHERE username = ? LIMIT 1', [username])
        return rows?.[0]?.id ?? null
      })
      return { success: true, data: { id: memberId } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 2. TELEGRAM BOT CORE (Linking & Interactive Repair Callbacks)
  // =========================================================================

  fastify.post('/api/v1/app/v2/telegram/challenges', { schema: { tags: ['12. System Settings, Audit Admin & Telegram'], summary: 'สร้างรหัส Challenge Token สำหรับผูกบัญชี Telegram' } }, async (req, reply) => {
    try {
      const { memberId, token } = req.body || {}
      await withUtf8Tx(appPool, async (conn) => {
        await conn.query(
          'DELETE FROM telegram_link_challenges WHERE member_id = ? AND used_at IS NULL',
          [memberId]
        )
        await conn.query(
          'INSERT INTO telegram_link_challenges (member_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
          [memberId, token]
        )
      })
      return { success: true, data: { created: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/telegram/link/:memberId', { schema: { tags: ['12. System Settings, Audit Admin & Telegram'], summary: 'ตรวจสอบสถานะการเชื่อมต่อ Telegram ของสมาชิก' } }, async (req, reply) => {
    try {
      const memberId = Number(req.params?.memberId)
      const [rows] = await appPool.query(
        'SELECT telegram_chat_id, telegram_username, first_name, linked_at FROM member_telegram_links WHERE member_id = ? LIMIT 1',
        [memberId]
      )
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/telegram/link/:memberId', { schema: { tags: ['12. System Settings, Audit Admin & Telegram'], summary: 'ยกเลิกการเชื่อมต่อ Telegram ด้วย memberId' } }, async (req, reply) => {
    try {
      const memberId = Number(req.params?.memberId)
      await appPool.query('DELETE FROM member_telegram_links WHERE member_id = ?', [memberId])
      return { success: true, data: { unlinked: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/telegram/link-by-chat/:chatId', { schema: { tags: ['12. System Settings, Audit Admin & Telegram'], summary: 'ยกเลิกการเชื่อมต่อ Telegram ด้วย chatId' } }, async (req, reply) => {
    try {
      const chatId = String(req.params?.chatId || '').trim()
      const [rows] = await appPool.query(
        `SELECT m.id, m.name, m.username
         FROM member_telegram_links l
         JOIN members m ON l.member_id = m.id
         WHERE l.telegram_chat_id = ? LIMIT 1`,
        [chatId]
      )
      if (!rows || rows.length === 0) {
        return { success: true, data: { success: false } }
      }
      await appPool.query('DELETE FROM member_telegram_links WHERE telegram_chat_id = ?', [chatId])
      return { success: true, data: { success: true, memberName: rows[0].name || rows[0].username } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/telegram/verify-link', { schema: { tags: ['12. System Settings, Audit Admin & Telegram'], summary: 'ยืนยันการผูกบัญชี Telegram กับสมาชิกผ่านโทเค็น' } }, async (req, reply) => {
    try {
      const { token, chatId, userId, username, firstName } = req.body || {}
      const [challenges] = await appPool.query(
        'SELECT id, member_id, expires_at, used_at FROM telegram_link_challenges WHERE token_hash = ? LIMIT 1',
        [token]
      )
      if (!challenges || challenges.length === 0) {
        return { success: true, data: { success: false, error: 'รหัสเชื่อมต่อไม่ถูกต้อง หรือถูกยกเลิกแล้ว' } }
      }
      const ch = challenges[0]
      if (ch.used_at) {
        return { success: true, data: { success: false, error: 'รหัสเชื่อมต่อนี้ถูกใช้งานไปแล้ว' } }
      }
      if (new Date(ch.expires_at).getTime() < Date.now()) {
        return { success: true, data: { success: false, error: 'รหัสเชื่อมต่อนี้หมดอายุแล้ว กรุณากดขอเชื่อมต่อใหม่ที่หน้าเว็บไซต์' } }
      }
      const [members] = await appPool.query('SELECT id, name, username FROM members WHERE id = ? LIMIT 1', [ch.member_id])
      if (!members || members.length === 0) {
        return { success: true, data: { success: false, error: 'ไม่พบบัญชีผู้ใช้งานในระบบ' } }
      }
      const member = members[0]
      await withUtf8Tx(appPool, async (conn) => {
        await conn.query(
          `INSERT INTO member_telegram_links
            (member_id, telegram_chat_id, telegram_user_id, telegram_username, first_name, linked_at)
           VALUES (?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
            telegram_chat_id = VALUES(telegram_chat_id),
            telegram_user_id = VALUES(telegram_user_id),
            telegram_username = VALUES(telegram_username),
            first_name = VALUES(first_name),
            updated_at = NOW()`,
          [ch.member_id, chatId, userId, username || null, firstName || null]
        )
        await conn.query('UPDATE telegram_link_challenges SET used_at = NOW() WHERE id = ?', [ch.id])
      })
      return { success: true, data: { success: true, memberName: member.name || member.username } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/telegram/member-by-telegram', { schema: { tags: ['12. System Settings, Audit Admin & Telegram'], summary: 'ค้นหาข้อมูลสมาชิกจาก Telegram chatId หรือ userId' } }, async (req, reply) => {
    try {
      const userId = Number(req.query?.userId || 0)
      const chatId = req.query?.chatId || 0
      const [rows] = await appPool.query(
        `SELECT m.id, m.name, m.username, m.position, m.role
         FROM member_telegram_links l
         JOIN members m ON l.member_id = m.id
         WHERE l.telegram_user_id = ? OR l.telegram_chat_id = ?
         LIMIT 1`,
        [userId, chatId]
      )
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/telegram/repair-context/:taskId', { schema: { tags: ['12. System Settings, Audit Admin & Telegram'], summary: 'ดึงข้อมูลบริบทใบงานแจ้งซ่อมสำหรับ Telegram Bot' } }, async (req, reply) => {
    try {
      const taskId = String(req.params?.taskId || '').trim()
      const [[tasks], [repairs]] = await Promise.all([
        appPool.query('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1', [taskId]),
        appPool.query('SELECT * FROM repair_details WHERE task_id = ? LIMIT 1', [taskId]),
      ])
      return {
        success: true,
        data: {
          task: tasks?.[0] ?? null,
          repair: repairs?.[0] ?? null,
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/telegram/repair-action', { schema: { tags: ['12. System Settings, Audit Admin & Telegram'], summary: 'ดำเนินการรับงาน/อัปเดตงานซ่อมจาก Telegram Bot' } }, async (req, reply) => {
    try {
      const { action, taskId, memberId, memberName, username, solutionStep } = req.body || {}
      const [[tasks], [repairs]] = await Promise.all([
        appPool.query('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1', [taskId]),
        appPool.query('SELECT * FROM repair_details WHERE task_id = ? LIMIT 1', [taskId]),
      ])
      const task = tasks?.[0] ?? null
      const repair = repairs?.[0] ?? null
      if (!task) {
        return { success: true, data: { success: false, error: 'Task not found' } }
      }

      if (action === 'accept') {
        if (task.status !== 'PENDING') {
          return { success: true, data: { success: false, error: 'Already accepted' } }
        }
        await withUtf8Tx(appPool, async (conn) => {
          await conn.query(
            `UPDATE inbox_tasks SET status = 'IN_PROGRESS', current_assignee = ?, updated_at = NOW() WHERE id = ?`,
            [memberId, taskId]
          )
          await conn.query(
            `UPDATE repair_details SET repair_status = 'IN_PROGRESS', assigned_technician_id = ?, assigned_technician_name = ?, updated_at = NOW() WHERE task_id = ?`,
            [memberId, memberName, taskId]
          )
          await conn.query(
            `UPDATE inbox_task_steps SET status = 'IN_PROGRESS', assigned_to_id = ? WHERE task_id = ? AND step_no = 1`,
            [memberId, taskId]
          )
          await conn.query(
            `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
             VALUES (?, ?, 'ACCEPT_JOB_TELEGRAM', ?, ?, ?)`,
            [
              crypto.randomUUID(), taskId, memberId, memberName || username,
              JSON.stringify({ status: 'IN_PROGRESS', source: 'TELEGRAM_INLINE_BUTTON', technician: memberName }),
            ]
          )
        })
      } else if (action === 'complete') {
        await withUtf8Tx(appPool, async (conn) => {
          await conn.query(
            `UPDATE repair_details SET repair_status = 'COMPLETED', solution_step = ?, updated_at = NOW() WHERE task_id = ?`,
            [solutionStep, taskId]
          )
          await conn.query(
            `UPDATE inbox_tasks SET status = 'APPROVED', updated_at = NOW() WHERE id = ?`,
            [taskId]
          )
          await conn.query(
            `UPDATE inbox_task_steps SET status = 'COMPLETED', action_taken = 'COMPLETE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ? WHERE task_id = ? AND step_no = 1`,
            [memberId, memberName, solutionStep, taskId]
          )
          await conn.query(
            `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
             VALUES (?, ?, 'COMPLETE_REPAIR_TELEGRAM', ?, ?, ?)`,
            [
              crypto.randomUUID(), taskId, memberId, memberName || username || 'Technician',
              JSON.stringify({ status: 'COMPLETED', source: 'TELEGRAM_BOT', solution_step: solutionStep }),
            ]
          )
        })
      } else if (action === 'cancel') {
        if (task.status === 'APPROVED' || task.status === 'REJECTED') {
          return { success: true, data: { success: false, error: 'Already completed or rejected' } }
        }
        await withUtf8Tx(appPool, async (conn) => {
          await conn.query(`UPDATE inbox_tasks SET status = 'REJECTED', updated_at = NOW() WHERE id = ?`, [taskId])
          await conn.query(`UPDATE repair_details SET repair_status = 'CANCELLED', updated_at = NOW() WHERE task_id = ?`, [taskId])
          await conn.query(
            `UPDATE inbox_task_steps SET status = 'REJECTED', action_taken = 'REJECT', action_by = ?, action_by_name = ?, action_at = NOW(), comment = 'ยกเลิก / ปฏิเสธงานผ่าน Telegram' WHERE task_id = ? AND step_no = 1`,
            [memberId, memberName || username, taskId]
          )
          await conn.query(
            `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
             VALUES (?, ?, 'CANCEL_JOB_TELEGRAM', ?, ?, ?)`,
            [
              crypto.randomUUID(), taskId, memberId, memberName || username,
              JSON.stringify({ status: 'REJECTED', source: 'TELEGRAM_INLINE_BUTTON', cancelled_by: memberName }),
            ]
          )
        })
      } else {
        return reply.code(400).send({ success: false, error: 'Invalid repair action' })
      }

      let requesterChatId = null
      if (task.requester_id) {
        const [reqLinks] = await appPool.query(
          'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
          [task.requester_id]
        )
        requesterChatId = reqLinks?.[0]?.telegram_chat_id ?? null
      }

      return { success: true, data: { success: true, task, repair, requesterChatId } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })
}
