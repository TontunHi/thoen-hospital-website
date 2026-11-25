// Thoen Hospital API Gateway Plugin: RCM Family Planning V2 (9.2 IUD & 9.3.2 Women >= 20)

const IUD_ADP_CODES = ['20003', 'FP001', '71681', '71682']

export default async function rcmFamilyPlanningV2Routes(fastify, { pools, getCached }) {
  const { hosPool } = pools

  async function queryIudAdpMapping() {
    try {
      const [rows] = await hosPool.query(
        `SELECT icode, name, strength, nhso_adp_code
         FROM s_drugitems
         WHERE TRIM(nhso_adp_code) IN (?, ?, ?, ?)
         ORDER BY nhso_adp_code ASC, icode ASC`,
        IUD_ADP_CODES
      )
      const items = (rows || []).map((r) => ({
        icode: String(r.icode || '').trim(),
        name: String(r.name || '').trim(),
        strength: r.strength ? String(r.strength).trim() : null,
        nhso_adp_code: String(r.nhso_adp_code || '').trim(),
      }))
      return { isMapped: items.length > 0, mappedCount: items.length, adpCodes: IUD_ADP_CODES, items }
    } catch {
      return { isMapped: false, mappedCount: 0, adpCodes: IUD_ADP_CODES, items: [] }
    }
  }

  async function query932AdpMapping(format) {
    const adpCodes = format === 'KRUNGTHAI' ? ['20003', '20004'] : ['FP001', 'FP002']
    try {
      const [[sRows], [ndRows]] = await Promise.all([
        hosPool.query(
          `SELECT icode, name, strength, nhso_adp_code FROM s_drugitems WHERE nhso_adp_code IN (?, ?) ORDER BY name ASC`,
          adpCodes
        ),
        hosPool.query(
          `SELECT icode, name, NULL AS strength, nhso_adp_code FROM nondrugitems WHERE nhso_adp_code IN (?, ?) ORDER BY name ASC`,
          adpCodes
        ),
      ])
      const combined = [...(sRows || []), ...(ndRows || [])]
      const uniqueItems = Array.from(new Map(combined.map((item) => [item.icode, item])).values())
      return { isMapped: uniqueItems.length > 0, mappedCount: uniqueItems.length, adpCodes, items: uniqueItems }
    } catch {
      return { isMapped: true, mappedCount: 0, adpCodes, items: [] }
    }
  }

  fastify.get('/api/v1/clinical/rcm/fp/iud-adp-mapping', {
    schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ตรวจสอบ ADP Mapping 9.2 ห่วงอนามัย' }
  }, async (_req, reply) => {
    try {
      const data = await getCached('gw-fp-iud-adp', 600000, queryIudAdpMapping)
      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/clinical/rcm/fp/iud', {
    schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'รายงาน 9.2 บริการใส่ห่วงอนามัย (OPD/IPD)' }
  }, async (req, reply) => {
    try {
      const { startDate: ds1, endDate: ds2, patientType = 'OPD', refresh } = req.query || {}
      if (!ds1 || !ds2) {
        reply.code(400); return { success: false, error: 'startDate and endDate are required' }
      }
      const pType = patientType === 'IPD' ? 'IPD' : 'OPD'
      const cacheKey = `gw-fp-iud-${pType}-${ds1}-${ds2}`
      const fetcher = async () => {
        const adpMapping = await queryIudAdpMapping()
        let rows = []
        if (pType === 'IPD') {
          try {
            const [r] = await hosPool.query(
              `SELECT
                i.an AS vn, i.an, IFNULL(pt.cid, '') AS cid, i.hn,
                CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
                CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
                IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
                DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
                DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
                DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
                TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
                CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
                ptt.pttype_eclaim_id,
                COALESCE(cc.AuthenCode, m.claimcode, '') AS claimcode,
                w.name AS department, spc.name AS clinic, '' AS cc,
                IFNULL(a.income, 0) AS income,
                GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
                GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
                GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
                COALESCE(e.income, 0) AS money_eclaim,
                COALESCE(r.income, 0) AS money_rep,
                COALESCE(n.income, 0) AS money_invoice,
                COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, ''), NULLIF(nn.Rep, ''), NULLIF(m.rep, ''), '') AS rep,
                CASE
                  WHEN n.an IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
                  WHEN r.an IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
                  WHEN nn.Seq IS NOT NULL AND IFNULL(nn.Rep, '') <> '' THEN IFNULL(nn.StatusName, 'E-Claim :: มี Rep แล้ว')
                  WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
                  ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
                END AS status
              FROM (
                SELECT DISTINCT an FROM (
                  SELECT i2.an FROM ipt i2 JOIN iptdiag dx2 ON dx2.an = i2.an WHERE i2.dchdate >= ? AND i2.dchdate < DATE_ADD(?, INTERVAL 1 DAY) AND dx2.icd10 REGEXP 'Z301'
                  UNION
                  SELECT i3.an FROM ipt i3 JOIN iptoprt op3 ON op3.an = i3.an WHERE i3.dchdate >= ? AND i3.dchdate < DATE_ADD(?, INTERVAL 1 DAY) AND op3.icd9 IN ('697')
                  UNION
                  SELECT oo2.an FROM opitemrece oo2 JOIN s_drugitems d2 ON d2.icode = oo2.icode
                  WHERE oo2.vstdate >= ? AND oo2.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND IFNULL(oo2.an, '') <> '' AND d2.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
                ) u
              ) t
              JOIN ipt i ON i.an = t.an
              LEFT JOIN patient pt ON pt.hn = i.hn
              LEFT JOIN an_stat a ON a.an = i.an
              LEFT JOIN ward w ON w.ward = i.ward
              LEFT JOIN spclty spc ON spc.spclty = i.spclty
              LEFT JOIN iptdiag dx ON dx.an = i.an
              LEFT JOIN iptoprt op ON op.an = i.an
              LEFT JOIN opitemrece oo ON oo.an = i.an
              LEFT JOIN s_drugitems d ON d.icode = oo.icode
              LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
              LEFT JOIN rcmdb.authencode cc ON cc.vn = i.an
              LEFT JOIN (SELECT an, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep FROM rcmdb.repdata WHERE department = 'IP' AND (fpnhso > 0 OR pp > 0) GROUP BY an) r ON r.an = i.an
              LEFT JOIN (SELECT an, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep FROM rcmdb.repeclaim WHERE department = 'IP' AND (fpnhso > 0 OR pp > 0) GROUP BY an) n ON n.an = i.an
              LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = i.an
              LEFT JOIN (SELECT e.an, SUM(cc.totpay1) AS income FROM eclaimdb.m_registerdata e JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no WHERE e.person_type = '2' AND cc.code LIKE 'FP001%' GROUP BY e.an) e ON e.an = i.an
              LEFT JOIN (
                SELECT m.an,
                  SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                  SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status,
                  SUBSTRING_INDEX(GROUP_CONCAT(m.claimcode ORDER BY m.eclaim_no DESC), ',', 1) AS claimcode
                FROM eclaimdb.m_registerdata m WHERE m.person_type = '2' AND IFNULL(m.an, '') <> '' GROUP BY m.an
              ) m ON m.an = i.an
              LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
              GROUP BY i.an
              ORDER BY i.dchdate DESC`,
              [ds1, ds2, ds1, ds2, ds1, ds2]
            )
            rows = r || []
          } catch {
            const [r] = await hosPool.query(
              `SELECT i.an AS vn, i.an, IFNULL(pt.cid, '') AS cid, i.hn,
                CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
                CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
                IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
                DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate, DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
                DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate, TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
                CONCAT_WS(':', i.pttype, ptt.name) AS pttypename, ptt.pttype_eclaim_id,
                '' AS claimcode, w.name AS department, spc.name AS clinic, '' AS cc, IFNULL(a.income, 0) AS income,
                GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
                GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
                GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
                0 AS money_eclaim, 0 AS money_rep, 0 AS money_invoice, '' AS rep, '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
              FROM (
                SELECT DISTINCT an FROM (
                  SELECT i2.an FROM ipt i2 JOIN iptdiag dx2 ON dx2.an = i2.an WHERE i2.dchdate >= ? AND i2.dchdate < DATE_ADD(?, INTERVAL 1 DAY) AND dx2.icd10 REGEXP 'Z301'
                  UNION SELECT i3.an FROM ipt i3 JOIN iptoprt op3 ON op3.an = i3.an WHERE i3.dchdate >= ? AND i3.dchdate < DATE_ADD(?, INTERVAL 1 DAY) AND op3.icd9 IN ('697')
                  UNION SELECT oo2.an FROM opitemrece oo2 JOIN s_drugitems d2 ON d2.icode = oo2.icode WHERE oo2.vstdate >= ? AND oo2.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND IFNULL(oo2.an, '') <> '' AND d2.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
                ) u
              ) t
              JOIN ipt i ON i.an = t.an LEFT JOIN patient pt ON pt.hn = i.hn LEFT JOIN an_stat a ON a.an = i.an
              LEFT JOIN ward w ON w.ward = i.ward LEFT JOIN spclty spc ON spc.spclty = i.spclty LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
              LEFT JOIN iptdiag dx ON dx.an = i.an LEFT JOIN iptoprt op ON op.an = i.an
              LEFT JOIN opitemrece oo ON oo.an = i.an LEFT JOIN s_drugitems d ON d.icode = oo.icode
              GROUP BY i.an ORDER BY i.dchdate DESC`,
              [ds1, ds2, ds1, ds2, ds1, ds2]
            )
            rows = r || []
          }
        } else {
          try {
            const [r] = await hosPool.query(
              `SELECT
                o.vn, IFNULL(pt.cid, '') AS cid, o.hn,
                CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
                CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
                IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
                DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate, TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
                CONCAT_WS(':', o.pttype, ptt.name) AS pttypename, ptt.pttype_eclaim_id,
                COALESCE(cc.AuthenCode, m.claimcode, '') AS claimcode,
                dep.department AS department, spc.name AS clinic, s.cc AS cc, IFNULL(v.income, 0) AS income,
                GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
                GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
                GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
                COALESCE(e.income, 0) AS money_eclaim, COALESCE(r.income, 0) AS money_rep, COALESCE(n.income, 0) AS money_invoice,
                COALESCE(NULLIF(n.rep, ''), NULLIF(r.rep, ''), NULLIF(nn.Rep, ''), NULLIF(m.rep, ''), '') AS rep,
                CASE
                  WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
                  WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
                  WHEN nn.Seq IS NOT NULL AND IFNULL(nn.Rep, '') <> '' THEN IFNULL(nn.StatusName, 'E-Claim :: มี Rep แล้ว')
                  WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
                  ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
                END AS status
              FROM (
                SELECT DISTINCT vn FROM (
                  SELECT vn FROM ovstdiag WHERE vstdate >= ? AND vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND (icd10 REGEXP 'Z301' OR icd10 IN ('697'))
                  UNION
                  SELECT oo.vn FROM opitemrece oo JOIN s_drugitems d ON d.icode = oo.icode
                  WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND IFNULL(oo.vn, '') <> '' AND d.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
                ) u
              ) t
              JOIN ovst o ON o.vn = t.vn LEFT JOIN patient pt ON pt.hn = o.hn LEFT JOIN vn_stat v ON v.vn = o.vn
              LEFT JOIN opdscreen s ON s.vn = o.vn LEFT JOIN ovstdiag dx ON dx.vn = o.vn
              LEFT JOIN opitemrece oo ON oo.vn = o.vn LEFT JOIN s_drugitems d ON d.icode = oo.icode
              LEFT JOIN pttype ptt ON ptt.pttype = o.pttype LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
              LEFT JOIN spclty spc ON spc.spclty = o.spclty LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
              LEFT JOIN (SELECT vn, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep FROM rcmdb.repdata WHERE department = 'OP' AND (fpnhso > 0 OR pp > 0) GROUP BY vn) r ON r.vn = o.vn
              LEFT JOIN (SELECT vn, SUM(IFNULL(fpnhso, 0) + IFNULL(pp, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep FROM rcmdb.repeclaim WHERE department = 'OP' AND (fpnhso > 0 OR pp > 0) GROUP BY vn) n ON n.vn = o.vn
              LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
              LEFT JOIN (SELECT e.opdseq AS vn, SUM(cc.totpay1) AS income FROM eclaimdb.m_registerdata e JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no WHERE e.person_type = '1' AND cc.code LIKE 'FP001%' GROUP BY e.opdseq) e ON e.vn = o.vn
              LEFT JOIN (
                SELECT m.opdseq AS vn,
                  SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                  SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status,
                  SUBSTRING_INDEX(GROUP_CONCAT(m.claimcode ORDER BY m.eclaim_no DESC), ',', 1) AS claimcode
                FROM eclaimdb.m_registerdata m WHERE m.person_type = '1' AND IFNULL(m.opdseq, '') <> '' GROUP BY m.opdseq
              ) m ON m.vn = o.vn
              LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
              GROUP BY o.vn ORDER BY o.vstdate DESC, o.vsttime DESC`,
              [ds1, ds2, ds1, ds2]
            )
            rows = r || []
          } catch {
            const [r] = await hosPool.query(
              `SELECT o.vn, IFNULL(pt.cid, '') AS cid, o.hn,
                CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
                CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
                IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
                DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate, TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
                CONCAT_WS(':', o.pttype, ptt.name) AS pttypename, ptt.pttype_eclaim_id,
                '' AS claimcode, dep.department AS department, spc.name AS clinic, s.cc AS cc, IFNULL(v.income, 0) AS income,
                GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
                GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
                GROUP_CONCAT(DISTINCT IF(d.nhso_adp_code IN ('20003', '71681', '71682', 'FP001'), CONCAT(d.name, IFNULL(CONCAT(' ', d.strength), '')), NULL) SEPARATOR ', ') AS drug,
                0 AS money_eclaim, 0 AS money_rep, 0 AS money_invoice, '' AS rep, '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim' AS status
              FROM (
                SELECT DISTINCT vn FROM (
                  SELECT vn FROM ovstdiag WHERE vstdate >= ? AND vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND (icd10 REGEXP 'Z301' OR icd10 IN ('697'))
                  UNION SELECT oo.vn FROM opitemrece oo JOIN s_drugitems d ON d.icode = oo.icode WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND IFNULL(oo.vn, '') <> '' AND d.nhso_adp_code IN ('20003', 'FP001', '71681', '71682')
                ) u
              ) t
              JOIN ovst o ON o.vn = t.vn LEFT JOIN patient pt ON pt.hn = o.hn LEFT JOIN vn_stat v ON v.vn = o.vn
              LEFT JOIN opdscreen s ON s.vn = o.vn LEFT JOIN ovstdiag dx ON dx.vn = o.vn
              LEFT JOIN opitemrece oo ON oo.vn = o.vn LEFT JOIN s_drugitems d ON d.icode = oo.icode
              LEFT JOIN pttype ptt ON ptt.pttype = o.pttype LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
              LEFT JOIN spclty spc ON spc.spclty = o.spclty
              GROUP BY o.vn ORDER BY o.vstdate DESC, o.vsttime DESC`,
              [ds1, ds2, ds1, ds2]
            )
            rows = r || []
          }
        }
        return { adpMapping, rawRows: rows }
      }
      const data = refresh === 'true' ? await fetcher() : await getCached(cacheKey, 300000, fetcher)
      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/clinical/rcm/fp/932-adp-mapping', {
    schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'ตรวจสอบ ADP Mapping 9.3.2 คุมกำเนิดกึ่งถาวร >= 20 ปี' }
  }, async (req, reply) => {
    try {
      const format = req.query?.format === 'KRUNGTHAI' ? 'KRUNGTHAI' : 'NEW_ECLAIM'
      const data = await getCached(`gw-fp-932-adp-${format}`, 600000, () => query932AdpMapping(format))
      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.get('/api/v1/clinical/rcm/fp/932', {
    schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'รายงาน 9.3.2 คุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป' }
  }, async (req, reply) => {
    try {
      const { startDate: ds1, endDate: ds2, format: rawFmt, refresh } = req.query || {}
      if (!ds1 || !ds2) {
        reply.code(400); return { success: false, error: 'startDate and endDate are required' }
      }
      const format = rawFmt === 'KRUNGTHAI' ? 'KRUNGTHAI' : 'NEW_ECLAIM'
      const adp1 = format === 'KRUNGTHAI' ? '20003' : 'FP001'
      const adp2 = format === 'KRUNGTHAI' ? '20004' : 'FP002'
      const cacheKey = `gw-fp-932-${format}-${ds1}-${ds2}`
      const fetcher = async () => {
        const adpMapping = await query932AdpMapping(format)
        let rows = []
        try {
          const [r] = await hosPool.query(
            `SELECT
              o.vn, IFNULL(o.an, '') AS an, IFNULL(pt.cid, '') AS cid, o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
              COALESCE(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate, TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              CONCAT_WS(':', o.pttype, ptt.name) AS pttypename, ptt.pttype_eclaim_id,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(cc2.auth_code), ''), NULLIF(TRIM(cc2.claim_code), ''), '') AS authencode,
              dep.department AS department, spc.name AS clinic, IFNULL(v.income, 0) AS income,
              drug_sub.drugname, drug_sub.drug_adp, fp_sub.listname, fp_sub.fp_adp,
              CONCAT_WS(',', NULLIF(drug_sub.drug_adp, ''), NULLIF(fp_sub.fp_adp, '')) AS adpcode,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
              COALESCE(e.income, 0) AS compensated_eclaim, COALESCE(r.income, 0) AS compensated_rep, COALESCE(n.income, 0) AS compensated_nhso,
              COALESCE(NULLIF(e.rep, ''), NULLIF(nn.Rep, ''), '') AS rep_eclaim,
              COALESCE(r.rep, '') AS rep_rep, COALESCE(n.rep, '') AS rep_nhso,
              CASE
                WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
                WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
                WHEN nn.Seq IS NOT NULL AND IFNULL(nn.Rep, '') <> '' THEN IFNULL(nn.StatusName, 'E-Claim :: มี Rep แล้ว')
                WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
                ELSE '- :: ยังไม่ได้ส่ง'
              END AS status
            FROM (
              SELECT DISTINCT oo.vn FROM opitemrece oo
              LEFT JOIN drugitems d ON d.icode = oo.icode
              LEFT JOIN nondrugitems nd ON nd.icode = oo.icode
              WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND IFNULL(oo.vn, '') <> ''
                AND (d.name REGEXP 'norplant|implanon|jadelle' OR d.name LIKE '%ยาฝัง%' OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%' OR nd.nhso_adp_code IN (?, ?))
            ) filtered_vn
            JOIN ovst o ON o.vn = filtered_vn.vn
            JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN ovstdiag dx ON dx.vn = o.vn
            LEFT JOIN (
              SELECT oo.vn, GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS drugname, GROUP_CONCAT(DISTINCT d.nhso_adp_code SEPARATOR ', ') AS drug_adp
              FROM opitemrece oo JOIN drugitems d ON d.icode = oo.icode
              WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (d.name REGEXP 'norplant|implanon|jadelle' OR d.name LIKE '%ยาฝัง%' OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%')
              GROUP BY oo.vn
            ) drug_sub ON drug_sub.vn = o.vn
            LEFT JOIN (
              SELECT oo.vn, GROUP_CONCAT(DISTINCT nd.name SEPARATOR ', ') AS listname, GROUP_CONCAT(DISTINCT nd.nhso_adp_code SEPARATOR ', ') AS fp_adp
              FROM opitemrece oo JOIN nondrugitems nd ON nd.icode = oo.icode
              WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND nd.nhso_adp_code IN (?, ?)
              GROUP BY oo.vn
            ) fp_sub ON fp_sub.vn = o.vn
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN visit_pttype cc2 ON cc2.vn = o.vn
            LEFT JOIN (
              SELECT e.opdseq AS vn, SUM(COALESCE(cc.totpay1, 0)) AS income,
                     SUBSTRING_INDEX(GROUP_CONCAT(IF(e.status = '4', e.rep, NULL) ORDER BY e.eclaim_no DESC), ',', 1) AS rep
              FROM eclaimdb.m_registerdata e JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
              WHERE e.person_type = '1' AND e.dateadm >= ? AND e.dateadm < DATE_ADD(?, INTERVAL 1 DAY)
              GROUP BY e.opdseq
            ) e ON e.vn = o.vn
            LEFT JOIN (SELECT vn, SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep FROM rcmdb.repdata WHERE department = 'OP' GROUP BY vn) r ON r.vn = o.vn
            LEFT JOIN (SELECT vn, SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income, GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep FROM rcmdb.repeclaim WHERE department = 'OP' GROUP BY vn) n ON n.vn = o.vn
            LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
            LEFT JOIN (
              SELECT m.opdseq AS vn,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
              FROM eclaimdb.m_registerdata m WHERE m.person_type = '1' AND m.opdseq IS NOT NULL AND m.dateadm >= ? AND m.dateadm < DATE_ADD(?, INTERVAL 1 DAY)
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND pt.sex = '2'
              AND (v.age_y >= 20 OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) >= 20)
              AND (drug_sub.vn IS NOT NULL OR fp_sub.vn IS NOT NULL)
            GROUP BY o.vn ORDER BY o.vstdate DESC, o.vsttime DESC`,
            [ds1, ds2, adp1, adp2, ds1, ds2, ds1, ds2, adp1, adp2, ds1, ds2, ds1, ds2, ds1, ds2]
          )
          rows = r || []
        } catch {
          const [r] = await hosPool.query(
            `SELECT o.vn, IFNULL(o.an, '') AS an, IFNULL(pt.cid, '') AS cid, o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
              COALESCE(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate, TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              CONCAT_WS(':', o.pttype, ptt.name) AS pttypename, ptt.pttype_eclaim_id,
              COALESCE(NULLIF(TRIM(cc2.auth_code), ''), NULLIF(TRIM(cc2.claim_code), ''), '') AS authencode,
              dep.department AS department, spc.name AS clinic, IFNULL(v.income, 0) AS income,
              drug_sub.drugname, drug_sub.drug_adp, fp_sub.listname, fp_sub.fp_adp,
              CONCAT_WS(',', NULLIF(drug_sub.drug_adp, ''), NULLIF(fp_sub.fp_adp, '')) AS adpcode,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
              0 AS compensated_eclaim, 0 AS compensated_rep, 0 AS compensated_nhso, '' AS rep_eclaim, '' AS rep_rep, '' AS rep_nhso, '- :: ยังไม่ได้ส่ง' AS status
            FROM (
              SELECT DISTINCT oo.vn FROM opitemrece oo LEFT JOIN drugitems d ON d.icode = oo.icode LEFT JOIN nondrugitems nd ON nd.icode = oo.icode
              WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND IFNULL(oo.vn, '') <> ''
                AND (d.name REGEXP 'norplant|implanon|jadelle' OR d.name LIKE '%ยาฝัง%' OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%' OR nd.nhso_adp_code IN (?, ?))
            ) filtered_vn
            JOIN ovst o ON o.vn = filtered_vn.vn JOIN patient pt ON pt.hn = o.hn LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty LEFT JOIN ovstdiag dx ON dx.vn = o.vn
            LEFT JOIN (SELECT oo.vn, GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS drugname, GROUP_CONCAT(DISTINCT d.nhso_adp_code SEPARATOR ', ') AS drug_adp FROM opitemrece oo JOIN drugitems d ON d.icode = oo.icode WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND (d.name REGEXP 'norplant|implanon|jadelle' OR d.name LIKE '%ยาฝัง%' OR d.name LIKE '%ยาคุมกำเนิดชนิดฝัง%') GROUP BY oo.vn) drug_sub ON drug_sub.vn = o.vn
            LEFT JOIN (SELECT oo.vn, GROUP_CONCAT(DISTINCT nd.name SEPARATOR ', ') AS listname, GROUP_CONCAT(DISTINCT nd.nhso_adp_code SEPARATOR ', ') AS fp_adp FROM opitemrece oo JOIN nondrugitems nd ON nd.icode = oo.icode WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND nd.nhso_adp_code IN (?, ?) GROUP BY oo.vn) fp_sub ON fp_sub.vn = o.vn
            LEFT JOIN visit_pttype cc2 ON cc2.vn = o.vn
            WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY) AND pt.sex = '2'
              AND (v.age_y >= 20 OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) >= 20)
              AND (drug_sub.vn IS NOT NULL OR fp_sub.vn IS NOT NULL)
            GROUP BY o.vn ORDER BY o.vstdate DESC, o.vsttime DESC`,
            [ds1, ds2, adp1, adp2, ds1, ds2, ds1, ds2, adp1, adp2, ds1, ds2]
          )
          rows = r || []
        }
        return { adpMapping, rawRows: rows }
      }
      const data = refresh === 'true' ? await fetcher() : await getCached(cacheKey, 300000, fetcher)
      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })
}
