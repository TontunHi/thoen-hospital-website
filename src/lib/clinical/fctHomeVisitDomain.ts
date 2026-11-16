import type {
  FctHomeVisitCreateInput,
  FctHomeVisitDashboardStats,
  FctHomeVisitPcuSummary,
  FctHomeVisitRecord,
  FctImportParseResult,
  FctImportRowError,
  FctParsedImportRow,
} from './fctHomeVisitTypes'

const BANGKOK_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'numeric',
})

const THAI_MONTH_MAP: Record<string, number> = {
  มค: 1,
  มกราคม: 1,
  กพ: 2,
  กุมภาพันธ์: 2,
  มีค: 3,
  มีนาคม: 3,
  เมย: 4,
  เมษายน: 4,
  พค: 5,
  พฤษภาคม: 5,
  มิย: 6,
  มิถุนายน: 6,
  กค: 7,
  กรกฎาคม: 7,
  สค: 8,
  สิงหาคม: 8,
  กย: 9,
  กันยายน: 9,
  ตค: 10,
  ตุลาคม: 10,
  พย: 11,
  พฤศจิกายน: 11,
  ธค: 12,
  ธันวาคม: 12,
}

const THAI_SHORT_MONTHS: readonly string[] = [
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
]

const RISK_NORMALIZATION_MAP: Record<string, string> = {
  low: 'Low',
  'low lisk': 'Low',
  'low risk': 'Low',
  moderate: 'Moderate',
  'moderate lisk': 'Moderate',
  'moderate risk': 'Moderate',
  high: 'High',
  'high lisk': 'High',
  'high risk': 'High',
}

const ADL_GROUP_NORMALIZATION_MAP: Record<string, string> = {
  ติดเตียง: 'ติดเตียง',
  ติิดเตียง: 'ติดเตียง',
  ติดบ้าน: 'ติดบ้าน',
  ติดสังคม: 'ติดสังคม',
}

const NUTRITION_NORMALIZATION_MAP: Record<string, string> = {
  ปกติ: 'ปกติ',
  'ผอม bmi น้อย': 'ผอม BMI น้อย',
  'อ้วนbmi เกิน': 'อ้วน BMI เกิน',
  'อ้วน bmi เกิน': 'อ้วน BMI เกิน',
  ขาดสารอาหารรุนแรง: 'ขาดสารอาหารรุนแรง',
}

const PCU_TYPO_MAP: Record<string, string> = {
  'รพ เถิน': 'รพ.เถิน',
  'รพ.เถิน': 'รพ.เถิน',
  กุุ่่มเนิ้ง: 'กุ่มเนิ้ง',
  กุุุ่มเนิ้ง: 'กุ่มเนิ้ง',
  'รพสต.กุ่มเนิ้ง': 'กุ่มเนิ้ง',
  กุ่มเนิ้ง: 'กุ่มเนิ้ง',
  เด่นแก้้ว: 'เด่นแก้ว',
  'รพสต.บ้านเด่นแก้ว': 'เด่นแก้ว',
  'รพสต.เด่นแก้ว': 'เด่นแก้ว',
  เด่นแก้ว: 'เด่นแก้ว',
  'รพสต.บ้านห้วยแก้ว': 'ห้วยแก้ว',
  'รพสต.ห้วยแก้ว': 'ห้วยแก้ว',
  ห้วยแก้ว: 'ห้วยแก้ว',
  'รพสต.แม่มอกกลาง': 'แม่มอกกลาง',
  แม่มอกกลาง: 'แม่มอกกลาง',
  'รพสต.บ้านดอนแก้ว': 'ดอนแก้ว',
  'รพสต.ดอนแก้ว': 'ดอนแก้ว',
  ดอนแก้ว: 'ดอนแก้ว',
  'รพสต.บ้านแม่วะหลวง': 'แม่วะหลวง',
  'รพสต.แม่วะหลวง': 'แม่วะหลวง',
  แม่วะหลวง: 'แม่วะหลวง',
  'รพสต.บ้านปางอ้า 5': 'ปางอ้า',
  'รพสต.บ้านปางอ้า': 'ปางอ้า',
  'รพสต.ปางอ้า': 'ปางอ้า',
  ปางอ้า: 'ปางอ้า',
  'รพสต นาเบี้ย': 'นาเบี้ย',
  'รพสต.นาเบี้ย': 'นาเบี้ย',
  นาเบี้ี้ย: 'นาเบี้ย',
  นาเบี้ย: 'นาเบี้ย',
  'รพสต.ท่ามะเกว๋น': 'ท่ามะเกว๋น',
  ท่ามะเกว๋น: 'ท่ามะเกว๋น',
  'รพสต.แม่ป่ะหลวง20': 'แม่ปะหลวง',
  'รพสต.แม่ป่ะหลวง': 'แม่ปะหลวง',
  'รพสต.แม่ปะหลวง': 'แม่ปะหลวง',
  แม่ป่ะหลวง: 'แม่ปะหลวง',
  แม่ปะหลวง: 'แม่ปะหลวง',
  'รพสต.วังหินพัฒนา15': 'วังหิน',
  'รพสต.วังหินพัฒนา': 'วังหิน',
  'รพสต.วังหิน': 'วังหิน',
  วังหินพัฒนา: 'วังหิน',
  วังหิน: 'วังหิน',
  'รพสต.นาบ้านไร่': 'นาบ้านไร่',
  นาบ้านไร่: 'นาบ้านไร่',
  'รพสต.แม่ถอด': 'แม่ถอด',
  แม่ถอด: 'แม่ถอด',
  'รพสต.เด่นชัย': 'เด่นชัย',
  'รพสต.หอรบ': 'หอรบ',
  'รพสต.สะเลียมหวาน': 'สะเลียมหวาน',
  'รพสต.หนองหอย': 'หนองหอย',
}

