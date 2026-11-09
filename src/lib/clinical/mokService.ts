import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway, GatewayNotFoundError } from '@/lib/apiGateway'

export type CatchmentType = 'in_catchment' | 'out_catchment'

export interface MokCategoryMeta {
  id: string
  title: string
  shortTitle: string
  clinicCode?: string
  description: string
  badgeColor: string
  group: 'chronic' | 'special' | 'audit'
}

export interface MokPatientRecord {
  cid: string
  hn: string
  ptname: string
  age?: number | string | null
  address?: string | null
  moopart?: string | null
  addrpart?: string | null
  tambon_name?: string | null
  occupation_name?: string | null
  note?: string | null
  cn?: string | null
  cn2?: string | null
  // Category specific fields
  vstdate?: string | null
  regdate?: string | null
  dchdate?: string | null
  an?: string | null
  lastvisit?: number | string | null
  pdx?: string | null
  pdxname?: string | null
  send_to_pcu_name?: string | null
  send_to_pcu_date?: string | null
  clinic_member_status_name?: string | null
  type_area_patient?: string | null // 'c'
  type_area_person?: string | null  // 's'
  last_update?: string | null
  pttypename?: string | null
  age_y?: number | string | null
  age_m?: number | string | null
}

export const MOK_CATEGORIES: MokCategoryMeta[] = [
  {
    id: 'asthma',
    title: 'Asthma (หอบหืด)',
    shortTitle: 'Asthma',
    clinicCode: '022',
    description: 'ทะเบียนผู้ป่วยคลินิกโรคหอบหืด',
    badgeColor: 'sky',
    group: 'chronic',
  },
  {
    id: 'ca',
    title: 'CA (โรคมะเร็ง)',
    shortTitle: 'CA',
    clinicCode: '041',
    description: 'ทะเบียนผู้ป่วยคลินิกโรคมะเร็ง',
    badgeColor: 'rose',
    group: 'chronic',
  },
  {
    id: 'ckd_all',
    title: 'CKD ทั้งหมด (โรคไตเรื้อรัง)',
    shortTitle: 'CKD ทั้งหมด',
    clinicCode: '055',
    description: 'ทะเบียนผู้ป่วยคลินิกโรคไตเรื้อรังทุกระยะ',
    badgeColor: 'indigo',
    group: 'chronic',
  },
  {
    id: 'ckd_45',
    title: 'CKD Stage 4, 5',
    shortTitle: 'CKD 4-5',
    clinicCode: '055',
    description: 'ทะเบียนผู้ป่วยคลินิกโรคไตเรื้อรังเฉพาะระยะที่ 4 และ 5',
    badgeColor: 'purple',
    group: 'chronic',
  },
  {
    id: 'copd',
    title: 'COPD (ปอดอุดกั้นเรื้อรัง)',
    shortTitle: 'COPD',
    clinicCode: '021',
    description: 'ทะเบียนผู้ป่วยคลินิกโรคปอดอุดกั้นเรื้อรัง / ถุงลมโป่งพอง',
    badgeColor: 'teal',
    group: 'chronic',
  },
  {
    id: 'dm',
    title: 'DM (เบาหวาน)',
    shortTitle: 'DM',
    clinicCode: '001',
    description: 'ทะเบียนผู้ป่วยคลินิกโรคเบาหวาน',
    badgeColor: 'blue',
    group: 'chronic',
  },
  {
    id: 'ht',
    title: 'HT (ความดันโลหิตสูง)',
    shortTitle: 'HT',
    clinicCode: '002',
    description: 'ทะเบียนผู้ป่วยคลินิกโรคความดันโลหิตสูง',
    badgeColor: 'emerald',
    group: 'chronic',
  },
  {
    id: 'stroke',
    title: 'Stroke (หลอดเลือดสมอง)',
    shortTitle: 'Stroke',
    clinicCode: '023',
    description: 'ทะเบียนผู้ป่วยคลินิกโรคหลอดเลือดสมองและอัมพฤกษ์อัมพาต',
    badgeColor: 'violet',
    group: 'chronic',
  },
  {
    id: 'warfarin',
    title: 'Warfarin (ยาวาร์ฟาริน)',
    shortTitle: 'Warfarin',
    clinicCode: '035',
    description: 'ทะเบียนผู้ป่วยคลินิกที่ได้รับยาวาร์ฟาริน',
    badgeColor: 'pink',
    group: 'chronic',
  },
  {
    id: 'copd_readmit',
    title: 'COPD Re-admit <= 28 วัน',
    shortTitle: 'COPD Re-admit',
    description: 'ผู้ป่วยโรคปอดอุดกั้นเรื้อรังที่กลับมารักษาซ้ำในโรงพยาบาลภายใน 28 วัน',
    badgeColor: 'red',
    group: 'special',
  },
  {
    id: 'palliative',
    title: 'Palliative (ดูแลประคับประคอง)',
    shortTitle: 'Palliative',
    clinicCode: '47',
    description: 'ทะเบียนผู้ป่วยกลุ่มดูแลแบบประคับประคอง',
    badgeColor: 'orange',
    group: 'special',
  },
  {
    id: 'tb',
    title: 'TB (วัณโรค)',
    shortTitle: 'TB',
    description: 'ทะเบียนผู้ป่วยที่ได้รับการวินิจฉัยโรควัณโรค (A150 - A199)',
    badgeColor: 'yellow',
    group: 'special',
  },
  {
    id: 'elderly_bedridden',
    title: 'ผู้สูงอายุติดบ้านติดเตียง (>= 60 ปี)',
    shortTitle: 'ติดบ้านติดเตียง',
    description: 'ผู้สูงอายุที่มีภาวะพึ่งพิง รหัสวินิจฉัย Z740 - Z742',
    badgeColor: 'cyan',
    group: 'special',
  },
  {
    id: 'disabled_dependent',
    title: 'ผู้พิการที่มีภาวะพึ่งพิง (< 60 ปี)',
    shortTitle: 'ผู้พิการพึ่งพิง',
    description: 'ผู้ป่วยที่มีภาวะพึ่งพิง รหัสวินิจฉัย Z740 - Z742 อายุต่ำกว่า 60 ปี',
    badgeColor: 'lime',
    group: 'special',
  },
  {
    id: 'pregnant_risk',
    title: 'หญิงตั้งครรภ์เสี่ยง',
    shortTitle: 'ครรภ์เสี่ยง',
    description: 'ทะเบียนหญิงตั้งครรภ์ที่มีความเสี่ยงสูง รหัสวินิจฉัยกลุ่ม Z350 - Z359',
    badgeColor: 'fuchsia',
    group: 'special',
  },
  {
    id: 'child_delayed_dev',
    title: 'เด็ก 0-5 ปี พัฒนาการล่าช้า',
    shortTitle: 'เด็กพัฒนาการล่าช้า',
    description: 'เด็กอายุ 0-5 ปี ที่ตรวจพบข้อสงสัยหรือพัฒนาการล่าช้า (pp_special 267 - 271)',
    badgeColor: 'amber',
    group: 'special',
  },
  {
    id: 'type_area_mismatch',
    title: 'Type Area ไม่ตรงกัน',
    shortTitle: 'Type Area',
    description: 'ตรวจสอบความถูกต้องของข้อมูล Type Area ห้องบัตร ไม่ตรงกับ งานส่งเสริมฯ',
    badgeColor: 'amber',
    group: 'audit',
  },
]

