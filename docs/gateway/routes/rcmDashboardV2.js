/**
 * Phase 2C: RCM Dashboard (OPD, IPD, Palliative Care, VN Clinical Details) & REP Funds
 * Zero-SQL Named Endpoints for thoen-api-gateway-v2
 */

const REP_SOURCE_TABLES = {
  repdata: 'rcmdb.repdata',
  repeclaim: 'rcmdb.repeclaim',
  seamless: 'rcmdb.seamless',
};

function normalizeRepSource(source) {
  const s = String(source || '').trim().toLowerCase();
  if (s === 'repeclaim' || s === 'seamless') return s;
  return 'repdata';
}

function buildDepartmentSqlCase(tableAlias = 'i', spcltyTableAlias = 's', format = 'key') {
  if (format === 'label') {
    return `CASE
      WHEN ${tableAlias}.spclty IN ('01', '21') OR ${spcltyTableAlias}.name LIKE '%อายุร%' THEN '01. อายุรกรรม'
      WHEN ${tableAlias}.spclty = '02' OR (${spcltyTableAlias}.name LIKE '%ศัลยกรรม%' AND ${spcltyTableAlias}.name NOT LIKE '%กระดูก%' AND ${spcltyTableAlias}.name NOT LIKE '%ออร์โธ%') THEN '02. ศัลยกรรม'
      WHEN ${tableAlias}.spclty IN ('03', '04') OR ${spcltyTableAlias}.name LIKE '%สูติ%' OR ${spcltyTableAlias}.name LIKE '%นรีเวช%' THEN '03. สูตินารีเวชกรรม'
      WHEN ${tableAlias}.spclty = '05' OR ${spcltyTableAlias}.name LIKE '%กุมาร%' THEN '04. กุมารเวชกรรม'
      WHEN ${tableAlias}.spclty = '08' OR ${spcltyTableAlias}.name LIKE '%กระดูก%' OR ${spcltyTableAlias}.name LIKE '%ออร์โธ%' THEN '05. ออร์โธปิติกส์'
      WHEN ${tableAlias}.spclty = '06' OR ${spcltyTableAlias}.name LIKE '%ENT%' OR ${spcltyTableAlias}.name LIKE '%โสต%' THEN '06. ENT'
      WHEN ${tableAlias}.spclty = '07' OR ${spcltyTableAlias}.name LIKE '%จักษุ%' THEN '07. จักษุ'
      WHEN ${tableAlias}.spclty = '11' OR ${spcltyTableAlias}.name LIKE '%ทันต%' THEN '08. ทันตกรรม'
      WHEN ${tableAlias}.spclty = '09' OR ${spcltyTableAlias}.name LIKE '%จิตเวช%' THEN '09. จิตเวช'
      ELSE '10. อื่นๆ'
    END`;
  }
  return `CASE
    WHEN ${tableAlias}.spclty IN ('01', '21') OR ${spcltyTableAlias}.name LIKE '%อายุร%' THEN 'medicine'
    WHEN ${tableAlias}.spclty = '02' OR (${spcltyTableAlias}.name LIKE '%ศัลยกรรม%' AND ${spcltyTableAlias}.name NOT LIKE '%กระดูก%' AND ${spcltyTableAlias}.name NOT LIKE '%ออร์โธ%') THEN 'surgery'
    WHEN ${tableAlias}.spclty IN ('03', '04') OR ${spcltyTableAlias}.name LIKE '%สูติ%' OR ${spcltyTableAlias}.name LIKE '%นรีเวช%' THEN 'obgyn'
    WHEN ${tableAlias}.spclty = '05' OR ${spcltyTableAlias}.name LIKE '%กุมาร%' THEN 'pediatrics'
    WHEN ${tableAlias}.spclty = '08' OR ${spcltyTableAlias}.name LIKE '%กระดูก%' OR ${spcltyTableAlias}.name LIKE '%ออร์โธ%' THEN 'orthopedics'
    WHEN ${tableAlias}.spclty = '06' OR ${spcltyTableAlias}.name LIKE '%ENT%' OR ${spcltyTableAlias}.name LIKE '%โสต%' THEN 'ent'
    WHEN ${tableAlias}.spclty = '07' OR ${spcltyTableAlias}.name LIKE '%จักษุ%' THEN 'eye'
    WHEN ${tableAlias}.spclty = '11' OR ${spcltyTableAlias}.name LIKE '%ทันต%' THEN 'dental'
    WHEN ${tableAlias}.spclty = '09' OR ${spcltyTableAlias}.name LIKE '%จิตเวช%' THEN 'psychiatry'
    ELSE 'other'
  END`;
}

