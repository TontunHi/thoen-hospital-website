// Thoen Hospital API Gateway Plugin: Palliative Care & Long Term Care (LTC) V2 Named APIs
// Consolidates cross-DB (HOSxP + Website App DB) lookup, HOSxP sync, and RCM REP enrichment.

const PALLIATIVE_DX_REGEX = /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/
const DEFAULT_ICD10_PALLIATIVE = 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)'
const DEFAULT_PROJECT_CODE = '30001, Cons01'

function normalizeHn(hn) {
  const raw = String(hn || '').trim()
  if (!raw) return ''
  return /^\d+$/.test(raw) ? raw.padStart(7, '0') : raw
}

function normalizeRegistryDateToIso(d) {
  if (!d) return ''
  const clean = String(d).trim()
  const mYmd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (mYmd) {
    let yr = parseInt(mYmd[1], 10)
    if (yr > 2500) yr -= 543
    return `${yr}-${mYmd[2].padStart(2, '0')}-${mYmd[3].padStart(2, '0')}`
  }
  const mDmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (mDmy) {
    let yr = parseInt(mDmy[3], 10)
    if (yr > 2500) yr -= 543
    return `${yr}-${mDmy[2].padStart(2, '0')}-${mDmy[1].padStart(2, '0')}`
  }
  const mDmy2 = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/)
  if (mDmy2) {
    let yr = parseInt(mDmy2[3], 10)
    yr = yr >= 50 ? 2500 + yr - 543 : 2000 + yr
    return `${yr}-${mDmy2[2].padStart(2, '0')}-${mDmy2[1].padStart(2, '0')}`
  }
  return clean
}

function isoToDisplayDmy(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return isoDate
  return `${m[3]}/${m[2]}/${m[1]}`
}

