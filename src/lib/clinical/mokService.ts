import { apiGateway } from '@/lib/apiGateway'

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

export interface MokGatewayAdapter {
  getMokSummary: typeof apiGateway.clinical.getMokSummary
  getMokList: typeof apiGateway.clinical.getMokList
}

const defaultMokGateway: MokGatewayAdapter = {
  getMokSummary: (params) => apiGateway.clinical.getMokSummary(params),
  getMokList: (params) => apiGateway.clinical.getMokList(params),
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

const VALID_CATEGORY_IDS = new Set(MOK_CATEGORIES.map((c) => c.id))

export class MokService {
  /**
   * Fast Summary Count for all categories via Gateway Named API (`/api/v1/clinical/mok/summary`)
   */
  public static async fetchCategoryCounts(
    catchment: CatchmentType = 'in_catchment',
    gateway: Partial<MokGatewayAdapter> = defaultMokGateway
  ): Promise<Record<string, number>> {
    const gw: MokGatewayAdapter = { ...defaultMokGateway, ...gateway }
    const pureSummary = await gw.getMokSummary({ catchment })
    const counts: Record<string, number> = {}
    for (const cat of MOK_CATEGORIES) {
      counts[cat.id] = Number(pureSummary?.[cat.id] || 0)
    }
    return counts
  }

  /**
   * Fetch patient records for a specific MOK category and catchment type via Gateway Named API (`/api/v1/clinical/mok/list`).
   */
  public static async fetchCategoryRecords(
    categoryId: string,
    catchment: CatchmentType = 'in_catchment',
    gateway: Partial<MokGatewayAdapter> = defaultMokGateway
  ): Promise<MokPatientRecord[]> {
    if (!VALID_CATEGORY_IDS.has(categoryId)) {
      throw new Error(`Unknown MOK Category: ${categoryId}`)
    }
    const gw: MokGatewayAdapter = { ...defaultMokGateway, ...gateway }
    const pureRecords = await gw.getMokList<MokPatientRecord>({
      category: categoryId,
      catchment,
    })
    return Array.isArray(pureRecords) ? pureRecords : []
  }
}
