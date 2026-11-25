/**
 * RCM Specialized Funds V2 Named API Routes (Phase 1B Step 3)
 * 100% Zero-SQL on Next.js:
 *   - iron-supplements (18.2, 25 DIDs + ADP 14001, female 13-45)
 *   - anc-30011 (2.4) & anc-23 (2.3)
 *   - amed-homeward (IPD + optional rcmdb.amed)
 *   - rehabilitation (11.47.3, 16 REHAB_ADP_CODES + rehab_service + noVn) & rehab-adp-mapping
 *   - imc (IPD & OPD + imc_service + Seamless Rep breakdown)
 *   - instrument (OPD & IPD nhso_adp_type_id = 2) & instrument-adp-mapping
 *   - streptokinase (OPD & IPD STEMI), stemi-adp-mapping, an-details/:an
 *   - adp-search (OPD & IPD multi-ADP), available-codes, check-mapping
 *   - family-planning-91 (NEW_ECLAIM / KRUNGTHAI), family-planning-91/adp-mapping
 *   - family-planning-93 (OPD & IPD)
 *
 * Dead tables `rcmdb.neweclaim` (0 rows) and `eclaimdb.m_registerdata` (stale since 25660912)
 * are omitted for optimal query performance.
 */

const IRON_SUPPLEMENT_DIDS = [
  '202030120137819920381422',
  '100488000004203120381169',
  '100489000004320121881267',
  '100488000004203121781674',
  '100488000004203120381442',
  '100488000004203120381013',
  '100488000004203121781144',
  '100488000004203120381053',
  '100488000004203120381144',
  '100488000004203120381271',
  '100488000004203120381341',
  '100488000004203120381626',
  '100488000004203121881626',
  '100488000004203121881442',
  '100488000004203121881553',
  '100489000004192121881506',
  '100489000004320120381122',
  '100489000004320120381506',
  '100489000004203120381555',
  '100489000004203120381084',
  '100489000004203120381144',
  '100489000004203120381619',
  '100489000004203120381477',
  '100489000004203120381544',
  '100489000004203120381546',
]

const REHAB_ADP_CODES = [
  'H9449.1', 'H0489', 'H9339', 'H9375.1', 'H9375.2', 'H9378.1', 'H9378.2', 'H9378.3',
  'H9383.1', 'H9383.2', 'H9433.1', 'H9433.2', 'H9438.1', 'H9438.2', 'H9449.2', 'H9549',
]

const NEW_ECLAIM_FP_CODES = ['FP001', 'FP002', 'FP003_1', 'FP003_2', 'FP003_3', 'FP003_4']
const KRUNGTHAI_FP_CODES = ['20001', '20002', '20003', '20004']

function resolveDates(query) {
  const ds1 = String(query.startDate || query.ds1 || '').trim()
  const ds2 = String(query.endDate || query.ds2 || '').trim()
  return { ds1, ds2 }
}

function validateDates(ds1, ds2, reply) {
  const re = /^\d{4}-\d{2}-\d{2}$/
  if (!re.test(ds1) || !re.test(ds2)) {
    reply.code(400).send({ success: false, error: 'Invalid startDate/endDate format (YYYY-MM-DD required)' })
    return false
  }
  return true
}

async function safeQuery(pool, sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params)
    return rows || []
  } catch {
    return []
  }
}

