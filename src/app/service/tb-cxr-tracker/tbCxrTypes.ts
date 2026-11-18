export interface TbRecord {
  id: number
  risk_type: string | null
  title: string | null
  fname: string | null
  lname: string | null
  cid: string | null
  gender: string | null
  born: string | null
  addr: string | null
  mu: string | null
  province_id: string | null
  amphur_id: string | null
  tambol_id: string | null
  full_name: string | null
  people_type: string | null
  race_id: string | null
  hn: string | null
  inccl_id: string | null
  contact_date: string | null
  symptom_screen: string | null
  cxr_date: string | null
  cxr_status: 'DONE' | 'MISSING'
  cxr_result: string | null
  cxr_abnormal_result: string | null
  dx: string | null
  icd10: string | null
  hba1c: string | null
  immunno_discase: string | null
  b24: string | null
  b24_ch: string | null
  note: string | null
  age: number | null
  status: string
  home: string
}

export interface SummaryData {
  total: number
  doneCount: number
  missingCount: number
  coveragePercentage: number
  statusBreakdown: Record<string, number>
}

export type FilterTab = 'all' | 'done' | 'missing'
export type SortOption = 'default' | 'missing_first' | 'cxr_recent' | 'name_asc' | 'age_desc'
export type ExportScope = 'filtered' | 'all' | 'done' | 'missing'

export interface HospCoverageItem {
  name: string
  total: number
  done: number
  missing: number
  coverageRate: number
}

const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const

/** แปลงวันที่ YYYYMMDD หรือ YYYY-MM-DD เป็นวันที่ไทย พ.ศ. (เช่น "16 ต.ค. 2569") */
export function formatThaiDateString(rawDate?: string | null): string {
  if (!rawDate) return '-'
  const clean = String(rawDate).trim()
  if (!clean) return '-'

  let year = 0
  let month = 0
  let day = 0

  if (/^\d{8}$/.test(clean)) {
    year = parseInt(clean.substring(0, 4), 10)
    month = parseInt(clean.substring(4, 6), 10) - 1
    day = parseInt(clean.substring(6, 8), 10)
  } else {
    const parsed = new Date(clean)
    if (Number.isNaN(parsed.getTime())) return clean
    year = parsed.getFullYear()
    month = parsed.getMonth()
    day = parsed.getDate()
  }

  const monthLabel = THAI_SHORT_MONTHS[month]
  if (!monthLabel || day < 1 || day > 31) return clean

  const thaiYear = year > 2400 ? year : year + 543
  return `${day} ${monthLabel} ${thaiYear}`
}

export function formatPatientFullName(record: Pick<TbRecord, 'title' | 'fname' | 'lname'>): string {
  const prefix = record.title?.trim() || ''
  const first = record.fname?.trim() || '-'
  const last = record.lname?.trim() || ''
  return `${prefix}${first}${last ? ` ${last}` : ''}`.trim()
}

export function formatGenderLabel(gender?: string | null): string {
  if (gender === 'M') return 'ชาย'
  if (gender === 'F') return 'หญิง'
  return 'ไม่ระบุ'
}