const UNSPECIFIED_LABEL = 'ยังไม่ระบุ'
const UNSPECIFIED_PCU = 'ไม่ระบุ รพ.สต.'

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const cleaned = String(value)
    .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
    .trim()
  if (!cleaned) return null
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

export function normalizeHn(hn?: string | null): string | null {
  if (hn === null || hn === undefined) {
    return null
  }
  const trimmed = String(hn)
    .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
    .trim()
  if (!trimmed) {
    return null
  }
  if (/^\d+$/.test(trimmed) && trimmed.length <= 7) {
    return trimmed.padStart(7, '0')
  }
  return trimmed
}

export function normalizeOptionalText(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const trimmed = String(val).trim()
  return trimmed || null
}

export function normalizeRiskValue(val: unknown): string | null {
  const text = normalizeOptionalText(val)
  if (!text) return null
  return RISK_NORMALIZATION_MAP[text.toLowerCase()] ?? text
}

export function normalizeAdlGroupValue(val: unknown): string | null {
  const text = normalizeOptionalText(val)
  if (!text) return null
  return ADL_GROUP_NORMALIZATION_MAP[text] ?? text
}

export function normalizeNutritionStatusValue(val: unknown): string | null {
  const text = normalizeOptionalText(val)
  if (!text) return null
  return NUTRITION_NORMALIZATION_MAP[text.toLowerCase()] ?? text
}

export function normalizePcuValue(val: unknown): string | null {
  const text = normalizeOptionalText(val)
  if (!text) return null
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return PCU_TYPO_MAP[collapsed] ?? PCU_TYPO_MAP[text] ?? collapsed
}

export function suggestAdlGroup(adlScore: number | null | undefined): string | null {
  if (adlScore === null || adlScore === undefined || !Number.isFinite(adlScore)) {
    return null
  }
  if (adlScore <= 4) return 'ติดเตียง'
  if (adlScore <= 11) return 'ติดบ้าน'
  return 'ติดสังคม'
}

export function getThaiFiscalYearFromDate(
  visitDate: string | null | undefined,
  fallbackFiscalYear?: number | null
): number {
  const match = visitDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(visitDate.trim()) : null
  if (!match) {
    return typeof fallbackFiscalYear === 'number' && Number.isInteger(fallbackFiscalYear)
      ? fallbackFiscalYear
      : getCurrentThaiFiscalYear()
  }
  const gregorianYear = Number(match[1])
  const month = Number(match[2])
  // Thai fiscal year runs Oct 1 – Sep 30, so Oct–Dec belong to next Buddhist year.
  return month >= 10 ? gregorianYear + 544 : gregorianYear + 543
}

export function getFiscalYearDateBounds(fiscalYear: number): {
  startDate: string
  endDate: string
} {
  const startGregorian = fiscalYear - 544
  const endGregorian = fiscalYear - 543
  return {
    startDate: `${startGregorian}-10-01`,
    endDate: `${endGregorian}-09-30`,
  }
}

