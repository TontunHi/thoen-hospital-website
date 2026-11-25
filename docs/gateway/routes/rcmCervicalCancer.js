// Thoen Hospital API Gateway Plugin: RCM Cervical Cancer Screening (Phase 2A)

const PERSON_SELECT_COLUMNS = `
  CAST(p.person_id AS CHAR(20)) AS person_id,
  IFNULL(p.patient_hn, '') AS hn,
  IFNULL(p.cid, '') AS cid,
  CONCAT(IFNULL(p.pname, ''), IFNULL(p.fname, ''), ' ', IFNULL(p.lname, '')) AS ptname,
  DATE_FORMAT(p.birthdate, '%Y-%m-%d') AS birthdate,
  TIMESTAMPDIFF(YEAR, p.birthdate, NOW()) AS age,
  CASE WHEN p.sex = '1' THEN 'ชาย' WHEN p.sex = '2' THEN 'หญิง' ELSE IFNULL(p.sex, '') END AS sex,
  IFNULL(nat.name, 'ไทย') AS nation,
  p.person_discharge_id,
  CAST(IFNULL(p.house_regist_type_id, '') AS CHAR(2)) AS typearea,
  TRIM(CONCAT_WS(' ',
    IF(IFNULL(vil.village_moo, 0) = 0, pa.addrpart, h.address),
    IF(IFNULL(vil.village_moo, 0) = 0,
       IF(IFNULL(pa.moopart, '') <> '', CONCAT('ม.', pa.moopart), NULL),
       CONCAT('ม.', CAST(vil.village_moo AS UNSIGNED))),
    IF(IFNULL(vil.village_moo, 0) = 0, ta_pa.full_name, ta_h.full_name)
  )) AS address,
  IFNULL(ptt.name, IFNULL(p.pttype, '')) AS person_pttypename
`

const PERSON_FROM_JOINS = `
  FROM person p
  LEFT JOIN house h ON h.house_id = p.house_id
  LEFT JOIN village vil ON vil.village_id = h.village_id
  LEFT JOIN thaiaddress ta_h ON ta_h.addressid = vil.address_id
  LEFT JOIN person_address pa ON pa.person_id = p.person_id
  LEFT JOIN thaiaddress ta_pa ON ta_pa.addressid = CONCAT(IFNULL(pa.chwpart,''), IFNULL(pa.amppart,''), IFNULL(pa.tmbpart,''))
  LEFT JOIN nationality nat ON nat.nationality = p.nationality
  LEFT JOIN pttype ptt ON ptt.pttype = p.pttype
`

const ALLOWED_CCS_CODES = {
  '1B004N': ['1B004N', '1b004n'],
  '1B004P': ['1B004P', '1b004p'],
  '1B004_0N': ['1B004_0N', '1b004_0n'],
  '1B005': ['1B005', '1b005'],
}

