/**
 * Phase 2E: Chronic Care & Home Visit (DM Remission Cohorts, DM Remission Lab Tracking, FCT Home Visits)
 * Zero-SQL Named Endpoints for thoen-api-gateway-v2
 */

const DM_ANTIDIABETIC_ICODES = [
  '1000184', '1019001', '1000142', '1570045', '1460026', '1630034',
  '1670019', '1480043', '1680002', '1510019', '1480075', '1460189',
  '1460190', '1460191', '1460192', '1630033', '1680023',
]

const DM_REMISSION_SEED_LABELS = ['Remission', 'ไม่ Remission', 'รอ lab A1c']

const FCT_SEED_LABELS = {
  pcu: [
    'รพ.เถิน', 'เด่นชัย', 'แม่วะหลวง', 'วังหิน', 'ดอนแก้ว', 'กุ่มเนิ้ง',
    'แม่มอกกลาง', 'หอรบ', 'สะเลียมหวาน', 'หนองหอย', 'แม่ถอด', 'นาบ้านไร่',
    'ท่ามะเกว๋น', 'เด่นแก้ว', 'ห้วยแก้ว',
  ],
  patient_category: [
    'stroke', 'palliative', 'สูงอายุติดเตียง', 'สูงอายุติดบ้าน', 'CKD 5', 'COPD',
    'กระดูกและข้อ', 'DM HT', 'หัวใจ', 'CP', 'พอสว', 'พระบรมฯ',
  ],
  adl_group: ['ติดเตียง', 'ติดบ้าน', 'ติดสังคม'],
  visit_outcome: ['ดีขึ้น', 'คงเดิม', 'แย่ลง', 'เสียชีวิต'],
  overall_risk: ['Low', 'Moderate', 'High'],
  risk_level: ['Low', 'Moderate', 'High'],
  treatment_facility: [
    'รพ.เถิน', 'รพ.เถิน รพ.ลำปาง', 'รพ.ลำปาง',
    'รพ.มหาราชนครเชียงใหม่', 'รพ.มะเร็งลำปาง', 'รพ.พระมงกุฎเกล้า',
  ],
  nutrition_status: ['ปกติ', 'ผอม BMI น้อย', 'อ้วน BMI เกิน', 'ขาดสารอาหารรุนแรง'],
  pt_category: [
    'กายภาพ, ฝึกเดิน, ป้องกันข้อติด', 'ฝึกทรงตัว ยืน เดิน',
    'ป้องกันข้อติด', 'ฟื้นฟูหลังผ่าตัด/ข้อเข่า',
  ],
  thai_med_category: [
    'นวดประคบสมุนไพร', 'พอกเข่า/ลดปวด', 'ฟื้นฟูอัมพฤกษ์อัมพาต', 'ดูแลแผล/สมุนไพร',
  ],
}

const DM_COHORT_SELECT_SQL = `
  SELECT
    id,
    fiscal_year AS fiscalYear,
    pcu_name AS pcuName,
    patient_name AS patientName,
    cid,
    hn,
    age,
    underlying_diseases AS underlyingDiseases,
    height_cm AS heightCm,
    weight_before_kg AS weightBeforeKg,
    weight_after_kg AS weightAfterKg,
    waist_before_cm AS waistBeforeCm,
    waist_after_cm AS waistAfterCm,
    fpg_before AS fpgBefore,
    fpg_after AS fpgAfter,
    a1c_before AS a1cBefore,
    a1c_after AS a1cAfter,
    a1c_post_stop_3m AS a1cPostStop3m,
    meds_before AS medsBefore,
    meds_after AS medsAfter,
    summary_a1c AS summaryA1c,
    summary_meds AS summaryMeds,
    summary_weight AS summaryWeight,
    summary_waist AS summaryWaist,
    summary_diet AS summaryDiet,
    summary_exercise AS summaryExercise,
    summary_if AS summaryIf,
    summary_remission AS summaryRemission,
    created_by AS createdBy,
    updated_by AS updatedBy,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM dm_remission_cohorts
`

const DM_OPTION_SELECT_SQL = `
  SELECT
    id, category, label, sort_order AS sortOrder, is_active AS isActive,
    created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
  FROM dm_remission_options
`

const FCT_VISIT_SELECT_SQL = `
  SELECT
    id,
    fiscal_year AS fiscalYear,
    DATE_FORMAT(visit_date, '%Y-%m-%d') AS visitDate,
    pcu_name AS pcuName,
    patient_name AS patientName,
    hn,
    age,
    address,
    adl_score AS adlScore,
    adl_group AS adlGroup,
    diagnosis,
    patient_category AS patientCategory,
    follow_up_plan AS followUpPlan,
    treatment_facility AS treatmentFacility,
    visit_outcome AS visitOutcome,
    overall_risk_level AS overallRiskLevel,
    risk_level AS riskLevel,
    dental_note AS dentalNote,
    pharmacy_note AS pharmacyNote,
    nutrition_status AS nutritionStatus,
    nutrition_note AS nutritionNote,
    pt_category AS ptCategory,
    pt_note AS ptNote,
    thai_med_category AS thaiMedCategory,
    thai_med_note AS thaiMedNote,
    created_by AS createdBy,
    updated_by AS updatedBy,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM fct_home_visits
`

const FCT_OPTION_SELECT_SQL = `
  SELECT
    id, category, label, sort_order AS sortOrder, is_active AS isActive,
    created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
  FROM fct_home_visit_options
`

const DM_FIELD_TO_COL = {
  fiscalYear: 'fiscal_year',
  pcuName: 'pcu_name',
  patientName: 'patient_name',
  cid: 'cid',
  hn: 'hn',
  age: 'age',
  underlyingDiseases: 'underlying_diseases',
  heightCm: 'height_cm',
  weightBeforeKg: 'weight_before_kg',
  weightAfterKg: 'weight_after_kg',
  waistBeforeCm: 'waist_before_cm',
  waistAfterCm: 'waist_after_cm',
  fpgBefore: 'fpg_before',
  fpgAfter: 'fpg_after',
  a1cBefore: 'a1c_before',
  a1cAfter: 'a1c_after',
  a1cPostStop3m: 'a1c_post_stop_3m',
  medsBefore: 'meds_before',
  medsAfter: 'meds_after',
  summaryA1c: 'summary_a1c',
  summaryMeds: 'summary_meds',
  summaryWeight: 'summary_weight',
  summaryWaist: 'summary_waist',
  summaryDiet: 'summary_diet',
  summaryExercise: 'summary_exercise',
  summaryIf: 'summary_if',
  summaryRemission: 'summary_remission',
}

