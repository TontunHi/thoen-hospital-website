export type FctOptionCategory =
  | 'pcu'
  | 'patient_category'
  | 'adl_group'
  | 'visit_outcome'
  | 'overall_risk'
  | 'risk_level'
  | 'treatment_facility'
  | 'nutrition_status'
  | 'pt_category'
  | 'thai_med_category'

export interface FctOptionCategoryMeta {
  category: FctOptionCategory
  label: string
  description: string
  allowsCustomCombo: boolean
  seedLabels: readonly string[]
}

export const FCT_ALL_OPTION_CATEGORIES: readonly FctOptionCategory[] = [
  'pcu',
  'patient_category',
  'adl_group',
  'visit_outcome',
  'overall_risk',
  'risk_level',
  'treatment_facility',
  'nutrition_status',
  'pt_category',
  'thai_med_category',
] as const

export const FCT_OPTION_CATEGORY_META: Record<FctOptionCategory, FctOptionCategoryMeta> = {
  pcu: {
    category: 'pcu',
    label: 'รพ.สต. / หน่วยบริการ',
    description: 'รายชื่อ รพ.สต. หรือหน่วยบริการเครือข่าย (เลือกหรือพิมพ์เพิ่มเติมได้)',
    allowsCustomCombo: true,
    seedLabels: [
      'รพ.เถิน',
      'เด่นชัย',
      'แม่วะหลวง',
      'วังหิน',
      'ดอนแก้ว',
      'กุ่มเนิ้ง',
      'แม่มอกกลาง',
      'หอรบ',
      'สะเลียมหวาน',
      'หนองหอย',
      'แม่ถอด',
      'นาบ้านไร่',
      'ท่ามะเกว๋น',
      'เด่นแก้ว',
      'ห้วยแก้ว',
    ],
  },
  patient_category: {
    category: 'patient_category',
    label: 'ประเภทคนไข้',
    description: 'กลุ่มโรคหรือโครงการหลักของผู้ป่วยเยี่ยมบ้าน',
    allowsCustomCombo: true,
    seedLabels: [
      'stroke',
      'palliative',
      'สูงอายุติดเตียง',
      'สูงอายุติดบ้าน',
      'CKD 5',
      'COPD',
      'กระดูกและข้อ',
      'DM HT',
      'หัวใจ',
      'CP',
      'พอสว',
      'พระบรมฯ',
    ],
  },
  adl_group: {
    category: 'adl_group',
    label: 'กลุ่ม ADL',
    description: 'การจำแนกกลุ่มตามความสามารถในการทำกิจวัตรประจำวัน',
    allowsCustomCombo: false,
    seedLabels: ['ติดเตียง', 'ติดบ้าน', 'ติดสังคม'],
  },
  visit_outcome: {
    category: 'visit_outcome',
    label: 'ผลลัพธ์การเยี่ยม',
    description: 'ผลการติดตามอาการผู้ป่วยในรอบการเยี่ยมนี้',
    allowsCustomCombo: false,
    seedLabels: ['ดีขึ้น', 'คงเดิม', 'แย่ลง', 'เสียชีวิต'],
  },
  overall_risk: {
    category: 'overall_risk',
    label: 'ระดับความเสี่ยงโดยรวมของผู้ป่วย',
    description: 'ระดับความเสี่ยงโดยรวมของผู้ป่วยจากการเยี่ยมบ้าน',
    allowsCustomCombo: false,
    seedLabels: ['Low', 'Moderate', 'High'],
  },
  risk_level: {
    category: 'risk_level',
    label: 'ระดับความเสี่ยง',
    description: 'ระดับความเสี่ยงเฉพาะด้าน',
    allowsCustomCombo: false,
    seedLabels: ['Low', 'Moderate', 'High'],
  },
  treatment_facility: {
    category: 'treatment_facility',
    label: 'สถานที่รักษา',
    description: 'โรงพยาบาลหรือสถานพยาบาลหลักที่ผู้ป่วยรับการรักษาต่อเนื่อง',
    allowsCustomCombo: true,
    seedLabels: [
      'รพ.เถิน',
      'รพ.เถิน รพ.ลำปาง',
      'รพ.ลำปาง',
      'รพ.มหาราชนครเชียงใหม่',
      'รพ.มะเร็งลำปาง',
      'รพ.พระมงกุฎเกล้า',
    ],
  },
  nutrition_status: {
    category: 'nutrition_status',
    label: 'โภชนาการ (สถานะ)',
    description: 'ผลการประเมินภาวะโภชนาการโดยนักโภชนาการ',
    allowsCustomCombo: false,
    seedLabels: ['ปกติ', 'ผอม BMI น้อย', 'อ้วน BMI เกิน', 'ขาดสารอาหารรุนแรง'],
  },
  pt_category: {
    category: 'pt_category',
    label: 'กายภาพบำบัด (หมวดกิจกรรม)',
    description: 'หมวดกิจกรรมการฟื้นฟูและกายภาพบำบัด',
    allowsCustomCombo: true,
    seedLabels: [
      'กายภาพ, ฝึกเดิน, ป้องกันข้อติด',
      'ฝึกทรงตัว ยืน เดิน',
      'ป้องกันข้อติด',
      'ฟื้นฟูหลังผ่าตัด/ข้อเข่า',
    ],
  },
  thai_med_category: {
    category: 'thai_med_category',
    label: 'แพทย์แผนไทย (หมวดอาการ/บริการ)',
    description: 'หมวดอาการหรือบริการด้านแพทย์แผนไทย',
    allowsCustomCombo: true,
    seedLabels: ['นวดประคบสมุนไพร', 'พอกเข่า/ลดปวด', 'ฟื้นฟูอัมพฤกษ์อัมพาต', 'ดูแลแผล/สมุนไพร'],
  },
}