export class MokService {
  /**
   * Helper to build catchment WHERE clause
   */
  private static getCatchmentCondition(alias: 'pe' | 'pp', catchment: CatchmentType): string {
    if (catchment === 'out_catchment') {
      return `${alias}.village_id = '1' AND ${alias}.house_regist_type_id IN ('4') AND (pt.chwpart = '52' AND pt.amppart = '08')`
    }
    // in_catchment (default)
    return `${alias}.village_id NOT IN ('1') AND ${alias}.house_regist_type_id IN ('1', '3')`
  }

  /**
   * Fast Summary Count for all categories (Single-flight aggregation where possible)
   */
  public static async fetchCategoryCounts(
    catchment: CatchmentType = 'in_catchment',
    queryExecutor = queryClinicalDb
  ): Promise<Record<string, number>> {
    // 1. Pure RESTful API via Gateway
    if (queryExecutor === queryClinicalDb) {
      try {
        const pureSummary = await apiGateway.clinical.getMokSummary({ catchment })
        if (pureSummary && typeof pureSummary === 'object' && Object.keys(pureSummary).length > 0) {
          return pureSummary
        }
      } catch (err: unknown) {
        // Fallback to query generation if not yet deployed on gateway host
        if (!(err instanceof GatewayNotFoundError)) {
          console.warn('[MOK] Pure API summary call failed, attempting fallback query:', err)
        }
      }
    }

    const catchmentCondition = this.getCatchmentCondition('pe', catchment)
    const counts: Record<string, number> = {}

    // Initialize all to 0
    for (const cat of MOK_CATEGORIES) {
      counts[cat.id] = 0
    }

    try {
      // 1. Grouped Clinic counts in a single fast query
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
      const clinicRows = await queryExecutor(clinicSql, [])
      for (const row of clinicRows) {
        const cCode = String(row.clinic).trim()
        const count = Number(row.total) || 0
        const stage = String(row.stage_note || '').trim()

        if (cCode === '022') counts['asthma'] = (counts['asthma'] || 0) + count
        else if (cCode === '041') counts['ca'] = (counts['ca'] || 0) + count
        else if (cCode === '055' || cCode === '49') {
          counts['ckd_all'] = (counts['ckd_all'] || 0) + count
          if (stage === '4' || stage === '5') {
            counts['ckd_45'] = (counts['ckd_45'] || 0) + count
          }
        }
        else if (cCode === '021') counts['copd'] = (counts['copd'] || 0) + count
        else if (cCode === '001') counts['dm'] = (counts['dm'] || 0) + count
        else if (cCode === '002') counts['ht'] = (counts['ht'] || 0) + count
        else if (cCode === '47') counts['palliative'] = (counts['palliative'] || 0) + count
        else if (cCode === '023') counts['stroke'] = (counts['stroke'] || 0) + count
        else if (cCode === '035') counts['warfarin'] = (counts['warfarin'] || 0) + count
      }
    } catch {
      // Fallback gracefully on query error
    }

    return counts
  }

