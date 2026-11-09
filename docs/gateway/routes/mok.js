/**
 * MOK (หมออนามัยครอบครัว) Clinical Routes
 * Endpoints for 17 Chronic & Community Health Surveillance Categories
 * Uses HOSxP MySQL pool (hosPool) with fail-closed security and in-memory caching.
 */

export default async function mokRoutes(fastify, options) {
  const { pools, getCached } = options
  const { hosPool } = pools

  function getCatchmentCondition(alias, catchment) {
    if (catchment === 'out_catchment') {
      return `${alias}.village_id = '1' AND ${alias}.house_regist_type_id IN ('4') AND (pt.chwpart = '52' AND pt.amppart = '08')`
    }
    // in_catchment (default)
    return `${alias}.village_id NOT IN ('1') AND ${alias}.house_regist_type_id IN ('1', '3')`
  }

  // ------------------------------------------------------------------
  // 1. MOK Summary Counts for All 17 Categories
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/mok/summary', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'สรุปจำนวนผู้ป่วยในแต่ละกลุ่มของหมออนามัยครอบครัว (มอค.)',
      querystring: {
        type: 'object',
        properties: {
          catchment: { type: 'string', enum: ['in_catchment', 'out_catchment'], default: 'in_catchment' },
          hospcode: { type: 'string', default: '03978' }
        }
      }
    }
  }, async (req, reply) => {
    const catchment = req.query?.catchment || 'in_catchment'
    const cacheKey = `mok-summary-${catchment}`

    try {
      const data = await getCached(cacheKey, 60000, async () => {
        const catchmentCondition = getCatchmentCondition('pe', catchment)
        const counts = {
          asthma: 0,
          ca: 0,
          ckd_all: 0,
          ckd_45: 0,
          copd: 0,
          dm: 0,
          ht: 0,
          stroke: 0,
          warfarin: 0,
          copd_readmit: 0,
          palliative: 0,
          tb: 0,
          elderly_bedridden: 0,
          disabled_dependent: 0,
          pregnant_risk: 0,
          child_delayed_dev: 0,
          type_area_mismatch: 0,
        }

        // Fast grouped aggregation for chronic clinic members
        const clinicSql = `
          SELECT 
            cl.clinic,
            SUBSTR(cl.note, 1, 1) as stage_note,
            COUNT(DISTINCT pt.hn) as total
          FROM clinicmember cl
          JOIN patient pt ON pt.hn = cl.hn
          JOIN person pe ON pe.patient_hn = pt.hn
          WHERE cl.clinic_member_status_id <> '3'
            AND ${catchmentCondition}
          GROUP BY cl.clinic, stage_note
        `
        const [rows] = await hosPool.query(clinicSql)

        for (const row of rows) {
          const cCode = String(row.clinic).trim()
          const count = Number(row.total) || 0
          const stage = String(row.stage_note || '').trim()

          if (cCode === '022') counts.asthma += count
          else if (cCode === '041') counts.ca += count
          else if (cCode === '055' || cCode === '49') {
            counts.ckd_all += count
            if (stage === '4' || stage === '5') {
              counts.ckd_45 += count
            }
          }
          else if (cCode === '021') counts.copd += count
          else if (cCode === '001') counts.dm += count
          else if (cCode === '002') counts.ht += count
          else if (cCode === '47') counts.palliative += count
          else if (cCode === '023') counts.stroke += count
          else if (cCode === '035') counts.warfarin += count
        }

        return counts
      })

      return { success: true, data }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 2. MOK Category Patient List
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/mok/list', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายชื่อผู้ป่วยตามกลุ่มโรค/การเฝ้าระวังของหมออนามัยครอบครัว (มอค.)',
      querystring: {
        type: 'object',
        required: ['category'],
        properties: {
          category: { type: 'string', description: 'รหัสกลุ่มโรค เช่น asthma, dm, ht, ckd_all ฯลฯ' },
          catchment: { type: 'string', enum: ['in_catchment', 'out_catchment'], default: 'in_catchment' },
          hospcode: { type: 'string', default: '03978' }
        }
      }
    }
  }, async (req, reply) => {
    const { category, catchment = 'in_catchment' } = req.query || {}

    if (!category) {
      reply.code(400)
      return { success: false, error: 'Missing required query parameter "category"' }
    }

    const cacheKey = `mok-list-${category}-${catchment}`

    try {
      const data = await getCached(cacheKey, 30000, async () => {
        const catchmentCondition = getCatchmentCondition('pe', catchment)
        const catchmentConditionPp = getCatchmentCondition('pp', catchment)

        let sql = ''
        const params = []

        switch (category) {
          case 'type_area_mismatch': {
            const areaCondition = catchment === 'out_catchment'
              ? `(pt.chwpart = '52' AND pt.amppart = '08')`
              : `pp.village_id NOT IN ('1')`

            sql = `
              SELECT 
                pt.cid,
                ov.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                pp.last_update,
                pt.addrpart,
                pt.moopart,
                th.full_name as address,
                th.name as tambon_name,
                pt.type_area as type_area_patient,
                pp.house_regist_type_id as type_area_person,
                ov.hospmain,
                ov.hospsub,
                pty.name as pttypename
              FROM ovst ov
              LEFT OUTER JOIN patient pt ON pt.hn = ov.hn
              LEFT OUTER JOIN person pp ON pt.hn = pp.patient_hn
              LEFT OUTER JOIN pttype pty ON pty.pttype = ov.pttype
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              WHERE (pt.type_area <> pp.house_regist_type_id)
                AND pp.death <> 'Y'
                AND ${areaCondition}
              GROUP BY ov.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'asthma': {
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                SUBSTR(cl.note, 1, 1) as cn,
                SUBSTR(cl.note, 3, 20) as cn2
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              WHERE cl.clinic = '022'
                AND cl.clinic_member_status_id <> '3'
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'ca': {
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                cl.note,
                cs.clinic_member_status_name,
                concat(ho.hosptype, ho.name) as send_to_pcu_name,
                cl.send_to_pcu_date
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              LEFT OUTER JOIN clinic_member_status cs ON cl.clinic_member_status_id = cs.clinic_member_status_id
              LEFT OUTER JOIN hospcode ho ON cl.send_to_pcu_hcode = ho.hospcode
              WHERE cl.clinic = '041'
                AND cl.clinic_member_status_id <> '3'
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'ckd_all': {
            const clinicClause = catchment === 'out_catchment' ? `cl.clinic IN ('055', '49')` : `cl.clinic = '055'`
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                SUBSTR(cl.note, 1, 1) as cn,
                SUBSTR(cl.note, 3, 20) as cn2
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              WHERE ${clinicClause}
                AND cl.clinic_member_status_id <> '3'
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'ckd_45': {
            const clinicClause = catchment === 'out_catchment' ? `cl.clinic IN ('055', '49')` : `cl.clinic = '055'`
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                SUBSTR(cl.note, 1, 1) as cn,
                SUBSTR(cl.note, 3, 20) as cn2
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              WHERE ${clinicClause}
                AND cl.clinic_member_status_id <> '3'
                AND SUBSTR(cl.note, 1, 1) IN ('4', '5')
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'copd': {
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                SUBSTR(cl.note, 1, 1) as cn,
                SUBSTR(cl.note, 3, 20) as cn2
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              WHERE cl.clinic = '021'
                AND cl.clinic_member_status_id <> '3'
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'copd_readmit': {
            sql = `
              SELECT 
                p.cid,
                a.hn,
                a.an,
                concat(p.pname, p.fname, ' ', p.lname) as ptname,
                YEAR(current_date) - YEAR(p.birthday) as age,
                a.regdate,
                a.dchdate,
                a.lastvisit,
                a.pdx,
                i.name as pdxname,
                concat(p.addrpart, ' หมู่ที่ ', p.moopart, ' ', th.full_name) as address,
                p.addrpart,
                p.moopart,
                th.name as tambon_name
              FROM an_stat a
              JOIN (
                SELECT v2.hn, max(v2.an) max_an 
                FROM an_stat v2 
                WHERE v2.dchdate >= DATE_SUB(CURRENT_DATE, INTERVAL 2 YEAR)
                GROUP BY v2.hn
              ) temp ON temp.hn = a.hn AND temp.max_an = a.an
              LEFT OUTER JOIN patient p ON p.hn = a.hn
              LEFT OUTER JOIN person pe ON pe.patient_hn = p.hn
              LEFT OUTER JOIN thaiaddress th ON p.chwpart = th.chwpart AND p.amppart = th.amppart AND p.tmbpart = th.tmbpart
              LEFT OUTER JOIN icd101 i ON i.code = substring(a.pdx, 1, 3)
              WHERE a.pdx >= 'J440' AND a.pdx <= 'J449'
                AND a.lastvisit <= 28
                AND a.dchdate >= DATE_SUB(CURRENT_DATE, INTERVAL 2 YEAR)
                AND ${catchmentCondition}
              ORDER BY a.regdate DESC
            `
            break
          }

          case 'dm': {
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                cl.note as cn
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              WHERE cl.clinic = '001'
                AND cl.clinic_member_status_id <> '3'
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'ht': {
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                cl.note as cn
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              WHERE cl.clinic = '002'
                AND cl.clinic_member_status_id <> '3'
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'palliative': {
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                cl.note,
                cs.clinic_member_status_name,
                concat(ho.hosptype, ho.name) as send_to_pcu_name,
                cl.send_to_pcu_date
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              LEFT OUTER JOIN clinic_member_status cs ON cl.clinic_member_status_id = cs.clinic_member_status_id
              LEFT OUTER JOIN hospcode ho ON cl.send_to_pcu_hcode = ho.hospcode
              WHERE cl.clinic = '47'
                AND cl.clinic_member_status_id <> '3'
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'stroke': {
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                cl.note,
                cs.clinic_member_status_name,
                concat(ho.hosptype, ho.name) as send_to_pcu_name,
                cl.send_to_pcu_date
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              LEFT OUTER JOIN clinic_member_status cs ON cl.clinic_member_status_id = cs.clinic_member_status_id
              LEFT OUTER JOIN hospcode ho ON cl.send_to_pcu_hcode = ho.hospcode
              WHERE cl.clinic = '023'
                AND cl.clinic_member_status_id <> '3'
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'tb': {
            sql = `
              SELECT 
                pp.cid,
                pt.hn,
                YEAR(current_date) - YEAR(pp.birthdate) as age,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                ov.vstdate,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                th.name as tambon_name
              FROM vn_stat ov
              LEFT OUTER JOIN patient pt ON pt.hn = ov.hn
              LEFT OUTER JOIN person pp ON pt.hn = pp.patient_hn
              LEFT OUTER JOIN pttype pty ON pty.pttype = ov.pttype
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              WHERE ((ov.pdx >= 'A150' AND ov.pdx <= 'A199')
                  OR (ov.dx0 >= 'A150' AND ov.dx0 <= 'A199')
                  OR (ov.dx1 >= 'A150' AND ov.dx1 <= 'A199')
                  OR (ov.dx2 >= 'A150' AND ov.dx2 <= 'A199')
                  OR (ov.dx3 >= 'A150' AND ov.dx3 <= 'A199')
                  OR (ov.dx4 >= 'A150' AND ov.dx4 <= 'A199')
                  OR (ov.dx5 >= 'A150' AND ov.dx5 <= 'A199'))
                AND pp.death <> 'Y'
                AND ov.vstdate >= DATE_SUB(CURRENT_DATE, INTERVAL 2 YEAR)
                AND ${catchmentConditionPp}
              GROUP BY ov.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'warfarin': {
            sql = `
              SELECT 
                pt.cid,
                pt.hn,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                th.name as tambon_name,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                oc.name as occupation_name,
                cl.note as cn
              FROM patient pt
              LEFT OUTER JOIN person pe ON pe.patient_hn = pt.hn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              LEFT OUTER JOIN occupation oc ON pt.occupation = oc.occupation
              LEFT OUTER JOIN clinicmember cl ON cl.hn = pt.hn
              WHERE cl.clinic = '035'
                AND cl.clinic_member_status_id <> '3'
                AND ${catchmentCondition}
              GROUP BY pt.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'elderly_bedridden': {
            sql = `
              SELECT 
                pp.cid,
                pt.hn,
                YEAR(current_date) - YEAR(pp.birthdate) as age,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                ov.vstdate,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                th.name as tambon_name
              FROM vn_stat ov
              LEFT OUTER JOIN patient pt ON pt.hn = ov.hn
              LEFT OUTER JOIN person pp ON pt.hn = pp.patient_hn
              LEFT OUTER JOIN pttype pty ON pty.pttype = ov.pttype
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              WHERE ((ov.pdx >= 'Z740' AND ov.pdx <= 'Z742')
                  OR (ov.dx0 >= 'Z740' AND ov.dx0 <= 'Z742')
                  OR (ov.dx1 >= 'Z740' AND ov.dx1 <= 'Z742')
                  OR (ov.dx2 >= 'Z740' AND ov.dx2 <= 'Z742')
                  OR (ov.dx3 >= 'Z740' AND ov.dx3 <= 'Z742')
                  OR (ov.dx4 >= 'Z740' AND ov.dx4 <= 'Z742')
                  OR (ov.dx5 >= 'Z740' AND ov.dx5 <= 'Z742'))
                AND pp.death <> 'Y'
                AND (YEAR(current_date) - YEAR(pp.birthdate) >= 60)
                AND ov.vstdate >= DATE_SUB(CURRENT_DATE, INTERVAL 2 YEAR)
                AND ${catchmentConditionPp}
              GROUP BY ov.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'disabled_dependent': {
            sql = `
              SELECT 
                pp.cid,
                pt.hn,
                YEAR(current_date) - YEAR(pp.birthdate) as age,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                ov.vstdate,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                th.name as tambon_name
              FROM vn_stat ov
              LEFT OUTER JOIN patient pt ON pt.hn = ov.hn
              LEFT OUTER JOIN person pp ON pt.hn = pp.patient_hn
              LEFT OUTER JOIN pttype pty ON pty.pttype = ov.pttype
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              WHERE ((ov.pdx >= 'Z740' AND ov.pdx <= 'Z742')
                  OR (ov.dx0 >= 'Z740' AND ov.dx0 <= 'Z742')
                  OR (ov.dx1 >= 'Z740' AND ov.dx1 <= 'Z742')
                  OR (ov.dx2 >= 'Z740' AND ov.dx2 <= 'Z742')
                  OR (ov.dx3 >= 'Z740' AND ov.dx3 <= 'Z742')
                  OR (ov.dx4 >= 'Z740' AND ov.dx4 <= 'Z742')
                  OR (ov.dx5 >= 'Z740' AND ov.dx5 <= 'Z742'))
                AND pp.death <> 'Y'
                AND (YEAR(current_date) - YEAR(pp.birthdate) < 60)
                AND ov.vstdate >= DATE_SUB(CURRENT_DATE, INTERVAL 2 YEAR)
                AND ${catchmentConditionPp}
              GROUP BY ov.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          case 'pregnant_risk': {
            sql = `
              SELECT 
                pp.cid,
                pt.hn,
                YEAR(current_date) - YEAR(pp.birthdate) as age,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                ov.vstdate,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                th.name as tambon_name
              FROM vn_stat ov
              LEFT OUTER JOIN patient pt ON pt.hn = ov.hn
              LEFT OUTER JOIN person pp ON pt.hn = pp.patient_hn
              LEFT OUTER JOIN pttype pty ON pty.pttype = ov.pttype
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              WHERE ((ov.pdx >= 'Z350' AND ov.pdx <= 'Z359')
                  OR (ov.dx0 >= 'Z350' AND ov.dx0 <= 'Z359')
                  OR (ov.dx1 >= 'Z350' AND ov.dx1 <= 'Z359')
                  OR (ov.dx2 >= 'Z350' AND ov.dx2 <= 'Z359')
                  OR (ov.dx3 >= 'Z350' AND ov.dx3 <= 'Z359')
                  OR (ov.dx4 >= 'Z350' AND ov.dx4 <= 'Z359')
                  OR (ov.dx5 >= 'Z350' AND ov.dx5 <= 'Z359'))
                AND pp.death <> 'Y'
                AND ov.vstdate >= DATE_SUB(CURRENT_DATE, INTERVAL 10 MONTH)
                AND ${catchmentConditionPp}
              GROUP BY ov.hn
              ORDER BY ov.vstdate DESC
            `
            break
          }

          case 'child_delayed_dev': {
            sql = `
              SELECT 
                pp.cid,
                pt.hn,
                YEAR(current_date) - YEAR(pt.birthday) as age,
                ov.age_y,
                ov.age_m,
                concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
                ov.vstdate,
                concat(pt.addrpart, ' หมู่ที่ ', pt.moopart, ' ', th.full_name) as address,
                pt.addrpart,
                pt.moopart,
                th.name as tambon_name
              FROM vn_stat ov
              LEFT OUTER JOIN patient pt ON pt.hn = ov.hn
              LEFT OUTER JOIN person pp ON pt.hn = pp.patient_hn
              LEFT OUTER JOIN pp_special ps ON ov.vn = ps.vn
              LEFT OUTER JOIN thaiaddress th ON pt.chwpart = th.chwpart AND pt.amppart = th.amppart AND pt.tmbpart = th.tmbpart
              WHERE (ps.pp_special_type_id BETWEEN '267' AND '271')
                AND pp.death <> 'Y'
                AND (ov.age_y < 6 AND ov.age_m < 2)
                AND ov.vstdate >= DATE_SUB(CURRENT_DATE, INTERVAL 2 YEAR)
                AND ${catchmentConditionPp}
              GROUP BY ov.hn
              ORDER BY pt.moopart ASC, pt.addrpart ASC
            `
            break
          }

          default:
            throw new Error(`Unknown MOK Category: ${category}`)
        }

        const [rows] = await hosPool.query(sql, params)

        return rows.map(r => ({
          cid: r.cid ? String(r.cid).trim() : '',
          hn: r.hn ? String(r.hn).trim() : '',
          ptname: r.ptname ? String(r.ptname).trim() : '',
          age: r.age != null ? Number(r.age) : null,
          address: r.address ? String(r.address).trim() : '-',
          moopart: r.moopart ? String(r.moopart).trim() : '',
          addrpart: r.addrpart ? String(r.addrpart).trim() : '',
          tambon_name: r.tambon_name ? String(r.tambon_name).trim() : '',
          occupation_name: r.occupation_name ? String(r.occupation_name).trim() : null,
          note: r.note ? String(r.note).trim() : null,
          cn: r.cn ? String(r.cn).trim() : null,
          cn2: r.cn2 ? String(r.cn2).trim() : null,
          vstdate: r.vstdate ? String(r.vstdate).trim() : null,
          regdate: r.regdate ? String(r.regdate).trim() : null,
          dchdate: r.dchdate ? String(r.dchdate).trim() : null,
          an: r.an ? String(r.an).trim() : null,
          lastvisit: r.lastvisit != null ? Number(r.lastvisit) : null,
          pdx: r.pdx ? String(r.pdx).trim() : null,
          pdxname: r.pdxname ? String(r.pdxname).trim() : null,
          send_to_pcu_name: r.send_to_pcu_name ? String(r.send_to_pcu_name).trim() : null,
          send_to_pcu_date: r.send_to_pcu_date ? String(r.send_to_pcu_date).trim() : null,
          clinic_member_status_name: r.clinic_member_status_name ? String(r.clinic_member_status_name).trim() : null,
          type_area_patient: r.type_area_patient ? String(r.type_area_patient).trim() : null,
          type_area_person: r.type_area_person ? String(r.type_area_person).trim() : null,
          last_update: r.last_update ? String(r.last_update).trim() : null,
          pttypename: r.pttypename ? String(r.pttypename).trim() : null,
          age_y: r.age_y != null ? Number(r.age_y) : null,
          age_m: r.age_m != null ? Number(r.age_m) : null,
        }))
      })

      return { success: true, count: data.length, data }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })
}
