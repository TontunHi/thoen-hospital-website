// Thoen Hospital API Gateway Plugin: Clinical Core V2 (ER Live Dashboard, IPD Bed/OR Status, Lab Tracker, Member Perm Check)

export default async function clinicalCoreV2Routes(fastify, { pools, getCached }) {
  const { hosPool, appPool } = pools

  // 1. ER Live Dashboard (active patients + 3 monthly stats + error status list)
  fastify.get('/api/v1/clinical/er/live-dashboard', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ข้อมูลสถานะห้องฉุกเฉิน ER แบบครบชุด (activePatients, errorStatusList, summary, stats)',
    }
  }, async (_req, reply) => {
    try {
      const data = await getCached('clinical-er-live-dashboard-v2', 8000, async () => {
        const [
          [activePatients],
          [ptTypes],
          [emergencyLevels],
          [dischargeTypes],
          [errorStatusRows],
        ] = await Promise.all([
          hosPool.query(`
            SELECT
              pt.hn, er.vn,
              concat(coalesce(pt.pname, ''), coalesce(pt.fname, ''), ' ', coalesce(pt.lname, '')) as ptname,
              YEAR(current_date)-YEAR(pt.birthday) as age,
              i.bedno, time(er.enter_er_time) as enter_time, er.er_list,
              eel.er_emergency_level_name, er.er_emergency_level_id, er.observe,
              edt.name as dch_type_name, w.name as wardname, h.name as hosname
            FROM er_regist er
            left outer join vn_stat vn on er.vn=vn.vn
            left outer join patient pt on vn.hn=pt.hn
            left outer join er_emergency_level eel on er.er_emergency_level_id=eel.er_emergency_level_id
            left outer join er_dch_type edt on er.er_dch_type=edt.er_dch_type
            left outer join an_stat an on er.vn=an.vn
            left outer join iptadm i on an.an=i.an
            left outer join ward w on an.ward=w.ward
            left outer join referout r on vn.vn=r.vn
            left outer join hospcode h on r.refer_hospcode=h.hospcode
            WHERE er.vstdate = current_date
              and ((er.er_dch_type in ('2','3','5','6','7','8','9') and w.name is null) and h.name is null)
            ORDER BY er.enter_er_time DESC
          `),
          hosPool.query(`
            select count(er.vn) as v, ept.name
            from er_regist er
            left outer join er_period ep on er.er_period=ep.er_period
            left outer join er_pt_type ept on er.er_pt_type=ept.er_pt_type
            where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE()
            group by er.er_pt_type
          `),
          hosPool.query(`
            select count(er.vn) as v, ept.er_emergency_level_name
            from er_regist er
            left outer join er_period ep on er.er_period=ep.er_period
            left outer join er_emergency_level ept on er.er_emergency_level_id=ept.er_emergency_level_id
            where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE()
              and er.er_emergency_level_id is not null
            group by ept.er_emergency_level_name
            order by ept.er_emergency_level_id
          `),
          hosPool.query(`
            select count(er.vn) as v, ept.name
            from er_regist er
            left outer join er_period ep on er.er_period=ep.er_period
            left outer join er_dch_type ept on er.er_dch_type=ept.er_dch_type
            where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE()
              and ept.er_dch_type is not null
            group by ept.name
            order by ept.er_dch_type
          `),
          hosPool.query(`
            SELECT d.\`name\` as nname, er.vstdate, pt.hn, er.vn, edt.name as status_name
            FROM er_regist er
            left outer join vn_stat vn on er.vn=vn.vn
            left outer join patient pt on vn.hn=pt.hn
            left outer join er_dch_type edt on er.er_dch_type=edt.er_dch_type
            left outer join doctor d on er.er_doctor=d.\`code\`
            WHERE (er.vstdate between DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 day),INTERVAL - 7 MONTH)
                   and DATE_ADD(DATE_ADD(CURDATE(),INTERVAL -1 day),INTERVAL 0 MONTH))
              and (er.er_dch_type in ('5','6','7','8','9'))
            ORDER BY er.vstdate DESC
          `),
        ])

        const list = activePatients || []
        const errRows = errorStatusRows || []
        return {
          activePatients: list,
          errorStatusList: { total: errRows.length, list: errRows },
          summary: {
            totalActive: list.length,
            critical: list.filter((p) => Number(p.er_emergency_level_id) === 1).length,
            emergency: list.filter((p) => Number(p.er_emergency_level_id) === 2).length,
            urgency: list.filter((p) => Number(p.er_emergency_level_id) === 3).length,
            semiUrgency: list.filter((p) => Number(p.er_emergency_level_id) === 4).length,
            nonUrgency: list.filter((p) => Number(p.er_emergency_level_id) === 5).length,
          },
          stats: {
            ptTypes: ptTypes || [],
            emergencyLevels: emergencyLevels || [],
            dischargeTypes: dischargeTypes || [],
          },
        }
      })
      return { success: true, data }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 2. IPD Bed Status Raw Aggregates (consolidates 26 parallel queries into 1 Gateway call)
  fastify.get('/api/v1/clinical/ipd/bed-status-raw', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ข้อมูลเตียงผู้ป่วยใน ICNP และสัดส่วนแผนกทั้งหมดในคำขอเดียว',
    }
  }, async (_req, reply) => {
    try {
      const data = await getCached('clinical-ipd-bed-status-raw-v2', 20000, async () => {
        const q = (sql) => hosPool.query(sql).then(([rows]) => rows || [])
        const wardIds = ['06', '05', '04', '02', '09']
        const [
          opdResult,
          wardOccupancyResult,
          vipRoomResult,
          vipRoomPersonResult,
          deliveryPreResult,
          deliveryPostResult,
          admitTodayResult,
          dischargeTodayResult,
          overallOccupancyResult,
          wardOccupancyRateResult,
          icuVentilatorResult,
          ...rest
        ] = await Promise.all([
          q(`SELECT COUNT(DISTINCT o.hn) AS opdCount FROM ovst o WHERE o.vstdate = CURRENT_DATE`),
          q(`SELECT i.ward, COUNT(i.an) AS occupiedBeds FROM ipt i WHERE i.dchtype IS NULL AND i.ward IN ('02', '04', '05', '06', '09') GROUP BY i.ward`),
          q(`SELECT COUNT(DISTINCT b.bedno) AS occupiedBeds FROM ipt i LEFT OUTER JOIN iptadm b ON i.an = b.an WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%'`),
          q(`SELECT COUNT(b.bedno) AS personCount FROM ipt i LEFT OUTER JOIN iptadm b ON i.an = b.an WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%'`),
          q(`SELECT COUNT(DISTINCT ip.bedno) AS occupiedBeds FROM ipt i LEFT OUTER JOIN iptadm ip ON i.an = ip.an WHERE i.dchtype IS NULL AND i.ward = '02' AND ip.bedno <> '' AND ip.bedno LIKE 'C0%'`),
          q(`SELECT COUNT(DISTINCT ip.bedno) AS occupiedBeds FROM ipt i LEFT OUTER JOIN iptadm ip ON i.an = ip.an WHERE i.dchtype IS NULL AND i.ward = '02' AND ip.bedno <> '' AND ip.bedno LIKE 'CP%'`),
          q(`SELECT i.ward, COUNT(i.an) AS admitCount FROM ipt i WHERE i.regdate = CURRENT_DATE AND i.ward IN ('02', '04', '05', '06', '09') GROUP BY i.ward`),
          q(`SELECT i.ward, COUNT(i.an) AS dischargeCount FROM ipt i WHERE i.dchdate = CURRENT_DATE AND i.ward IN ('02', '04', '05', '06', '09') GROUP BY i.ward`),
          q(`SELECT SUM(admdate) AS totalAdmDays, DAY(LAST_DAY(CURRENT_DATE)) AS daysInMonth FROM an_stat WHERE dchdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(CURRENT_DATE), INTERVAL 1 DAY), INTERVAL -1 MONTH) AND LAST_DAY(CURRENT_DATE)`),
          q(`SELECT ward, SUM(admdate) AS totalAdmDays, DAY(CURRENT_DATE) AS daysSoFar FROM an_stat WHERE ward IN ('02', '04', '05', '06', '09') AND dchdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(CURRENT_DATE), INTERVAL 1 DAY), INTERVAL -1 MONTH) AND LAST_DAY(CURRENT_DATE) GROUP BY ward`),
          q(`SELECT COUNT(i.an) AS onVentilator FROM ipt i LEFT OUTER JOIN opitemrece o ON i.an = o.an AND o.rxdate = CURRENT_DATE AND o.icode IN ('3002054', '3002024', '3002025') WHERE i.dchtype IS NULL AND i.ward = '05' AND o.rxdate IS NOT NULL`),
          ...wardIds.map((w) =>
            q(`SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName FROM ipt i LEFT OUTER JOIN spclty s ON i.spclty = s.spclty WHERE i.dchdate IS NULL AND i.ward = '${w}' GROUP BY i.spclty`)
          ),
          ...wardIds.map((w) =>
            w === '04'
              ? q(`SELECT COUNT(b.bedno) AS can, ic.icnp_classification_name AS icnpName FROM ipt i LEFT OUTER JOIN ward w ON i.ward = w.ward LEFT OUTER JOIN ipt_icnp ii ON i.an = ii.an LEFT OUTER JOIN icnp_classification ic ON ii.icnp_classification_id = ic.icnp_classification_id LEFT OUTER JOIN iptadm b ON ii.an = b.an WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%' AND ic.icnp_classification_name IS NOT NULL GROUP BY ii.icnp_classification_id ORDER BY ic.icnp_classification_id DESC`)
              : q(`SELECT COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName FROM ipt_icnp i LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id LEFT OUTER JOIN ipt ii ON i.an = ii.an WHERE ii.dchdate IS NULL AND ii.ward = '${w}' AND ic.icnp_classification_name IS NOT NULL GROUP BY i.icnp_classification_id ORDER BY i.icnp_classification_id DESC`)
          ),
          ...wardIds.map((w) =>
            q(`SELECT DISTINCT i.bedno FROM iptadm i LEFT OUTER JOIN ipt_icnp p ON i.an = p.an LEFT OUTER JOIN an_stat a ON a.an = i.an WHERE a.dchdate IS NULL AND a.ward = '${w}' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> '' ORDER BY i.bedno ASC`)
          ),
        ])

        return {
          opdResult,
          wardOccupancyResult,
          vipRoomResult,
          vipRoomPersonResult,
          deliveryPreResult,
          deliveryPostResult,
          admitTodayResult,
          dischargeTodayResult,
          overallOccupancyResult,
          wardOccupancyRateResult,
          icuVentilatorResult,
          specByWard: { '06': rest[0], '05': rest[1], '04': rest[2], '02': rest[3], '09': rest[4] },
          icnpByWard: { '06': rest[5], '05': rest[6], '04': rest[7], '02': rest[8], '09': rest[9] },
          unclassifiedByWard: { '06': rest[10], '05': rest[11], '04': rest[12], '02': rest[13], '09': rest[14] },
        }
      })
      return { success: true, data }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 3. Operating Room Status
  fastify.get('/api/v1/clinical/ipd/or-status', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'สถานะห้องผ่าตัดวันนี้ (รอผ่าตัด / กำลังผ่าตัด / พักฟื้น)',
    }
  }, async (_req, reply) => {
    try {
      const data = await getCached('clinical-ipd-or-status-v2', 10000, async () => {
        const buildSql = (statusId) => `
          SELECT DISTINCT
            op.hn,
            TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''))) AS ptname,
            TIMESTAMPDIFF(YEAR, pt.birthday, CURRENT_DATE()) AS age_text,
            COALESCE(opr.room_name, '-') AS room_name,
            TIME_FORMAT(op.request_time, '%H:%i') AS request_time,
            ops.status_name AS status_name
          FROM operation_list op
          LEFT OUTER JOIN patient pt ON op.hn = pt.hn
          LEFT OUTER JOIN operation_room opr ON op.room_id = opr.room_id
          LEFT OUTER JOIN operation_status ops ON op.status_id = ops.status_id
          WHERE op.operation_date = CURRENT_DATE()
            AND op.status_id IN ('${statusId}')
          ORDER BY op.request_time ASC
        `
        const [[waitingList], [inProgressList], [recoveryList]] = await Promise.all([
          hosPool.query(buildSql('1')),
          hosPool.query(buildSql('2')),
          hosPool.query(buildSql('3')),
        ])
        return {
          waitingList: waitingList || [],
          inProgressList: inProgressList || [],
          recoveryList: recoveryList || [],
        }
      })
      return { success: true, data }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 4. Lab Tracker Report (by doctorCode or all)
  fastify.get('/api/v1/clinical/lab/tracker-report', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ติดตามสถานะผลแล็บ OPD วันนี้แยกตามแพทย์ผู้สั่งตรวจ',
    }
  }, async (req, reply) => {
    try {
      const doctorCode = String(req.query?.doctorCode || '').trim()
      const hasDoc = Boolean(doctorCode && doctorCode !== 'all')
      const cacheKey = `clinical-lab-tracker-report-${hasDoc ? doctorCode : 'all'}`
      const data = await getCached(cacheKey, 10000, async () => {
        const pendingSql = hasDoc
          ? `SELECT d.code, d.name, lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
              time(lh.order_time) as order_time, lh.form_name, time(lh.receive_time) as receive_time
             FROM lab_head lh
             left outer join patient pt on lh.hn=pt.hn
             left outer join doctor d on lh.doctor_code=d.code
             WHERE lh.order_date = CURRENT_DATE() and lh.department = 'OPD' and d.name is not null and lh.report_date is null and d.code = ?
             GROUP BY lh.hn ORDER BY lh.lab_order_number ASC`
          : `SELECT d.code, substring_index(d.name, ' ', 1) as name, lh.hn,
              concat(pt.pname, pt.fname) as ptname, time(lh.order_time) as order_time,
              time(lh.receive_time) as receive_time, lh.form_name
             FROM lab_head lh
             left outer join patient pt on lh.hn=pt.hn
             left outer join doctor d on lh.doctor_code=d.code
             WHERE lh.order_date = CURRENT_DATE() and lh.department = 'OPD' and d.name is not null and lh.report_date is null
             GROUP BY lh.hn ORDER BY lh.lab_order_number ASC`
        const reportedSql = hasDoc
          ? `SELECT d.code, d.name, lh.hn, concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
              time(lh.report_time) as report_time, lh.lab_order_number, ovst.ovstost
             FROM lab_head lh
             left outer join patient pt on lh.hn=pt.hn
             left outer join ovst ovst on lh.hn=ovst.hn
             left outer join doctor d on lh.doctor_code=d.code
             WHERE lh.order_date = CURRENT_DATE() and lh.department = 'OPD' and d.name is not null and lh.report_date is not null and d.code = ?
             GROUP BY lh.hn ORDER BY lh.report_time DESC`
          : `SELECT d.code, substring_index(d.name, ' ', 1) as name, lh.hn,
              concat(pt.pname, pt.fname) as ptname, time(lh.report_time) as report_time,
              lh.lab_order_number, ovst.ovstost
             FROM lab_head lh
             left outer join patient pt on lh.hn=pt.hn
             left outer join ovst ovst on lh.hn=ovst.hn
             left outer join doctor d on lh.doctor_code=d.code
             WHERE lh.order_date = CURRENT_DATE() and lh.department = 'OPD' and d.name is not null and lh.report_date is not null
             GROUP BY lh.hn ORDER BY lh.report_time DESC`
        const params = hasDoc ? [doctorCode] : []
        const [[pendingRows], [reportedRows]] = await Promise.all([
          hosPool.query(pendingSql, params),
          hosPool.query(reportedSql, params),
        ])
        return { pendingRows: pendingRows || [], reportedRows: reportedRows || [] }
      })
      return { success: true, data }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 5. Lab Tracker Doctors
  fastify.get('/api/v1/clinical/lab/tracker-doctors', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายชื่อแพทย์และเจ้าหน้าที่ผู้สั่งแล็บ OPD วันนี้',
    }
  }, async (_req, reply) => {
    try {
      const data = await getCached('clinical-lab-tracker-doctors', 15000, async () => {
        const [[doctors], [others], [totalData]] = await Promise.all([
          hosPool.query(`SELECT d.code, d.name, count(distinct(lh.hn)) as cc FROM lab_head lh left outer join doctor d on lh.doctor_code=d.code WHERE lh.order_date = CURRENT_DATE() and lh.department = 'OPD' and d.name is not null and d.provider_type_code in ('01','011','02') GROUP BY lh.doctor_code ORDER BY d.name`),
          hosPool.query(`SELECT d.code, d.name, count(distinct(lh.hn)) as cc FROM lab_head lh left outer join doctor d on lh.doctor_code=d.code WHERE lh.order_date = CURRENT_DATE() and lh.department = 'OPD' and d.name is not null and d.provider_type_code not in ('01','011','02') GROUP BY lh.doctor_code ORDER BY d.name`),
          hosPool.query(`SELECT count(distinct(lh.hn)) as cc FROM lab_head lh left outer join doctor d on lh.doctor_code=d.code WHERE lh.order_date = CURRENT_DATE() and lh.department = 'OPD' and d.name is not null`),
        ])
        return {
          doctors: doctors || [],
          others: others || [],
          totalCount: Number(totalData?.[0]?.cc) || 0,
        }
      })
      return { success: true, data }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 6. Member direct permission check (replaces raw SQL in memberAuth.ts)
  fastify.post('/api/v1/app/members/check-member-permission', {
    schema: {
      tags: ['3. Website Application (Members & CMS)'],
      summary: 'ตรวจสอบสิทธิ์เฉพาะบุคคลใน member_permissions',
    }
  }, async (req, reply) => {
    try {
      const username = String(req.body?.username || '').trim()
      const keys = Array.isArray(req.body?.keys)
        ? req.body.keys.map((k) => String(k || '').trim()).filter(Boolean)
        : []
      if (!username || keys.length === 0) {
        return { success: true, data: { allowed: false } }
      }
      const ph = keys.map(() => '?').join(', ')
      const [rows] = await appPool.query(
        `SELECT COUNT(*) as count
         FROM member_permissions mp
         JOIN members m ON m.id = mp.member_id
         WHERE (m.username = ? OR m.username = TRIM(?)) AND mp.permission_key IN (${ph})`,
        [username, username, ...keys]
      )
      return { success: true, data: { allowed: Number(rows?.[0]?.count || 0) > 0 } }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })
}
