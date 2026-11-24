/**
 * Phase 3A: Auth, Signatures, Task Permissions, and Audit Log Admin Routes
 * Zero-SQL Named Endpoints for thoen-api-gateway-v2
 */

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

function buildAuditFilter(query, includeDetailsInPrimary) {
  let clause = ''
  const params = []
  const search = query?.search ? String(query.search) : ''
  const maskedSearch = query?.maskedSearch ? String(query.maskedSearch) : ''
  const actionType = query?.actionType ? String(query.actionType) : ''
  const startDate = query?.startDate ? String(query.startDate) : ''
  const endDate = query?.endDate ? String(query.endDate) : ''

  if (search) {
    const p = `%${search}%`
    let cond = includeDetailsInPrimary
      ? ' AND (username LIKE ? OR email LIKE ? OR target_table LIKE ? OR action_details LIKE ? OR ip_address LIKE ?'
      : ' AND (username LIKE ? OR email LIKE ? OR target_table LIKE ? OR ip_address LIKE ?'
    const sp = includeDetailsInPrimary ? [p, p, p, p, p] : [p, p, p, p]
    if (maskedSearch && maskedSearch !== search) {
      cond += ' OR username LIKE ? OR action_details LIKE ?'
      sp.push(`%${maskedSearch}%`, `%${maskedSearch}%`)
    }
    cond += ')'
    clause += cond
    params.push(...sp)
  }

  if (actionType) {
    clause += ' AND action_type = ?'
    params.push(actionType)
  }
  if (startDate) {
    clause += ' AND timestamp >= ?'
    params.push(startDate)
  }
  if (endDate) {
    clause += ' AND timestamp <= ?'
    params.push(`${endDate} 23:59:59`)
  }
  return { clause, params }
}