function buildRepWhereClause(source, params) {
  const isSeamless = source === 'seamless';
  const whereClauses = [];
  const queryParams = [];

  if (params.rep && String(params.rep).trim()) {
    whereClauses.push('Rep = ?');
    queryParams.push(String(params.rep).trim());
  }

  if (params.ds1 && params.ds2) {
    if (isSeamless) {
      whereClauses.push('AdmDate >= ? AND AdmDate < DATE_ADD(?, INTERVAL 1 DAY)');
      queryParams.push(params.ds1, params.ds2);
    } else {
      whereClauses.push('COALESCE(AdmDate, DchDate) >= ? AND COALESCE(AdmDate, DchDate) < DATE_ADD(?, INTERVAL 1 DAY)');
      queryParams.push(params.ds1, params.ds2);
    }
  } else if (params.fiscalYear) {
    whereClauses.push('YearBudget = ?');
    queryParams.push(String(params.fiscalYear));
  }

  if (params.department && params.department !== 'ALL') {
    if (isSeamless) {
      if (params.department === 'IP') {
        whereClauses.push("(Department = 'IP' OR (IFNULL(Department, '') = '' AND IFNULL(AN, '') <> ''))");
      } else {
        whereClauses.push("(Department = 'OP' OR (IFNULL(Department, '') = '' AND IFNULL(AN, '') = ''))");
      }
    } else {
      whereClauses.push('Department = ?');
      queryParams.push(params.department);
    }
  }

  if (params.fund && params.fund !== 'ALL') {
    const f = String(params.fund);
    if (['UCS', 'OFC', 'SSS', 'LGO', 'STP'].includes(f)) {
      const col = isSeamless ? 'MainInscl' : 'Fund';
      if (f === 'OFC') {
        whereClauses.push(`(${col} LIKE '%CS%' OR ${col} LIKE '%OFC%')`);
      } else if (f === 'LGO') {
        whereClauses.push(`(${col} LIKE '%LG%' OR ${col} LIKE '%LGO%')`);
      } else if (f === 'SSS') {
        whereClauses.push(`(${col} LIKE '%SSS%' OR ${col} LIKE '%SS%')`);
      } else if (f === 'STP') {
        whereClauses.push(`${col} LIKE '%STP%'`);
      } else if (f === 'UCS') {
        whereClauses.push(
          isSeamless
            ? "(MainInscl IN ('UCS', 'WEL', 'UC') OR MainInscl LIKE '%UC%')"
            : "(Fund LIKE '%UC%' OR Fund LIKE 'IP0%' OR Fund LIKE 'OP0%' OR Fund LIKE 'HC%' OR Fund LIKE 'DM%' OR Fund LIKE 'AE%')"
        );
      }
    } else if (f === 'UNKNOWN') {
      whereClauses.push("(Fund IS NULL OR TRIM(Fund) = '')");
    } else {
      whereClauses.push('TRIM(Fund) = ?');
      queryParams.push(f.trim());
    }
  }

  if (!isSeamless && params.subFund && params.subFund !== 'ALL') {
    whereClauses.push('SubFund = ?');
    queryParams.push(params.subFund);
  }

  if (params.status && params.status !== 'ALL') {
    if (params.status === 'paid' || params.status === 'compensated') {
      whereClauses.push('Compensated > 0');
    } else if (params.status === 'denied' || params.status === 'zero') {
      whereClauses.push('(Compensated = 0 OR Compensated IS NULL)');
    } else if (params.status === 'appeal') {
      whereClauses.push(
        isSeamless
          ? '(Compensated < Collected AND Compensated > 0)'
          : "(Appeal = 'Y' OR (Compensated < Income AND Compensated > 0))"
      );
    } else if (params.status === 'has_error') {
      whereClauses.push(
        isSeamless
          ? '(Note IS NOT NULL AND LENGTH(TRIM(Note)) > 0)'
          : '(ErrorCode IS NOT NULL AND LENGTH(TRIM(ErrorCode)) > 0)'
      );
    }
  }

  if (params.errorCode && params.errorCode !== 'ALL') {
    const cleanErr = String(params.errorCode).trim();
    whereClauses.push(isSeamless ? '(Note = ? OR Note LIKE ?)' : '(ErrorCode = ? OR ErrorCode LIKE ?)');
    queryParams.push(cleanErr, `%${cleanErr}%`);
  }

  if (params.hn && String(params.hn).trim()) {
    const cleanHn = String(params.hn).trim();
    whereClauses.push('(HN = ? OR HN LIKE ?)');
    queryParams.push(cleanHn, `%${cleanHn}`);
  }

  if (params.search && String(params.search).trim()) {
    const s = `%${String(params.search).trim()}%`;
    if (isSeamless) {
      whereClauses.push('(Rep LIKE ? OR Fund LIKE ? OR Type LIKE ? OR Ptname LIKE ? OR HN LIKE ? OR Note LIKE ? OR PayNo LIKE ?)');
      queryParams.push(s, s, s, s, s, s, s);
    } else {
      whereClauses.push('(Rep LIKE ? OR Fund LIKE ? OR SubFund LIKE ? OR PtName LIKE ? OR HN LIKE ? OR ErrorCode LIKE ?)');
      queryParams.push(s, s, s, s, s, s);
    }
  }

  return {
    whereSql: whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1',
    queryParams,
  };
}

