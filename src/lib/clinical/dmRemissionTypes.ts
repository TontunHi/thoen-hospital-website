export type DmTrendOutcome = string

export type DmMedsOutcome = string

export type DmOptionCategory =
  | 'remission'
  | 'diet'
  | 'exercise'
  | 'if_fasting'
  | 'pcu'

export const DM_TREND_OUTCOMES: readonly string[] = ['ลดลง', 'คงที่', 'เพิ่มขึ้น'] as const

export const DM_A1C_OUTCOMES: readonly string[] = ['ลดลง', 'คงที่', 'เพิ่มขึ้น', 'รอผล A1c'] as const

export const DM_WEIGHT_OUTCOMES: readonly string[] = ['ลดลง', 'คงที่', 'เพิ่มขึ้น', 'รอผล BW'] as const

export const DM_WAIST_OUTCOMES: readonly string[] = ['ลดลง', 'คงที่', 'เพิ่มขึ้น', 'รอผล WC'] as const

export const DM_MEDS_OUTCOMES: readonly string[] = [
  'ไม่ใช้ยาอยู่แล้ว',
  'ได้หยุดยาทั้งหมด',
  'offยา 1 ตัว + ลดโดสยาอีกชนิด',
  'offยา 1 ตัว',
  'ชนิดยาเท่าเดิม ลดโดส',
  'ชนิดและโดสเท่าเดิม',
  'ชนิดยาเท่าเดิม เพิ่มโดส',
  'เพิ่มยาตัวใหม่',
] as const

export interface DmOptionCategoryMeta {
  category: DmOptionCategory
  label: string
  description: string
  allowsCustomCombo: boolean
  seedLabels: readonly string[]
}

export const DM_OPTION_CATEGORY_META: Record<DmOptionCategory, DmOptionCategoryMeta> = {
  remission: {
    category: 'remission',
    label: 'สรุป Remission',
    description: 'สถานะผลลัพธ์ของโครงการ DM Remission',
    allowsCustomCombo: false,
    seedLabels: ['Remission', 'ไม่ Remission', 'รอ lab A1c'],
  },
  diet: {
    category: 'diet',
    label: 'สรุป การปรับอาหาร',
    description: 'ตัวเลือกสรุปพฤติกรรมการปรับอาหาร',
    allowsCustomCombo: false,
    seedLabels: [],
  },
  exercise: {
    category: 'exercise',
    label: 'สรุป การออกกำลังกาย',
    description: 'ตัวเลือกสรุปพฤติกรรมการออกกำลังกาย',
    allowsCustomCombo: false,
    seedLabels: [],
  },
  if_fasting: {
    category: 'if_fasting',
    label: 'สรุป IF',
    description: 'ตัวเลือกสรุปการทำ Intermittent Fasting',
    allowsCustomCombo: false,
    seedLabels: [],
  },
  pcu: {
    category: 'pcu',
    label: 'รพ.สต. / หน่วยบริการ',
    description: 'รายชื่อ รพ.สต. ที่สามารถเลือกหรือพิมพ์เพิ่มเติมได้',
    allowsCustomCombo: true,
    seedLabels: [],
  },
}

export const DM_DEFAULT_REMISSION_STATUS = 'รอ lab A1c'