export default async function rcmCervicalCancerRoutes(fastify, { pools, getCached }) {
  const { hosPool } = pools

  async function queryAdpMapping(codeKey) {
    const pair = ALLOWED_CCS_CODES[codeKey]
    if (!pair) return { isMapped: false, mappedCount: 0, items: [] }
    try {
      const [rows] = await hosPool.query(
        `SELECT d.icode, d.name, d.strength, d.nhso_adp_code
         FROM s_drugitems d
         WHERE TRIM(d.nhso_adp_code) IN (?, ?)
         ORDER BY d.icode ASC`,
        pair
      )
      const items = (rows || []).map((r) => ({
        icode: String(r.icode || ''),
        name: String(r.name || ''),
        strength: r.strength ? String(r.strength) : null,
        nhso_adp_code: String(r.nhso_adp_code || ''),
      }))
      return { isMapped: items.length > 0, mappedCount: items.length, items }
    } catch {
      return { isMapped: false, mappedCount: 0, items: [] }
    }
  }

  fastify.post('/api/v1/clinical/rcm/ccs/lookup-persons', {
    schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ค้นหาข้อมูลประชากรจากรายการ CID (CCS)' }
  }, async (req, reply) => {
    try {
      const rawCids = Array.isArray(req.body?.cids) ? req.body.cids : []
      const uniqueCids = Array.from(
        new Set(rawCids.map((c) => String(c || '').replace(/\D/g, '')).filter((c) => c.length === 13))
      )
      if (uniqueCids.length === 0) return { success: true, data: [] }

      const allRows = []
      for (let i = 0; i < uniqueCids.length; i += 400) {
        const chunk = uniqueCids.slice(i, i + 400)
        const ph = chunk.map(() => '?').join(',')
        const [rows] = await hosPool.query(
          `SELECT ${PERSON_SELECT_COLUMNS} ${PERSON_FROM_JOINS} WHERE p.cid IN (${ph})`,
          chunk
        )
        if (Array.isArray(rows)) allRows.push(...rows)
      }
      return { success: true, data: allRows }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/clinical/rcm/ccs/target-population', {
    schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ดึงข้อมูลดิบกลุ่มเป้าหมายคัดกรองมะเร็งปากมดลูก 30-60 ปี' }
  }, async (req, reply) => {
    try {
      const { startDate: ds1, endDate: ds2, refresh } = req.query || {}
      if (!ds1 || !ds2) {
        reply.code(400); return { success: false, error: 'startDate and endDate are required' }
      }
      const cacheKey = `gw-ccs-target-${ds1}-${ds2}`
      const fetcher = async () => {
        const [[personRows], [visitRows], [seamlessRows], [hpvRepRows]] = await Promise.all([
          hosPool.query(`
            SELECT ${PERSON_SELECT_COLUMNS}
            ${PERSON_FROM_JOINS}
            WHERE TIMESTAMPDIFF(YEAR, p.birthdate, NOW()) BETWEEN 30 AND 60
              AND p.sex = '2'
              AND p.nationality = '99'
              AND p.person_discharge_id = 9
            ORDER BY p.patient_hn ASC, p.person_id ASC
          `),
          hosPool.query(
            `SELECT
              o.vn, o.hn,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              NULLIF(TRIM(s.cc), '') AS cc,
              CONCAT_WS(',', NULLIF(v.pdx,''), NULLIF(v.dx0,''), NULLIF(v.dx1,''), NULLIF(v.dx2,''), NULLIF(v.dx3,''), NULLIF(v.dx4,''), NULLIF(v.dx5,'')) AS icd10,
              GROUP_CONCAT(DISTINCT IFNULL(hc.name, NULLIF(pp.dest_hospcode, ''))) AS hospital,
              GROUP_CONCAT(DISTINCT doc.name) AS doctorname,
              GROUP_CONCAT(DISTINCT t.pp_special_code) AS pp_codes
            FROM ovst o
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN opdscreen s ON s.vn = o.vn
            LEFT JOIN pp_special pp ON pp.vn = o.vn
            LEFT JOIN pp_special_type t ON t.pp_special_type_id = pp.pp_special_type_id
            LEFT JOIN hospcode hc ON hc.hospcode = pp.dest_hospcode
            LEFT JOIN doctor doc ON doc.code = pp.doctor
            WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (
                t.pp_special_code REGEXP '^1B004|^1B30|^1B40|^0320277'
                OR CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) REGEXP 'Z124'
              )
            GROUP BY o.vn
            ORDER BY o.vn ASC`,
            [ds1, ds2]
          ),
          hosPool.query(
            `SELECT VN AS vn, HN AS hn, PID AS cid, Ptname AS ptname, Rep AS rep,
                    DATE_FORMAT(AdmDate, '%Y-%m-%d') AS admdate, PayNo AS payno,
                    Status AS status, IFNULL(Compensated, 0) AS compensated, HSub AS hsub, Note AS note
             FROM rcmdb.seamless
             WHERE Rep REGEXP 'CCS'
               AND AdmDate >= ? AND AdmDate < DATE_ADD(?, INTERVAL 1 DAY)
               AND IFNULL(Compensated, 0) > 0`,
            [ds1, ds2]
          ),
          hosPool.query(
            `SELECT VN AS vn, HN AS hn, PID AS cid, Rep AS rep, IFNULL(Compensated, 0) AS compensated
             FROM rcmdb.repeclaim
             WHERE AdmDate >= ? AND AdmDate < DATE_ADD(?, INTERVAL 1 DAY)
               AND FileName REGEXP 'HPV'`,
            [ds1, ds2]
          ),
        ])
        return {
          personRows: personRows || [],
          visitRows: visitRows || [],
          seamlessRows: seamlessRows || [],
          hpvRepRows: hpvRepRows || [],
        }
      }

      const data = refresh === 'true' ? await fetcher() : await getCached(cacheKey, 300000, fetcher)
      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/clinical/rcm/ccs/screened-recipients', {
    schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก (1.2)' }
  }, async (req, reply) => {
    try {
      const { startDate: ds1, endDate: ds2, refresh } = req.query || {}
      if (!ds1 || !ds2) {
        reply.code(400); return { success: false, error: 'startDate and endDate are required' }
      }
      const cacheKey = `gw-ccs-screened-${ds1}-${ds2}`
      const fetcher = async () => {
        const sql = `
          SELECT
            o.vn, o.an, IFNULL(pt.cid, '') AS cid, o.hn,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
            IFNULL(nat.name, pt.nationality) AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            ptt_pt.name AS pttypename_patient,
            ptt_o.name AS pttypename_visit,
            ptt_o.pttype_eclaim_id AS pttype_eclaim_id,
            dep.department, spc.name AS clinic,
            v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            IF(GROUP_CONCAT(DISTINCT IF(t.pp_special_code REGEXP '^1B004|^1B30' OR pap.checkup = 'Y', 'Y', NULL)) IS NOT NULL, 'Y', NULL) AS ok,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0044','1B30','1B40','1B004N','1B004P'), t.pp_special_code, NULL)) AS papsmear,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0044','1B30','1B004N'), 'ปกติ', IF(t.pp_special_code IN ('1B40','1B004P'), 'ผิดปกติ', NULL))) AS papsmear_result,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0040','1B0041','1B0042','1B0043','1B0045','1B004_0N','1B004_0P'), t.pp_special_code, NULL)) AS via,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0040','1B0043','1B004_0N'), 'ปกติ', IF(t.pp_special_code IN ('1B0041','1B0042','1B0043','1B0045','1B004_0P'), 'ผิดปกติ', NULL))) AS via_result,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code REGEXP '^1B0046', t.pp_special_code, NULL)) AS hpv,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code REGEXP '1B0046_[12]', 'ผิดปกติ', IF(t.pp_special_code REGEXP '1B0046', 'ปกติ', NULL))) AS hpv_result,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0048','1B0049','0320277_0','0320277_1'), t.pp_special_code, NULL)) AS other,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0048','1B0049','0320277_0'), 'ปกติ', IF(t.pp_special_code IN ('0320277_1'), 'ผิดปกติ', NULL))) AS other_result,
            pap.checkup AS colposcopy,
            sm.type AS type,
            IF(rr.vn IS NOT NULL, rr.rep, sm.rep) AS rep,
            IF(rr.vn IS NOT NULL, rr.compensated, sm.compensated) AS compensated,
            sm.note, sm.paydate, c.name AS listname,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep_nhso,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated) AS nhso
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt_pt ON ptt_pt.pttype = pt.pttype
          LEFT JOIN pttype ptt_o ON ptt_o.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN pp_special pp ON o.vn = pp.vn
          LEFT JOIN pp_special_type t ON t.pp_special_type_id = pp.pp_special_type_id
          LEFT JOIN (
            SELECT vn,
              GROUP_CONCAT(DISTINCT type ORDER BY type SEPARATOR ', ') AS type,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUM(IFNULL(compensated, 0)) AS compensated,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(note, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS note,
              DATE_FORMAT(MAX(paydate), '%Y-%m-%d') AS paydate
            FROM rcmdb.seamless WHERE IFNULL(vn, '') <> '' AND rep REGEXP 'CCS' GROUP BY vn
          ) sm ON sm.vn = o.vn
          LEFT JOIN (
            SELECT vn,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUM(IFNULL(compensated, 0)) AS compensated
            FROM rcmdb.repeclaim WHERE IFNULL(vn, '') <> '' AND filename REGEXP 'HPV' GROUP BY vn
          ) rr ON rr.vn = o.vn
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN visit_pttype vt ON vt.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'NHSO :: มี Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'Rep :: มี Rep แล้ว' AS statusname
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) rep ON rep.vn = o.vn
          LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
          LEFT JOIN (
            SELECT m.opdseq AS vn,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                   SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
            FROM eclaimdb.m_registerdata m
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> ''
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          LEFT JOIN (
            SELECT oo.vn, 'Y' AS checkup
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND d.nhso_adp_code = '1B005'
            GROUP BY oo.vn
          ) pap ON pap.vn = o.vn
          LEFT JOIN (
            SELECT oo.vn, GROUP_CONCAT(DISTINCT d.nhso_adp_code) AS name
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE IFNULL(oo.vn,'') <> '' AND oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND d.nhso_adp_code IN ('1B0046_0','1B0046_01','1B0046_1','1B0046_11','1B0046_2','1B0046_21','1B004_0N','1B004_0P','1B004N','1B004P','1B005')
            GROUP BY oo.vn
          ) c ON c.vn = o.vn
          WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
            AND (
              t.pp_special_code REGEXP '^1B004|^1B30|^01B40|^0320277'
              OR CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) REGEXP 'Z124'
              OR pap.checkup = 'Y'
              OR c.vn IS NOT NULL
            )
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC
        `
        const [rows] = await hosPool.query(sql, [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2])
        return rows || []
      }
      const data = refresh === 'true' ? await fetcher() : await getCached(cacheKey, 300000, fetcher)
      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/clinical/rcm/ccs/adp-mapping/:code', {
    schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ตรวจสอบการจับคู่รหัส ADP มะเร็งปากมดลูก' }
  }, async (req, reply) => {
    try {
      const codeKey = String(req.params.code || '').toUpperCase()
      if (!ALLOWED_CCS_CODES[codeKey]) {
        reply.code(400); return { success: false, error: `Unsupported CCS ADP code: ${codeKey}` }
      }
      const data = await queryAdpMapping(codeKey)
      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/clinical/rcm/ccs/service/:code', {
    schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'รายงานบริการคัดกรองมะเร็งปากมดลูกตามรหัส ADP (1B004N/1B004P/1B004_0N/1B005)' }
  }, async (req, reply) => {
    try {
      const codeKey = String(req.params.code || '').toUpperCase()
      const pair = ALLOWED_CCS_CODES[codeKey]
      if (!pair) {
        reply.code(400); return { success: false, error: `Unsupported CCS ADP code: ${codeKey}` }
      }
      const { startDate: ds1, endDate: ds2, refresh } = req.query || {}
      if (!ds1 || !ds2) {
        reply.code(400); return { success: false, error: 'startDate and endDate are required' }
      }
      const cacheKey = `gw-ccs-svc-${codeKey}-${ds1}-${ds2}`
      const fetcher = async () => {
        const [adpMapping, [rows]] = await Promise.all([
          queryAdpMapping(codeKey),
          hosPool.query(
            `SELECT
              o.vn, IFNULL(pt.cid, '') AS cid, o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              ptt.name AS pttypename,
              ptt.pttype_eclaim_id AS pttype_eclaim_id,
              dep.department, spc.name AS clinic,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              dd.name AS listname,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated
            FROM (
              SELECT oo.vn,
                GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN s_drugitems d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND TRIM(d.nhso_adp_code) IN (?, ?)
              GROUP BY oo.vn
            ) dd
            JOIN ovst o ON o.vn = dd.vn
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN nationality nat ON nat.nationality = pt.nationality
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype vt ON vt.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) rep ON rep.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN (
              SELECT m.opdseq AS vn,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                     SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
              FROM eclaimdb.m_registerdata m
              LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
              WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> ''
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC`,
            [ds1, ds2, pair[0], pair[1], ds1, ds2, ds1, ds2, ds1, ds2]
          ),
        ])
        return { adpMapping, rawRows: rows || [] }
      }
      const data = refresh === 'true' ? await fetcher() : await getCached(cacheKey, 300000, fetcher)
      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })
}