async function runTxStatements(appPool, statements) {
  if (!statements.length) return
  const BATCH = 50
  for (let i = 0; i < statements.length; i += BATCH) {
    const batch = statements.slice(i, i + BATCH)
    const conn = await appPool.getConnection()
    try {
      await conn.beginTransaction()
      for (const st of batch) {
        await conn.query(st.sql, st.params || [])
      }
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }
}

export default async function palliativeLtcV2Routes(fastify, { pools }) {
  const { hosPool, appPool } = pools

  // 1. LTC: Lookup patient from HOSxP + check existing LTC & Palliative status
  fastify.get('/api/v1/app/ltc/lookup/:hn', {
    schema: {
      tags: ['3. Website Application (Members & CMS)'],
      summary: 'ค้นหาข้อมูลผู้ป่วยจาก HOSxP พร้อมตรวจสถานะ LTC และ Palliative Care',
    }
  }, async (req, reply) => {
    try {
      const rawInput = String(req.params?.hn || '').trim()
      if (!rawInput) return { success: true, data: null }
      const cleanHn = /^\d+$/.test(rawInput) ? rawInput.padStart(7, '0') : rawInput

      const [ptRows] = await hosPool.query(
        `SELECT
          pt.hn,
          pt.cid,
          CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
          IFNULL(pt.addrpart, '') AS address,
          IFNULL(pt.moopart, '') AS moo,
          IFNULL(t.name, '') AS tambon,
          TIMESTAMPDIFF(YEAR, pt.birthday, CURDATE()) AS age
        FROM patient pt
        LEFT JOIN thaiaddress t ON t.chwpart = pt.chwpart AND t.amppart = pt.amppart AND t.tmbpart = pt.tmbpart
        WHERE pt.hn = ?
        LIMIT 1`,
        [cleanHn]
      )
      if (!ptRows || ptRows.length === 0) {
        return { success: true, data: null }
      }
      const pt = ptRows[0]

      const [[ltcRows], [palRows]] = await Promise.all([
        appPool.query(
          'SELECT id FROM long_term_care_registries WHERE hn = ? OR hn = ? LIMIT 1',
          [cleanHn, rawInput]
        ),
        appPool.query(
          'SELECT id FROM palliative_care_registries WHERE hn = ? OR hn = ? LIMIT 1',
          [cleanHn, rawInput]
        ),
      ])

      return {
        success: true,
        data: {
          hn: String(pt.hn || cleanHn),
          cid: pt.cid || null,
          patientName: pt.ptname || '',
          address: pt.address || null,
          moo: pt.moo || null,
          tambon: pt.tambon || null,
          age: pt.age !== null && pt.age !== undefined ? Number(pt.age) : null,
          isAlreadyInLtc: Boolean(ltcRows && ltcRows.length > 0),
          existingLtcId: ltcRows && ltcRows.length > 0 ? Number(ltcRows[0].id) : undefined,
          isPalliative: Boolean(palRows && palRows.length > 0),
        }
      }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 2. LTC: Sync CID & verify names against HOSxP
  fastify.post('/api/v1/app/ltc/sync-hosxp', {
    schema: {
      tags: ['3. Website Application (Members & CMS)'],
      summary: 'ซิงค์และตรวจสอบเลข CID ทะเบียน LTC กับฐานข้อมูล HOSxP',
    }
  }, async (req, reply) => {
    try {
      const recordId = req.body?.recordId ? Number(req.body.recordId) : undefined
      const actor = String(req.body?.actor || 'hosxp_sync')

      let records = []
      if (recordId) {
        const [rows] = await appPool.query(
          'SELECT id, hn, cid, patient_name AS patientName, address, moo, tambon, age, adl_score AS adlScore, area_zone AS areaZone FROM long_term_care_registries WHERE id = ? LIMIT 1',
          [recordId]
        )
        records = rows || []
      } else {
        const [rows] = await appPool.query(
          'SELECT id, hn, cid, patient_name AS patientName, address, moo, tambon, age, adl_score AS adlScore, area_zone AS areaZone FROM long_term_care_registries'
        )
        records = rows || []
      }

      if (records.length === 0) {
        return { success: true, data: { totalChecked: 0, updatedCount: 0, mismatches: [] } }
      }

      const hns = records.map((r) => normalizeHn(r.hn)).filter(Boolean)
      const hosMap = new Map()
      const CHUNK = 50
      for (let i = 0; i < hns.length; i += CHUNK) {
        const chunk = hns.slice(i, i + CHUNK)
        const ph = chunk.map(() => '?').join(',')
        const [hosRows] = await hosPool.query(
          `SELECT
            hn, cid, fname, lname,
            CONCAT(IFNULL(pname,''), IFNULL(fname,''), ' ', IFNULL(lname,'')) AS ptname,
            TIMESTAMPDIFF(YEAR, birthday, CURDATE()) AS age
          FROM patient WHERE hn IN (${ph})`,
          chunk
        )
        for (const hp of hosRows || []) {
          hosMap.set(normalizeHn(hp.hn), {
            cid: String(hp.cid || '').replace(/[^0-9]/g, '').trim(),
            ptname: String(hp.ptname || '').trim(),
            fname: String(hp.fname || '').trim(),
            lname: String(hp.lname || '').trim(),
            age: hp.age !== null && hp.age !== undefined ? Number(hp.age) : undefined,
          })
        }
      }

      const mismatches = []
      const statements = []
      let updatedCount = 0

      for (const rec of records) {
        const cleanHn = normalizeHn(rec.hn)
        const hp = hosMap.get(cleanHn)
        if (!hp) continue

        const currentNameClean = String(rec.patientName || '')
          .replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|ว่าที่ร้อยตรี)/, '')
          .trim()
        const isMatch = currentNameClean.includes(hp.fname) || currentNameClean.includes(hp.lname)
        if (!isMatch) {
          mismatches.push({
            hn: rec.hn,
            currentName: rec.patientName,
            hosName: hp.ptname,
            cid: hp.cid,
          })
        }

        const currentCleanCid = String(rec.cid || '').replace(/[^0-9]/g, '').trim()
        if (hp.cid && currentCleanCid !== hp.cid) {
          statements.push({
            sql: 'UPDATE long_term_care_registries SET cid = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
            params: [hp.cid, actor, rec.id],
          })
          updatedCount++
        }
      }

      if (statements.length > 0) {
        await runTxStatements(appPool, statements)
      }

      return {
        success: true,
        data: {
          totalChecked: records.length,
          updatedCount,
          mismatches,
        }
      }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 3. Palliative Care: Lookup patient demographics, Clinic 47, ICD10 principal diagnosis, and LTC/Registry status
  fastify.get('/api/v1/app/palliative-care/lookup/:hn', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ค้นหาข้อมูลผู้ป่วย Palliative Care จาก HOSxP (รองรับ HN หรือ AN 9 หลัก)',
    }
  }, async (req, reply) => {
    try {
      const rawInput = String(req.params?.hn || '').trim()
      if (!rawInput) return { success: true, data: null }

      let cleanHn = /^\d+$/.test(rawInput) ? rawInput.padStart(7, '0') : rawInput
      let resolvedAn = null

      if (/^\d{9}$/.test(rawInput)) {
        try {
          const [anLookup] = await hosPool.query('SELECT hn, an FROM an_stat WHERE an = ? LIMIT 1', [rawInput])
          if (anLookup && anLookup.length > 0 && anLookup[0].hn) {
            cleanHn = String(anLookup[0].hn).padStart(7, '0')
            resolvedAn = String(anLookup[0].an).trim()
          }
        } catch {
          // ignore AN lookup failure
        }
      }

      const [
        [ptRows],
        [cmRows],
        [anRows],
        [opdRows],
        [existingRows],
        [ltcRows],
      ] = await Promise.all([
        hosPool.query(
          `SELECT
            pt.hn,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            CONCAT(
              IFNULL(pt.addrpart, ''),
              IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
              IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
              IF(t.name IS NOT NULL, CONCAT(' ต.', t.name), ''),
              IF(a.name IS NOT NULL, CONCAT(' อ.', a.name), '')
            ) AS address,
            COALESCE(
              NULLIF(TRIM(pt.mobile_phone_number), ''),
              NULLIF(TRIM(pt.informtel), ''),
              NULLIF(TRIM(pt.hometel), ''),
              NULLIF(TRIM(pt.worktel), ''),
              ''
            ) AS phone,
            IFNULL(pt.death, 'N') AS death,
            DATE_FORMAT(pt.deathday, '%Y-%m-%d') AS death_date
          FROM patient pt
          LEFT JOIN thaiaddress t ON t.chwpart = pt.chwpart AND t.amppart = pt.amppart AND t.tmbpart = pt.tmbpart
          LEFT JOIN thaiaddress a ON a.chwpart = pt.chwpart AND a.amppart = pt.amppart AND a.tmbpart = '00'
          WHERE pt.hn = ?
          LIMIT 1`,
          [cleanHn]
        ),
        hosPool.query(
          `SELECT hn, clinic, DATE_FORMAT(regdate, '%Y-%m-%d') as regdate, note
           FROM clinicmember WHERE hn = ? AND clinic = '47' LIMIT 1`,
          [cleanHn]
        ),
        hosPool.query(
          `SELECT a.an, a.pdx, IFNULL(i1.name, '') as pdx_name, DATE_FORMAT(a.regdate, '%Y-%m-%d') as regdate,
                  GROUP_CONCAT(DISTINCT d.icd10) as all_dx
           FROM an_stat a
           JOIN iptdiag d ON d.an = a.an
           LEFT JOIN icd101 i1 ON i1.code = a.pdx
           WHERE a.hn = ?
           GROUP BY a.an
           ORDER BY
             (GROUP_CONCAT(DISTINCT d.icd10) LIKE '%Z515%' OR a.pdx = 'Z515') DESC,
             (a.pdx REGEXP '^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185') DESC,
             a.regdate DESC
           LIMIT 1`,
          [cleanHn]
        ),
        hosPool.query(
          `SELECT v.vn, v.pdx, IFNULL(i1.name, '') as pdx_name, DATE_FORMAT(v.vstdate, '%Y-%m-%d') as vstdate,
                  GROUP_CONCAT(DISTINCT d.icd10) as all_dx
           FROM vn_stat v
           JOIN ovstdiag d ON d.vn = v.vn
           LEFT JOIN icd101 i1 ON i1.code = v.pdx
           WHERE v.hn = ?
             AND (v.pdx REGEXP '^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185' OR d.icd10 = 'Z515' OR v.pdx = 'Z515')
           GROUP BY v.vn
           ORDER BY
             (GROUP_CONCAT(DISTINCT d.icd10) LIKE '%Z515%' OR v.pdx = 'Z515') DESC,
             v.vstdate DESC
           LIMIT 1`,
          [cleanHn]
        ),
        appPool.query(
          'SELECT id FROM palliative_care_registries WHERE hn = ? OR hn = ? LIMIT 1',
          [cleanHn, rawInput]
        ),
        appPool.query(
          'SELECT id FROM long_term_care_registries WHERE hn = ? OR hn = ? LIMIT 1',
          [cleanHn, rawInput]
        ),
      ])

      if (!ptRows || ptRows.length === 0) {
        return { success: true, data: null }
      }

      const pt = ptRows[0]
      const cm = cmRows && cmRows.length > 0 ? cmRows[0] : null
      const isPal = (code, allDx) => {
        if (!code && !allDx) return false
        return (
          PALLIATIVE_DX_REGEX.test(code || '') ||
          Boolean(allDx && (String(allDx).includes('Z515') || PALLIATIVE_DX_REGEX.test(String(allDx))))
        )
      }

      let icd10Principal = null
      if (anRows && anRows.length > 0) {
        const an = anRows[0]
        if (an.pdx && an.pdx !== 'Z515' && PALLIATIVE_DX_REGEX.test(an.pdx)) {
          icd10Principal = String(an.pdx).trim()
        } else if (isPal(an.pdx, an.all_dx)) {
          try {
            const [diagRows] = await hosPool.query(
              `SELECT d.icd10 FROM iptdiag d WHERE d.an = ? AND d.icd10 != 'Z515'
               ORDER BY (d.icd10 REGEXP '^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185') DESC, d.diagtype ASC LIMIT 1`,
              [an.an]
            )
            if (diagRows && diagRows.length > 0 && diagRows[0].icd10) {
              icd10Principal = String(diagRows[0].icd10).trim()
            }
          } catch {
            // fallback
          }
          if (!icd10Principal && an.pdx) icd10Principal = String(an.pdx).trim()
        }
      }

      if (!icd10Principal && opdRows && opdRows.length > 0 && opdRows[0].pdx && opdRows[0].pdx !== 'Z515') {
        icd10Principal = String(opdRows[0].pdx).trim()
      }
      if (!icd10Principal && cm?.note) {
        icd10Principal = String(cm.note).trim()
      }
      if (!icd10Principal && anRows && anRows.length > 0 && anRows[0].pdx) {
        icd10Principal = String(anRows[0].pdx).trim()
      }
      if (!resolvedAn && anRows && anRows.length > 0 && anRows[0].an) {
        resolvedAn = String(anRows[0].an).trim()
      }

      const isAlreadyInRegistry = Boolean(existingRows && existingRows.length > 0)
      const isLtc = Boolean(ltcRows && ltcRows.length > 0)

      return {
        success: true,
        data: {
          hn: String(pt.hn || cleanHn),
          an: resolvedAn,
          patientName: String(pt.ptname || '').trim(),
          address: String(pt.address || '').trim(),
          phone: String(pt.phone || '').trim(),
          death: String(pt.death || 'N'),
          deathDate: pt.death_date ? String(pt.death_date) : null,
          isRegistered: Boolean(cm),
          registeredDate: cm?.regdate ? String(cm.regdate) : null,
          icd10Principal,
          isAlreadyInRegistry,
          existingRegistryId: isAlreadyInRegistry ? Number(existingRows[0].id) : undefined,
          isLtc,
          ltcMessage: isLtc
            ? 'ผู้ป่วยรายนี้มีรายชื่อในทะเบียน Long Term Care (LTC) แล้ว ไม่สามารถลงทะเบียน Palliative Care ได้'
            : undefined,
        }
      }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 4. Palliative Care: Full HOSxP Clinic 47 + ADP 30001 Sync
  fastify.post('/api/v1/app/palliative-care/sync-hosxp', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ซิงค์ทะเบียน Palliative Care จากคลินิก 47 และประวัติเยี่ยมบ้าน ADP 30001 ใน HOSxP',
    }
  }, async (req, reply) => {
    try {
      const actor = String(req.body?.actor || 'hosxp_autosync')

      const [
        [existingRows],
        [existingVisitRows],
        [ltcRows],
        [cmRows],
        hos30001Rows,
      ] = await Promise.all([
        appPool.query(
          `SELECT id, hn, patient_name, registration_status, registered_date, death_date,
                  visit_1_date, visit_2_date, visit_3_date, visit_4_date, visit_5_date, visit_6_date
           FROM palliative_care_registries`
        ),
        appPool.query(
          'SELECT registry_id, visit_no, visit_date FROM palliative_care_registry_visits ORDER BY registry_id ASC, visit_no ASC'
        ),
        appPool.query('SELECT hn FROM long_term_care_registries WHERE hn IS NOT NULL'),
        hosPool.query(
          `SELECT
             cm.hn,
             DATE_FORMAT(cm.regdate, '%Y-%m-%d') AS regdate,
             cm.note,
             CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
             CONCAT(
               IFNULL(pt.addrpart, ''),
               IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
               IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
               IF(t.name IS NOT NULL, CONCAT(' ต.', t.name), ''),
               IF(a.name IS NOT NULL, CONCAT(' อ.', a.name), '')
             ) AS address,
             COALESCE(
               NULLIF(TRIM(pt.mobile_phone_number), ''),
               NULLIF(TRIM(pt.informtel), ''),
               NULLIF(TRIM(pt.hometel), ''),
               NULLIF(TRIM(pt.worktel), ''),
               ''
             ) AS phone,
             IFNULL(pt.death, 'N') AS death,
             DATE_FORMAT(pt.deathday, '%Y-%m-%d') AS death_date
           FROM clinicmember cm
           JOIN patient pt ON pt.hn = cm.hn
           LEFT JOIN thaiaddress t ON t.chwpart = pt.chwpart AND t.amppart = pt.amppart AND t.tmbpart = pt.tmbpart
           LEFT JOIN thaiaddress a ON a.chwpart = pt.chwpart AND a.amppart = pt.amppart AND a.tmbpart = '00'
           WHERE cm.clinic = '47'
           ORDER BY cm.regdate DESC`
        ),
        hosPool.query(
          `SELECT DISTINCT
             COALESCE(NULLIF(TRIM(o.hn), ''), oo.hn) AS hn,
             DATE_FORMAT(COALESCE(o.vstdate, oo.vstdate), '%Y-%m-%d') AS vstdate
           FROM opitemrece oo
           JOIN s_drugitems d ON d.icode = oo.icode
           LEFT JOIN ovst o ON o.vn = oo.vn
           WHERE d.nhso_adp_code = '30001'
             AND COALESCE(o.vstdate, oo.vstdate) IS NOT NULL
           ORDER BY hn ASC, vstdate ASC`
        ).then(([r]) => r || []).catch(() => []),
      ])

      const ltcHnSet = new Set()
      for (const lr of ltcRows || []) {
        if (lr.hn) {
          const raw = String(lr.hn).trim()
          ltcHnSet.add(raw)
          ltcHnSet.add(normalizeHn(raw))
        }
      }

      const existingByHn = new Map()
      for (const r of existingRows || []) {
        const raw = String(r.hn || '').trim()
        const norm = normalizeHn(raw)
        if (raw) existingByHn.set(raw, r)
        if (norm) existingByHn.set(norm, r)
      }

      const hosxpMembers = new Map()
      for (const row of cmRows || []) {
        const norm = normalizeHn(row.hn)
        if (!norm || hosxpMembers.has(norm)) continue
        hosxpMembers.set(norm, row)
      }

      let skippedLtcCount = 0
      const skippedLtcItems = []
      const toInsert = []
      const updateStatements = []
      const updatedItems = []
      const clinicNoteMap = new Map()

      for (const [normHn, row] of hosxpMembers.entries()) {
        const rawHn = String(row.hn || '').trim()
        const isLtc = ltcHnSet.has(normHn) || (rawHn ? ltcHnSet.has(rawHn) : false)
        const existing = existingByHn.get(normHn) || (rawHn ? existingByHn.get(rawHn) : undefined)

        if (existing) {
          const regDateVal = row.regdate ? String(row.regdate).trim() : null
          const deathDateVal = row.death === 'Y' && row.death_date ? String(row.death_date).trim() : null
          const needsStatusUpdate = existing.registration_status !== 'ดำเนินการเรียบร้อย'
          const needsRegDate = Boolean(regDateVal && (!existing.registered_date || !String(existing.registered_date).trim()))
          const needsDeathDate = Boolean(deathDateVal && (!existing.death_date || !String(existing.death_date).trim()))

          const updatedFields = []
          if (needsStatusUpdate) updatedFields.push('status')
          if (needsRegDate) updatedFields.push('registeredDate')
          if (needsDeathDate) updatedFields.push('deathDate')

          if (updatedFields.length > 0) {
            updateStatements.push({
              sql: `UPDATE palliative_care_registries
                    SET registration_status = 'ดำเนินการเรียบร้อย',
                        registered_date = COALESCE(NULLIF(TRIM(registered_date), ''), ?),
                        death_date = COALESCE(NULLIF(TRIM(death_date), ''), ?),
                        updated_by = ?,
                        updated_at = NOW()
                    WHERE id = ?`,
              params: [regDateVal, deathDateVal, actor, existing.id],
            })
            updatedItems.push({
              hn: normHn,
              patientName: String(row.ptname || existing.patient_name || '').trim() || `HN ${normHn}`,
              updatedFields,
              ...(needsRegDate && regDateVal ? { registeredDate: regDateVal } : {}),
              ...(needsDeathDate && deathDateVal ? { deathDate: deathDateVal } : {}),
            })
          }
          continue
        }

        if (isLtc) {
          skippedLtcCount++
          skippedLtcItems.push({
            hn: normHn,
            patientName: String(row.ptname || '').trim() || `HN ${normHn}`,
          })
          continue
        }

        toInsert.push({ normHn, row })
        if (row.note && String(row.note).trim()) {
          clinicNoteMap.set(normHn, String(row.note).trim())
        }
      }

      // Batch resolve principal ICD-10 for newly inserted HNs
      const resolvedDxMap = new Map()
      if (toInsert.length > 0) {
        const newHns = toInsert.map((x) => x.normHn)
        const ipdByHn = new Map()
        const opdByHn = new Map()
        for (let i = 0; i < newHns.length; i += 50) {
          const chunk = newHns.slice(i, i + 50)
          const ph = chunk.map(() => '?').join(',')
          const [ipdRows, opdRows] = await Promise.all([
            hosPool.query(
              `SELECT a.hn, a.an, a.pdx, DATE_FORMAT(a.regdate, '%Y-%m-%d') AS regdate, d.icd10, d.diagtype
               FROM an_stat a JOIN iptdiag d ON d.an = a.an
               WHERE a.hn IN (${ph}) ORDER BY a.regdate DESC, a.an DESC, d.diagtype ASC`,
              chunk
            ).then(([r]) => r || []).catch(() => []),
            hosPool.query(
              `SELECT v.hn, v.vn, v.pdx, d.icd10
               FROM vn_stat v JOIN ovstdiag d ON d.vn = v.vn
               WHERE v.hn IN (${ph})
                 AND (v.pdx REGEXP '^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185' OR d.icd10 = 'Z515' OR v.pdx = 'Z515')
               ORDER BY (d.icd10 = 'Z515' OR v.pdx = 'Z515') DESC, v.vstdate DESC`,
              chunk
            ).then(([r]) => r || []).catch(() => []),
          ])
          for (const r of ipdRows) {
            const hn = normalizeHn(r.hn)
            if (!hn) continue
            const anList = ipdByHn.get(hn) || []
            let entry = anList.find((e) => e.an === String(r.an))
            if (!entry) {
              entry = { an: String(r.an || ''), pdx: String(r.pdx || '').trim(), regdate: String(r.regdate || ''), diagnoses: [] }
              anList.push(entry)
              ipdByHn.set(hn, anList)
            }
            if (r.icd10) entry.diagnoses.push({ icd10: String(r.icd10).trim(), diagtype: Number(r.diagtype || 99) })
          }
          for (const r of opdRows) {
            const hn = normalizeHn(r.hn)
            if (!hn) continue
            const list = opdByHn.get(hn) || []
            list.push({ vn: String(r.vn || ''), pdx: String(r.pdx || '').trim(), icd10: String(r.icd10 || '').trim() })
            opdByHn.set(hn, list)
          }
        }

        for (const hn of newHns) {
          let resolved = ''
          const ipdList = ipdByHn.get(hn) || []
          if (ipdList.length > 0) {
            const sortedAns = [...ipdList].sort((a, b) => {
              const aZ = a.pdx === 'Z515' || a.diagnoses.some((d) => d.icd10 === 'Z515') ? 1 : 0
              const bZ = b.pdx === 'Z515' || b.diagnoses.some((d) => d.icd10 === 'Z515') ? 1 : 0
              if (aZ !== bZ) return bZ - aZ
              const aP = PALLIATIVE_DX_REGEX.test(a.pdx) || a.diagnoses.some((d) => PALLIATIVE_DX_REGEX.test(d.icd10)) ? 1 : 0
              const bP = PALLIATIVE_DX_REGEX.test(b.pdx) || b.diagnoses.some((d) => PALLIATIVE_DX_REGEX.test(d.icd10)) ? 1 : 0
              return bP - aP
            })
            const bestAn = sortedAns[0]
            if (bestAn.pdx && bestAn.pdx !== 'Z515' && PALLIATIVE_DX_REGEX.test(bestAn.pdx)) {
              resolved = bestAn.pdx
            } else if (
              bestAn.pdx === 'Z515' || PALLIATIVE_DX_REGEX.test(bestAn.pdx) ||
              bestAn.diagnoses.some((d) => d.icd10 === 'Z515' || PALLIATIVE_DX_REGEX.test(d.icd10))
            ) {
              const palDiag = bestAn.diagnoses.find((d) => d.icd10 !== 'Z515' && PALLIATIVE_DX_REGEX.test(d.icd10))
              const otherDiag = bestAn.diagnoses.find((d) => d.icd10 !== 'Z515')
              resolved = palDiag?.icd10 || otherDiag?.icd10 || bestAn.pdx
            }
          }
          if (!resolved) {
            const opdList = opdByHn.get(hn) || []
            const opdMatch = opdList.find((o) => o.pdx && o.pdx !== 'Z515')
            if (opdMatch) resolved = opdMatch.pdx
            else {
              const opdSec = opdList.find((o) => o.icd10 && o.icd10 !== 'Z515')
              if (opdSec) resolved = opdSec.icd10
            }
          }
          if (!resolved && clinicNoteMap.get(hn)) resolved = clinicNoteMap.get(hn) || ''
          if (!resolved && ipdList.length > 0 && ipdList[0].pdx) resolved = ipdList[0].pdx
          if (resolved) resolvedDxMap.set(hn, resolved.slice(0, 100))
        }
      }

      const insertedItems = []
      const insertStatements = toInsert.map(({ normHn, row }) => {
        const ptName = String(row.ptname || '').trim().slice(0, 255) || `HN ${normHn}`
        const address = String(row.address || '').trim().slice(0, 500) || null
        const phone = String(row.phone || '').trim().slice(0, 100) || null
        const icd10Principal = resolvedDxMap.get(normHn) || null
        const regDate = row.regdate ? String(row.regdate).trim().slice(0, 20) : null
        const deathDate = row.death === 'Y' && row.death_date ? String(row.death_date).trim().slice(0, 20) : null

        insertedItems.push({ hn: normHn, patientName: ptName, icd10Principal, registeredDate: regDate })

        return {
          sql: `INSERT INTO palliative_care_registries (
                  hn, patient_name, address, phone, icd10_principal, icd10_palliative, project_code,
                  registration_status, registered_date, death_date,
                  created_by, updated_by, created_at, updated_at
                )
                SELECT ?, ?, ?, ?, ?, ?, ?, 'ดำเนินการเรียบร้อย', ?, ?, ?, ?, NOW(), NOW()
                FROM DUAL
                WHERE NOT EXISTS (
                  SELECT 1 FROM palliative_care_registries WHERE hn = ? OR TRIM(LEADING '0' FROM hn) = ?
                )`,
          params: [
            normHn, ptName, address, phone, icd10Principal,
            DEFAULT_ICD10_PALLIATIVE, DEFAULT_PROJECT_CODE,
            regDate, deathDate, actor, actor,
            normHn, normHn.replace(/^0+/, '') || normHn,
          ],
        }
      })

      const allStatements = [...insertStatements, ...updateStatements]
      if (allStatements.length > 0) {
        await runTxStatements(appPool, allStatements)
      }

      // Step 2: Sync ADP 30001 home visits (append-only)
      let visitsAddedCount = 0
      const visitsAddedItems = []
      const visitStatements = []

      if (hos30001Rows.length > 0) {
        const hosVisitsByHn = new Map()
        for (const hv of hos30001Rows) {
          const normHn = normalizeHn(hv.hn)
          const isoDate = normalizeRegistryDateToIso(hv.vstdate)
          if (!normHn || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue
          const list = hosVisitsByHn.get(normHn) || []
          if (!list.includes(isoDate)) list.push(isoDate)
          hosVisitsByHn.set(normHn, list)
        }

        let allRegRows = existingRows || []
        if (insertStatements.length > 0) {
          const [refreshed] = await appPool.query(
            `SELECT id, hn, patient_name, visit_1_date, visit_2_date, visit_3_date, visit_4_date, visit_5_date, visit_6_date
             FROM palliative_care_registries`
          )
          if (Array.isArray(refreshed) && refreshed.length > 0) allRegRows = refreshed
        }

        const visitsMetaByRegId = new Map()
        for (const r of allRegRows) {
          const datesIso = new Set()
          let maxNo = 0
          for (let slot = 1; slot <= 6; slot++) {
            const val = r[`visit_${slot}_date`]
            if (val && String(val).trim()) {
              const iso = normalizeRegistryDateToIso(String(val))
              if (iso) datesIso.add(iso)
              if (slot > maxNo) maxNo = slot
            }
          }
          visitsMetaByRegId.set(r.id, { datesIso, maxNo })
        }

        for (const ev of existingVisitRows || []) {
          const meta = visitsMetaByRegId.get(ev.registry_id)
          if (!meta) continue
          const iso = normalizeRegistryDateToIso(ev.visit_date)
          if (iso) meta.datesIso.add(iso)
          const vNo = Number(ev.visit_no || 0)
          if (vNo > meta.maxNo) meta.maxNo = vNo
        }

        for (const r of allRegRows) {
          const normHn = normalizeHn(r.hn)
          if (!normHn) continue
          const hosDates = hosVisitsByHn.get(normHn)
          if (!hosDates || hosDates.length === 0) continue

          const meta = visitsMetaByRegId.get(r.id) || { datesIso: new Set(), maxNo: 0 }
          const missingDates = hosDates.filter((d) => !meta.datesIso.has(d)).sort()
          if (missingDates.length === 0) continue

          let nextNo = meta.maxNo + 1
          const slotUpdates = []
          const addedVisits = []

          for (const isoDate of missingDates) {
            const visitNo = nextNo++
            const dmy = isoToDisplayDmy(isoDate)
            visitStatements.push({
              sql: 'INSERT IGNORE INTO palliative_care_registry_visits (registry_id, visit_no, visit_date) VALUES (?, ?, ?)',
              params: [r.id, visitNo, dmy],
            })
            if (visitNo <= 6) slotUpdates.push({ slot: visitNo, dmy })
            meta.datesIso.add(isoDate)
            addedVisits.push({ visitNo, visitDate: dmy })
            visitsAddedCount++
          }

          if (addedVisits.length > 0) {
            const hosMember = hosxpMembers.get(normHn)
            visitsAddedItems.push({
              hn: normHn,
              patientName: String(r.patient_name || hosMember?.ptname || '').trim() || `HN ${normHn}`,
              addedVisits,
            })
          }

          if (slotUpdates.length > 0) {
            const setClauses = slotUpdates.map(
              (u) => `visit_${u.slot}_date = COALESCE(NULLIF(TRIM(visit_${u.slot}_date), ''), ?)`
            )
            visitStatements.push({
              sql: `UPDATE palliative_care_registries SET ${setClauses.join(', ')}, updated_by = ?, updated_at = NOW() WHERE id = ?`,
              params: [...slotUpdates.map((u) => u.dmy), actor, r.id],
            })
          }
        }

        if (visitStatements.length > 0) {
          await runTxStatements(appPool, visitStatements)
        }
      }

      return {
        success: true,
        data: {
          totalClinicMembers: hosxpMembers.size,
          insertedCount: insertStatements.length,
          updatedCount: updateStatements.length,
          visitsAddedCount,
          skippedLtcCount,
          syncedAt: new Date().toISOString(),
          insertedItems,
          updatedItems,
          visitsAddedItems,
          skippedLtcItems,
        }
      }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 5. Palliative Care: Raw bundle (registries + visits) from App DB
  fastify.get('/api/v1/app/palliative-care/raw-bundle', {
    schema: {
      tags: ['3. Website Application (Members & CMS)'],
      summary: 'ดึงข้อมูลทะเบียน Palliative Care และประวัติเยี่ยมบ้านทั้งหมด',
    }
  }, async (_req, reply) => {
    try {
      const [[registries], [visits]] = await Promise.all([
        appPool.query(
          `SELECT id, hn, patient_name, address, phone, icd10_principal, icd10_palliative,
                  project_code, registration_status, registered_date,
                  visit_1_date, visit_2_date, visit_3_date, visit_4_date, visit_5_date, visit_6_date,
                  death_date, created_by, updated_by, created_at, updated_at
           FROM palliative_care_registries
           ORDER BY registered_date DESC, id DESC`
        ),
        appPool.query(
          `SELECT id, registry_id, visit_no, visit_date
           FROM palliative_care_registry_visits
           ORDER BY registry_id ASC, visit_no ASC`
        ),
      ])
      return {
        success: true,
        data: {
          registries: registries || [],
          visits: visits || [],
        }
      }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 6. Palliative Care: Batch HOSxP + RCM REP enrichment by HN list
  fastify.post('/api/v1/clinical/palliative-care/enrich-hns', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'จับคู่ข้อมูล Clinic 47, AN ล่าสุด, และชดเชย REP (repeclaim/repdata) ตามรายการ HN',
    }
  }, async (req, reply) => {
    try {
      const hns = Array.isArray(req.body?.hns)
        ? [...new Set(req.body.hns.map((h) => String(h || '').trim()).filter(Boolean))]
        : []
      if (hns.length === 0) {
        return {
          success: true,
          data: { clinicMembers: [], anRows: [], repeclaimRows: [], repdataRows: [] }
        }
      }

      const ph = hns.map(() => '?').join(',')
      const [clinicMembers, repeclaimRows, repdataRows, anRows] = await Promise.all([
        hosPool.query(
          `SELECT hn, DATE_FORMAT(regdate, '%Y-%m-%d') as regdate
           FROM clinicmember WHERE hn IN (${ph}) AND clinic = '47'`,
          hns
        ).then(([r]) => r || []).catch(() => []),
        hosPool.query(
          `SELECT t.hn, DATE_FORMAT(t.admdate, '%Y-%m-%d') as admdate, t.rep, SUM(t.compensated) as compensated
           FROM rcmdb.repeclaim t
           LEFT JOIN ovst o ON o.vn = t.vn
           LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
           WHERE t.department = 'OP' AND ptt.pttype_eclaim_id = '01' AND t.hn IN (${ph})
           GROUP BY t.hn, DATE_FORMAT(t.admdate, '%Y-%m-%d'), t.rep
           ORDER BY t.admdate DESC, t.rep ASC`,
          hns
        ).then(([r]) => r || []).catch(() => []),
        hosPool.query(
          `SELECT hn, DATE_FORMAT(AdmDate, '%Y-%m-%d') as admdate, Rep as rep,
                  Compensated as compensated, ErrorCode as errorcode, Remark as remark
           FROM rcmdb.repdata WHERE hn IN (${ph})
           ORDER BY AdmDate DESC, Rep ASC`,
          hns
        ).then(([r]) => r || []).catch(() => []),
        hosPool.query(
          `SELECT a.hn, a.an
           FROM an_stat a
           JOIN (
             SELECT hn, MAX(regdate) as max_regdate FROM an_stat WHERE hn IN (${ph}) GROUP BY hn
           ) latest ON latest.hn = a.hn AND latest.max_regdate = a.regdate
           WHERE a.hn IN (${ph})
           GROUP BY a.hn`,
          [...hns, ...hns]
        ).then(([r]) => r || []).catch(() => []),
      ])

      return {
        success: true,
        data: { clinicMembers, anRows, repeclaimRows, repdataRows }
      }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })
}