export interface DmRemissionOptionRecord {
  id: number
  category: DmOptionCategory
  label: string
  sortOrder: number
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface DmRemissionCohortRaw {
  id: number
  fiscalYear: number
  pcuName: string | null
  patientName: string
  cid: string | null
  hn: string | null
  age: number | null
  underlyingDiseases: string | null
  heightCm: number | null
  weightBeforeKg: number | null
  weightAfterKg: number | null
  waistBeforeCm: number | null
  waistAfterCm: number | null
  fpgBefore: number | null
  fpgAfter: number | null
  a1cBefore: number | null
  a1cAfter: number | null
  a1cPostStop3m: number | null
  medsBefore: string | null
  medsAfter: string | null
  summaryA1c: DmTrendOutcome | null
  summaryMeds: DmMedsOutcome | null
  summaryWeight: DmTrendOutcome | null
  summaryWaist: DmTrendOutcome | null
  summaryDiet: string | null
  summaryExercise: string | null
  summaryIf: string | null
  summaryRemission: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface DmRemissionCohortRecord extends DmRemissionCohortRaw {
  bmiBefore: number | null
  bmiAfter: number | null
}

export interface DmRemissionCreateInput {
  fiscalYear: number
  pcuName?: string | null
  patientName: string
  cid?: string | null
  hn?: string | null
  age?: number | null
  underlyingDiseases?: string | null
  heightCm?: number | null
  weightBeforeKg?: number | null
  weightAfterKg?: number | null
  waistBeforeCm?: number | null
  waistAfterCm?: number | null
  fpgBefore?: number | null
  fpgAfter?: number | null
  a1cBefore?: number | null
  a1cAfter?: number | null
  a1cPostStop3m?: number | null
  medsBefore?: string | null
  medsAfter?: string | null
  summaryA1c?: DmTrendOutcome | null
  summaryMeds?: DmMedsOutcome | null
  summaryWeight?: DmTrendOutcome | null
  summaryWaist?: DmTrendOutcome | null
  summaryDiet?: string | null
  summaryExercise?: string | null
  summaryIf?: string | null
  summaryRemission?: string | null
}

export type DmRemissionUpdateInput = Partial<DmRemissionCreateInput>

export interface DmRemissionPatientLookupResult {
  hn: string
  cid: string | null
  patientName: string
  age: number | null
}

export interface DmRemissionPcuSummary {
  pcuName: string
  total: number
  remissionCount: number
  remissionRate: number
  statusCounts: Record<string, number>
}

export interface DmRemissionDashboardStats {
  totalPatients: number
  remissionCount: number
  remissionRate: number
  statusCounts: Record<string, number>
  averages: {
    a1cBefore: number | null
    a1cAfter: number | null
    a1cPostStop3m: number | null
    a1cDelta: number | null
    weightBeforeKg: number | null
    weightAfterKg: number | null
    weightDelta: number | null
    bmiBefore: number | null
    bmiAfter: number | null
    waistBeforeCm: number | null
    waistAfterCm: number | null
    fpgBefore: number | null
    fpgAfter: number | null
  }
  byPcu: DmRemissionPcuSummary[]
  breakdowns: {
    summaryA1c: Record<string, number>
    summaryMeds: Record<string, number>
    summaryWeight: Record<string, number>
    summaryWaist: Record<string, number>
    summaryDiet: Record<string, number>
    summaryExercise: Record<string, number>
    summaryIf: Record<string, number>
  }
}

export interface DmRemissionListResult {
  fiscalYear: number
  availableFiscalYears: number[]
  availablePcus: string[]
  items: DmRemissionCohortRecord[]
  options: Record<DmOptionCategory, DmRemissionOptionRecord[]>
  stats: DmRemissionDashboardStats
}

export interface DmRemissionExcelColumnDef {
  key: string
  header: string
  width: number
  getValue: (row: DmRemissionCohortRecord, index: number) => string | number | null
}

export const DM_REMISSION_EXCEL_COLUMNS: readonly DmRemissionExcelColumnDef[] = [
  { key: 'pcuName', header: 'รพ.สต.', width: 24, getValue: (r) => r.pcuName ?? '' },
  { key: 'seq', header: 'ลำดับ', width: 8, getValue: (_r, idx) => idx + 1 },
  { key: 'patientName', header: 'ชื่อ-นามสกุล', width: 26, getValue: (r) => r.patientName },
  { key: 'cid', header: 'เลขบัตรประชาชน', width: 18, getValue: (r) => r.cid ?? '' },
  { key: 'hn', header: 'HN รพ.', width: 12, getValue: (r) => r.hn ?? '' },
  { key: 'age', header: 'อายุ', width: 8, getValue: (r) => r.age },
  { key: 'underlyingDiseases', header: 'U/D อื่นเช่น HT DLP CKD', width: 24, getValue: (r) => r.underlyingDiseases ?? '' },
  { key: 'heightCm', header: 'ส่วนสูง', width: 10, getValue: (r) => r.heightCm },
  { key: 'weightBeforeKg', header: 'น้ำหนัก ก่อน (kg)', width: 14, getValue: (r) => r.weightBeforeKg },
  { key: 'bmiBefore', header: 'BMI ก่อน (auto)', width: 14, getValue: (r) => r.bmiBefore },
  { key: 'weightAfterKg', header: 'น้ำหนัก หลัง (kg)', width: 14, getValue: (r) => r.weightAfterKg },
  { key: 'bmiAfter', header: 'BMI หลัง (auto)', width: 14, getValue: (r) => r.bmiAfter },
  { key: 'waistBeforeCm', header: 'รอบเอว ก่อน (cm)', width: 15, getValue: (r) => r.waistBeforeCm },
  { key: 'waistAfterCm', header: 'รอบเอว หลัง (cm)', width: 15, getValue: (r) => r.waistAfterCm },
  { key: 'fpgBefore', header: 'FPG ก่อน', width: 12, getValue: (r) => r.fpgBefore },
  { key: 'fpgAfter', header: 'FPG หลัง', width: 12, getValue: (r) => r.fpgAfter },
  { key: 'a1cBefore', header: 'A1c ก่อน', width: 12, getValue: (r) => r.a1cBefore },
  { key: 'a1cAfter', header: 'A1c หลัง', width: 12, getValue: (r) => r.a1cAfter },
  { key: 'a1cPostStop3m', header: 'A1c หลังหยุดยา 3 เดือน', width: 18, getValue: (r) => r.a1cPostStop3m },
  { key: 'medsBefore', header: 'ยา ก่อน (ชื่อยา, dose)', width: 28, getValue: (r) => r.medsBefore ?? '' },
  { key: 'medsAfter', header: 'ยา หลัง (ชื่อยา, dose)', width: 28, getValue: (r) => r.medsAfter ?? '' },
  { key: 'summaryA1c', header: 'สรุป A1c (เพิ่ม/ลด/คงที่)', width: 18, getValue: (r) => r.summaryA1c ?? '' },
  { key: 'summaryMeds', header: 'สรุป ยาเบาหวาน (เพิ่ม/ลด/คงที่/หยุดยา)', width: 24, getValue: (r) => r.summaryMeds ?? '' },
  { key: 'summaryWeight', header: 'สรุป น้ำหนัก (เพิ่ม/ลด/คงที่)', width: 20, getValue: (r) => r.summaryWeight ?? '' },
  { key: 'summaryWaist', header: 'สรุป รอบเอว (เพิ่ม/ลด/คงที่)', width: 20, getValue: (r) => r.summaryWaist ?? '' },
  { key: 'summaryDiet', header: 'สรุป การปรับอาหาร', width: 18, getValue: (r) => r.summaryDiet ?? '' },
  { key: 'summaryExercise', header: 'สรุป การออกกำลังกาย', width: 20, getValue: (r) => r.summaryExercise ?? '' },
  { key: 'summaryIf', header: 'สรุป IF', width: 16, getValue: (r) => r.summaryIf ?? '' },
  { key: 'summaryRemission', header: 'สรุป Remission', width: 18, getValue: (r) => r.summaryRemission ?? '' },
]