export default async function appAuthV2Routes(fastify, opts) {
  const appPool = opts.appPool || opts.pools?.appPool

  // =========================================================================
  // 1. MEMBER AUTH (OTP, Session Active Check, ThaID / ProviderID / HealthID)
  // =========================================================================

  fastify.get('/api/v1/app/auth/member-by-username', async (req, reply) => {
    try {
      const username = String(req.query?.username || '').trim()
      const email = req.query?.email ? String(req.query.email).trim() : ''
      const includeOtp = req.query?.includeOtp === 'true'
      if (!username) return { success: true, data: null }

      let sql = includeOtp
        ? 'SELECT id, username, name, email, role, otp_code, (otp_expiry > NOW()) AS is_valid FROM members WHERE username = ?'
        : 'SELECT id, username, name, email, role FROM members WHERE username = ?'
      const params = [username]
      if (email) {
        sql += ' AND email = ?'
        params.push(email)
      }
      sql += ' LIMIT 1'
      const [rows] = await appPool.query(sql, params)
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/auth/member-by-hash-cid/:hashCid', async (req, reply) => {
    try {
      const hashCid = String(req.params?.hashCid || '').trim().toLowerCase()
      if (!hashCid) return { success: true, data: null }
      const [rows] = await appPool.query(
        'SELECT id, username, email, role, name FROM members WHERE SHA2(username, 256) = ? LIMIT 1',
        [hashCid]
      )
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/auth/set-otp', async (req, reply) => {
    try {
      const { memberId, otp } = req.body || {}
      if (!memberId || !otp) {
        return reply.code(400).send({ success: false, error: 'memberId and otp required' })
      }
      await appPool.query(
        'UPDATE members SET otp_code = ?, otp_expiry = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE id = ?',
        [otp, memberId]
      )
      return { success: true, data: { updated: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/auth/clear-otp', async (req, reply) => {
    try {
      const { memberId } = req.body || {}
      if (!memberId) {
        return reply.code(400).send({ success: false, error: 'memberId required' })
      }
      await appPool.query(
        'UPDATE members SET otp_code = NULL, otp_expiry = NULL WHERE id = ?',
        [memberId]
      )
      return { success: true, data: { cleared: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/auth/check-active', async (req, reply) => {
    try {
      const username = String(req.query?.username || '').trim()
      const email = String(req.query?.email || '').trim()
      if (!username || !email) {
        return { success: true, data: { active: false, role: null } }
      }
      const [rows] = await appPool.query(
        'SELECT role FROM members WHERE username = ? AND email = ? LIMIT 1',
        [username, email]
      )
      if (!rows || rows.length === 0) {
        return { success: true, data: { active: false, role: null } }
      }
      return { success: true, data: { active: true, role: rows[0].role || 'member' } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 2. MEMBER SIGNATURES
  // =========================================================================

  fastify.get('/api/v1/app/signatures/feature-flag', async (_req, reply) => {
    try {
      const [rows] = await appPool.query(
        "SELECT config_value FROM member_system_settings WHERE config_key = 'feature_signature' LIMIT 1"
      )
      const enabled = !rows || rows.length === 0 || rows[0].config_value !== '0'
      return { success: true, data: { enabled } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/signatures/status', async (req, reply) => {
    try {
      const username = String(req.query?.username || '').trim()
      if (!username) return { success: true, data: { signaturePath: null, updatedAt: null } }
      const [rows] = await appPool.query(
        'SELECT signature_path, updated_at FROM members WHERE username = ? LIMIT 1',
        [username]
      )
      if (!rows || rows.length === 0) {
        return { success: true, data: { signaturePath: null, updatedAt: null } }
      }
      return {
        success: true,
        data: {
          signaturePath: rows[0].signature_path || null,
          updatedAt: rows[0].updated_at || null,
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.put('/api/v1/app/signatures/path', async (req, reply) => {
    try {
      const { username, signaturePath } = req.body || {}
      if (!username || !signaturePath) {
        return reply.code(400).send({ success: false, error: 'username and signaturePath required' })
      }
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query('UPDATE members SET signature_path = ? WHERE username = ?', [signaturePath, username])
      })
      return { success: true, data: { path: signaturePath } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/signatures/resolve-access', async (req, reply) => {
    try {
      const sessionUsername = String(req.query?.sessionUsername || '').trim()
      const sessionEmail = String(req.query?.sessionEmail || '').trim()
      const targetUserId = String(req.query?.targetUserId || '').trim()
      const [[sessionUsers], [targetUsers]] = await Promise.all([
        appPool.query(
          'SELECT id, username, role FROM members WHERE username = ? AND email = ? LIMIT 1',
          [sessionUsername, sessionEmail]
        ),
        appPool.query(
          'SELECT id, username, role FROM members WHERE id = ? LIMIT 1',
          [targetUserId]
        ),
      ])
      return {
        success: true,
        data: {
          sessionUser: sessionUsers?.[0] ?? null,
          targetUser: targetUsers?.[0] ?? null,
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 3. TASK PERMISSIONS MANAGEMENT
  // =========================================================================

  fastify.get('/api/v1/app/permissions/task-centric', async (_req, reply) => {
    try {
      const [[members], [permissionRows], [positionPerms]] = await Promise.all([
        appPool.query('SELECT id, username, name, department, position, role FROM members ORDER BY department ASC, name ASC'),
        appPool.query('SELECT member_id AS memberId, permission_key AS permissionKey FROM member_permissions'),
        appPool.query('SELECT id, permission_key AS permissionKey, position_name AS positionName FROM position_permissions ORDER BY permission_key ASC, position_name ASC'),
      ])
      return { success: true, data: { members, permissionRows, positionPerms } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/permissions/members-list', async (req, reply) => {
    try {
      const query = req.query?.query ? String(req.query.query).trim() : ''
      const department = req.query?.department ? String(req.query.department).trim() : ''
      const whereClauses = []
      const params = []
      if (query) {
        const q = `%${query}%`
        whereClauses.push('(name LIKE ? OR username LIKE ? OR department LIKE ?)')
        params.push(q, q, q)
      }
      if (department) {
        whereClauses.push('department = ?')
        params.push(department)
      }
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
      const [[members], [permissionRows]] = await Promise.all([
        appPool.query(
          `SELECT id, username, name, department, position, role FROM members ${whereSql} ORDER BY department ASC, name ASC`,
          params
        ),
        appPool.query('SELECT member_id AS memberId, permission_key AS permissionKey FROM member_permissions'),
      ])
      return { success: true, data: { members, permissionRows } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/permissions/grant-member', async (req, reply) => {
    try {
      const { memberId, permissionKey, actorUsername = 'admin' } = req.body || {}
      const [rows] = await appPool.query('SELECT id, name, username FROM members WHERE id = ? LIMIT 1', [memberId])
      if (!rows || rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'ไม่พบบุคลากรที่ระบุ' })
      }
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(
          `INSERT INTO member_permissions (member_id, permission_key, created_by, created_at)
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE created_by = VALUES(created_by)`,
          [memberId, permissionKey, actorUsername]
        )
      })
      return { success: true, data: { member: rows[0] } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/permissions/revoke-member', async (req, reply) => {
    try {
      const { memberId, permissionKey } = req.body || {}
      const [rows] = await appPool.query('SELECT id, name, username FROM members WHERE id = ? LIMIT 1', [memberId])
      await appPool.query(
        'DELETE FROM member_permissions WHERE member_id = ? AND permission_key = ?',
        [memberId, permissionKey]
      )
      return { success: true, data: { member: rows?.[0] ?? null } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/permissions/grant-position', async (req, reply) => {
    try {
      const { positionName, permissionKey } = req.body || {}
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(
          'INSERT IGNORE INTO position_permissions (position_name, permission_key, created_at) VALUES (?, ?, NOW())',
          [positionName, permissionKey]
        )
      })
      return { success: true, data: { granted: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/permissions/revoke-position', async (req, reply) => {
    try {
      const { positionName, permissionKey } = req.body || {}
      await appPool.query(
        'DELETE FROM position_permissions WHERE position_name = ? AND permission_key = ?',
        [positionName, permissionKey]
      )
      return { success: true, data: { revoked: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.put('/api/v1/app/permissions/member/:memberId', async (req, reply) => {
    try {
      const memberId = Number(req.params?.memberId)
      const { permissions = [], performedBy = 'admin' } = req.body || {}
      const unique = Array.from(new Set((permissions || []).map((p) => String(p).trim()).filter(Boolean)))
      await withUtf8Tx(appPool, async (conn) => {
        await conn.query('DELETE FROM member_permissions WHERE member_id = ?', [memberId])
        for (const key of unique) {
          await conn.query(
            'INSERT INTO member_permissions (member_id, permission_key, created_by, created_at) VALUES (?, ?, ?, NOW())',
            [memberId, key, performedBy]
          )
        }
      })
      return { success: true, data: { updated: true, count: unique.length } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.put('/api/v1/app/permissions/batch', async (req, reply) => {
    try {
      const { updates = [], performedBy = 'admin' } = req.body || {}
      await withUtf8Tx(appPool, async (conn) => {
        for (const item of updates) {
          const unique = Array.from(new Set((item.permissions || []).map((p) => String(p).trim()).filter(Boolean)))
          await conn.query('DELETE FROM member_permissions WHERE member_id = ?', [item.memberId])
          for (const key of unique) {
            await conn.query(
              'INSERT INTO member_permissions (member_id, permission_key, created_by, created_at) VALUES (?, ?, ?, NOW())',
              [item.memberId, key, performedBy]
            )
          }
        }
      })
      return { success: true, data: { updatedCount: updates.length } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/permissions/positions', async (_req, reply) => {
    try {
      const [[mappings], [positionsResult]] = await Promise.all([
        appPool.query('SELECT id, permission_key, position_name FROM position_permissions ORDER BY permission_key, position_name'),
        appPool.query('SELECT DISTINCT TRIM(position) AS position FROM members WHERE position IS NOT NULL AND TRIM(position) != "" ORDER BY position'),
      ])
      return {
        success: true,
        data: {
          mappings,
          availablePositions: (positionsResult || []).map((r) => r.position),
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 4. AUDIT LOGS ADMIN QUERIES, STATS, EXPORT & PURGE
  // =========================================================================

  fastify.get('/api/v1/app/audit-logs', async (req, reply) => {
    try {
      const page = Math.max(1, Number(req.query?.page || 1))
      const limit = Math.min(500, Math.max(1, Number(req.query?.limit || 25)))
      const offset = (page - 1) * limit
      const { clause, params } = buildAuditFilter(req.query, true)

      const [[countRows], [rows]] = await Promise.all([
        appPool.query(`SELECT COUNT(*) AS total FROM audit_logs WHERE 1=1${clause}`, params),
        appPool.query(
          `SELECT * FROM audit_logs WHERE 1=1${clause} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        ),
      ])
      return {
        success: true,
        data: {
          total: Number(countRows?.[0]?.total || 0),
          logs: rows || [],
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/audit-logs/export', async (req, reply) => {
    try {
      const { clause, params } = buildAuditFilter(req.query, false)
      const [rows] = await appPool.query(
        `SELECT id, timestamp, username, email, action_type, target_table, action_details, ip_address, user_agent
         FROM audit_logs WHERE 1=1${clause} ORDER BY timestamp DESC, id DESC LIMIT 10000`,
        params
      )
      return { success: true, data: rows || [] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/audit-logs/stats', async (_req, reply) => {
    try {
      const [[summaryRows], [todayRows], [storageRows]] = await Promise.all([
        appPool.query('SELECT COUNT(*) AS total_logs, MIN(timestamp) AS oldest_log, MAX(timestamp) AS newest_log FROM audit_logs'),
        appPool.query(`
          SELECT
            COUNT(CASE WHEN action_type = 'LOGIN' THEN 1 END) AS logins_today,
            COUNT(CASE WHEN action_type = 'READ' THEN 1 END) AS reads_today,
            COUNT(CASE WHEN action_type IN ('CREATE', 'UPDATE', 'DELETE') THEN 1 END) AS changes_today
          FROM audit_logs WHERE timestamp >= CURDATE()
        `),
        appPool.query(`
          SELECT ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'
          LIMIT 1
        `),
      ])
      return {
        success: true,
        data: {
          summary: summaryRows?.[0] ?? {},
          today: todayRows?.[0] ?? {},
          storage: storageRows?.[0] ?? {},
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/audit-logs/expired-count', async (req, reply) => {
    try {
      const retentionDays = Math.max(1, Number(req.query?.retentionDays || 90))
      const [rows] = await appPool.query(
        'SELECT COUNT(*) AS expiredCount FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [retentionDays]
      )
      return { success: true, data: { expiredCount: Number(rows?.[0]?.expiredCount || 0) } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/audit-logs/purge', async (req, reply) => {
    try {
      const { retentionDays = 90, mode = 'admin', adminActor } = req.body || {}
      const days = Math.max(1, Number(retentionDays))
      const [countRows] = await appPool.query(
        'SELECT COUNT(*) AS expiredCount FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [days]
      )
      const expiredCount = Number(countRows?.[0]?.expiredCount || 0)
      if (expiredCount === 0) {
        return { success: true, data: { expiredCount: 0, purgedCount: 0 } }
      }

      let totalPurged = 0
      if (mode === 'cron') {
        const [res] = await appPool.query(
          'DELETE FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 5000',
          [days]
        )
        totalPurged = Number(res?.affectedRows || 0)
      } else {
        while (totalPurged < expiredCount) {
          const [res] = await appPool.query(
            'DELETE FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 5000',
            [days]
          )
          const affected = Number(res?.affectedRows || 0)
          if (affected === 0) break
          totalPurged += affected
        }
        if (adminActor) {
          await withUtf8Conn(appPool, async (conn) => {
            await conn.query(
              `INSERT INTO audit_logs (username, email, action_type, target_table, action_details, ip_address, user_agent)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                adminActor.username,
                adminActor.email,
                'DELETE',
                'audit_logs',
                `PDPA Maintenance: ล้างประวัติการใช้งานที่เก่ากว่า ${days} วัน จำนวน ${totalPurged} รายการ`,
                '127.0.0.1',
                'Web Admin Portal / PDPA Maintenance',
              ]
            )
          })
        }
      }

      return { success: true, data: { expiredCount, purgedCount: totalPurged } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })
}
