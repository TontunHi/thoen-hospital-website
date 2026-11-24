/**
 * Phase 4A: Task Inbox Auxiliary Routes (Audit Log, Manager Edit, Telegram Notification Targets)
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

export default async function appTasksV2Routes(fastify, opts) {
  const appPool = opts.appPool || opts.pools?.appPool

  fastify.post('/api/v1/app/v2/inbox/audit-log', async (req, reply) => {
    try {
      const { id, taskId, action, performedBy, performerName, details } = req.body || {}
      const auditId = id || crypto.randomUUID()
      const detailsStr = typeof details === 'string' ? details : JSON.stringify(details ?? {})
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [auditId, taskId, action, performedBy, performerName, detailsStr]
        )
      })
      return { success: true, data: { id: auditId } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/inbox/task-bundle/:taskId', async (req, reply) => {
    try {
      const taskId = String(req.params?.taskId || '').trim()
      const [[tasks], [repairs], [steps]] = await Promise.all([
        appPool.query('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1', [taskId]),
        appPool.query('SELECT * FROM repair_details WHERE task_id = ? LIMIT 1', [taskId]),
        appPool.query('SELECT * FROM inbox_task_steps WHERE task_id = ? ORDER BY step_no ASC', [taskId]),
      ])
      return {
        success: true,
        data: {
          task: tasks?.[0] ?? null,
          repairDetail: repairs?.[0] ?? null,
          steps: steps || [],
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/inbox/manager-edit/:taskId', async (req, reply) => {
    try {
      const taskId = String(req.params?.taskId || '').trim()
      const { taskUpdates = {}, repairUpdates = null, stepSync = null, auditEntry = null } = req.body || {}

      await withUtf8Tx(appPool, async (conn) => {
        if (stepSync && stepSync.mode === 'HAS_COST' && Array.isArray(stepSync.targetSteps)) {
          for (const s of stepSync.targetSteps) {
            if (s.stepNo > 2) {
              const [stepRows] = await conn.query(
                'SELECT id, status FROM inbox_task_steps WHERE task_id = ? AND step_no = ? LIMIT 1',
                [taskId, s.stepNo]
              )
              if (!stepRows || stepRows.length === 0) {
                await conn.query(
                  `INSERT INTO inbox_task_steps (id, task_id, step_no, step_name, assignee_type, assigned_role, status)
                   VALUES (?, ?, ?, ?, 'ROLE', ?, 'WAITING')`,
                  [crypto.randomUUID(), taskId, s.stepNo, s.stepName, s.assignedRole]
                )
              } else if (stepRows[0].status === 'WAITING' || stepRows[0].status === 'PENDING') {
                await conn.query(
                  'UPDATE inbox_task_steps SET step_name = ?, assigned_role = ? WHERE id = ?',
                  [s.stepName, s.assignedRole, stepRows[0].id]
                )
              }
            }
          }
          await conn.query(
            `DELETE FROM inbox_task_steps WHERE task_id = ? AND step_no > ? AND status IN ('PENDING', 'WAITING')`,
            [taskId, stepSync.targetSteps.length]
          )
        } else if (stepSync && stepSync.mode === 'NO_COST' && Array.isArray(stepSync.targetSteps)) {
          await conn.query(
            `DELETE FROM inbox_task_steps WHERE task_id = ? AND step_no > 4 AND status IN ('PENDING', 'WAITING')`,
            [taskId]
          )
          for (const s of stepSync.targetSteps) {
            if (s.stepNo > 2) {
              const [stepRows] = await conn.query(
                'SELECT id, status FROM inbox_task_steps WHERE task_id = ? AND step_no = ? LIMIT 1',
                [taskId, s.stepNo]
              )
              if (stepRows && stepRows.length > 0 && (stepRows[0].status === 'WAITING' || stepRows[0].status === 'PENDING')) {
                await conn.query(
                  'UPDATE inbox_task_steps SET step_name = ?, assigned_role = ? WHERE id = ?',
                  [s.stepName, s.assignedRole, stepRows[0].id]
                )
              }
            }
          }
        }

        if (repairUpdates) {
          await conn.query(
            `UPDATE repair_details SET
              item_category = ?, equipment_number = ?, equipment_name = ?,
              non_equipment_item = ?, location_id = ?, location_full_name = ?,
              symptom_detail = ?, updated_at = NOW()
             WHERE task_id = ?`,
            [
              repairUpdates.itemCategory,
              repairUpdates.equipmentNumber,
              repairUpdates.equipmentName,
              repairUpdates.nonEquipmentItem,
              repairUpdates.locationId,
              repairUpdates.locationFullName,
              repairUpdates.symptomDetail,
              taskId,
            ]
          )
        }

        const updateSets = ['updated_at = NOW()']
        const updateParams = []
        if (taskUpdates.title) { updateSets.push('title = ?'); updateParams.push(taskUpdates.title) }
        if (taskUpdates.description !== undefined) { updateSets.push('description = ?'); updateParams.push(taskUpdates.description) }
        if (taskUpdates.urgency) { updateSets.push('urgency = ?'); updateParams.push(taskUpdates.urgency) }
        if (taskUpdates.custom_payload) { updateSets.push('custom_payload = ?'); updateParams.push(taskUpdates.custom_payload) }
        updateParams.push(taskId)
        await conn.query(`UPDATE inbox_tasks SET ${updateSets.join(', ')} WHERE id = ?`, updateParams)

        if (auditEntry) {
          await conn.query(
            `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
             VALUES (?, ?, 'MANAGER_EDIT_TASK', ?, ?, ?)`,
            [
              crypto.randomUUID(),
              taskId,
              auditEntry.performedBy,
              auditEntry.performerName,
              typeof auditEntry.details === 'string' ? auditEntry.details : JSON.stringify(auditEntry.details ?? {}),
            ]
          )
        }
      })

      return { success: true, data: { updated: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/inbox/telegram-targets', async (req, reply) => {
    try {
      const { memberId, username, prRole, rolePattern } = req.query || {}
      let rows = []
      if (memberId) {
        const [r] = await appPool.query(
          'SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1',
          [Number(memberId)]
        )
        rows = r || []
      } else if (username) {
        const [r] = await appPool.query(
          `SELECT l.telegram_chat_id FROM member_telegram_links l
           JOIN members m ON l.member_id = m.id WHERE m.username = ? LIMIT 1`,
          [String(username)]
        )
        rows = r || []
      } else if (prRole === 'true') {
        const [r] = await appPool.query(
          `SELECT DISTINCT l.telegram_chat_id FROM member_telegram_links l
           JOIN members m ON l.member_id = m.id
           WHERE (m.position LIKE '%ประชาสัมพันธ์%' OR m.department LIKE '%ประชาสัมพันธ์%' OR m.role = 'pr')`
        )
        rows = r || []
      } else if (rolePattern) {
        const p = `%${String(rolePattern)}%`
        const [r] = await appPool.query(
          `SELECT l.telegram_chat_id FROM member_telegram_links l
           JOIN members m ON l.member_id = m.id
           WHERE (m.position LIKE ? OR m.department LIKE ?)`,
          [p, p]
        )
        rows = r || []
      }
      const chatIds = Array.from(new Set(rows.map((r) => r.telegram_chat_id).filter(Boolean)))
      return { success: true, data: { chatIds } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })
}