export default async function rcmFundsSpecialV2Routes(fastify, { pools }) {
  const { hosPool } = pools

  // ── 1. Iron Supplements (18.2) ─────────────────────────────────────────────
  fastify.get('/api/v1/clinical/rcm/funds-v2/iron-supplements', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานบริการยาเม็ดเสริมธาตุเหล็ก (18.2 V2)' } }, async (request, reply) => {
    const { ds1, ds2 } = resolveDates(request.query || {})
    if (!validateDates(ds1, ds2, reply)) return
    const adpCode = '14001'
    const didPlaceholders = IRON_SUPPLEMENT_DIDS.map(() => '?').join(', ')

    const sql = `
      SELECT
        o.vn,
        IFNULL(pt.cid, '') AS cid,
        o.hn,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
        IFNULL(pt.sex, '') AS sex_code,
        IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
        IFNULL(nat.name, pt.nationality) AS nation,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        IFNULL(ptt.hipdata_code, '') AS maininscl,
        ptt.name AS pttypename,
        ptt.pttype_eclaim_id,
        dep.department AS department,
        spc.name AS clinic,
        v.pdx,
        v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
        v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
        IFNULL(v.income, 0) AS income,
        dd.drugname AS drugname,
        dd.name AS listname,
        (
          SELECT GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ')
          FROM opitemrece a
          JOIN nondrugitems b ON b.icode = a.icode
          WHERE a.vn = o.vn
        ) AS listname1,
        COALESCE(nhso.statusname, rep.statusname) AS status,
        COALESCE(nhso.rep, rep.rep) AS rep,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        rep.agency,
        rep.fund AS fund,
        rep.subfund AS subfund,
        rep.errorcode,
        rep.transactiontype
      FROM (
        SELECT
          oo.vn,
          GROUP_CONCAT(DISTINCT target_items.drug_name SEPARATOR ', ') AS drugname,
          GROUP_CONCAT(DISTINCT target_items.adp_name SEPARATOR ', ') AS name
        FROM (
          SELECT
            icode,
            CONCAT_WS(' ', name, NULLIF(strength, '')) AS drug_name,
            NULL AS adp_name
          FROM drugitems
          WHERE did IN (${didPlaceholders})
          UNION ALL
          SELECT
            icode,
            NULL AS drug_name,
            CONCAT_WS(' ', s_sub.name, NULLIF(s_sub.strength, '')) AS adp_name
          FROM s_drugitems s_sub
          WHERE TRIM(s_sub.nhso_adp_code) = ?
        ) target_items
        JOIN opitemrece oo ON oo.icode = target_items.icode
        WHERE IFNULL(oo.vn, '') <> ''
          AND oo.vstdate BETWEEN ? AND ?
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
        SELECT vn,
               GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
               SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
               IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: มี Rep แล้ว', NULL) AS statusname,
               GROUP_CONCAT(DISTINCT agency SEPARATOR ',') AS agency,
               GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
               GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund,
               GROUP_CONCAT(DISTINCT errorcode SEPARATOR ',') AS errorcode,
               GROUP_CONCAT(DISTINCT transactiontype SEPARATOR ',') AS transactiontype
        FROM rcmdb.repdata
        WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY vn
      ) rep ON rep.vn = o.vn
      WHERE o.vstdate BETWEEN ? AND ?
        AND (v.sex = 2 OR v.sex = '2' OR pt.sex = '2' OR pt.sex = 2)
        AND (
          v.age_y BETWEEN 13 AND 45
          OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) BETWEEN 13 AND 45
        )
      GROUP BY o.vn
      ORDER BY o.hn ASC, o.vn ASC
    `
    const params = [...IRON_SUPPLEMENT_DIDS, adpCode, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2]
    const [rows] = await hosPool.query(sql, params)
    return { success: true, data: { rawRows: rows || [] } }
  })

  // ── 2. ANC 30011 (2.4) ─────────────────────────────────────────────────────
  fastify.get('/api/v1/clinical/rcm/funds-v2/anc-30011', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานบริการฝากครรภ์ ANC ADP 30011 (2.4)' } }, async (request, reply) => {
    const { ds1, ds2 } = resolveDates(request.query || {})
    if (!validateDates(ds1, ds2, reply)) return

    const sql = `
      SELECT
        o.vn,
        IFNULL(pt.cid, '') AS cid,
        o.hn,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
        IFNULL(nat.name, pt.nationality) AS nation,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        ptt.name AS pttypename,
        ptt.pttype_eclaim_id AS pttype_eclaim_id,
        dep.department,
        spc.name AS clinic,
        v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
        v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
        dd.name AS listname,
        (SELECT GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ')
         FROM opitemrece a
         JOIN nondrugitems b ON b.icode = a.icode
         WHERE a.vn = o.vn) AS listname1,
        COALESCE(nhso.statusname, rep.statusname, '-:ยังไม่ได้ส่ง') AS status,
        COALESCE(nhso.rep, rep.rep) AS rep,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        re.fund,
        re.subfund
      FROM ovst o
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN nationality nat ON nat.nationality = pt.nationality
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
      LEFT JOIN spclty spc ON spc.spclty = o.spclty
      LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
      LEFT JOIN visit_pttype vt ON vt.vn = o.vn
      JOIN (
        SELECT
          oo.vn,
          GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
        FROM opitemrece oo
        JOIN s_drugitems d ON d.icode = oo.icode
        WHERE IFNULL(oo.vn, '') <> ''
          AND oo.vstdate BETWEEN ? AND ?
          AND TRIM(d.nhso_adp_code) IN ('30011')
        GROUP BY oo.vn
      ) dd ON dd.vn = o.vn
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
      LEFT JOIN (
        SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
               GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
        FROM rcmdb.repdata
        WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY vn
      ) re ON re.vn = o.vn
      WHERE o.vstdate BETWEEN ? AND ?
      GROUP BY o.vn
      ORDER BY o.hn ASC, o.vn ASC
    `
    const [rows] = await hosPool.query(sql, [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2])
    return { success: true, data: { rawRows: rows || [] } }
  })

  // ── 3. ANC 2.3 (Ultrasound / Dental / ANC) ─────────────────────────────────
  fastify.get('/api/v1/clinical/rcm/funds-v2/anc-23', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานบริการฝากครรภ์ ANC 2.3 (Ultrasound / ทันตกรรม / ANC)' } }, async (request, reply) => {
    const { ds1, ds2 } = resolveDates(request.query || {})
    if (!validateDates(ds1, ds2, reply)) return

    const sql = `
      SELECT
        o.vn,
        o.hn,
        IFNULL(pt.cid, '') AS cid,
        anc_info.person_id,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        IFNULL(pt.sex, '2') AS sex,
        TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
        IFNULL(nat.name, pt.nationality) AS nation,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        dep.department AS room,
        ptt_pt.name AS pttypename_patient,
        ptt_o.name AS pttypename_visit,
        IFNULL(ptt_o.pttype_eclaim_id, '') AS pttype_eclaim_id,
        IF(ptt_o.pttype_eclaim_id BETWEEN '01' AND '09', 'Y', ' ') AS uc,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt_auth.auth_code), ''), NULLIF(TRIM(vt_auth.claim_code), '')) AS authencode,
        (
          IF(dent.vn IS NOT NULL, 1, 0) +
          IF(anc_info.person_anc_id IS NOT NULL, 10, 0) +
          IF(oper.vn IS NOT NULL, 100, 0) +
          IF(srv.vn IS NOT NULL, 1000, 0)
        ) AS group_id_num,
        anc_info.preg_no,
        DATE_FORMAT(anc_info.lmp, '%Y-%m-%d') AS lmp,
        DATE_FORMAT(DATE_ADD(anc_info.lmp, INTERVAL 168 DAY), '%Y-%m-%d') AS lastdate,
        dt.pregnancy,
        TIMESTAMPDIFF(WEEK, anc_info.lmp, o.vstdate) AS ga,
        DATE_FORMAT(anc_info.labor_date, '%Y-%m-%d') AS labor_date,
        DATE_FORMAT(anc_info.discharge_date, '%Y-%m-%d') AS dchdate,
        srv.servicename,
        oper.oper,
        GROUP_CONCAT(DISTINCT IF(tm.icd10tm_operation_code IN ('2330011','2330013'), 'Y', NULL)) AS checkup,
        GROUP_CONCAT(DISTINCT IF(tm.icd10tm_operation_code IN ('2387010','2277310','2277320','2287310','2287320'), 'Y', NULL)) AS scalling,
        GROUP_CONCAT(DISTINCT IF(tm.icd10tm_operation_code IN ('2330011','2330013','2387010','2277310','2277320','2287310','2287320'), DATE_FORMAT(o.vstdate, '%Y-%m-%d'), NULL)) AS service_date,
        CONCAT_WS(',',
          GROUP_CONCAT(DISTINCT IF(tm.icd10tm_operation_code IN ('2330011','2330013','2387010','2277310','2277320','2287310','2287320'), tm.icd10tm_operation_code, NULL)),
          oper.oper
        ) AS itemname,
        o.doctor,
        pt.type_area AS typearea,
        CONCAT_WS(' ', pt.addrpart, pt.moopart, pt.road) AS address,
        CONCAT_WS(' ', NULLIF(pt.informtel, ''), NULLIF(pt.hometel, '')) AS tel,
        NULL AS eclaim_no,
        NULL AS service,
        COALESCE(nhso.statusname, rep.statusname, '- :: ยังไม่ได้ส่ง') AS status_eclaim,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        COALESCE(nhso.rep, rep.rep) AS rep,
        rr.fund,
        rr.subfund
      FROM (
        SELECT o.vn
        FROM ovst o
        JOIN dental_care dc ON dc.vn = o.vn
        WHERE o.vstdate BETWEEN ? AND ? AND dc.dental_care_type_id = 1
        UNION
        SELECT dx.vn
        FROM ovstdiag dx
        LEFT JOIN vn_stat v ON v.vn = dx.vn
        JOIN person p ON p.patient_hn = dx.hn
        JOIN person_anc anc ON anc.person_id = p.person_id
        WHERE dx.vstdate BETWEEN ? AND ?
          AND dx.icd10 REGEXP '887[6-9]'
          AND (v.sex = '2' OR v.sex IS NULL)
        UNION
        SELECT oo.vn
        FROM opitemrece oo
        JOIN nondrugitems d ON d.icode = oo.icode
        LEFT JOIN vn_stat v ON v.vn = oo.vn
        WHERE oo.vstdate BETWEEN ? AND ?
          AND IFNULL(oo.vn, '') <> ''
          AND (
            d.billcode IN ('30010', '52612')
            OR d.icode IN ('3002551', '3002605', '3000516', '3002083')
            OR d.name LIKE '%ทารก%'
            OR d.name LIKE '%สูติ%'
            OR d.billcode LIKE '%887%'
          )
          AND (v.sex = '2' OR v.sex IS NULL)
        UNION
        SELECT s.vn
        FROM person_anc_service s
        JOIN person_anc anc ON anc.person_anc_id = s.person_anc_id
        JOIN ovst o ON o.vn = s.vn
        WHERE s.anc_service_date BETWEEN ? AND ?
          AND s.anc_service_type_id = 1
        UNION
        SELECT o.vn
        FROM person_anc anc
        JOIN person p ON p.person_id = anc.person_id
        JOIN ovst o ON o.hn = p.patient_hn
        WHERE o.vstdate BETWEEN ? AND ?
          AND anc.lmp IS NOT NULL
          AND TIMESTAMPDIFF(WEEK, anc.lmp, o.vstdate) BETWEEN 0 AND 24
      ) vt
      JOIN ovst o ON o.vn = vt.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN nationality nat ON nat.nationality = pt.nationality
      LEFT JOIN pttype ptt_pt ON ptt_pt.pttype = pt.pttype
      LEFT JOIN pttype ptt_o ON ptt_o.pttype = o.pttype
      LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
      LEFT JOIN (
        SELECT dc.vn FROM dental_care dc WHERE dc.dental_care_type_id = 1 GROUP BY dc.vn
      ) dent ON dent.vn = o.vn
      LEFT JOIN (
        SELECT dx.vn, GROUP_CONCAT(DISTINCT dx.icd10 SEPARATOR ',') AS oper
        FROM ovstdiag dx
        WHERE dx.vstdate BETWEEN ? AND ? AND dx.icd10 REGEXP '887[6-9]'
        GROUP BY dx.vn
      ) oper ON oper.vn = o.vn
      LEFT JOIN (
        SELECT oo.vn, GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS servicename
        FROM opitemrece oo
        JOIN nondrugitems d ON d.icode = oo.icode
        WHERE oo.vstdate BETWEEN ? AND ?
          AND (
            d.billcode IN ('30010', '52612')
            OR d.icode IN ('3002551', '3002605', '3000516', '3002083')
            OR d.name LIKE '%ทารก%'
            OR d.name LIKE '%สูติ%'
            OR d.billcode LIKE '%887%'
          )
        GROUP BY oo.vn
      ) srv ON srv.vn = o.vn
      LEFT JOIN (
        SELECT o2.vn, anc.person_id, anc.person_anc_id, anc.lmp, anc.preg_no, anc.labor_date, anc.discharge_date
        FROM ovst o2
        JOIN person p ON p.patient_hn = o2.hn
        JOIN person_anc anc ON anc.person_id = p.person_id
        WHERE o2.vstdate BETWEEN ? AND ?
          AND (anc.labor_date IS NULL OR o2.vstdate <= anc.labor_date)
        GROUP BY o2.vn
      ) anc_info ON anc_info.vn = o.vn
      LEFT JOIN dtmain dt ON dt.vn = o.vn
      LEFT JOIN dttm tm ON tm.code = dt.tmcode
      LEFT JOIN (
        SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
               'NHSO :: ได้รับ Invoice แล้ว' AS statusname
        FROM rcmdb.repeclaim
        WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
          AND (errorcode = '' OR errorcode IS NULL)
        GROUP BY vn
      ) nhso ON nhso.vn = o.vn
      LEFT JOIN (
        SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
               'Rep :: ส่ง Rep แล้ว' AS statusname
        FROM rcmdb.repdata
        WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
          AND (errorcode = '' OR errorcode IS NULL)
        GROUP BY vn
      ) rep ON rep.vn = o.vn
      LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
      LEFT JOIN visit_pttype vt_auth ON vt_auth.vn = o.vn
      LEFT JOIN (
        SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ', ') AS fund, GROUP_CONCAT(DISTINCT subfund SEPARATOR ', ') AS subfund
        FROM rcmdb.repdata
        WHERE IFNULL(vn, '') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY vn
      ) rr ON rr.vn = o.vn
      GROUP BY o.vn
      ORDER BY o.vstdate DESC, o.vsttime DESC
    `
    const params = [
      ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2,
      ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2,
    ]
    const [rows] = await hosPool.query(sql, params)
    return { success: true, data: { rawRows: rows || [] } }
  })

  // ── 4. AMed Homeward ───────────────────────────────────────────────────────
  fastify.get('/api/v1/clinical/rcm/funds-v2/amed-homeward', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานบริการดูแลผู้ป่วยที่บ้าน AMed Homeward' } }, async (request, reply) => {
    const { ds1, ds2 } = resolveDates(request.query || {})
    if (!validateDates(ds1, ds2, reply)) return

    let hasAmedTable = false
    try {
      const [tbl] = await hosPool.query("SHOW TABLES IN rcmdb LIKE 'amed'")
      hasAmedTable = Array.isArray(tbl) && tbl.length > 0
    } catch {
      hasAmedTable = false
    }

    const amedJoin = hasAmedTable ? 'LEFT OUTER JOIN rcmdb.amed aa ON aa.cid = pt.cid' : ''
    const amedSelect = hasAmedTable
      ? 'MAX(aa.cid) AS onweb_cid, MAX(aa.an) AS anonweb,'
      : 'NULL AS onweb_cid, NULL AS anonweb,'

    const sql = `
      SELECT
        COALESCE(NULLIF(re.rep, ''), NULLIF(r.rep, '')) AS rep,
        r.remark AS rep_remark,
        re.rep AS invoice,
        COALESCE(re.compensated, r.compensated, 0) AS compensated,
        ${amedSelect}
        i.an,
        i.hn,
        IFNULL(pt.cid, '') AS cid,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        IFNULL(pt.sex, '') AS sex_code,
        DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
        IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
        CONCAT_WS(':', pt.nationality, IFNULL(nat.name, pt.nationality)) AS nation,
        DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
        DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
        IFNULL(a.admdate, 0) AS los,
        DATE_FORMAT(idx.modify_datetime, '%Y-%m-%d %H:%i') AS editdate,
        IFNULL(TIMESTAMPDIFF(DAY, i.dchdate, idx.modify_datetime), 0) AS day_diff,
        IFNULL(w.name, i.ward) AS ward,
        IFNULL(adm.bedno, '') AS bedno,
        IFNULL(spc.name, i.spclty) AS clinic,
        IFNULL(i.prediag, '') AS prediag,
        IFNULL(a.pdx, '') AS pdx,
        IFNULL(icd.name, a.pdx) AS pdxname,
        (
          SELECT GROUP_CONCAT(DISTINCT dx2.icd10 ORDER BY dx2.diagtype SEPARATOR ', ')
          FROM iptdiag dx2
          WHERE dx2.an = i.an AND dx2.diagtype <> 1
        ) AS sdx,
        (
          SELECT GROUP_CONCAT(DISTINCT op.icd9 SEPARATOR ', ')
          FROM iptoprt op
          WHERE op.an = i.an
        ) AS proc_code,
        IFNULL(i.adjrw, 0) AS adjrw,
        IFNULL(d1.name, i.admdoctor) AS admdoctor,
        IFNULL(d2.name, i.dch_doctor) AS dchdoctor,
        IFNULL(cc.auth_code, '') AS authencode,
        IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
        IFNULL(e.name, '') AS pttype_eclaim_name,
        IFNULL(i.pttype, '') AS pttype,
        IFNULL(ptt.name, i.pttype) AS pttypename,
        IFNULL(ptt.pttype, '') AS copttype,
        IFNULL(e.gf_ipd, '') AS gfmis,
        IFNULL(e.ar_ipd, '') AS accountcode,
        IFNULL(v.pttypeno, '') AS pttypeno,
        CONCAT_WS(':', v.hospmain, IFNULL(hm.name, v.hospmain)) AS hospmain,
        CONCAT_WS(':', v.hospsub, IFNULL(hs.name, v.hospsub)) AS hospsub,
        IFNULL(ds.name, i.dchstts) AS dchstts,
        IFNULL(dt.name, i.dchtype) AS dchtype,
        IFNULL(iss.ipt_summary_status_name, i.ipt_summary_status_id) AS summary_status,
        IFNULL(a.income, 0) AS income,
        IFNULL(a.uc_money, 0) AS uc_money,
        IFNULL(a.discount_money, 0) AS discount_money,
        IFNULL(a.paid_money, 0) AS paid_money,
        IFNULL(a.rcpt_money, 0) AS rcpt_money,
        IFNULL(a.rcpno_list, '') AS rcpno,
        (IFNULL(a.income, 0) - IFNULL(a.discount_money, 0) - IFNULL(a.rcpt_money, 0)) AS debit,
        (SELECT MAX(max_debt_amount) FROM ipt_pttype WHERE an = i.an) AS max_debt_amount,
        SUM(IFNULL(p.follow, 0)) AS follow_money,
        GROUP_CONCAT(DISTINCT CONCAT(p.bill, '#', IFNULL(p.follow, 0)) SEPARATOR ', ') AS bill,
        GROUP_CONCAT(DISTINCT DATE_FORMAT(p.lastdate, '%Y-%m-%d') SEPARATOR ', ') AS billdate,
        IFNULL(opu.name, i.staff) AS staff,
        IFNULL(pt.informaddr, '') AS address,
        IFNULL(pt.mobile_phone_number, '') AS mobile,
        CONCAT_WS(' / ', NULLIF(TRIM(pt.informtel), ''), NULLIF(TRIM(pt.hometel), '')) AS tel
      FROM ipt i
      LEFT OUTER JOIN an_stat a ON a.an = i.an
      LEFT OUTER JOIN patient pt ON i.hn = pt.hn
      LEFT OUTER JOIN rcmdb.debit_ipd_paid p ON p.an = i.an
      LEFT OUTER JOIN pttype ptt ON ptt.pttype = i.pttype
      LEFT OUTER JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
      LEFT OUTER JOIN vn_stat v ON v.vn = i.vn
      LEFT OUTER JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
      LEFT OUTER JOIN visit_pttype cc ON cc.vn = i.vn
      ${amedJoin}
      LEFT OUTER JOIN (
        SELECT
          an,
          SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
          SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(remark, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS remark,
          SUM(IFNULL(compensated, 0)) AS compensated
        FROM rcmdb.repdata
        WHERE IFNULL(an, '') <> ''
        GROUP BY an
      ) r ON r.an = i.an
      LEFT OUTER JOIN (
        SELECT
          an,
          SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
          SUM(IFNULL(compensated, 0)) AS compensated
        FROM rcmdb.repeclaim
        WHERE IFNULL(an, '') <> ''
        GROUP BY an
      ) re ON re.an = i.an
      LEFT OUTER JOIN nationality nat ON nat.nationality = pt.nationality
      LEFT OUTER JOIN ward w ON w.ward = i.ward
      LEFT OUTER JOIN iptadm adm ON adm.an = i.an
      LEFT OUTER JOIN spclty spc ON spc.spclty = i.spclty
      LEFT OUTER JOIN icd101 icd ON icd.code = a.pdx
      LEFT OUTER JOIN doctor d1 ON d1.code = i.admdoctor
      LEFT OUTER JOIN doctor d2 ON d2.code = i.dch_doctor
      LEFT OUTER JOIN hospcode hm ON hm.hospcode = v.hospmain
      LEFT OUTER JOIN hospcode hs ON hs.hospcode = v.hospsub
      LEFT OUTER JOIN dchstts ds ON ds.dchstts = i.dchstts
      LEFT OUTER JOIN dchtype dt ON dt.dchtype = i.dchtype
      LEFT OUTER JOIN ipt_summary_status iss ON iss.ipt_summary_status_id = i.ipt_summary_status_id
      LEFT OUTER JOIN opduser opu ON opu.loginname = i.staff
      WHERE i.dchdate BETWEEN ? AND ?
        AND ptt.pttype_eclaim_id BETWEEN '01' AND '09'
      GROUP BY i.an
      ORDER BY i.dchdate DESC, i.an DESC
    `
    const [rows] = await hosPool.query(sql, [ds1, ds2])
    return { success: true, data: { rawRows: rows || [], hasAmedTable } }
  })

  // ── 5. Rehabilitation (11.47.3) & ADP Mapping ──────────────────────────────
  fastify.get('/api/v1/clinical/rcm/funds-v2/rehab-adp-mapping', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'ตรวจสอบ ADP Mapping กองทุนฟื้นฟูสมรรถภาพ (11.47.3)' } }, async () => {
    const placeholders = REHAB_ADP_CODES.map(() => '?').join(',')
    const sql = `
      SELECT TRIM(icode) AS icode, TRIM(name) AS name, TRIM(strength) AS strength, TRIM(nhso_adp_code) AS nhso_adp_code
      FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (${placeholders})
      UNION
      SELECT TRIM(icode) AS icode, TRIM(name) AS name, '' AS strength, TRIM(nhso_adp_code) AS nhso_adp_code
      FROM nondrugitems WHERE TRIM(nhso_adp_code) IN (${placeholders})
      ORDER BY nhso_adp_code ASC
    `
    const rows = await safeQuery(hosPool, sql, [...REHAB_ADP_CODES, ...REHAB_ADP_CODES])
    const items = rows.map((r) => ({
      icode: String(r.icode || ''),
      name: String(r.name || ''),
      strength: r.strength ? String(r.strength) : null,
      nhso_adp_code: String(r.nhso_adp_code || ''),
    }))
    return {
      success: true,
      adpCode: 'REHAB',
      isMapped: items.length > 0,
      mappedCount: items.length,
      totalTargetCodes: REHAB_ADP_CODES.length,
      items,
    }
  })

  fastify.get('/api/v1/clinical/rcm/funds-v2/rehabilitation', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานบริการฟื้นฟูสมรรถภาพ Rehabilitation (11.47.3)' } }, async (request, reply) => {
    const { ds1, ds2 } = resolveDates(request.query || {})
    if (!validateDates(ds1, ds2, reply)) return
    const placeholders = REHAB_ADP_CODES.map(() => '?').join(',')

    const opCandidateSql = `
      SELECT DISTINCT oo.vn
      FROM (
        SELECT icode FROM nondrugitems WHERE nhso_adp_code IN (${placeholders})
        UNION ALL
        SELECT icode FROM s_drugitems WHERE nhso_adp_code IN (${placeholders})
      ) target_items
      JOIN opitemrece oo ON oo.icode = target_items.icode
      WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> ''
    `
    const rsCandidateSql = `
      SELECT DISTINCT s.vn FROM rcmdb.rehab_service s
      WHERE s.vstdate BETWEEN ? AND ? AND IFNULL(s.vn, '') <> ''
    `
    const sqlNoVn = `
      SELECT
        rs.vn, rs.an, IFNULL(rs.cid, '') AS cid, rs.hn, rs.ptname,
        DATE_FORMAT(rs.vstdate, '%Y-%m-%d') AS vstdate, '00:00:00' AS vsttime,
        NULL AS authencode, 'UC' AS maininscl, 'สิทธิ์จากเว็บ Disability' AS pttypename,
        '01' AS pttype_eclaim_id, NULL AS department, NULL AS clinic, 0 AS income,
        NULL AS listname, rs.diag, rs.oper, NULL AS doctorname, 'Web' AS filetype,
        rs.rehab_name, rs.rehab_code, NULL AS rep_seamless, NULL AS payno,
        0 AS compensated_seamless, NULL AS nocompensated, NULL AS status, NULL AS rep,
        0 AS compensated, rs.targetgroup, rs.deformed_type, rs.adl,
        DATE_FORMAT(rs.startservice, '%Y-%m-%d') AS startservice,
        DATE_FORMAT(rs.endservice, '%Y-%m-%d') AS endservice,
        rs.unitprice, rs.realprice, rs.staff, rs.serialno, rs.status AS web_status, rs.filename
      FROM rcmdb.rehab_service rs
      WHERE rs.vstdate BETWEEN ? AND ? AND IFNULL(rs.vn, '') = ''
      ORDER BY rs.vstdate DESC
    `

    const [opRows, rsRows, noVnRows] = await Promise.all([
      safeQuery(hosPool, opCandidateSql, [...REHAB_ADP_CODES, ...REHAB_ADP_CODES, ds1, ds2]),
      safeQuery(hosPool, rsCandidateSql, [ds1, ds2]),
      safeQuery(hosPool, sqlNoVn, [ds1, ds2]),
    ])

    const candidateVns = Array.from(
      new Set([...opRows.map((r) => String(r.vn || '').trim()), ...rsRows.map((r) => String(r.vn || '').trim())])
    ).filter(Boolean)

    let mainRows = []
    if (candidateVns.length > 0) {
      const vnPlaceholders = candidateVns.map(() => '?').join(',')
      const buildVisitSql = (includeRehabService) => `
        SELECT
          o.vn, o.an, IFNULL(pt.cid, '') AS cid, o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
          IFNULL(ptt.hipdata_code, '') AS maininscl,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          ptt.pttype_eclaim_id,
          IFNULL(dep.department, o.main_dep) AS department,
          IFNULL(spc.name, o.spclty) AS clinic,
          v.income,
          (
            SELECT GROUP_CONCAT(CONCAT_WS('#', oo.icode, IFNULL(d.nhso_adp_code, ''), IFNULL(d.name, ''), oo.sum_price) SEPARATOR '||')
            FROM opitemrece oo
            LEFT JOIN nondrugitems d ON d.icode = oo.icode
            WHERE oo.vn = o.vn AND (d.nhso_adp_code IN (${placeholders}) OR oo.income = '09' OR d.nhso_adp_code LIKE 'H%')
          ) AS listname,
          v.pdx AS diag,
          v.op0 AS oper,
          IFNULL(doc.name, o.doctor) AS doctorname,
          ${includeRehabService ? "IF(rs.vn IS NOT NULL, 'Web & HOSxP', 'HOSxP')" : "'HOSxP'"} AS filetype,
          ${includeRehabService ? "IFNULL(rs.rehab_name, 'ไม่พบใน Web')" : "'ไม่พบใน Web'"} AS rehab_name,
          (
            SELECT GROUP_CONCAT(DISTINCT d.nhso_adp_code SEPARATOR ', ')
            FROM opitemrece oo
            JOIN nondrugitems d ON d.icode = oo.icode
            WHERE oo.vn = o.vn AND d.nhso_adp_code IN (${placeholders})
          ) AS rehab_code,
          sm.rep AS rep_seamless, sm.payno, sm.type AS seamless_type,
          sm.compensated AS compensated_seamless, sm.noCompensated,
          ${includeRehabService ? 'rs.targetgroup,' : 'NULL AS targetgroup,'}
          ${includeRehabService ? 'rs.deformed_type,' : 'NULL AS deformed_type,'}
          ${includeRehabService ? 'rs.adl,' : 'NULL AS adl,'}
          ${includeRehabService ? "DATE_FORMAT(rs.startservice, '%Y-%m-%d') AS startservice," : 'NULL AS startservice,'}
          ${includeRehabService ? "DATE_FORMAT(rs.endservice, '%Y-%m-%d') AS endservice," : 'NULL AS endservice,'}
          ${includeRehabService ? 'rs.unitprice,' : 'NULL AS unitprice,'}
          ${includeRehabService ? 'rs.realprice,' : 'NULL AS realprice,'}
          ${includeRehabService ? 'rs.staff,' : 'NULL AS staff,'}
          ${includeRehabService ? 'rs.serialno,' : 'NULL AS serialno,'}
          ${includeRehabService ? 'rs.status AS web_status,' : 'NULL AS web_status,'}
          ${includeRehabService ? 'rs.filename' : 'NULL AS filename'}
        FROM ovst o
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN doctor doc ON doc.code = o.doctor
        LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
        LEFT JOIN visit_pttype vt ON vt.vn = o.vn
        ${includeRehabService ? 'LEFT JOIN rcmdb.rehab_service rs ON rs.vn = o.vn' : ''}
        LEFT JOIN (
          SELECT vn,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(payno, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS payno,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(type, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS type,
            SUM(IFNULL(compensated, 0)) AS compensated,
            SUM(IFNULL(noCompensated, 0)) AS noCompensated
          FROM rcmdb.seamless
          WHERE IFNULL(vn, '') <> '' AND vn IN (${vnPlaceholders})
          GROUP BY vn
        ) sm ON sm.vn = o.vn
        WHERE o.vn IN (${vnPlaceholders})
        ORDER BY o.vstdate DESC, o.vsttime DESC
      `

      const visitParams = [...REHAB_ADP_CODES, ...REHAB_ADP_CODES, ...candidateVns, ...candidateVns]
      let visitRows = []
      try {
        const [r1] = await hosPool.query(buildVisitSql(true), visitParams)
        visitRows = r1 || []
      } catch (err) {
        if (/rehab_service/i.test(String(err?.message || ''))) {
          const [r2] = await hosPool.query(buildVisitSql(false), visitParams)
          visitRows = r2 || []
        } else {
          throw err
        }
      }

      const [nhsoRows, repRows] = await Promise.all([
        safeQuery(
          hosPool,
          `SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                  'NHSO :: มี Invoice แล้ว' AS statusname
           FROM rcmdb.repeclaim
           WHERE department = 'OP' AND vn IN (${vnPlaceholders}) AND (errorcode = '' OR errorcode IS NULL)
           GROUP BY vn`,
          candidateVns
        ),
        safeQuery(
          hosPool,
          `SELECT vn,
                  GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
                  SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
                  IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: มี Rep แล้ว', NULL) AS statusname
           FROM rcmdb.repdata
           WHERE department = 'OP' AND vn IN (${vnPlaceholders})
           GROUP BY vn`,
          candidateVns
        ),
      ])

      const nhsoMap = new Map(nhsoRows.map((r) => [String(r.vn), r]))
      const repMap = new Map(repRows.map((r) => [String(r.vn), r]))

      mainRows = visitRows.map((v) => {
        const vnStr = String(v.vn)
        const nhso = nhsoMap.get(vnStr)
        const rep = repMap.get(vnStr)
        return {
          ...v,
          status: nhso?.statusname || rep?.statusname || v.status || null,
          rep: nhso?.rep || rep?.rep || v.rep || null,
          compensated: Number(nhso?.compensated ?? rep?.compensated ?? v.compensated ?? 0),
        }
      })
    }

    return { success: true, data: { rawRows: [...mainRows, ...noVnRows] } }
  })

  // ── 6. IMC (IPD & OPD + Seamless Rep breakdown) ────────────────────────────
  async function attachImcSeamlessReps(rows, patientType) {
    if (!Array.isArray(rows) || rows.length === 0) return rows
    const keyField = patientType === 'IPD' ? 'an' : 'vn'
    const keyCol = patientType === 'IPD' ? 'AN' : 'VN'
    const keys = Array.from(new Set(rows.map((r) => String(r?.[keyField] ?? '').trim()).filter(Boolean)))
    if (keys.length === 0) return rows

    const seamlessMap = new Map()
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000)
      const ph = chunk.map(() => '?').join(',')
      const sRows = await safeQuery(
        hosPool,
        `SELECT ${keyCol} AS k, Rep AS rep,
                GROUP_CONCAT(DISTINCT Fund ORDER BY Fund SEPARATOR ', ') AS fund,
                GROUP_CONCAT(DISTINCT Type ORDER BY Type SEPARATOR ', ') AS type,
                SUM(IFNULL(Collected, 0)) AS collected,
                SUM(IFNULL(Compensated, 0)) AS compensated
         FROM rcmdb.seamless
         WHERE ${keyCol} IN (${ph}) AND IFNULL(Rep, '') <> ''
         GROUP BY ${keyCol}, Rep
         ORDER BY Rep ASC`,
        chunk
      )
      for (const s of sRows) {
        const k = String(s.k || '').trim()
        if (!k || !s.rep) continue
        let entry = seamlessMap.get(k)
        if (!entry) {
          entry = { reps: new Set(), funds: new Set(), totalCompensated: 0, items: [] }
          seamlessMap.set(k, entry)
        }
        const repCode = String(s.rep).trim()
        const compVal = Number(s.compensated || 0)
        const collVal = Number(s.collected || 0)
        const fundVal = s.fund ? String(s.fund).trim() : null
        const typeVal = s.type ? String(s.type).trim() : null
        entry.reps.add(repCode)
        if (fundVal) {
          for (const f of fundVal.split(',').map((x) => x.trim()).filter(Boolean)) entry.funds.add(f)
        }
        entry.totalCompensated = Math.round((entry.totalCompensated + compVal) * 100) / 100
        entry.items.push({
          rep: repCode,
          fund: fundVal,
          type: typeVal,
          collected: Math.round(collVal * 100) / 100,
          compensated: Math.round(compVal * 100) / 100,
        })
      }
    }

    if (seamlessMap.size === 0) return rows
    return rows.map((row) => {
      const s = seamlessMap.get(String(row?.[keyField] ?? '').trim())
      if (!s || s.reps.size === 0) return row
      return {
        ...row,
        rep_seamless: Array.from(s.reps).join(','),
        seamless_funds: s.funds.size > 0 ? Array.from(s.funds).join(', ') : null,
        compensated_seamless: s.totalCompensated,
        seamless_rep_items: s.items,
      }
    })
  }

  fastify.get('/api/v1/clinical/rcm/funds-v2/imc', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานกองทุนผู้ป่วยระยะกลาง IMC (OPD/IPD + Seamless Rep)' } }, async (request, reply) => {
    const q = request.query || {}
    const { ds1, ds2 } = resolveDates(q)
    if (!validateDates(ds1, ds2, reply)) return
    const patientType = String(q.patientType || 'IPD').toUpperCase() === 'OPD' ? 'OPD' : 'IPD'

    if (patientType === 'IPD') {
      const [webRows, hosxpRows] = await Promise.all([
        safeQuery(
          hosPool,
          `SELECT DISTINCT s.an, s.amount AS getprice FROM rcmdb.imc_service s WHERE s.dchdate BETWEEN ? AND ? AND IFNULL(s.an, '') <> ''`,
          [ds1, ds2]
        ),
        safeQuery(
          hosPool,
          `SELECT DISTINCT i.an FROM ipt i JOIN iptdiag dx ON dx.an = i.an WHERE i.dchdate BETWEEN ? AND ? AND dx.icd10 REGEXP 'I6[0-4]|S06|S[1-3]4|S72[0-2]'`,
          [ds1, ds2]
        ),
      ])
      const webPriceMap = new Map()
      for (const r of webRows) if (r.an) webPriceMap.set(String(r.an).trim(), Number(r.getprice || 0))
      const candidateAns = Array.from(
        new Set([...hosxpRows.map((r) => String(r.an || '').trim()), ...webRows.map((r) => String(r.an || '').trim())])
      ).filter(Boolean)
      if (candidateAns.length === 0) return { success: true, data: { rawRows: [] } }

      const ph = candidateAns.map(() => '?').join(',')
      const [detailRows, nhsoRows, repRows] = await Promise.all([
        safeQuery(
          hosPool,
          `SELECT
            i.an, i.hn, IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            IFNULL(a.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate)) AS age,
            IF(cm.hn IS NOT NULL, 'Y', NULL) AS chronic,
            w.name AS ward,
            DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
            DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
            DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS date,
            a.admdate AS los, i.prediag,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
            ptt.pttype_eclaim_id, ds.name AS dchstts, dt.name AS dchtype,
            (SELECT GROUP_CONCAT(CONCAT(dx.icd10, ': ', IFNULL(i10.name, '')) ORDER BY dx.diagtype ASC SEPARATOR ', ')
             FROM iptdiag dx LEFT JOIN icd101 i10 ON i10.code = dx.icd10 WHERE dx.an = i.an) AS dx,
            (SELECT GROUP_CONCAT(CONCAT(od.icd9, ': ', IFNULL(i9.name, '')) SEPARATOR ', ')
             FROM iptoprt od LEFT JOIN icd9cm1 i9 ON i9.code = od.icd9 WHERE od.an = i.an) AS op,
            i.adjrw, a.income,
            CONCAT(IFNULL(pt.addrpart, ''), IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
              IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
              IF(tmb.name IS NOT NULL, CONCAT(' ต.', tmb.name), ''),
              IF(amp.name IS NOT NULL, CONCAT(' อ.', amp.name), '')) AS address,
            COALESCE(NULLIF(TRIM(pt.mobile_phone_number), ''), NULLIF(TRIM(pt.informtel), ''), NULLIF(TRIM(pt.hometel), ''), NULLIF(TRIM(pt.worktel), ''), '') AS tel
          FROM ipt i
          LEFT JOIN patient pt ON pt.hn = i.hn
          LEFT JOIN an_stat a ON a.an = i.an
          LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
          LEFT JOIN ward w ON w.ward = i.ward
          LEFT JOIN dchstts ds ON ds.dchstts = i.dchstts
          LEFT JOIN dchtype dt ON dt.dchtype = i.dchtype
          LEFT JOIN rcmdb.authencode cc ON (cc.vn = i.an OR cc.vn = i.vn)
          LEFT JOIN visit_pttype vt ON vt.vn = i.vn
          LEFT JOIN thaiaddress tmb ON tmb.chwpart = pt.chwpart AND tmb.amppart = pt.amppart AND tmb.tmbpart = pt.tmbpart
          LEFT JOIN thaiaddress amp ON amp.chwpart = pt.chwpart AND amp.amppart = pt.amppart AND amp.tmbpart = '00'
          LEFT JOIN clinicmember cm ON cm.hn = i.hn
            AND cm.clinic IN (SELECT clinic FROM clinic WHERE name LIKE '%stroke%' OR name LIKE '%หลอดเลือดสมอง%' OR clinic = '023')
          WHERE i.an IN (${ph})
          GROUP BY i.an
          ORDER BY i.dchdate DESC`,
          candidateAns
        ),
        safeQuery(
          hosPool,
          `SELECT an, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated, 'NHSO :: มี Invoice แล้ว' AS statusname
           FROM rcmdb.repeclaim WHERE department = 'IP' AND an IN (${ph}) AND (errorcode = '' OR errorcode IS NULL) GROUP BY an`,
          candidateAns
        ),
        safeQuery(
          hosPool,
          `SELECT an, GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
                  SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
                  IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: มี Rep แล้ว', NULL) AS statusname
           FROM rcmdb.repdata WHERE department = 'IP' AND an IN (${ph}) GROUP BY an`,
          candidateAns
        ),
      ])

      const nhsoMap = new Map(nhsoRows.map((r) => [String(r.an), r]))
      const repMap = new Map(repRows.map((r) => [String(r.an), r]))
      const hosxpSet = new Set(hosxpRows.map((r) => String(r.an || '').trim()))
      const merged = detailRows.map((row) => {
        const anStr = String(row.an)
        const nhso = nhsoMap.get(anStr)
        const rep = repMap.get(anStr)
        const inHosxp = hosxpSet.has(anStr)
        const inWeb = webPriceMap.has(anStr)
        return {
          ...row,
          web: inWeb ? 'Y' : null,
          filetype: inHosxp && inWeb ? 'ตรงกันทั้ง 2 ระบบ' : inWeb ? 'Web' : 'HOSxP',
          getprice: webPriceMap.get(anStr) ?? 0,
          status: nhso?.statusname || rep?.statusname || null,
          rep: nhso?.rep || rep?.rep || null,
          compensated: Number(nhso?.compensated ?? rep?.compensated ?? 0),
        }
      })
      const withSeamless = await attachImcSeamlessReps(merged, 'IPD')
      return { success: true, data: { rawRows: withSeamless } }
    } else {
      const [webRows, hosxpRows] = await Promise.all([
        safeQuery(
          hosPool,
          `SELECT DISTINCT s.vn, s.amount AS getprice FROM rcmdb.imc_service s WHERE s.vstdate BETWEEN ? AND ? AND IFNULL(s.vn, '') <> ''`,
          [ds1, ds2]
        ),
        safeQuery(
          hosPool,
          `SELECT DISTINCT o.vn FROM ovst o JOIN ovstdiag dx ON dx.vn = o.vn WHERE o.vstdate BETWEEN ? AND ? AND dx.icd10 REGEXP 'I6[0-4]|S06|S[1-3]4|S72[0-2]'`,
          [ds1, ds2]
        ),
      ])
      const webPriceMap = new Map()
      for (const r of webRows) if (r.vn) webPriceMap.set(String(r.vn).trim(), Number(r.getprice || 0))
      const candidateVns = Array.from(
        new Set([...hosxpRows.map((r) => String(r.vn || '').trim()), ...webRows.map((r) => String(r.vn || '').trim())])
      ).filter(Boolean)
      if (candidateVns.length === 0) return { success: true, data: { rawRows: [] } }

      const ph = candidateVns.map(() => '?').join(',')
      const [detailRows, nhsoRows, repRows] = await Promise.all([
        safeQuery(
          hosPool,
          `SELECT
            o.vn, o.an, o.hn, IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            IF(cm.hn IS NOT NULL, 'Y', NULL) AS chronic,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            s.cc,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
            ptt.pttype_eclaim_id,
            IFNULL(dep.department, o.main_dep) AS department,
            IFNULL(spc.name, o.spclty) AS clinic,
            ost.name AS ovstost,
            (SELECT GROUP_CONCAT(CONCAT(dx.icd10, ': ', IFNULL(i10.name, '')) ORDER BY dx.diagtype ASC SEPARATOR ', ')
             FROM ovstdiag dx LEFT JOIN icd101 i10 ON i10.code = dx.icd10 WHERE dx.vn = o.vn) AS dx,
            (SELECT GROUP_CONCAT(CONCAT(od.icd9, ': ', IFNULL(i9.name, '')) SEPARATOR ', ')
             FROM doctor_operation od LEFT JOIN icd9cm1 i9 ON i9.code = od.icd9 WHERE od.vn = o.vn) AS op,
            v.income,
            CONCAT(IFNULL(pt.addrpart, ''), IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
              IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
              IF(tmb.name IS NOT NULL, CONCAT(' ต.', tmb.name), ''),
              IF(amp.name IS NOT NULL, CONCAT(' อ.', amp.name), '')) AS address,
            COALESCE(NULLIF(TRIM(pt.mobile_phone_number), ''), NULLIF(TRIM(pt.informtel), ''), NULLIF(TRIM(pt.hometel), ''), NULLIF(TRIM(pt.worktel), ''), '') AS tel
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN opdscreen s ON s.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN ovstost ost ON ost.ovstost = o.ovstost
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN visit_pttype vt ON vt.vn = o.vn
          LEFT JOIN thaiaddress tmb ON tmb.chwpart = pt.chwpart AND tmb.amppart = pt.amppart AND tmb.tmbpart = pt.tmbpart
          LEFT JOIN thaiaddress amp ON amp.chwpart = pt.chwpart AND amp.amppart = pt.amppart AND amp.tmbpart = '00'
          LEFT JOIN clinicmember cm ON cm.hn = o.hn
            AND cm.clinic IN (SELECT clinic FROM clinic WHERE name LIKE '%stroke%' OR name LIKE '%หลอดเลือดสมอง%' OR clinic = '023')
          WHERE o.vn IN (${ph})
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC`,
          candidateVns
        ),
        safeQuery(
          hosPool,
          `SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated, 'NHSO :: มี Invoice แล้ว' AS statusname
           FROM rcmdb.repeclaim WHERE department = 'OP' AND vn IN (${ph}) AND (errorcode = '' OR errorcode IS NULL) GROUP BY vn`,
          candidateVns
        ),
        safeQuery(
          hosPool,
          `SELECT vn, GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
                  SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
                  IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: มี Rep แล้ว', NULL) AS statusname
           FROM rcmdb.repdata WHERE department = 'OP' AND vn IN (${ph}) GROUP BY vn`,
          candidateVns
        ),
      ])

      const nhsoMap = new Map(nhsoRows.map((r) => [String(r.vn), r]))
      const repMap = new Map(repRows.map((r) => [String(r.vn), r]))
      const hosxpSet = new Set(hosxpRows.map((r) => String(r.vn || '').trim()))
      const merged = detailRows.map((row) => {
        const vnStr = String(row.vn)
        const nhso = nhsoMap.get(vnStr)
        const rep = repMap.get(vnStr)
        const inHosxp = hosxpSet.has(vnStr)
        const inWeb = webPriceMap.has(vnStr)
        return {
          ...row,
          web: inWeb ? 'Y' : null,
          filetype: inHosxp && inWeb ? 'ตรงกันทั้ง 2 ระบบ' : inWeb ? 'Web' : 'HOSxP',
          getprice: webPriceMap.get(vnStr) ?? 0,
          status: nhso?.statusname || rep?.statusname || null,
          rep: nhso?.rep || rep?.rep || null,
          compensated: Number(nhso?.compensated ?? rep?.compensated ?? 0),
        }
      })
      const withSeamless = await attachImcSeamlessReps(merged, 'OPD')
      return { success: true, data: { rawRows: withSeamless } }
    }
  })

  // ── 7. Instrument Fund (OPD & IPD) & ADP Mapping ───────────────────────────
  fastify.get('/api/v1/clinical/rcm/funds-v2/instrument-adp-mapping', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'ตรวจสอบ ADP Mapping กองทุนอุปกรณ์/อวัยวะเทียม' } }, async () => {
    const rows = await safeQuery(
      hosPool,
      `SELECT icode, name, nhso_adp_code, nhso_adp_type_id FROM nondrugitems WHERE nhso_adp_type_id = 2 ORDER BY nhso_adp_code ASC`
    )
    const items = rows.map((r) => ({
      icode: String(r.icode || ''),
      name: String(r.name || ''),
      nhso_adp_code: String(r.nhso_adp_code || ''),
      nhso_adp_type_id: Number(r.nhso_adp_type_id || 2),
    }))
    return { success: true, adpCode: 'INSTRUMENT_TYPE_2', isMapped: items.length > 0, mappedCount: items.length, items }
  })

  fastify.get('/api/v1/clinical/rcm/funds-v2/instrument', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานกองทุนอุปกรณ์/เครื่องมือแพทย์ Instrument (OPD/IPD)' } }, async (request, reply) => {
    const q = request.query || {}
    const { ds1, ds2 } = resolveDates(q)
    if (!validateDates(ds1, ds2, reply)) return
    const patientType = String(q.patientType || 'OPD').toUpperCase() === 'IPD' ? 'IPD' : 'OPD'

    if (patientType === 'OPD') {
      const sql = `
        SELECT
          o.vn, pt.cid, o.hn,
          CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS ptname,
          pt.sex AS sex_code,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          DATE_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          ptt.hipdata_code AS inscl,
          ptt.name AS pttypename,
          IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
          dep.department AS room,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
          v.income AS money_hosxp, v.discount_money, v.rcpt_money,
          (v.income - v.discount_money - v.rcpt_money) AS debit,
          v.rcpno_list AS rcpno,
          inst.instrument, inst.list, inst.oa, inst.dm, inst.item_count,
          0 AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, '')) AS rep,
          NULL AS eclaim_status, NULL AS eclaim_statusname
        FROM ovst o
        JOIN (
          SELECT
            oo.vn,
            SUM(oo.sum_price) AS instrument,
            COUNT(DISTINCT oo.icode) AS item_count,
            GROUP_CONCAT(DISTINCT CONCAT(d.nhso_adp_code, ':', d.name, '#', ROUND(oo.sum_price, 2)) SEPARATOR ', ') AS list,
            MAX(IF(d.nhso_adp_code REGEXP '^700[4-5]', 'Y', NULL)) AS oa,
            MAX(IF(d.nhso_adp_code REGEXP '^8612|^8813|^8814', 'Y', NULL)) AS dm
          FROM (SELECT icode, nhso_adp_code, name FROM nondrugitems WHERE nhso_adp_type_id = 2) d
          JOIN opitemrece oo ON oo.icode = d.icode
          WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> ''
          GROUP BY oo.vn
        ) inst ON inst.vn = o.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
        LEFT JOIN visit_pttype vt ON vt.vn = o.vn
        LEFT JOIN (
          SELECT vn, MAX(inst + catinst) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata WHERE department = 'OP' AND (inst > 0 OR catinst > 0) GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn, MAX(inst + catinst) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim WHERE department = 'OP' AND (inst > 0 OR catinst > 0) GROUP BY vn
        ) n ON n.vn = o.vn
        WHERE o.vstdate BETWEEN ? AND ? AND IFNULL(o.an, '') = ''
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC
      `
      const [rows] = await hosPool.query(sql, [ds1, ds2, ds1, ds2])
      return { success: true, data: { rawRows: rows || [] } }
    } else {
      const sql = `
        SELECT
          i.an, i.hn, pt.cid,
          CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS ptname,
          pt.sex AS sex_code,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          w.name AS ward,
          ptt.hipdata_code AS inscl,
          ptt.name AS pttypename,
          IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
          a.income AS money_hosxp, a.discount_money, a.rcpt_money,
          (a.income - a.discount_money - a.rcpt_money) AS debit,
          a.rcpno_list AS rcpno,
          inst.instrument, inst.list, inst.oa, inst.dm, inst.item_count,
          0 AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, '')) AS rep,
          NULL AS eclaim_status, NULL AS eclaim_statusname
        FROM ipt i
        JOIN (
          SELECT
            oo.an,
            SUM(oo.sum_price) AS instrument,
            COUNT(DISTINCT oo.icode) AS item_count,
            GROUP_CONCAT(DISTINCT CONCAT(d.nhso_adp_code, ':', d.name, '#', ROUND(oo.sum_price, 2)) SEPARATOR ', ') AS list,
            MAX(IF(d.nhso_adp_code REGEXP '^700[4-5]', 'Y', NULL)) AS oa,
            MAX(IF(d.nhso_adp_code REGEXP '^8612|^8813|^8814', 'Y', NULL)) AS dm
          FROM (SELECT icode, nhso_adp_code, name FROM nondrugitems WHERE nhso_adp_type_id = 2) d
          JOIN opitemrece oo ON oo.icode = d.icode
          JOIN ipt i2 ON i2.an = oo.an
          WHERE i2.dchdate BETWEEN ? AND ? AND IFNULL(oo.an, '') <> ''
          GROUP BY oo.an
        ) inst ON inst.an = i.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN rcmdb.authencode cc ON cc.vn = i.an
        LEFT JOIN visit_pttype vt ON vt.vn = i.vn
        LEFT JOIN (
          SELECT an, MAX(inst + catinst) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata WHERE department = 'IP' AND (inst > 0 OR catinst > 0) GROUP BY an
        ) r ON r.an = i.an
        LEFT JOIN (
          SELECT an, MAX(inst + catinst) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim WHERE department = 'IP' AND (inst > 0 OR catinst > 0) GROUP BY an
        ) n ON n.an = i.an
        WHERE i.dchdate BETWEEN ? AND ?
        GROUP BY i.an
        ORDER BY i.dchdate DESC, i.regdate DESC
      `
      const [rows] = await hosPool.query(sql, [ds1, ds2, ds1, ds2])
      return { success: true, data: { rawRows: rows || [] } }
    }
  })

  // ── 8. Streptokinase (OPD & IPD), STEMI ADP Mapping, AN Clinical Details ───
  fastify.get('/api/v1/clinical/rcm/funds-v2/stemi-adp-mapping', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'ตรวจสอบ ADP Mapping กองทุนยาละลายลิ่มเลือด STEMI' } }, async () => {
    const rows = await safeQuery(
      hosPool,
      `SELECT icode, name, strength, nhso_adp_code FROM s_drugitems WHERE nhso_adp_code REGEXP 'STEMI' ORDER BY icode ASC`
    )
    const items = rows.map((r) => ({
      icode: String(r.icode || '').trim(),
      name: String(r.name || '').trim(),
      strength: r.strength ? String(r.strength).trim() : null,
      nhso_adp_code: String(r.nhso_adp_code || '').trim(),
    }))
    return { success: true, adpCode: 'STEMI', isMapped: items.length > 0, mappedCount: items.length, items }
  })

  fastify.get('/api/v1/clinical/rcm/funds-v2/streptokinase', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานกองทุนยา Streptokinase (OPD/IPD)' } }, async (request, reply) => {
    const q = request.query || {}
    const { ds1, ds2 } = resolveDates(q)
    if (!validateDates(ds1, ds2, reply)) return
    const patientType = String(q.patientType || 'IPD').toUpperCase() === 'OPD' ? 'OPD' : 'IPD'

    if (patientType === 'OPD') {
      const sql = `
        SELECT
          o.vn, o.hn, IFNULL(pt.cid, '') AS cid,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IFNULL(pt.sex, '') AS sex_code,
          DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
          IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
          IFNULL(ptt.hipdata_code, '') AS maininscl,
          ptt.pttype_eclaim_id,
          dep.department AS department,
          spc.name AS clinic,
          target_drugs.drugname AS drugname,
          target_drugs.money_hosxp AS money_hosxp,
          IFNULL(v.discount_money, 0) AS discount_money,
          IFNULL(v.rcpt_money, 0) AS rcpt_money,
          IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0) AS debit,
          IFNULL(v.rcpno_list, '') AS rcpno,
          dx_sub.dx, dx_sub.op,
          0 AS money_eclaim,
          IFNULL(r.income, 0) AS money_rep,
          IFNULL(n.income, 0) AS money_invoice,
          COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, ''), '') AS rep,
          CASE
            WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT
            oo.vn,
            GROUP_CONCAT(DISTINCT CONCAT_WS(' ', di.name, NULLIF(di.strength, ''), CONCAT('#', oo.qty)) SEPARATOR ', ') AS drugname,
            SUM(oo.sum_price) AS money_hosxp
          FROM opitemrece oo
          JOIN (
            SELECT icode, name, strength FROM s_drugitems WHERE nhso_adp_code REGEXP 'STEMI'
            UNION
            SELECT icode, name, strength FROM drugitems WHERE nhso_adp_code REGEXP 'STEMI'
          ) di ON di.icode = oo.icode
          WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> ''
          GROUP BY oo.vn
        ) target_drugs
        JOIN ovst o ON o.vn = target_drugs.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN (
          SELECT odx.vn,
            GROUP_CONCAT(DISTINCT IF(odx.icd10 NOT REGEXP '^[0-9]', odx.icd10, NULL) ORDER BY odx.diagtype, odx.ovst_diag_id SEPARATOR ', ') AS dx,
            GROUP_CONCAT(DISTINCT IF(odx.icd10 REGEXP '^[0-9]', odx.icd10, NULL) SEPARATOR ', ') AS op
          FROM ovstdiag odx WHERE odx.vstdate BETWEEN ? AND ? GROUP BY odx.vn
        ) dx_sub ON dx_sub.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(drug) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata WHERE department = 'OP' AND drug > 0 GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(drug) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim WHERE department = 'OP' AND drug > 0 GROUP BY vn
        ) n ON n.vn = o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC
      `
      const [rows] = await hosPool.query(sql, [ds1, ds2, ds1, ds2])
      return { success: true, data: { rawRows: rows || [] } }
    } else {
      const sql = `
        SELECT
          i.an, i.hn, IFNULL(pt.cid, '') AS cid,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IFNULL(pt.sex, '') AS sex_code,
          DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
          IFNULL(ptt.hipdata_code, '') AS maininscl,
          ptt.pttype_eclaim_id,
          w.name AS ward,
          target_drugs.drugname AS drugname,
          target_drugs.money_hosxp AS money_hosxp,
          IFNULL(a.discount_money, 0) AS discount_money,
          IFNULL(a.rcpt_money, 0) AS rcpt_money,
          IFNULL(a.income, 0) - IFNULL(a.discount_money, 0) - IFNULL(a.rcpt_money, 0) AS debit,
          IFNULL(a.rcpno_list, '') AS rcpno,
          dx_sub.dx, op_sub.op,
          0 AS money_eclaim,
          IFNULL(r.income, 0) AS money_rep,
          IFNULL(n.income, 0) AS money_invoice,
          COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, ''), '') AS rep,
          CASE
            WHEN n.an IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.an IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT
            oo.an,
            GROUP_CONCAT(DISTINCT CONCAT_WS(' ', di.name, NULLIF(di.strength, ''), CONCAT('#', oo.qty)) SEPARATOR ', ') AS drugname,
            SUM(oo.sum_price) AS money_hosxp
          FROM opitemrece oo
          JOIN (
            SELECT icode, name, strength FROM s_drugitems WHERE nhso_adp_code REGEXP 'STEMI'
            UNION
            SELECT icode, name, strength FROM drugitems WHERE nhso_adp_code REGEXP 'STEMI'
          ) di ON di.icode = oo.icode
          JOIN ipt i2 ON i2.an = oo.an
          WHERE IFNULL(oo.an, '') <> '' AND i2.dchdate BETWEEN ? AND ?
          GROUP BY oo.an
        ) target_drugs
        JOIN ipt i ON i.an = target_drugs.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN (
          SELECT an, GROUP_CONCAT(DISTINCT icd10 ORDER BY diagtype, ipt_diag_id SEPARATOR ', ') AS dx
          FROM iptdiag GROUP BY an
        ) dx_sub ON dx_sub.an = i.an
        LEFT JOIN (
          SELECT an, GROUP_CONCAT(DISTINCT icd9 SEPARATOR ', ') AS op
          FROM iptoprt GROUP BY an
        ) op_sub ON op_sub.an = i.an
        LEFT JOIN (
          SELECT an, SUM(drug) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata WHERE department = 'IP' AND drug > 0 GROUP BY an
        ) r ON r.an = i.an
        LEFT JOIN (
          SELECT an, SUM(drug) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim WHERE department = 'IP' AND drug > 0 GROUP BY an
        ) n ON n.an = i.an
        WHERE i.dchdate BETWEEN ? AND ?
        ORDER BY i.dchdate DESC, i.regdate DESC
      `
      const [rows] = await hosPool.query(sql, [ds1, ds2, ds1, ds2])
      return { success: true, data: { rawRows: rows || [] } }
    }
  })

  fastify.get('/api/v1/clinical/rcm/an-details/:an', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'รายละเอียดค่าใช้จ่าย ยา และหัตถการผู้ป่วยในตาม AN' } }, async (request, reply) => {
    const cleanAn = String(request.params?.an || '').trim()
    if (!cleanAn) return reply.code(400).send({ success: false, error: 'Missing AN' })

    const [headerRows, diagRows, oprtRows, orderRows] = await Promise.all([
      safeQuery(
        hosPool,
        `SELECT i.an, i.hn, IFNULL(pt.cid, '') AS cid,
                CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
                CASE WHEN pt.sex = '1' THEN 'ชาย' WHEN pt.sex = '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
                IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.dchdate), 0) AS age,
                DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
                DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
                IFNULL(p.name, IFNULL(i.pttype, '')) AS pttypename,
                IFNULL(w.name, IFNULL(i.ward, '')) AS ward
         FROM ipt i
         LEFT JOIN patient pt ON pt.hn = i.hn
         LEFT JOIN pttype p ON p.pttype = i.pttype
         LEFT JOIN ward w ON w.ward = i.ward
         WHERE i.an = ? LIMIT 1`,
        [cleanAn]
      ),
      safeQuery(
        hosPool,
        `SELECT d.icd10, IFNULL(ic.name, d.icd10) AS icd_name, IFNULL(d.diagtype, '') AS diagtype,
                IFNULL(dt.name, CASE d.diagtype
                  WHEN '1' THEN 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)'
                  WHEN '2' THEN 'CO-MORBIDITY (การวินิจฉัยโรคร่วม)'
                  WHEN '3' THEN 'COMPLICATION (ภาวะแทรกซ้อน)'
                  WHEN '4' THEN 'OTHER (การวินิจฉัยอื่นๆ)'
                  WHEN '5' THEN 'EXTERNAL CAUSE (สาเหตุภายนอก)'
                  ELSE 'ไม่ระบุประเภท' END) AS diagtype_name,
                IFNULL(doc.name, '') AS doctor_name
         FROM iptdiag d
         LEFT JOIN icd101 ic ON ic.code = d.icd10
         LEFT JOIN diagtype dt ON dt.diagtype = d.diagtype
         LEFT JOIN doctor doc ON doc.code = d.doctor
         WHERE d.an = ? ORDER BY d.diagtype ASC, d.ipt_diag_id ASC`,
        [cleanAn]
      ),
      safeQuery(
        hosPool,
        `SELECT op.icd9, IFNULL(ic9.name, op.icd9) AS icd9_name,
                DATE_FORMAT(op.opdate, '%Y-%m-%d') AS opdate,
                IFNULL(doc.name, '') AS doctor_name
         FROM iptoprt op
         LEFT JOIN icd9cm1 ic9 ON ic9.code = op.icd9
         LEFT JOIN doctor doc ON doc.code = op.doctor
         WHERE op.an = ? ORDER BY op.opdate ASC`,
        [cleanAn]
      ),
      safeQuery(
        hosPool,
        `SELECT o.icode, COALESCE(d.name, nd.name, o.icode) AS item_name,
                d.strength, d.units, IFNULL(o.qty, 0) AS qty,
                IFNULL(o.unitprice, 0) AS unitprice, IFNULL(o.sum_price, 0) AS sum_price,
                IFNULL(pst.name, o.paidst) AS paidst_name,
                IFNULL(inc.name, o.income) AS income_name,
                IF(d.icode IS NOT NULL, 1, 0) AS is_drug
         FROM opitemrece o
         LEFT JOIN s_drugitems d ON d.icode = o.icode
         LEFT JOIN nondrugitems nd ON nd.icode = o.icode
         LEFT JOIN paidst pst ON pst.paidst = o.paidst
         LEFT JOIN income inc ON inc.income = o.income
         WHERE o.an = ? ORDER BY o.income ASC, o.item_no ASC, o.icode ASC`,
        [cleanAn]
      ),
    ])

    if (!headerRows.length) return { success: true, data: null }
    const h = headerRows[0]
    return {
      success: true,
      data: {
        header: {
          an: String(h.an || cleanAn),
          hn: String(h.hn || ''),
          cid: String(h.cid || ''),
          ptname: String(h.ptname || '').trim(),
          sex: String(h.sex || '-'),
          age: Number(h.age || 0),
          admdate: String(h.admdate || ''),
          dchdate: String(h.dchdate || ''),
          pttypename: String(h.pttypename || ''),
          ward: String(h.ward || ''),
        },
        diagnoses: diagRows.map((d) => ({
          icd10: String(d.icd10 || ''),
          icdName: String(d.icd_name || d.icd10 || ''),
          diagtype: String(d.diagtype || ''),
          diagtypeName: String(d.diagtype_name || ''),
          doctorName: String(d.doctor_name || ''),
        })),
        procedures: oprtRows.map((op) => ({
          icd9: String(op.icd9 || ''),
          icd9Name: String(op.icd9_name || op.icd9 || ''),
          opdate: String(op.opdate || ''),
          doctorName: String(op.doctor_name || ''),
        })),
        orders: orderRows.map((ord) => ({
          icode: String(ord.icode || ''),
          itemName: String(ord.item_name || ''),
          strength: ord.strength ? String(ord.strength).trim() : null,
          units: ord.units ? String(ord.units).trim() : null,
          qty: Number(ord.qty || 0),
          unitprice: Number(ord.unitprice || 0),
          sumPrice: Number(ord.sum_price || 0),
          paidstName: String(ord.paidst_name || ''),
          incomeName: String(ord.income_name || ''),
          isDrug: Boolean(ord.is_drug === 1 || ord.is_drug === true),
        })),
      },
    }
  })

  // ── 9. ADP Search (OPD & IPD, Multi-ADP Check, Available Codes) ────────────
  fastify.get('/api/v1/clinical/rcm/funds-v2/adp-search/available-codes', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'ดึงรายการรหัส ADP ทั้งหมดที่มีในระบบค้นหา' } }, async () => {
    const rows = await safeQuery(
      hosPool,
      `SELECT TRIM(nhso_adp_code) AS code, MIN(TRIM(name)) AS title, COUNT(*) AS mappedCount
       FROM s_drugitems
       WHERE nhso_adp_code IS NOT NULL AND TRIM(nhso_adp_code) <> ''
       GROUP BY TRIM(nhso_adp_code)
       ORDER BY code ASC`
    )
    return { success: true, data: rows }
  })

  fastify.post('/api/v1/clinical/rcm/funds-v2/adp-search/check-mapping', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'ตรวจสอบการจับคู่หลายรหัส ADP พร้อมกัน' } }, async (request) => {
    const body = request.body || {}
    const codes = Array.isArray(body.adpCodes)
      ? body.adpCodes.map((c) => String(c || '').trim()).filter(Boolean)
      : []
    if (codes.length === 0) {
      return { success: true, adpCodes: [], isMapped: false, mappedCount: 0, items: [] }
    }
    const ph = codes.map(() => '?').join(', ')
    const rows = await safeQuery(
      hosPool,
      `SELECT icode, name, strength, TRIM(nhso_adp_code) AS nhso_adp_code
       FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (${ph})
       ORDER BY nhso_adp_code ASC, icode ASC`,
      codes
    )
    const items = rows.map((r) => ({
      icode: String(r.icode || '').trim(),
      name: String(r.name || '').trim(),
      strength: r.strength ? String(r.strength).trim() : null,
      nhso_adp_code: String(r.nhso_adp_code || '').trim(),
    }))
    return { success: true, adpCodes: codes, isMapped: items.length > 0, mappedCount: items.length, items }
  })

  fastify.get('/api/v1/clinical/rcm/funds-v2/adp-search', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'ค้นหาข้อมูลการให้บริการผู้ป่วยตามรหัส ADP (OPD/IPD)' } }, async (request, reply) => {
    const q = request.query || {}
    const { ds1, ds2 } = resolveDates(q)
    if (!validateDates(ds1, ds2, reply)) return
    const patientType = String(q.patientType || 'OPD').toUpperCase() === 'IPD' ? 'IPD' : 'OPD'
    const adpCodes = String(q.adpCode || '')
      .split(/[,;\s]+/)
      .map((c) => c.replace(/['"`]/g, '').trim())
      .filter(Boolean)
    if (adpCodes.length === 0) return { success: true, data: { rawRows: [] } }
    const adpPh = adpCodes.map(() => '?').join(', ')

    if (patientType === 'OPD') {
      const sql = `
        SELECT
          o.vn, o.hn, o.an, pt.cid,
          CONCAT(TRIM(pt.pname), TRIM(pt.fname), ' ', TRIM(pt.lname)) AS ptname,
          IFNULL(pt.sex, '') AS sex_code, pt.birthday,
          IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          DATE_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          o.pttype, ptt.hipdata_code, ptt.name AS pttypename, ptt.pttype_eclaim_id,
          e.name AS pttype_eclaim_name, e.gf_ipd AS gfmis, e.ar_ipd AS accountcode, ca.name AS accountname,
          CONCAT(v.hospmain, '#', IFNULL(h.name, '')) AS hospmain,
          CONCAT(v.hospsub, '#', IFNULL(h2.name, '')) AS hospsub,
          vs.auth_code, dep.department AS department, spc.name AS clinic,
          CAST(s.cc AS CHAR(255)) AS symptom,
          ovstist_lookup.name AS ovstist, ovstost_lookup.name AS ovstost,
          target_rec.icode, target_rec.nhso_adp_code, target_rec.name AS item_name,
          (SELECT GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', CONCAT(dx.icd10, '(', dx.diagtype, ')'), NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ')
           FROM ovstdiag dx WHERE dx.vn = o.vn) AS diag,
          (SELECT GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ')
           FROM ovstdiag dx WHERE dx.vn = o.vn) AS operation,
          (SELECT GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ')
           FROM opitemrece a JOIN nondrugitems b ON b.icode = a.icode WHERE a.vn = o.vn) AS listname,
          IFNULL(v.income, 0) AS income,
          (IFNULL(v.income, 0) - IFNULL(v.rcpt_money, 0)) AS nee,
          GROUP_CONCAT(DISTINCT k.terminalid ORDER BY k.approvalcode DESC SEPARATOR ', ') AS terminalid,
          GROUP_CONCAT(DISTINCT CONCAT(k.approvalcode, '#', ROUND(IFNULL(k.amount, 0), 2)) ORDER BY k.approvalcode DESC SEPARATOR ', ') AS approvalcode,
          MAX(se.rep) AS seamless, MAX(se.compensated) AS compensatedseamless,
          MAX(au.AuthenCode) AS authencode, MAX(au.AuthenMethod) AS authen_method, MAX(au.AuthenContact) AS authen_contact,
          COALESCE(NULLIF(MAX(rep_c.rep), ''), NULLIF(MAX(rep_d.rep), '')) AS rep,
          MAX(rep_c.rep) AS invoiceclaim,
          MAX(rep_d.fund) AS fund, MAX(rep_d.subfund) AS subfund,
          MAX(rep_d.projectcode) AS projectcode, MAX(rep_d.remark) AS remark,
          COALESCE(NULLIF(MAX(rep_c.compensated), 0), NULLIF(MAX(rep_d.compensated), 0), NULLIF(MAX(se.compensated), 0), MAX(rep_c.compensated), MAX(rep_d.compensated), 0) AS compensated
        FROM (
          SELECT oo.vn, oo.icode, target_items.nhso_adp_code,
                 CONCAT_WS(' ', target_items.name, NULLIF(target_items.strength, '')) AS name
          FROM (SELECT icode, name, strength, TRIM(nhso_adp_code) AS nhso_adp_code FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (${adpPh})) target_items
          JOIN opitemrece oo ON oo.icode = target_items.icode
          WHERE IFNULL(oo.vn, '') <> '' AND oo.vstdate BETWEEN ? AND ?
          GROUP BY oo.vn, oo.icode
        ) target_rec
        JOIN ovst o ON o.vn = target_rec.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
        LEFT JOIN codeaccount ca ON ca.code = e.ar_opd
        LEFT JOIN hospcode h ON h.hospcode = v.hospmain
        LEFT JOIN hospcode h2 ON h2.hospcode = v.hospsub
        LEFT JOIN visit_pttype vs ON vs.vn = o.vn
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstist ovstist_lookup ON ovstist_lookup.ovstist = o.ovstist
        LEFT JOIN ovstost ovstost_lookup ON ovstost_lookup.ovstost = o.ovstost
        LEFT JOIN rcmdb.authencode au ON au.vn = o.vn
        LEFT JOIN (
          SELECT vn,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
            SUM(IFNULL(compensated, 0)) AS compensated,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(fund, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS fund,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(subfund, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS subfund,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(projectcode, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS projectcode,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(remark, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS remark
          FROM rcmdb.repdata WHERE IFNULL(vn, '') <> '' GROUP BY vn
        ) rep_d ON rep_d.vn = o.vn
        LEFT JOIN (
          SELECT vn,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
            SUM(IFNULL(compensated, 0)) AS compensated
          FROM rcmdb.repeclaim WHERE IFNULL(vn, '') <> '' GROUP BY vn
        ) rep_c ON rep_c.vn = o.vn
        LEFT JOIN (
          SELECT vn,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
            SUM(IFNULL(compensated, 0)) AS compensated
          FROM rcmdb.seamless WHERE IFNULL(vn, '') <> '' GROUP BY vn
        ) se ON se.vn = o.vn
        LEFT JOIN rcmdb.ktb k ON k.vn = v.vn
        GROUP BY o.vn, target_rec.icode
        ORDER BY o.vstdate DESC, o.vn DESC
      `
      const [rows] = await hosPool.query(sql, [...adpCodes, ds1, ds2])
      return { success: true, data: { rawRows: rows || [] } }
    } else {
      const sql = `
        SELECT
          i.an, i.hn, pt.cid,
          CONCAT(TRIM(pt.pname), TRIM(pt.fname), ' ', TRIM(pt.lname)) AS ptname,
          IFNULL(pt.sex, '') AS sex_code, pt.birthday,
          IFNULL(a.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate)) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          i.pttype, ptt.hipdata_code, ptt.name AS pttypename,
          IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
          e.name AS pttype_eclaim_name, e.gf_ipd AS gfmis, e.ar_ipd AS accountcode, ca.name AS accountname,
          w.name AS department, a.pdx, icd.name AS pdxname,
          (SELECT GROUP_CONCAT(DISTINCT CONCAT(idx.icd10, '(', idx.diagtype, ')') ORDER BY idx.diagtype SEPARATOR ', ')
           FROM iptdiag idx WHERE idx.an = i.an AND idx.diagtype <> 1) AS sdx,
          (SELECT GROUP_CONCAT(DISTINCT io.icd9 SEPARATOR ', ') FROM iptoprt io WHERE io.an = i.an) AS proc_ops,
          target_rec.icode, target_rec.nhso_adp_code, target_rec.name AS item_name,
          (SELECT GROUP_CONCAT(DISTINCT CONCAT(aa.icode, ':', b.name) SEPARATOR ', ')
           FROM opitemrece aa JOIN nondrugitems b ON b.icode = aa.icode WHERE aa.an = i.an) AS listname,
          IFNULL(a.income, 0) AS income,
          (IFNULL(a.income, 0) - IFNULL(a.rcpt_money, 0)) AS nee,
          COALESCE(NULLIF(MAX(rep_c.rep), ''), NULLIF(MAX(rep_d.rep), '')) AS rep,
          MAX(rep_c.rep) AS invoiceclaim,
          MAX(rep_d.fund) AS fund, MAX(rep_d.subfund) AS subfund,
          MAX(rep_d.projectcode) AS projectcode, MAX(rep_d.remark) AS remark,
          COALESCE(NULLIF(MAX(rep_c.compensated), 0), NULLIF(MAX(rep_d.compensated), 0), MAX(rep_c.compensated), MAX(rep_d.compensated), 0) AS compensated
        FROM (
          SELECT oo.an, oo.icode, target_items.nhso_adp_code,
                 CONCAT_WS(' ', target_items.name, NULLIF(target_items.strength, '')) AS name
          FROM (SELECT icode, name, strength, TRIM(nhso_adp_code) AS nhso_adp_code FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (${adpPh})) target_items
          JOIN opitemrece oo ON oo.icode = target_items.icode
          JOIN ipt i_filter ON i_filter.an = oo.an
          WHERE IFNULL(oo.an, '') <> '' AND i_filter.dchdate BETWEEN ? AND ?
          GROUP BY oo.an, oo.icode
        ) target_rec
        JOIN ipt i ON i.an = target_rec.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
        LEFT JOIN codeaccount ca ON ca.code = e.ar_ipd
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN icd101 icd ON icd.code = a.pdx
        LEFT JOIN (
          SELECT an,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
            SUM(IFNULL(compensated, 0)) AS compensated,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(fund, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS fund,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(subfund, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS subfund,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(projectcode, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS projectcode,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(remark, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS remark
          FROM rcmdb.repdata WHERE IFNULL(an, '') <> '' GROUP BY an
        ) rep_d ON rep_d.an = i.an
        LEFT JOIN (
          SELECT an,
            SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
            SUM(IFNULL(compensated, 0)) AS compensated
          FROM rcmdb.repeclaim WHERE IFNULL(an, '') <> '' GROUP BY an
        ) rep_c ON rep_c.an = i.an
        GROUP BY i.an, target_rec.icode
        ORDER BY i.dchdate DESC, i.an DESC
      `
      const [rows] = await hosPool.query(sql, [...adpCodes, ds1, ds2])
      return { success: true, data: { rawRows: rows || [] } }
    }
  })

  // ── 10. Family Planning 9.1 & 9.3 ──────────────────────────────────────────
  fastify.get('/api/v1/clinical/rcm/funds-v2/family-planning-91/adp-mapping', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'ตรวจสอบ ADP Mapping วางแผนครอบครัว 9.1' } }, async (request) => {
    const format = String(request.query?.format || 'NEW_ECLAIM').toUpperCase() === 'KRUNGTHAI' ? 'KRUNGTHAI' : 'NEW_ECLAIM'
    const codes = format === 'KRUNGTHAI' ? KRUNGTHAI_FP_CODES : NEW_ECLAIM_FP_CODES
    const ph = codes.map(() => '?').join(', ')
    const rows = await safeQuery(
      hosPool,
      `SELECT icode, name, strength, nhso_adp_code FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (${ph}) ORDER BY nhso_adp_code ASC, icode ASC`,
      codes
    )
    const items = rows.map((r) => ({
      icode: String(r.icode || '').trim(),
      name: String(r.name || '').trim(),
      strength: r.strength ? String(r.strength).trim() : null,
      nhso_adp_code: String(r.nhso_adp_code || '').trim(),
    }))
    return { success: true, format, isMapped: items.length > 0, mappedCount: items.length, items }
  })

  fastify.get('/api/v1/clinical/rcm/funds-v2/family-planning-91', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานบริการวางแผนครอบครัว 9.1' } }, async (request, reply) => {
    const q = request.query || {}
    const { ds1, ds2 } = resolveDates(q)
    if (!validateDates(ds1, ds2, reply)) return
    const format = String(q.format || q.serviceType || 'NEW_ECLAIM').toUpperCase() === 'KRUNGTHAI' ? 'KRUNGTHAI' : 'NEW_ECLAIM'
    const adpCodes = format === 'KRUNGTHAI' ? KRUNGTHAI_FP_CODES : NEW_ECLAIM_FP_CODES
    const adpPh = adpCodes.map(() => '?').join(', ')

    const sql = `
      SELECT
        o.vn, IFNULL(pt.cid, '') AS cid, o.hn,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
        TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
        IFNULL(nat.name, pt.nationality) AS nation,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        s.cc,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        ptt.name AS pttypename, ptt.pttype_eclaim_id,
        v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
        v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
        IFNULL(dx.icd10, '') AS icd10, dx.op,
        IFNULL(v.income, 0) AS income,
        doc.name AS doctorname,
        IFNULL(fp.name, '') AS listname,
        d.drugname,
        COALESCE(nhso.statusname, rep.statusname, '-::ยังไม่ได้ส่ง') AS status,
        COALESCE(nhso.rep, rep.rep) AS rep,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        rep.TransactionType, nhso.resource,
        COALESCE(rep.fund, nhso.fund) AS fund,
        COALESCE(rep.subfund, nhso.subfund) AS subfund,
        rep.remark, rep.projectcode
      FROM (
        SELECT DISTINCT vn FROM (
          SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND icd10 REGEXP 'Z30' AND icd10 <> 'Z302'
          UNION
          SELECT oo.vn FROM s_drugitems d JOIN opitemrece oo ON oo.icode = d.icode
          WHERE TRIM(d.nhso_adp_code) IN (${adpPh}) AND oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> ''
          UNION
          SELECT oo.vn FROM opitemrece oo JOIN s_drugitems d ON d.icode = oo.icode LEFT JOIN income inc ON inc.income = oo.income
          WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> ''
            AND (d.name REGEXP 'norplant|คุมกำเนิด' OR d.drugcategory REGEXP 'FP|CONTRACEPTIVE|CONTRACEPTION')
            AND d.name NOT REGEXP 'condom|ถุงยางอนามัย'
            AND inc.group2 IN (3, 4, 5) AND oo.qty > 0
        ) u
      ) t
      JOIN ovst o ON o.vn = t.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN opdscreen s ON s.vn = o.vn
      LEFT JOIN nationality nat ON nat.nationality = pt.nationality
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN doctor doc ON doc.code = o.doctor
      LEFT JOIN (
        SELECT oo.vn, GROUP_CONCAT(DISTINCT CONCAT_WS(':', d.nhso_adp_code, CONCAT(d.name, ' ', IFNULL(d.strength, ''))) SEPARATOR ', ') AS name
        FROM s_drugitems d JOIN opitemrece oo ON oo.icode = d.icode
        WHERE TRIM(d.nhso_adp_code) IN (${adpPh}) AND oo.vstdate BETWEEN ? AND ?
        GROUP BY oo.vn
      ) fp ON fp.vn = o.vn
      LEFT JOIN (
        SELECT oo.vn, GROUP_CONCAT(DISTINCT CONCAT(d.name, '#', oo.qty) SEPARATOR ', ') AS drugname
        FROM opitemrece oo JOIN s_drugitems d ON d.icode = oo.icode LEFT JOIN income inc ON inc.income = oo.income
        WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> ''
          AND (d.name REGEXP 'norplant|คุมกำเนิด' OR d.drugcategory REGEXP 'FP|CONTRACEPTIVE|CONTRACEPTION')
          AND d.name NOT REGEXP 'condom|ถุงยางอนามัย'
          AND inc.group2 IN (3, 4, 5) AND oo.qty > 0
        GROUP BY oo.vn
      ) d ON d.vn = o.vn
      LEFT JOIN (
        SELECT vn,
               GROUP_CONCAT(DISTINCT IF(icd10 REGEXP '^[0-9]', NULL, icd10) SEPARATOR ', ') AS icd10,
               GROUP_CONCAT(DISTINCT IF(icd10 REGEXP '^697|^992', icd10, NULL) SEPARATOR ', ') AS op
        FROM ovstdiag
        WHERE vstdate BETWEEN ? AND ? AND ((icd10 REGEXP 'Z30' AND icd10 <> 'Z302') OR icd10 REGEXP '^697|^992')
        GROUP BY vn
      ) dx ON dx.vn = o.vn
      LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
      LEFT JOIN visit_pttype vt ON vt.vn = o.vn
      LEFT JOIN (
        SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
               MAX(resource) AS resource, MAX(fund) AS fund, MAX(subfund) AS subfund,
               'NHSO :: มี Invoice แล้ว' AS statusname
        FROM rcmdb.repeclaim
        WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND admdate >= DATE_SUB(?, INTERVAL 1 DAY) AND admdate < DATE_ADD(?, INTERVAL 2 DAY)
        GROUP BY vn
      ) nhso ON nhso.vn = o.vn
      LEFT JOIN (
        SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
               MAX(TransactionType) AS TransactionType, MAX(fund) AS fund, MAX(subfund) AS subfund,
               MAX(remark) AS remark, MAX(projectcode) AS projectcode,
               'Rep :: มี Rep แล้ว' AS statusname
        FROM rcmdb.repdata
        WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND admdate >= DATE_SUB(?, INTERVAL 1 DAY) AND admdate < DATE_ADD(?, INTERVAL 2 DAY)
        GROUP BY vn
      ) rep ON rep.vn = o.vn
      GROUP BY o.vn
      ORDER BY o.vstdate DESC, o.vsttime DESC
    `
    const params = [
      ds1, ds2, ...adpCodes, ds1, ds2, ds1, ds2,
      ...adpCodes, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2,
    ]
    const [rows] = await hosPool.query(sql, params)
    return { success: true, data: { rawRows: rows || [] } }
  })

  fastify.get('/api/v1/clinical/rcm/funds-v2/family-planning-93', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานบริการวางแผนครอบครัว 9.3' } }, async (request, reply) => {
    const q = request.query || {}
    const { ds1, ds2 } = resolveDates(q)
    if (!validateDates(ds1, ds2, reply)) return
    const patientType = String(q.patientType || 'OPD').toUpperCase() === 'IPD' ? 'IPD' : 'OPD'
    const adpCode = String(q.adpCode || 'FP002_1').trim()
    const expectedDx = String(q.expectedDx || 'Z308').trim()

    if (patientType === 'OPD') {
      const adpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      const sql = `
        SELECT
          o.vn, IFNULL(pt.cid, '') AS cid, o.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', o.pttype, ptt.name) AS pttypename, ptt.pttype_eclaim_id,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS claimcode,
          dep.department AS department, spc.name AS clinic, s.cc AS cc,
          IFNULL(v.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${adpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          0 AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(n.rep, r.rep, '') AS rep,
          CASE
            WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT vn FROM (
            SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND icd10 REGEXP ?
            UNION
            SELECT oo.vn FROM opitemrece oo JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.vn, '') <> '' AND ${adpMatchExpr}
          ) u
        ) t
        JOIN ovst o ON o.vn = t.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN opdscreen s ON s.vn = o.vn
        LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
        LEFT JOIN spclty spc ON spc.spclty = o.spclty
        LEFT JOIN ovstdiag dx ON dx.vn = o.vn
        LEFT JOIN opitemrece oo ON oo.vn = o.vn
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
        LEFT JOIN visit_pttype vt ON vt.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata WHERE department = 'OP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY vn
        ) r ON r.vn = o.vn
        LEFT JOIN (
          SELECT vn, SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim WHERE department = 'OP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY vn
        ) n ON n.vn = o.vn
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC
      `
      const [rows] = await hosPool.query(sql, [adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode])
      return { success: true, data: { rawRows: rows || [] } }
    } else {
      const ipdAdpMatchExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_1' AND TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR ? = 'FP002_2' AND TRIM(d.nhso_adp_code) = '71691')`
          : `(TRIM(d.nhso_adp_code) = ? OR (? IN ('FP003_1', 'FP003_2', 'FP003_3', 'FP003_4') AND TRIM(d.nhso_adp_code) IN ('20003','71681','71682','FP003_1','FP003_2','FP003_3','FP003_4')))`

      const ipdSubqueryAdpExpr =
        adpCode === 'FP002_1'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) IN ('FP002', '20004'))`
          : adpCode === 'FP002_2'
          ? `(TRIM(d.nhso_adp_code) = ? OR TRIM(d.nhso_adp_code) = '71691')`
          : `TRIM(d.nhso_adp_code) = ?`

      const sql = `
        SELECT
          i.an AS vn, i.an, IFNULL(pt.cid, '') AS cid, i.hn,
          CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
          IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
          CONCAT_WS(':', i.pttype, ptt.name) AS pttypename, ptt.pttype_eclaim_id,
          COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS claimcode,
          w.name AS department, spc.name AS clinic, '' AS cc,
          IFNULL(a.income, 0) AS income,
          GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
          GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
          GROUP_CONCAT(DISTINCT IF(${ipdAdpMatchExpr}, CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
          GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
          0 AS money_eclaim,
          COALESCE(r.income, 0) AS money_rep,
          COALESCE(n.income, 0) AS money_invoice,
          COALESCE(n.rep, r.rep, '') AS rep,
          CASE
            WHEN n.an IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
            WHEN r.an IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
            ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
          END AS status
        FROM (
          SELECT DISTINCT an FROM (
            SELECT i.an FROM ipt i JOIN iptdiag dx ON dx.an = i.an WHERE i.dchdate BETWEEN ? AND ? AND dx.icd10 REGEXP ?
            UNION
            SELECT oo.an FROM opitemrece oo JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ? AND IFNULL(oo.an, '') <> '' AND ${ipdSubqueryAdpExpr}
          ) u
        ) t
        JOIN ipt i ON i.an = t.an
        LEFT JOIN patient pt ON pt.hn = i.hn
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN spclty spc ON spc.spclty = i.spclty
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN iptdiag dx ON dx.an = i.an
        LEFT JOIN iptoprt op ON op.an = i.an
        LEFT JOIN opitemrece oo ON oo.an = i.an
        LEFT JOIN s_drugitems d ON d.icode = oo.icode
        LEFT JOIN rcmdb.authencode cc ON cc.vn = i.an
        LEFT JOIN visit_pttype vt ON vt.vn = i.an
        LEFT JOIN (
          SELECT an, SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repdata WHERE department = 'IP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY an
        ) r ON r.an = i.an
        LEFT JOIN (
          SELECT an, SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                 GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
          FROM rcmdb.repeclaim WHERE department = 'IP'
            AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
          GROUP BY an
        ) n ON n.an = i.an
        GROUP BY i.an
        ORDER BY i.dchdate DESC, i.regdate DESC
      `
      const [rows] = await hosPool.query(sql, [adpCode, adpCode, ds1, ds2, expectedDx, ds1, ds2, adpCode])
      return { success: true, data: { rawRows: rows || [] } }
    }
  })
}
