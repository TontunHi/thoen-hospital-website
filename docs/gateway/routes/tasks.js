/**
 * Tasks & Workflow Management Services (Fastify Gateway Plugin)
 * Endpoints for Task Inbox, Workflow Transitions, Repair Actions, and Audit Logs.
 * Decoupled from direct database access; 100% prepared statements.
 */
import crypto from 'crypto'

export default async function tasksRoutes(fastify, options) {
  const { pools } = options
  const { appPool } = pools

  // 1. Generate Next Task No by Thai Fiscal Year
  fastify.post('/api/v1/app/tasks/generate-no', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'สร้างเลขที่ใบงานตามปีงบประมาณไทย (Format: [PREFIX]-[YEAR]-[MONTH]-[RUNNING 4 DIGITS])',
      body: {
        type: 'object',
        required: ['ymPrefix'],
        properties: {
          ymPrefix: { type: 'string', description: 'คำนำหน้าและเดือน เช่น IT-2570-10-' }
        }
      }
    }
  }, async (req, reply) => {
    const { ymPrefix } = req.body || {}
    if (!ymPrefix) {
      reply.code(400); return { success: false, error: 'ymPrefix is required' }
    }
    try {
      const [rows] = await appPool.query(
        'SELECT COUNT(*) as cnt FROM inbox_tasks WHERE task_no LIKE ?',
        [`${ymPrefix}%`]
      )
      const count = (rows[0]?.cnt || 0) + 1
      const taskNo = `${ymPrefix}${String(count).padStart(4, '0')}`
      return { success: true, count, taskNo }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // 2. Fetch Full Task Details (Task, Steps, Repair Detail, Audit Logs in 1 atomic roundtrip)
  fastify.get('/api/v1/app/tasks/:id/full-details', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'ดึงข้อมูลใบงานครบวงจร (Task, Steps, Repair Detail, Audit Logs) ใน 1 คำขอ',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params
    try {
      const [tasks] = await appPool.query(
        `SELECT 
          t.id, t.task_no, t.task_type, t.title, t.description, t.urgency,
          t.requester_id, t.requester_name, t.requester_dept,
          t.status, t.current_step_no, t.current_assignee, t.\`current_role\`,
          t.reference_id, t.custom_payload, t.created_at, t.updated_at,
          req.signature_path as requester_signature_path
         FROM inbox_tasks t
         LEFT JOIN members req ON t.requester_id = req.id
         WHERE t.id = ? LIMIT 1`,
        [id]
      )

      if (!tasks || tasks.length === 0) {
        reply.code(404); return { success: false, error: 'ไม่พบข้อมูลงานนี้' }
      }
      const task = tasks[0]

      const [steps] = await appPool.query(
        `SELECT 
          s.id, s.step_no, s.step_name, s.assignee_type, s.assigned_to_id, s.assigned_role,
          s.status, s.action_taken, s.action_by, s.action_by_name, s.action_at,
          s.comment, s.signature_path, s.signature_hash,
          m.name as assigned_to_name, m.position as assigned_to_position
         FROM inbox_task_steps s
         LEFT JOIN members m ON s.assigned_to_id = m.id
         WHERE s.task_id = ?
         ORDER BY s.step_no ASC`,
        [id]
      )

      const [repairRows] = await appPool.query(
        'SELECT * FROM repair_details WHERE task_id = ? LIMIT 1',
        [id]
      )
      const repairDetail = repairRows.length > 0 ? repairRows[0] : null

      const [auditLogs] = await appPool.query(
        `SELECT 
          id, action, performed_by, performer_name, details, created_at
         FROM inbox_task_audit_logs
         WHERE task_id = ?
         ORDER BY created_at ASC`,
        [id]
      )

      return {
        success: true,
        data: {
          task,
          steps,
          repairDetail,
          auditLogs
        }
      }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // 3. Centralized Workflow Action (APPROVE, REJECT, SEND_BACK, HOLD, RESUME, COMPLETE)
  fastify.post('/api/v1/app/tasks/workflow-action', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'ดำเนินการเปลี่ยนสถานะขั้นตอน Workflow (APPROVE, REJECT, SEND_BACK, HOLD, RESUME, COMPLETE)',
      body: {
        type: 'object',
        required: ['taskId', 'action', 'actor'],
        properties: {
          taskId: { type: 'string' },
          action: { type: 'string', enum: ['APPROVE', 'REJECT', 'SEND_BACK', 'HOLD', 'RESUME', 'COMPLETE'] },
          comment: { type: 'string' },
          nextAssigneeId: { type: ['number', 'null'] },
          partialEdits: { type: 'object' },
          holdReason: { type: 'string' },
          holdDetails: { type: 'string' },
          targetStepNo: { type: ['number', 'null'] },
          signaturePath: { type: ['string', 'null'] },
          signatureHash: { type: ['string', 'null'] },
          actor: {
            type: 'object',
            required: ['id', 'username'],
            properties: {
              id: { type: 'number' },
              username: { type: 'string' },
              name: { type: ['string', 'null'] },
              position: { type: ['string', 'null'] },
              role: { type: ['string', 'null'] }
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    const {
      taskId,
      action,
      comment,
      nextAssigneeId,
      partialEdits,
      holdReason,
      holdDetails,
      targetStepNo,
      signaturePath,
      signatureHash,
      actor
    } = req.body || {}

    const conn = await appPool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('SET NAMES utf8mb4')

      // 1. Fetch current task & steps
      const [tasks] = await conn.query('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1 FOR UPDATE', [taskId])
      if (!tasks || tasks.length === 0) {
        await conn.rollback()
        reply.code(404); return { success: false, error: 'ไม่พบงานที่ระบุ' }
      }
      const task = tasks[0]

      const [steps] = await conn.query(
        'SELECT * FROM inbox_task_steps WHERE task_id = ? ORDER BY step_no ASC',
        [taskId]
      )
      const currentStep = steps.find(s => s.step_no === task.current_step_no)
      if (!currentStep) {
        await conn.rollback()
        reply.code(400); return { success: false, error: 'ไม่พบขั้นตอนงานปัจจุบัน' }
      }

      // 2. Partial edits if requested
      let existingPayload = {}
      try {
        existingPayload = task.custom_payload ? JSON.parse(task.custom_payload) : {}
      } catch {}

      if (partialEdits && typeof partialEdits === 'object' && Object.keys(partialEdits).length > 0) {
        const updatedPayload = { ...existingPayload, ...partialEdits }
        await conn.query(
          'UPDATE inbox_tasks SET custom_payload = ?, updated_at = NOW() WHERE id = ?',
          [JSON.stringify(updatedPayload), taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'PARTIAL_EDIT', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            actor.id,
            actor.name || actor.username,
            JSON.stringify({ changes: partialEdits, previous: existingPayload })
          ]
        )
        existingPayload = updatedPayload
      }

      const nowStr = new Date().toISOString()
      let resultMessage = ''
      let isFinalStep = false
      let nextStepObj = null

      if (action === 'HOLD') {
        const selectedReason = holdReason || comment || 'รอการจัดสรรงบ'
        const updatedPayload = {
          ...existingPayload,
          holdInfo: {
            reason: selectedReason,
            details: holdDetails?.trim() || null,
            heldAt: nowStr,
            heldById: actor.id,
            heldByName: actor.name || actor.username,
            heldByPosition: actor.position || null,
            previousStatus: task.status
          }
        }
        await conn.query(
          `UPDATE inbox_tasks SET status = 'ON_HOLD', custom_payload = ?, updated_at = NOW() WHERE id = ?`,
          [JSON.stringify(updatedPayload), taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'HOLD_TASK', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            actor.id,
            actor.name || actor.username,
            JSON.stringify({
              reason: selectedReason,
              details: holdDetails?.trim() || null,
              stepNo: currentStep.step_no,
              stepName: currentStep.step_name
            })
          ]
        )
        resultMessage = 'พักงานเรียบร้อยแล้ว'
      } else if (action === 'RESUME') {
        const holdInfo = existingPayload.holdInfo || {}
        const previousStatus = holdInfo.previousStatus || 'PENDING'
        const updatedPayload = {
          ...existingPayload,
          holdInfo: null,
          lastResumedAt: nowStr,
          lastResumedBy: actor.name || actor.username
        }
        await conn.query(
          `UPDATE inbox_tasks SET status = ?, custom_payload = ?, updated_at = NOW() WHERE id = ?`,
          [previousStatus, JSON.stringify(updatedPayload), taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'RESUME_TASK', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            actor.id,
            actor.name || actor.username,
            JSON.stringify({
              restoredStatus: previousStatus,
              stepNo: currentStep.step_no,
              stepName: currentStep.step_name
            })
          ]
        )
        resultMessage = 'ปลดพักงานและกลับมาดำเนินการต่อเรียบร้อยแล้ว'
      } else if (action === 'APPROVE') {
        await conn.query(
          `UPDATE inbox_task_steps 
           SET status = 'COMPLETED', action_taken = 'APPROVE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?, signature_path = ?, signature_hash = ?
           WHERE id = ?`,
          [
            actor.id,
            actor.name || actor.username,
            comment || 'อนุมัติเรียบร้อย',
            signaturePath || null,
            signatureHash || null,
            currentStep.id
          ]
        )

        const nextStep = steps.find(s => s.step_no === task.current_step_no + 1)
        if (nextStep) {
          const nextAssignee = nextAssigneeId || nextStep.assigned_to_id || null
          await conn.query(
            `UPDATE inbox_tasks 
             SET current_step_no = ?, current_assignee = ?, \`current_role\` = ?, status = 'PENDING', updated_at = NOW()
             WHERE id = ?`,
            [nextStep.step_no, nextAssignee, nextStep.assigned_role, taskId]
          )
          await conn.query(
            `UPDATE inbox_task_steps 
             SET status = 'PENDING', assigned_to_id = ?, action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL 
             WHERE id = ?`,
            [nextAssignee, nextStep.id]
          )
          nextStepObj = nextStep
          resultMessage = `อนุมัติขั้นตอนที่ ${currentStep.step_no} เรียบร้อยแล้ว ส่งต่อขั้นตอนถัดไป`
        } else {
          isFinalStep = true
          await conn.query(
            `UPDATE inbox_tasks 
             SET status = 'COMPLETED', updated_at = NOW(), completed_at = NOW()
             WHERE id = ?`,
            [taskId]
          )
          resultMessage = 'อนุมัติเสร็จสมบูรณ์ทุกขั้นตอนเรียบร้อยแล้ว'
        }

        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details, signature_hash)
           VALUES (?, ?, 'APPROVE_STEP', ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            actor.id,
            actor.name || actor.username,
            JSON.stringify({
              stepNo: currentStep.step_no,
              stepName: currentStep.step_name,
              comment: comment || 'อนุมัติเรียบร้อย',
              isFinalStep,
              nextStepNo: nextStepObj?.step_no || null
            }),
            signatureHash || null
          ]
        )
      } else if (action === 'REJECT') {
        await conn.query(
          `UPDATE inbox_task_steps 
           SET status = 'REJECTED', action_taken = 'REJECT', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?, signature_path = ?, signature_hash = ?
           WHERE id = ?`,
          [
            actor.id,
            actor.name || actor.username,
            comment || 'ปฏิเสธคำขอ',
            signaturePath || null,
            signatureHash || null,
            currentStep.id
          ]
        )
        await conn.query(
          `UPDATE inbox_tasks SET status = 'REJECTED', updated_at = NOW() WHERE id = ?`,
          [taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details, signature_hash)
           VALUES (?, ?, 'REJECT_STEP', ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            actor.id,
            actor.name || actor.username,
            JSON.stringify({
              stepNo: currentStep.step_no,
              stepName: currentStep.step_name,
              comment: comment || 'ปฏิเสธคำขอ'
            }),
            signatureHash || null
          ]
        )
        resultMessage = 'ปฏิเสธคำขอเรียบร้อยแล้ว'
      } else if (action === 'SEND_BACK') {
        const revertStepNo = targetStepNo || (currentStep.step_no > 1 ? currentStep.step_no - 1 : 1)
        const targetStep = steps.find(s => s.step_no === revertStepNo) || steps[0]

        await conn.query(
          `UPDATE inbox_task_steps 
           SET status = 'REJECTED', action_taken = 'SEND_BACK', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?, signature_path = ?, signature_hash = ?
           WHERE id = ?`,
          [
            actor.id,
            actor.name || actor.username,
            comment || 'ตีกลับแก้ไข',
            signaturePath || null,
            signatureHash || null,
            currentStep.id
          ]
        )
        await conn.query(
          `UPDATE inbox_tasks 
           SET current_step_no = ?, current_assignee = ?, \`current_role\` = ?, status = 'PENDING', updated_at = NOW()
           WHERE id = ?`,
          [targetStep.step_no, targetStep.assigned_to_id, targetStep.assigned_role, taskId]
        )
        await conn.query(
          `UPDATE inbox_task_steps 
           SET status = 'PENDING', action_taken = NULL, action_by = NULL, action_by_name = NULL, action_at = NULL, comment = NULL, signature_path = NULL, signature_hash = NULL 
           WHERE task_id = ? AND step_no >= ?`,
          [taskId, targetStep.step_no]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details, signature_hash)
           VALUES (?, ?, 'SEND_BACK_STEP', ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            actor.id,
            actor.name || actor.username,
            JSON.stringify({
              fromStepNo: currentStep.step_no,
              toStepNo: targetStep.step_no,
              comment: comment || 'ตีกลับแก้ไข'
            }),
            signatureHash || null
          ]
        )
        resultMessage = `ตีกลับงานไปยังขั้นตอนที่ ${targetStep.step_no} (${targetStep.step_name}) เรียบร้อยแล้ว`
      } else if (action === 'COMPLETE') {
        await conn.query(
          `UPDATE inbox_task_steps 
           SET status = 'COMPLETED', action_taken = 'COMPLETE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = ?
           WHERE id = ?`,
          [actor.id, actor.name || actor.username, comment || 'ปิดงานเสร็จสมบูรณ์', currentStep.id]
        )
        await conn.query(
          `UPDATE inbox_tasks 
           SET status = 'COMPLETED', updated_at = NOW(), completed_at = NOW()
           WHERE id = ?`,
          [taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'COMPLETE_TASK', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            actor.id,
            actor.name || actor.username,
            JSON.stringify({
              stepNo: currentStep.step_no,
              stepName: currentStep.step_name,
              comment: comment || 'ปิดงานเสร็จสมบูรณ์'
            })
          ]
        )
        isFinalStep = true
        resultMessage = 'ดำเนินการเสร็จสิ้นและส่งมอบงานเรียบร้อยแล้ว'
      }

      await conn.commit()
      return {
        success: true,
        message: resultMessage,
        isFinalStep,
        nextStep: nextStepObj
      }
    } catch (err) {
      await conn.rollback()
      reply.code(500); return { success: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // 4. Centralized Repair Action (ACCEPT_JOB, UPDATE_COWORKERS, SAVE_REPAIR_PROGRESS, COMPLETE_REPAIR, CANCEL_JOB)
  fastify.post('/api/v1/app/tasks/repair-action', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'ดำเนินการเกี่ยวกับงานซ่อม (ช่างรับงาน, อัปเดตช่างร่วม, บันทึกความคืบหน้า, ซ่อมเสร็จ, ยกเลิก)',
      body: {
        type: 'object',
        required: ['taskId', 'action', 'performer'],
        properties: {
          taskId: { type: 'string' },
          action: { type: 'string', enum: ['ACCEPT_JOB', 'UPDATE_COWORKERS', 'SAVE_REPAIR_PROGRESS', 'COMPLETE_REPAIR', 'CANCEL_JOB'] },
          performer: {
            type: 'object',
            required: ['id', 'username'],
            properties: {
              id: { type: 'number' },
              username: { type: 'string' },
              name: { type: ['string', 'null'] },
              position: { type: ['string', 'null'] },
              role: { type: ['string', 'null'] }
            }
          },
          payload: { type: 'object' }
        }
      }
    }
  }, async (req, reply) => {
    const { taskId, action, performer, payload = {} } = req.body || {}

    const conn = await appPool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('SET NAMES utf8mb4')

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
      const repairDetail = repairRows[0]

      let resultMessage = ''

      if (action === 'ACCEPT_JOB') {
        await conn.query(`UPDATE inbox_tasks SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ?`, [taskId])
        await conn.query(`UPDATE repair_details SET repair_status = 'IN_PROGRESS', updated_at = NOW() WHERE task_id = ?`, [taskId])
        await conn.query(`UPDATE inbox_task_steps SET status = 'IN_PROGRESS' WHERE task_id = ? AND step_no = 1`, [taskId])
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'ACCEPT_JOB', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            performer.id,
            performer.name || performer.username,
            JSON.stringify({ status: 'IN_PROGRESS', technician: performer.name || performer.username })
          ]
        )
        resultMessage = 'รับงานซ่อมเรียบร้อยแล้ว'
      } else if (action === 'UPDATE_COWORKERS') {
        const { newCoWorkers } = payload
        await conn.query(
          `UPDATE repair_details SET co_workers = ?, updated_at = NOW() WHERE task_id = ?`,
          [JSON.stringify(newCoWorkers || []), taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'UPDATE_COWORKERS', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            performer.id,
            performer.name || performer.username,
            JSON.stringify({ coWorkers: newCoWorkers })
          ]
        )
        resultMessage = 'อัปเดตรายชื่อช่างผู้ร่วมงานเรียบร้อยแล้ว'
      } else if (action === 'SAVE_REPAIR_PROGRESS') {
        const {
          repairNature,
          isExternalRepair,
          externalVendorName,
          externalReason,
          costType,
          costAmount,
          foundProblem,
          solutionStep
        } = payload

        await conn.query(
          `UPDATE repair_details SET 
            repair_nature = ?, is_external_repair = ?, external_vendor_name = ?, external_reason = ?,
            cost_type = ?, cost_amount = ?, found_problem = ?, solution_step = ?, updated_at = NOW()
           WHERE task_id = ?`,
          [
            repairNature || null,
            isExternalRepair ? 1 : 0,
            externalVendorName || null,
            externalReason || null,
            costType || null,
            costAmount !== undefined ? costAmount : null,
            foundProblem || null,
            solutionStep || null,
            taskId
          ]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'SAVE_REPAIR_PROGRESS', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            performer.id,
            performer.name || performer.username,
            JSON.stringify({
              repairNature,
              isExternalRepair,
              externalVendorName,
              costType,
              costAmount,
              foundProblem,
              solutionStep
            })
          ]
        )
        resultMessage = 'บันทึกข้อมูลความคืบหน้างานซ่อมเรียบร้อยแล้ว'
      } else if (action === 'COMPLETE_REPAIR') {
        const {
          repairNature,
          isExternalRepair,
          externalVendorName,
          externalReason,
          costType,
          costAmount,
          foundProblem,
          solutionStep
        } = payload

        await conn.query(
          `UPDATE repair_details SET 
            repair_status = 'COMPLETED', repair_nature = ?, is_external_repair = ?, external_vendor_name = ?, external_reason = ?,
            cost_type = ?, cost_amount = ?, found_problem = ?, solution_step = ?, completed_at = NOW(), updated_at = NOW()
           WHERE task_id = ?`,
          [
            repairNature || null,
            isExternalRepair ? 1 : 0,
            externalVendorName || null,
            externalReason || null,
            costType || null,
            costAmount !== undefined ? costAmount : null,
            foundProblem || null,
            solutionStep || null,
            taskId
          ]
        )
        await conn.query(
          `UPDATE inbox_tasks SET status = 'APPROVED', updated_at = NOW(), completed_at = NOW() WHERE id = ?`,
          [taskId]
        )
        await conn.query(
          `UPDATE inbox_task_steps SET status = 'COMPLETED', action_taken = 'COMPLETE', action_by = ?, action_by_name = ?, action_at = NOW() WHERE task_id = ? AND step_no = 1`,
          [performer.id, performer.name || performer.username, taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'COMPLETE_REPAIR', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            performer.id,
            performer.name || performer.username,
            JSON.stringify({
              status: 'COMPLETED',
              repairNature,
              isExternalRepair,
              costType,
              costAmount,
              foundProblem,
              solutionStep
            })
          ]
        )
        resultMessage = 'บันทึกปิดงานซ่อมเรียบร้อยแล้ว'
      } else if (action === 'CANCEL_JOB') {
        const reason = payload?.reason || 'ยกเลิกคำขอซ่อม'
        await conn.query(
          `UPDATE inbox_tasks SET status = 'REJECTED', updated_at = NOW() WHERE id = ?`,
          [taskId]
        )
        await conn.query(
          `UPDATE repair_details SET repair_status = 'CANCELLED', updated_at = NOW() WHERE task_id = ?`,
          [taskId]
        )
        await conn.query(
          `UPDATE inbox_task_steps SET status = 'REJECTED', action_taken = 'CANCEL', action_by = ?, action_by_name = ?, action_at = NOW() WHERE task_id = ? AND step_no = 1`,
          [performer.id, performer.name || performer.username, taskId]
        )
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'CANCEL_JOB', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            taskId,
            performer.id,
            performer.name || performer.username,
            JSON.stringify({ reason })
          ]
        )
        resultMessage = 'ยกเลิกงานซ่อมเรียบร้อยแล้ว'
      }

      await conn.commit()
      return { success: true, message: resultMessage }
    } catch (err) {
      await conn.rollback()
      reply.code(500); return { success: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // 5. Manager Edit Task Details with Diff Tracking
  fastify.put('/api/v1/app/tasks/:id/manager-edit', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'แก้ไขข้อมูลงานโดยหัวหน้างานหรือผู้ดูแลระบบ (พร้อมบันทึก Audit Diff)',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } }
      },
      body: {
        type: 'object',
        required: ['performer', 'taskUpdates'],
        properties: {
          performer: {
            type: 'object',
            required: ['id', 'username'],
            properties: {
              id: { type: 'number' },
              username: { type: 'string' },
              name: { type: ['string', 'null'] }
            }
          },
          taskUpdates: { type: 'object' },
          repairUpdates: { type: 'object' },
          diffDetails: { type: 'object' }
        }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params
    const { performer, taskUpdates, repairUpdates, diffDetails } = req.body || {}

    const conn = await appPool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('SET NAMES utf8mb4')

      if (taskUpdates && Object.keys(taskUpdates).length > 0) {
        const setClauses = []
        const params = []
        for (const [k, v] of Object.entries(taskUpdates)) {
          setClauses.push(`\`${k}\` = ?`)
          params.push(v)
        }
        setClauses.push('updated_at = NOW()')
        params.push(id)
        await conn.query(`UPDATE inbox_tasks SET ${setClauses.join(', ')} WHERE id = ?`, params)
      }

      if (repairUpdates && Object.keys(repairUpdates).length > 0) {
        const setClauses = []
        const params = []
        for (const [k, v] of Object.entries(repairUpdates)) {
          setClauses.push(`\`${k}\` = ?`)
          params.push(v)
        }
        setClauses.push('updated_at = NOW()')
        params.push(id)
        await conn.query(`UPDATE repair_details SET ${setClauses.join(', ')} WHERE task_id = ?`, params)
      }

      if (diffDetails && Object.keys(diffDetails).length > 0) {
        await conn.query(
          `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
           VALUES (?, ?, 'MANAGER_EDIT_TASK', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            id,
            performer.id,
            performer.name || performer.username,
            JSON.stringify(diffDetails)
          ]
        )
      }

      await conn.commit()
      return { success: true, message: 'แก้ไขข้อมูลใบงานเรียบร้อยแล้ว' }
    } catch (err) {
      await conn.rollback()
      reply.code(500); return { success: false, error: err.message }
    } finally {
      conn.release()
    }
  })
}
