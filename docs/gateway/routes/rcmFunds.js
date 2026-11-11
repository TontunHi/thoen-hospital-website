/**
 * RCM Clinical Funds Routes (HOSxP 192.168.1.4)
 * Dedicated Named REST APIs for Specific Disease & Drug Compensation Funds
 * Eliminates Raw SQL queries across HTTP for RCM Clinical Dashboards.
 */

export default async function rcmFundsRoutes(fastify, options) {
  const { pools, getCached } = options
  const { hosPool } = pools

  // ------------------------------------------------------------------
  // 1. Universal ADP Mapping Check
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/adp-mapping/:adpCode', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ตรวจสอบการแมปรายการยากับรหัส ADP ของ สปสช.',
      params: {
        type: 'object',
        required: ['adpCode'],
        properties: { adpCode: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const { adpCode } = req.params
    const cleanAdpCode = (adpCode || '').trim()
    if (!cleanAdpCode) {
      reply.code(400); return { success: false, error: 'ADP code required' }
    }

    try {
      const cacheKey = `rcm-adp-mapping-${cleanAdpCode}`
      const data = await getCached(cacheKey, 3600000, async () => {
        const codes = cleanAdpCode.split(',').map(s => s.trim()).filter(Boolean)
        const placeholders = codes.map(() => '?').join(',')
        const [rows] = await hosPool.query(`
          SELECT d.icode, d.name, d.strength, d.nhso_adp_code
          FROM s_drugitems d
          WHERE d.nhso_adp_code IN (${placeholders})
            AND (d.istatus = 'Y' OR d.istatus IS NULL)
          ORDER BY d.nhso_adp_code ASC, d.name ASC;
        `, codes)

        return {
          adpCode: cleanAdpCode,
          isMapped: rows.length > 0,
          mappedCount: rows.length,
          items: rows || []
        }
      })

      return { success: true, ...data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // Helper to extract ds1, ds2
  // ------------------------------------------------------------------
  function getRange(query) {
    const now = new Date().toISOString().slice(0, 10)
    const ds1 = query?.startDate || query?.ds1 || now
    const ds2 = query?.endDate || query?.ds2 || ds1
    return { ds1, ds2 }
  }

  function getFiscalYearStart(dateStr) {
    const parts = (dateStr || '').split('-')
    if (parts.length < 2) return dateStr
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const startY = m >= 10 ? y : y - 1
    return `${startY}-10-01`
  }

  // ------------------------------------------------------------------
  // 2. Dental Implant (รากฟันเทียม DENSUR)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/dental-implant', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการกองทุนรากฟันเทียม (DENSUR) อายุ 25-59 ปี',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          adpCode: { type: 'string', default: 'DENSUR' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const adpCode = (req.query?.adpCode || 'DENSUR').trim()
    const cacheKey = `rcm-fund-densur-${ds1}-${ds2}-${adpCode}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
        const sql = `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            pt.sex AS sex_code,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            nat.name AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            o.vsttime,
            IFNULL(cc.AuthenCode, '') AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            dep.department,
            spc.name AS clinic,
            dd.name AS listname,
            v.pdx,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, 'ยังไม่ได้ส่ง') AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep, '') AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
            re.fund,
            re.subfund,
            COALESCE(nhso.errorcode, rep.errorcode, '') AS errorcode,
            COALESCE(nhso.transactiontype, rep.transactiontype, '') AS transactiontype,
            COALESCE(nhso.agency, rep.agency, '') AS agency
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE IFNULL(oo.vn, '') <> ''
              AND oo.vstdate BETWEEN ? AND ?
              AND TRIM(d.nhso_adp_code) = ?
            GROUP BY oo.vn
          ) dd ON dd.vn = o.vn
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN (
            SELECT vn,
                   GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
                   SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
                   IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'NHSO :: มี Invoice แล้ว', NULL) AS statusname,
                   GROUP_CONCAT(DISTINCT agency SEPARATOR ',') AS agency,
                   GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund,
                   GROUP_CONCAT(DISTINCT errorcode SEPARATOR ',') AS errorcode,
                   GROUP_CONCAT(DISTINCT transactiontype SEPARATOR ',') AS transactiontype
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
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
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
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
            WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> '' AND m.dateadm BETWEEN ? AND ?
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
            GROUP BY vn
          ) re ON re.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
            AND (
              v.age_y BETWEEN 25 AND 59 
              OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) BETWEEN 25 AND 59
            )
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC;
        `
        const sqlParams = [
          ds1, ds2, adpCode,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2
        ]
        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey: 'dental-implant', data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 3. Fluoride Varnish (เคลือบฟลูออไรด์ 15001)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/fluoride-varnish', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001)',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          adpCode: { type: 'string', default: '15001' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const adpCode = (req.query?.adpCode || '15001').trim()
    const cacheKey = `rcm-fund-fluoride-${ds1}-${ds2}-${adpCode}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
        const sql = `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            pt.sex AS sex_code,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            nat.name AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            o.vsttime,
            IFNULL(cc.AuthenCode, '') AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            dep.department,
            spc.name AS clinic,
            dd.name AS listname,
            v.pdx,
            v.income,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, 'ยังไม่ได้ส่ง') AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep, '') AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
            re.fund,
            re.subfund
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE IFNULL(oo.vn, '') <> ''
              AND oo.vstdate BETWEEN ? AND ?
              AND TRIM(d.nhso_adp_code) = ?
            GROUP BY oo.vn
          ) dd ON dd.vn = o.vn
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'NHSO :: มี Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'Rep :: มี Rep แล้ว' AS statusname
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) rep ON rep.vn = o.vn
          LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
            GROUP BY vn
          ) re ON re.vn = o.vn
          LEFT JOIN (
            SELECT m.opdseq AS vn,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                   SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
            FROM eclaimdb.m_registerdata m
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> '' AND m.dateadm BETWEEN ? AND ?
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
            AND (
              v.age_y BETWEEN 25 AND 59
              OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) BETWEEN 25 AND 59
            )
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC;
        `
        const sqlParams = [
          ds1, ds2, adpCode,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2
        ]
        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey: 'fluoride-varnish', data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 4. Oral Cancer Screening (คัดกรองมะเร็งช่องปาก 90004)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/oral-cancer', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการคัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก (90004) อายุ >= 40 ปี',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          adpCode: { type: 'string', default: '90004' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const adpCode = (req.query?.adpCode || '90004').trim()
    const cacheKey = `rcm-fund-oral-cancer-${ds1}-${ds2}-${adpCode}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
        const sql = `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            pt.sex AS sex_code,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            nat.name AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            o.vsttime,
            IFNULL(cc.AuthenCode, '') AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            dep.department,
            spc.name AS clinic,
            dd.name AS listname,
            v.pdx,
            v.income,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, 'ยังไม่ได้ส่ง') AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep, '') AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
            re.fund,
            re.subfund
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) SEPARATOR ', ') AS name
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE IFNULL(oo.vn, '') <> ''
              AND oo.vstdate BETWEEN ? AND ?
              AND TRIM(d.nhso_adp_code) IN (?)
            GROUP BY oo.vn
          ) dd ON dd.vn = o.vn
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'NHSO :: มี Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'Rep :: มี Rep แล้ว' AS statusname
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) rep ON rep.vn = o.vn
          LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
            GROUP BY vn
          ) re ON re.vn = o.vn
          LEFT JOIN (
            SELECT m.opdseq AS vn,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                   SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
            FROM eclaimdb.m_registerdata m
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> '' AND m.dateadm BETWEEN ? AND ?
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
            AND IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) >= 40
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC;
        `
        const sqlParams = [
          ds1, ds2, adpCode,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2
        ]
        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey: 'oral-cancer', data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 5. Streptokinase Thrombolysis (OPD / IPD)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/streptokinase', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการกองทุนยา Streptokinase สำหรับผู้ป่วยกล้ามเนื้อหัวใจขาดเลือดเฉียบพลัน',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          patientType: { type: 'string', enum: ['OPD', 'IPD'], default: 'OPD' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const patientType = (req.query?.patientType || 'OPD').toUpperCase()
    const cacheKey = `rcm-fund-streptokinase-${patientType}-${ds1}-${ds2}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
        let sql = ''
        if (patientType === 'IPD') {
          sql = `
            SELECT 
              i.an,
              i.vn,
              pt.hn,
              IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
              pt.sex AS sex_code,
              IFNULL(a.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, i.dchdate)) AS age,
              DATE_FORMAT(i.regdate, '%Y-%m-%d') AS date,
              i.regtime AS time,
              DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
              CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) AS drugname,
              op.sum_price AS money_hosxp,
              a.income AS debit,
              COALESCE(rep.compensated, nn.Income, m.compensated, 0) AS money_rep,
              COALESCE(rep.rep, nn.Rep, m.rep, '') AS rep,
              COALESCE(rep.statusname, nn.StatusName, m.statusname, 'ยังไม่ได้ส่ง') AS status
            FROM ipt i
            LEFT JOIN patient pt ON pt.hn = i.hn
            LEFT JOIN an_stat a ON a.an = i.an
            JOIN opitemrece op ON op.an = i.an
            JOIN s_drugitems d ON d.icode = op.icode
            LEFT JOIN (
              SELECT an, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'IP' AND IFNULL(an,'') <> '' AND dchdate BETWEEN ? AND ?
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY an
            ) rep ON rep.an = i.an
            LEFT JOIN rcmdb.neweclaim nn ON nn.an = i.an
            LEFT JOIN (
              SELECT m.an,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                     SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
              FROM eclaimdb.m_registerdata m
              LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
              WHERE m.person_type = '1' AND IFNULL(m.an,'') <> '' AND m.datedch BETWEEN ? AND ?
              GROUP BY m.an
            ) m ON m.an = i.an
            WHERE i.dchdate BETWEEN ? AND ?
              AND (
                TRIM(d.nhso_adp_code) IN ('STK', 'STREPT')
                OR d.name LIKE '%Streptokinase%'
              )
            GROUP BY i.an, op.icode
            ORDER BY i.dchdate ASC;
          `
        } else {
          sql = `
            SELECT 
              o.vn,
              pt.hn,
              IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
              pt.sex AS sex_code,
              IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS date,
              o.vsttime AS time,
              CONCAT_WS(' ', d.name, NULLIF(d.strength, '')) AS drugname,
              op.sum_price AS money_hosxp,
              v.income AS debit,
              COALESCE(rep.compensated, nn.Income, m.compensated, 0) AS money_rep,
              COALESCE(rep.rep, nn.Rep, m.rep, '') AS rep,
              COALESCE(rep.statusname, nn.StatusName, m.statusname, 'ยังไม่ได้ส่ง') AS status
            FROM ovst o
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            JOIN opitemrece op ON op.vn = o.vn
            JOIN s_drugitems d ON d.icode = op.icode
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
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
            WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> '' AND m.dateadm BETWEEN ? AND ?
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
            AND (
              TRIM(d.nhso_adp_code) IN ('STK', 'STREPT')
              OR d.name LIKE '%Streptokinase%'
            )
          GROUP BY o.vn, op.icode
          ORDER BY o.vstdate ASC;
        `
        }

        const sqlParams = [ds1, ds2, ds1, ds2, ds1, ds2]
        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey: 'streptokinase', data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 5. Telemed Drug (11.53 รายชื่อผู้ได้รับบริการ TelMed)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/telemed-drug', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการกองทุนระบบ Telemedicine & Drug (TELMED/export_code 5)',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          adpCode: { type: 'string', default: 'TELMED' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const adpCode = (req.query?.adpCode || 'TELMED').trim()
    const cacheKey = `rcm-fund-telemed-${ds1}-${ds2}-${adpCode}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
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
            CONCAT_WS(':', ov.export_code, ov.name) AS ovstist,
            IFNULL(ov.export_code, '') AS ovstist_export_code,
            cc.AuthenCode AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
            o.hospmain,
            o.hospsub,
            dep.department AS department,
            spc.name AS clinic,
            v.pdx,
            IFNULL(v.income, 0) AS income,
            IFNULL(telmed_items.sum_price, 0) AS sum_price,
            telmed_items.listname,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-:ยังไม่ได้ส่ง') AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
            rep.fund,
            rep.subfund
          FROM (
            SELECT DISTINCT vn FROM (
              SELECT oo.vn
              FROM opitemrece oo
              JOIN s_drugitems s ON s.icode = oo.icode
              WHERE TRIM(s.nhso_adp_code) = ?
                AND oo.vstdate BETWEEN ? AND ?
              UNION
              SELECT o_sub.vn
              FROM ovst o_sub
              JOIN ovstist ov_sub ON ov_sub.ovstist = o_sub.ovstist
              WHERE ov_sub.export_code = '5'
                AND o_sub.vstdate BETWEEN ? AND ?
            ) qualifying_vns
          ) q
          JOIN ovst o ON o.vn = q.vn
          LEFT JOIN ovstist ov ON ov.ovstist = o.ovstist
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN (
            SELECT 
              oo.vn,
              SUM(oo.sum_price) AS sum_price,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', s.name, NULLIF(s.strength, '')) SEPARATOR ', ') AS listname
            FROM opitemrece oo
            JOIN s_drugitems s ON s.icode = oo.icode
            WHERE TRIM(s.nhso_adp_code) = ?
              AND oo.vstdate BETWEEN ? AND ?
            GROUP BY oo.vn
          ) telmed_items ON telmed_items.vn = o.vn
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
          WHERE o.vstdate BETWEEN ? AND ?
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC;
        `
        const sqlParams = [
          adpCode, ds1, ds2,
          ds1, ds2,
          adpCode, ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2
        ]
        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey: 'telemed-drug', data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 5.1. Pregnancy Test (8.1 การทดสอบการตั้งครรภ์ ADP 31101, 30014)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/pregnancy-test', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการการทดสอบการตั้งครรภ์ (8.1) ADP 31101, 30014',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const cacheKey = `rcm-fund-pregnancy-test-${ds1}-${ds2}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
        const sql = `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
            ptt.pttype_eclaim_id AS pttype_eclaim_id,
            dep.department AS department,
            spc.name AS clinic,
            v.pdx,
            CONCAT_WS(', ', NULLIF(v.dx0, ''), NULLIF(v.dx1, ''), NULLIF(v.dx2, ''), NULLIF(v.dx3, ''), NULLIF(v.dx4, ''), NULLIF(v.dx5, '')) AS sdx,
            IFNULL(v.income, 0) AS income,
            dd.labname AS drug_labname,
            dd.name AS listname,
            lo.lab_order_result AS lab_order_result,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-:ยังไม่ได้ส่ง') AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
            re.fund,
            re.subfund
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(IF(TRIM(d.nhso_adp_code) = '31101', CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS labname,
              GROUP_CONCAT(IF(TRIM(d.nhso_adp_code) = '30014', CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS name
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE IFNULL(oo.vn, '') <> ''
              AND oo.vstdate BETWEEN ? AND ?
              AND TRIM(d.nhso_adp_code) IN ('31101', '30014')
            GROUP BY oo.vn
          ) dd ON dd.vn = o.vn
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN visit_pttype vt ON vt.vn = o.vn
          LEFT JOIN (
            SELECT 
              lh.vn,
              GROUP_CONCAT(DISTINCT lo.lab_order_result SEPARATOR ', ') AS lab_order_result
            FROM lab_head lh
            JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
            WHERE lh.order_date BETWEEN ? AND ?
              AND (lo.lab_items_name_ref REGEXP 'preg|UPT' OR lo.lab_items_name_ref LIKE '%pregnancy%')
            GROUP BY lh.vn
          ) lo ON lo.vn = o.vn
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
            SELECT vn, GROUP_CONCAT(DISTINCT fund SEPARATOR ',') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ',') AS subfund
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY vn
          ) re ON re.vn = o.vn
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
          WHERE o.vstdate BETWEEN ? AND ?
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC;
        `
        const sqlParams = [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2]
        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey: 'pregnancy-test', data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 5.8 Family Planning Fund (9.1 - 9.7)
  // Supports OPD and IPD with FoxPro-compliant Diagnosis (Z304/Z308) + ADP Union
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/family-planning', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการวางแผนครอบครัว (Family Planning 9.1 - 9.7) OPD/IPD',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          adpCode: { type: 'string' },
          patientType: { type: 'string', enum: ['OPD', 'IPD'] },
          expectedDx: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const adpCode = (req.query?.adpCode || 'FP003_2').trim()
    const patientType = (req.query?.patientType === 'IPD') ? 'IPD' : 'OPD'
    const expectedDx = (req.query?.expectedDx || (adpCode.startsWith('FP002') ? 'Z308' : 'Z304')).trim()
    const codePattern = `${adpCode}%`
    const cacheKey = `rcm-fund-family-planning-${patientType}-${ds1}-${ds2}-${adpCode}-${expectedDx}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
        if (patientType === 'IPD') {
          const sql = `
            SELECT 
              i.an AS vn,
              i.an,
              IFNULL(pt.cid, '') AS cid,
              i.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
              IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
              DATE_FORMAT(i.regdate, '%Y-%m-%d') AS vstdate,
              DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
              DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
              TIME_FORMAT(i.regtime, '%H:%i:%s') AS vsttime,
              CONCAT_WS(':', i.pttype, ptt.name) AS pttypename,
              ptt.pttype_eclaim_id,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS claimcode,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              w.name AS department,
              spc.name AS clinic,
              '' AS cc,
              IFNULL(a.income, 0) AS income,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ipt_diag_id SEPARATOR ', ') AS dx,
              GROUP_CONCAT(DISTINCT IF(op.icd9 REGEXP '^[0-9]', op.icd9, NULL) SEPARATOR ', ') AS op,
              GROUP_CONCAT(DISTINCT IF(TRIM(d.nhso_adp_code) = ? OR (? = 'FP002_1' AND TRIM(d.nhso_adp_code) IN ('FP002', '20004')) OR (? = 'FP002_2' AND TRIM(d.nhso_adp_code) = '71691') OR (? IN ('FP003_1','FP003_2','FP003_3','FP003_4') AND TRIM(d.nhso_adp_code) IN ('20003','71681','71682','FP003_1','FP003_2','FP003_3','FP003_4')), CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
              GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
              COALESCE(e.income, 0) AS money_eclaim,
              COALESCE(r.income, 0) AS money_rep,
              COALESCE(n.income, 0) AS money_invoice,
              COALESCE(n.rep, r.rep, IF(m.status = '4', m.rep, NULL), '') AS rep,
              CASE
                WHEN n.an IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
                WHEN r.an IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
                WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
                ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
              END AS status
            FROM (
              SELECT DISTINCT an FROM (
                SELECT i.an 
                FROM ipt i 
                JOIN iptdiag dx ON dx.an = i.an 
                WHERE i.dchdate BETWEEN ? AND ? 
                  AND dx.icd10 REGEXP ?
                UNION
                SELECT oo.an 
                FROM opitemrece oo
                JOIN s_drugitems d ON d.icode = oo.icode
                WHERE oo.vstdate BETWEEN ? AND ?
                  AND IFNULL(oo.an, '') <> ''
                  AND (TRIM(d.nhso_adp_code) = ? OR (? = 'FP002_1' AND TRIM(d.nhso_adp_code) IN ('FP002', '20004')) OR (? = 'FP002_2' AND TRIM(d.nhso_adp_code) = '71691'))
              ) u
            ) t
            JOIN ipt i ON i.an = t.an
            LEFT JOIN patient pt ON pt.hn = i.hn
            LEFT JOIN an_stat a ON a.an = i.an
            LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
            LEFT JOIN ward w ON w.ward = i.ward
            LEFT JOIN spclty spc ON spc.spclty = i.spclty
            LEFT JOIN iptdiag dx ON dx.an = i.an
            LEFT JOIN iptoprt op ON op.an = i.an
            LEFT JOIN opitemrece oo ON oo.an = i.an
            LEFT JOIN s_drugitems d ON d.icode = oo.icode
            LEFT JOIN rcmdb.authencode cc ON cc.vn = i.an
            LEFT JOIN visit_pttype vt ON vt.vn = i.an
            LEFT JOIN (
              SELECT e.an,
                     SUM(COALESCE(cc.totpay1, 0)) AS income
              FROM eclaimdb.m_registerdata e
              JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
              WHERE e.person_type = '2'
                AND (cc.code LIKE ? OR cc.code LIKE 'FP001%' OR cc.code LIKE 'FP002%' OR cc.code LIKE 'FP003%')
              GROUP BY e.an
            ) e ON e.an = i.an
            LEFT JOIN (
              SELECT an,
                     SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                     GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
              FROM rcmdb.repdata
              WHERE department = 'IP'
                AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
              GROUP BY an
            ) r ON r.an = i.an
            LEFT JOIN (
              SELECT an,
                     SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                     GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
              FROM rcmdb.repeclaim
              WHERE department = 'IP'
                AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
              GROUP BY an
            ) n ON n.an = i.an
            LEFT JOIN (
              SELECT m.an,
                     MAX(m.eclaim_no) AS eclaim_no,
                     SUBSTRING_INDEX(GROUP_CONCAT(IF(m.status = '4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
              FROM eclaimdb.m_registerdata m
              WHERE m.person_type = '2'
              GROUP BY m.an
            ) m ON m.an = i.an
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            GROUP BY i.an
            ORDER BY i.dchdate DESC;
          `
          const sqlParams = [
            adpCode, adpCode, adpCode, adpCode,
            ds1, ds2, expectedDx,
            ds1, ds2,
            adpCode, adpCode, adpCode,
            codePattern,
            ds1, ds2,
            ds1, ds2
          ]
          const [rows] = await hosPool.query(sql, sqlParams)
          return rows || []
        } else {
          const sql = `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              IF(pt.sex = '1', 'ชาย', IF(pt.sex = '2', 'หญิง', IFNULL(pt.sex, ''))) AS sex,
              IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              CONCAT_WS(':', o.pttype, ptt.name) AS pttypename,
              ptt.pttype_eclaim_id,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS claimcode,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
              dep.department AS department,
              spc.name AS clinic,
              s.cc AS cc,
              IFNULL(v.income, 0) AS income,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 NOT REGEXP '^[0-9]', dx.icd10, NULL) ORDER BY dx.diagtype, dx.ovst_diag_id SEPARATOR ', ') AS dx,
              GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^[0-9]', dx.icd10, NULL) SEPARATOR ', ') AS op,
              GROUP_CONCAT(DISTINCT IF(TRIM(d.nhso_adp_code) = ? OR (? = 'FP002_1' AND TRIM(d.nhso_adp_code) IN ('FP002', '20004')) OR (? = 'FP002_2' AND TRIM(d.nhso_adp_code) = '71691'), CONCAT_WS(' ', d.name, NULLIF(d.strength, '')), NULL) SEPARATOR ', ') AS drug,
              GROUP_CONCAT(DISTINCT TRIM(d.nhso_adp_code) SEPARATOR ',') AS all_adp_codes,
              COALESCE(e.income, 0) AS money_eclaim,
              COALESCE(r.income, 0) AS money_rep,
              COALESCE(n.income, 0) AS money_invoice,
              COALESCE(n.rep, r.rep, IF(m.status = '4', m.rep, NULL), '') AS rep,
              CASE
                WHEN n.vn IS NOT NULL THEN 'NHSO :: ได้รับ Invoice'
                WHEN r.vn IS NOT NULL THEN 'Rep :: ได้รับ Rep แล้ว'
                WHEN m.status IS NOT NULL THEN COALESCE(ecs.name, CONCAT('E-Claim (', m.status, ')'))
                ELSE '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim'
              END AS status
            FROM (
              SELECT DISTINCT vn FROM (
                SELECT vn FROM ovstdiag WHERE vstdate BETWEEN ? AND ? AND icd10 REGEXP ?
                UNION
                SELECT oo.vn 
                FROM opitemrece oo
                JOIN s_drugitems d ON d.icode = oo.icode
                WHERE oo.vstdate BETWEEN ? AND ?
                  AND IFNULL(oo.vn, '') <> ''
                  AND (TRIM(d.nhso_adp_code) = ? OR (? = 'FP002_1' AND TRIM(d.nhso_adp_code) IN ('FP002', '20004')) OR (? = 'FP002_2' AND TRIM(d.nhso_adp_code) = '71691'))
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
              SELECT e.opdseq AS vn,
                     SUM(COALESCE(cc.totpay1, 0)) AS income
              FROM eclaimdb.m_registerdata e
              JOIN eclaimdb.m_serviceother cc ON cc.eclaim_no = e.eclaim_no
              WHERE e.person_type = '1'
                AND (cc.code LIKE ? OR cc.code LIKE 'FP003%' OR cc.code LIKE 'FP002%')
              GROUP BY e.opdseq
            ) e ON e.vn = o.vn
            LEFT JOIN (
              SELECT vn,
                     SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                     GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
              FROM rcmdb.repdata
              WHERE department = 'OP'
                AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
              GROUP BY vn
            ) r ON r.vn = o.vn
            LEFT JOIN (
              SELECT vn,
                     SUM(COALESCE(fpnhso, 0) + COALESCE(pp, 0) + COALESCE(compensated, 0)) AS income,
                     GROUP_CONCAT(DISTINCT rep SEPARATOR ', ') AS rep
              FROM rcmdb.repeclaim
              WHERE department = 'OP'
                AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND (COALESCE(fpnhso, 0) > 0 OR COALESCE(pp, 0) > 0 OR COALESCE(compensated, 0) > 0)
              GROUP BY vn
            ) n ON n.vn = o.vn
            LEFT JOIN (
              SELECT m.opdseq AS vn,
                     MAX(m.eclaim_no) AS eclaim_no,
                     SUBSTRING_INDEX(GROUP_CONCAT(IF(m.status = '4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                     SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status
              FROM eclaimdb.m_registerdata m
              WHERE m.person_type = '1'
                AND m.opdseq IS NOT NULL
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            GROUP BY o.vn
            ORDER BY o.vstdate DESC, o.vsttime DESC;
          `
          const sqlParams = [
            adpCode, adpCode, adpCode,
            ds1, ds2, expectedDx,
            ds1, ds2,
            adpCode, adpCode, adpCode,
            codePattern,
            ds1, ds2,
            ds1, ds2
          ]
          const [rows] = await hosPool.query(sql, sqlParams)
          return rows || []
        }
      })

      return { success: true, fundKey: 'family-planning', data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 5.9. Anemia Screening (17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก หญิง 13-24 ปี ADP 13001)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/anemia-screening', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP (13001)',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          adpCode: { type: 'string', default: '13001' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const adpCode = (req.query?.adpCode || '13001').trim()
    const fiscalStartYear = getFiscalYearStart(ds1)
    const cacheKey = `rcm-fund-anemia-screening-${ds1}-${ds2}-${adpCode}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
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
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), ''), '') AS authencode,
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
            (
              SELECT GROUP_CONCAT(DISTINCT CONCAT(a.icode, ':', b.name) SEPARATOR ', ')
              FROM opitemrece a
              JOIN nondrugitems b ON b.icode = a.icode
              WHERE a.vn = o.vn
            ) AS listname1,
            (
              SELECT GROUP_CONCAT(DISTINCT DATE_FORMAT(o2.vstdate, '%Y-%m-%d') ORDER BY o2.vstdate SEPARATOR ', ')
              FROM ovst o2
              JOIN opitemrece oo2 ON oo2.vn = o2.vn
              JOIN s_drugitems d2 ON d2.icode = oo2.icode
              WHERE o2.hn = o.hn
                AND o2.vstdate >= ? AND o2.vstdate < o.vstdate
                AND TRIM(d2.nhso_adp_code) = ?
            ) AS camedate,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-:ยังไม่ได้ส่ง') AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep, '') AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
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
          WHERE o.vstdate BETWEEN ? AND ?
            AND (v.sex = 2 OR v.sex = '2' OR pt.sex = '2' OR pt.sex = 2)
            AND (
              v.age_y BETWEEN 13 AND 24 
              OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) BETWEEN 13 AND 24
            )
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC;
        `
        const sqlParams = [
          fiscalStartYear, adpCode,
          ds1, ds2, adpCode,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2
        ]
        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey: 'anemia-screening', data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // Dedicated Fund: Iron Supplements 18.2 (ยาเม็ดเสริมธาตุเหล็ก หญิงอายุ 13-45 ปี ADP 14001)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/iron-supplements', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการยาเม็ดเสริมธาตุเหล็ก หญิงอายุ 13-45 ปี ADP (14001) + 25 DIDs',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          adpCode: { type: 'string', default: '14001' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const adpCode = (req.query?.adpCode || '14001').trim()
    const cacheKey = `rcm-fund-iron-supplements-${ds1}-${ds2}-${adpCode}`

    const IRON_DIDS = [
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
    const didPlaceholders = IRON_DIDS.map(() => '?').join(', ')

    try {
      const data = await getCached(cacheKey, 300000, async () => {
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
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
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
          WHERE o.vstdate BETWEEN ? AND ?
            AND (v.sex = 2 OR v.sex = '2' OR pt.sex = '2' OR pt.sex = 2)
            AND (
              v.age_y BETWEEN 13 AND 45 
              OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) BETWEEN 13 AND 45
            )
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC;
        `
        const sqlParams = [
          ...IRON_DIDS,
          adpCode,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2
        ]
        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey: 'iron-supplements', data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 11. Colorectal Cancer (ตรวจคัดกรองมะเร็งลำไส้ใหญ่ Fit test ADP 90005)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/colorectal-cancer', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายงานบริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test) อายุ 50-70 ปี (21.2 ADP 90005)',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          adpCode: { type: 'string', default: '90005' }
        }
      }
    }
  }, async (req, reply) => {
    const { ds1, ds2 } = getRange(req.query)
    const adpCode = (req.query?.adpCode || '90005').trim()
    const cacheKey = `rcm-fund-colorectal-cancer-${ds1}-${ds2}-${adpCode}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
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
            IFNULL(o.pttype, '') AS pttype,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            ptt.name AS pttypename,
            dep.department AS department,
            spc.name AS clinic,
            v.pdx,
            v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
            IFNULL(v.income, 0) AS income,
            lo.labresult AS labresult,
            tt.pp_special_code AS pp_special_code,
            tt.code AS code,
            dd.name AS listname,
            sm.status AS status_seamless,
            sm.rep AS rep_seamless,
            IFNULL(sm.compensated, 0) AS compensated_seamless,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, sm.status, '-:ยังไม่ได้ส่ง') AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep, sm.rep) AS rep,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, sm.compensated, 0) AS compensated,
            rep.agency,
            rep.fund,
            rep.subfund
          FROM ovst o
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
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', s_sub.name, NULLIF(s_sub.strength, '')) SEPARATOR ', ') AS name
            FROM s_drugitems s_sub
            JOIN opitemrece oo ON oo.icode = s_sub.icode
            WHERE TRIM(s_sub.nhso_adp_code) = ?
              AND IFNULL(oo.vn, '') <> ''
              AND oo.vstdate BETWEEN ? AND ?
            GROUP BY oo.vn
          ) dd ON dd.vn = o.vn
          LEFT JOIN (
            SELECT 
              pp.vn,
              GROUP_CONCAT(DISTINCT tt_sub.pp_special_code SEPARATOR ', ') AS pp_special_code,
              GROUP_CONCAT(DISTINCT tt_sub.pp_special_type_name SEPARATOR ', ') AS code
            FROM pp_special pp
            JOIN pp_special_type tt_sub ON tt_sub.pp_special_type_id = pp.pp_special_type_id
            WHERE tt_sub.pp_special_code REGEXP '1B006'
            GROUP BY pp.vn
          ) tt ON tt.vn = o.vn
          LEFT JOIN (
            SELECT 
              lh.vn,
              GROUP_CONCAT(DISTINCT lo_sub.lab_order_result SEPARATOR ', ') AS labresult
            FROM lab_head lh
            JOIN lab_order lo_sub ON lo_sub.lab_order_number = lh.lab_order_number 
                                 AND lo_sub.lab_items_name_ref REGEXP 'stool'
            WHERE lh.order_date BETWEEN ? AND ?
            GROUP BY lh.vn
          ) lo ON lo.vn = o.vn
          LEFT JOIN (
            SELECT vn, 
                   SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY vn), ',', 1) AS status,
                   SUBSTRING_INDEX(GROUP_CONCAT(rep ORDER BY vn), ',', 1) AS rep,
                   SUM(compensated) AS compensated
            FROM rcmdb.seamless
            WHERE IFNULL(vn, '') <> ''
            GROUP BY vn
          ) sm ON sm.vn = o.vn
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
          WHERE o.vstdate BETWEEN ? AND ?
            AND (
              v.age_y BETWEEN 50 AND 70
              OR TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) BETWEEN 50 AND 70
            )
            AND (tt.vn IS NOT NULL OR dd.vn IS NOT NULL)
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC;
        `
        const sqlParams = [
          adpCode,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2,
          ds1, ds2
        ]
        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey: 'colorectal-cancer', isDedicated: true, data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 6. Generic Dispatcher for All Other RCM Funds
  // Allows any RCM fund to be fetched cleanly by fundKey
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds/:fundKey', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'API ศูนย์กลางสำหรับดึงข้อมูลรายงานกองทุนเฉพาะโรค/ยา (Named API)',
      params: {
        type: 'object',
        required: ['fundKey'],
        properties: { fundKey: { type: 'string' } }
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          adpCode: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { fundKey } = req.params
    const { ds1, ds2 } = getRange(req.query)
    const adpCode = (req.query?.adpCode || '').trim()

    // Map fundKey to target ADP code if not explicitly given
    const fundAdpMap = {
      'postpartum': '30015',
      't1dm-gdm-pdm': '11005',
      'telemed-drug': 'TELMED',
      'drug-post': 'DRUGP',
      'thai-traditional-medicine': 'TTM',
      'thalassemia-fund': 'THAL',
      'viral-hepatitis': 'HEPB',
      'hepatitis-c': 'HEPC',
      'health-screening': 'SCREEN',
      'clopidogrel': '37999771001',
      'cancer': 'CANCER',
      'walkin': 'WALKIN',
      'instrument': 'INST',
      'imc': 'IMC',
      'rehabilitation': 'REHAB',
      'cervical-cancer': 'HPV',
      'family-planning': 'FP',
      'anc': 'ANC',
      'amed-homeward': 'AMED'
    }

    const resolvedAdp = adpCode || fundAdpMap[fundKey] || ''
    const cacheKey = `rcm-fund-${fundKey}-${ds1}-${ds2}-${resolvedAdp}`

    try {
      const data = await getCached(cacheKey, 300000, async () => {
        let sql = ''
        let sqlParams = []

        if (resolvedAdp) {
          sql = `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
              IFNULL(pt.sex, '') AS sex_code,
              IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
              IFNULL(nat.name, pt.nationality) AS nation,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
              COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), ''), '') AS authencode,
              IFNULL(ptt.hipdata_code, '') AS maininscl,
              IFNULL(ptt.name, o.pttype) AS pttypename,
              dep.department,
              spc.name AS clinic,
              v.pdx,
              v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
              v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
              IFNULL(v.income, 0) AS income,
              dd.name AS listname,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, 'ยังไม่ได้ส่ง') AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep, '') AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated,
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
            WHERE o.vstdate BETWEEN ? AND ?
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC;
          `
          sqlParams = [ds1, ds2, resolvedAdp, ds1, ds2, ds1, ds2, ds1, ds2]
        } else {
          sql = `
            SELECT 
              o.vn,
              IFNULL(pt.cid, '') AS cid,
              o.hn,
              CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
              pt.sex AS sex_code,
              IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              o.vsttime,
              IFNULL(cc.AuthenCode, '') AS authencode,
              IFNULL(ptt.hipdata_code, '') AS maininscl,
              IFNULL(ptt.name, o.pttype) AS pttypename,
              v.pdx,
              v.income,
              COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, 'ยังไม่ได้ส่ง') AS status,
              COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep, '') AS rep,
              COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0) AS compensated
            FROM ovst o
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'NHSO :: มี Invoice แล้ว' AS statusname
              FROM rcmdb.repeclaim
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
                AND (errorcode = '' OR errorcode IS NULL)
              GROUP BY vn
            ) nhso ON nhso.vn = o.vn
            LEFT JOIN (
              SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                     'Rep :: มี Rep แล้ว' AS statusname
              FROM rcmdb.repdata
              WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate BETWEEN ? AND ?
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
              WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> '' AND m.dateadm BETWEEN ? AND ?
              GROUP BY m.opdseq
            ) m ON m.vn = o.vn
            WHERE o.vstdate BETWEEN ? AND ?
            GROUP BY o.vn
            ORDER BY o.hn ASC, o.vn ASC;
          `
          sqlParams = [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2]
        }

        const [rows] = await hosPool.query(sql, sqlParams)
        return rows || []
      })

      return { success: true, fundKey, data: { rawRows: data } }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // Helper for Rep Funds filtering
  // ------------------------------------------------------------------
  function buildRepFundsWhere(params) {
    const whereClauses = []
    const queryParams = []

    if (params.ds1 && params.ds2) {
      whereClauses.push('COALESCE(AdmDate, DchDate) BETWEEN ? AND ?')
      queryParams.push(`${params.ds1} 00:00:00`, `${params.ds2} 23:59:59`)
    } else if (params.fiscalYear) {
      whereClauses.push('YearBudget = ?')
      queryParams.push(params.fiscalYear)
    }

    if (params.department && params.department !== 'ALL') {
      whereClauses.push('Department = ?')
      queryParams.push(params.department)
    }

    if (params.fund && params.fund !== 'ALL') {
      const f = params.fund
      if (['UCS', 'OFC', 'SSS', 'LGO', 'STP'].includes(f)) {
        if (f === 'OFC') {
          whereClauses.push("(Fund LIKE '%CS%' OR Fund LIKE '%OFC%')")
        } else if (f === 'LGO') {
          whereClauses.push("(Fund LIKE '%LG%' OR Fund LIKE '%LGO%')")
        } else if (f === 'SSS') {
          whereClauses.push("(Fund LIKE '%SSS%' OR Fund LIKE '%SS%')")
        } else if (f === 'STP') {
          whereClauses.push("Fund LIKE '%STP%'")
        } else if (f === 'UCS') {
          whereClauses.push("(Fund LIKE '%UC%' OR Fund LIKE 'IP0%' OR Fund LIKE 'OP0%' OR Fund LIKE 'HC%' OR Fund LIKE 'DM%' OR Fund LIKE 'AE%')")
        }
      } else {
        whereClauses.push('Fund = ?')
        queryParams.push(f)
      }
    }

    if (params.subFund && params.subFund !== 'ALL') {
      whereClauses.push('SubFund = ?')
      queryParams.push(params.subFund)
    }

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'paid' || params.status === 'compensated') {
        whereClauses.push('Compensated > 0')
      } else if (params.status === 'denied' || params.status === 'zero') {
        whereClauses.push('(Compensated = 0 OR Compensated IS NULL)')
      } else if (params.status === 'appeal') {
        whereClauses.push("(Appeal = 'Y' OR (Compensated < Income AND Compensated > 0))")
      } else if (params.status === 'has_error') {
        whereClauses.push('(ErrorCode IS NOT NULL AND LENGTH(ErrorCode) > 0)')
      }
    }

    if (params.errorCode && params.errorCode !== 'ALL') {
      whereClauses.push('(ErrorCode = ? OR ErrorCode LIKE ?)')
      const cleanErr = params.errorCode.trim()
      queryParams.push(cleanErr, `%${cleanErr}%`)
    }

    if (params.search && params.search.trim()) {
      whereClauses.push('(Rep LIKE ? OR Fund LIKE ? OR SubFund LIKE ? OR PtName LIKE ? OR HN LIKE ? OR ErrorCode LIKE ?)')
      const s = `%${params.search.trim()}%`
      queryParams.push(s, s, s, s, s, s)
    }

    return {
      whereSql: whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1',
      queryParams
    }
  }

  // ------------------------------------------------------------------
  // 29. Rep Funds - Available Fiscal Years
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/rep-funds/years', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายการปีงบประมาณที่มีข้อมูลใน rcmdb.repdata',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const data = await getCached('rcm-rep-available-years', 60000, async () => {
        const [rows] = await hosPool.query(`
          SELECT DISTINCT YearBudget 
          FROM rcmdb.repdata 
          WHERE YearBudget IS NOT NULL AND YearBudget != '' 
          ORDER BY YearBudget DESC
        `)
        const list = (rows || []).map((r) => String(r.YearBudget).trim()).filter(Boolean)
        return list.length > 0 ? list : ['2570', '2569', '2568', '2567']
      })
      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 30. Rep Funds - Summary (Metrics, Fund Groups, Rep Statements)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/rep-funds/summary', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'สรุปภาพรวม KPI, กองทุน และ Rep Statement จาก rcmdb.repdata',
      querystring: {
        type: 'object',
        properties: {
          fiscalYear: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          department: { type: 'string' },
          fund: { type: 'string' },
          subFund: { type: 'string' },
          status: { type: 'string' },
          errorCode: { type: 'string' },
          search: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const query = req.query || {}
      const fiscalYear = query.fiscalYear || '2570'
      const department = query.department || 'ALL'
      const fund = query.fund && query.fund !== 'ALL' ? query.fund : null
      const subFund = query.subFund && query.subFund !== 'ALL' ? query.subFund : null
      const search = query.search ? query.search.trim() : null
      const ds1 = query.ds1 || ''
      const ds2 = query.ds2 || ''

      const cacheKey = `rcm-rep-summary-${fiscalYear}-${department}-${fund || ''}-${subFund || ''}-${search || ''}-${ds1}-${ds2}-${query.status || ''}-${query.errorCode || ''}`

      const data = await getCached(cacheKey, 30000, async () => {
        const { whereSql, queryParams } = buildRepFundsWhere({
          fiscalYear, ds1, ds2, department, fund, subFund, search,
          status: query.status, errorCode: query.errorCode
        })

        const metricsSql = `
          SELECT 
            COUNT(*) as totalCases,
            COUNT(DISTINCT Rep) as totalReps,
            COALESCE(ROUND(SUM(Income), 2), 0) as totalIncome,
            COALESCE(ROUND(SUM(Compensated), 2), 0) as totalCompensated,
            COALESCE(ROUND(SUM(Compensated - Income), 2), 0) as totalDiff,
            SUM(CASE WHEN Appeal = 'Y' THEN 1 ELSE 0 END) as pendingAppeals,
            SUM(CASE WHEN ErrorCode IS NOT NULL AND ErrorCode != '' THEN 1 ELSE 0 END) as errorCount
          FROM rcmdb.repdata
          WHERE ${whereSql}
        `
        const [metricsRows] = await hosPool.query(metricsSql, queryParams)

        const fundGroupsSql = `
          SELECT 
            COALESCE(Fund, 'UNKNOWN') as fundKey,
            COALESCE(SubFund, '-') as subFundKey,
            Department as department,
            COUNT(*) as caseCount,
            ROUND(SUM(Income), 2) as totalIncome,
            ROUND(SUM(Compensated), 2) as totalCompensated,
            ROUND(SUM(Compensated - Income), 2) as netDiff,
            SUM(CASE WHEN Appeal = 'Y' THEN 1 ELSE 0 END) as appealCount,
            SUM(CASE WHEN ErrorCode IS NOT NULL AND ErrorCode != '' THEN 1 ELSE 0 END) as errorCount
          FROM rcmdb.repdata
          WHERE ${whereSql}
          GROUP BY Fund, SubFund, Department
          ORDER BY totalCompensated DESC
        `
        const [fundGroupRows] = await hosPool.query(fundGroupsSql, queryParams)

        const repListSql = `
          SELECT 
            Rep as rep,
            YearBudget as yearBudget,
            Department as department,
            COALESCE(Fund, '-') as fund,
            COUNT(*) as caseCount,
            ROUND(SUM(Income), 2) as totalIncome,
            ROUND(SUM(Compensated), 2) as totalCompensated,
            ROUND(SUM(Compensated - Income), 2) as netDiff,
            MIN(AdmDate) as minDate,
            MAX(DchDate) as maxDate,
            SUM(CASE WHEN Appeal = 'Y' THEN 1 ELSE 0 END) as appealCount,
            SUM(CASE WHEN ErrorCode IS NOT NULL AND ErrorCode != '' THEN 1 ELSE 0 END) as errorCount
          FROM rcmdb.repdata
          WHERE ${whereSql}
          GROUP BY Rep, YearBudget, Department, Fund
          ORDER BY totalCompensated DESC
        `
        const [repListRows] = await hosPool.query(repListSql, queryParams)

        let availableFundsSql = `
          SELECT COALESCE(Fund, 'UNKNOWN') as fundKey, COUNT(*) as cnt
          FROM rcmdb.repdata
        `
        let fundsQueryParams = []
        if (ds1 && ds2) {
          availableFundsSql += ` WHERE COALESCE(AdmDate, DchDate) BETWEEN ? AND ? GROUP BY Fund ORDER BY cnt DESC`
          fundsQueryParams = [`${ds1} 00:00:00`, `${ds2} 23:59:59`]
        } else {
          availableFundsSql += ` WHERE YearBudget = ? GROUP BY Fund ORDER BY cnt DESC`
          fundsQueryParams = [fiscalYear]
        }
        const [fundRows] = await hosPool.query(availableFundsSql, fundsQueryParams)

        let availableErrorCodesSql = `
          SELECT ErrorCode as code, COUNT(*) as cnt
          FROM rcmdb.repdata
        `
        let errQueryParams = []
        if (ds1 && ds2) {
          availableErrorCodesSql += ` WHERE COALESCE(AdmDate, DchDate) BETWEEN ? AND ? AND ErrorCode IS NOT NULL AND LENGTH(ErrorCode) > 0 GROUP BY ErrorCode ORDER BY cnt DESC`
          errQueryParams = [`${ds1} 00:00:00`, `${ds2} 23:59:59`]
        } else {
          availableErrorCodesSql += ` WHERE YearBudget = ? AND ErrorCode IS NOT NULL AND LENGTH(ErrorCode) > 0 GROUP BY ErrorCode ORDER BY cnt DESC`
          errQueryParams = [fiscalYear]
        }
        let errRows = []
        try {
          const [res] = await hosPool.query(availableErrorCodesSql, errQueryParams)
          errRows = res || []
        } catch (_) {
          errRows = []
        }

        return {
          metrics: metricsRows[0] || {},
          fundGroups: fundGroupRows || [],
          repList: repListRows || [],
          availableFunds: fundRows || [],
          availableErrorCodes: errRows || []
        }
      })

      return { success: true, data }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 31. Rep Funds - Individual Cases by Rep/Fund
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/rep-funds/cases', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายการเคสผู้ป่วยรายบุคคลตาม Rep หรือ กองทุน จาก rcmdb.repdata',
      querystring: {
        type: 'object',
        properties: {
          rep: { type: 'string' },
          fund: { type: 'string' },
          subFund: { type: 'string' },
          department: { type: 'string' },
          fiscalYear: { type: 'string' },
          ds1: { type: 'string' },
          ds2: { type: 'string' },
          hn: { type: 'string' },
          status: { type: 'string' },
          errorCode: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'integer' },
          offset: { type: 'integer' }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const q = req.query || {}
      const whereClauses = []
      const queryParams = []

      if (q.rep) {
        whereClauses.push('Rep = ?')
        queryParams.push(q.rep.trim())
      }

      if (q.ds1 && q.ds2) {
        whereClauses.push('COALESCE(AdmDate, DchDate) BETWEEN ? AND ?')
        queryParams.push(`${q.ds1} 00:00:00`, `${q.ds2} 23:59:59`)
      } else if (q.fiscalYear) {
        whereClauses.push('YearBudget = ?')
        queryParams.push(q.fiscalYear)
      }

      if (q.department && q.department !== 'ALL') {
        whereClauses.push('Department = ?')
        queryParams.push(q.department)
      }

      if (q.fund && q.fund !== 'ALL') {
        if (['UCS', 'OFC', 'SSS', 'LGO', 'STP'].includes(q.fund)) {
          if (q.fund === 'OFC') {
            whereClauses.push("(Fund LIKE '%CS%' OR Fund LIKE '%OFC%')")
          } else if (q.fund === 'LGO') {
            whereClauses.push("(Fund LIKE '%LG%' OR Fund LIKE '%LGO%')")
          } else if (q.fund === 'SSS') {
            whereClauses.push("(Fund LIKE '%SSS%' OR Fund LIKE '%SS%')")
          } else if (q.fund === 'STP') {
            whereClauses.push("Fund LIKE '%STP%'")
          } else if (q.fund === 'UCS') {
            whereClauses.push("(Fund LIKE '%UC%' OR Fund LIKE 'IP0%' OR Fund LIKE 'OP0%' OR Fund LIKE 'HC%' OR Fund LIKE 'DM%' OR Fund LIKE 'AE%')")
          }
        } else {
          whereClauses.push('Fund = ?')
          queryParams.push(q.fund)
        }
      }

      if (q.subFund && q.subFund !== 'ALL') {
        whereClauses.push('SubFund = ?')
        queryParams.push(q.subFund)
      }

      if (q.status && q.status !== 'ALL') {
        if (q.status === 'paid' || q.status === 'compensated') {
          whereClauses.push('Compensated > 0')
        } else if (q.status === 'denied' || q.status === 'zero') {
          whereClauses.push('(Compensated = 0 OR Compensated IS NULL)')
        } else if (q.status === 'appeal') {
          whereClauses.push("(Appeal = 'Y' OR (Compensated < Income AND Compensated > 0))")
        } else if (q.status === 'has_error') {
          whereClauses.push('(ErrorCode IS NOT NULL AND LENGTH(ErrorCode) > 0)')
        }
      }

      if (q.errorCode && q.errorCode !== 'ALL') {
        whereClauses.push('(ErrorCode = ? OR ErrorCode LIKE ?)')
        const cleanErr = q.errorCode.trim()
        queryParams.push(cleanErr, `%${cleanErr}%`)
      }

      if (q.hn) {
        whereClauses.push('(HN = ? OR HN LIKE ?)')
        const cleanHn = q.hn.trim()
        queryParams.push(cleanHn, `%${cleanHn}`)
      }

      if (q.search && q.search.trim()) {
        whereClauses.push('(Rep LIKE ? OR Fund LIKE ? OR SubFund LIKE ? OR PtName LIKE ? OR HN LIKE ? OR ErrorCode LIKE ?)')
        const s = `%${q.search.trim()}%`
        queryParams.push(s, s, s, s, s, s)
      }

      if (whereClauses.length === 0) {
        whereClauses.push('YearBudget = ?')
        queryParams.push('2570')
      }

      const hasLimit = q.limit !== undefined ? Number(q.limit) > 0 : true
      const limit = hasLimit ? Math.max(Number(q.limit || 200), 1) : null
      const offset = Math.max(Number(q.offset || 0), 0)

      const sql = `
        SELECT 
          ID, Rep, HN, PtName, AdmDate, DchDate, Department, 
          Income, Compensated, Diff, Fund, SubFund, ErrorCode, Appeal, YearBudget, ProjectCode
        FROM rcmdb.repdata
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY AdmDate DESC, ID DESC
        ${limit !== null ? 'LIMIT ? OFFSET ?' : ''}
      `
      if (limit !== null) {
        queryParams.push(limit, offset)
      }

      const [rows] = await hosPool.query(sql, queryParams)
      return { success: true, data: rows || [] }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 32. Rep Funds - Patient Claim Lookup (HN / PtName / Date)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/rep-funds/lookup', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ค้นหาประวัติการเคลมผู้ป่วยรายบุคคลด้วย HN, ชื่อ หรือวันที่รับบริการ',
      querystring: {
        type: 'object',
        properties: {
          hn: { type: 'string' },
          ptName: { type: 'string' },
          serviceDate: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const q = req.query || {}
      const whereClauses = []
      const queryParams = []

      if (q.hn && q.hn.trim()) {
        const cleanHn = q.hn.trim()
        whereClauses.push('(HN = ? OR HN LIKE ?)')
        queryParams.push(cleanHn, `%${cleanHn}`)
      }

      if (q.ptName && q.ptName.trim()) {
        whereClauses.push('PtName LIKE ?')
        queryParams.push(`%${q.ptName.trim()}%`)
      }

      if (q.serviceDate && q.serviceDate.trim()) {
        whereClauses.push('(DATE(AdmDate) = ? OR DATE(DchDate) = ?)')
        queryParams.push(q.serviceDate.trim(), q.serviceDate.trim())
      }

      if (whereClauses.length === 0) {
        return { success: true, data: [] }
      }

      const sql = `
        SELECT 
          ID, Rep, HN, PtName, AdmDate, DchDate, Department, 
          Income, Compensated, Diff, Fund, SubFund, ErrorCode, Appeal, YearBudget, ProjectCode
        FROM rcmdb.repdata
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY AdmDate DESC
      `
      const [rows] = await hosPool.query(sql, queryParams)
      return { success: true, data: rows || [] }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 33. T1DM / GDM / PDM Registry Import & Management (rcmdb.t1dm)
  // ------------------------------------------------------------------
  let t1dmTableEnsured = false
  async function ensureT1dmTable() {
    if (t1dmTableEnsured) return
    try {
      await hosPool.query(`
        CREATE TABLE IF NOT EXISTS rcmdb.t1dm (
          ID VARCHAR(20) NOT NULL,
          Year VARCHAR(4) NULL,
          PID VARCHAR(13) NULL,
          PtName VARCHAR(100) NULL,
          Maininscl VARCHAR(20) NULL,
          HospMain VARCHAR(5) NULL,
          Type VARCHAR(20) NULL,
          Register_Date DATE NULL,
          Visit_Date DATE NULL,
          FileName VARCHAR(200) NULL,
          PRIMARY KEY (ID),
          KEY pid (PID)
        ) ENGINE=MyISAM DEFAULT CHARSET=tis620
      `)
      t1dmTableEnsured = true
    } catch (_) {
      // ignore if rcmdb DDL restricted
    }
  }

  fastify.get('/api/v1/clinical/rcm/t1dm/registries', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ดึงข้อมูลทะเบียนผู้ป่วย T1DM/GDM/PDM จากตาราง rcmdb.t1dm',
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          typeFilter: { type: 'string' },
          hospFilter: { type: 'string' },
          fileName: { type: 'string' },
          sortBy: { type: 'string' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
          page: { type: 'integer', default: 1 },
          pageSize: { type: 'integer', default: 50 },
          exportAll: { type: 'boolean', default: false }
        }
      }
    }
  }, async (req, reply) => {
    try {
      await ensureT1dmTable()
      const [rows] = await hosPool.query(`
        SELECT 
          t.id AS id,
          IFNULL(t.year, '') AS year,
          IFNULL(t.pid, '') AS pid,
          IFNULL(t.ptname, '') AS ptname,
          DATE_FORMAT(t.register_date, '%Y-%m-%d') AS regdate,
          DATE_FORMAT(t.visit_date, '%Y-%m-%d') AS visitdate,
          IFNULL(t.type, '') AS type,
          IFNULL(t.maininscl, '') AS maininscl,
          LPAD(TRIM(IFNULL(t.hospmain, '')), 5, '0') AS hospmain_code,
          IFNULL(h.name, '') AS hospmain_name,
          CONCAT_WS(':', LPAD(TRIM(IFNULL(t.hospmain, '')), 5, '0'), NULLIF(TRIM(h.name), '')) AS hospmain,
          IFNULL(t.filename, '') AS filename,
          IFNULL(pt.hn, '') AS hn
        FROM rcmdb.t1dm t
        LEFT JOIN hospcode h ON h.hospcode = LPAD(TRIM(t.hospmain), 5, '0')
        LEFT JOIN patient pt ON pt.cid = t.pid
        ORDER BY t.register_date DESC, t.id ASC
      `)
      return { success: true, data: rows || [] }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.post('/api/v1/clinical/rcm/t1dm/import', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'นำเข้าข้อมูลทะเบียนผู้ป่วย T1DM/GDM/PDM ลงตาราง rcmdb.t1dm',
      body: {
        type: 'object',
        required: ['rows'],
        properties: {
          rows: { type: 'array' }
        }
      }
    }
  }, async (req, reply) => {
    const { rows = [] } = req.body || {}
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: true, insertedCount: 0, updatedCount: 0 }
    }
    try {
      await ensureT1dmTable()
      let insertedCount = 0
      for (const r of rows) {
        if (!r.id) continue
        await hosPool.query(`
          INSERT INTO rcmdb.t1dm (
            ID, Year, PID, PtName, Maininscl, HospMain, Type, Register_Date, Visit_Date, FileName
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            Year = VALUES(Year),
            PID = VALUES(PID),
            PtName = VALUES(PtName),
            Maininscl = VALUES(Maininscl),
            HospMain = VALUES(HospMain),
            Type = VALUES(Type),
            Register_Date = VALUES(Register_Date),
            Visit_Date = VALUES(Visit_Date),
            FileName = VALUES(FileName)
        `, [
          String(r.id).trim(),
          r.year ? String(r.year).trim() : null,
          r.pid ? String(r.pid).trim() : null,
          r.ptname ? String(r.ptname).trim() : null,
          r.maininscl ? String(r.maininscl).trim() : null,
          r.hospmainCode ? String(r.hospmainCode).trim().padStart(5, '0') : null,
          r.type ? String(r.type).trim() : null,
          r.regdate || null,
          r.visitdate || null,
          r.fileName || null
        ])
        insertedCount++
      }
      return { success: true, insertedCount, updatedCount: 0 }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })

  fastify.delete('/api/v1/clinical/rcm/t1dm/registries', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ลบข้อมูลทะเบียน T1DM/GDM/PDM (ต่าง รพ., ตามชื่อไฟล์, หรือทั้งหมด)',
      body: {
        type: 'object',
        required: ['mode'],
        properties: {
          mode: { type: 'string', enum: ['other_hospitals', 'by_file', 'all'] },
          fileName: { type: 'string' },
          myHospCode: { type: 'string', default: '11152' }
        }
      }
    }
  }, async (req, reply) => {
    const { mode, fileName, myHospCode = '11152' } = req.body || {}
    try {
      await ensureT1dmTable()
      let res
      if (mode === 'other_hospitals') {
        ;[res] = await hosPool.query('DELETE FROM rcmdb.t1dm WHERE LPAD(TRIM(IFNULL(HospMain, "")), 5, "0") <> ?', [myHospCode])
      } else if (mode === 'by_file') {
        if (!fileName) {
          reply.code(400); return { success: false, error: 'กรุณาระบุชื่อไฟล์ที่ต้องการลบ' }
        }
        ;[res] = await hosPool.query('DELETE FROM rcmdb.t1dm WHERE FileName = ?', [fileName])
      } else if (mode === 'all') {
        ;[res] = await hosPool.query('DELETE FROM rcmdb.t1dm')
      } else {
        reply.code(400); return { success: false, error: 'โหมดการลบข้อมูลไม่ถูกต้อง' }
      }
      return { success: true, deletedCount: res?.affectedRows || 0 }
    } catch (err) {
      reply.code(500); return { success: false, error: err.message }
    }
  })
}