const FCT_FIELD_TO_COL = {
  fiscalYear: 'fiscal_year',
  visitDate: 'visit_date',
  pcuName: 'pcu_name',
  patientName: 'patient_name',
  hn: 'hn',
  age: 'age',
  address: 'address',
  adlScore: 'adl_score',
  adlGroup: 'adl_group',
  diagnosis: 'diagnosis',
  patientCategory: 'patient_category',
  followUpPlan: 'follow_up_plan',
  treatmentFacility: 'treatment_facility',
  visitOutcome: 'visit_outcome',
  overallRiskLevel: 'overall_risk_level',
  riskLevel: 'risk_level',
  dentalNote: 'dental_note',
  pharmacyNote: 'pharmacy_note',
  nutritionStatus: 'nutrition_status',
  nutritionNote: 'nutrition_note',
  ptCategory: 'pt_category',
  ptNote: 'pt_note',
  thaiMedCategory: 'thai_med_category',
  thaiMedNote: 'thai_med_note',
}

function getCurrentThaiFiscalYear() {
  const now = new Date()
  const bangkokOffsetMs = 7 * 60 * 60 * 1000
  const bkk = new Date(now.getTime() + bangkokOffsetMs)
  const y = bkk.getUTCFullYear()
  const m = bkk.getUTCMonth() + 1
  return m >= 10 ? y + 544 : y + 543
}

function isDupError(err) {
  return Boolean(err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062 || /duplicate entry/i.test(String(err.message || ''))))
}

function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function placeholders(n) {
  return Array.from({ length: n }, () => '?').join(', ')
}

function normalizeHnVal(val) {
  if (val === null || val === undefined) return null
  const digits = String(val).replace(/\D+/g, '')
  if (!digits) return null
  return digits.length < 7 ? digits.padStart(7, '0') : digits
}

function normalizeCidVal(val) {
  if (val === null || val === undefined) return null
  const digits = String(val).replace(/\D+/g, '')
  return digits || null
}

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