  /**
   * Fetch patient records for a specific MOK category and catchment type.
   * Optimized: Dead joins removed, indexed fields used, and time windows applied to vn_stat scans.
   */
  public static async fetchCategoryRecords(
    categoryId: string,
    catchment: CatchmentType = 'in_catchment',
    queryExecutor = queryClinicalDb
  ): Promise<MokPatientRecord[]> {
    // 1. Pure RESTful API via Gateway
    if (queryExecutor === queryClinicalDb) {
      try {
        const pureRecords = await apiGateway.clinical.getMokList<MokPatientRecord>({
          category: categoryId,
          catchment
        })
        if (Array.isArray(pureRecords)) {
          return pureRecords
        }
      } catch (err: unknown) {
        // Fallback to query generation if not yet deployed on gateway host
        if (!(err instanceof GatewayNotFoundError)) {
          console.warn(`[MOK] Pure API list call failed for ${categoryId}, attempting fallback query:`, err)
        }
      }
    }

    const catchmentCondition = this.getCatchmentCondition('pe', catchment)
    const catchmentConditionPp = this.getCatchmentCondition('pp', catchment)

    let sql = ''
    const params: any[] = []

    switch (categoryId) {
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
        // Optimized: Removed dead joins on hospcode and clinic_member_status
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
        // Optimized: Filter an_stat within 2 years to prevent full-table scan on entire inpatient history
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
        // Optimized: Active/recent cases within 2 years
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
        // Optimized: Active cases within 2 years
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
        // Optimized: Active cases within 2 years
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
        // Optimized: Gestational period window within 10 months
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
        // Optimized: Children age < 6 and visits within 2 years
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
        throw new Error(`Unknown MOK Category: ${categoryId}`)
    }

    const rows = await queryExecutor(sql, params)

    return rows.map((r: any) => ({
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
  }
}
