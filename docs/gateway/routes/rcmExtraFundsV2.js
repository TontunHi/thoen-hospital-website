/**
 * Phase 2D: RCM Extra Funds (T1DM/GDM/PDM, Thai Traditional Medicine, Thalassemia Fund, Thalassemia Pregnancy, Viral Hepatitis B)
 * Zero-SQL Named Endpoints for thoen-api-gateway-v2
 */

export default async function rcmExtraFundsV2Routes(fastify, opts) {
  const hosPool = opts.hosPool || opts.pools?.hosPool;
  const appPool = opts.appPool || opts.pools?.appPool;
  const getCached = opts.getCached;

  const withCache = async (key, ttlMs, fn, refresh = false) => {
    if (typeof getCached === 'function' && !refresh) {
      return getCached(key, ttlMs, fn);
    }
    return fn();
  };

  // ── 1. T1DM / GDM / PDM Recipients ──
  fastify.get('/api/v1/clinical/rcm/extra/t1dm-recipients', { schema: { tags: ['06. RCM — Seamless, T1DM, CCS & Family Planning'], summary: 'รายงานผู้รับบริการกองทุน T1DM / GDM / PDM พร้อมจับคู่ทะเบียน' } }, async (request, reply) => {
    const { startDate, endDate, refresh } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(
      `rcm-extra-t1dm:${startDate}:${endDate}`,
      600000,
      async () => {
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
            CONCAT_WS(' ', NULLIF(pt.informtel, ''), NULLIF(pt.hometel, '')) AS tel,
            IF(dd.pid IS NOT NULL, 'Y', NULL) AS ok,
            dd.type AS type,
            DATE_FORMAT(dd.register_date, '%Y-%m-%d') AS regdate,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            (
              SELECT DATE_FORMAT(anc.lmp, '%Y-%m-%d')
              FROM person p
              JOIN person_anc anc ON anc.person_id = p.person_id
              WHERE p.patient_hn = o.hn
                AND (anc.labor_date IS NULL OR o.vstdate <= anc.labor_date)
              ORDER BY anc.person_anc_id DESC
              LIMIT 1
            ) AS lmp,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            IFNULL(ptt_pt.name, pt.pttype) AS pttypename_patient,
            IFNULL(ptt.name, o.pttype) AS pttypename_visit,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(dep.department, o.main_dep) AS department,
            IFNULL(spc.name, o.spclty) AS clinic,
            v.pdx,
            v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-:ยังไม่ได้ส่ง') AS status,
            COALESCE(
              NULLIF(TRIM(nhso.rep), ''),
              NULLIF(TRIM(rep.rep), ''),
              NULLIF(TRIM(nn.Rep), ''),
              NULLIF(TRIM(m.rep), '')
            ) AS rep,
            CASE
              WHEN nhso.vn IS NOT NULL AND nhso.compensated > 0 THEN nhso.compensated
              WHEN rep.vn IS NOT NULL AND rep.compensated > 0 THEN rep.compensated
              WHEN nn.Seq IS NOT NULL AND nn.Income > 0 THEN nn.Income
              WHEN m.vn IS NOT NULL AND m.compensated > 0 THEN m.compensated
              ELSE COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0)
            END AS compensated,
            rep.fund,
            rep.subfund
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          JOIN ovstdiag dx ON dx.vn = o.vn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt_pt ON ptt_pt.pttype = pt.pttype
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN rcmdb.t1dm dd ON dd.pid = pt.cid
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
                   GROUP_CONCAT(DISTINCT fund SEPARATOR ', ') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ', ') AS subfund
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
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
            AND dx.icd10 REGEXP 'O24'
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC
        `;
        const sqlParams = [startDate, endDate, startDate, endDate, startDate, endDate];
        let rows = [];
        try {
          const [res] = await hosPool.query(sql, sqlParams);
          rows = res || [];
        } catch (dbErr) {
          if (dbErr?.message && /rcmdb\.t1dm/i.test(dbErr.message)) {
            const fallbackSql = sql.replace(
              'LEFT JOIN rcmdb.t1dm dd ON dd.pid = pt.cid',
              'LEFT JOIN (SELECT NULL AS pid, NULL AS type, NULL AS register_date) dd ON 1=0'
            );
            const [res] = await hosPool.query(fallbackSql, sqlParams);
            rows = res || [];
          } else {
            throw dbErr;
          }
        }

        // Enrich from Website DB mirror table if available
        if (rows.length > 0 && appPool) {
          try {
            const [mirrorRows] = await appPool.query(`
              SELECT pid, type, DATE_FORMAT(register_date, '%Y-%m-%d') AS regdate
              FROM t1dm_registries
              WHERE pid IS NOT NULL AND pid <> ''
            `);
            if (Array.isArray(mirrorRows) && mirrorRows.length > 0) {
              const mirrorMap = new Map();
              for (const mr of mirrorRows) {
                if (mr.pid) {
                  mirrorMap.set(String(mr.pid).trim(), {
                    type: mr.type || 'T1DM',
                    regdate: mr.regdate || '',
                  });
                }
              }
              for (const r of rows) {
                const cid = String(r.cid || '').trim();
                if (!r.ok && cid && mirrorMap.has(cid)) {
                  const matched = mirrorMap.get(cid);
                  r.ok = 'Y';
                  r.type = matched.type;
                  r.regdate = matched.regdate || null;
                }
              }
            }
          } catch {
            // non-blocking
          }
        }
        return rows;
      },
      refresh === 'true'
    );
    return reply.send({ success: true, data });
  });

  // ── 2. Thai Traditional Medicine: Topic 3 ──
  fastify.get('/api/v1/clinical/rcm/extra/ttm-topic3', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานแพทย์แผนไทย หัวข้อ 3 (หัตถการ/บริการแพทย์แผนไทย)' } }, async (request, reply) => {
    const { startDate, endDate, refresh } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(
      `rcm-extra-ttm3:${startDate}:${endDate}`,
      600000,
      async () => {
        const [rows] = await hosPool.query(
          `
          SELECT 
            o.vn,
            o.hn,
            IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            IFNULL(pt.sex, '') AS sex_code,
            DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            DATE_FORMAT(s.service_date, '%Y-%m-%d') AS servicedate,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(cp.nhso_authen_code), ''), NULLIF(TRIM(vi.auth_code), ''), NULLIF(TRIM(vi.claim_code), '')) AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            IFNULL(dep.department, o.main_dep) AS department,
            IFNULL(spc.name, o.spclty) AS clinic,
            IF(s.in_hospcode_service = 'N', 'N', 'Y') AS place,
            IF(hd.has_herb_drug = 'Y' OR st_sub.tm1 = 'Y', 'Y', 'N') AS treatment1,
            IF(st_sub.tm2 = 'Y', 'Y', 'N') AS treatment2,
            IF(st_sub.tm3 = 'Y', 'Y', 'N') AS treatment3,
            IF(st_sub.tm4 = 'Y', 'Y', 'N') AS treatment4,
            IF(st_sub.tm5 = 'Y', 'Y', 'N') AS treatment5,
            IF(st_sub.tm6 = 'Y', 'Y', 'N') AS treatment6,
            IF(st_sub.tm7 = 'Y', 'Y', 'N') AS treatment7,
            st_sub.treatment_names,
            hd.herb_drugs,
            v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            IFNULL(v.income, 0) AS income,
            COALESCE(
              NULLIF(TRIM(nhso.statusname), ''),
              NULLIF(TRIM(rep.statusname), ''),
              NULLIF(TRIM(nn.StatusName), ''),
              NULLIF(TRIM(m.statusname), ''),
              'ยังไม่ได้ส่ง'
            ) AS status,
            COALESCE(
              NULLIF(TRIM(nhso.rep), ''),
              NULLIF(TRIM(rep.rep), ''),
              NULLIF(TRIM(nn.Rep), ''),
              NULLIF(TRIM(m.rep), '')
            ) AS rep,
            CASE 
              WHEN nhso.compensated IS NOT NULL AND nhso.compensated > 0 THEN nhso.compensated
              WHEN rep.compensated IS NOT NULL AND rep.compensated > 0 THEN rep.compensated
              WHEN nn.Income IS NOT NULL AND nn.Income > 0 THEN nn.Income
              WHEN m.compensated IS NOT NULL AND m.compensated > 0 THEN m.compensated
              ELSE COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0)
            END AS compensated,
            sm.payno AS seamless_payno,
            sm.compensated AS seamless_compensated
          FROM ovst o
          JOIN health_med_service s ON s.vn = o.vn
          LEFT JOIN (
            SELECT 
              tt.health_med_service_id,
              GROUP_CONCAT(DISTINCT IF(COALESCE(st.health_med_treatment_id, CASE WHEN st.health_med_treatment_subtype_name REGEXP 'ยา' THEN 1 WHEN st.health_med_treatment_subtype_name REGEXP 'นวด' THEN 2 WHEN st.health_med_treatment_subtype_name REGEXP 'ประคบ' THEN 3 WHEN st.health_med_treatment_subtype_name REGEXP 'อบ|อาบ' THEN 4 WHEN st.health_med_treatment_subtype_name REGEXP 'ทับหม้อเกลือ' THEN 5 WHEN st.health_med_treatment_subtype_name REGEXP 'สมาธิบำบัด' THEN 6 ELSE 7 END) = 1, 'Y', NULL)) AS tm1,
              GROUP_CONCAT(DISTINCT IF(COALESCE(st.health_med_treatment_id, CASE WHEN st.health_med_treatment_subtype_name REGEXP 'ยา' THEN 1 WHEN st.health_med_treatment_subtype_name REGEXP 'นวด' THEN 2 WHEN st.health_med_treatment_subtype_name REGEXP 'ประคบ' THEN 3 WHEN st.health_med_treatment_subtype_name REGEXP 'อบ|อาบ' THEN 4 WHEN st.health_med_treatment_subtype_name REGEXP 'ทับหม้อเกลือ' THEN 5 WHEN st.health_med_treatment_subtype_name REGEXP 'สมาธิบำบัด' THEN 6 ELSE 7 END) = 2, 'Y', NULL)) AS tm2,
              GROUP_CONCAT(DISTINCT IF(COALESCE(st.health_med_treatment_id, CASE WHEN st.health_med_treatment_subtype_name REGEXP 'ยา' THEN 1 WHEN st.health_med_treatment_subtype_name REGEXP 'นวด' THEN 2 WHEN st.health_med_treatment_subtype_name REGEXP 'ประคบ' THEN 3 WHEN st.health_med_treatment_subtype_name REGEXP 'อบ|อาบ' THEN 4 WHEN st.health_med_treatment_subtype_name REGEXP 'ทับหม้อเกลือ' THEN 5 WHEN st.health_med_treatment_subtype_name REGEXP 'สมาธิบำบัด' THEN 6 ELSE 7 END) = 3, 'Y', NULL)) AS tm3,
              GROUP_CONCAT(DISTINCT IF(COALESCE(st.health_med_treatment_id, CASE WHEN st.health_med_treatment_subtype_name REGEXP 'ยา' THEN 1 WHEN st.health_med_treatment_subtype_name REGEXP 'นวด' THEN 2 WHEN st.health_med_treatment_subtype_name REGEXP 'ประคบ' THEN 3 WHEN st.health_med_treatment_subtype_name REGEXP 'อบ|อาบ' THEN 4 WHEN st.health_med_treatment_subtype_name REGEXP 'ทับหม้อเกลือ' THEN 5 WHEN st.health_med_treatment_subtype_name REGEXP 'สมาธิบำบัด' THEN 6 ELSE 7 END) = 4, 'Y', NULL)) AS tm4,
              GROUP_CONCAT(DISTINCT IF(COALESCE(st.health_med_treatment_id, CASE WHEN st.health_med_treatment_subtype_name REGEXP 'ยา' THEN 1 WHEN st.health_med_treatment_subtype_name REGEXP 'นวด' THEN 2 WHEN st.health_med_treatment_subtype_name REGEXP 'ประคบ' THEN 3 WHEN st.health_med_treatment_subtype_name REGEXP 'อบ|อาบ' THEN 4 WHEN st.health_med_treatment_subtype_name REGEXP 'ทับหม้อเกลือ' THEN 5 WHEN st.health_med_treatment_subtype_name REGEXP 'สมาธิบำบัด' THEN 6 ELSE 7 END) = 5, 'Y', NULL)) AS tm5,
              GROUP_CONCAT(DISTINCT IF(COALESCE(st.health_med_treatment_id, CASE WHEN st.health_med_treatment_subtype_name REGEXP 'ยา' THEN 1 WHEN st.health_med_treatment_subtype_name REGEXP 'นวด' THEN 2 WHEN st.health_med_treatment_subtype_name REGEXP 'ประคบ' THEN 3 WHEN st.health_med_treatment_subtype_name REGEXP 'อบ|อาบ' THEN 4 WHEN st.health_med_treatment_subtype_name REGEXP 'ทับหม้อเกลือ' THEN 5 WHEN st.health_med_treatment_subtype_name REGEXP 'สมาธิบำบัด' THEN 6 ELSE 7 END) = 6, 'Y', NULL)) AS tm6,
              GROUP_CONCAT(DISTINCT IF(COALESCE(st.health_med_treatment_id, CASE WHEN st.health_med_treatment_subtype_name REGEXP 'ยา' THEN 1 WHEN st.health_med_treatment_subtype_name REGEXP 'นวด' THEN 2 WHEN st.health_med_treatment_subtype_name REGEXP 'ประคบ' THEN 3 WHEN st.health_med_treatment_subtype_name REGEXP 'อบ|อาบ' THEN 4 WHEN st.health_med_treatment_subtype_name REGEXP 'ทับหม้อเกลือ' THEN 5 WHEN st.health_med_treatment_subtype_name REGEXP 'สมาธิบำบัด' THEN 6 ELSE 7 END) = 7, 'Y', NULL)) AS tm7,
              GROUP_CONCAT(DISTINCT st.health_med_treatment_subtype_name SEPARATOR ', ') AS treatment_names
            FROM health_med_service_treatment tt
            JOIN health_med_treatment_subtype st ON st.health_med_treatment_subtype_id = tt.health_med_treatment_subtype_id
            GROUP BY tt.health_med_service_id
          ) st_sub ON st_sub.health_med_service_id = s.health_med_service_id
          LEFT JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT(d.name, ' ', IFNULL(d.strength, ''), ' (', oo.qty, ' ', IFNULL(d.units, ''), ')') SEPARATOR ', ') AS herb_drugs,
              'Y' AS has_herb_drug
            FROM opitemrece oo
            JOIN drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (
                d.drugcategory REGEXP 'Thai|แผนไทย|แผนโบราณ|สมุนไพร'
                OR d.did LIKE '4%'
                OR d.nhso_adp_code REGEXP 'HERB'
              )
            GROUP BY oo.vn
          ) hd ON hd.vn = o.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN visit_pttype vi ON vi.vn = o.vn
          LEFT JOIN nhso_confirm_privilege cp ON cp.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
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
                   GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund,
                   GROUP_CONCAT(DISTINCT errorcode SEPARATOR ',') AS errorcode
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
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
            SELECT
              vn,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(payno, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS payno,
              SUM(IFNULL(compensated, 0)) AS compensated
            FROM rcmdb.seamless
            WHERE IFNULL(vn, '') <> '' AND rep REGEXP 'DTTM'
            GROUP BY vn
          ) sm ON sm.vn = o.vn
          WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
          ORDER BY o.vstdate DESC, o.vsttime DESC
        `,
          [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]
        );
        return rows;
      },
      refresh === 'true'
    );
    return reply.send({ success: true, data });
  });

  // ── 3. Thai Traditional Medicine: Topic 11 (32 Herbal Medicines) ──
  fastify.get('/api/v1/clinical/rcm/extra/ttm-topic11', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานแพทย์แผนไทย หัวข้อ 11 (ยาสมุนไพร 32 รายการ)' } }, async (request, reply) => {
    const { startDate, endDate, refresh } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(
      `rcm-extra-ttm11:${startDate}:${endDate}`,
      600000,
      async () => {
        const [rows] = await hosPool.query(
          `
          SELECT 
            o.vn,
            o.hn,
            IFNULL(o.an, '') AS an,
            IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            IFNULL(pt.sex, '') AS sex_code,
            DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(cp.nhso_authen_code), ''), NULLIF(TRIM(vs.auth_code), ''), NULLIF(TRIM(vs.claim_code), '')) AS auth_code,
            IFNULL(cp.nhso_authen_code, '') AS authen_endpoint,
            IFNULL(ptt.hipdata_code, '') AS hipdata_code,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            CONCAT(IFNULL(ptt.pttype, ''), ': ', IFNULL(ptt.name, '')) AS pttypename,
            IFNULL(dep.department, o.main_dep) AS department,
            IF(hm.hospcode IS NOT NULL, CONCAT(hm.hospcode, ' ', hm.name), v.hospmain) AS hospmain,
            IF(hs.hospcode IS NOT NULL, CONCAT(hs.hospcode, ' ', hs.name), v.hospsub) AS hospsub,
            v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            IFNULL(v.income, 0) AS income,
            GROUP_CONCAT(DISTINCT CONCAT(di.name, ' (', oo.qty, ' ', IFNULL(di.units, 'ชิ้น'), ')') SEPARATOR ', ') AS drug_names,
            GROUP_CONCAT(DISTINCT di.ttmt_code SEPARATOR ', ') AS ttmt_codes,
            SUM(oo.qty) AS total_qty,
            SUM(oo.qty * oo.unitprice) AS total_drug_amount,
            COUNT(DISTINCT di.icode) AS item_count,
            re.rep AS rep,
            re.compensated AS compensated,
            re.fund AS fund,
            re.subfund AS subfund,
            re.errorcode AS errorcode,
            rd.rep AS rep_invoice,
            rd.compensated AS compensated_invoice,
            COALESCE(rd.statusname, re.statusname, 'ยังไม่ได้ส่ง') AS status
          FROM ovst o
          JOIN opitemrece oo ON oo.vn = o.vn
          JOIN drugitems di ON di.icode = oo.icode
            AND di.ttmt_code IS NOT NULL AND TRIM(di.ttmt_code) <> ''
            AND di.sks_product_category_id IN (4, 3)
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN visit_pttype vs ON vs.vn = o.vn
          LEFT JOIN nhso_confirm_privilege cp ON cp.vn = o.vn
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN hospcode hm ON hm.hospcode = v.hospmain
          LEFT JOIN hospcode hs ON hs.hospcode = v.hospsub
          LEFT JOIN (
            SELECT 
              vn,
              GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
              SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
              IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: ส่ง Rep แล้ว', NULL) AS statusname,
              GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
              GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund,
              GROUP_CONCAT(DISTINCT errorcode SEPARATOR ',') AS errorcode
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY vn
          ) re ON re.vn = o.vn
          LEFT JOIN (
            SELECT 
              vn,
              GROUP_CONCAT(DISTINCT rep) AS rep,
              SUM(compensated) AS compensated,
              'NHSO :: ได้รับ Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn, '') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) rd ON rd.vn = o.vn
          WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
            AND ptt.hipdata_code IN ('UCS', 'WEL')
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC
        `,
          [startDate, endDate, startDate, endDate, startDate, endDate]
        );
        return rows;
      },
      refresh === 'true'
    );
    return reply.send({ success: true, data });
  });

  // ── 4. Thai Traditional Medicine: VN Herbal Drugs ──
  fastify.get('/api/v1/clinical/rcm/extra/ttm-vn-herbs/:vn', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายละเอียดรายการยาสมุนไพรของ Visit ตาม VN' } }, async (request, reply) => {
    const cleanVn = String(request.params?.vn || '').trim();
    if (!cleanVn) return reply.send({ success: true, data: [] });
    const [rows] = await hosPool.query(
      `
      SELECT 
        d.icode,
        CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) AS drug,
        d.name,
        d.strength,
        d.units,
        d.ttmt_code,
        d.did,
        d.sks_product_category_id AS category_id,
        oo.qty,
        oo.unitprice,
        (oo.qty * oo.unitprice) AS sumprice
      FROM opitemrece oo
      JOIN drugitems d ON oo.icode = d.icode
      WHERE oo.vn = ?
        AND (
          d.drugcategory REGEXP 'Thai|แผนไทย|แผนโบราณ|สมุนไพร'
          OR d.did LIKE '4%'
          OR d.nhso_adp_code REGEXP 'HERB'
          OR (d.ttmt_code IS NOT NULL AND TRIM(d.ttmt_code) <> '')
        )
      ORDER BY oo.item_no ASC
    `,
      [cleanVn]
    );
    return reply.send({ success: true, data: rows });
  });

  // ── 5. Thalassemia Fund: OPD ──
  fastify.get('/api/v1/clinical/rcm/extra/thalassemia-fund/opd', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานกองทุนโรคธาลัสซีเมีย ผู้ป่วยนอก (OPD)' } }, async (request, reply) => {
    const { startDate, endDate, refresh } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(
      `rcm-extra-thal-opd:${startDate}:${endDate}`,
      600000,
      async () => {
        const [rows] = await hosPool.query(
          `
          SELECT 
            t.vn,
            t.hn,
            t.cid,
            t.ptname,
            t.sex_code,
            t.birthday,
            t.age,
            t.vstdate,
            t.vsttime,
            t.maininscl,
            t.pttype_eclaim_id,
            t.pttypename,
            t.department,
            t.clinic,
            t.icd10,
            t.icd9,
            t.drugname,
            b.blood,
            b.blood_date,
            IFNULL(b.qty, 0) AS blood_qty,
            l.Ferritin_Result AS ferritin_result,
            l.Ferritin_date AS ferritin_date,
            l.Hb_Result AS hb_result,
            l.Hb_Date AS hb_date,
            l.Hct_Result AS hct_result,
            l.Hct_Date AS hct_date,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            r.rep AS seamless,
            COALESCE(NULLIF(nhso.rep, ''), NULLIF(re.rep, ''), NULLIF(nn.Rep, ''), NULLIF(m.rep, '')) AS rep,
            CASE
              WHEN NULLIF(nhso.rep, '') IS NOT NULL THEN 'NHSO :: มี Invoice แล้ว'
              WHEN NULLIF(re.rep, '') IS NOT NULL THEN 'Rep :: มี Rep แล้ว'
              WHEN NULLIF(nn.Rep, '') IS NOT NULL THEN IFNULL(nn.StatusName, 'E-Claim :: มี Rep แล้ว')
              WHEN m.statusname IS NOT NULL THEN m.statusname
              WHEN NULLIF(r.rep, '') IS NOT NULL THEN 'มี Seamless'
              ELSE 'รอส่งเบิก'
            END AS status,
            COALESCE(nhso.compensated, re.compensated, nn.Income, m.compensated, 0) AS compensated
          FROM (
            SELECT 
              o.vn,
              o.hn,
              IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
              IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              IFNULL(ptt.hipdata_code, '') AS maininscl,
              IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
              IFNULL(ptt.name, o.pttype) AS pttypename,
              IFNULL(dep.department, o.main_dep) AS department,
              IFNULL(spc.name, o.spclty) AS clinic,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'D56|D582', dx.icd10, NULL) ORDER BY dx.diagtype SEPARATOR ', ') AS icd10,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS icd9,
              GROUP_CONCAT(DISTINCT IF(d.name REGEXP 'Deferasirox|Deferipron|Desferrioxamin', CONCAT(d.name, ' ', IFNULL(d.strength, ''), ' #', oo.qty), NULL) SEPARATOR ', ') AS drugname
            FROM ovst o
            JOIN patient pt ON pt.hn = o.hn
            JOIN ovstdiag dx ON dx.vn = o.vn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
            LEFT JOIN spclty spc ON spc.spclty = o.spclty
            LEFT JOIN opitemrece oo ON oo.vn = o.vn
            LEFT JOIN drugitems d ON d.icode = oo.icode
            WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND dx.icd10 REGEXP 'D56|D582'
            GROUP BY o.vn
          ) t
          LEFT JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS blood,
              GROUP_CONCAT(DISTINCT DATE_FORMAT(oo.rxdate, '%Y-%m-%d') SEPARATOR ', ') AS blood_date,
              SUM(oo.qty) AS qty
            FROM opitemrece oo
            JOIN nondrugitems d ON d.icode = oo.icode
            WHERE d.nhso_adp_code LIKE '232%'
              AND oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY oo.vn
          ) b ON b.vn = t.vn
          LEFT JOIN (
            SELECT 
              lh.vn,
              GROUP_CONCAT(DISTINCT IF(l.lab_items_name REGEXP 'ferritin', lo.lab_order_result, NULL) SEPARATOR ', ') AS Ferritin_Result,
              GROUP_CONCAT(DISTINCT IF(l.lab_items_name REGEXP 'ferritin', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Ferritin_date,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621401', lo.lab_order_result, NULL) SEPARATOR ', ') AS Hb_Result,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621401', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Hb_Date,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621201', lo.lab_order_result, NULL) SEPARATOR ', ') AS Hct_Result,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621201', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Hct_Date
            FROM lab_head lh
            JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
            JOIN lab_items l ON l.lab_items_code = lo.lab_items_code
            WHERE (l.provis_labcode IN ('0621401', '0621201') OR l.lab_items_name REGEXP 'ferritin')
              AND lh.order_date >= ? AND lh.order_date < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY lh.vn
          ) l ON l.vn = t.vn
          LEFT JOIN rcmdb.authencode cc ON cc.vn = t.vn
          LEFT JOIN visit_pttype vt ON vt.vn = t.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT NULLIF(rep, '') ORDER BY rep SEPARATOR ', ') AS rep
            FROM rcmdb.seamless
            WHERE IFNULL(vn, '') <> ''
            GROUP BY vn
          ) r ON r.vn = t.vn
          LEFT JOIN (
            SELECT vn,
                   GROUP_CONCAT(DISTINCT NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, rep SEPARATOR ', ') AS rep,
                   SUM(IFNULL(compensated, 0)) AS compensated
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn, '') <> ''
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = t.vn
          LEFT JOIN (
            SELECT vn,
                   GROUP_CONCAT(DISTINCT NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, rep SEPARATOR ', ') AS rep,
                   SUM(IFNULL(compensated, 0)) AS compensated
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn, '') <> ''
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) re ON re.vn = t.vn
          LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = t.vn
          LEFT JOIN (
            SELECT m.opdseq AS vn,
                   SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(m.rep, '') ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                   SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
            FROM eclaimdb.m_registerdata m
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE m.person_type = '1' AND IFNULL(m.opdseq, '') <> ''
            GROUP BY m.opdseq
          ) m ON m.vn = t.vn
          WHERE (t.drugname IS NOT NULL OR b.vn IS NOT NULL)
          GROUP BY t.vn
          ORDER BY t.vstdate DESC, t.vsttime DESC
        `,
          [startDate, endDate, startDate, endDate, startDate, endDate]
        );
        return rows;
      },
      refresh === 'true'
    );
    return reply.send({ success: true, data });
  });

  // ── 6. Thalassemia Fund: IPD ──
  fastify.get('/api/v1/clinical/rcm/extra/thalassemia-fund/ipd', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานกองทุนโรคธาลัสซีเมีย ผู้ป่วยใน (IPD)' } }, async (request, reply) => {
    const { startDate, endDate, refresh } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(
      `rcm-extra-thal-ipd:${startDate}:${endDate}`,
      600000,
      async () => {
        const [rows] = await hosPool.query(
          `
          SELECT 
            t.an,
            t.hn,
            t.cid,
            t.ptname,
            t.sex_code,
            t.birthday,
            t.age,
            t.admdate,
            t.dchdate,
            t.maininscl,
            t.pttype_eclaim_id,
            t.pttypename,
            t.ward,
            t.icd10,
            t.icd9,
            t.drugname,
            b.blood,
            b.blood_date,
            IFNULL(b.qty, 0) AS blood_qty,
            l.Ferritin_Result AS ferritin_result,
            l.Ferritin_date AS ferritin_date,
            l.Hb_Result AS hb_result,
            l.Hb_Date AS hb_date,
            l.Hct_Result AS hct_result,
            l.Hct_Date AS hct_date,
            r.rep AS seamless,
            COALESCE(NULLIF(nhso.rep, ''), NULLIF(re.rep, ''), NULLIF(nn.Rep, ''), NULLIF(m.rep, '')) AS rep,
            CASE
              WHEN NULLIF(nhso.rep, '') IS NOT NULL THEN 'NHSO :: มี Invoice แล้ว'
              WHEN NULLIF(re.rep, '') IS NOT NULL THEN 'Rep :: มี Rep แล้ว'
              WHEN NULLIF(nn.Rep, '') IS NOT NULL THEN IFNULL(nn.StatusName, 'E-Claim :: มี Rep แล้ว')
              WHEN m.statusname IS NOT NULL THEN m.statusname
              WHEN NULLIF(r.rep, '') IS NOT NULL THEN 'มี Seamless'
              ELSE 'รอส่งเบิก'
            END AS status,
            COALESCE(nhso.compensated, re.compensated, nn.Income, m.compensated, 0) AS compensated
          FROM (
            SELECT 
              i.an,
              i.hn,
              IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
              IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.dchdate), 0) AS age,
              DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
              DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
              IFNULL(ptt.hipdata_code, '') AS maininscl,
              IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
              IFNULL(ptt.name, i.pttype) AS pttypename,
              IFNULL(w.name, i.ward) AS ward,
              GROUP_CONCAT(DISTINCT dx.icd10 ORDER BY dx.diagtype SEPARATOR ', ') AS icd10,
              GROUP_CONCAT(DISTINCT op.icd9 SEPARATOR ', ') AS icd9,
              GROUP_CONCAT(DISTINCT IF(d.name REGEXP 'Deferasirox|Deferipron|Desferrioxamin', CONCAT(d.name, ' ', IFNULL(d.strength, ''), ' #', oo.qty), NULL) SEPARATOR ', ') AS drugname
            FROM ipt i
            JOIN patient pt ON pt.hn = i.hn
            JOIN iptdiag dx ON dx.an = i.an
            LEFT JOIN iptoprt op ON op.an = i.an
            LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
            LEFT JOIN ward w ON w.ward = i.ward
            LEFT JOIN opitemrece oo ON oo.an = i.an
            LEFT JOIN drugitems d ON d.icode = oo.icode
            WHERE i.dchdate >= ? AND i.dchdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND dx.icd10 REGEXP 'D56|D582'
            GROUP BY i.an
          ) t
          LEFT JOIN (
            SELECT 
              oo.an,
              GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS blood,
              GROUP_CONCAT(DISTINCT DATE_FORMAT(oo.rxdate, '%Y-%m-%d') SEPARATOR ', ') AS blood_date,
              SUM(oo.qty) AS qty
            FROM opitemrece oo
            JOIN nondrugitems d ON d.icode = oo.icode
            WHERE d.nhso_adp_code LIKE '232%'
              AND oo.an IS NOT NULL
            GROUP BY oo.an
          ) b ON b.an = t.an
          LEFT JOIN (
            SELECT 
              lh.vn AS an,
              GROUP_CONCAT(DISTINCT IF(l.lab_items_name REGEXP 'ferritin', lo.lab_order_result, NULL) SEPARATOR ', ') AS Ferritin_Result,
              GROUP_CONCAT(DISTINCT IF(l.lab_items_name REGEXP 'ferritin', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Ferritin_date,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621401', lo.lab_order_result, NULL) SEPARATOR ', ') AS Hb_Result,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621401', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Hb_Date,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621201', lo.lab_order_result, NULL) SEPARATOR ', ') AS Hct_Result,
              GROUP_CONCAT(DISTINCT IF(l.provis_labcode = '0621201', DATE_FORMAT(lh.order_date, '%Y-%m-%d'), NULL) SEPARATOR ', ') AS Hct_Date
            FROM lab_head lh
            JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
            JOIN lab_items l ON l.lab_items_code = lo.lab_items_code
            WHERE (l.provis_labcode IN ('0621401', '0621201') OR l.lab_items_name REGEXP 'ferritin')
            GROUP BY lh.vn
          ) l ON l.an = t.an
          LEFT JOIN (
            SELECT an, GROUP_CONCAT(DISTINCT NULLIF(rep, '') ORDER BY rep SEPARATOR ', ') AS rep
            FROM rcmdb.seamless
            WHERE IFNULL(an, '') <> ''
            GROUP BY an
          ) r ON r.an = t.an
          LEFT JOIN (
            SELECT an,
                   GROUP_CONCAT(DISTINCT NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, rep SEPARATOR ', ') AS rep,
                   SUM(IFNULL(compensated, 0)) AS compensated
            FROM rcmdb.repeclaim
            WHERE department = 'IP' AND IFNULL(an, '') <> ''
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY an
          ) nhso ON nhso.an = t.an
          LEFT JOIN (
            SELECT an,
                   GROUP_CONCAT(DISTINCT NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, rep SEPARATOR ', ') AS rep,
                   SUM(IFNULL(compensated, 0)) AS compensated
            FROM rcmdb.repdata
            WHERE department = 'IP' AND IFNULL(an, '') <> ''
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY an
          ) re ON re.an = t.an
          LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = t.an
          LEFT JOIN (
            SELECT m.an,
                   SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(m.rep, '') ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                   SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
            FROM eclaimdb.m_registerdata m
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE m.person_type = '2' AND IFNULL(m.an, '') <> ''
            GROUP BY m.an
          ) m ON m.an = t.an
          WHERE (t.icd9 REGEXP '9904' OR t.drugname IS NOT NULL OR b.an IS NOT NULL)
          GROUP BY t.an
          ORDER BY t.dchdate DESC, t.admdate DESC
        `,
          [startDate, endDate]
        );
        return rows;
      },
      refresh === 'true'
    );
    return reply.send({ success: true, data });
  });

  // ── 7. Thalassemia Fund: AN Clinical Details ──
  fastify.get('/api/v1/clinical/rcm/extra/thalassemia-fund/an-details/:an', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายละเอียดผู้ป่วยในกองทุนธาลัสซีเมียตาม AN' } }, async (request, reply) => {
    const cleanAn = String(request.params?.an || '').trim();
    if (!cleanAn) {
      return reply.code(400).send({ success: false, error: 'an is required' });
    }
    const [[headerRows], [diagRows], [oprtRows], [orderRows]] = await Promise.all([
      hosPool.query(
        `
        SELECT 
          i.an, i.hn, IFNULL(pt.cid, '') AS cid,
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
        WHERE i.an = ?
        LIMIT 1
      `,
        [cleanAn]
      ),
      hosPool.query(
        `
        SELECT 
          d.icd10,
          IFNULL(ic.name, d.icd10) AS icd_name,
          IFNULL(d.diagtype, '') AS diagtype,
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
        WHERE d.an = ?
        ORDER BY d.diagtype ASC, d.ipt_diag_id ASC
      `,
        [cleanAn]
      ),
      hosPool.query(
        `
        SELECT 
          op.icd9,
          IFNULL(ic9.name, op.icd9) AS icd9_name,
          DATE_FORMAT(op.opdate, '%Y-%m-%d') AS opdate,
          IFNULL(doc.name, '') AS doctor_name
        FROM iptoprt op
        LEFT JOIN icd9cm1 ic9 ON ic9.code = op.icd9
        LEFT JOIN doctor doc ON doc.code = op.doctor
        WHERE op.an = ?
        ORDER BY op.opdate ASC
      `,
        [cleanAn]
      ),
      hosPool.query(
        `
        SELECT 
          o.icode,
          COALESCE(d.name, nd.name, o.icode) AS item_name,
          d.strength,
          d.units,
          IFNULL(o.qty, 0) AS qty,
          IFNULL(o.unitprice, 0) AS unitprice,
          IFNULL(o.sum_price, 0) AS sum_price,
          IFNULL(pst.name, o.paidst) AS paidst_name,
          IFNULL(inc.name, o.income) AS income_name,
          IF(d.icode IS NOT NULL, 1, 0) AS is_drug
        FROM opitemrece o
        LEFT JOIN s_drugitems d ON d.icode = o.icode
        LEFT JOIN nondrugitems nd ON nd.icode = o.icode
        LEFT JOIN paidst pst ON pst.paidst = o.paidst
        LEFT JOIN income inc ON inc.income = o.income
        WHERE o.an = ?
        ORDER BY o.income ASC, o.item_no ASC, o.icode ASC
      `,
        [cleanAn]
      ),
    ]);
    return reply.send({ success: true, data: { headerRows, diagRows, oprtRows, orderRows } });
  });

  // ── 8. Thalassemia in Pregnancy (3.1): ADP Mapping & Report ──
  const getThalassemiaPregnancyAdpMapping = async (refresh = false) =>
    withCache(
      'rcm-extra-thal-preg-adp',
      600000,
      async () => {
        const [rows] = await hosPool.query(`
          SELECT icode, name, strength, nhso_adp_code
          FROM s_drugitems
          WHERE nhso_adp_code IN ('30313', '37532')
          ORDER BY nhso_adp_code ASC, icode ASC
        `);
        const items = (rows || []).map((r) => ({
          icode: String(r.icode || ''),
          name: String(r.name || ''),
          strength: r.strength ? String(r.strength) : null,
          nhso_adp_code: String(r.nhso_adp_code || ''),
        }));
        return { isMapped: items.length > 0, mappedCount: items.length, items };
      },
      refresh
    );

  fastify.get('/api/v1/clinical/rcm/extra/thalassemia-pregnancy/adp-mapping', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'ตรวจสอบ ADP Mapping คัดกรองธาลัสซีเมียในหญิงตั้งครรภ์ (3.1)' } }, async (request, reply) => {
    const data = await getThalassemiaPregnancyAdpMapping(request.query?.refresh === 'true');
    return reply.send({ success: true, data });
  });

  fastify.get('/api/v1/clinical/rcm/extra/thalassemia-pregnancy/report', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานบริการคัดกรองธาลัสซีเมียในหญิงตั้งครรภ์ (3.1)' } }, async (request, reply) => {
    const { startDate, endDate, refresh } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const isRefresh = refresh === 'true';
    const [adpMapping, rawRows] = await Promise.all([
      getThalassemiaPregnancyAdpMapping(isRefresh),
      withCache(
        `rcm-extra-thal-preg:${startDate}:${endDate}`,
        300000,
        async () => {
          const [rows] = await hosPool.query(
            `
            SELECT 
              p.person_id,
              anc.person_anc_id AS ancno,
              IFNULL(p.cid, '') AS cid,
              IFNULL(p.patient_hn, '') AS hn,
              CONCAT(IFNULL(p.pname,''), IFNULL(p.fname,''), ' ', IFNULL(p.lname,'')) AS ptname,
              IFNULL(TIMESTAMPDIFF(YEAR, p.birthdate, anc.labor_date), 0) AS age,
              IFNULL(ptt.name, p.pttype) AS pttypename,
              ptt.pttype_eclaim_id,
              CONCAT_WS(' ', pt.addrpart, IF(pt.moopart IS NOT NULL AND pt.moopart != '', CONCAT('ม.', pt.moopart), NULL), pt.road) AS address,
              DATE_FORMAT(anc.labor_date, '%Y-%m-%d') AS labor_date,
              IFNULL(plt.person_labour_type_name, 'NORMAL') AS labor_type,
              anc.labour_type_id,
              IFNULL(h.name, anc.labour_hospcode) AS hospital,
              anc.labour_hospcode,
              anc.preg_no,
              DATE_FORMAT(anc.lmp, '%Y-%m-%d') AS lmp,
              DATE_FORMAT(anc.edc, '%Y-%m-%d') AS edc,
              l.labcode,
              l.labname,
              l.labresult,
              l.lab_order_date,
              ord.ordered_adp_items
            FROM person_anc anc
            JOIN person p ON p.person_id = anc.person_id
            LEFT JOIN patient pt ON pt.hn = p.patient_hn
            LEFT JOIN pttype ptt ON ptt.pttype = p.pttype
            LEFT JOIN person_labour_type plt ON plt.person_labour_type_id = anc.labour_type_id
            LEFT JOIN hospcode h ON h.hospcode = anc.labour_hospcode
            LEFT JOIN (
              SELECT 
                lh.hn,
                GROUP_CONCAT(DISTINCT lo.lab_items_code SEPARATOR ', ') AS labcode,
                GROUP_CONCAT(DISTINCT lo.lab_items_name_ref SEPARATOR ', ') AS labname,
                GROUP_CONCAT(DISTINCT CONCAT(lo.lab_items_name_ref, ': ', IFNULL(lo.lab_order_result, 'รอผล')) SEPARATOR ' | ') AS labresult,
                MAX(DATE_FORMAT(lh.order_date, '%Y-%m-%d')) AS lab_order_date
              FROM lab_head lh
              JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
              WHERE lh.order_date >= DATE_SUB(?, INTERVAL 1 YEAR) AND lh.order_date < DATE_ADD(?, INTERVAL 1 DAY)
                AND (lo.lab_items_name_ref REGEXP 'hemoglobin|thalass' OR lo.lab_items_name_ref = 'DCIP' OR lo.lab_items_name_ref = 'OF')
              GROUP BY lh.hn
            ) l ON l.hn = p.patient_hn
            LEFT JOIN (
              SELECT 
                o.hn,
                GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') AS ordered_adp_items
              FROM opitemrece o
              JOIN s_drugitems d ON d.icode = o.icode
              WHERE d.nhso_adp_code IN ('30313', '37532')
                AND o.vstdate >= DATE_SUB(?, INTERVAL 1 YEAR) AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
              GROUP BY o.hn
            ) ord ON ord.hn = p.patient_hn
            WHERE anc.labor_date >= ? AND anc.labor_date < DATE_ADD(?, INTERVAL 1 DAY)
              AND p.sex = '2'
            GROUP BY anc.person_anc_id
            ORDER BY anc.labor_date DESC
          `,
            [startDate, endDate, startDate, endDate, startDate, endDate]
          );
          return rows;
        },
        isRefresh
      ),
    ]);
    return reply.send({ success: true, data: { adpMapping, rawRows } });
  });

  // ── 9. Viral Hepatitis B (23.1, ADP 36318, 36319): ADP Mapping & Report ──
  const getViralHepatitisAdpMapping = async (refresh = false) =>
    withCache(
      'rcm-extra-vhb-adp',
      600000,
      async () => {
        try {
          const [rows] = await hosPool.query(`
            SELECT icode, name, strength, nhso_adp_code, 's_drugitems' AS source
            FROM s_drugitems
            WHERE TRIM(nhso_adp_code) IN ('36318', '36319')
            UNION
            SELECT icode, name, NULL AS strength, nhso_adp_code, 'nondrugitems' AS source
            FROM nondrugitems
            WHERE TRIM(nhso_adp_code) IN ('36318', '36319')
            ORDER BY nhso_adp_code ASC, icode ASC
          `);
          const items = (rows || []).map((r) => ({
            icode: String(r.icode || '').trim(),
            name: String(r.name || '').trim(),
            strength: r.strength ? String(r.strength).trim() : null,
            nhso_adp_code: String(r.nhso_adp_code || '').trim(),
            source: r.source === 'nondrugitems' ? 'nondrugitems' : 's_drugitems',
          }));
          return { isMapped: items.length > 0, mappedCount: items.length, items };
        } catch {
          return { isMapped: false, mappedCount: 0, items: [] };
        }
      },
      refresh
    );

  fastify.get('/api/v1/clinical/rcm/extra/viral-hepatitis/adp-mapping', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'ตรวจสอบ ADP Mapping ไวรัสตับอักเสบบี (23.1 ADP 36318, 36319)' } }, async (request, reply) => {
    const data = await getViralHepatitisAdpMapping(request.query?.refresh === 'true');
    return reply.send({ success: true, data });
  });

  fastify.get('/api/v1/clinical/rcm/extra/viral-hepatitis/report', { schema: { tags: ['05. RCM — Funds & REP Reconcile'], summary: 'รายงานบริการตรวจ/รักษาไวรัสตับอักเสบบี (23.1)' } }, async (request, reply) => {
    const { startDate, endDate, refresh } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const isRefresh = refresh === 'true';
    const [adpMapping, rawRows] = await Promise.all([
      getViralHepatitisAdpMapping(isRefresh),
      withCache(
        `rcm-extra-vhb:${startDate}:${endDate}`,
        180000,
        async () => {
          const [rows] = await hosPool.query(
            `
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
              ptt.name AS pttypename,
              ptt.pttype_eclaim_id,
              dep.department AS department,
              spc.name AS clinic,
              IFNULL(s.cc, '') AS cc,
              v.pdx,
              v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              IFNULL(v.income, 0) AS income,
              dd.name AS listname,
              l.labresult AS labresult,
              CASE
                WHEN sm.vn IS NOT NULL THEN CONCAT(sm.status, ' Seamless')
                WHEN nhso.statusname IS NOT NULL THEN nhso.statusname
                WHEN cf.vn IS NOT NULL THEN 'KTB :: ส่งแล้ว'
                WHEN rep.statusname IS NOT NULL THEN rep.statusname
                WHEN nn.StatusName IS NOT NULL THEN nn.StatusName
                WHEN m.statusname IS NOT NULL THEN m.statusname
                ELSE '-::ยังไม่ได้ส่ง'
              END AS status,
              COALESCE(
                NULLIF(TRIM(sm.rep), ''),
                NULLIF(TRIM(nhso.rep), ''),
                NULLIF(TRIM(rep.rep), ''),
                NULLIF(TRIM(nn.Rep), ''),
                NULLIF(TRIM(m.rep), '')
              ) AS rep,
              CASE
                WHEN sm.vn IS NOT NULL AND sm.compensated > 0 THEN sm.compensated
                WHEN nhso.vn IS NOT NULL AND nhso.compensated > 0 THEN nhso.compensated
                WHEN rep.vn IS NOT NULL AND rep.compensated > 0 THEN rep.compensated
                WHEN nn.Seq IS NOT NULL AND nn.Income > 0 THEN nn.Income
                WHEN m.vn IS NOT NULL AND m.compensated > 0 THEN m.compensated
                ELSE COALESCE(sm.compensated, nhso.compensated, rep.compensated, nn.Income, m.compensated, 0)
              END AS compensated,
              sm.status AS status_sm,
              sm.rep AS rep_sm,
              sm.compensated AS compensated_sm,
              pt.informaddr AS address,
              pt.mobile_phone_number AS mobile,
              CONCAT_WS(' ', NULLIF(pt.informtel, ''), NULLIF(pt.hometel, '')) AS tel,
              rep.fund,
              rep.subfund
            FROM (
              SELECT 
                oo.vn,
                GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
              FROM opitemrece oo
              JOIN (
                SELECT icode, name, strength 
                FROM s_drugitems 
                WHERE TRIM(nhso_adp_code) IN ('36318', '36319')
                UNION
                SELECT icode, name, NULL AS strength 
                FROM nondrugitems 
                WHERE TRIM(nhso_adp_code) IN ('36318', '36319')
              ) d ON d.icode = oo.icode
              WHERE IFNULL(oo.vn, '') <> ''
                AND oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
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
              JOIN nondrugitems d ON d.icode = l.icode 
              WHERE lh.order_date >= ? AND lh.order_date < DATE_ADD(?, INTERVAL 1 DAY)
                AND TRIM(d.nhso_adp_code) IN ('36318', '36319')
              GROUP BY lh.vn
            ) l ON l.vn = o.vn
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
                     GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
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
              SELECT 
                vn,
                SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY vn), ',', 1) AS status,
                SUBSTRING_INDEX(GROUP_CONCAT(rep ORDER BY vn), ',', 1) AS rep,
                SUM(compensated) AS compensated
              FROM rcmdb.seamless
              WHERE IFNULL(vn, '') <> ''
              GROUP BY vn
            ) sm ON sm.vn = o.vn
            LEFT JOIN (
              SELECT vn
              FROM rcmdb.ktb_confirm
              WHERE IFNULL(vn, '') <> ''
              GROUP BY vn
            ) cf ON cf.vn = o.vn
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC
          `,
            [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]
          );
          return rows;
        },
        isRefresh
      ),
    ]);
    return reply.send({ success: true, data: { adpMapping, rawRows } });
  });
}
