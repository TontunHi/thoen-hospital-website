/**
 * Phase 4C: KPI Audit/Export, Project Tracker, Ethics CMS, Departments & Internal Phones Routes
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

function getCurrentThaiFiscalYear() {
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return bkk.getUTCMonth() + 1 >= 10 ? bkk.getUTCFullYear() + 544 : bkk.getUTCFullYear() + 543
}

const PROJECT_SELECT_SQL = `
  SELECT
    id, fiscal_year AS fiscalYear, sequence_no AS sequenceNo, project_code AS projectCode,
    strategy, project_name AS projectName, responsible_unit AS responsibleUnit,
    q1_budget AS q1Budget, q2_budget AS q2Budget, q3_budget AS q3Budget, q4_budget AS q4Budget,
    actual_spent AS actualSpent, submission_status AS submissionStatus, budget_source AS budgetSource,
    notes, created_by AS createdBy, updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
  FROM project_tracking_records
`

const PROJECT_FIELD_TO_COL = {
  fiscalYear: 'fiscal_year',
  sequenceNo: 'sequence_no',
  projectCode: 'project_code',
  strategy: 'strategy',
  projectName: 'project_name',
  responsibleUnit: 'responsible_unit',
  q1Budget: 'q1_budget',
  q2Budget: 'q2_budget',
  q3Budget: 'q3_budget',
  q4Budget: 'q4_budget',
  actualSpent: 'actual_spent',
  submissionStatus: 'submission_status',
  budgetSource: 'budget_source',
  notes: 'notes',
}

const PHONE_SELECT_SQL = `
  SELECT id, building, floor, room, phone, note,
         display_order AS displayOrder, is_active AS isActive,
         created_by AS createdBy, updated_by AS updatedBy,
         created_at AS createdAt, updated_at AS updatedAt
  FROM hospital_internal_phones
`

export default async function appOpsCmsDirV2Routes(fastify, opts) {
  const appPool = opts.appPool || opts.pools?.appPool
  let projectsEnsured = false
  let rolesEnsured = false

  async function ensureProjectTables() {
    if (projectsEnsured) return
    await withUtf8Conn(appPool, async (conn) => {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS project_tracking_records (
          id INT NOT NULL AUTO_INCREMENT,
          fiscal_year INT NOT NULL,
          sequence_no INT NOT NULL DEFAULT 1,
          project_code VARCHAR(50) NULL,
          strategy VARCHAR(50) NOT NULL,
          project_name VARCHAR(500) NOT NULL,
          responsible_unit VARCHAR(255) NULL,
          q1_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
          q2_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
          q3_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
          q4_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
          actual_spent DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
          submission_status VARCHAR(50) NOT NULL DEFAULT 'ยังไม่ส่ง',
          budget_source VARCHAR(50) NOT NULL DEFAULT 'เงินบำรุง',
          notes TEXT NULL,
          created_by VARCHAR(100) NULL,
          updated_by VARCHAR(100) NULL,
          created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
          updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
          PRIMARY KEY (id),
          INDEX idx_pt_fiscal_year (fiscal_year),
          INDEX idx_pt_strategy (strategy),
          INDEX idx_pt_status (submission_status),
          INDEX idx_pt_seq (fiscal_year, sequence_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS project_tracking_meta (
          meta_key VARCHAR(100) NOT NULL,
          meta_value VARCHAR(255) NOT NULL,
          updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
          PRIMARY KEY (meta_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    })
    projectsEnsured = true
  }

  async function ensureDeptRolesTable() {
    if (rolesEnsured) return
    try {
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS department_roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            order_index INT NOT NULL DEFAULT 0,
            is_default TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_dept_role_order (order_index)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        const [cnt] = await conn.query('SELECT COUNT(*) AS count FROM department_roles')
        if (Number(cnt?.[0]?.count || 0) === 0) {
          await conn.query(`
            INSERT INTO department_roles (name, order_index, is_default)
            VALUES
              ('หัวหน้ากลุ่มงาน / หัวหน้างาน', 0, 0),
              ('รองหัวหน้ากลุ่มงาน / รองหัวหน้างาน', 1, 0),
              ('เจ้าหน้าที่ผู้ปฏิบัติงาน', 2, 1)
          `)
        }
      })
      rolesEnsured = true
    } catch {}
  }

  // =========================================================================
  // 1. KPI AUDITS & TOPIC LOOKUP V2
  // =========================================================================

  fastify.post('/api/v1/app/v2/kpi/audits/ensure-table', async (_req, reply) => {
    try {
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS kpi_ai_audits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            indicator_id INT NOT NULL,
            fiscal_year VARCHAR(10) NOT NULL,
            period_key VARCHAR(50) NOT NULL,
            rule_code VARCHAR(50) NOT NULL,
            status VARCHAR(30) NOT NULL,
            human_numerator DECIMAL(14,4) NULL,
            human_denominator DECIMAL(14,4) NULL,
            human_result DECIMAL(14,4) NULL,
            ai_numerator DECIMAL(14,4) NULL,
            ai_denominator DECIMAL(14,4) NULL,
            ai_result DECIMAL(14,4) NULL,
            diff_numerator DECIMAL(14,4) NULL,
            diff_denominator DECIMAL(14,4) NULL,
            diff_result DECIMAL(14,4) NULL,
            thip_manual_ref VARCHAR(255) NULL,
            explanation_th TEXT NULL,
            diagnostics_json LONGTEXT NULL,
            audited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_kpi_ai_audit_ind_fy_period (indicator_id, fiscal_year, period_key),
            INDEX idx_kpi_ai_audit_fy_period_status (fiscal_year, period_key, status),
            CONSTRAINT fk_kpi_ai_audit_indicator FOREIGN KEY (indicator_id) REFERENCES kpi_indicators(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
      })
      return { success: true, data: { ensured: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/kpi/audits/upsert-batch', async (req, reply) => {
    try {
      const { fiscalYear, periodKey, auditedAtSql = null, items = [] } = req.body || {}
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS kpi_ai_audits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            indicator_id INT NOT NULL,
            fiscal_year VARCHAR(10) NOT NULL,
            period_key VARCHAR(50) NOT NULL,
            rule_code VARCHAR(50) NOT NULL,
            status VARCHAR(30) NOT NULL,
            human_numerator DECIMAL(14,4) NULL,
            human_denominator DECIMAL(14,4) NULL,
            human_result DECIMAL(14,4) NULL,
            ai_numerator DECIMAL(14,4) NULL,
            ai_denominator DECIMAL(14,4) NULL,
            ai_result DECIMAL(14,4) NULL,
            diff_numerator DECIMAL(14,4) NULL,
            diff_denominator DECIMAL(14,4) NULL,
            diff_result DECIMAL(14,4) NULL,
            thip_manual_ref VARCHAR(255) NULL,
            explanation_th TEXT NULL,
            diagnostics_json LONGTEXT NULL,
            audited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_kpi_ai_audit_ind_fy_period (indicator_id, fiscal_year, period_key),
            INDEX idx_kpi_ai_audit_fy_period_status (fiscal_year, period_key, status),
            CONSTRAINT fk_kpi_ai_audit_indicator FOREIGN KEY (indicator_id) REFERENCES kpi_indicators(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
      })
      if (!items.length) return { success: true, data: { savedCount: 0, skippedCount: 0 } }
      const ph = items.map(() => '?').join(',')
      const [validRows] = await appPool.query(`SELECT id FROM kpi_indicators WHERE id IN (${ph})`, items.map((i) => i.indicatorId))
      const validIds = new Set((validRows || []).map((r) => Number(r.id)))

      let savedCount = 0
      let skippedCount = 0
      await withUtf8Tx(appPool, async (conn) => {
        for (const item of items) {
          if (!validIds.has(Number(item.indicatorId))) { skippedCount += 1; continue }
          await conn.query(
            `INSERT INTO kpi_ai_audits (
              indicator_id, fiscal_year, period_key, rule_code, status,
              human_numerator, human_denominator, human_result,
              ai_numerator, ai_denominator, ai_result,
              diff_numerator, diff_denominator, diff_result,
              thip_manual_ref, explanation_th, diagnostics_json, audited_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))
            ON DUPLICATE KEY UPDATE
              rule_code = VALUES(rule_code), status = VALUES(status),
              human_numerator = VALUES(human_numerator), human_denominator = VALUES(human_denominator), human_result = VALUES(human_result),
              ai_numerator = VALUES(ai_numerator), ai_denominator = VALUES(ai_denominator), ai_result = VALUES(ai_result),
              diff_numerator = VALUES(diff_numerator), diff_denominator = VALUES(diff_denominator), diff_result = VALUES(diff_result),
              thip_manual_ref = VALUES(thip_manual_ref), explanation_th = VALUES(explanation_th),
              diagnostics_json = VALUES(diagnostics_json), audited_at = VALUES(audited_at)`,
            [
              item.indicatorId, fiscalYear, periodKey, item.ruleCode, item.status,
              item.humanNumerator ?? null, item.humanDenominator ?? null, item.humanResult ?? null,
              item.aiNumerator ?? null, item.aiDenominator ?? null, item.aiResult ?? null,
              item.diffNumerator ?? null, item.diffDenominator ?? null, item.diffResult ?? null,
              item.thipManualRef ?? null, item.explanationTh ?? null, item.diagJson ?? null, auditedAtSql,
            ]
          )
          savedCount += 1
        }
      })
      return { success: true, data: { savedCount, skippedCount } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/kpi/audits', async (req, reply) => {
    try {
      const rawTopicId = req.query?.topicId
      const { fiscalYear, periodKey } = req.query || {}
      let sql = `
        SELECT a.id, a.indicator_id AS indicatorId, a.fiscal_year AS fiscalYear, a.period_key AS periodKey,
               a.rule_code AS ruleCode, a.status,
               a.human_numerator AS humanNumerator, a.human_denominator AS humanDenominator, a.human_result AS humanResult,
               a.ai_numerator AS aiNumerator, a.ai_denominator AS aiDenominator, a.ai_result AS aiResult,
               a.diff_numerator AS diffNumerator, a.diff_denominator AS diffDenominator, a.diff_result AS diffResult,
               a.thip_manual_ref AS thipManualRef, a.explanation_th AS explanationTh, a.diagnostics_json AS diagnosticsJson,
               a.audited_at AS auditedAt, a.updated_at AS updatedAt
        FROM kpi_ai_audits a JOIN kpi_indicators i ON i.id = a.indicator_id
        WHERE 1=1
      `
      const params = []
      if (rawTopicId !== undefined && rawTopicId !== '') {
        const topicId = Number(rawTopicId)
        if (!Number.isFinite(topicId) || topicId <= 0) {
          return reply.code(400).send({ success: false, error: 'Invalid topicId' })
        }
        sql += ' AND i.topic_id = ?'
        params.push(topicId)
      }
      if (fiscalYear) { sql += ' AND a.fiscal_year = ?'; params.push(fiscalYear) }
      if (periodKey) { sql += ' AND a.period_key = ?'; params.push(periodKey) }
      sql += ' ORDER BY a.indicator_id ASC, a.period_key ASC'
      try {
        const [rows] = await appPool.query(sql, params)
        return { success: true, data: rows || [] }
      } catch (innerErr) {
        if (/doesn't exist|ER_NO_SUCH_TABLE|Unknown table/i.test(String(innerErr?.message || ''))) {
          return { success: true, data: [] }
        }
        throw innerErr
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/kpi/topics/:topicId', async (req, reply) => {
    try {
      const [rows] = await appPool.query(
        'SELECT id, fiscal_year AS fiscalYear, code, title, description FROM kpi_topics WHERE id = ? LIMIT 1',
        [Number(req.params.topicId)]
      )
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 2. PROJECT TRACKER V2
  // =========================================================================

  fastify.post('/api/v1/app/v2/projects/ensure-schema', async (_req, reply) => {
    try {
      await ensureProjectTables()
      return { success: true, data: { ensured: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/projects/bundle', async (req, reply) => {
    try {
      await ensureProjectTables()
      const rawFy = req.query?.fiscalYear
      const explicitFy = rawFy !== undefined && rawFy !== '' ? Number(rawFy) : undefined
      let targetFiscalYear
      let fyRows
      let allYearRows
      if (explicitFy !== undefined && Number.isFinite(explicitFy)) {
        targetFiscalYear = explicitFy
        const [[f], [r]] = await Promise.all([
          appPool.query('SELECT DISTINCT fiscal_year AS fiscalYear FROM project_tracking_records ORDER BY fiscal_year DESC'),
          appPool.query(`${PROJECT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY sequence_no ASC, id ASC`, [targetFiscalYear]),
        ])
        fyRows = f; allYearRows = r
      } else {
        const [f] = await appPool.query('SELECT DISTINCT fiscal_year AS fiscalYear FROM project_tracking_records ORDER BY fiscal_year DESC')
        fyRows = f
        const years = (fyRows || []).map((x) => Number(x.fiscalYear)).filter((n) => Number.isInteger(n))
        targetFiscalYear = years.length > 0 ? Math.max(...years) : getCurrentThaiFiscalYear()
        const [r] = await appPool.query(`${PROJECT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY sequence_no ASC, id ASC`, [targetFiscalYear])
        allYearRows = r
      }
      return { success: true, data: { targetFiscalYear, fyRows: fyRows || [], allYearRows: allYearRows || [] } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/projects', async (req, reply) => {
    try {
      await ensureProjectTables()
      const { fields = {}, actorKey = null } = req.body || {}
      let seq = fields.sequenceNo
      if (!seq || !Number.isInteger(seq) || seq <= 0) {
        const [maxRows] = await appPool.query('SELECT MAX(sequence_no) AS maxSeq FROM project_tracking_records WHERE fiscal_year = ?', [fields.fiscalYear])
        seq = Number(maxRows?.[0]?.maxSeq ?? 0) + 1
      }
      const cols = []
      const phs = []
      const params = []
      for (const [k, col] of Object.entries(PROJECT_FIELD_TO_COL)) {
        cols.push(col); phs.push('?')
        params.push(k === 'sequenceNo' ? seq : (fields[k] ?? null))
      }
      cols.push('created_by', 'updated_by'); phs.push('?', '?'); params.push(actorKey, actorKey)
      const created = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(`INSERT INTO project_tracking_records (${cols.join(', ')}) VALUES (${phs.join(', ')})`, params)
        const [rows] = await conn.query(`${PROJECT_SELECT_SQL} WHERE id = ? LIMIT 1`, [res.insertId])
        return rows?.[0] ?? null
      })
      return { success: true, data: created }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/projects/:id', async (req, reply) => {
    try {
      await ensureProjectTables()
      const id = Number(req.params.id)
      const [existingRows] = await appPool.query(`${PROJECT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลโครงการที่ระบุ' })
      const { fields = {}, actorKey = null } = req.body || {}
      const sets = []
      const params = []
      for (const [k, col] of Object.entries(PROJECT_FIELD_TO_COL)) {
        if (fields[k] !== undefined) { sets.push(`${col} = ?`); params.push(fields[k]) }
      }
      if (sets.length === 0) return { success: true, data: existingRows[0] }
      sets.push('updated_by = ?'); params.push(actorKey, id)
      const updated = await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`UPDATE project_tracking_records SET ${sets.join(', ')} WHERE id = ?`, params)
        const [rows] = await conn.query(`${PROJECT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
        return rows?.[0] ?? null
      })
      return { success: true, data: updated }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/projects/:id', async (req, reply) => {
    try {
      await ensureProjectTables()
      const id = Number(req.params.id)
      const [existingRows] = await appPool.query(`${PROJECT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลโครงการที่ระบุ' })
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query('DELETE FROM project_tracking_records WHERE id = ?', [id])
      })
      return { success: true, data: existingRows[0] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/projects/batch-import', async (req, reply) => {
    try {
      await ensureProjectTables()
      const { fiscalYear, rows = [], mode = 'append', actorKey = null } = req.body || {}
      let nextSeq = 1
      if (mode !== 'replace') {
        const [maxRows] = await appPool.query('SELECT MAX(sequence_no) AS maxSeq FROM project_tracking_records WHERE fiscal_year = ?', [fiscalYear])
        nextSeq = Number(maxRows?.[0]?.maxSeq ?? 0) + 1
      }
      const deletedCount = await withUtf8Tx(appPool, async (conn) => {
        let del = 0
        if (mode === 'replace') {
          const [dRes] = await conn.query('DELETE FROM project_tracking_records WHERE fiscal_year = ?', [fiscalYear])
          del = Number(dRes?.affectedRows || 0)
        }
        const CHUNK = 100
        const tuple = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK)
          const tuples = []
          const params = []
          for (const row of chunk) {
            const seq = row.sequenceNo && Number.isInteger(row.sequenceNo) && row.sequenceNo > 0 ? row.sequenceNo : nextSeq
            nextSeq = Math.max(nextSeq, seq) + 1
            tuples.push(tuple)
            params.push(
              fiscalYear, seq, row.projectCode ?? null, row.strategy, row.projectName, row.responsibleUnit ?? null,
              row.q1Budget, row.q2Budget, row.q3Budget, row.q4Budget, row.actualSpent,
              row.submissionStatus, row.budgetSource, row.notes ?? null, actorKey, actorKey
            )
          }
          await conn.query(
            `INSERT INTO project_tracking_records (
              fiscal_year, sequence_no, project_code, strategy, project_name, responsible_unit,
              q1_budget, q2_budget, q3_budget, q4_budget, actual_spent,
              submission_status, budget_source, notes, created_by, updated_by
            ) VALUES ${tuples.join(', ')}`,
            params
          )
        }
        return del
      })
      return { success: true, data: { inserted: rows.length, deletedCount, fiscalYear } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 3. ETHICS CMS V2
  // =========================================================================

  fastify.get('/api/v1/app/v2/ethics/tree-raw', async (req, reply) => {
    try {
      const activeOnly = req.query?.activeOnly === 'true'
      const ySql = activeOnly
        ? 'SELECT id, year, display_order AS displayOrder, is_active AS isActive FROM ethics_years WHERE is_active = 1 ORDER BY year DESC, display_order DESC'
        : 'SELECT id, year, display_order AS displayOrder, is_active AS isActive FROM ethics_years ORDER BY display_order ASC, year DESC'
      const dSql = activeOnly
        ? 'SELECT id, year_id AS yearId, parent_id AS parentId, title, file_path AS filePath, file_size AS fileSize, display_order AS displayOrder, is_active AS isActive FROM ethics_documents WHERE is_active = 1 ORDER BY display_order ASC, id ASC'
        : 'SELECT id, year_id AS yearId, parent_id AS parentId, title, file_path AS filePath, file_size AS fileSize, display_order AS displayOrder, is_active AS isActive FROM ethics_documents ORDER BY display_order ASC, id ASC'
      const [[years], [documents]] = await Promise.all([appPool.query(ySql), appPool.query(dSql)])
      return { success: true, data: { years: years || [], documents: documents || [] } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/ethics/years/:id', async (req, reply) => {
    try {
      const [rows] = await appPool.query('SELECT id, year FROM ethics_years WHERE id = ? LIMIT 1', [Number(req.params.id)])
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/ethics/years', async (req, reply) => {
    try {
      const { year, displayOrder = 0, isActive = true } = req.body || {}
      const [dup] = await appPool.query('SELECT id FROM ethics_years WHERE year = ? LIMIT 1', [year])
      if (dup.length > 0) return reply.code(400).send({ success: false, error: `ปีงบประมาณ ${year} มีอยู่ในระบบแล้ว` })
      const id = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query('INSERT INTO ethics_years (year, display_order, is_active, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [year, displayOrder, isActive ? 1 : 0])
        return res.insertId
      })
      return { success: true, data: { id } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.put('/api/v1/app/v2/ethics/years/:id', async (req, reply) => {
    try {
      const { year, displayOrder = 0, isActive = true } = req.body || {}
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query('UPDATE ethics_years SET year = ?, display_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?', [year, displayOrder, isActive ? 1 : 0, Number(req.params.id)])
      })
      return { success: true, data: { updated: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/ethics/years/:id', async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const [rows] = await appPool.query('SELECT id, year FROM ethics_years WHERE id = ? LIMIT 1', [id])
      if (!rows.length) return reply.code(404).send({ success: false, error: 'ไม่พบปีงบประมาณที่ต้องการลบ' })
      const [docs] = await appPool.query('SELECT file_path AS filePath FROM ethics_documents WHERE year_id = ?', [id])
      await withUtf8Tx(appPool, async (conn) => {
        await conn.query('DELETE FROM ethics_documents WHERE year_id = ?', [id])
        await conn.query('DELETE FROM ethics_years WHERE id = ?', [id])
      })
      return { success: true, data: { year: rows[0].year, filePaths: (docs || []).map((d) => d.filePath).filter(Boolean) } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/ethics/documents/:id', async (req, reply) => {
    try {
      const [rows] = await appPool.query(
        `SELECT d.id, d.title, d.file_path AS filePath, d.file_size AS fileSize, d.display_order AS displayOrder, d.is_active AS isActive, y.year
         FROM ethics_documents d JOIN ethics_years y ON d.year_id = y.id WHERE d.id = ? LIMIT 1`,
        [Number(req.params.id)]
      )
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/ethics/documents', async (req, reply) => {
    try {
      const d = req.body || {}
      const id = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO ethics_documents (year_id, parent_id, title, file_path, file_size, display_order, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [d.yearId, d.parentId || null, d.title, d.filePath || null, d.fileSize ?? null, d.displayOrder ?? 0, d.isActive ? 1 : 0]
        )
        return res.insertId
      })
      return { success: true, data: { id } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.put('/api/v1/app/v2/ethics/documents/:id', async (req, reply) => {
    try {
      const d = req.body || {}
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(
          `UPDATE ethics_documents SET title = ?, display_order = ?, is_active = ?, file_path = ?, file_size = ?, updated_at = NOW() WHERE id = ?`,
          [d.title, d.displayOrder, d.isActive ? 1 : 0, d.filePath || null, d.fileSize ?? null, Number(req.params.id)]
        )
      })
      return { success: true, data: { updated: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/ethics/documents/:id', async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const [rows] = await appPool.query('SELECT id, title, file_path AS filePath FROM ethics_documents WHERE id = ? LIMIT 1', [id])
      if (!rows.length) return reply.code(404).send({ success: false, error: 'ไม่พบเอกสารที่ต้องการลบ' })
      const [children] = await appPool.query('SELECT id, file_path AS filePath FROM ethics_documents WHERE parent_id = ?', [id])
      await withUtf8Tx(appPool, async (conn) => {
        await conn.query('DELETE FROM ethics_documents WHERE parent_id = ?', [id])
        await conn.query('DELETE FROM ethics_documents WHERE id = ?', [id])
      })
      const filePaths = [...(children || []).map((c) => c.filePath), rows[0].filePath].filter(Boolean)
      return { success: true, data: { title: rows[0].title, filePaths } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 4. DEPARTMENTS & ORG CHART V2
  // =========================================================================

  fastify.get('/api/v1/app/v2/departments/groups', async (req, reply) => {
    try {
      const activeOnly = req.query?.activeOnly === 'true'
      const [rows] = await appPool.query(
        `SELECT id, name, parent_id, order_index, is_active FROM department_groups ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY order_index ASC, id ASC`
      )
      return { success: true, data: rows || [] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/departments/groups/:id', async (req, reply) => {
    try {
      const [rows] = await appPool.query('SELECT id, name, parent_id, order_index, is_active FROM department_groups WHERE id = ? LIMIT 1', [Number(req.params.id)])
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/departments/groups', async (req, reply) => {
    try {
      const { name, parentId = null, orderIndex = 0 } = req.body || {}
      const id = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query('INSERT INTO department_groups (name, parent_id, order_index, is_active) VALUES (?, ?, ?, 1)', [name, parentId, orderIndex])
        return res.insertId
      })
      return { success: true, data: { id } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/departments/groups/:id', async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const d = req.body || {}
      const sets = []
      const params = []
      if (d.name !== undefined) { sets.push('name = ?'); params.push(d.name) }
      if (d.parentId !== undefined) { sets.push('parent_id = ?'); params.push(d.parentId) }
      if (d.orderIndex !== undefined) { sets.push('order_index = ?'); params.push(d.orderIndex) }
      if (d.isActive !== undefined) { sets.push('is_active = ?'); params.push(d.isActive ? 1 : 0) }
      if (sets.length > 0) {
        params.push(id)
        await withUtf8Conn(appPool, async (conn) => {
          await conn.query(`UPDATE department_groups SET ${sets.join(', ')} WHERE id = ?`, params)
        })
      }
      return { success: true, data: { updated: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/departments/groups/reorder', async (req, reply) => {
    try {
      const ids = req.body?.groupIds || []
      if (ids.length > 0) {
        const cases = ids.map(() => 'WHEN ? THEN ?').join(' ')
        const caseParams = ids.flatMap((id, idx) => [id, idx])
        const ph = ids.map(() => '?').join(', ')
        await appPool.query(`UPDATE department_groups SET order_index = CASE id ${cases} ELSE order_index END WHERE id IN (${ph})`, [...caseParams, ...ids])
      }
      return { success: true, data: { reordered: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/departments/groups/:id', async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const [[subRows], [memRows]] = await Promise.all([
        appPool.query('SELECT COUNT(*) AS count FROM department_groups WHERE parent_id = ?', [id]),
        appPool.query('SELECT COUNT(*) AS count FROM department_members WHERE group_id = ?', [id]),
      ])
      if (Number(subRows?.[0]?.count || 0) > 0) return reply.code(400).send({ success: false, error: 'ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากมีกลุ่มงานย่อยอยู่ภายใน' })
      if (Number(memRows?.[0]?.count || 0) > 0) return reply.code(400).send({ success: false, error: 'ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากยังมีสมาชิกอยู่ภายในกลุ่มงาน' })
      await appPool.query('DELETE FROM department_groups WHERE id = ?', [id])
      return { success: true, data: { deleted: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/departments/roles', async (_req, reply) => {
    try {
      await ensureDeptRolesTable()
      const [rows] = await appPool.query('SELECT id, name, order_index, is_default FROM department_roles ORDER BY order_index ASC, id ASC')
      return { success: true, data: rows || [] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/departments/roles', async (req, reply) => {
    try {
      await ensureDeptRolesTable()
      const { name, orderIndex, isDefault = false } = req.body || {}
      const result = await withUtf8Tx(appPool, async (conn) => {
        let ord = orderIndex
        if (ord === undefined || ord === null) {
          const [maxRows] = await conn.query('SELECT MAX(order_index) AS max_order FROM department_roles')
          ord = Number(maxRows?.[0]?.max_order ?? -1) + 1
        }
        if (isDefault) await conn.query('UPDATE department_roles SET is_default = 0')
        const [res] = await conn.query('INSERT INTO department_roles (name, order_index, is_default) VALUES (?, ?, ?)', [name, ord, isDefault ? 1 : 0])
        return { id: res.insertId, orderIndex: ord }
      })
      return { success: true, data: result }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/departments/roles/:id', async (req, reply) => {
    try {
      await ensureDeptRolesTable()
      const id = Number(req.params.id)
      const d = req.body || {}
      await withUtf8Tx(appPool, async (conn) => {
        const sets = []
        const params = []
        if (d.name !== undefined) { sets.push('name = ?'); params.push(d.name) }
        if (d.orderIndex !== undefined) { sets.push('order_index = ?'); params.push(d.orderIndex) }
        if (d.isDefault !== undefined) {
          if (d.isDefault) await conn.query('UPDATE department_roles SET is_default = 0 WHERE id != ?', [id])
          sets.push('is_default = ?'); params.push(d.isDefault ? 1 : 0)
        }
        if (sets.length > 0) {
          params.push(id)
          await conn.query(`UPDATE department_roles SET ${sets.join(', ')} WHERE id = ?`, params)
        }
      })
      return { success: true, data: { updated: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/departments/roles/:id', async (req, reply) => {
    try {
      await ensureDeptRolesTable()
      const [cnt] = await appPool.query('SELECT COUNT(*) AS count FROM department_roles')
      if (Number(cnt?.[0]?.count || 0) <= 1) return reply.code(400).send({ success: false, error: 'ไม่สามารถลบบทบาทนี้ได้ เนื่องจากต้องมีระดับบทบาทอย่างน้อย 1 รายการในระบบ' })
      await appPool.query('DELETE FROM department_roles WHERE id = ?', [Number(req.params.id)])
      return { success: true, data: { deleted: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/departments/roles/reorder', async (req, reply) => {
    try {
      await ensureDeptRolesTable()
      const ids = req.body?.roleIds || []
      if (ids.length > 0) {
        const cases = ids.map(() => 'WHEN ? THEN ?').join(' ')
        const caseParams = ids.flatMap((id, idx) => [id, idx])
        const ph = ids.map(() => '?').join(', ')
        await appPool.query(`UPDATE department_roles SET order_index = CASE id ${cases} ELSE order_index END WHERE id IN (${ph})`, [...caseParams, ...ids])
      }
      return { success: true, data: { reordered: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/departments/groups/:groupId/members', async (req, reply) => {
    try {
      const [rows] = await appPool.query(
        'SELECT id, group_id, name, position, role, order_index, image_path, phone, member_id FROM department_members WHERE group_id = ? ORDER BY order_index ASC, id ASC',
        [Number(req.params.groupId)]
      )
      return { success: true, data: rows || [] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/departments/members', async (req, reply) => {
    try {
      const d = req.body || {}
      const id = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          'INSERT INTO department_members (group_id, name, position, role, order_index, image_path, phone, member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [d.groupId, d.name, d.position, d.role, d.orderIndex, d.imagePath ?? null, d.phone ?? null, d.memberId ?? null]
        )
        return res.insertId
      })
      return { success: true, data: { id } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/departments/members/:id', async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const d = req.body || {}
      const sets = []
      const params = []
      const map = [['name', 'name'], ['position', 'position'], ['role', 'role'], ['orderIndex', 'order_index'], ['imagePath', 'image_path'], ['phone', 'phone'], ['memberId', 'member_id']]
      for (const [k, col] of map) {
        if (d[k] !== undefined) { sets.push(`${col} = ?`); params.push(d[k]) }
      }
      if (sets.length > 0) {
        params.push(id)
        await withUtf8Conn(appPool, async (conn) => {
          await conn.query(`UPDATE department_members SET ${sets.join(', ')} WHERE id = ?`, params)
        })
      }
      return { success: true, data: { updated: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/departments/members/:id', async (req, reply) => {
    try {
      await appPool.query('DELETE FROM department_members WHERE id = ?', [Number(req.params.id)])
      return { success: true, data: { deleted: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/departments/groups/:groupId/members/reorder', async (req, reply) => {
    try {
      const groupId = Number(req.params.groupId)
      const ids = req.body?.memberIds || []
      if (ids.length > 0) {
        const cases = ids.map(() => 'WHEN ? THEN ?').join(' ')
        const caseParams = ids.flatMap((id, idx) => [id, idx])
        const ph = ids.map(() => '?').join(', ')
        await appPool.query(`UPDATE department_members SET order_index = CASE id ${cases} ELSE order_index END WHERE group_id = ? AND id IN (${ph})`, [...caseParams, groupId, ...ids])
      }
      return { success: true, data: { reordered: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/departments/search-staff', async (req, reply) => {
    try {
      const kw = `%${String(req.query?.keyword || '').trim()}%`
      const [rows] = await appPool.query(
        `SELECT m.id, m.group_id, m.name, m.position, m.role, m.order_index, m.image_path, g.name AS group_name
         FROM department_members m JOIN department_groups g ON m.group_id = g.id
         WHERE g.is_active = 1 AND (m.name LIKE ? OR m.position LIKE ?) ORDER BY m.name ASC LIMIT 50`,
        [kw, kw]
      )
      return { success: true, data: rows || [] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/departments/public-org-chart', async (_req, reply) => {
    try {
      const [[groups], [members]] = await Promise.all([
        appPool.query('SELECT id, name, parent_id, order_index FROM department_groups WHERE is_active = 1 ORDER BY order_index ASC, id ASC'),
        appPool.query('SELECT m.id, m.group_id, m.name, m.position, m.role, m.order_index, m.image_path FROM department_members m JOIN department_groups g ON m.group_id = g.id WHERE g.is_active = 1 ORDER BY m.order_index ASC, m.id ASC'),
      ])
      return { success: true, data: { groups: groups || [], members: members || [] } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 5. INTERNAL PHONES V2
  // =========================================================================

  fastify.post('/api/v1/app/v2/internal-phones/ensure-and-seed', async (req, reply) => {
    try {
      const { seedKey = 'initial_seed_v2', initialItems = [] } = req.body || {}
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS hospital_internal_phones (
            id INT NOT NULL AUTO_INCREMENT,
            building VARCHAR(150) NOT NULL,
            floor VARCHAR(50) NULL,
            room VARCHAR(255) NOT NULL,
            phone VARCHAR(100) NOT NULL DEFAULT '',
            note VARCHAR(500) NULL,
            display_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_by VARCHAR(100) NULL,
            updated_by VARCHAR(100) NULL,
            created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
            updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
            PRIMARY KEY (id),
            INDEX idx_internal_phone_building_floor (building, floor),
            INDEX idx_internal_phone_active_order (is_active, display_order)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        await conn.query(`
          CREATE TABLE IF NOT EXISTS hospital_internal_phones_meta (
            meta_key VARCHAR(100) NOT NULL,
            meta_value VARCHAR(255) NOT NULL,
            updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
            PRIMARY KEY (meta_key)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
      })
      const [metaRows] = await appPool.query('SELECT meta_value FROM hospital_internal_phones_meta WHERE meta_key = ?', [seedKey])
      if (metaRows.length > 0) return { success: true, data: { seeded: false } }

      await withUtf8Tx(appPool, async (conn) => {
        await conn.query('DELETE FROM hospital_internal_phones')
        for (const item of initialItems) {
          await conn.query(
            `INSERT INTO hospital_internal_phones (building, floor, room, phone, note, display_order, is_active, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'system-seed', 'system-seed')`,
            [item.building, item.floor ?? null, item.room, item.phone, item.note ?? null, item.displayOrder, item.isActive ? 1 : 0]
          )
        }
        await conn.query(
          "INSERT INTO hospital_internal_phones_meta (meta_key, meta_value) VALUES (?, 'done') ON DUPLICATE KEY UPDATE meta_value = 'done'",
          [seedKey]
        )
      })
      return { success: true, data: { seeded: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/internal-phones', async (_req, reply) => {
    try {
      const [rows] = await appPool.query(`${PHONE_SELECT_SQL} ORDER BY display_order ASC, id ASC`)
      return { success: true, data: rows || [] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/internal-phones/:id', async (req, reply) => {
    try {
      const [rows] = await appPool.query(`${PHONE_SELECT_SQL} WHERE id = ? LIMIT 1`, [Number(req.params.id)])
      if (!rows.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลเบอร์โทรภายในรายการนี้' })
      return { success: true, data: rows[0] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/internal-phones', async (req, reply) => {
    try {
      const d = req.body || {}
      let displayOrder = d.displayOrder
      if (displayOrder === undefined) {
        const [maxRows] = await appPool.query('SELECT MAX(display_order) AS maxOrder FROM hospital_internal_phones')
        displayOrder = Number(maxRows?.[0]?.maxOrder ?? 0) + 1
      }
      const created = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO hospital_internal_phones (building, floor, room, phone, note, display_order, is_active, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [d.building, d.floor ?? null, d.room, d.phone, d.note ?? null, displayOrder, d.isActive === false ? 0 : 1, d.actorUsername, d.actorUsername]
        )
        const [rows] = await conn.query(`${PHONE_SELECT_SQL} WHERE id = ? LIMIT 1`, [res.insertId])
        return rows?.[0] ?? null
      })
      return { success: true, data: created }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/internal-phones/:id', async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const [existing] = await appPool.query(`${PHONE_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existing.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลเบอร์โทรภายในรายการนี้' })
      const d = req.body || {}
      const sets = []
      const params = []
      const map = [['building', 'building'], ['floor', 'floor'], ['room', 'room'], ['phone', 'phone'], ['note', 'note'], ['displayOrder', 'display_order']]
      for (const [k, col] of map) {
        if (d[k] !== undefined) { sets.push(`${col} = ?`); params.push(d[k]) }
      }
      if (d.isActive !== undefined) { sets.push('is_active = ?'); params.push(d.isActive ? 1 : 0) }
      if (sets.length === 0) return { success: true, data: existing[0] }
      sets.push('updated_by = ?'); params.push(d.actorUsername || 'system', id)
      const updated = await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`UPDATE hospital_internal_phones SET ${sets.join(', ')} WHERE id = ?`, params)
        const [rows] = await conn.query(`${PHONE_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
        return rows?.[0] ?? null
      })
      return { success: true, data: updated }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/internal-phones/:id', async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const [existing] = await appPool.query(`${PHONE_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existing.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลเบอร์โทรภายในรายการนี้' })
      await appPool.query('DELETE FROM hospital_internal_phones WHERE id = ?', [id])
      return { success: true, data: existing[0] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })
}