export interface FctHomeVisitOptionRecord {
  id: number
  category: FctOptionCategory
  label: string
  sortOrder: number
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface FctHomeVisitRecord {
  id: number
  fiscalYear: number
  visitDate: string | null
  pcuName: string | null
  patientName: string
  hn: string | null
  age: number | null
  address: string | null
  adlScore: number | null
  adlGroup: string | null
  diagnosis: string | null
  patientCategory: string | null
  followUpPlan: string | null
  treatmentFacility: string | null
  visitOutcome: string | null
  overallRiskLevel: string | null
  riskLevel: string | null
  dentalNote: string | null
  pharmacyNote: string | null
  nutritionStatus: string | null
  nutritionNote: string | null
  ptCategory: string | null
  ptNote: string | null
  thaiMedCategory: string | null
  thaiMedNote: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface FctHomeVisitCreateInput {
  visitDate?: string | null
  fiscalYear?: number | null
  pcuName?: string | null
  patientName: string
  hn?: string | null
  age?: number | null
  address?: string | null
  adlScore?: number | null
  adlGroup?: string | null
  diagnosis?: string | null
  patientCategory?: string | null
  followUpPlan?: string | null
  treatmentFacility?: string | null
  visitOutcome?: string | null
  overallRiskLevel?: string | null
  riskLevel?: string | null
  dentalNote?: string | null
  pharmacyNote?: string | null
  nutritionStatus?: string | null
  nutritionNote?: string | null
  ptCategory?: string | null
  ptNote?: string | null
  thaiMedCategory?: string | null
  thaiMedNote?: string | null
}

export type FctHomeVisitUpdateInput = Partial<FctHomeVisitCreateInput>

export interface FctHomeVisitPatientLookupResult {
  hn: string
  patientName: string
  age: number | null
  address: string | null
}

export interface FctHomeVisitPcuSummary {
  pcuName: string
  totalVisits: number
  uniquePatients: number
  adlGroupCounts: Record<string, number>
  outcomeCounts: Record<string, number>
}

export interface FctHomeVisitDashboardStats {
  totalVisits: number
  uniquePatients: number
  unidentifiedHnVisits: number
  highRiskOrSevereCount: number
  adlGroupCounts: Record<string, number>
  outcomeCounts: Record<string, number>
  overallRiskCounts: Record<string, number>
  riskLevelCounts: Record<string, number>
  nutritionStatusCounts: Record<string, number>
  byPcu: FctHomeVisitPcuSummary[]
  patientCategoryBreakdown: Array<{ label: string; count: number }>
  monthlyTrend: Array<{ monthKey: string; monthLabel: string; count: number }>
  disciplineEngagement: Array<{ key: string; label: string; filledCount: number; rate: number }>
}

export interface FctHomeVisitListResult {
  fiscalYear: number
  availableFiscalYears: number[]
  availablePcus: string[]
  items: FctHomeVisitRecord[]
  options: Record<FctOptionCategory, FctHomeVisitOptionRecord[]>
  stats: FctHomeVisitDashboardStats
}

export interface FctParsedImportRow {
  rowNumber: number
  data: FctHomeVisitCreateInput
  warnings: string[]
}

export interface FctImportRowError {
  rowNumber: number
  patientName: string
  reason: string
}

export interface FctImportParseResult {
  validRows: FctParsedImportRow[]
  errors: FctImportRowError[]
  totalScanned: number
}

export interface FctBatchImportResult {
  insertedCount: number
  skippedDuplicateCount: number
  errorCount: number
  duplicates: Array<{ rowNumber: number; visitDate: string | null; hn: string; patientName: string }>
}

export interface FctExcelColumnDef {
  key: string
  header: string
  width: number
  getValue: (row: FctHomeVisitRecord, index: number) => string | number | null
}

export const FCT_EXCEL_COLUMNS: readonly FctExcelColumnDef[] = [
  { key: 'seq', header: 'ลำดับ', width: 8, getValue: (_r, idx) => idx + 1 },
  { key: 'patientName', header: 'ชื่อ-สกุล', width: 26, getValue: (r) => r.patientName },
  { key: 'hn', header: 'HN', width: 12, getValue: (r) => r.hn ?? '' },
  { key: 'age', header: 'อายุ', width: 8, getValue: (r) => r.age },
  { key: 'address', header: 'ที่อยู่', width: 32, getValue: (r) => r.address ?? '' },
  { key: 'pcuName', header: 'รพ.สต.', width: 18, getValue: (r) => r.pcuName ?? '' },
  { key: 'adlScore', header: 'คะแนน ADL', width: 12, getValue: (r) => r.adlScore },
  { key: 'adlGroup', header: 'กลุ่ม ADL', width: 14, getValue: (r) => r.adlGroup ?? '' },
  { key: 'diagnosis', header: 'Dx', width: 28, getValue: (r) => r.diagnosis ?? '' },
  { key: 'patientCategory', header: 'ประเภทคนไข้', width: 18, getValue: (r) => r.patientCategory ?? '' },
  { key: 'followUpPlan', header: 'สิ่งที่ต้องตาม', width: 28, getValue: (r) => r.followUpPlan ?? '' },
  { key: 'visitDate', header: 'วันที่เยี่ยมบ้าน', width: 16, getValue: (r) => r.visitDate ?? '' },
  { key: 'treatmentFacility', header: 'สถานที่รักษา', width: 22, getValue: (r) => r.treatmentFacility ?? '' },
  { key: 'visitOutcome', header: 'ผลลัพธ์การเยี่ยม', width: 16, getValue: (r) => r.visitOutcome ?? '' },
  {
    key: 'overallRiskLevel',
    header: 'ระดับความเสี่ยงโดยรวมของผู้ป่วย',
    width: 24,
    getValue: (r) => r.overallRiskLevel ?? '',
  },
  { key: 'riskLevel', header: 'ระดับความเสี่ยง', width: 16, getValue: (r) => r.riskLevel ?? '' },
  { key: 'dentalNote', header: 'ทันตกรรม', width: 24, getValue: (r) => r.dentalNote ?? '' },
  { key: 'pharmacyNote', header: 'เภสัช', width: 24, getValue: (r) => r.pharmacyNote ?? '' },
  { key: 'nutritionStatus', header: 'นักโภช (สถานะ)', width: 20, getValue: (r) => r.nutritionStatus ?? '' },
  { key: 'nutritionNote', header: 'นักโภช (คำแนะนำ)', width: 34, getValue: (r) => r.nutritionNote ?? '' },
  { key: 'ptCategory', header: 'กายภาพ (หมวดกิจกรรม)', width: 24, getValue: (r) => r.ptCategory ?? '' },
  { key: 'ptNote', header: 'กายภาพ (บันทึก)', width: 26, getValue: (r) => r.ptNote ?? '' },
  { key: 'thaiMedCategory', header: 'แผนไทย (หมวดอาการ/บริการ)', width: 24, getValue: (r) => r.thaiMedCategory ?? '' },
  { key: 'thaiMedNote', header: 'แผนไทย (บันทึก)', width: 26, getValue: (r) => r.thaiMedNote ?? '' },
]