export function getCurrentThaiFiscalYear(referenceDate: Date = new Date()): number {
  const parts = BANGKOK_PARTS_FORMATTER.formatToParts(referenceDate)
  const gregorianYear = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  return month >= 10 ? gregorianYear + 544 : gregorianYear + 543
}

export function getAvailableFiscalYears(
  existingYears: number[] = [],
  referenceDate: Date = new Date()
): number[] {
  const current = getCurrentThaiFiscalYear(referenceDate)
  const yearSet = new Set<number>([current + 1, current, current - 1, current - 2])
  for (const year of existingYears) {
    if (Number.isInteger(year) && year > 2500) {
      yearSet.add(year)
    }
  }
  return Array.from(yearSet).sort((a, b) => b - a)
}

export function getPopulatedFiscalYears(
  existingYears: number[] = [],
  referenceDate: Date = new Date()
): number[] {
  const yearSet = new Set<number>()
  for (const year of existingYears) {
    if (Number.isInteger(year) && year > 2500) {
      yearSet.add(year)
    }
  }
  if (yearSet.size === 0) {
    return [getCurrentThaiFiscalYear(referenceDate)]
  }
  return Array.from(yearSet).sort((a, b) => b - a)
}

export function resolveDefaultFiscalYear(
  existingYears: number[] = [],
  referenceDate: Date = new Date()
): number {
  const current = getCurrentThaiFiscalYear(referenceDate)
  const populated = getPopulatedFiscalYears(existingYears, referenceDate)
  if (populated.includes(current)) {
    return current
  }
  return populated[0] ?? current
}

