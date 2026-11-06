import { apiGateway } from '../src/lib/apiGateway'
import { logAudit } from '../src/lib/audit'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runImport() {
  console.log('=== Start Palliative Care Registry Transactional Import ===')
  const startTime = Date.now()

  // 1. Fetch all members from Clinic 47 (2423 : Palliative care)
  console.log('Step 1: Fetching all members from Clinic 2423 in HOSxP...')
  const members = await apiGateway.clinical.query<any>(`
    SELECT 
      cm.hn,
      DATE_FORMAT(cm.regdate, '%Y-%m-%d') as regdate,
      cm.note as cm_note,
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
    ORDER BY cm.regdate ASC, cm.hn ASC
  `)
  console.log(`Found ${members.length} members in Clinic 2423.`)

  // 2. Fetch all Home Visits (3002602)
  console.log('Step 2: Fetching all 30001 home visits from opitemrece...')
  const visits = await apiGateway.clinical.query<any>(`
    SELECT 
      hn, 
      DATE_FORMAT(vstdate, '%d/%m/%Y') as visit_date,
      DATE_FORMAT(vstdate, '%Y-%m-%d') as vstdate_ymd
    FROM opitemrece
    WHERE icode = '3002602'
    ORDER BY vstdate ASC
  `)
  console.log(`Found ${visits.length} visit item records.`)

  const visitsByHn = new Map<string, string[]>()
  for (const v of visits) {
    if (!v.hn || !v.visit_date) continue
    const cleanHn = String(v.hn).trim().padStart(7, '0')
    const list = visitsByHn.get(cleanHn) || []
    if (!list.includes(v.visit_date)) {
      list.push(v.visit_date)
    }
    visitsByHn.set(cleanHn, list)
  }

  // 3. Fetch Principal Diagnoses (IPD & OPD)
  console.log('Step 3: Fetching principal diagnoses...')
  const ipdRows = await apiGateway.clinical.query<any>(`
    SELECT 
      a.hn,
      a.pdx,
      GROUP_CONCAT(DISTINCT d.icd10) as all_dx
    FROM an_stat a
    JOIN iptdiag d ON d.an = a.an
    JOIN clinicmember cm ON cm.hn = a.hn AND cm.clinic = '47'
    GROUP BY a.an
    ORDER BY 
      (GROUP_CONCAT(DISTINCT d.icd10) LIKE '%Z515%' OR a.pdx = 'Z515') DESC,
      (a.pdx REGEXP '^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185') DESC,
      a.regdate DESC
  `)

  const hnDiagMap = new Map<string, string>()
  for (const r of ipdRows) {
    const cleanHn = String(r.hn).trim().padStart(7, '0')
    if (!hnDiagMap.has(cleanHn)) {
      let code: string | null = null
      if (r.pdx && r.pdx !== 'Z515' && /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/.test(r.pdx)) {
        code = r.pdx.trim()
      } else if (r.all_dx) {
        const parts = r.all_dx.split(',')
        const found = parts.find((p: string) => p !== 'Z515' && /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/.test(p))
        if (found) code = found.trim()
        else if (parts.includes('Z515')) code = 'Z515'
      }
      if (code) hnDiagMap.set(cleanHn, code)
    }
  }

  const opdRows = await apiGateway.clinical.query<any>(`
    SELECT 
      v.hn,
      v.pdx,
      GROUP_CONCAT(DISTINCT d.icd10) as all_dx
    FROM vn_stat v
    JOIN ovstdiag d ON d.vn = v.vn
    JOIN clinicmember cm ON cm.hn = v.hn AND cm.clinic = '47'
    WHERE (v.pdx REGEXP '^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185' OR d.icd10 = 'Z515' OR v.pdx = 'Z515')
    GROUP BY v.vn
    ORDER BY 
      (GROUP_CONCAT(DISTINCT d.icd10) LIKE '%Z515%' OR v.pdx = 'Z515') DESC,
      v.vstdate DESC
  `)

  for (const r of opdRows) {
    const cleanHn = String(r.hn).trim().padStart(7, '0')
    if (!hnDiagMap.has(cleanHn)) {
      let code: string | null = null
      if (r.pdx && r.pdx !== 'Z515' && /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/.test(r.pdx)) {
        code = r.pdx.trim()
      } else if (r.all_dx) {
        const parts = r.all_dx.split(',')
        const found = parts.find((p: string) => p !== 'Z515' && /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/.test(p))
        if (found) code = found.trim()
        else if (parts.includes('Z515')) code = 'Z515'
      }
      if (code) hnDiagMap.set(cleanHn, code)
    }
  }

  // 4. Wipe any existing or partial records first
  console.log('Step 4: Clearing any partial records...')
  await apiGateway.app.execute('DELETE FROM palliative_care_registry_visits WHERE id > 0')
  await apiGateway.app.execute('DELETE FROM palliative_care_registries WHERE id > 0')
  console.log('Tables cleaned and ready.')

  // 5. Batch Insert Registries using Transaction (50 per transaction)
  console.log('Step 5: Inserting 1,341 members via transaction batches...')
  const REG_BATCH_SIZE = 50
  const memberInsertIds: Array<{ hn: string; id: number; visits: string[] }> = []

  const insertSql = `
    INSERT INTO palliative_care_registries (
      hn, patient_name, address, phone, icd10_principal, icd10_palliative, project_code,
      registration_status, registered_date,
      visit_1_date, visit_2_date, visit_3_date, visit_4_date, visit_5_date, visit_6_date,
      death_date, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, NOW(), NOW()
    )
  `

async function runTransactionWithRetry(
  statements: Array<{ sql: string; params?: unknown[] }>,
  maxRetries = 5
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiGateway.app.transaction(statements)
    } catch (err: any) {
      if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Rate limit')) {
        let waitSec = 60
        const match = err?.message?.match(/retry in (\d+) seconds/i) || err?.details?.message?.match(/retry in (\d+) seconds/i)
        if (match) {
          waitSec = parseInt(match[1], 10) + 2
        }
        console.warn(`[Rate Limit 429] Waiting ${waitSec}s before retry attempt ${attempt}/${maxRetries}...`)
        await sleep(waitSec * 1000)
        continue
      }
      throw err
    }
  }
  throw new Error(`Transaction failed after ${maxRetries} attempts due to persistent rate limiting.`)
}

  for (let i = 0; i < members.length; i += REG_BATCH_SIZE) {
    const chunk = members.slice(i, i + REG_BATCH_SIZE)
    const statements = chunk.map((m) => {
      const cleanHn = String(m.hn).trim().padStart(7, '0')
      const patientVisits = visitsByHn.get(cleanHn) || []
      const diag = hnDiagMap.get(cleanHn) || (m.cm_note ? String(m.cm_note).trim() : null)

      const v1 = patientVisits[0] || null
      const v2 = patientVisits[1] || null
      const v3 = patientVisits[2] || null
      const v4 = patientVisits[3] || null
      const v5 = patientVisits[4] || null
      const v6 = patientVisits[5] || null

      return {
        sql: insertSql,
        params: [
          cleanHn,
          m.ptname ? String(m.ptname).trim() : '',
          m.address ? String(m.address).trim() : null,
          m.phone ? String(m.phone).trim() : null,
          diag,
          'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)',
          '30001, Cons01',
          'ดำเนินการเรียบร้อย',
          m.regdate || null,
          v1, v2, v3, v4, v5, v6,
          m.death === 'Y' && m.death_date ? m.death_date : null,
          'ระบบนำเข้าข้อมูล 2423',
          'ระบบนำเข้าข้อมูล 2423',
        ],
      }
    })

    const txRes = await runTransactionWithRetry(statements)
    for (let j = 0; j < chunk.length; j++) {
      const m = chunk[j]
      const cleanHn = String(m.hn).trim().padStart(7, '0')
      const insertId = txRes.results[j]?.insertId
      if (insertId) {
        memberInsertIds.push({
          hn: cleanHn,
          id: insertId,
          visits: visitsByHn.get(cleanHn) || [],
        })
      }
    }

    console.log(`Inserted ${Math.min(i + REG_BATCH_SIZE, members.length)} / ${members.length} registries...`)
    await sleep(100) // gentle pause
  }

  // 6. Batch Insert Visits using Transaction (100 per transaction)
  console.log('Step 6: Inserting visits for members with home visits...')
  const visitStatements: Array<{ sql: string; params: any[] }> = []
  for (const m of memberInsertIds) {
    if (m.visits.length > 0) {
      for (let vIdx = 0; vIdx < m.visits.length; vIdx++) {
        visitStatements.push({
          sql: 'INSERT INTO palliative_care_registry_visits (registry_id, visit_no, visit_date) VALUES (?, ?, ?)',
          params: [m.id, vIdx + 1, m.visits[vIdx]],
        })
      }
    }
  }

  console.log(`Total visit records to insert: ${visitStatements.length}`)
  const VISIT_BATCH_SIZE = 100
  for (let i = 0; i < visitStatements.length; i += VISIT_BATCH_SIZE) {
    const chunk = visitStatements.slice(i, i + VISIT_BATCH_SIZE)
    await runTransactionWithRetry(chunk)
    console.log(`Inserted ${Math.min(i + VISIT_BATCH_SIZE, visitStatements.length)} / ${visitStatements.length} visits...`)
    await sleep(100)
  }

  console.log(`\n=== Import Summary ===`)
  console.log(`Total Registries Inserted: ${memberInsertIds.length}`)
  console.log(`Total Visits Inserted: ${visitStatements.length}`)
  console.log(`Elapsed Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`)

  // 7. Audit Logging
  try {
    await logAudit(
      'CREATE',
      'palliative_care_registries',
      `Imported ${memberInsertIds.length} patients from Clinic 2423 with ${visitStatements.length} home visits.`
    )
    console.log('Audit log successfully recorded.')
  } catch (err) {
    console.warn('Audit log notice:', err)
  }

  // 8. Verification
  console.log('Step 8: Verifying table counts in Website database...')
  const regCount = await apiGateway.app.query<any>('SELECT COUNT(1) as cnt FROM palliative_care_registries')
  const visitCount = await apiGateway.app.query<any>('SELECT COUNT(1) as cnt FROM palliative_care_registry_visits')
  console.log('Database verification:', {
    registriesInDb: regCount[0]?.cnt,
    visitsInDb: visitCount[0]?.cnt,
  })
}

runImport().catch((err) => {
  console.error('Fatal import error:', err)
  process.exit(1)
})
