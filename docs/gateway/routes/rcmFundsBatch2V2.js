/**
 * Dedicated RCM Specific Funds V2 Routes (100% column parity for Batch 1B-1b & 1B-2a)
 * Covers: cancer, walkin, clopidogrel, health-screening, hepatitis-c, postpartum, drug-post,
 * plus ADP mapping helper with drugitems/LIKE support.
 */

const CLOPIDOGREL_ADP_CODE = '37999771001'
const CLOPIDOGREL_ADP_CODE_LEGACY = '3799977101'
const CLOPIDOGREL_DID_PREFIX = '1248460000039721217'

function getFiscalYearStartDate(dateStr) {
  const parts = String(dateStr || '').split('-')
  if (parts.length < 2) return dateStr
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const startY = m >= 10 ? y : y - 1
  return `${startY}-10-01`
}

function resolveDateParams(query) {
  const ds1 = String(query.ds1 || query.startDate || '').trim()
  const ds2 = String(query.ds2 || query.endDate || '').trim()
  return { ds1, ds2 }
}

export default async function rcmFundsBatch2V2Routes(fastify, { pools }) {
  const { hosPool } = pools
  // ── ADP Mapping V2 (supports s_drugitems + drugitems UNION & clopidogrel prefix) ──
  fastify.get('/api/v1/clinical/rcm/funds-v2/adp-mapping/:adpCode', async (request, reply) => {
    const adpCode = String(request.params.adpCode || '').trim()
    const includeDrugItems = request.query.includeDrugItems === 'true' || request.query.includeDrugItems === '1'
    const includeNonDrug = request.query.includeNonDrug === 'true' || request.query.includeNonDrug === '1'
    if (!adpCode) {
      return reply.status(400).send({ success: false, error: 'adpCode is required' })
    }

    try {
      const codes = adpCode.split(',').map((c) => c.trim()).filter(Boolean)
      const isClopidogrel = codes.includes(CLOPIDOGREL_ADP_CODE) || codes.includes(CLOPIDOGREL_ADP_CODE_LEGACY)

      let sql
      let params
      if (isClopidogrel) {
        sql = `
          SELECT icode, name, strength, nhso_adp_code
          FROM s_drugitems
          WHERE TRIM(nhso_adp_code) IN (?, ?) OR TRIM(nhso_adp_code) LIKE '379997710%'
          UNION
          SELECT icode, name, strength, nhso_adp_code
          FROM drugitems
          WHERE TRIM(nhso_adp_code) IN (?, ?) OR TRIM(nhso_adp_code) LIKE '379997710%'
          ORDER BY icode ASC
        `
        params = [CLOPIDOGREL_ADP_CODE, CLOPIDOGREL_ADP_CODE_LEGACY, CLOPIDOGREL_ADP_CODE, CLOPIDOGREL_ADP_CODE_LEGACY]
      } else {
        const ph = codes.map(() => '?').join(',')
        const parts = [
          `SELECT icode, name, strength, nhso_adp_code FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (${ph})`,
        ]
        params = [...codes]
        if (includeDrugItems) {
          parts.push(`SELECT icode, name, strength, nhso_adp_code FROM drugitems WHERE TRIM(nhso_adp_code) IN (${ph})`)
          params.push(...codes)
        }
        if (includeNonDrug) {
          parts.push(`SELECT icode, name, '' AS strength, nhso_adp_code FROM nondrugitems WHERE TRIM(nhso_adp_code) IN (${ph})`)
          params.push(...codes)
        }
        sql = `${parts.join('\nUNION\n')}\nORDER BY nhso_adp_code ASC, icode ASC`
      }

      const [rows] = await hosPool.query({ sql, timeout: 15000 }, params)
      const items = (rows || []).map((r) => ({
        icode: String(r.icode || '').trim(),
        name: String(r.name || '').trim(),
        strength: r.strength ? String(r.strength).trim() : null,
        nhso_adp_code: String(r.nhso_adp_code || '').trim(),
      }))
      return {
        success: true,
        adpCode,
        isMapped: items.length > 0,
        mappedCount: items.length,
        items,
      }
    } catch (err) {
      fastify.log.error(err, '[rcmFundsBatch2V2] adp-mapping error')
      return reply.status(500).send({ success: false, error: 'Failed to check ADP mapping' })
    }
  })

  // ── 1. Cancer Fund (CANCER ADP across s_drugitems UNION drugitems) ──
  fastify.get('/api/v1/clinical/rcm/funds-v2/cancer', async (request, reply) => {
    const { ds1, ds2 } = resolveDateParams(request.query)
    const adpCode = String(request.query.adpCode || 'CANCER').trim()
    if (!ds1 || !ds2) return reply.status(400).send({ success: false, error: 'ds1 and ds2 are required' })

    const sql = `
      SELECT 
        o.vn,
        IFNULL(pt.cid, '') AS cid,
        o.hn,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, '')) AS firstName,
        IFNULL(pt.lname, '') AS lastName,
        DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
        IFNULL(pt.sex, '') AS sex_code,
        IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
        nat.name AS nation,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        IFNULL(ptt.hipdata_code, '') AS maininscl,
        IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
        ptt.name AS pttypename,
        dep.department AS department,
        spc.name AS clinic,
        v.pdx,
        v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
        v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
        IFNULL(v.income, 0) AS income,
        dd.listname,
        rd.rep AS rep,
        COALESCE(rd.compensated, 0) AS compensated,
        rd.transactiontype,
        re.invoice AS invoice,
        IFNULL(re.invoice_compensated, 0) AS invoice_compensated,
        re.resource,
        rd.subfund,
        rd.remark,
        rd.projectcode,
        COALESCE(re.statusname, rd.statusname, '- :: ยังไม่ได้ส่ง') AS status,
        COALESCE(re.statusname, rd.statusname, '- :: ยังไม่ได้ส่ง') AS status_eclaim
      FROM (
        SELECT 
          oo.vn,
          GROUP_CONCAT(DISTINCT CONCAT_WS(' ', target_items.name, NULLIF(target_items.strength, '')) SEPARATOR ', ') AS listname
        FROM (
          SELECT icode, name, strength, nhso_adp_code
          FROM s_drugitems
          WHERE TRIM(nhso_adp_code) = ?
          UNION
          SELECT icode, name, strength, nhso_adp_code
          FROM drugitems
          WHERE TRIM(nhso_adp_code) = ?
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
        SELECT 
          vn, 
          GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS invoice,
          SUM(IFNULL(compensated, 0)) AS invoice_compensated,
          GROUP_CONCAT(DISTINCT resource SEPARATOR ', ') AS resource,
          'NHSO :: ได้รับ Invoice แล้ว' AS statusname
        FROM rcmdb.repeclaim
        WHERE department = 'OP' 
          AND IFNULL(vn, '') <> '' 
          AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
          AND (errorcode = '' OR errorcode IS NULL)
        GROUP BY vn
      ) re ON re.vn = o.vn
      LEFT JOIN (
        SELECT 
          vn,
          GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL) SEPARATOR ', ') AS rep,
          SUM(IF(errorcode = '' OR errorcode IS NULL, IFNULL(compensated, 0), 0)) AS compensated,
          IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: ส่ง Rep แล้ว', NULL) AS statusname,
          GROUP_CONCAT(DISTINCT TransactionType SEPARATOR ', ') AS transactiontype,
          GROUP_CONCAT(DISTINCT subfund SEPARATOR ', ') AS subfund,
          GROUP_CONCAT(DISTINCT remark SEPARATOR ', ') AS remark,
          GROUP_CONCAT(DISTINCT projectcode SEPARATOR ', ') AS projectcode
        FROM rcmdb.repdata
        WHERE department = 'OP' 
          AND IFNULL(vn, '') <> '' 
          AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY vn
      ) rd ON rd.vn = o.vn
      WHERE o.vstdate BETWEEN ? AND ?
      GROUP BY o.vn
      ORDER BY o.vstdate DESC, o.vsttime DESC, o.vn DESC
    `
    const [rows] = await hosPool.query(
      { sql, timeout: 90000 },
      [adpCode, adpCode, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2]
    )
    return { success: true, fundKey: 'cancer', isDedicated: true, data: { rawRows: rows || [] } }
  })

  // ── 2. Walkin Fund (WALKIN ADP) ──
  fastify.get('/api/v1/clinical/rcm/funds-v2/walkin', async (request, reply) => {
    const { ds1, ds2 } = resolveDateParams(request.query)
    const adpCode = String(request.query.adpCode || 'WALKIN').trim()
    if (!ds1 || !ds2) return reply.status(400).send({ success: false, error: 'ds1 and ds2 are required' })

    const sql = `
      SELECT 
        o.vn,
        o.an,
        IFNULL(pt.cid, '') AS cid,
        o.hn,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        IFNULL(pt.sex, '') AS sex_code,
        IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
        IFNULL(nat.name, pt.nationality) AS nation,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        IFNULL(ptt.hipdata_code, '') AS maininscl,
        ptt.name AS pttypename,
        IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
        dep.department AS department,
        spc.name AS clinic,
        v.pdx,
        v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
        v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
        IFNULL(v.income, 0) AS income,
        dd.name AS listname,
        COALESCE(nhso.statusname, rep.statusname, '-:ยังไม่ได้ส่ง') AS status,
        COALESCE(nhso.rep, rep.rep) AS rep,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        rep.transactiontype,
        nhso.rep AS invoice,
        IFNULL(nhso.compensated, 0) AS invoice_compensated,
        rep.agency AS resource,
        rep.subfund,
        rep.remark,
        rep.projectcode
      FROM (
        SELECT 
          oo.vn,
          GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
        FROM opitemrece oo
        JOIN s_drugitems d ON d.icode = oo.icode
        WHERE IFNULL(oo.vn, '') <> ''
          AND oo.vstdate BETWEEN ? AND ?
          AND TRIM(d.nhso_adp_code) = ?
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
               GROUP_CONCAT(DISTINCT transactiontype SEPARATOR ',') AS transactiontype,
               GROUP_CONCAT(DISTINCT remark SEPARATOR ',') AS remark,
               GROUP_CONCAT(DISTINCT projectcode SEPARATOR ',') AS projectcode
        FROM rcmdb.repdata
        WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY vn
      ) rep ON rep.vn = o.vn
      ORDER BY o.hn ASC, o.vn ASC
    `
    const [rows] = await hosPool.query(
      { sql, timeout: 90000 },
      [ds1, ds2, adpCode, ds1, ds2, ds1, ds2]
    )
    return { success: true, fundKey: 'walkin', isDedicated: true, data: { rawRows: rows || [] } }
  })

  // ── 3. Clopidogrel Drug Fund ──
  fastify.get('/api/v1/clinical/rcm/funds-v2/clopidogrel', async (request, reply) => {
    const { ds1, ds2 } = resolveDateParams(request.query)
    if (!ds1 || !ds2) return reply.status(400).send({ success: false, error: 'ds1 and ds2 are required' })

    const sql = `
      SELECT 
        o.vn,
        IFNULL(pt.cid, '') AS cid,
        o.hn,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, '')) AS firstName,
        IFNULL(pt.lname, '') AS lastName,
        DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
        IFNULL(pt.sex, '') AS sex_code,
        IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        IFNULL(ptt.hipdata_code, '') AS maininscl,
        IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
        ptt.name AS pttypename,
        dep.department AS department,
        spc.name AS clinic,
        doc.name AS doctorname,
        v.pdx,
        v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
        IFNULL(v.income, 0) AS hosxp_money,
        dd.icode,
        dd.drugname,
        dd.units,
        dd.adpcode,
        dd.tmt,
        dd.did,
        dd.qty,
        dd.money,
        COALESCE(nhso.statusname, rep.statusname, '- :: ยังไม่ได้ส่ง') AS status_eclaim,
        COALESCE(nhso.rep, rep.rep) AS rep,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        rep.agency,
        rep.fund AS fund,
        rep.subfund AS subfund,
        rep.errorcode
      FROM (
        SELECT 
          oo.vn,
          GROUP_CONCAT(DISTINCT target_items.icode SEPARATOR ', ') AS icode,
          GROUP_CONCAT(DISTINCT target_items.drug_name SEPARATOR ', ') AS drugname,
          GROUP_CONCAT(DISTINCT target_items.units SEPARATOR ', ') AS units,
          GROUP_CONCAT(DISTINCT target_items.nhso_adp_code SEPARATOR ', ') AS adpcode,
          GROUP_CONCAT(DISTINCT target_items.tmt SEPARATOR ', ') AS tmt,
          GROUP_CONCAT(DISTINCT target_items.did SEPARATOR ', ') AS did,
          SUM(oo.qty) AS qty,
          SUM(oo.sum_price) AS money,
          MAX(oo.doctor) AS doctor_code
        FROM (
          SELECT 
            d.icode, 
            CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) AS drug_name, 
            d.units,
            d.nhso_adp_code,
            IFNULL(d.tpu_code_list, d.sks_drug_code) AS tmt,
            d.did
          FROM drugitems d 
          WHERE (
            d.name REGEXP 'Clopidrogrel|Clopidogrel' 
            OR TRIM(d.nhso_adp_code) IN (?, ?)
            OR TRIM(d.nhso_adp_code) LIKE '379997710%'
            OR d.did LIKE ?
          )
        ) target_items
        JOIN opitemrece oo ON oo.icode = target_items.icode
        WHERE IFNULL(oo.vn, '') <> ''
          AND oo.vstdate BETWEEN ? AND ?
        GROUP BY oo.vn
        HAVING qty > 0
      ) dd
      JOIN ovst o ON o.vn = dd.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
      LEFT JOIN spclty spc ON spc.spclty = o.spclty
      LEFT JOIN doctor doc ON doc.code = dd.doctor_code
      LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
      LEFT JOIN visit_pttype vt ON vt.vn = o.vn
      LEFT JOIN (
        SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
               'NHSO :: ได้รับ Invoice แล้ว' AS statusname
        FROM rcmdb.repeclaim
        WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
          AND (errorcode = '' OR errorcode IS NULL)
        GROUP BY vn
      ) nhso ON nhso.vn = o.vn
      LEFT JOIN (
        SELECT vn,
               GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
               SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
               IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: ส่ง Rep แล้ว', NULL) AS statusname,
               GROUP_CONCAT(DISTINCT agency SEPARATOR ',') AS agency,
               GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
               GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund,
               GROUP_CONCAT(DISTINCT errorcode SEPARATOR ',') AS errorcode
        FROM rcmdb.repdata
        WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY vn
      ) rep ON rep.vn = o.vn
      WHERE o.vstdate BETWEEN ? AND ?
      GROUP BY o.vn
      ORDER BY o.vstdate DESC, o.vsttime DESC, o.vn DESC
    `
    const [rows] = await hosPool.query(
      { sql, timeout: 90000 },
      [
        CLOPIDOGREL_ADP_CODE,
        CLOPIDOGREL_ADP_CODE_LEGACY,
        `${CLOPIDOGREL_DID_PREFIX}%`,
        ds1, ds2,
        ds1, ds2,
        ds1, ds2,
        ds1, ds2,
      ]
    )
    return { success: true, fundKey: 'clopidogrel', isDedicated: true, data: { rawRows: rows || [] } }
  })

  // ── 4. Health Screening 14.5 (12003) & 14.6 (12004) ──
  fastify.get('/api/v1/clinical/rcm/funds-v2/health-screening', async (request, reply) => {
    const { ds1, ds2 } = resolveDateParams(request.query)
    const adpCode = request.query.adpCode === '12004' ? '12004' : '12003'
    if (!ds1 || !ds2) return reply.status(400).send({ success: false, error: 'ds1 and ds2 are required' })

    const fiscalStartYear = getFiscalYearStartDate(ds1)
    const includeNondrugItems = adpCode === '12004'

    const sql = `
      SELECT 
        o.vn,
        IFNULL(pt.cid, '') AS cid,
        o.hn,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
        IFNULL(nat.name, pt.nationality) AS nation,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        IFNULL(ptt.hipdata_code, '') AS maininscl,
        IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
        ptt.name AS pttypename,
        dep.department AS department,
        spc.name AS clinic,
        v.pdx,
        v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
        v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
        IFNULL(v.income, 0) AS income,
        dd.name AS listname,
        ${includeNondrugItems ? 'nd.listname1 AS listname1,' : 'NULL AS listname1,'}
        GROUP_CONCAT(DISTINCT DATE_FORMAT(prev_claim.camedate, '%Y-%m-%d') ORDER BY prev_claim.camedate SEPARATOR ', ') AS camedate,
        COALESCE(nhso.statusname, rep.statusname, '-:ยังไม่ได้ส่ง') AS status,
        COALESCE(nhso.rep, rep.rep) AS rep,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        rep.agency,
        rep.fund,
        rep.subfund,
        rep.errorcode,
        rep.transactiontype
      FROM (
        SELECT 
          oo.vn,
          GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
        FROM opitemrece oo
        JOIN s_drugitems d ON d.icode = oo.icode
        WHERE IFNULL(oo.vn, '') <> ''
          AND oo.vstdate BETWEEN ? AND ?
          AND TRIM(d.nhso_adp_code) IN (?)
        GROUP BY oo.vn
      ) dd
      JOIN ovst o ON o.vn = dd.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN nationality nat ON nat.nationality = pt.nationality
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
      LEFT JOIN spclty spc ON spc.spclty = o.spclty
      ${
        includeNondrugItems
          ? `
      LEFT JOIN (
        SELECT 
          a.vn, 
          GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ') AS listname1
        FROM (
          SELECT DISTINCT oo_nd.vn
          FROM opitemrece oo_nd
          JOIN s_drugitems d_nd ON d_nd.icode = oo_nd.icode
          WHERE IFNULL(oo_nd.vn, '') <> ''
            AND oo_nd.vstdate BETWEEN ? AND ?
            AND TRIM(d_nd.nhso_adp_code) IN (?)
        ) target_vn
        JOIN opitemrece a ON a.vn = target_vn.vn
        JOIN nondrugitems b ON b.icode = a.icode
        GROUP BY a.vn
      ) nd ON nd.vn = o.vn
      `
          : ''
      }
      LEFT JOIN (
        SELECT DISTINCT
          o2.hn,
          o2.vstdate AS camedate
        FROM opitemrece oo2
        JOIN s_drugitems d2 ON d2.icode = oo2.icode
        JOIN ovst o2 ON o2.vn = oo2.vn
        WHERE IFNULL(oo2.vn, '') <> ''
          AND oo2.vstdate BETWEEN ? AND ?
          AND o2.vstdate BETWEEN ? AND ?
          AND TRIM(d2.nhso_adp_code) IN (?)
      ) prev_claim ON prev_claim.hn = o.hn AND prev_claim.camedate < o.vstdate
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
      GROUP BY o.vn
      ORDER BY o.hn ASC, o.vn ASC
    `
    const params = [
      ds1, ds2, adpCode,
      ...(includeNondrugItems ? [ds1, ds2, adpCode] : []),
      fiscalStartYear, ds2, fiscalStartYear, ds2, adpCode,
      ds1, ds2,
      ds1, ds2,
      ds1, ds2,
    ]
    const [rows] = await hosPool.query({ sql, timeout: 90000 }, params)
    return { success: true, fundKey: 'health-screening', isDedicated: true, data: { rawRows: rows || [] } }
  })

  // ── 5. Hepatitis C 23.2 (36331) & 23.4 (36333) ──
  fastify.get('/api/v1/clinical/rcm/funds-v2/hepatitis-c', async (request, reply) => {
    const { ds1, ds2 } = resolveDateParams(request.query)
    const adpCode = String(request.query.adpCode || '36331').trim()
    if (!ds1 || !ds2) return reply.status(400).send({ success: false, error: 'ds1 and ds2 are required' })

    const sql = `
      SELECT 
        o.vn,
        IFNULL(pt.cid, '') AS cid,
        o.hn,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        IFNULL(pt.sex, '') AS sex_code,
        IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
        IFNULL(nat.name, pt.nationality) AS nation,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        IFNULL(ptt.hipdata_code, '') AS maininscl,
        ptt.name AS pttypename,
        IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
        s.cc AS cc,
        dep.department AS department,
        spc.name AS clinic,
        v.pdx,
        v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
        v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
        IFNULL(v.income, 0) AS income,
        dd.name AS listname,
        nd.listname1 AS listname1,
        l.labresult,
        COALESCE(nhso.statusname, rep.statusname, '-::ยังไม่ได้ส่ง') AS status,
        COALESCE(nhso.rep, rep.rep) AS rep,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        pt.informaddr AS address,
        pt.mobile_phone_number AS mobile,
        CONCAT_WS(' / ', NULLIF(TRIM(pt.informtel), ''), NULLIF(TRIM(pt.hometel), '')) AS tel,
        sm.status_sm,
        sm.rep_sm,
        IFNULL(sm.compensated_sm, 0) AS compensated_sm,
        rep.agency,
        rep.fund,
        rep.subfund,
        rep.errorcode,
        rep.transactiontype
      FROM (
        SELECT 
          oo.vn,
          GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
        FROM opitemrece oo
        JOIN s_drugitems d ON d.icode = oo.icode
        WHERE IFNULL(oo.vn, '') <> ''
          AND oo.vstdate BETWEEN ? AND ?
          AND TRIM(d.nhso_adp_code) = ?
        GROUP BY oo.vn
      ) dd
      JOIN ovst o ON o.vn = dd.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn
      LEFT JOIN opdscreen s ON s.vn = o.vn
      LEFT JOIN nationality nat ON nat.nationality = pt.nationality
      LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
      LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
      LEFT JOIN spclty spc ON spc.spclty = o.spclty
      LEFT JOIN (
        SELECT 
          lh.vn,
          GROUP_CONCAT(DISTINCT lo.lab_order_result SEPARATOR ', ') AS labresult
        FROM lab_head lh
        JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
        JOIN lab_items l ON l.lab_items_code = lo.lab_items_code
        LEFT JOIN nondrugitems nd ON nd.icode = l.icode
        LEFT JOIN s_drugitems sd ON sd.icode = l.icode
        WHERE lh.order_date BETWEEN ? AND ?
          AND (TRIM(IFNULL(nd.nhso_adp_code, '')) = ? OR TRIM(IFNULL(sd.nhso_adp_code, '')) = ?)
        GROUP BY lh.vn
      ) l ON l.vn = o.vn
      LEFT JOIN (
        SELECT 
          a.vn, 
          GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ') AS listname1
        FROM (
          SELECT DISTINCT oo_nd.vn
          FROM opitemrece oo_nd
          JOIN s_drugitems d_nd ON d_nd.icode = oo_nd.icode
          WHERE IFNULL(oo_nd.vn, '') <> ''
            AND oo_nd.vstdate BETWEEN ? AND ?
            AND TRIM(d_nd.nhso_adp_code) = ?
        ) target_vn
        JOIN opitemrece a ON a.vn = target_vn.vn
        JOIN nondrugitems b ON b.icode = a.icode
        GROUP BY a.vn
      ) nd ON nd.vn = o.vn
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
      LEFT JOIN (
        SELECT
          vn,
          GROUP_CONCAT(DISTINCT status SEPARATOR ', ') AS status_sm,
          GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep_sm,
          SUM(IFNULL(compensated, 0)) AS compensated_sm
        FROM rcmdb.seamless
        WHERE IFNULL(vn, '') <> ''
        GROUP BY vn
      ) sm ON sm.vn = o.vn
      GROUP BY o.vn
      ORDER BY o.hn ASC, o.vn ASC
    `
    const [rows] = await hosPool.query(
      { sql, timeout: 90000 },
      [ds1, ds2, adpCode, ds1, ds2, adpCode, adpCode, ds1, ds2, adpCode, ds1, ds2, ds1, ds2]
    )
    return { success: true, fundKey: 'hepatitis-c', isDedicated: true, data: { rawRows: rows || [] } }
  })

  // ── 6. Postpartum 7.2 (30015) & 7.3 (30016) ──
  fastify.get('/api/v1/clinical/rcm/funds-v2/postpartum', async (request, reply) => {
    const { ds1, ds2 } = resolveDateParams(request.query)
    const adpCode = request.query.adpCode === '30016' ? '30016' : '30015'
    if (!ds1 || !ds2) return reply.status(400).send({ success: false, error: 'ds1 and ds2 are required' })

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
        IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
        dep.department,
        spc.name AS clinic,
        v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
        v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
        dd.name AS listname,
        nd.listname1 AS listname1,
        COALESCE(nhso.statusname, rep.statusname, '-:ยังไม่ได้ส่ง') AS status,
        COALESCE(nhso.rep, rep.rep) AS rep,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        rep.fund,
        rep.subfund
      FROM (
        SELECT 
          oo.vn, 
          GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
        FROM opitemrece oo
        JOIN s_drugitems d ON d.icode = oo.icode
        WHERE IFNULL(oo.vn, '') <> ''
          AND oo.vstdate BETWEEN ? AND ?
          AND TRIM(d.nhso_adp_code) = ?
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
        SELECT a.vn, GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ') AS listname1
        FROM (
          SELECT DISTINCT oo_nd.vn
          FROM opitemrece oo_nd
          JOIN s_drugitems d_nd ON d_nd.icode = oo_nd.icode
          WHERE IFNULL(oo_nd.vn, '') <> ''
            AND oo_nd.vstdate BETWEEN ? AND ?
            AND TRIM(d_nd.nhso_adp_code) = ?
        ) target_vn
        JOIN opitemrece a ON a.vn = target_vn.vn
        JOIN nondrugitems b ON b.icode = a.icode
        GROUP BY a.vn
      ) nd ON nd.vn = o.vn
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
               GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
               GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
        FROM rcmdb.repdata
        WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY vn
      ) rep ON rep.vn = o.vn
      WHERE o.vstdate BETWEEN ? AND ?
      GROUP BY o.vn
      ORDER BY o.hn ASC, o.vn ASC
    `
    const [rows] = await hosPool.query(
      { sql, timeout: 90000 },
      [ds1, ds2, adpCode, ds1, ds2, adpCode, ds1, ds2, ds1, ds2, ds1, ds2]
    )
    return { success: true, fundKey: 'postpartum', isDedicated: true, data: { rawRows: rows || [] } }
  })

  // ── 7. Postal Drug 11.52 (DRUGP) ──
  fastify.get('/api/v1/clinical/rcm/funds-v2/drug-post', async (request, reply) => {
    const { ds1, ds2 } = resolveDateParams(request.query)
    const adpCode = String(request.query.adpCode || 'DRUGP').trim()
    if (!ds1 || !ds2) return reply.status(400).send({ success: false, error: 'ds1 and ds2 are required' })

    const sql = `
      SELECT 
        o.vn,
        IFNULL(pt.cid, '') AS cid,
        o.hn,
        CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
        IFNULL(pt.sex, '') AS sex_code,
        DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
        IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
        COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
        IFNULL(ptt.hipdata_code, '') AS maininscl,
        IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
        CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
        dep.department AS department,
        spc.name AS clinic,
        v.pdx,
        IFNULL(v.income, 0) AS income,
        dd.sum_price,
        dd.listname,
        COALESCE(nhso.statusname, rep.statusname, '-:ยังไม่ได้ส่ง') AS status,
        COALESCE(nhso.rep, rep.rep) AS rep,
        COALESCE(nhso.compensated, rep.compensated, 0) AS compensated,
        rep.fund,
        rep.subfund
      FROM (
        SELECT 
          oo.vn,
          SUM(oo.sum_price) AS sum_price,
          GROUP_CONCAT(DISTINCT target_items.adp_name SEPARATOR ', ') AS listname
        FROM (
          SELECT icode, CONCAT_WS(' ', name, NULLIF(strength, '')) AS adp_name
          FROM s_drugitems
          WHERE TRIM(nhso_adp_code) = ?
        ) target_items
        JOIN opitemrece oo ON oo.icode = target_items.icode
        WHERE IFNULL(oo.vn, '') <> ''
          AND oo.vstdate BETWEEN ? AND ?
        GROUP BY oo.vn
      ) dd
      JOIN ovst o ON o.vn = dd.vn
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN vn_stat v ON v.vn = o.vn
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
               GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
               GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
        FROM rcmdb.repdata
        WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY vn
      ) rep ON rep.vn = o.vn
      ORDER BY o.vstdate DESC, o.vsttime DESC
    `
    const [rows] = await hosPool.query(
      { sql, timeout: 90000 },
      [adpCode, ds1, ds2, ds1, ds2, ds1, ds2]
    )
    return { success: true, fundKey: 'drug-post', isDedicated: true, data: { rawRows: rows || [] } }
  })
}