function normalizeExcelParsedDateYear(gregorianYear: number): number {
  // Excel on Western-locale machines parses 2-digit Buddhist years (e.g. 11/6/69) as 1969.
  if (gregorianYear >= 1950 && gregorianYear <= 1999) {
    return gregorianYear + 57
  }
  return gregorianYear
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const gregorianYear = year > 2400 ? year - 543 : year
  const d = new Date(Date.UTC(gregorianYear, month - 1, day))
  if (
    d.getUTCFullYear() !== gregorianYear ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null
  }
  return `${String(gregorianYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseFlexibleVisitDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null

  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    const year = normalizeExcelParsedDateYear(raw.getUTCFullYear())
    return toIsoDate(year, raw.getUTCMonth() + 1, raw.getUTCDate())
  }

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 90000) {
    // Excel 1900 epoch serial date (with leap-year bug offset 25569 days to Unix epoch).
    const utcMs = Math.round((raw - 25569) * 86400 * 1000)
    const d = new Date(utcMs)
    const year = normalizeExcelParsedDateYear(d.getUTCFullYear())
    return toIsoDate(year, d.getUTCMonth() + 1, d.getUTCDate())
  }

  const cleaned = String(raw)
    .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
    .trim()
  if (!cleaned) return null

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/.exec(cleaned)
  if (isoMatch) {
    return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
  }

  const slashMatch = /^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})$/.exec(cleaned)
  if (slashMatch) {
    let yr = Number(slashMatch[3])
    if (yr < 100) yr += 2500
    return toIsoDate(yr, Number(slashMatch[2]), Number(slashMatch[1]))
  }

  const thaiMatch = /^(\d{1,2})\s*([ก-ฮ.]+)\s*(\d{2,4})$/.exec(cleaned)
  if (thaiMatch) {
    const day = Number(thaiMatch[1])
    const monthToken = thaiMatch[2].replace(/\./g, '')
    const month = THAI_MONTH_MAP[monthToken]
    let year = Number(thaiMatch[3])
    if (!month) return null
    if (year < 100) {
      year += 2500
    }
    return toIsoDate(year, month, day)
  }

  return null
}

export function formatThaiShortDate(isoDate: string | null | undefined): string {
  if (!isoDate || !isoDate.trim()) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!match) return isoDate
  const beYear = Number(match[1]) + 543
  const monthIdx = Number(match[2]) - 1
  const day = Number(match[3])
  const monthLabel = THAI_SHORT_MONTHS[monthIdx] || match[2]
  return `${day} ${monthLabel} ${beYear}`
}

function cellText(row: unknown[], index: number): string {
  const val = row[index]
  if (val === null || val === undefined) return ''
  if (val instanceof Date && Number.isFinite(val.getTime())) {
    return parseFlexibleVisitDate(val) ?? ''
  }
  return String(val).trim()
}

function buildCombinedPatientName(prefixRaw: string, nameRaw: string): string {
  const cleanName = nameRaw.replace(/\s+/g, ' ').trim()
  if (!cleanName) return ''
  const cleanPrefix = prefixRaw.replace(/\s+/g, ' ').trim()
  if (!cleanPrefix) return cleanName
  if (cleanName.startsWith(cleanPrefix)) return cleanName
  // Thai prefixes like นาย, นาง, น.ส, ดช., ดญ. join without space for standard titles, or keep single space for multi-word ranks.
  if (/\s/.test(cleanPrefix)) {
    return `${cleanPrefix} ${cleanName}`
  }
  return `${cleanPrefix}${cleanName}`
}

function normalizeHeaderText(val: unknown): string {
  return String(val ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactHeaderText(val: unknown): string {
  return String(val ?? '')
    .replace(/\s+/g, '')
    .trim()
}

function isPatientNameHeader(val: unknown): boolean {
  const compact = compactHeaderText(val)
  return compact === 'ชื่อสกุล' || compact === 'ชื่อ-สกุล'
}

function hasDateYearAutoFixWarning(rawVisitDate: unknown): string | null {
  if (rawVisitDate instanceof Date && Number.isFinite(rawVisitDate.getTime())) {
    const rawYear = rawVisitDate.getUTCFullYear()
    if (rawYear >= 1950 && rawYear <= 1999) {
      return `ปรับปีวันที่เยี่ยมจาก ${rawYear} เป็น พ.ศ. ${rawYear + 600}`
    }
  }
  return null
}

function parseSingleRowExportMatrix(
  rows: unknown[][],
  headerRowIdx: number
): FctImportParseResult {
  const headers = rows[headerRowIdx].map(normalizeHeaderText)
  const colIndex = (name: string) => headers.findIndex((h) => h === name)
  const patientNameCol = headers.findIndex((h) => isPatientNameHeader(h))

  const idx = {
    patientName: patientNameCol >= 0 ? patientNameCol : colIndex('ชื่อ-สกุล'),
    hn: colIndex('HN'),
    age: colIndex('อายุ'),
    address: colIndex('ที่อยู่'),
    pcuName: colIndex('รพ.สต.') >= 0 ? colIndex('รพ.สต.') : colIndex('รพสต'),
    adlScore: colIndex('คะแนน ADL'),
    adlGroup: colIndex('กลุ่ม ADL'),
    diagnosis: colIndex('Dx'),
    patientCategory: colIndex('ประเภทคนไข้'),
    followUpPlan: colIndex('สิ่งที่ต้องตาม'),
    visitDate: colIndex('วันที่เยี่ยมบ้าน'),
    treatmentFacility: colIndex('สถานที่รักษา'),
    visitOutcome: colIndex('ผลลัพธ์การเยี่ยม'),
    overallRiskLevel: colIndex('ระดับความเสี่ยงโดยรวมของผู้ป่วย'),
    riskLevel: colIndex('ระดับความเสี่ยง'),
    dentalNote: colIndex('ทันตกรรม'),
    pharmacyNote: colIndex('เภสัช'),
    nutritionStatus: colIndex('นักโภช (สถานะ)'),
    nutritionNote: colIndex('นักโภช (คำแนะนำ)'),
    ptCategory: colIndex('กายภาพ (หมวดกิจกรรม)'),
    ptNote: colIndex('กายภาพ (บันทึก)'),
    thaiMedCategory: colIndex('แผนไทย (หมวดอาการ/บริการ)'),
    thaiMedNote: colIndex('แผนไทย (บันทึก)'),
  }

  const validRows: FctParsedImportRow[] = []
  const errors: FctImportRowError[] = []
  let totalScanned = 0

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const hasContent = row.some((cell) => String(cell ?? '').trim() !== '')
    if (!hasContent) continue

    totalScanned += 1
    const rowNumber = i + 1
    const patientName =
      idx.patientName >= 0 ? cellText(row, idx.patientName).replace(/\s+/g, ' ').trim() : ''
    const rawVisitDate = idx.visitDate >= 0 ? row[idx.visitDate] : null
    const hasRawVisitDate = rawVisitDate !== null && rawVisitDate !== undefined && String(rawVisitDate).trim() !== ''
    const visitDate = parseFlexibleVisitDate(rawVisitDate)

    if (!patientName) {
      errors.push({ rowNumber, patientName: '-', reason: 'ไม่พบชื่อ-สกุลผู้ป่วย' })
      continue
    }
    if (hasRawVisitDate && !visitDate) {
      errors.push({ rowNumber, patientName, reason: 'วันที่เยี่ยมบ้านไม่ถูกต้อง' })
      continue
    }

    const warnings: string[] = []
    if (!visitDate) {
      warnings.push('ไม่มีวันที่เยี่ยมบ้าน')
    }
    const dateWarning = hasDateYearAutoFixWarning(rawVisitDate)
    if (dateWarning) warnings.push(dateWarning)

    const adlScore = idx.adlScore >= 0 ? toNullableNumber(row[idx.adlScore]) : null
    const rawAdlGroup = idx.adlGroup >= 0 ? normalizeAdlGroupValue(row[idx.adlGroup]) : null
    const adlGroup = rawAdlGroup ?? suggestAdlGroup(adlScore)

    validRows.push({
      rowNumber,
      warnings,
      data: {
        visitDate,
        pcuName: idx.pcuName >= 0 ? normalizePcuValue(row[idx.pcuName]) : null,
        patientName,
        hn: idx.hn >= 0 ? normalizeHn(cellText(row, idx.hn)) : null,
        age: idx.age >= 0 ? toNullableNumber(row[idx.age]) : null,
        address: idx.address >= 0 ? normalizeOptionalText(row[idx.address]) : null,
        adlScore,
        adlGroup,
        diagnosis: idx.diagnosis >= 0 ? normalizeOptionalText(row[idx.diagnosis]) : null,
        patientCategory:
          idx.patientCategory >= 0 ? normalizeOptionalText(row[idx.patientCategory]) : null,
        followUpPlan: idx.followUpPlan >= 0 ? normalizeOptionalText(row[idx.followUpPlan]) : null,
        treatmentFacility:
          idx.treatmentFacility >= 0 ? normalizeOptionalText(row[idx.treatmentFacility]) : null,
        visitOutcome: idx.visitOutcome >= 0 ? normalizeOptionalText(row[idx.visitOutcome]) : null,
        overallRiskLevel:
          idx.overallRiskLevel >= 0 ? normalizeRiskValue(row[idx.overallRiskLevel]) : null,
        riskLevel: idx.riskLevel >= 0 ? normalizeRiskValue(row[idx.riskLevel]) : null,
        dentalNote: idx.dentalNote >= 0 ? normalizeOptionalText(row[idx.dentalNote]) : null,
        pharmacyNote: idx.pharmacyNote >= 0 ? normalizeOptionalText(row[idx.pharmacyNote]) : null,
        nutritionStatus:
          idx.nutritionStatus >= 0
            ? normalizeNutritionStatusValue(row[idx.nutritionStatus])
            : null,
        nutritionNote:
          idx.nutritionNote >= 0 ? normalizeOptionalText(row[idx.nutritionNote]) : null,
        ptCategory: idx.ptCategory >= 0 ? normalizeOptionalText(row[idx.ptCategory]) : null,
        ptNote: idx.ptNote >= 0 ? normalizeOptionalText(row[idx.ptNote]) : null,
        thaiMedCategory:
          idx.thaiMedCategory >= 0 ? normalizeOptionalText(row[idx.thaiMedCategory]) : null,
        thaiMedNote: idx.thaiMedNote >= 0 ? normalizeOptionalText(row[idx.thaiMedNote]) : null,
      },
    })
  }

  return { validRows, errors, totalScanned }
}

const TWO_ROW_SUBHEADER_TOKENS = new Set([
  'คำนำหน้า',
  'ประเภทคนไข้',
  'คะแนน',
  'ติดเตียง',
  'ทันตกรรม',
  'เภสัช',
  'นักโภช',
  'กายภาพ',
  'แผนไทย',
])

export function parseFctImportMatrix(rows: unknown[][]): FctImportParseResult {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { validRows: [], errors: [], totalScanned: 0 }
  }

  const firstHeaderIdx = rows.findIndex((r) =>
    (r || []).some((cell) => {
      const t = normalizeHeaderText(cell)
      return isPatientNameHeader(t) || t === 'วันที่เยี่ยมบ้าน'
    })
  )

  if (firstHeaderIdx < 0) {
    return {
      validRows: [],
      errors: [{ rowNumber: 1, patientName: '-', reason: 'ไม่พบหัวตารางไฟล์เยี่ยมบ้านทีม FCT' }],
      totalScanned: 0,
    }
  }

  const firstHeaders = (rows[firstHeaderIdx] || []).map(normalizeHeaderText)
  const nextRow = (rows[firstHeaderIdx + 1] || []).map(normalizeHeaderText)
  const isExplicitSingleRowExport =
    firstHeaders.includes('คะแนน ADL') ||
    firstHeaders.includes('กลุ่ม ADL') ||
    firstHeaders.includes('ผลลัพธ์การเยี่ยม') ||
    firstHeaders.includes('รพ.สต.') ||
    firstHeaders.includes('นักโภช (สถานะ)')
  const hasSubheaderRow =
    !isExplicitSingleRowExport &&
    nextRow.some((token) => TWO_ROW_SUBHEADER_TOKENS.has(token))
  const isTwoRowTemplate =
    !isExplicitSingleRowExport &&
    (hasSubheaderRow ||
      firstHeaders.some((h) => compactHeaderText(h) === 'ชื่อสกุล') ||
      firstHeaders.includes('สี/ ADL') ||
      firstHeaders.includes('รพสต'))

  if (!isTwoRowTemplate && firstHeaders.some((h) => isPatientNameHeader(h))) {
    return parseSingleRowExportMatrix(rows, firstHeaderIdx)
  }

  const dataStartIdx = isTwoRowTemplate ? firstHeaderIdx + 2 : firstHeaderIdx + 1
  const hnHeaderIdx = firstHeaders.indexOf('HN')
  const nameHeaderIdx = firstHeaders.findIndex((h) => isPatientNameHeader(h))
  const hasPrefixColumn =
    nextRow.includes('คำนำหน้า') ||
    hnHeaderIdx === 3 ||
    (nameHeaderIdx === 2 && hnHeaderIdx !== 2)
  const colShift = hasPrefixColumn ? 0 : -1

  const validRows: FctParsedImportRow[] = []
  const errors: FctImportRowError[] = []
  let totalScanned = 0

  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i] || []
    const rowNumber = i + 1
    const patientName = hasPrefixColumn
      ? buildCombinedPatientName(cellText(row, 1), cellText(row, 2))
      : cellText(row, 1).replace(/\s+/g, ' ').trim()
    const hnCol = 3 + colShift
    const dateCol = 12 + colShift
    const rawVisitDate = row[dateCol]

    // Skip trailing empty/stray-note rows (rows without patient name and visit date and HN).
    const hasCoreIdentity = Boolean(patientName || cellText(row, hnCol) || cellText(row, dateCol))
    if (!hasCoreIdentity) {
      continue
    }

    totalScanned += 1
    if (!patientName) {
      errors.push({ rowNumber, patientName: '-', reason: 'ไม่พบชื่อ-สกุลผู้ป่วย' })
      continue
    }

    const hasRawVisitDate =
      rawVisitDate !== null && rawVisitDate !== undefined && String(rawVisitDate).trim() !== ''
    const visitDate = parseFlexibleVisitDate(rawVisitDate)
    if (hasRawVisitDate && !visitDate) {
      errors.push({ rowNumber, patientName, reason: 'วันที่เยี่ยมบ้านไม่ถูกต้อง' })
      continue
    }

    const warnings: string[] = []
    if (!visitDate) {
      warnings.push('ไม่มีวันที่เยี่ยมบ้าน')
    }
    const dateWarning = hasDateYearAutoFixWarning(rawVisitDate)
    if (dateWarning) {
      warnings.push(dateWarning)
    }

    const rawHn = cellText(row, hnCol)
    const hn = normalizeHn(rawHn)
    if (!hn) {
      warnings.push('ไม่มี HN')
    } else if (rawHn !== hn && /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(rawHn)) {
      warnings.push(`ปรับ HN จาก "${rawHn}" เป็น "${hn}"`)
    }

    const adlScore = toNullableNumber(row[7 + colShift])
    const rawAdlGroup = normalizeAdlGroupValue(row[8 + colShift])
    const adlGroup = rawAdlGroup ?? suggestAdlGroup(adlScore)

    const data: FctHomeVisitCreateInput = {
      patientName,
      hn,
      age: toNullableNumber(row[4 + colShift]),
      address: normalizeOptionalText(row[5 + colShift]),
      pcuName: normalizePcuValue(row[6 + colShift]),
      adlScore: adlScore !== null && adlScore >= 0 && adlScore <= 20 ? Math.trunc(adlScore) : null,
      adlGroup,
      diagnosis: normalizeOptionalText(row[9 + colShift]),
      patientCategory: normalizeOptionalText(row[10 + colShift]),
      followUpPlan: normalizeOptionalText(row[11 + colShift]),
      visitDate,
      treatmentFacility: normalizeOptionalText(row[13 + colShift]),
      visitOutcome: normalizeOptionalText(row[14 + colShift]),
      overallRiskLevel: normalizeRiskValue(row[15 + colShift]),
      riskLevel: null,
      dentalNote: normalizeOptionalText(row[16 + colShift]),
      pharmacyNote: normalizeOptionalText(row[17 + colShift]),
      nutritionStatus: normalizeNutritionStatusValue(row[18 + colShift]),
      nutritionNote: normalizeOptionalText(row[19 + colShift]),
      ptCategory: normalizeOptionalText(row[20 + colShift]),
      ptNote: normalizeOptionalText(row[21 + colShift]),
      thaiMedCategory: normalizeOptionalText(row[22 + colShift]),
      thaiMedNote: normalizeOptionalText(row[23 + colShift]),
    }

    validRows.push({ rowNumber, data, warnings })
  }

  return { validRows, errors, totalScanned }
}

function buildFiscalYearMonths(fiscalYear: number): Array<{ monthKey: string; monthLabel: string }> {
  const startGregorian = fiscalYear - 544
  const endGregorian = fiscalYear - 543
  const months: Array<{ monthKey: string; monthLabel: string }> = []

  for (let offset = 0; offset < 12; offset++) {
    const monthIndex = (9 + offset) % 12
    const gregorianYear = offset < 3 ? startGregorian : endGregorian
    const beShort = String(gregorianYear + 543).slice(-2)
    const monthNum = String(monthIndex + 1).padStart(2, '0')
    months.push({
      monthKey: `${gregorianYear}-${monthNum}`,
      monthLabel: `${THAI_SHORT_MONTHS[monthIndex]} ${beShort}`,
    })
  }

  return months
}

function countByLabel(
  records: FctHomeVisitRecord[],
  getter: (r: FctHomeVisitRecord) => string | null,
  seedLabels: string[] = []
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const label of seedLabels) {
    const clean = label.trim()
    if (clean) counts[clean] = 0
  }
  for (const record of records) {
    const val = getter(record)?.trim() || UNSPECIFIED_LABEL
    counts[val] = (counts[val] ?? 0) + 1
  }
  return counts
}

export function aggregateFctDashboardStats(
  records: FctHomeVisitRecord[],
  fiscalYear: number,
  seedLabels: {
    adlGroups?: string[]
    outcomes?: string[]
    overallRisks?: string[]
    riskLevels?: string[]
    nutritionStatuses?: string[]
  } = {}
): FctHomeVisitDashboardStats {
  const totalVisits = records.length
  const uniqueHns = new Set<string>()
  let unidentifiedHnVisits = 0
  let highRiskOrSevereCount = 0

  const pcuMap = new Map<
    string,
    {
      totalVisits: number
      uniqueHns: Set<string>
      adlGroupCounts: Record<string, number>
      outcomeCounts: Record<string, number>
    }
  >()

  const categoryCounts = new Map<string, number>()
  const monthlyCounts = new Map<string, number>()

  let dentalFilled = 0
  let pharmacyFilled = 0
  let nutritionFilled = 0
  let ptFilled = 0
  let thaiMedFilled = 0

  for (const r of records) {
    const cleanHn = normalizeHn(r.hn)
    if (cleanHn) {
      uniqueHns.add(cleanHn)
    } else {
      unidentifiedHnVisits += 1
    }

    if (
      r.overallRiskLevel === 'High' ||
      r.riskLevel === 'High' ||
      r.nutritionStatus === 'ขาดสารอาหารรุนแรง'
    ) {
      highRiskOrSevereCount += 1
    }

    const pcuName = r.pcuName?.trim() || UNSPECIFIED_PCU
    let pcuEntry = pcuMap.get(pcuName)
    if (!pcuEntry) {
      pcuEntry = {
        totalVisits: 0,
        uniqueHns: new Set<string>(),
        adlGroupCounts: {},
        outcomeCounts: {},
      }
      pcuMap.set(pcuName, pcuEntry)
    }
    pcuEntry.totalVisits += 1
    if (cleanHn) pcuEntry.uniqueHns.add(cleanHn)

    const adl = r.adlGroup?.trim() || UNSPECIFIED_LABEL
    pcuEntry.adlGroupCounts[adl] = (pcuEntry.adlGroupCounts[adl] ?? 0) + 1

    const outcome = r.visitOutcome?.trim() || UNSPECIFIED_LABEL
    pcuEntry.outcomeCounts[outcome] = (pcuEntry.outcomeCounts[outcome] ?? 0) + 1

    const category = r.patientCategory?.trim() || UNSPECIFIED_LABEL
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)

    if (r.visitDate && /^\d{4}-\d{2}/.test(r.visitDate)) {
      const monthKey = r.visitDate.slice(0, 7)
      monthlyCounts.set(monthKey, (monthlyCounts.get(monthKey) ?? 0) + 1)
    }

    if (r.dentalNote?.trim()) dentalFilled += 1
    if (r.pharmacyNote?.trim()) pharmacyFilled += 1
    if (r.nutritionStatus?.trim() || r.nutritionNote?.trim()) nutritionFilled += 1
    if (r.ptCategory?.trim() || r.ptNote?.trim()) ptFilled += 1
    if (r.thaiMedCategory?.trim() || r.thaiMedNote?.trim()) thaiMedFilled += 1
  }

  const byPcu: FctHomeVisitPcuSummary[] = Array.from(pcuMap.entries())
    .map(([pcuName, entry]) => ({
      pcuName,
      totalVisits: entry.totalVisits,
      uniquePatients: entry.uniqueHns.size,
      adlGroupCounts: entry.adlGroupCounts,
      outcomeCounts: entry.outcomeCounts,
    }))
    .sort((a, b) => b.totalVisits - a.totalVisits || a.pcuName.localeCompare(b.pcuName, 'th'))

  const patientCategoryBreakdown = Array.from(categoryCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'th'))

  const monthlyTrend = buildFiscalYearMonths(fiscalYear).map((m) => ({
    monthKey: m.monthKey,
    monthLabel: m.monthLabel,
    count: monthlyCounts.get(m.monthKey) ?? 0,
  }))

  const rateOf = (count: number) =>
    totalVisits > 0 ? Math.round((count / totalVisits) * 1000) / 10 : 0

  return {
    totalVisits,
    uniquePatients: uniqueHns.size,
    unidentifiedHnVisits,
    highRiskOrSevereCount,
    adlGroupCounts: countByLabel(records, (r) => r.adlGroup, seedLabels.adlGroups),
    outcomeCounts: countByLabel(records, (r) => r.visitOutcome, seedLabels.outcomes),
    overallRiskCounts: countByLabel(records, (r) => r.overallRiskLevel, seedLabels.overallRisks),
    riskLevelCounts: countByLabel(records, (r) => r.riskLevel, seedLabels.riskLevels),
    nutritionStatusCounts: countByLabel(
      records,
      (r) => r.nutritionStatus,
      seedLabels.nutritionStatuses
    ),
    byPcu,
    patientCategoryBreakdown,
    monthlyTrend,
    disciplineEngagement: [
      { key: 'nutrition', label: 'นักโภชนาการ', filledCount: nutritionFilled, rate: rateOf(nutritionFilled) },
      { key: 'dental', label: 'ทันตกรรม', filledCount: dentalFilled, rate: rateOf(dentalFilled) },
      { key: 'pharmacy', label: 'เภสัชกรรม', filledCount: pharmacyFilled, rate: rateOf(pharmacyFilled) },
      { key: 'pt', label: 'กายภาพบำบัด', filledCount: ptFilled, rate: rateOf(ptFilled) },
      { key: 'thaiMed', label: 'แพทย์แผนไทย', filledCount: thaiMedFilled, rate: rateOf(thaiMedFilled) },
    ],
  }
}