export default async function clinicalChronicV2Routes(fastify, opts) {
  const hosPool = opts.hosPool || opts.pools?.hosPool
  const appPool = opts.appPool || opts.pools?.appPool

  let dmSchemaDone = false
  let dmSchemaPromise = null
  let fctSchemaDone = false
  let fctSchemaPromise = null

  async function ensureDmSchema() {
    if (dmSchemaDone) return
    if (dmSchemaPromise) return dmSchemaPromise
    dmSchemaPromise = (async () => {
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS dm_remission_cohorts (
            id INT NOT NULL AUTO_INCREMENT,
            fiscal_year INT NOT NULL,
            pcu_name VARCHAR(150) NULL,
            patient_name VARCHAR(255) NOT NULL,
            cid VARCHAR(20) NULL,
            hn VARCHAR(20) NULL,
            age INT NULL,
            underlying_diseases VARCHAR(500) NULL,
            height_cm DECIMAL(5, 2) NULL,
            weight_before_kg DECIMAL(6, 2) NULL,
            weight_after_kg DECIMAL(6, 2) NULL,
            waist_before_cm DECIMAL(6, 2) NULL,
            waist_after_cm DECIMAL(6, 2) NULL,
            fpg_before DECIMAL(6, 2) NULL,
            fpg_after DECIMAL(6, 2) NULL,
            a1c_before DECIMAL(5, 2) NULL,
            a1c_after DECIMAL(5, 2) NULL,
            a1c_post_stop_3m DECIMAL(5, 2) NULL,
            meds_before TEXT NULL,
            meds_after TEXT NULL,
            summary_a1c VARCHAR(50) NULL,
            summary_meds VARCHAR(50) NULL,
            summary_weight VARCHAR(50) NULL,
            summary_waist VARCHAR(50) NULL,
            summary_diet VARCHAR(100) NULL,
            summary_exercise VARCHAR(100) NULL,
            summary_if VARCHAR(100) NULL,
            summary_remission VARCHAR(100) NULL,
            created_by VARCHAR(100) NULL,
            updated_by VARCHAR(100) NULL,
            created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
            updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
            PRIMARY KEY (id),
            UNIQUE KEY uq_dm_remission_fy_hn (fiscal_year, hn),
            UNIQUE KEY uq_dm_remission_fy_cid (fiscal_year, cid),
            INDEX idx_dm_remission_fy (fiscal_year),
            INDEX idx_dm_remission_pcu (pcu_name),
            INDEX idx_dm_remission_status (summary_remission)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        await conn.query(`
          CREATE TABLE IF NOT EXISTS dm_remission_options (
            id INT NOT NULL AUTO_INCREMENT,
            category VARCHAR(50) NOT NULL,
            label VARCHAR(150) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_by VARCHAR(100) NULL,
            created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
            updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
            PRIMARY KEY (id),
            UNIQUE KEY uq_dm_remission_opt_cat_label (category, label),
            INDEX idx_dm_remission_opt_lookup (category, is_active, sort_order)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        const [cntRows] = await conn.query(
          `SELECT COUNT(*) AS cnt FROM dm_remission_options WHERE category = 'remission'`
        )
        if (Number(cntRows[0]?.cnt ?? 0) === 0) {
          for (let idx = 0; idx < DM_REMISSION_SEED_LABELS.length; idx++) {
            await conn.query(
              `INSERT IGNORE INTO dm_remission_options (category, label, sort_order, is_active, created_by) VALUES (?, ?, ?, ?, ?)`,
              ['remission', DM_REMISSION_SEED_LABELS[idx], idx, true, 'system']
            )
          }
        }
      })
      dmSchemaDone = true
    })()
    try {
      await dmSchemaPromise
    } finally {
      dmSchemaPromise = null
    }
  }

  async function ensureFctSchema() {
    if (fctSchemaDone) return
    if (fctSchemaPromise) return fctSchemaPromise
    fctSchemaPromise = (async () => {
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS fct_home_visits (
            id INT NOT NULL AUTO_INCREMENT,
            fiscal_year INT NOT NULL,
            visit_date DATE NULL,
            pcu_name VARCHAR(150) NULL,
            patient_name VARCHAR(255) NOT NULL,
            hn VARCHAR(20) NULL,
            age INT NULL,
            address VARCHAR(500) NULL,
            adl_score INT NULL,
            adl_group VARCHAR(100) NULL,
            diagnosis VARCHAR(500) NULL,
            patient_category VARCHAR(150) NULL,
            follow_up_plan TEXT NULL,
            treatment_facility VARCHAR(255) NULL,
            visit_outcome VARCHAR(100) NULL,
            overall_risk_level VARCHAR(100) NULL,
            risk_level VARCHAR(100) NULL,
            dental_note TEXT NULL,
            pharmacy_note TEXT NULL,
            nutrition_status VARCHAR(150) NULL,
            nutrition_note TEXT NULL,
            pt_category VARCHAR(255) NULL,
            pt_note TEXT NULL,
            thai_med_category VARCHAR(255) NULL,
            thai_med_note TEXT NULL,
            created_by VARCHAR(100) NULL,
            updated_by VARCHAR(100) NULL,
            created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
            updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
            PRIMARY KEY (id),
            INDEX idx_fct_home_visits_fy (fiscal_year),
            INDEX idx_fct_home_visits_date (visit_date),
            INDEX idx_fct_home_visits_hn (hn),
            INDEX idx_fct_home_visits_pcu (pcu_name),
            INDEX idx_fct_home_visits_date_hn (visit_date, hn)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        await conn.query(`
          CREATE TABLE IF NOT EXISTS fct_home_visit_options (
            id INT NOT NULL AUTO_INCREMENT,
            category VARCHAR(50) NOT NULL,
            label VARCHAR(150) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_by VARCHAR(100) NULL,
            created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
            updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
            PRIMARY KEY (id),
            UNIQUE KEY uq_fct_home_visit_opt_cat_label (category, label),
            INDEX idx_fct_home_visit_opt_lookup (category, is_active, sort_order)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        try {
          await conn.query(`ALTER TABLE fct_home_visits MODIFY COLUMN visit_date DATE NULL`)
        } catch {}
        const [countRows] = await conn.query(
          `SELECT category, COUNT(*) AS cnt FROM fct_home_visit_options GROUP BY category`
        )
        const countByCat = new Map()
        for (const r of countRows || []) {
          countByCat.set(String(r.category), Number(r.cnt ?? 0))
        }
        for (const [category, labels] of Object.entries(FCT_SEED_LABELS)) {
          if ((countByCat.get(category) ?? 0) === 0) {
            for (let idx = 0; idx < labels.length; idx++) {
              await conn.query(
                `INSERT IGNORE INTO fct_home_visit_options (category, label, sort_order, is_active, created_by) VALUES (?, ?, ?, ?, ?)`,
                [category, labels[idx], idx, true, 'system']
              )
            }
          }
        }
      })
      fctSchemaDone = true
    })()
    try {
      await fctSchemaPromise
    } finally {
      fctSchemaPromise = null
    }
  }

  // =========================================================================
  // 1. DM REMISSION COHORTS & OPTIONS
  // =========================================================================

  fastify.post('/api/v1/clinical/dm-remission/ensure-schema', async (_req, reply) => {
    try {
      await ensureDmSchema()
      return { success: true, data: { ensured: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/clinical/dm-remission/lookup-patient/:hn', async (req, reply) => {
    try {
      const hn = String(req.params?.hn || '').trim()
      if (!hn) return { success: true, data: null }
      const [rows] = await hosPool.query(
        `SELECT pt.hn, pt.cid,
                CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
                TIMESTAMPDIFF(YEAR, pt.birthday, CURDATE()) AS age
         FROM patient pt WHERE pt.hn = ? LIMIT 1`,
        [hn]
      )
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/clinical/dm-remission/options', async (_req, reply) => {
    try {
      await ensureDmSchema()
      const [rows] = await appPool.query(`${DM_OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`)
      return { success: true, data: rows }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/clinical/dm-remission/options', async (req, reply) => {
    try {
      await ensureDmSchema()
      const { category, label, sortOrder = 0, isActive = true, actorName = 'system' } = req.body || {}
      const cleanLabel = String(label || '').trim()
      if (!category || !cleanLabel) {
        return reply.code(400).send({ success: false, error: 'กรุณาระบุชื่อตัวเลือก' })
      }
      const [dup] = await appPool.query(
        `SELECT id FROM dm_remission_options WHERE category = ? AND label = ? LIMIT 1`,
        [category, cleanLabel]
      )
      if (dup.length > 0) {
        return reply.code(409).send({ success: false, code: 'CONFLICT', error: `มีตัวเลือก "${cleanLabel}" อยู่ในหมวดหมู่นี้แล้ว` })
      }
      const created = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO dm_remission_options (category, label, sort_order, is_active, created_by) VALUES (?, ?, ?, ?, ?)`,
          [category, cleanLabel, sortOrder, isActive, actorName]
        )
        const [rows] = await conn.query(`${DM_OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`, [res.insertId])
        return rows[0] ?? null
      })
      return { success: true, data: created }
    } catch (err) {
      if (isDupError(err)) {
        return reply.code(409).send({ success: false, code: 'CONFLICT', error: 'มีตัวเลือกนี้อยู่ในหมวดหมู่นี้แล้ว' })
      }
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/clinical/dm-remission/options/:id', async (req, reply) => {
    try {
      await ensureDmSchema()
      const id = Number(req.params?.id)
      const [existingRows] = await appPool.query(`${DM_OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, code: 'NOT_FOUND', error: `ไม่พบตัวเลือก ID: ${id}` })
      }
      const existing = existingRows[0]
      const { label, sortOrder, isActive } = req.body || {}
      const setClauses = []
      const params = []
      if (label !== undefined) {
        const clean = String(label).trim()
        if (!clean) return reply.code(400).send({ success: false, error: 'กรุณาระบุชื่อตัวเลือก' })
        const [dup] = await appPool.query(
          `SELECT id FROM dm_remission_options WHERE category = ? AND label = ? AND id <> ? LIMIT 1`,
          [existing.category, clean, id]
        )
        if (dup.length > 0) {
          return reply.code(409).send({ success: false, code: 'CONFLICT', error: `มีตัวเลือก "${clean}" อยู่ในหมวดหมู่นี้แล้ว` })
        }
        setClauses.push('label = ?')
        params.push(clean)
      }
      if (sortOrder !== undefined) {
        setClauses.push('sort_order = ?')
        params.push(sortOrder)
      }
      if (isActive !== undefined) {
        setClauses.push('is_active = ?')
        params.push(isActive)
      }
      const updated = await withUtf8Conn(appPool, async (conn) => {
        if (setClauses.length > 0) {
          params.push(id)
          await conn.query(`UPDATE dm_remission_options SET ${setClauses.join(', ')} WHERE id = ?`, params)
        }
        const [rows] = await conn.query(`${DM_OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
        return rows[0] ?? null
      })
      return { success: true, data: updated }
    } catch (err) {
      if (isDupError(err)) {
        return reply.code(409).send({ success: false, code: 'CONFLICT', error: 'มีตัวเลือกชื่อนี้อยู่ในหมวดหมู่นี้แล้ว' })
      }
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/clinical/dm-remission/options/:id', async (req, reply) => {
    try {
      await ensureDmSchema()
      const id = Number(req.params?.id)
      const [existingRows] = await appPool.query(`${DM_OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, code: 'NOT_FOUND', error: `ไม่พบตัวเลือก ID: ${id}` })
      }
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query('DELETE FROM dm_remission_options WHERE id = ?', [id])
      })
      return { success: true, data: { id, category: existingRows[0].category } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/clinical/dm-remission/cohorts-bundle', async (req, reply) => {
    try {
      await ensureDmSchema()
      const rawFy = req.query?.fiscalYear
      const explicitFy = rawFy !== undefined && rawFy !== '' ? Number(rawFy) : undefined
      let targetFiscalYear
      let optionRows, yearRows, pcuRows, cohortRows

      if (explicitFy !== undefined && Number.isFinite(explicitFy)) {
        targetFiscalYear = explicitFy
        const [o, y, p, c] = await Promise.all([
          appPool.query(`${DM_OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`),
          appPool.query(`SELECT DISTINCT fiscal_year AS fiscalYear FROM dm_remission_cohorts ORDER BY fiscal_year DESC`),
          appPool.query(`SELECT DISTINCT pcu_name AS pcuName FROM dm_remission_cohorts WHERE pcu_name IS NOT NULL AND pcu_name <> ''`),
          appPool.query(`${DM_COHORT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY id DESC`, [targetFiscalYear]),
        ])
        optionRows = o[0]; yearRows = y[0]; pcuRows = p[0]; cohortRows = c[0]
      } else {
        const [y] = await appPool.query(`SELECT DISTINCT fiscal_year AS fiscalYear FROM dm_remission_cohorts ORDER BY fiscal_year DESC`)
        yearRows = y
        const years = yearRows.map((r) => Number(r.fiscalYear)).filter((n) => Number.isFinite(n))
        targetFiscalYear = years.length > 0 ? Math.max(...years) : getCurrentThaiFiscalYear()
        const [o, p, c] = await Promise.all([
          appPool.query(`${DM_OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`),
          appPool.query(`SELECT DISTINCT pcu_name AS pcuName FROM dm_remission_cohorts WHERE pcu_name IS NOT NULL AND pcu_name <> ''`),
          appPool.query(`${DM_COHORT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY id DESC`, [targetFiscalYear]),
        ])
        optionRows = o[0]; pcuRows = p[0]; cohortRows = c[0]
      }
      return {
        success: true,
        data: { targetFiscalYear, optionRows, yearRows, pcuRows, cohortRows },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/clinical/dm-remission/cohorts', async (req, reply) => {
    try {
      await ensureDmSchema()
      const { fields = {}, actorName = 'system' } = req.body || {}
      const fiscalYear = Number(fields.fiscalYear)
      const hn = fields.hn ?? null
      const cid = fields.cid ?? null

      const idClauses = []
      const dupParams = [fiscalYear]
      if (hn) { idClauses.push('hn = ?'); dupParams.push(hn) }
      if (cid) { idClauses.push('cid = ?'); dupParams.push(cid) }
      if (idClauses.length > 0) {
        const [dup] = await appPool.query(
          `SELECT id FROM dm_remission_cohorts WHERE fiscal_year = ? AND (${idClauses.join(' OR ')}) LIMIT 1`,
          dupParams
        )
        if (dup.length > 0) {
          return reply.code(409).send({
            success: false,
            code: 'CONFLICT',
            error: `ผู้ป่วยนี้ (HN หรือเลขบัตรประชาชน) มีอยู่ในทะเบียนปีงบประมาณ ${fiscalYear} แล้ว`,
          })
        }
      }

      const columns = []
      const phs = []
      const params = []
      for (const [k, col] of Object.entries(DM_FIELD_TO_COL)) {
        columns.push(col)
        phs.push('?')
        params.push(fields[k] ?? null)
      }
      columns.push('created_by', 'updated_by')
      phs.push('?', '?')
      params.push(actorName, actorName)

      const created = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO dm_remission_cohorts (${columns.join(', ')}) VALUES (${phs.join(', ')})`,
          params
        )
        const [rows] = await conn.query(`${DM_COHORT_SELECT_SQL} WHERE id = ? LIMIT 1`, [res.insertId])
        return rows[0] ?? null
      })
      return { success: true, data: created }
    } catch (err) {
      if (isDupError(err)) {
        return reply.code(409).send({
          success: false,
          code: 'CONFLICT',
          error: `ผู้ป่วยนี้ (HN หรือเลขบัตรประชาชน) มีอยู่ในทะเบียนปีงบประมาณนี้แล้ว`,
        })
      }
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/clinical/dm-remission/cohorts/:id', async (req, reply) => {
    try {
      await ensureDmSchema()
      const id = Number(req.params?.id)
      const [existingRows] = await appPool.query(`${DM_COHORT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, code: 'NOT_FOUND', error: `ไม่พบข้อมูล DM Remission ID: ${id}` })
      }
      const existing = existingRows[0]
      const { fields = {}, actorName = 'system' } = req.body || {}

      const targetFy = fields.fiscalYear !== undefined ? Number(fields.fiscalYear) : Number(existing.fiscalYear)
      const nextHn = fields.hn !== undefined ? fields.hn : existing.hn
      const nextCid = fields.cid !== undefined ? fields.cid : existing.cid

      const idClauses = []
      const dupParams = [targetFy]
      if (nextHn) { idClauses.push('hn = ?'); dupParams.push(nextHn) }
      if (nextCid) { idClauses.push('cid = ?'); dupParams.push(nextCid) }
      if (idClauses.length > 0) {
        dupParams.push(id)
        const [dup] = await appPool.query(
          `SELECT id FROM dm_remission_cohorts WHERE fiscal_year = ? AND (${idClauses.join(' OR ')}) AND id <> ? LIMIT 1`,
          dupParams
        )
        if (dup.length > 0) {
          return reply.code(409).send({
            success: false,
            code: 'CONFLICT',
            error: `ผู้ป่วยนี้ (HN หรือเลขบัตรประชาชน) มีอยู่ในทะเบียนปีงบประมาณ ${targetFy} แล้ว`,
          })
        }
      }

      const setClauses = []
      const params = []
      for (const [k, col] of Object.entries(DM_FIELD_TO_COL)) {
        if (fields[k] !== undefined) {
          setClauses.push(`${col} = ?`)
          params.push(fields[k])
        }
      }
      setClauses.push('updated_by = ?')
      params.push(actorName)
      params.push(id)

      const updated = await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`UPDATE dm_remission_cohorts SET ${setClauses.join(', ')} WHERE id = ?`, params)
        const [rows] = await conn.query(`${DM_COHORT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
        return rows[0] ?? null
      })
      return { success: true, data: updated }
    } catch (err) {
      if (isDupError(err)) {
        return reply.code(409).send({
          success: false,
          code: 'CONFLICT',
          error: `ผู้ป่วยนี้ (HN หรือเลขบัตรประชาชน) มีอยู่ในทะเบียนปีงบประมาณนี้แล้ว`,
        })
      }
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/clinical/dm-remission/cohorts/:id', async (req, reply) => {
    try {
      await ensureDmSchema()
      const id = Number(req.params?.id)
      const [existingRows] = await appPool.query(`${DM_COHORT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, code: 'NOT_FOUND', error: `ไม่พบข้อมูล DM Remission ID: ${id}` })
      }
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query('DELETE FROM dm_remission_cohorts WHERE id = ?', [id])
      })
      return { success: true, data: { id, fiscalYear: Number(existingRows[0].fiscalYear) } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/clinical/dm-remission/carryover', async (req, reply) => {
    try {
      await ensureDmSchema()
      const { fromFiscalYear, toFiscalYear, actorName = 'system', defaultRemissionStatus = 'รอ lab A1c' } = req.body || {}
      const fromFy = Number(fromFiscalYear)
      const toFy = Number(toFiscalYear)
      if (!Number.isFinite(fromFy) || !Number.isFinite(toFy) || toFy <= fromFy) {
        return reply.code(400).send({ success: false, error: 'ปีงบประมาณปลายทางต้องมากกว่าปีงบประมาณต้นทาง' })
      }

      const [[sourceRows], [targetRows]] = await Promise.all([
        appPool.query(
          `${DM_COHORT_SELECT_SQL}
           WHERE fiscal_year = ?
             AND (summary_remission IS NULL OR summary_remission <> 'Remission')
           ORDER BY id ASC`,
          [fromFy]
        ),
        appPool.query(`SELECT hn, cid FROM dm_remission_cohorts WHERE fiscal_year = ?`, [toFy]),
      ])

      const existingHns = new Set()
      const existingCids = new Set()
      for (const r of targetRows || []) {
        const hn = normalizeHnVal(r.hn)
        const cid = normalizeCidVal(r.cid)
        if (hn) existingHns.add(hn)
        if (cid) existingCids.add(cid)
      }

      const toInsert = []
      let skippedCount = 0
      for (const r of sourceRows || []) {
        const hn = normalizeHnVal(r.hn)
        const cid = normalizeCidVal(r.cid)
        if ((hn && existingHns.has(hn)) || (cid && existingCids.has(cid))) {
          skippedCount += 1
          continue
        }
        if (hn) existingHns.add(hn)
        if (cid) existingCids.add(cid)
        toInsert.push([
          toFy,
          r.pcuName ?? null,
          r.patientName,
          cid,
          hn,
          r.age != null ? Number(r.age) : null,
          r.underlyingDiseases ?? null,
          r.heightCm != null ? Number(r.heightCm) : null,
          r.weightAfterKg != null ? Number(r.weightAfterKg) : (r.weightBeforeKg != null ? Number(r.weightBeforeKg) : null),
          r.waistAfterCm != null ? Number(r.waistAfterCm) : (r.waistBeforeCm != null ? Number(r.waistBeforeCm) : null),
          r.fpgAfter != null ? Number(r.fpgAfter) : (r.fpgBefore != null ? Number(r.fpgBefore) : null),
          r.a1cAfter != null ? Number(r.a1cAfter) : (r.a1cBefore != null ? Number(r.a1cBefore) : null),
          r.medsAfter ?? r.medsBefore ?? null,
          defaultRemissionStatus,
          actorName,
          actorName,
        ])
      }

      if (toInsert.length > 0) {
        const insertSql = `
          INSERT INTO dm_remission_cohorts (
            fiscal_year, pcu_name, patient_name, cid, hn, age, underlying_diseases,
            height_cm, weight_before_kg, waist_before_cm, fpg_before, a1c_before,
            meds_before, summary_remission, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        await withUtf8Tx(appPool, async (conn) => {
          for (const params of toInsert) {
            await conn.query(insertSql, params)
          }
        })
      }

      return { success: true, data: { copiedCount: toInsert.length, skippedCount } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 2. DM REMISSION LAB TRACKING
  // =========================================================================

  fastify.get('/api/v1/clinical/dm-remission/lab/dataset', async (req, reply) => {
    try {
      const startDate = String(req.query?.startDate || '').trim()
      const endDate = String(req.query?.endDate || '').trim()
      const fiscalYear = Number(req.query?.fiscalYear)
      const a1cMax = Number(req.query?.a1cMax ?? 7.0)
      if (!startDate || !endDate || !Number.isFinite(fiscalYear)) {
        return reply.code(400).send({ success: false, error: 'startDate, endDate, fiscalYear required' })
      }

      const totalSql = `
        SELECT COUNT(DISTINCT lh.hn) AS total_tested
        FROM lab_head lh
        INNER JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
        WHERE lh.order_date >= ?
          AND lh.order_date <= ?
          AND lo.lab_items_code = 3073
          AND lo.confirm = 'Y'
          AND lo.lab_order_result REGEXP '^[0-9]+(\\.[0-9]+)?$'
      `

      const basePoolSql = `
        SELECT
          t.hn,
          p.cid,
          CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS patient_name,
          TIMESTAMPDIFF(YEAR, p.birthday, t.visit_date) AS age_years,
          CASE p.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE NULL END AS sex_label,
          CASE WHEN COALESCE(p.death, 'N') = 'Y' OR COALESCE(MAX(ps.death), 'N') = 'Y' THEN 1 ELSE 0 END AS death_flag,
          t.visit_date,
          t.latest_vn AS vn,
          t.lab_order_number,
          t.latest_a1c,
          t.a1c_test_count,
          t.prev_entry,
          o.pttype AS visit_pttype_code,
          pt_v.name AS visit_pttype_name,
          CASE WHEN pt_v.hipdata_code = 'UCS' THEN 1 ELSE 0 END AS is_uc_visit,
          p.pttype AS current_pttype_code,
          pt_p.name AS current_pttype_name,
          CASE WHEN pt_p.hipdata_code = 'UCS' THEN 1 ELSE 0 END AS is_uc_current,
          MAX(ta.name) AS tambon_name,
          MAX(v.village_name) AS village_name,
          MAX(v.village_moo) AS village_moo
        FROM (
          SELECT
            raw_agg.hn,
            raw_agg.a1c_test_count,
            SUBSTRING_INDEX(SUBSTRING_INDEX(raw_agg.entries_csv, ',', 1), '|', 1) AS visit_date,
            CAST(
              SUBSTRING_INDEX(
                SUBSTRING_INDEX(
                  SUBSTRING_INDEX(raw_agg.entries_csv, ',', 1),
                  '|', 2
                ),
                '|', -1
              ) AS UNSIGNED
            ) AS lab_order_number,
            CAST(
              SUBSTRING_INDEX(
                SUBSTRING_INDEX(
                  SUBSTRING_INDEX(raw_agg.entries_csv, ',', 1),
                  '|', 3
                ),
                '|', -1
              ) AS DECIMAL(5,2)
            ) AS latest_a1c,
            SUBSTRING_INDEX(SUBSTRING_INDEX(raw_agg.entries_csv, ',', 1), '|', -1) AS latest_vn,
            CASE
              WHEN raw_agg.a1c_test_count >= 2 THEN
                SUBSTRING_INDEX(SUBSTRING_INDEX(raw_agg.entries_csv, ',', 2), ',', -1)
              ELSE NULL
            END AS prev_entry
          FROM (
            SELECT
              lh.hn,
              COUNT(*) AS a1c_test_count,
              GROUP_CONCAT(
                CONCAT(DATE_FORMAT(lh.order_date, '%Y-%m-%d'), '|', lh.lab_order_number, '|', TRIM(lo.lab_order_result), '|', COALESCE(lh.vn, ''))
                ORDER BY lh.order_date DESC, lh.lab_order_number DESC
                SEPARATOR ','
              ) AS entries_csv
            FROM lab_head lh
            INNER JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
            WHERE lh.order_date >= ?
              AND lh.order_date <= ?
              AND lo.lab_items_code = 3073
              AND lo.confirm = 'Y'
              AND lo.lab_order_result REGEXP '^[0-9]+(\\.[0-9]+)?$'
            GROUP BY lh.hn
          ) raw_agg
          HAVING latest_a1c <= ?
        ) t
        INNER JOIN patient p ON p.hn = t.hn
        LEFT JOIN ovst o ON o.vn = t.latest_vn
        LEFT JOIN pttype pt_v ON pt_v.pttype = o.pttype
        LEFT JOIN pttype pt_p ON pt_p.pttype = p.pttype
        LEFT JOIN person ps ON ps.patient_hn = p.hn
        LEFT JOIN village v ON v.village_id = ps.village_id
        LEFT JOIN thaiaddress ta
          ON ta.chwpart = p.chwpart
          AND ta.amppart = p.amppart
          AND ta.tmbpart = p.tmbpart
          AND ta.codetype = '3'
        GROUP BY
          t.hn, p.cid, p.pname, p.fname, p.lname, p.birthday, p.sex, p.death,
          t.visit_date, t.latest_vn, t.lab_order_number, t.latest_a1c, t.a1c_test_count, t.prev_entry,
          o.pttype, pt_v.name, pt_v.hipdata_code, p.pttype, pt_p.name, pt_p.hipdata_code
      `

      const [[totalRows], [baseRows]] = await Promise.all([
        hosPool.query(totalSql, [startDate, endDate]),
        hosPool.query(basePoolSql, [startDate, endDate, a1cMax]),
      ])

      const totalA1cTested = Number(totalRows?.[0]?.total_tested ?? 0)
      if (!baseRows || baseRows.length === 0) {
        return {
          success: true,
          data: {
            totalA1cTested,
            baseRows: [],
            e11Rows: [],
            sameVnRows: [],
            rxRows: [],
            cohortRows: [],
            t1dmRows: [],
            t1dmMirrorRows: [],
          },
        }
      }

      const hns = Array.from(new Set(baseRows.map((r) => r.hn).filter(Boolean)))
      const vns = Array.from(new Set(baseRows.map((r) => r.vn && String(r.vn).trim()).filter(Boolean)))
      const cids = Array.from(
        new Set(
          baseRows.flatMap((r) => {
            const raw = r.cid ? String(r.cid).trim() : null
            const norm = normalizeCidVal(raw)
            return [raw, norm].filter(Boolean)
          })
        )
      )

      const CHUNK = 900
      const hnChunks = chunkArray(hns, CHUNK)
      const vnChunks = chunkArray(vns, CHUNK)
      const cidChunks = chunkArray(cids, CHUNK)
      const icodePhs = placeholders(DM_ANTIDIABETIC_ICODES.length)

      const [e11Parts, sameVnParts, rxParts, cohortRows, t1dmParts, t1dmMirrorRows] = await Promise.all([
        Promise.all(
          hnChunks.map((chunk) =>
            hosPool
              .query(
                `SELECT od.hn,
                        DATE_FORMAT(MAX(od.vstdate), '%Y-%m-%d') AS last_e11_date,
                        SUBSTRING_INDEX(GROUP_CONCAT(od.icd10 ORDER BY od.vstdate DESC, od.vn DESC SEPARATOR ','), ',', 1) AS last_e11_icd10,
                        SUM(CASE WHEN od.vstdate >= ? AND od.vstdate <= ? THEN 1 ELSE 0 END) AS in_fy_e11_count
                 FROM ovstdiag od
                 WHERE od.hn IN (${placeholders(chunk.length)}) AND od.icd10 LIKE 'E11%'
                 GROUP BY od.hn`,
                [startDate, endDate, ...chunk]
              )
              .then(([rows]) => rows)
          )
        ),
        Promise.all(
          vnChunks.map((chunk) =>
            hosPool
              .query(
                `SELECT DISTINCT od.vn FROM ovstdiag od WHERE od.vn IN (${placeholders(chunk.length)}) AND od.icd10 LIKE 'E11%'`,
                chunk
              )
              .then(([rows]) => rows)
          )
        ),
        Promise.all(
          hnChunks.map((chunk) =>
            hosPool
              .query(
                `SELECT op.hn, op.vn, DATE_FORMAT(op.vstdate, '%Y-%m-%d') AS vstdate,
                        GROUP_CONCAT(DISTINCT op.icode SEPARATOR ',') AS icodes
                 FROM opitemrece op
                 WHERE op.vstdate >= DATE_SUB(?, INTERVAL 90 DAY)
                   AND op.vstdate <= ?
                   AND op.icode IN (${icodePhs})
                   AND op.hn IN (${placeholders(chunk.length)})
                 GROUP BY op.hn, op.vn, op.vstdate`,
                [startDate, endDate, ...DM_ANTIDIABETIC_ICODES, ...chunk]
              )
              .then(([rows]) => rows)
          )
        ),
        appPool
          .query(`SELECT hn, cid, summary_remission FROM dm_remission_cohorts WHERE fiscal_year = ?`, [fiscalYear])
          .then(([rows]) => rows)
          .catch(() => []),
        Promise.all(
          cidChunks.map((chunk) =>
            hosPool
              .query(
                `SELECT TRIM(PID) AS pid, MAX(NULLIF(TRIM(Type), '')) AS type
                 FROM rcmdb.t1dm WHERE PID IN (${placeholders(chunk.length)}) GROUP BY TRIM(PID)`,
                chunk
              )
              .then(([rows]) => rows)
              .catch(() => [])
          )
        ),
        appPool
          .query(
            `SELECT TRIM(pid) AS pid, MAX(NULLIF(TRIM(type), '')) AS type
             FROM t1dm_registries WHERE pid IS NOT NULL AND pid <> '' GROUP BY TRIM(pid)`
          )
          .then(([rows]) => rows)
          .catch(() => []),
      ])

      return {
        success: true,
        data: {
          totalA1cTested,
          baseRows,
          e11Rows: e11Parts.flat(),
          sameVnRows: sameVnParts.flat(),
          rxRows: rxParts.flat(),
          cohortRows,
          t1dmRows: t1dmParts.flat(),
          t1dmMirrorRows,
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/clinical/dm-remission/lab/timeline/:hn', async (req, reply) => {
    try {
      const hn = String(req.params?.hn || '').trim()
      if (!hn) return { success: true, data: { patientRows: [], labRows: [], diagRows: [], rxRows: [] } }
      const icodePhs = placeholders(DM_ANTIDIABETIC_ICODES.length)

      const [[patientRows], [labRows], [diagRows], [rxRows]] = await Promise.all([
        hosPool.query(
          `SELECT p.hn, p.cid,
                  CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS patient_name,
                  TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) AS age_years,
                  pt.name AS pttype_name
           FROM patient p LEFT JOIN pttype pt ON pt.pttype = p.pttype
           WHERE p.hn = ? LIMIT 1`,
          [hn]
        ),
        hosPool.query(
          `SELECT lh.lab_order_number,
                  DATE_FORMAT(lh.order_date, '%Y-%m-%d') AS order_date,
                  lh.vn,
                  MAX(CASE WHEN lo.lab_items_code = 3073 AND lo.confirm = 'Y' THEN TRIM(lo.lab_order_result) ELSE NULL END) AS a1c_result,
                  MAX(CASE WHEN lo.lab_items_code = 3324 AND lo.confirm = 'Y' THEN TRIM(lo.lab_order_result) ELSE NULL END) AS fpg_result
           FROM lab_head lh
           INNER JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
           WHERE lh.hn = ? AND lo.lab_items_code IN (3073, 3324) AND lo.confirm = 'Y'
           GROUP BY lh.lab_order_number, lh.order_date, lh.vn
           HAVING a1c_result IS NOT NULL OR fpg_result IS NOT NULL
           ORDER BY lh.order_date DESC, lh.lab_order_number DESC
           LIMIT 15`,
          [hn]
        ),
        hosPool.query(
          `SELECT DATE_FORMAT(od.vstdate, '%Y-%m-%d') AS vstdate, od.vn, od.icd10, od.diagtype
           FROM ovstdiag od
           WHERE od.hn = ? AND od.icd10 LIKE 'E11%'
           ORDER BY od.vstdate DESC, od.vn DESC
           LIMIT 15`,
          [hn]
        ),
        hosPool.query(
          `SELECT DATE_FORMAT(op.vstdate, '%Y-%m-%d') AS vstdate, op.vn, op.icode, d.name AS drug_name, op.qty
           FROM opitemrece op LEFT JOIN drugitems d ON d.icode = op.icode
           WHERE op.hn = ? AND op.icode IN (${icodePhs})
           ORDER BY op.vstdate DESC, op.vn DESC
           LIMIT 25`,
          [hn, ...DM_ANTIDIABETIC_ICODES]
        ),
      ])

      return { success: true, data: { patientRows, labRows, diagRows, rxRows } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 3. FCT HOME VISITS & OPTIONS
  // =========================================================================

  fastify.post('/api/v1/clinical/fct-home-visit/ensure-schema', async (_req, reply) => {
    try {
      await ensureFctSchema()
      return { success: true, data: { ensured: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/clinical/fct-home-visit/lookup-patient/:hn', async (req, reply) => {
    try {
      const hn = String(req.params?.hn || '').trim()
      if (!hn) return { success: true, data: null }
      const [rows] = await hosPool.query(
        `SELECT
           pt.hn,
           CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
           TIMESTAMPDIFF(YEAR, pt.birthday, CURDATE()) AS age,
           CONCAT(
             IFNULL(pt.addrpart, ''),
             IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
             IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
             IF(t.name IS NOT NULL, CONCAT(' ต.', t.name), ''),
             IF(a.name IS NOT NULL, CONCAT(' อ.', a.name), ''),
             IF(c.name IS NOT NULL, CONCAT(' จ.', c.name), '')
           ) AS address
         FROM patient pt
         LEFT JOIN thaiaddress t ON t.chwpart = pt.chwpart AND t.amppart = pt.amppart AND t.tmbpart = pt.tmbpart
         LEFT JOIN thaiaddress a ON a.chwpart = pt.chwpart AND a.amppart = pt.amppart AND a.tmbpart = '00'
         LEFT JOIN thaiaddress c ON c.chwpart = pt.chwpart AND c.amppart = '00' AND c.tmbpart = '00'
         WHERE pt.hn = ?
         LIMIT 1`,
        [hn]
      )
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/clinical/fct-home-visit/options', async (_req, reply) => {
    try {
      await ensureFctSchema()
      const [rows] = await appPool.query(`${FCT_OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`)
      return { success: true, data: rows }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/clinical/fct-home-visit/options', async (req, reply) => {
    try {
      await ensureFctSchema()
      const { category, label, sortOrder = 0, isActive = true, actorName = 'system' } = req.body || {}
      const cleanLabel = String(label || '').trim()
      if (!category || !cleanLabel) {
        return reply.code(400).send({ success: false, error: 'กรุณาระบุชื่อตัวเลือก' })
      }
      const [dup] = await appPool.query(
        `SELECT id FROM fct_home_visit_options WHERE category = ? AND label = ? LIMIT 1`,
        [category, cleanLabel]
      )
      if (dup.length > 0) {
        return reply.code(409).send({ success: false, code: 'CONFLICT', error: `มีตัวเลือก "${cleanLabel}" อยู่ในหมวดหมู่นี้แล้ว` })
      }
      const created = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO fct_home_visit_options (category, label, sort_order, is_active, created_by) VALUES (?, ?, ?, ?, ?)`,
          [category, cleanLabel, sortOrder, isActive, actorName]
        )
        const [rows] = await conn.query(`${FCT_OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`, [res.insertId])
        return rows[0] ?? null
      })
      return { success: true, data: created }
    } catch (err) {
      if (isDupError(err)) {
        return reply.code(409).send({ success: false, code: 'CONFLICT', error: 'มีตัวเลือกนี้อยู่ในหมวดหมู่นี้แล้ว' })
      }
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/clinical/fct-home-visit/options/:id', async (req, reply) => {
    try {
      await ensureFctSchema()
      const id = Number(req.params?.id)
      const [existingRows] = await appPool.query(`${FCT_OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, code: 'NOT_FOUND', error: `ไม่พบตัวเลือก ID: ${id}` })
      }
      const existing = existingRows[0]
      const { label, sortOrder, isActive } = req.body || {}
      const setClauses = []
      const params = []
      if (label !== undefined) {
        const clean = String(label).trim()
        if (!clean) return reply.code(400).send({ success: false, error: 'กรุณาระบุชื่อตัวเลือก' })
        const [dup] = await appPool.query(
          `SELECT id FROM fct_home_visit_options WHERE category = ? AND label = ? AND id <> ? LIMIT 1`,
          [existing.category, clean, id]
        )
        if (dup.length > 0) {
          return reply.code(409).send({ success: false, code: 'CONFLICT', error: `มีตัวเลือก "${clean}" อยู่ในหมวดหมู่นี้แล้ว` })
        }
        setClauses.push('label = ?')
        params.push(clean)
      }
      if (sortOrder !== undefined) { setClauses.push('sort_order = ?'); params.push(sortOrder) }
      if (isActive !== undefined) { setClauses.push('is_active = ?'); params.push(isActive) }
      const updated = await withUtf8Conn(appPool, async (conn) => {
        if (setClauses.length > 0) {
          params.push(id)
          await conn.query(`UPDATE fct_home_visit_options SET ${setClauses.join(', ')} WHERE id = ?`, params)
        }
        const [rows] = await conn.query(`${FCT_OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
        return rows[0] ?? null
      })
      return { success: true, data: updated }
    } catch (err) {
      if (isDupError(err)) {
        return reply.code(409).send({ success: false, code: 'CONFLICT', error: 'มีตัวเลือกชื่อนี้อยู่ในหมวดหมู่นี้แล้ว' })
      }
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/clinical/fct-home-visit/options/:id', async (req, reply) => {
    try {
      await ensureFctSchema()
      const id = Number(req.params?.id)
      const [existingRows] = await appPool.query(`${FCT_OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, code: 'NOT_FOUND', error: `ไม่พบตัวเลือก ID: ${id}` })
      }
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query('DELETE FROM fct_home_visit_options WHERE id = ?', [id])
      })
      return { success: true, data: { id, category: existingRows[0].category } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/clinical/fct-home-visit/visits-bundle', async (req, reply) => {
    try {
      await ensureFctSchema()
      const rawFy = req.query?.fiscalYear
      const explicitFy = rawFy !== undefined && rawFy !== '' ? Number(rawFy) : undefined
      let targetFiscalYear
      let optionRows, yearRows, pcuRows, visitRows

      if (explicitFy !== undefined && Number.isFinite(explicitFy)) {
        targetFiscalYear = explicitFy
        const [o, y, p, v] = await Promise.all([
          appPool.query(`${FCT_OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`),
          appPool.query(`SELECT DISTINCT fiscal_year AS fiscalYear FROM fct_home_visits ORDER BY fiscal_year DESC`),
          appPool.query(`SELECT DISTINCT pcu_name AS pcuName FROM fct_home_visits WHERE pcu_name IS NOT NULL AND pcu_name <> ''`),
          appPool.query(`${FCT_VISIT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY visit_date DESC, id DESC`, [targetFiscalYear]),
        ])
        optionRows = o[0]; yearRows = y[0]; pcuRows = p[0]; visitRows = v[0]
      } else {
        const [y] = await appPool.query(`SELECT DISTINCT fiscal_year AS fiscalYear FROM fct_home_visits ORDER BY fiscal_year DESC`)
        yearRows = y
        const years = yearRows.map((r) => Number(r.fiscalYear)).filter((n) => Number.isFinite(n))
        targetFiscalYear = years.length > 0 ? Math.max(...years) : getCurrentThaiFiscalYear()
        const [o, p, v] = await Promise.all([
          appPool.query(`${FCT_OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`),
          appPool.query(`SELECT DISTINCT pcu_name AS pcuName FROM fct_home_visits WHERE pcu_name IS NOT NULL AND pcu_name <> ''`),
          appPool.query(`${FCT_VISIT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY visit_date DESC, id DESC`, [targetFiscalYear]),
        ])
        optionRows = o[0]; pcuRows = p[0]; visitRows = v[0]
      }
      return {
        success: true,
        data: { targetFiscalYear, optionRows, yearRows, pcuRows, visitRows },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/clinical/fct-home-visit/visits/:id', async (req, reply) => {
    try {
      await ensureFctSchema()
      const id = Number(req.params?.id)
      const [rows] = await appPool.query(`${FCT_VISIT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/clinical/fct-home-visit/visits', async (req, reply) => {
    try {
      await ensureFctSchema()
      const { fields = {}, actorName = 'system' } = req.body || {}
      const columns = []
      const phs = []
      const params = []
      for (const [k, col] of Object.entries(FCT_FIELD_TO_COL)) {
        columns.push(col)
        phs.push('?')
        params.push(fields[k] ?? null)
      }
      columns.push('created_by', 'updated_by')
      phs.push('?', '?')
      params.push(actorName, actorName)

      const created = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO fct_home_visits (${columns.join(', ')}) VALUES (${phs.join(', ')})`,
          params
        )
        const [rows] = await conn.query(`${FCT_VISIT_SELECT_SQL} WHERE id = ? LIMIT 1`, [res.insertId])
        return rows[0] ?? null
      })
      return { success: true, data: created }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/clinical/fct-home-visit/visits/:id', async (req, reply) => {
    try {
      await ensureFctSchema()
      const id = Number(req.params?.id)
      const [existingRows] = await appPool.query(`${FCT_VISIT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, code: 'NOT_FOUND', error: `ไม่พบข้อมูลการเยี่ยมบ้าน ID: ${id}` })
      }
      const { fields = {}, actorName = 'system' } = req.body || {}
      const setClauses = []
      const params = []
      for (const [k, col] of Object.entries(FCT_FIELD_TO_COL)) {
        if (fields[k] !== undefined) {
          setClauses.push(`${col} = ?`)
          params.push(fields[k])
        }
      }
      setClauses.push('updated_by = ?')
      params.push(actorName)
      params.push(id)

      const updated = await withUtf8Conn(appPool, async (conn) => {
        await conn.query(`UPDATE fct_home_visits SET ${setClauses.join(', ')} WHERE id = ?`, params)
        const [rows] = await conn.query(`${FCT_VISIT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
        return rows[0] ?? null
      })
      return { success: true, data: updated }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/clinical/fct-home-visit/visits/:id', async (req, reply) => {
    try {
      await ensureFctSchema()
      const id = Number(req.params?.id)
      const [existingRows] = await appPool.query(`${FCT_VISIT_SELECT_SQL} WHERE id = ? LIMIT 1`, [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, code: 'NOT_FOUND', error: `ไม่พบข้อมูลการเยี่ยมบ้าน ID: ${id}` })
      }
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query('DELETE FROM fct_home_visits WHERE id = ?', [id])
      })
      return { success: true, data: { id, fiscalYear: Number(existingRows[0].fiscalYear) } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/clinical/fct-home-visit/visits/batch-import', async (req, reply) => {
    try {
      await ensureFctSchema()
      const { items = [], actorName = 'system' } = req.body || {}
      if (!Array.isArray(items) || items.length === 0) {
        return {
          success: true,
          data: { insertedCount: 0, skippedDuplicateCount: 0, errorCount: 0, duplicates: [] },
        }
      }

      const [existingPairs] = await appPool.query(
        `SELECT DATE_FORMAT(visit_date, '%Y-%m-%d') AS visitDate, hn
         FROM fct_home_visits
         WHERE visit_date IS NOT NULL AND hn IS NOT NULL AND hn <> ''`
      )
      const seenKeys = new Set()
      for (const pair of existingPairs || []) {
        const cleanHn = normalizeHnVal(pair.hn)
        const cleanDate = pair.visitDate ? String(pair.visitDate).trim().slice(0, 10) : null
        if (cleanHn && cleanDate) seenKeys.add(`${cleanDate}|${cleanHn}`)
      }

      const columns = [...Object.values(FCT_FIELD_TO_COL), 'created_by', 'updated_by']
      const insertSql = `INSERT INTO fct_home_visits (${columns.join(', ')}) VALUES (${placeholders(columns.length)})`
      const fieldKeys = Object.keys(FCT_FIELD_TO_COL)

      const toInsert = []
      const duplicates = []
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        const cleanHn = normalizeHnVal(item.hn)
        const cleanDate = item.visitDate ? String(item.visitDate).trim().slice(0, 10) : null
        if (cleanHn && cleanDate) {
          const key = `${cleanDate}|${cleanHn}`
          if (seenKeys.has(key)) {
            duplicates.push({
              rowNumber: idx + 1,
              visitDate: cleanDate,
              hn: cleanHn,
              patientName: String(item.patientName || '').trim(),
            })
            continue
          }
          seenKeys.add(key)
        }
        const params = fieldKeys.map((k) => item[k] ?? null)
        params.push(actorName, actorName)
        toInsert.push(params)
      }

      if (toInsert.length > 0) {
        await withUtf8Tx(appPool, async (conn) => {
          for (const params of toInsert) {
            await conn.query(insertSql, params)
          }
        })
      }

      return {
        success: true,
        data: {
          insertedCount: toInsert.length,
          skippedDuplicateCount: duplicates.length,
          errorCount: 0,
          duplicates,
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })
}