export default async function rcmDashboardV2Routes(fastify, opts) {
  const hosPool = opts.hosPool || opts.pools?.hosPool;
  const appPool = opts.appPool || opts.pools?.appPool;
  const getCached = opts.getCached;

  const withCache = async (key, ttlMs, fn, refresh = false) => {
    if (typeof getCached === 'function' && !refresh) {
      return getCached(key, ttlMs, fn);
    }
    return fn();
  };

  // ── 1. SSS Dental Report ──
  fastify.get('/api/v1/clinical/rcm/dashboard/sss-dental', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'รายงานทันตกรรมประกันสังคม (RCM SSS Dental Dashboard)' } }, async (request, reply) => {
    const { startDate, endDate, doctorFilter = '', fetchVisits = 'false' } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const wantVisits = fetchVisits === 'true' || fetchVisits === '1';
    const data = await withCache(`dash-sss-dental:${startDate}:${endDate}:${doctorFilter}:${wantVisits}`, 30000, async () => {
      const summaryWhere = [
        'o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)',
        "IFNULL(o.an, '') = ''",
        "o.pttype = '00'",
      ];
      const summaryParams = [startDate, endDate];
      if (doctorFilter) {
        summaryWhere.push('o.doctor = ?');
        summaryParams.push(doctorFilter);
      }

      const [summaryRows] = await hosPool.query(
        `
        SELECT 
          IFNULL(o.doctor, 'UNKNOWN') AS doctor_code,
          IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')) AS doctor_name,
          DATE_FORMAT(o.vstdate, '%Y-%m') AS ym,
          COUNT(DISTINCT o.vn) AS visits,
          SUM(IFNULL(v.income, 0)) AS income,
          SUM(IFNULL(v.uc_money, 0)) AS uc_money,
          SUM(IFNULL(v.discount_money, 0)) AS discount_money,
          SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
          SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
        FROM ovst o
        INNER JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN doctor d ON d.code = o.doctor
        WHERE ${summaryWhere.join(' AND ')}
        GROUP BY IFNULL(o.doctor, 'UNKNOWN'), IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')), DATE_FORMAT(o.vstdate, '%Y-%m')
        ORDER BY doctor_name ASC, ym ASC
      `,
        summaryParams
      );

      let visitRows;
      if (wantVisits) {
        const [vRows] = await hosPool.query(
          `
          SELECT 
            o.vn,
            o.hn,
            IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            IFNULL(pt.sex, '') AS sex_code,
            CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
            IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            IFNULL(k.department, o.main_dep) AS department,
            IFNULL(v.pdx, '') AS pdx,
            IFNULL(icd.name, v.pdx) AS pdxname,
            IFNULL(o.doctor, '') AS doctor_code,
            IFNULL(d.name, o.doctor) AS doctor_name,
            IFNULL(v.income, 0) AS income,
            IFNULL(v.uc_money, 0) AS uc_money,
            IFNULL(v.discount_money, 0) AS discount_money,
            IFNULL(v.paid_money, 0) AS paid_money,
            IFNULL(v.rcpt_money, 0) AS rcpt_money,
            (IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit,
            IFNULL(v.rcpno_list, '') AS rcpno
          FROM ovst o
          INNER JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
          LEFT JOIN icd101 icd ON icd.code = v.pdx
          LEFT JOIN doctor d ON d.code = o.doctor
          WHERE ${summaryWhere.join(' AND ')}
          ORDER BY o.vstdate DESC, o.vsttime DESC
        `,
          summaryParams
        );
        visitRows = vRows;
      }

      return { summaryRows, visitRows };
    });

    return reply.send({ success: true, data });
  });

  // ── 2. OPD Doctor Summary ──
  fastify.get('/api/v1/clinical/rcm/dashboard/opd-doctor-summary', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'สรุปรายรับผู้ป่วยนอกแยกตามแพทย์ (RCM OPD Doctor Summary)' } }, async (request, reply) => {
    const { startDate, endDate, eclaimsParam = '' } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(`dash-opd-doc:${startDate}:${endDate}:${eclaimsParam}`, 30000, async () => {
      const [allPttypeRows] = await hosPool.query(`
        SELECT code, name
        FROM pttype_eclaim
        ORDER BY CAST(code AS UNSIGNED), code ASC
      `);

      const whereClauses = ['v.vstdate >= ? AND v.vstdate < DATE_ADD(?, INTERVAL 1 DAY)'];
      const queryParams = [startDate, endDate];

      if (eclaimsParam && String(eclaimsParam).trim() !== '') {
        const list = String(eclaimsParam)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (list.length > 0) {
          whereClauses.push(`ptt.pttype_eclaim_id IN (${list.map(() => '?').join(',')})`);
          queryParams.push(...list);
        }
      }

      const [rows] = await hosPool.query(
        `
        SELECT 
          IFNULL(o.doctor, 'UNKNOWN') AS doctor_code,
          IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')) AS doctor_name,
          DATE_FORMAT(v.vstdate, '%Y-%m') AS ym,
          COUNT(v.vn) AS visits,
          SUM(IFNULL(v.income, 0)) AS income,
          SUM(IFNULL(v.uc_money, 0)) AS uc_money,
          SUM(IFNULL(v.discount_money, 0)) AS discount_money,
          SUM(IFNULL(v.rcpt_money, 0)) AS rcpt_money,
          SUM(IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit
        FROM vn_stat v
        INNER JOIN ovst o ON o.vn = v.vn AND (o.an IS NULL OR o.an = '')
        INNER JOIN pttype ptt ON ptt.pttype = v.pttype
        LEFT JOIN doctor d ON d.code = o.doctor
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY IFNULL(o.doctor, 'UNKNOWN'), IFNULL(d.name, IFNULL(o.doctor, 'ไม่ระบุชื่อแพทย์')), DATE_FORMAT(v.vstdate, '%Y-%m')
        ORDER BY doctor_name ASC, ym ASC
      `,
        queryParams
      );

      return { allPttypeRows, rows };
    });

    return reply.send({ success: true, data });
  });

  // ── 3. OPD Detailed Report ──
  fastify.get('/api/v1/clinical/rcm/dashboard/opd-detailed', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'รายงานผู้ป่วยนอกรายละเอียดราย Visit (RCM OPD Detailed)' } }, async (request, reply) => {
    const { startDate, endDate, pttype = '', isAll = 'false' } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const includeAll = isAll === 'true' || isAll === '1';
    const data = await withCache(`dash-opd-detail:${startDate}:${endDate}:${pttype}:${includeAll}`, 30000, async () => {
      const queryParams = pttype ? [startDate, endDate, pttype] : [startDate, endDate];
      const [rows] = await hosPool.query(
        `
        SELECT 
          o.vn,
          o.hn,
          IFNULL(o.an, '') AS an,
          IFNULL(pt.cid, '') AS cid,
          CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
          IFNULL(pt.sex, '') AS sex_code,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
          IFNULL(k.department, o.main_dep) AS department,
          IFNULL(sp.name, o.spclty) AS clinic,
          IFNULL(v.pdx, '') AS pdx,
          IFNULL(icd.name, v.pdx) AS pdxname,
          IFNULL(o.pttype, '') AS pttype,
          IFNULL(ptt.name, o.pttype) AS pttypename,
          IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
          IFNULL(e.name, '') AS pttype_eclaim_name,
          IFNULL(e.ar_opd, '') AS accountcode,
          IFNULL(v.income, 0) AS income,
          IFNULL(v.uc_money, 0) AS uc_money,
          IFNULL(v.discount_money, 0) AS discount_money,
          IFNULL(v.paid_money, 0) AS paid_money,
          IFNULL(v.rcpt_money, 0) AS rcpt_money,
          IFNULL(v.rcpno_list, '') AS rcpno,
          (IFNULL(v.income, 0) - IFNULL(v.discount_money, 0) - IFNULL(v.rcpt_money, 0)) AS debit,
          IFNULL(d.name, o.doctor) AS doctorname,
          0 AS ct,
          0 AS cm
        FROM ovst o
        LEFT JOIN vn_stat v ON v.vn = o.vn
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
        LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
        LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
        LEFT JOIN spclty sp ON sp.spclty = o.spclty
        LEFT JOIN icd101 icd ON icd.code = v.pdx
        LEFT JOIN doctor d ON d.code = o.doctor
        WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
        ${!includeAll ? "AND IFNULL(o.an, '') = ''" : ''}
        ${pttype ? 'AND o.pttype = ?' : ''}
        GROUP BY o.vn
        ORDER BY o.vstdate DESC, o.vsttime DESC
      `,
        queryParams
      );
      return rows;
    });
    return reply.send({ success: true, data });
  });

  // ── 4. OPD Department Summary ──
  fastify.get('/api/v1/clinical/rcm/dashboard/opd-department-summary', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'สรุปรายรับผู้ป่วยนอกแยกตาม 10 สาขาแผนก (RCM OPD Dept Summary)' } }, async (request, reply) => {
    const { startDate, endDate } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(`dash-opd-dept:${startDate}:${endDate}`, 300000, async () => {
      const opdDeptCase = buildDepartmentSqlCase('o', 's', 'label');
      const [rows] = await hosPool.query(
        `
        SELECT 
          dept_group,
          COUNT(DISTINCT t.hn) AS patients,
          COUNT(DISTINCT t.vn) AS visits
        FROM (
          SELECT 
            o.hn,
            o.vn,
            ${opdDeptCase} AS dept_group
          FROM ovst o
          LEFT JOIN spclty s ON s.spclty = o.spclty
          WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
        ) t
        GROUP BY dept_group

        UNION ALL

        SELECT 
          'รวมทั้งหมด' AS dept_group,
          COUNT(DISTINCT o.hn) AS patients,
          COUNT(DISTINCT o.vn) AS visits
        FROM ovst o
        WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY dept_group
      `,
        [startDate, endDate, startDate, endDate]
      );
      return rows;
    });
    return reply.send({ success: true, data });
  });

  // ── 5. IPD Report ──
  fastify.get('/api/v1/clinical/rcm/dashboard/ipd-report', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'รายงานผู้ป่วยในและค่ารักษาพยาบาลราย AN (RCM IPD Report)' } }, async (request, reply) => {
    const { startDate, endDate, pttype = '' } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(`dash-ipd-report:${startDate}:${endDate}:${pttype}`, 30000, async () => {
      const queryParams = pttype ? [startDate, endDate, pttype] : [startDate, endDate];
      const [rows] = await hosPool.query(
        `
        SELECT 
          i.an,
          i.hn,
          IFNULL(pt.cid, '') AS cid,
          CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
          IFNULL(pt.sex, '') AS sex_code,
          CASE pt.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
          DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
          DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
          IFNULL(DATEDIFF(i.dchdate, i.regdate), 0) AS los,
          DATE_FORMAT(idx.modify_datetime, '%Y-%m-%d') AS editdate,
          DATEDIFF(idx.modify_datetime, i.dchdate) AS summary_days,
          IFNULL(i.ward, '') AS ward,
          IFNULL(w.name, i.ward) AS ward_name,
          '' AS bedno,
          IFNULL(sp.name, i.spclty) AS clinic,
          IFNULL(i.prediag, '') AS prediag,
          IFNULL(a.pdx, '') AS pdx,
          IFNULL(icd.name, a.pdx) AS pdxname,
          '' AS sdx,
          '' AS proc,
          IFNULL(i.adjrw, 0) AS adjrw,
          IFNULL(d1.name, i.admdoctor) AS admdoctor,
          IFNULL(d2.name, i.dch_doctor) AS dchdoctor,
          '' AS authencode,
          IFNULL(i.pttype, '') AS pttype,
          IFNULL(ptt.name, i.pttype) AS pttypename,
          IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
          IFNULL(e.ar_ipd, '') AS accountcode,
          '' AS hospmain,
          '' AS hospsub,
          IFNULL(ds.name, i.dchstts) AS dchstts,
          IFNULL(dt.name, i.dchtype) AS dchtype,
          IF(idx.modify_datetime IS NOT NULL, 'สรุปผลแล้ว', 'รอสรุป') AS status,
          IFNULL(a.income, 0) AS income,
          IFNULL(a.uc_money, 0) AS uc_money,
          IFNULL(a.discount_money, 0) AS discount_money,
          IFNULL(a.paid_money, 0) AS paid_money,
          IFNULL(a.rcpt_money, 0) AS rcpt_money,
          IFNULL(a.rcpno_list, '') AS rcpno,
          (IFNULL(a.income, 0) - IFNULL(a.discount_money, 0) - IFNULL(a.rcpt_money, 0)) AS debit
        FROM ipt i
        LEFT JOIN an_stat a ON a.an = i.an
        LEFT JOIN patient pt ON i.hn = pt.hn
        LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
        LEFT JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
        LEFT JOIN ward w ON w.ward = i.ward
        LEFT JOIN spclty sp ON sp.spclty = i.spclty
        LEFT JOIN icd101 icd ON icd.code = a.pdx
        LEFT JOIN doctor d1 ON d1.code = i.admdoctor
        LEFT JOIN doctor d2 ON d2.code = i.dch_doctor
        LEFT JOIN dchstts ds ON ds.dchstts = i.dchstts
        LEFT JOIN dchtype dt ON dt.dchtype = i.dchtype
        LEFT JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
        WHERE i.dchdate >= ? AND i.dchdate < DATE_ADD(?, INTERVAL 1 DAY)
        ${pttype ? 'AND i.pttype = ?' : ''}
        GROUP BY i.an
        ORDER BY i.dchdate DESC, i.an DESC
      `,
        queryParams
      );
      return rows;
    });
    return reply.send({ success: true, data });
  });

  // ── 6. IPD Department AdjRW ──
  fastify.get('/api/v1/clinical/rcm/dashboard/ipd-department-adjrw', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'สรุปผู้ป่วยใน AdjRW และ CMI แยกตาม 10 สาขาแผนก' } }, async (request, reply) => {
    const { startDate, endDate } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(`dash-ipd-adjrw:${startDate}:${endDate}`, 30000, async () => {
      const ipdDeptCase = buildDepartmentSqlCase('i', 's', 'key');
      const [rows] = await hosPool.query(
        `
        SELECT 
          CASE WHEN MONTH(i.dchdate) >= 10 THEN MONTH(i.dchdate) - 9 ELSE MONTH(i.dchdate) + 3 END AS sort_order,
          CONCAT(
            ELT(MONTH(i.dchdate), 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'),
            '-',
            RIGHT(YEAR(i.dchdate) + 543, 2)
          ) AS dch_month,
          ${ipdDeptCase} AS dept_key,
          COUNT(DISTINCT i.hn) AS patients,
          COUNT(DISTINCT i.an) AS visits,
          ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
          ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
        FROM ipt i
        LEFT JOIN spclty s ON s.spclty = i.spclty
        WHERE i.dchdate >= ? AND i.dchdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY YEAR(i.dchdate), MONTH(i.dchdate), dept_key

        UNION ALL

        SELECT 
          CASE WHEN MONTH(i.dchdate) >= 10 THEN MONTH(i.dchdate) - 9 ELSE MONTH(i.dchdate) + 3 END AS sort_order,
          CONCAT(
            ELT(MONTH(i.dchdate), 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'),
            '-',
            RIGHT(YEAR(i.dchdate) + 543, 2)
          ) AS dch_month,
          'total' AS dept_key,
          COUNT(DISTINCT i.hn) AS patients,
          COUNT(DISTINCT i.an) AS visits,
          ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
          ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
        FROM ipt i
        LEFT JOIN spclty s ON s.spclty = i.spclty
        WHERE i.dchdate >= ? AND i.dchdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY YEAR(i.dchdate), MONTH(i.dchdate)

        UNION ALL

        SELECT 
          99 AS sort_order,
          'รวม' AS dch_month,
          ${ipdDeptCase} AS dept_key,
          COUNT(DISTINCT i.hn) AS patients,
          COUNT(DISTINCT i.an) AS visits,
          ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
          ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
        FROM ipt i
        LEFT JOIN spclty s ON s.spclty = i.spclty
        WHERE i.dchdate >= ? AND i.dchdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY dept_key

        UNION ALL

        SELECT 
          99 AS sort_order,
          'รวม' AS dch_month,
          'total' AS dept_key,
          COUNT(DISTINCT i.hn) AS patients,
          COUNT(DISTINCT i.an) AS visits,
          ROUND(SUM(IFNULL(i.adjrw, 0)), 4) AS adjrw,
          ROUND(SUM(IFNULL(i.adjrw, 0)) / NULLIF(COUNT(DISTINCT i.an), 0), 4) AS cmi
        FROM ipt i
        LEFT JOIN spclty s ON s.spclty = i.spclty
        WHERE i.dchdate >= ? AND i.dchdate < DATE_ADD(?, INTERVAL 1 DAY)

        ORDER BY sort_order, dept_key
      `,
        [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]
      );
      return rows;
    });
    return reply.send({ success: true, data });
  });

  // ── 7. IPD Doctor Chart Summary (Telegram Notification) ──
  fastify.get('/api/v1/clinical/rcm/dashboard/ipd-doctor-chart-summary', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'สรุปชาร์ตผู้ป่วยในแยกตามแพทย์เจ้าของไข้' } }, async (request, reply) => {
    const { startDate, endDate } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const [[docRows], [grandRows]] = await Promise.all([
      hosPool.query(
        `
        SELECT 
          IFNULL(i.dch_doctor, 'UNKNOWN') AS doctor_code,
          IFNULL(d2.name, IFNULL(i.dch_doctor, 'ไม่ระบุแพทย์')) AS doctor_name,
          COUNT(DISTINCT i.an) AS total_charts,
          COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NOT NULL THEN i.an END) AS completed_charts,
          COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NULL THEN i.an END) AS uncompleted_charts
        FROM ipt i
        LEFT JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
        LEFT JOIN doctor d2 ON d2.code = i.dch_doctor
        WHERE i.dchdate >= ? AND i.dchdate < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY IFNULL(i.dch_doctor, 'UNKNOWN'), IFNULL(d2.name, IFNULL(i.dch_doctor, 'ไม่ระบุแพทย์'))
        HAVING uncompleted_charts > 0
        ORDER BY uncompleted_charts DESC, total_charts DESC
      `,
        [startDate, endDate]
      ),
      hosPool.query(
        `
        SELECT 
          COUNT(DISTINCT i.an) AS total_charts,
          COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NOT NULL THEN i.an END) AS completed_charts,
          COUNT(DISTINCT CASE WHEN idx.modify_datetime IS NULL THEN i.an END) AS uncompleted_charts
        FROM ipt i
        LEFT JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
        WHERE i.dchdate >= ? AND i.dchdate < DATE_ADD(?, INTERVAL 1 DAY)
      `,
        [startDate, endDate]
      ),
    ]);
    return reply.send({ success: true, data: { docRows, grandRows } });
  });

  // ── 8. Palliative Care Report ──
  fastify.get('/api/v1/clinical/rcm/dashboard/palliative-care', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'รายงานแดชบอร์ดผู้ป่วย Palliative Care (RCM)' } }, async (request, reply) => {
    const { startDate, endDate, refresh } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(
      `dash-palliative-care:${startDate}:${endDate}`,
      300000,
      async () => {
        const [rows] = await hosPool.query(
          `
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
            COALESCE(NULLIF(TRIM(pt.mobile_phone_number),''), NULLIF(TRIM(pt.informtel),''), NULLIF(TRIM(pt.hometel),''), '') AS tel,
            IFNULL(s.cc, '') AS cc,
            IFNULL(k.department, o.main_dep) AS room,
            IFNULL(sp.name, o.spclty) AS spclty,
            CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) AS Diag,
            CONCAT_WS(',', v.op0, v.op1, v.op2, v.op3, v.op4, v.op5) AS Oper,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'Z515', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Z515,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'B2[0-4]|^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Dx,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'Z718', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Z718,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^C|D3[7-9]|D4', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Cancer,
            IFNULL(dr.Drug, '') AS Drug,
            IFNULL(pt.death, 'N') AS death,
            DATE_FORMAT(pt.deathday, '%Y-%m-%d') AS death_date,
            IF(e.vn IS NULL AND rd.vn IS NULL, ' ', 'Y') AS OK,
            COALESCE(e.PallativeCare, rd.PallativeCare, 0) AS compensated,
            COALESCE(NULLIF(CONCAT_WS('#', e.rep, e.id), ''), NULLIF(CONCAT_WS('#', rd.rep, rd.id), ''), '') AS rep_invoice,
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
          LEFT JOIN (
            SELECT DISTINCT oo.vn, 'Y' AS Drug
            FROM opitemrece oo
            JOIN drugitems d ON d.icode = oo.icode
            WHERE d.nhso_adp_code REGEXP '^M'
              AND oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
          ) dr ON dr.vn = o.vn
          LEFT JOIN opdscreen s ON s.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype 
          LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
          LEFT JOIN spclty sp ON sp.spclty = o.spclty
          LEFT JOIN (
            SELECT
              vn,
              SUM(PallativeCare) AS PallativeCare,
              SUBSTRING_INDEX(GROUP_CONCAT(rep ORDER BY PallativeCare DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY PallativeCare DESC, AdmDate DESC, id DESC), ',', 1) AS id
            FROM rcmdb.repeclaim
            WHERE PallativeCare > 0
              AND IFNULL(vn, '') <> ''
            GROUP BY vn
          ) e ON e.vn = o.vn
          LEFT JOIN (
            SELECT
              vn,
              SUM(PallativeCare) AS PallativeCare,
              SUBSTRING_INDEX(GROUP_CONCAT(rep ORDER BY PallativeCare DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY PallativeCare DESC, AdmDate DESC, id DESC), ',', 1) AS id
            FROM rcmdb.repdata
            WHERE PallativeCare > 0
              AND IFNULL(vn, '') <> ''
            GROUP BY vn
          ) rd ON rd.vn = o.vn
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
          WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
            AND IFNULL(o.pttype, '') NOT IN ('H1', '35', '36')
            AND dx.icd10 REGEXP 'B2[0-4]|^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185|Z515|Z718'
          GROUP BY o.vn
          HAVING Dx = 'Y'
          ORDER BY o.hn ASC
        `,
          [startDate, endDate, startDate, endDate]
        );
        return rows;
      },
      refresh === 'true'
    );
    return reply.send({ success: true, data });
  });

  // ── 9. Palliative Care PC.1 (ADP 30001) ──
  fastify.get('/api/v1/clinical/rcm/dashboard/palliative-care-pc1', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'รายงานผู้ป่วย Palliative Care กลุ่ม PC1 (RCM)' } }, async (request, reply) => {
    const { startDate, endDate, refresh } = request.query || {};
    if (!startDate || !endDate) {
      return reply.code(400).send({ success: false, error: 'startDate and endDate required' });
    }
    const data = await withCache(
      `dash-palliative-pc1:${startDate}:${endDate}`,
      300000,
      async () => {
        const [rows] = await hosPool.query(
          `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
            IFNULL(n.name, IFNULL(pt.nationality, '')) AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            IFNULL(cc.AuthenCode, '') AS authencode,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            IFNULL(k.department, o.main_dep) AS department,
            IFNULL(sp.name, o.spclty) AS clinic,
            v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
            dd.listname,
            rd.rep,
            IFNULL(rd.compensated, 0) AS compensated,
            rd.TransactionType AS transaction_type,
            re.rep AS invoice,
            IFNULL(re.compensated, 0) AS invoice_compensated,
            re.resource,
            rd.subfund,
            rd.remark,
            rd.projectcode
          FROM ovst o
          JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, d.strength) SEPARATOR ', ') AS listname
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND d.nhso_adp_code IN ('30001')
            GROUP BY oo.vn
          ) dd ON dd.vn = o.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality n ON n.nationality = pt.nationality
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
          LEFT JOIN spclty sp ON sp.spclty = o.spclty
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN (
            SELECT
              vn,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUM(IFNULL(compensated, 0)) AS compensated,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(TransactionType, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS TransactionType,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(subfund, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS subfund,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(remark, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS remark,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(projectcode, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS projectcode
            FROM rcmdb.repdata
            WHERE IFNULL(vn, '') <> ''
              AND AdmDate >= DATE_SUB(?, INTERVAL 1 DAY)
              AND AdmDate < DATE_ADD(?, INTERVAL 2 DAY)
            GROUP BY vn
          ) rd ON rd.vn = o.vn
          LEFT JOIN (
            SELECT
              vn,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUM(IFNULL(compensated, 0)) AS compensated,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(resource, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS resource
            FROM rcmdb.repeclaim
            WHERE IFNULL(vn, '') <> ''
              AND AdmDate >= DATE_SUB(?, INTERVAL 1 DAY)
              AND AdmDate < DATE_ADD(?, INTERVAL 2 DAY)
            GROUP BY vn
          ) re ON re.vn = o.vn
          WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC
        `,
          [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]
        );
        return rows;
      },
      refresh === 'true'
    );
    return reply.send({ success: true, data });
  });

  // ── 10. VN Clinical Details ──
  fastify.get('/api/v1/clinical/rcm/dashboard/vn-details/:vn', { schema: { tags: ['04. RCM — Dashboard, OPD/IPD & Debt'], summary: 'รายละเอียดค่าใช้จ่าย ยา หัตถการ และ REP ของ Visit (VN Details)' } }, async (request, reply) => {
    const cleanVn = String(request.params?.vn || '').trim();
    if (!cleanVn) {
      return reply.code(400).send({ success: false, error: 'vn is required' });
    }

    const [[headerRows], [screenRows], [diagRows], [orderRows]] = await Promise.all([
      hosPool.query(
        `
        SELECT 
          o.vn, o.hn, IFNULL(pt.cid, '') AS cid,
          CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
          CASE WHEN pt.sex = '1' THEN 'ชาย' WHEN pt.sex = '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
          IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
          DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
          IFNULL(o.vsttime, '') AS vsttime,
          IFNULL(p.name, IFNULL(o.pttype, '')) AS pttypename,
          IFNULL(k.department, IFNULL(o.main_dep, '')) AS department,
          IFNULL(s.name, IFNULL(o.spclty, '')) AS clinic
        FROM ovst o
        LEFT JOIN patient pt ON pt.hn = o.hn
        LEFT JOIN pttype p ON p.pttype = o.pttype
        LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
        LEFT JOIN spclty s ON s.spclty = o.spclty
        WHERE o.vn = ?
        LIMIT 1
      `,
        [cleanVn]
      ),
      hosPool.query(
        `
        SELECT 
          s.bw, s.height, s.bmi, s.bps, s.bpd, s.pulse, s.rr, s.temperature, s.spo2, s.fbs,
          s.cc, s.hpi, s.pmh, s.pe, s.screen_dep,
          IFNULL(k.department, s.screen_dep) AS screen_dep_name,
          s.symptom
        FROM opdscreen s
        LEFT JOIN kskdepartment k ON k.depcode = s.screen_dep
        WHERE s.vn = ?
        LIMIT 1
      `,
        [cleanVn]
      ),
      hosPool.query(
        `
        SELECT 
          d.icd10,
          IFNULL(i.name, d.icd10) AS icd_name,
          IFNULL(d.diagtype, '') AS diagtype,
          IFNULL(dt.name, CASE d.diagtype 
            WHEN '1' THEN 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)' 
            WHEN '2' THEN 'CO-MORBIDITY (การวินิจฉัยโรคร่วม)' 
            WHEN '3' THEN 'COMPLICATION (ภาวะแทรกซ้อน)' 
            WHEN '4' THEN 'OTHER (การวินิจฉัยอื่นๆ)' 
            WHEN '5' THEN 'EXTERNAL CAUSE (สาเหตุภายนอก)' 
            ELSE 'ไม่ระบุประเภท' END) AS diagtype_name,
          IFNULL(doc.name, '') AS doctor_name
        FROM ovstdiag d
        LEFT JOIN icd101 i ON i.code = d.icd10
        LEFT JOIN diagtype dt ON dt.diagtype = d.diagtype
        LEFT JOIN doctor doc ON doc.code = d.doctor
        WHERE d.vn = ?
        ORDER BY d.diagtype ASC, d.ovst_diag_id ASC
      `,
        [cleanVn]
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
          IFNULL(o.paidst, '') AS paidst,
          IFNULL(pst.name, CASE o.paidst 
            WHEN '01' THEN 'ชำระเองเบิกได้' 
            WHEN '02' THEN 'ลูกหนี้สิทธิ' 
            WHEN '03' THEN 'ชำระเองเบิกไม่ได้' 
            WHEN '00' THEN 'ค้างชำระ' 
            ELSE o.paidst END) AS paidst_name,
          IFNULL(o.income, '') AS income_code,
          IFNULL(inc.name, '') AS income_name,
          CONCAT_WS(' ', du.name1, du.name2, du.name3, sp.name1, sp.name2, sp.name3) AS drugusage_text,
          IF(d.icode IS NOT NULL, 1, 0) AS is_drug
        FROM opitemrece o
        LEFT JOIN s_drugitems d ON d.icode = o.icode
        LEFT JOIN nondrugitems nd ON nd.icode = o.icode
        LEFT JOIN paidst pst ON pst.paidst = o.paidst
        LEFT JOIN income inc ON inc.income = o.income
        LEFT JOIN drugusage du ON du.drugusage = o.drugusage
        LEFT JOIN sp_use sp ON sp.sp_use = o.sp_use
        WHERE o.vn = ?
        ORDER BY o.income ASC, o.item_no ASC, o.icode ASC
      `,
        [cleanVn]
      ),
    ]);

    return reply.send({
      success: true,
      data: { headerRows, screenRows, diagRows, orderRows },
    });
  });
}
