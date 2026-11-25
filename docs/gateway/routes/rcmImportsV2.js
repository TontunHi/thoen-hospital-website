/**
 * RCM Seamless & T1DM Imports V2 Named API Routes (Phase 1B Step 3)
 * Eliminates all raw SQL from rcmSeamlessImportService.ts, seamless-import/typesAndParsers.ts,
 * and rcmT1dmImportService.ts.
 */

const DEFAULT_HOSPCODE = '11152'

async function safeQuery(pool, sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params)
    return rows || []
  } catch {
    return []
  }
}

export default async function rcmImportsV2Routes(fastify, { pools }) {
  const { hosPool, appPool } = pools
  const webPool = pools.webPool || appPool

  // ── Seamless Import Endpoints ──────────────────────────────────────────────

  fastify.post('/api/v1/clinical/rcm/seamless-v2/lookup-budget', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ค้นหาข้อมูลการโอนเงินงบประมาณจาก nhso_budget' } }, async (request) => {
    const cleanPayNo = String(request.body?.payNo || '').replace(/[^a-zA-Z0-9_-]/g, '')
    if (!cleanPayNo) return { success: true, data: null }
    const rows = await safeQuery(
      hosPool,
      `SELECT DATE_FORMAT(MAX(paydate), '%Y-%m-%d') AS paydate, MAX(accountcode) AS accountcode
       FROM rcmdb.nhso_budget WHERE payno REGEXP ? LIMIT 1`,
      [cleanPayNo]
    )
    return { success: true, data: rows[0] || null }
  })

  fastify.post('/api/v1/clinical/rcm/seamless-v2/resolve-hospcode', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'แปลงชื่อหน่วยบริการเป็นรหัส Hospcode 5 หลัก' } }, async (request) => {
    const hospName = String(request.body?.hospName || '').trim()
    if (!hospName) return { success: true, hospcode: '' }
    const cleanedName = hospName.replace(/^โรงพยาบาล/, '').trim() || hospName
    const rows = await safeQuery(
      hosPool,
      `SELECT hospcode FROM hospcode
       WHERE name = ? OR name = ? OR CONCAT(IFNULL(hosptype, ''), name) LIKE ?
       LIMIT 1`,
      [hospName, cleanedName, `%${cleanedName}%`]
    )
    return { success: true, hospcode: rows[0]?.hospcode ? String(rows[0].hospcode).trim() : '' }
  })

  fastify.post('/api/v1/clinical/rcm/seamless-v2/enrich-import', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'นำเข้าและเสริมข้อมูล Seamless Claim Rep (V2)' } }, async (request) => {
    const body = request.body || {}
    const napNumbers = Array.isArray(body.napNumbers) ? body.napNumbers.filter(Boolean) : []
    const cids = Array.isArray(body.cids) ? body.cids.filter(Boolean) : []
    const hnsMissing = Array.isArray(body.hnsMissing) ? body.hnsMissing.filter(Boolean) : []
    const ovstLookup = body.ovstLookup || null
    const iptLookup = body.iptLookup || null

    const napRows = []
    for (let i = 0; i < napNumbers.length; i += 500) {
      const chunk = napNumbers.slice(i, i + 500)
      const ph = chunk.map(() => '?').join(',')
      const r = await safeQuery(
        hosPool,
        `SELECT c.nap_number, pt.cid FROM clinicmember c JOIN patient pt ON pt.hn = c.hn
         WHERE c.nap_number IN (${ph}) AND pt.cid IS NOT NULL AND pt.cid <> ''`,
        chunk
      )
      napRows.push(...r)
    }

    const cidRows = []
    for (let i = 0; i < cids.length; i += 500) {
      const chunk = cids.slice(i, i + 500)
      const ph = chunk.map(() => '?').join(',')
      const r = await safeQuery(
        hosPool,
        `SELECT cid, hn, TRIM(CONCAT(COALESCE(pname, ''), COALESCE(fname, ''), ' ', COALESCE(lname, ''))) AS ptname
         FROM patient WHERE cid IN (${ph})`,
        chunk
      )
      cidRows.push(...r)
    }

    const hnRows = []
    for (let i = 0; i < hnsMissing.length; i += 500) {
      const chunk = hnsMissing.slice(i, i + 500)
      const ph = chunk.map(() => '?').join(',')
      const r = await safeQuery(
        hosPool,
        `SELECT hn, cid, TRIM(CONCAT(COALESCE(pname, ''), COALESCE(fname, ''), ' ', COALESCE(lname, ''))) AS ptname
         FROM patient WHERE hn IN (${ph})`,
        chunk
      )
      hnRows.push(...r)
    }

    const ovstRows = []
    if (ovstLookup && Array.isArray(ovstLookup.hns) && ovstLookup.hns.length > 0 && ovstLookup.minDate && ovstLookup.maxDate) {
      for (let i = 0; i < ovstLookup.hns.length; i += 500) {
        const chunk = ovstLookup.hns.slice(i, i + 500)
        const ph = chunk.map(() => '?').join(',')
        const r = await safeQuery(
          hosPool,
          `SELECT vn, hn, DATE_FORMAT(vstdate, '%Y-%m-%d') AS vstdate
           FROM ovst WHERE hn IN (${ph}) AND vstdate BETWEEN ? AND ?`,
          [...chunk, ovstLookup.minDate, ovstLookup.maxDate]
        )
        ovstRows.push(...r)
      }
    }

    const iptRows = []
    if (iptLookup && Array.isArray(iptLookup.hns) && iptLookup.hns.length > 0 && iptLookup.minDate && iptLookup.maxDate) {
      for (let i = 0; i < iptLookup.hns.length; i += 500) {
        const chunk = iptLookup.hns.slice(i, i + 500)
        const ph = chunk.map(() => '?').join(',')
        const r = await safeQuery(
          hosPool,
          `SELECT an, hn, DATE_FORMAT(regdate, '%Y-%m-%d') AS regdate
           FROM ipt WHERE hn IN (${ph}) AND regdate BETWEEN ? AND ?`,
          [...chunk, iptLookup.minDate, iptLookup.maxDate]
        )
        iptRows.push(...r)
      }
    }

    return { success: true, data: { napRows, cidRows, hnRows, ovstRows, iptRows } }
  })

  fastify.post('/api/v1/clinical/rcm/seamless-v2/preflight-check', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ตรวจสอบไฟล์ Seamless Claim ก่อนนำเข้าจริง (Preflight Check)' } }, async (request) => {
    const fileName = String(request.body?.fileName || '').trim()
    const ids = Array.isArray(request.body?.ids) ? request.body.ids.filter(Boolean) : []

    let existingFileRowCount = 0
    if (fileName) {
      const cntRows = await safeQuery(
        hosPool,
        `SELECT COUNT(*) AS cnt FROM rcmdb.seamless WHERE FileName = ?`,
        [fileName]
      )
      existingFileRowCount = Number(cntRows[0]?.cnt || 0)
    }

    const existingIds = []
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500)
      const ph = chunk.map(() => '?').join(',')
      const rows = await safeQuery(hosPool, `SELECT ID FROM rcmdb.seamless WHERE ID IN (${ph})`, chunk)
      for (const r of rows) {
        const id = r.ID ?? r.id
        if (id) existingIds.push(String(id).trim())
      }
    }

    return { success: true, data: { existingFileRowCount, existingIds } }
  })

  fastify.get('/api/v1/clinical/rcm/seamless-v2/stats', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'สรุปสถิติและยอดชดเชย Seamless Claim (V2)' } }, async (request) => {
    const myHospCode = String(request.query?.myHospCode || DEFAULT_HOSPCODE).trim().padStart(5, '0')
    const [summaryRows, topFunds, recentFiles, extraHealthRows, denyCountRows] = await Promise.all([
      safeQuery(
        hosPool,
        `SELECT COUNT(*) AS totalRows, COUNT(DISTINCT Rep) AS totalReps,
                COUNT(DISTINCT FileName) AS totalFiles,
                DATE_FORMAT(MAX(AdmDate), '%Y-%m-%d') AS latestAdmDate,
                COALESCE(SUM(Compensated), 0) AS totalCompensated
         FROM rcmdb.seamless`
      ),
      safeQuery(
        hosPool,
        `SELECT Fund AS fund, COUNT(*) AS rowCount, COALESCE(SUM(Compensated), 0) AS totalCompensated
         FROM rcmdb.seamless GROUP BY Fund ORDER BY rowCount DESC LIMIT 10`
      ),
      safeQuery(
        hosPool,
        `SELECT FileName AS fileName, COUNT(*) AS rowCount,
                DATE_FORMAT(MIN(AdmDate), '%Y-%m-%d') AS minDate,
                DATE_FORMAT(MAX(AdmDate), '%Y-%m-%d') AS maxDate,
                COALESCE(SUM(Compensated), 0) AS totalCompensated
         FROM rcmdb.seamless WHERE FileName IS NOT NULL AND FileName <> ''
         GROUP BY FileName ORDER BY MAX(AdmDate) DESC LIMIT 10`
      ),
      safeQuery(
        hosPool,
        `SELECT SUM(CASE WHEN LPAD(TRIM(IFNULL(HCode, '')), 5, '0') <> ? THEN 1 ELSE 0 END) AS otherHospCount,
                SUM(CASE WHEN PayDate IS NULL THEN 1 ELSE 0 END) AS missingPayDateCount
         FROM rcmdb.seamless`,
        [myHospCode]
      ),
      safeQuery(hosPool, `SELECT COUNT(*) AS denyCodeCount FROM rcmdb.seamless_error`),
    ])

    const summary = summaryRows[0] || {}
    const extra = extraHealthRows[0] || {}
    const deny = denyCountRows[0] || {}
    return {
      success: true,
      data: {
        totalRows: Number(summary.totalRows || 0),
        totalReps: Number(summary.totalReps || 0),
        totalFiles: Number(summary.totalFiles || 0),
        latestAdmDate: summary.latestAdmDate || null,
        totalCompensated: Number(summary.totalCompensated || 0),
        otherHospCount: Number(extra.otherHospCount || 0),
        missingPayDateCount: Number(extra.missingPayDateCount || 0),
        denyCodeCount: Number(deny.denyCodeCount || 0),
        myHospCode,
        topFunds: topFunds.map((f) => ({
          fund: f.fund || 'ไม่ระบุกองทุน',
          rowCount: Number(f.rowCount || 0),
          totalCompensated: Number(f.totalCompensated || 0),
        })),
        recentFiles: recentFiles.map((rf) => ({
          fileName: rf.fileName,
          rowCount: Number(rf.rowCount || 0),
          minDate: rf.minDate,
          maxDate: rf.maxDate,
          totalCompensated: Number(rf.totalCompensated || 0),
        })),
      },
    }
  })

  fastify.get('/api/v1/clinical/rcm/seamless-v2/ledger', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ดึงรายการบัญชีแยกรายเคส Seamless Claim Ledger (V2)' } }, async (request) => {
    const q = request.query || {}
    const myHospCode = String(q.myHospCode || DEFAULT_HOSPCODE).trim().padStart(5, '0')
    const page = Math.max(1, Number(q.page || 1))
    const exportAll = q.exportAll === 'true' || q.exportAll === true
    const pageSize = exportAll ? 50000 : Math.min(200, Math.max(1, Number(q.pageSize || 50)))
    const search = String(q.search || '').trim()
    const fundFilter = String(q.fundFilter || 'ALL').trim()
    const hospFilter = q.hospFilter === 'MINE' || q.hospFilter === 'OTHER' ? q.hospFilter : 'ALL'
    const payStatus = q.payStatus === 'PAID' || q.payStatus === 'UNPAID' ? q.payStatus : 'ALL'
    const fileName = String(q.fileName || '').trim()
    const sortBy = String(q.sortBy || 'admDate')
    const sortOrder = q.sortOrder === 'asc' ? 'ASC' : 'DESC'

    const whereClauses = ['1=1']
    const queryParams = []
    if (search) {
      const like = `%${search}%`
      whereClauses.push(
        `(ID LIKE ? OR Rep LIKE ? OR HN LIKE ? OR VN LIKE ? OR AN LIKE ? OR PID LIKE ? OR Ptname LIKE ? OR PayNo LIKE ? OR FileName LIKE ? OR Fund LIKE ?)`
      )
      queryParams.push(like, like, like, like, like, like, like, like, like, like)
    }
    if (fundFilter && fundFilter !== 'ALL') {
      whereClauses.push('Fund = ?')
      queryParams.push(fundFilter)
    }
    if (hospFilter === 'MINE') {
      whereClauses.push(`LPAD(TRIM(IFNULL(HCode, '')), 5, '0') = ?`)
      queryParams.push(myHospCode)
    } else if (hospFilter === 'OTHER') {
      whereClauses.push(`LPAD(TRIM(IFNULL(HCode, '')), 5, '0') <> ?`)
      queryParams.push(myHospCode)
    }
    if (payStatus === 'PAID') whereClauses.push('PayDate IS NOT NULL')
    else if (payStatus === 'UNPAID') whereClauses.push('PayDate IS NULL')
    if (fileName) {
      whereClauses.push('FileName = ?')
      queryParams.push(fileName)
    }
    const whereSql = whereClauses.join(' AND ')

    const sortColumnMap = {
      admDate: 'AdmDate', id: 'ID', rep: 'Rep', fund: 'Fund', hn: 'HN',
      ptname: 'Ptname', collected: 'Collected', compensated: 'Compensated',
      payDate: 'PayDate', fileName: 'FileName',
    }
    const sortCol = sortColumnMap[sortBy] || 'AdmDate'
    const offset = (page - 1) * pageSize

    const [countRows, itemRows, fundRows] = await Promise.all([
      safeQuery(hosPool, `SELECT COUNT(*) AS cnt FROM rcmdb.seamless WHERE ${whereSql}`, queryParams),
      safeQuery(
        hosPool,
        `SELECT ID AS id, YYMM AS yymm, YearBudget AS yearBudget, Fund AS fund, Period AS period,
                Rep AS rep, VN AS vn, HN AS hn, AN AS an, PID AS pid, Ptname AS ptname,
                DATE_FORMAT(AdmDate, '%Y-%m-%d') AS admDate, DATE_FORMAT(SendDate, '%Y-%m-%d') AS sendDate,
                DATE_FORMAT(RegDate, '%Y-%m-%d') AS regDate, MainInscl AS mainInscl, Department AS department,
                HCode AS hcode, HSub AS hsub, HSend AS hsend, Type AS type, SerialNo AS serialNo,
                PayNo AS payNo, DATE_FORMAT(PayDate, '%Y-%m-%d') AS payDate, YYMM_Pay AS yymmPay,
                YearBudget_Pay AS yearBudgetPay, CodeAccount AS codeAccount,
                COALESCE(Collected, 0) AS collected, COALESCE(Compensated, 0) AS compensated,
                COALESCE(NoCompensated, 0) AS noCompensated, COALESCE(PayMore, 0) AS payMore,
                COALESCE(Recall, 0) AS recall, Status AS status, Note AS note, STMID AS stmid,
                EquipCode AS equipCode, EquipName AS equipName, FileName AS fileName
         FROM rcmdb.seamless WHERE ${whereSql}
         ORDER BY ${sortCol} ${sortOrder}, ID DESC LIMIT ? OFFSET ?`,
        [...queryParams, pageSize, offset]
      ),
      safeQuery(hosPool, `SELECT DISTINCT Fund AS fund FROM rcmdb.seamless WHERE IFNULL(Fund, '') <> '' ORDER BY Fund ASC`),
    ])

    const totalCount = Number(countRows[0]?.cnt || 0)
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    return {
      success: true,
      data: {
        itemRows,
        totalCount,
        totalPages,
        page,
        pageSize,
        availableFunds: fundRows.map((f) => String(f.fund)).filter(Boolean),
        myHospCode,
      },
    }
  })

  fastify.get('/api/v1/clinical/rcm/seamless-v2/files', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ดึงรายชื่อไฟล์ Seamless ที่นำเข้าแล้ว' } }, async (request) => {
    const myHospCode = String(request.query?.myHospCode || DEFAULT_HOSPCODE).trim().padStart(5, '0')
    const rows = await safeQuery(
      hosPool,
      `SELECT FileName AS fileName, COUNT(*) AS rowCount, COUNT(DISTINCT Rep) AS repCount,
              DATE_FORMAT(MIN(AdmDate), '%Y-%m-%d') AS minDate,
              DATE_FORMAT(MAX(AdmDate), '%Y-%m-%d') AS maxDate,
              COALESCE(SUM(Collected), 0) AS totalCollected,
              COALESCE(SUM(Compensated), 0) AS totalCompensated,
              SUM(CASE WHEN LPAD(TRIM(IFNULL(HCode, '')), 5, '0') <> ? THEN 1 ELSE 0 END) AS otherHospCount,
              SUM(CASE WHEN PayDate IS NULL THEN 1 ELSE 0 END) AS missingPayDateCount
       FROM rcmdb.seamless WHERE FileName IS NOT NULL AND FileName <> ''
       GROUP BY FileName ORDER BY MAX(AdmDate) DESC, FileName ASC`,
      [myHospCode]
    )
    return { success: true, data: rows }
  })

  fastify.get('/api/v1/clinical/rcm/seamless-v2/deny-codes', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ดึงรายการรหัสปฏิเสธการจ่าย (Deny Codes) ใน Seamless' } }, async () => {
    const rows = await safeQuery(hosPool, `SELECT Code, Name FROM rcmdb.seamless_error ORDER BY Code ASC`)
    return { success: true, data: rows }
  })

  // ── T1DM Registry Import Endpoints ─────────────────────────────────────────

  fastify.get('/api/v1/clinical/rcm/t1dm-v2/raw-registries', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ดึงข้อมูลดิบทะเบียนผู้ป่วย T1DM/GDM/PDM (V2)' } }, async () => {
    const buildSql = (hospCol, includeFileName) => `
      SELECT
        t.ID AS id, IFNULL(t.Year, '') AS year, IFNULL(t.PID, '') AS pid, IFNULL(t.PtName, '') AS ptname,
        DATE_FORMAT(t.Register_Date, '%Y-%m-%d') AS regdate,
        DATE_FORMAT(t.Visit_Date, '%Y-%m-%d') AS visitdate,
        IFNULL(t.Type, '') AS type, IFNULL(t.Maininscl, '') AS maininscl,
        LPAD(TRIM(IFNULL(t.${hospCol}, '')), 5, '0') AS hospmain_code,
        IFNULL(h.name, '') AS hospmain_name,
        CONCAT_WS(':', LPAD(TRIM(IFNULL(t.${hospCol}, '')), 5, '0'), NULLIF(TRIM(h.name), '')) AS hospmain,
        ${includeFileName ? "IFNULL(t.FileName, '')" : "''"} AS filename,
        IFNULL(pt.hn, '') AS hn
      FROM rcmdb.t1dm t
      LEFT JOIN hospcode h ON h.hospcode = LPAD(TRIM(t.${hospCol}), 5, '0')
      LEFT JOIN patient pt ON pt.cid = t.PID
      ORDER BY t.Register_Date DESC, t.ID ASC
    `

    let clinicalRows = []
    try {
      const [rows] = await hosPool.query(buildSql('HospMain', true))
      clinicalRows = rows || []
    } catch (err) {
      const msg = String(err?.message || '')
      if (/HospMain/i.test(msg)) {
        try {
          const [rows] = await hosPool.query(buildSql('HCode', true))
          clinicalRows = rows || []
        } catch {
          clinicalRows = await safeQuery(hosPool, buildSql('HCode', false))
        }
      } else if (/FileName/i.test(msg)) {
        clinicalRows = await safeQuery(hosPool, buildSql('HospMain', false))
      }
    }

    const mirrorRows = await safeQuery(
      webPool,
      `SELECT id, year, pid, hn, ptname,
              DATE_FORMAT(register_date, '%Y-%m-%d') AS regdate,
              DATE_FORMAT(visit_date, '%Y-%m-%d') AS visitdate,
              type, maininscl, hospmain_code, hospmain_name, filename
       FROM t1dm_registries ORDER BY register_date DESC, id ASC`
    )

    return { success: true, data: { clinicalRows, mirrorRows } }
  })

  fastify.post('/api/v1/clinical/rcm/t1dm-v2/enrich-import', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'นำเข้าและเสริมข้อมูล HOSxP ให้ทะเบียน T1DM/GDM/PDM (V2)' } }, async (request) => {
    const body = request.body || {}
    const cids = Array.isArray(body.cids) ? body.cids.filter(Boolean) : []
    const hospCodes = Array.isArray(body.hospCodes) ? body.hospCodes.filter(Boolean) : []
    const fileName = String(body.fileName || '').trim()

    const patients = []
    for (let i = 0; i < cids.length; i += 500) {
      const chunk = cids.slice(i, i + 500)
      const ph = chunk.map(() => '?').join(',')
      const rows = await safeQuery(
        hosPool,
        `SELECT cid, hn, TRIM(CONCAT(IFNULL(pname,''), IFNULL(fname,''), ' ', IFNULL(lname,''))) AS ptname
         FROM patient WHERE cid IN (${ph})`,
        chunk
      )
      patients.push(...rows)
    }

    let hospNames = []
    if (hospCodes.length > 0) {
      const ph = hospCodes.map(() => '?').join(',')
      hospNames = await safeQuery(
        hosPool,
        `SELECT hospcode, name FROM hospcode WHERE hospcode IN (${ph})`,
        hospCodes
      )
    }

    let existingFileRowCount = 0
    if (fileName) {
      const cntRows = await safeQuery(
        hosPool,
        `SELECT COUNT(*) AS cnt FROM rcmdb.t1dm WHERE FileName = ?`,
        [fileName]
      )
      existingFileRowCount = Number(cntRows[0]?.cnt || 0)
      if (existingFileRowCount === 0) {
        const mCnt = await safeQuery(
          webPool,
          `SELECT COUNT(*) AS cnt FROM t1dm_registries WHERE filename = ?`,
          [fileName]
        )
        existingFileRowCount = Number(mCnt[0]?.cnt || 0)
      }
    }

    return { success: true, data: { patients, hospNames, existingFileRowCount } }
  })

  fastify.post('/api/v1/clinical/rcm/t1dm-v2/persist-mirror', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'บันทึกข้อมูล T1DM/GDM/PDM ลงตาราง Mirror ใน Website DB' } }, async (request) => {
    const rows = Array.isArray(request.body?.rows) ? request.body.rows : []
    if (rows.length === 0) return { success: true, savedCount: 0 }

    const conn = await webPool.getConnection()
    try {
      await conn.beginTransaction()
      let savedCount = 0
      const sql = `
        INSERT INTO t1dm_registries (
          id, year, pid, hn, ptname, maininscl, hospmain_code, hospmain_name, type, register_date, visit_date, filename, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          year = VALUES(year), pid = VALUES(pid), hn = VALUES(hn), ptname = VALUES(ptname),
          maininscl = VALUES(maininscl), hospmain_code = VALUES(hospmain_code),
          hospmain_name = VALUES(hospmain_name), type = VALUES(type),
          register_date = VALUES(register_date), visit_date = VALUES(visit_date),
          filename = VALUES(filename), updated_at = NOW()
      `
      for (const r of rows) {
        await conn.query(sql, [
          r.id, r.year || null, r.pid || null, r.hn || null, r.ptname || null,
          r.maininscl || null, r.hospmainCode || null, r.hospmainName || null,
          r.type || null, r.regdate || null, r.visitdate || null, r.fileName || null,
        ])
        savedCount++
      }
      await conn.commit()
      return { success: true, savedCount }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  })

  fastify.delete('/api/v1/clinical/rcm/t1dm-v2/delete-mirror', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ลบข้อมูล T1DM/GDM/PDM ในตาราง Mirror' } }, async (request) => {
    const body = request.body || {}
    const mode = body.mode
    const myHospCode = String(body.myHospCode || DEFAULT_HOSPCODE).trim()
    let deletedCount = 0
    try {
      if (mode === 'other_hospitals') {
        const [res] = await webPool.query(
          'DELETE FROM t1dm_registries WHERE hospmain_code IS NOT NULL AND hospmain_code <> ? AND hospmain_code <> ""',
          [myHospCode]
        )
        deletedCount = Number(res?.affectedRows || 0)
      } else if (mode === 'by_file' && body.fileName) {
        const [res] = await webPool.query('DELETE FROM t1dm_registries WHERE filename = ?', [body.fileName])
        deletedCount = Number(res?.affectedRows || 0)
      } else if (mode === 'all') {
        const [res] = await webPool.query('DELETE FROM t1dm_registries WHERE 1=1')
        deletedCount = Number(res?.affectedRows || 0)
      }
    } catch {
      // mirror table may not exist
    }
    return { success: true, deletedCount }
  })
}
