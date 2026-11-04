/**
 * Palliative Care Routes
 * - Clinical RCM Palliative Care (/api/v1/clinical/rcm/palliative-care)
 * - Palliative Care Registry CRUD & Visits (/api/v1/app/palliative-care/*)
 */
export default async function palliativeRoutes(fastify, options) {
  const { pools } = options;
  const { hosPool, appPool } = pools;
  const logger = fastify.log;

// 1.16 RCM Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด
fastify.get('/api/v1/clinical/rcm/palliative-care', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'รายชื่อผู้ป่วย Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด',
    querystring: {
      type: 'object',
      properties: {
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        ucOnly: { type: 'string' },
        filterType: { type: 'string', enum: ['ALL', 'Chronic', 'Opioid', 'Death'] },
        search: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { startDate = '', endDate = '', ucOnly = 'false', filterType = 'ALL', search = '' } = req.query || {}
  try {
    const ds1 = startDate || new Date().toISOString().slice(0, 10)
    const ds2 = endDate || ds1

    const sql = `
      SELECT 
        o.vn,
        IFNULL(pt.cid, '') AS cid,
        o.hn,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        IFNULL(cc.AuthenCode, '') AS authencode,
        IFNULL(o.pttype, '') AS pttype,
        IFNULL(ptt.hipdata_code, '') AS inscl,
        IFNULL(ptt.name, o.pttype) AS pttypename,
        CONCAT(IFNULL(pt.addrpart,''), ' ม.', IFNULL(pt.moopart,''), ' ', IFNULL(pt.road,'')) AS address,
        COALESCE(NULLIF(pt.mobile_phone_number,''), NULLIF(pt.informtel,''), '') AS tel,
        IFNULL(s.cc, '') AS cc,
        IFNULL(k.department, o.main_dep) AS room,
        IFNULL(sp.name, o.spclty) AS spclty,
        CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) AS Diag,
        CONCAT_WS(',', v.op0, v.op1, v.op2, v.op3, v.op4, v.op5) AS Oper,
        IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'Z515', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Z515,
        IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'B2[0-4]|^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Dx,
        IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'Z718', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Z718,
        IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^C|D3[7-9]|D4', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Cancer,
        IF(GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code REGEXP '^M', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Drug,
        IFNULL(pt.death, 'N') AS death,
        DATE_FORMAT(pt.deathday, '%Y-%m-%d') AS death_date,
        IF(e.hn IS NULL, ' ', 'Y') AS OK,
        IFNULL(e.PallativeCare, 0) AS compensated,
        CONCAT_WS('#', e.rep, e.id) AS rep_invoice,
        CONCAT_WS('#', m.eclaim_no, m.id) AS eclaim_no,
        m.senddate,
        CASE 
          WHEN m.status IS NOT NULL THEN CONCAT(m.status, ' :: ', IFNULL(ecs.name, m.status))
          ELSE '- :: ยังไม่ได้ส่ง'
        END AS status_Eclaim,
        IFNULL(m.filename_send, '') AS filename_send
      FROM ovst o
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn 
      JOIN ovstdiag dx ON dx.vn = o.vn
      LEFT JOIN opdscreen s ON s.vn = o.vn
      LEFT JOIN opitemrece oo ON oo.vn = o.vn 
      LEFT JOIN drugitems d ON d.icode = oo.icode
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype 
      LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
      LEFT JOIN spclty sp ON sp.spclty = o.spclty
      LEFT JOIN rcmdb.repeclaim e ON e.hn = o.hn AND e.PallativeCare > 0
      LEFT JOIN (
        SELECT 
          m.opdseq AS vn,
          MAX(m.eclaim_no) AS eclaim_no,
          SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT IF(m.status='4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
          SUBSTRING_INDEX(GROUP_CONCAT(m.maininscl ORDER BY m.eclaim_no DESC), ',', 1) AS maininscl,
          SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status,
          SUBSTRING_INDEX(GROUP_CONCAT(m.code_id ORDER BY m.eclaim_no DESC), ',', 1) AS errorcode,
          SUBSTRING_INDEX(GROUP_CONCAT(m.tran_id ORDER BY m.eclaim_no DESC), ',', 1) AS id,
          SUBSTRING_INDEX(GROUP_CONCAT(UCASE(m.filename_send) ORDER BY m.eclaim_no DESC), ',', 1) AS filename_send,
          SUBSTRING_INDEX(GROUP_CONCAT(pp.child_dob ORDER BY m.eclaim_no DESC), ',', 1) AS vstdate,
          SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(m.date_send, m.filename_send) ORDER BY m.eclaim_no DESC), ',', 1) AS senddate
        FROM eclaimdb.m_registerdata m
        JOIN eclaimdb.m_ppcom pp ON pp.eclaim_no = m.eclaim_no 
        WHERE pp.itemname REGEXP '30001'
          AND m.person_type = '1'
          AND m.opdseq IS NOT NULL
        GROUP BY m.opdseq
      ) m ON m.vn = o.vn
      LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
      LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
      WHERE o.vstdate BETWEEN ? AND ?
        AND IFNULL(o.pttype, '') NOT IN ('H1', '35', '36')
        AND dx.icd10 REGEXP 'B2[0-4]|^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185|Z515|Z718'
      GROUP BY o.vn
      HAVING Dx = 'Y'
      ORDER BY o.hn ASC
    `;
    const [rawRows] = await hosPool.query(sql, [ds1, ds2])

    let mapped = (rawRows || []).map((r, idx) => {
      const z515 = String(r.Z515 || '').trim()
      const errorName = !z515 ? 'ไม่พบรหัส Z515' : ''
      let formattedSendDate = null
      if (r.senddate) {
        const rawDate = String(r.senddate).trim()
        const match = rawDate.match(/(\d{4})(\d{2})(\d{2})/)
        if (match) formattedSendDate = `${match[1]}-${match[2]}-${match[3]}`
        else formattedSendDate = rawDate
      }
      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        cid: String(r.cid || ''),
        hn: String(r.hn || ''),
        ptname: String(r.ptname || '').trim(),
        vstdate: String(r.vstdate || ''),
        authencode: String(r.authencode || '').trim(),
        pttype: String(r.pttype || '').trim(),
        inscl: String(r.inscl || '').trim(),
        pttypename: String(r.pttypename || '').trim(),
        address: String(r.address || '').trim(),
        tel: String(r.tel || '').trim(),
        cc: String(r.cc || '').trim(),
        room: String(r.room || '').trim(),
        spclty: String(r.spclty || '').trim(),
        diag: String(r.Diag || ''),
        oper: String(r.Oper || ''),
        z515,
        dx: String(r.Dx || '').trim(),
        z718: String(r.Z718 || '').trim(),
        cancer: String(r.Cancer || '').trim(),
        drug: String(r.Drug || '').trim(),
        death: String(r.death || 'N').trim(),
        death_date: r.death_date ? String(r.death_date) : null,
        ok: String(r.OK || ' ').trim(),
        compensated: Number(r.compensated || 0),
        rep_invoice: String(r.rep_invoice || '').trim(),
        eclaim_no: String(r.eclaim_no || '').trim(),
        senddate: formattedSendDate,
        status_eclaim: String(r.status_Eclaim || '').trim(),
        filename_send: String(r.filename_send || '').trim(),
        error_name: errorName
      }
    })

    mapped = mapped.filter(i => !['H1', '35', '36'].includes(i.pttype))
    if (ucOnly === 'true') mapped = mapped.filter(i => i.inscl === 'UCS')
    if (filterType === 'Chronic') mapped = mapped.filter(i => i.z718 === 'Y' && i.dx === 'Y')
    else if (filterType === 'Opioid') mapped = mapped.filter(i => i.cancer === 'Y' && i.drug === 'Y')
    else if (filterType === 'Death') mapped = mapped.filter(i => i.death === 'Y')

    if (search && search.trim()) {
      const s = search.trim().toLowerCase()
      mapped = mapped.filter(i => i.hn.toLowerCase().includes(s) || i.ptname.toLowerCase().includes(s) || i.cid.includes(s) || i.vn.includes(s) || i.diag.toLowerCase().includes(s))
    }

    mapped.forEach((item, i) => { item.no = i + 1 })
    const uniquePatients = new Set(mapped.map(i => i.hn))

    const summary = {
      totalVisits: mapped.length,
      totalPatients: uniquePatients.size,
      advanceCarePlanCount: mapped.filter(i => i.z718 === 'Y' && i.dx === 'Y').length,
      opioidCount: mapped.filter(i => i.cancer === 'Y' && i.drug === 'Y').length,
      hasZ515Count: mapped.filter(i => i.z515 === 'Y').length,
      missingZ515Count: mapped.filter(i => !i.z515).length,
      paidCount: mapped.filter(i => i.ok === 'Y').length,
      totalCompensated: mapped.reduce((sum, i) => sum + i.compensated, 0),
      deceasedCount: mapped.filter(i => i.death === 'Y').length
    }

    return {
      success: true,
      ds1,
      ds2,
      summary,
      items: mapped
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})



// 4.9 Palliative Care Registry Services
let visitsTableEnsured = false
async function ensureVisitsTable() {
  if (visitsTableEnsured) return
  try {
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS palliative_care_registry_visits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        registry_id INT NOT NULL,
        visit_no INT NOT NULL,
        visit_date VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pcrv_registry_id (registry_id),
        INDEX idx_pcrv_visit_date (visit_date),
        UNIQUE KEY uq_pcrv_reg_visit (registry_id, visit_no),
        CONSTRAINT fk_pcrv_registry FOREIGN KEY (registry_id) REFERENCES palliative_care_registries(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    const [cntRows] = await appPool.query('SELECT COUNT(*) AS total FROM palliative_care_registry_visits')
    if (cntRows && Number(cntRows[0]?.total || 0) === 0) {
      const [regs] = await appPool.query(`
        SELECT id, visit_1_date, visit_2_date, visit_3_date, visit_4_date, visit_5_date, visit_6_date
        FROM palliative_care_registries
      `)
      for (const r of regs) {
        for (let v = 1; v <= 6; v++) {
          const vd = r[`visit_${v}_date`]
          if (vd && String(vd).trim()) {
            await appPool.query(`
              INSERT INTO palliative_care_registry_visits (registry_id, visit_no, visit_date)
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE visit_date = VALUES(visit_date)
            `, [r.id, v, String(vd).trim()]).catch(() => {})
          }
        }
      }
    }
    visitsTableEnsured = true
  } catch (err) {
    logger.warn({ err }, 'ensureVisitsTable notice')
  }
}

  // 4.9.0 Find Registry by HN (Named API for duplicate prevention)
  fastify.get('/api/v1/app/palliative-care/registries/by-hn/:hn', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'ค้นหาข้อมูลทะเบียน Palliative Care รายคนด้วย HN เพื่อป้องกันข้อมูลซ้ำซ้อน',
      params: {
        type: 'object',
        required: ['hn'],
        properties: {
          hn: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { hn } = req.params
    const cleanHn = /^\d+$/.test(hn.trim()) ? hn.trim().padStart(7, '0') : hn.trim()
    try {
      const [rows] = await appPool.query(
        'SELECT id, hn, patient_name AS patientName FROM palliative_care_registries WHERE hn = ? LIMIT 1',
        [cleanHn]
      )
      if (!rows || rows.length === 0) {
        return { success: true, exists: false, data: null }
      }
      return { success: true, exists: true, data: rows[0] }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/palliative-care/registries', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'ดึงรายชื่อและสถิติทะเบียนผู้ป่วย Palliative Care พร้อมระบบค้นหาและแบ่งหน้า',
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          registrationStatus: { type: 'string' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 50 }
        }
      }
    }
  }, async (req, reply) => {
    const { search, registrationStatus, page = 1, limit = 50 } = req.query || {}
    try {
      await ensureVisitsTable().catch(() => {})

      const conditions = []
      const params = []

      if (search && search.trim()) {
        const term = `%${search.trim()}%`
        conditions.push('(hn LIKE ? OR patient_name LIKE ? OR icd10_principal LIKE ? OR phone LIKE ?)')
        params.push(term, term, term, term)
      }

      if (registrationStatus && registrationStatus !== 'ALL') {
        conditions.push('registration_status = ?')
        params.push(registrationStatus)
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const pageNum = Math.max(1, parseInt(page, 10) || 1)
      const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50))
      const offset = (pageNum - 1) * limitNum

      const [rows, countRows, statsRows] = await Promise.all([
        appPool.query(
          `SELECT id, hn, patient_name AS patientName, address, phone,
                  icd10_principal AS icd10Principal, icd10_palliative AS icd10Palliative,
                  project_code AS projectCode, registration_status AS registrationStatus,
                  registered_date AS registeredDate,
                  visit_1_date AS visit1Date,
                  visit_2_date AS visit2Date,
                  visit_3_date AS visit3Date,
                  visit_4_date AS visit4Date,
                  visit_5_date AS visit5Date,
                  visit_6_date AS visit6Date,
                  death_date AS deathDate,
                  created_by AS createdBy, updated_by AS updatedBy,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM palliative_care_registries
           ${whereSql}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [...params, limitNum, offset]
        ).then(([r]) => r),
        appPool.query(
          `SELECT COUNT(*) AS total FROM palliative_care_registries ${whereSql}`,
          params
        ).then(([r]) => r[0]?.total || 0),
        appPool.query(
          `SELECT
             COUNT(*) AS total,
             COUNT(CASE WHEN registration_status = 'ดำเนินการเรียบร้อย' OR registered_date IS NOT NULL THEN 1 END) AS registered,
             COUNT(CASE WHEN (registration_status = 'ยังไม่ได้ดำเนินการ' OR registration_status IS NULL) AND registered_date IS NULL THEN 1 END) AS pendingRegistration,
             0 AS claimed,
             0 AS paid,
             0 AS deny
           FROM palliative_care_registries`
        ).then(([r]) => r[0] || {})
      ])

      if (rows && rows.length > 0) {
        const ids = rows.map((r) => r.id)
        try {
          const [visitRows] = await appPool.query(
            `SELECT id, registry_id AS registryId, visit_no AS visitNo, visit_date AS visitDate
             FROM palliative_care_registry_visits
             WHERE registry_id IN (${ids.map(() => '?').join(',')})
             ORDER BY visit_no ASC`,
            ids
          )
          const visitsByRegId = new Map()
          for (const v of visitRows) {
            if (!visitsByRegId.has(v.registryId)) visitsByRegId.set(v.registryId, [])
            visitsByRegId.get(v.registryId).push({ id: v.id, visitNo: v.visitNo, visitDate: v.visitDate })
          }
          for (const row of rows) {
            if (visitsByRegId.has(row.id)) {
              row.visits = visitsByRegId.get(row.id)
            } else {
              row.visits = []
              for (let v = 1; v <= 6; v++) {
                const vd = row[`visit${v}Date`]
                if (vd && String(vd).trim()) {
                  row.visits.push({ visitNo: v, visitDate: String(vd).trim() })
                }
              }
            }
          }
        } catch {
          for (const row of rows) {
            row.visits = []
            for (let v = 1; v <= 6; v++) {
              const vd = row[`visit${v}Date`]
              if (vd && String(vd).trim()) {
                row.visits.push({ visitNo: v, visitDate: String(vd).trim() })
              }
            }
          }
        }
      }

      const total = Number(countRows || 0)
      const stats = {
        total: Number(statsRows.total || 0),
        registered: Number(statsRows.registered || 0),
        pendingRegistration: Number(statsRows.pendingRegistration || 0),
        claimed: Number(statsRows.claimed || 0),
        paid: Number(statsRows.paid || 0),
        deny: Number(statsRows.deny || 0)
      }

      return {
        success: true,
        items: rows,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        stats
      }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/app/palliative-care/registries/:id', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'ดึงข้อมูลผู้ป่วย Palliative Care รายบุคคลตาม ID',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params
    try {
      await ensureVisitsTable().catch(() => {})
      const [rows] = await appPool.query(
        `SELECT id, hn, patient_name AS patientName, address, phone,
                icd10_principal AS icd10Principal, icd10_palliative AS icd10Palliative,
                project_code AS projectCode, registration_status AS registrationStatus,
                registered_date AS registeredDate,
                visit_1_date AS visit1Date,
                visit_2_date AS visit2Date,
                visit_3_date AS visit3Date,
                visit_4_date AS visit4Date,
                visit_5_date AS visit5Date,
                visit_6_date AS visit6Date,
                death_date AS deathDate,
                created_by AS createdBy, updated_by AS updatedBy,
                created_at AS createdAt, updated_at AS updatedAt
         FROM palliative_care_registries
         WHERE id = ? LIMIT 1`,
        [id]
      )
      if (rows.length === 0) {
        reply.code(404); return { success: false, error: 'ไม่พบข้อมูลทะเบียนผู้ป่วย' }
      }
      const item = rows[0]
      try {
        const [visitRows] = await appPool.query(
          `SELECT id, registry_id AS registryId, visit_no AS visitNo, visit_date AS visitDate
           FROM palliative_care_registry_visits
           WHERE registry_id = ?
           ORDER BY visit_no ASC`,
          [id]
        )
        if (visitRows && visitRows.length > 0) {
          item.visits = visitRows.map((v) => ({ id: v.id, visitNo: v.visitNo, visitDate: v.visitDate }))
        } else {
          item.visits = []
          for (let v = 1; v <= 6; v++) {
            const vd = item[`visit${v}Date`]
            if (vd && String(vd).trim()) {
              item.visits.push({ visitNo: v, visitDate: String(vd).trim() })
            }
          }
        }
      } catch {
        item.visits = []
        for (let v = 1; v <= 6; v++) {
          const vd = item[`visit${v}Date`]
          if (vd && String(vd).trim()) {
            item.visits.push({ visitNo: v, visitDate: String(vd).trim() })
          }
        }
      }
      return { success: true, data: item }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/app/palliative-care/registries', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'ลงทะเบียนผู้ป่วย Palliative Care ใหม่',
      body: {
        type: 'object',
        required: ['hn', 'patientName'],
        properties: {
          hn: { type: 'string' },
          patientName: { type: 'string' },
          address: { type: ['string', 'null'] },
          phone: { type: ['string', 'null'] },
          icd10Principal: { type: ['string', 'null'] },
          icd10Palliative: { type: ['string', 'null'] },
          projectCode: { type: ['string', 'null'] },
          registrationStatus: { type: 'string' },
          registeredDate: { type: ['string', 'null'] },
          visit1Date: { type: ['string', 'null'] },
          visit2Date: { type: ['string', 'null'] },
          visit3Date: { type: ['string', 'null'] },
          visit4Date: { type: ['string', 'null'] },
          visit5Date: { type: ['string', 'null'] },
          visit6Date: { type: ['string', 'null'] },
          deathDate: { type: ['string', 'null'] },
          createdBy: { type: ['string', 'null'] },
          visits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                visitNo: { type: 'integer' },
                visitDate: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    let {
      hn, patientName, address = null, phone = null,
      icd10Principal = null, icd10Palliative = null, projectCode = null,
      registrationStatus = 'ยังไม่ได้ดำเนินการ',
      registeredDate = null,
      visit1Date = null,
      visit2Date = null,
      visit3Date = null,
      visit4Date = null,
      visit5Date = null,
      visit6Date = null,
      deathDate = null,
      createdBy = null,
      visits = null
    } = req.body || {}

    if (!hn || !patientName) {
      reply.code(400); return { success: false, error: 'กรุณาระบุ HN และชื่อ-สกุลผู้ป่วย' }
    }

    if (Array.isArray(visits)) {
      const vMap = new Map()
      visits.forEach((v) => {
        if (v && v.visitNo && v.visitDate) vMap.set(Number(v.visitNo), String(v.visitDate).trim())
      })
      visit1Date = vMap.get(1) || null
      visit2Date = vMap.get(2) || null
      visit3Date = vMap.get(3) || null
      visit4Date = vMap.get(4) || null
      visit5Date = vMap.get(5) || null
      visit6Date = vMap.get(6) || null
    }

    try {
      const [res] = await appPool.query(
        `INSERT INTO palliative_care_registries (
          hn, patient_name, address, phone, icd10_principal, icd10_palliative, project_code,
          registration_status, registered_date,
          visit_1_date, visit_2_date, visit_3_date, visit_4_date, visit_5_date, visit_6_date,
          death_date,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?,
          ?, ?, NOW(), NOW()
        )`,
        [
          hn.trim(), patientName.trim(), address, phone, icd10Principal, icd10Palliative, projectCode,
          registrationStatus, registeredDate,
          visit1Date, visit2Date, visit3Date, visit4Date, visit5Date, visit6Date,
          deathDate,
          createdBy, createdBy
        ]
      )
      const insertId = res.insertId
      await ensureVisitsTable().catch(() => {})
      if (Array.isArray(visits) && visits.length > 0) {
        for (const v of visits) {
          if (v && v.visitNo && v.visitDate && String(v.visitDate).trim()) {
            await appPool.query(
              'INSERT INTO palliative_care_registry_visits (registry_id, visit_no, visit_date) VALUES (?, ?, ?)',
              [insertId, Number(v.visitNo), String(v.visitDate).trim()]
            ).catch(() => {})
          }
        }
      } else {
        for (let v = 1; v <= 6; v++) {
          const vd = req.body[`visit${v}Date`]
          if (vd && String(vd).trim()) {
            await appPool.query(
              'INSERT INTO palliative_care_registry_visits (registry_id, visit_no, visit_date) VALUES (?, ?, ?)',
              [insertId, v, String(vd).trim()]
            ).catch(() => {})
          }
        }
      }
      return { success: true, insertId }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.put('/api/v1/app/palliative-care/registries/:id', {
    schema: {
      tags: ['4. Website Application Services'],
      summary: 'แก้ไขข้อมูลผู้ป่วย Palliative Care ตาม ID',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params
    const body = req.body || {}

    if (Array.isArray(body.visits)) {
      const vMap = new Map()
      body.visits.forEach((v) => {
        if (v && v.visitNo && v.visitDate) vMap.set(Number(v.visitNo), String(v.visitDate).trim())
      })
      body.visit1Date = vMap.get(1) || null
      body.visit2Date = vMap.get(2) || null
      body.visit3Date = vMap.get(3) || null
      body.visit4Date = vMap.get(4) || null
      body.visit5Date = vMap.get(5) || null
      body.visit6Date = vMap.get(6) || null
    }

    const fieldMap = {
      patientName: 'patient_name',
      address: 'address',
      phone: 'phone',
      icd10Principal: 'icd10_principal',
      icd10Palliative: 'icd10_palliative',
      projectCode: 'project_code',
      registrationStatus: 'registration_status',
      registeredDate: 'registered_date',
      visit1Date: 'visit_1_date',
      visit2Date: 'visit_2_date',
      visit3Date: 'visit_3_date',
      visit4Date: 'visit_4_date',
      visit5Date: 'visit_5_date',
      visit6Date: 'visit_6_date',
      deathDate: 'death_date',
      updatedBy: 'updated_by'
    }

    const updates = []
    const params = []
    for (const [key, col] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${col} = ?`)
        params.push(body[key])
      }
    }

    if (updates.length === 0 && !Array.isArray(body.visits)) {
      reply.code(400); return { success: false, error: 'ไม่มีข้อมูลที่ต้องการอัปเดต' }
    }

    try {
      let affectedRows = 0
      if (updates.length > 0) {
        updates.push('updated_at = NOW()')
        params.push(id)
        const [res] = await appPool.query(
          `UPDATE palliative_care_registries SET ${updates.join(', ')} WHERE id = ?`,
          params
        )
        affectedRows = res.affectedRows
      }

      if (Array.isArray(body.visits)) {
        await ensureVisitsTable().catch(() => {})
        await appPool.query('DELETE FROM palliative_care_registry_visits WHERE registry_id = ?', [id])
        for (const v of body.visits) {
          if (v && v.visitNo && v.visitDate && String(v.visitDate).trim()) {
            await appPool.query(
              'INSERT INTO palliative_care_registry_visits (registry_id, visit_no, visit_date) VALUES (?, ?, ?)',
              [id, Number(v.visitNo), String(v.visitDate).trim()]
            )
          }
        }
      }

      return { success: true, affectedRows }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.delete('/api/v1/app/palliative-care/registries/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบข้อมูลผู้ป่วย Palliative Care ตาม ID',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [res] = await appPool.query('DELETE FROM palliative_care_registries WHERE id = ?', [id])
    if (res.affectedRows === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข้อมูลที่ต้องการลบ' }
    }
    return { success: true, message: 'ลบข้อมูลสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

}
