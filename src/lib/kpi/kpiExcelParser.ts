/**
 * Smart Excel (.xlsx / .xls) and CSV Parser for Hospital KPI Indicators
 * 
 * Features:
 * - Smart Header Detection: matches columns by Thai/English semantic names
 * - Fallback to positional columns A - N
 * - Automatic operator & target value extraction (>=, <=, >, <, =, MIN, %)
 * - Cleans and normalizes frequencies ('ราย 6 เดือน', 'รายไตรมาส', 'รายเดือน', 'รายปี')
 */

export interface ParsedKpiRow {
  sequence: string | null
  category: string
  subcategory: string | null
  code: string | null
  oldCode: string | null
  frequency: string
  title: string
  numeratorName: string | null
  denominatorName: string | null
  targetRaw: string | null
  targetOperator: string | null
  targetValue: number | null
  targetUnit: string | null
  responsibleName: string | null
  indicatorType: string
}

export interface KpiParseResult {
  indicators: ParsedKpiRow[]
  totalRowsScanned: number
  headersDetected: Record<string, number>
  skippedRows: number
  warnings: string[]
}

export function parseTarget(raw?: string | null): { operator: string | null; value: number | null; unit: string | null } {
  if (!raw || !String(raw).trim()) {
    return { operator: null, value: null, unit: null }
  }

  const text = String(raw).trim()

  if (/^min\b/i.test(text) || text.includes('MIN') || text.includes('ต่ำที่สุด') || text.includes('น้อยที่สุด')) {
    const numMatch = text.match(/[-+]?\d*\.?\d+/)
    return {
      operator: 'MIN',
      value: numMatch ? parseFloat(numMatch[0]) : null,
      unit: text.includes('%') ? '%' : null
    }
  }

  let operator: string | null = null
  if (text.startsWith('>=') || text.includes('≥') || text.includes('ไม่ต่ำกว่า') || text.includes('มากกว่าหรือเท่ากับ')) {
    operator = '>='
  } else if (text.startsWith('<=') || text.includes('≤') || text.includes('ไม่เกิน') || text.includes('น้อยกว่าหรือเท่ากับ')) {
    operator = '<='
  } else if (text.startsWith('>')) {
    operator = '>'
  } else if (text.startsWith('<')) {
    operator = '<'
  } else if (text.startsWith('=')) {
    operator = '='
  }

  const numMatch = text.match(/[-+]?\d*\.?\d+/)
  const value = numMatch ? parseFloat(numMatch[0]) : null

  let unit: string | null = null
  if (text.includes('%') || text.includes('ร้อยละ')) {
    unit = '%'
  } else if (text.includes('ต่อพัน') || text.includes('/1,000') || text.includes('/1000')) {
    unit = 'ต่อพัน'
  } else if (text.includes('วัน')) {
    unit = 'วัน'
  } else if (text.includes('ครั้ง')) {
    unit = 'ครั้ง'
  } else if (text.includes('นาที')) {
    unit = 'นาที'
  } else if (text.includes('ราย')) {
    unit = 'ราย'
  }

  return { operator, value, unit }
}

export function normalizeFrequency(freq?: string | null): string {
  if (!freq) return 'ราย 6 เดือน'
  const f = String(freq).trim()
  if (f.includes('6 เดือน') || f.includes('ครึ่งปี')) return 'ราย 6 เดือน'
  if (f.includes('ไตรมาส') || f.includes('3 เดือน')) return 'รายไตรมาส'
  if (f.includes('เดือน') && !f.includes('6 เดือน')) return 'รายเดือน'
  if (f.includes('ปี') && !f.includes('ครึ่งปี')) return 'รายปี'
  return f || 'ราย 6 เดือน'
}

/**
 * Detect column indexes from header row using semantic keywords
 */
export function detectHeaderMapping(headerRow: (string | null | undefined)[]): Record<string, number> {
  const map: Record<string, number> = {}

  headerRow.forEach((cell, idx) => {
    if (!cell) return
    const text = String(cell).trim().toLowerCase()

    if (!map.sequence && (text === 'ลำดับ' || text === 'ข้อ' || text === 'no' || text === 'seq')) {
      map.sequence = idx
    } else if (!map.category && (text.includes('หมวด') || text === 'category' || text === 'group')) {
      map.category = idx
    } else if (!map.subcategory && (text.includes('เข็มมุ่ง') || text.includes('ยุทธศาสตร์') || text.includes('ประเด็น') || text === 'subcategory')) {
      map.subcategory = idx
    } else if (!map.code && (text === 'รหัส' || text.includes('รหัสตัวชี้วัด') || text === 'code' || text === 'kpi code')) {
      map.code = idx
    } else if (!map.oldCode && (text.includes('รหัสเดิม') || text === 'old code' || text === 'old_code')) {
      map.oldCode = idx
    } else if (!map.frequency && (text.includes('ความถี่') || text.includes('รอบ') || text === 'frequency')) {
      map.frequency = idx
    } else if (!map.numeratorName && (text.includes('ตัวตั้ง') || text.includes('คำถามรอง 1') || text === 'numerator')) {
      map.numeratorName = idx
    } else if (!map.denominatorName && (text.includes('ตัวหาร') || text.includes('คำถามรอง 2') || text === 'denominator')) {
      map.denominatorName = idx
    } else if (!map.title && (text.includes('ตัวชี้วัด') || text.includes('คำถามหลัก') || text === 'title' || text === 'indicator')) {
      // Must not be numerator or denominator
      if (!text.includes('ตัวตั้ง') && !text.includes('ตัวหาร') && !text.includes('หมวด') && !text.includes('รหัส')) {
        map.title = idx
      }
    } else if (!map.targetRaw && (text.includes('เป้าหมาย') || text.includes('เกณฑ์') || text === 'target' || text === 'goal')) {
      map.targetRaw = idx
    } else if (!map.responsibleName && (text.includes('ผู้รับผิดชอบ') || text.includes('ผู้รายงาน') || text.includes('เจ้าของ') || text === 'responsible' || text === 'owner')) {
      map.responsibleName = idx
    } else if (!map.indicatorType && (text.includes('ประเภท') || text === 'type')) {
      map.indicatorType = idx
    }
  })

  // Fallback defaults for missing columns (based on original layout A - N)
  if (map.sequence === undefined) map.sequence = 0
  if (map.category === undefined) map.category = 1
  if (map.subcategory === undefined) map.subcategory = 2
  if (map.code === undefined) map.code = 4
  if (map.oldCode === undefined) map.oldCode = 5
  if (map.frequency === undefined) map.frequency = 6
  if (map.title === undefined) map.title = 7
  if (map.numeratorName === undefined) map.numeratorName = 8
  if (map.denominatorName === undefined) map.denominatorName = 9
  if (map.targetRaw === undefined) map.targetRaw = 10
  if (map.responsibleName === undefined) map.responsibleName = 11

  return map
}

/**
 * Parse 2D row array (from read-excel-file or CSV) into structured indicator rows
 */
export function parseKpiRows(rawRows: (any[] | null | undefined)[]): KpiParseResult {
  const result: KpiParseResult = {
    indicators: [],
    totalRowsScanned: 0,
    headersDetected: {},
    skippedRows: 0,
    warnings: [],
  }

  if (!rawRows || rawRows.length === 0) {
    return result
  }

  // Find header row (usually row 0, but check first 3 rows for keywords)
  let headerRowIndex = 0
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = rawRows[i]
    if (Array.isArray(row)) {
      const rowText = row.map(c => String(c || '').trim()).join(' ')
      if (rowText.includes('ตัวชี้วัด') || rowText.includes('หมวด') || rowText.includes('เป้าหมาย')) {
        headerRowIndex = i
        break
      }
    }
  }

  const headerRow = rawRows[headerRowIndex] || []
  const colMap = detectHeaderMapping(headerRow)
  result.headersDetected = colMap

  let currentCategory = 'หมวดทั่วไป'

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    result.totalRowsScanned++
    const row = rawRows[r]
    if (!Array.isArray(row) || row.length === 0) {
      result.skippedRows++
      continue
    }

    const getVal = (colIdx?: number): string | null => {
      if (colIdx === undefined || colIdx < 0 || colIdx >= row.length) return null
      const v = row[colIdx]
      if (v === null || v === undefined) return null
      const s = String(v).trim()
      return s.length > 0 ? s : null
    }

    // Category update if present
    const rowCat = getVal(colMap.category)
    if (rowCat && rowCat.length > 0) {
      currentCategory = rowCat
    }

    const title = getVal(colMap.title)
    if (!title) {
      result.skippedRows++
      continue
    }

    // Skip if title is literally a header
    if (title === 'ตัวชี้วัด' || title === 'ชื่อตัวชี้วัด' || title === 'title') {
      result.skippedRows++
      continue
    }

    const seq = getVal(colMap.sequence)
    const subcat = getVal(colMap.subcategory)
    const code = getVal(colMap.code)
    const oldCode = getVal(colMap.oldCode)
    const rawFreq = getVal(colMap.frequency)
    const numName = getVal(colMap.numeratorName)
    const denName = getVal(colMap.denominatorName)
    const targetRaw = getVal(colMap.targetRaw)
    const resp = getVal(colMap.responsibleName)
    const indType = getVal(colMap.indicatorType) || 'HA'

    const targetParsed = parseTarget(targetRaw)
    const frequency = normalizeFrequency(rawFreq)

    result.indicators.push({
      sequence: seq,
      category: currentCategory,
      subcategory: subcat,
      code,
      oldCode,
      frequency,
      title,
      numeratorName: numName,
      denominatorName: denName,
      targetRaw,
      targetOperator: targetParsed.operator,
      targetValue: targetParsed.value,
      targetUnit: targetParsed.unit,
      responsibleName: resp,
      indicatorType: indType,
    })
  }

  return result
}
