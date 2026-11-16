import {
  PROJECT_BUDGET_SOURCES,
  PROJECT_SUBMISSION_STATUSES,
  type ProjectBreakdownStat,
  type ProjectCreateInput,
  type ProjectDashboardStats,
  type ProjectImportParseResult,
  type ProjectImportPreviewRow,
  type ProjectQuarterSummary,
  type ProjectRecord,
  type ProjectRecordRaw,
  type ProjectStrategySummary,
} from './projectTrackerTypes'

const BANGKOK_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'numeric',
})

export function getCurrentThaiFiscalYear(date: Date = new Date()): number {
  const parts = BANGKOK_PARTS_FORMATTER.formatToParts(date)
  const yearCe = Number(parts.find((p) => p.type === 'year')?.value ?? date.getFullYear())
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? date.getMonth() + 1)
  const fyCe = month >= 10 ? yearCe + 1 : yearCe
  return fyCe + 543
}

export function getPopulatedFiscalYears(populatedYears: number[] = []): number[] {
  const set = new Set<number>()
  for (const fy of populatedYears) {
    if (Number.isInteger(fy) && fy >= 2560 && fy <= 2650) {
      set.add(fy)
    }
  }
  return Array.from(set).sort((a, b) => b - a)
}

export function getSelectableFiscalYears(
  populatedYears: number[] = [],
  now: Date = new Date()
): number[] {
  const currentFy = getCurrentThaiFiscalYear(now)
  const set = new Set<number>([currentFy, currentFy - 1, currentFy + 1])
  for (const fy of populatedYears) {
    if (Number.isInteger(fy) && fy >= 2560 && fy <= 2650) {
      set.add(fy)
    }
  }
  return Array.from(set).sort((a, b) => b - a)
}

export function resolveDefaultFiscalYear(
  populatedYears: number[],
  now: Date = new Date()
): number {
  const currentFy = getCurrentThaiFiscalYear(now)
  if (populatedYears.includes(currentFy)) return currentFy
  const sorted = getPopulatedFiscalYears(populatedYears)
  return sorted[0] ?? currentFy
}

export function normalizeBudgetNumber(val: unknown): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 0
    return Math.round(Math.max(0, val) * 100) / 100
  }
  const cleaned = String(val)
    .replace(/,/g, '')
    .replace(/฿/g, '')
    .trim()
  if (!cleaned || cleaned === '-' || cleaned === '—') return 0
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(Math.max(0, parsed) * 100) / 100
}

export function normalizeOptionalText(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const trimmed = String(val).trim()
  if (!trimmed || trimmed === '-') return null
  return trimmed
}

export function computeAllocatedBudget(
  q1: number,
  q2: number,
  q3: number,
  q4: number
): number {
  const total =
    normalizeBudgetNumber(q1) +
    normalizeBudgetNumber(q2) +
    normalizeBudgetNumber(q3) +
    normalizeBudgetNumber(q4)
  return Math.round(total * 100) / 100
}

export function enrichProjectRecord(raw: ProjectRecordRaw): ProjectRecord {
  const q1Budget = normalizeBudgetNumber(raw.q1Budget)
  const q2Budget = normalizeBudgetNumber(raw.q2Budget)
  const q3Budget = normalizeBudgetNumber(raw.q3Budget)
  const q4Budget = normalizeBudgetNumber(raw.q4Budget)
  const actualSpent = normalizeBudgetNumber(raw.actualSpent)
  const allocatedBudget = computeAllocatedBudget(q1Budget, q2Budget, q3Budget, q4Budget)
  const remainingBudget = Math.round((allocatedBudget - actualSpent) * 100) / 100
  const disbursementRate =
    allocatedBudget > 0
      ? Math.round(((actualSpent / allocatedBudget) * 100) * 10) / 10
      : 0

  return {
    ...raw,
    q1Budget,
    q2Budget,
    q3Budget,
    q4Budget,
    actualSpent,
    allocatedBudget,
    remainingBudget,
    disbursementRate,
  }
}

function getNaturalStrategyKey(strategy: string): [number, number, string] {
  const trimmed = strategy.trim()
  const match = trimmed.match(/^ย\.(\d+)$/)
  if (match) {
    return [0, Number(match[1]), trimmed]
  }
  if (trimmed === 'งานประจำ') {
    return [2, 0, trimmed]
  }
  return [1, 0, trimmed]
}

export function sortStrategies(strategies: Iterable<string>): string[] {
  const unique = Array.from(
    new Set(
      Array.from(strategies)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
  return unique.sort((a, b) => {
    const [groupA, numA, textA] = getNaturalStrategyKey(a)
    const [groupB, numB, textB] = getNaturalStrategyKey(b)
    if (groupA !== groupB) return groupA - groupB
    if (numA !== numB) return numA - numB
    return textA.localeCompare(textB, 'th', { numeric: true })
  })
}

export function sortByPreferredOrder(
  values: Iterable<string>,
  preferredOrder: readonly string[]
): string[] {
  const unique = Array.from(
    new Set(
      Array.from(values)
        .map((v) => v.trim())
        .filter(Boolean)
    )
  )
  return unique.sort((a, b) => {
    const idxA = preferredOrder.indexOf(a)
    const idxB = preferredOrder.indexOf(b)
    if (idxA >= 0 && idxB >= 0) return idxA - idxB
    if (idxA >= 0) return -1
    if (idxB >= 0) return 1
    return a.localeCompare(b, 'th', { numeric: true })
  })
}

export function aggregateProjectDashboardStats(
  records: ProjectRecord[]
): ProjectDashboardStats {
  const totalProjects = records.length
  let submittedCount = 0
  let pendingCount = 0
  let noBudgetCount = 0
  let cancelledCount = 0
  let allocatedBudgetTotal = 0
  let actualSpentTotal = 0
  let q1Total = 0
  let q2Total = 0
  let q3Total = 0
  let q4Total = 0

  const byStatus: Record<string, number> = {}
  const strategyMap = new Map<string, ProjectStrategySummary>()
  const sourceMap = new Map<string, ProjectBreakdownStat>()

  for (const rec of records) {
    const status = (rec.submissionStatus || 'ยังไม่ส่ง').trim()
    byStatus[status] = (byStatus[status] || 0) + 1

    if (status === 'ส่งแล้ว') submittedCount += 1
    else if (status === 'ยังไม่ส่ง') pendingCount += 1
    else if (status === 'ไม่ใช้งบประมาณ') noBudgetCount += 1
    else if (status === 'ยกเลิกโครงการ') cancelledCount += 1

    allocatedBudgetTotal += rec.allocatedBudget
    actualSpentTotal += rec.actualSpent
    q1Total += rec.q1Budget
    q2Total += rec.q2Budget
    q3Total += rec.q3Budget
    q4Total += rec.q4Budget

    const stratKey = (rec.strategy || 'งานประจำ').trim()
    const existingStrat = strategyMap.get(stratKey) ?? {
      strategy: stratKey,
      strategyTitle: stratKey,
      totalProjects: 0,
      submittedCount: 0,
      pendingCount: 0,
      noBudgetCount: 0,
      cancelledCount: 0,
      completionRate: 0,
      allocatedBudget: 0,
      actualSpent: 0,
      remainingBudget: 0,
    }
    existingStrat.totalProjects += 1
    if (status === 'ส่งแล้ว') existingStrat.submittedCount += 1
    else if (status === 'ยังไม่ส่ง') existingStrat.pendingCount += 1
    else if (status === 'ไม่ใช้งบประมาณ') existingStrat.noBudgetCount += 1
    else if (status === 'ยกเลิกโครงการ') existingStrat.cancelledCount += 1
    existingStrat.allocatedBudget =
      Math.round((existingStrat.allocatedBudget + rec.allocatedBudget) * 100) / 100
    existingStrat.actualSpent =
      Math.round((existingStrat.actualSpent + rec.actualSpent) * 100) / 100
    existingStrat.remainingBudget =
      Math.round((existingStrat.allocatedBudget - existingStrat.actualSpent) * 100) / 100
    strategyMap.set(stratKey, existingStrat)

    const srcKey = (rec.budgetSource || 'เงินบำรุง').trim()
    const existingSrc = sourceMap.get(srcKey) ?? {
      label: srcKey,
      count: 0,
      allocatedBudget: 0,
      actualSpent: 0,
    }
    existingSrc.count += 1
    existingSrc.allocatedBudget =
      Math.round((existingSrc.allocatedBudget + rec.allocatedBudget) * 100) / 100
    existingSrc.actualSpent =
      Math.round((existingSrc.actualSpent + rec.actualSpent) * 100) / 100
    sourceMap.set(srcKey, existingSrc)
  }

  const byStrategy = sortStrategies(strategyMap.keys()).map((key) => {
    const item = strategyMap.get(key)!
    return {
      ...item,
      completionRate:
        item.totalProjects > 0
          ? Math.round(((item.submittedCount / item.totalProjects) * 100) * 10) / 10
          : 0,
    }
  })

  allocatedBudgetTotal = Math.round(allocatedBudgetTotal * 100) / 100
  actualSpentTotal = Math.round(actualSpentTotal * 100) / 100
  const remainingBudgetTotal =
    Math.round((allocatedBudgetTotal - actualSpentTotal) * 100) / 100

  const submissionRate =
    totalProjects > 0
      ? Math.round(((submittedCount / totalProjects) * 100) * 10) / 10
      : 0
  const disbursementRate =
    allocatedBudgetTotal > 0
      ? Math.round(((actualSpentTotal / allocatedBudgetTotal) * 100) * 10) / 10
      : 0
  const remainingRate =
    allocatedBudgetTotal > 0
      ? Math.round(((remainingBudgetTotal / allocatedBudgetTotal) * 100) * 10) / 10
      : 0

  const byBudgetSource = sortByPreferredOrder(sourceMap.keys(), PROJECT_BUDGET_SOURCES).map(
    (key) => sourceMap.get(key)!
  )

  const byQuarter: ProjectQuarterSummary[] = [
    { quarter: 'ไตรมาส 1', key: 'q1Budget', allocatedBudget: Math.round(q1Total * 100) / 100 },
    { quarter: 'ไตรมาส 2', key: 'q2Budget', allocatedBudget: Math.round(q2Total * 100) / 100 },
    { quarter: 'ไตรมาส 3', key: 'q3Budget', allocatedBudget: Math.round(q3Total * 100) / 100 },
    { quarter: 'ไตรมาส 4', key: 'q4Budget', allocatedBudget: Math.round(q4Total * 100) / 100 },
  ]

  return {
    totalProjects,
    submittedCount,
    pendingCount,
    noBudgetCount,
    cancelledCount,
    submissionRate,
    allocatedBudgetTotal,
    actualSpentTotal,
    remainingBudgetTotal,
    disbursementRate,
    remainingRate,
    byStrategy,
    byStatus,
    byBudgetSource,
    byQuarter,
  }
}

function normalizeHeader(cell: unknown): string {
  return String(cell ?? '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const norm = candidate.replace(/\s+/g, '').toLowerCase()
    const exact = headers.findIndex((h) => h === norm)
    if (exact >= 0) return exact
  }
  for (const candidate of candidates) {
    const norm = candidate.replace(/\s+/g, '').toLowerCase()
    const partial = headers.findIndex((h) => h.includes(norm))
    if (partial >= 0) return partial
  }
  return -1
}

function normalizeImportedStatus(raw: string | null): string {
  if (!raw) return 'ยังไม่ส่ง'
  const clean = raw.trim()
  if ((PROJECT_SUBMISSION_STATUSES as readonly string[]).includes(clean)) {
    return clean
  }
  if (clean.includes('ส่งแล้ว') || clean.includes('ส่งสรุป')) return 'ส่งแล้ว'
  if (clean.includes('ยกเลิก')) return 'ยกเลิกโครงการ'
  if (clean.includes('ไม่ใช้งบ')) return 'ไม่ใช้งบประมาณ'
  if (clean.includes('ยังไม่')) return 'ยังไม่ส่ง'
  return clean
}

function normalizeImportedBudgetSource(raw: string | null, status: string): string {
  if (!raw) {
    return status === 'ไม่ใช้งบประมาณ' ? 'ไม่ใช้งบประมาณ' : 'เงินบำรุง'
  }
  const clean = raw.trim()
  if ((PROJECT_BUDGET_SOURCES as readonly string[]).includes(clean)) {
    return clean
  }
  if (clean.includes('บำรุง')) return 'เงินบำรุง'
  if (clean.includes('กปท')) return 'กปท.'
  if (clean.includes('ไม่ใช้งบ')) return 'ไม่ใช้งบประมาณ'
  if (clean.includes('อื่น')) return 'งบอื่นๆ'
  return clean
}

export function detectFiscalYearFromFilename(filename?: string | null): number {
  if (!filename) return getCurrentThaiFiscalYear()
  const match = filename.match(/(25[6-9]\d|26[0-5]\d)/)
  if (match) {
    return Number(match[1])
  }
  return getCurrentThaiFiscalYear()
}

export function parseProjectImportMatrix(
  matrix: unknown[][],
  options: { fiscalYear: number; sheetName?: string }
): ProjectImportParseResult {
  const errors: Array<{ rowNumber: number; message: string }> = []
  const rows: ProjectImportPreviewRow[] = []
  let skippedEmptyRows = 0

  let headerRowIndex = -1
  let colMap = {
    sequenceNo: -1,
    projectCode: -1,
    strategy: -1,
    projectName: -1,
    responsibleUnit: -1,
    q1Budget: -1,
    q2Budget: -1,
    q3Budget: -1,
    q4Budget: -1,
    actualSpent: -1,
    submissionStatus: -1,
    budgetSource: -1,
    notes: -1,
  }

  const scanLimit = Math.min(matrix.length, 20)
  for (let i = 0; i < scanLimit; i++) {
    const row = matrix[i] || []
    const headers = row.map(normalizeHeader)
    const projectNameIdx = findColumnIndex(headers, ['ชื่อโครงการ', 'projectname'])
    if (projectNameIdx >= 0) {
      headerRowIndex = i
      colMap = {
        sequenceNo: findColumnIndex(headers, ['ลำดับ', 'no', 'seq']),
        projectCode: findColumnIndex(headers, ['รหัสโครงการ', 'code']),
        strategy: findColumnIndex(headers, ['ยุทธศาสตร์', 'strategy']),
        projectName: projectNameIdx,
        responsibleUnit: findColumnIndex(headers, [
          'หน่วยงาน/ผู้รับผิดชอบ',
          'ผู้รับผิดชอบ',
          'หน่วยงาน',
        ]),
        q1Budget: findColumnIndex(headers, ['ไตรมาส1', 'q1']),
        q2Budget: findColumnIndex(headers, ['ไตรมาส2', 'q2']),
        q3Budget: findColumnIndex(headers, ['ไตรมาส3', 'q3']),
        q4Budget: findColumnIndex(headers, ['ไตรมาส4', 'q4']),
        actualSpent: findColumnIndex(headers, ['งบประมาณใช้จริง', 'ใช้จริง']),
        submissionStatus: findColumnIndex(headers, ['สถานะการส่งสรุปงาน', 'สถานะ']),
        budgetSource: findColumnIndex(headers, ['แหล่งงบประมาณ', 'แหล่งงบ']),
        notes: findColumnIndex(headers, ['หมายเหตุ/ปัญหาอุปสรรค', 'หมายเหตุ']),
      }
      break
    }
  }

  if (headerRowIndex < 0) {
    return {
      rows: [],
      skippedEmptyRows: 0,
      errors: [
        {
          rowNumber: 1,
          message: 'ไม่พบคอลัมน์หัวตาราง "ชื่อโครงการ" ในไฟล์ที่อัปโหลด',
        },
      ],
      detectedSheetName: options.sheetName || 'Sheet1',
      detectedFiscalYear: options.fiscalYear,
    }
  }

  let autoSeq = 1
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] || []
    const rowNumber = r + 1

    const seqCell = colMap.sequenceNo >= 0 ? normalizeOptionalText(row[colMap.sequenceNo]) : null
    const projectName = normalizeOptionalText(row[colMap.projectName])

    if (!projectName) {
      // Check if it's the Excel "รวม" summary row or completely blank
      if (seqCell && seqCell.includes('รวม')) {
        skippedEmptyRows += 1
        continue
      }
      const hasAnyValue = row.some((c) => normalizeOptionalText(c) !== null)
      if (!hasAnyValue) {
        skippedEmptyRows += 1
        continue
      }
      errors.push({ rowNumber, message: 'ไม่มีชื่อโครงการ' })
      continue
    }

    if (seqCell && seqCell.includes('รวม')) {
      skippedEmptyRows += 1
      continue
    }

    const rawSeq = colMap.sequenceNo >= 0 ? Number(row[colMap.sequenceNo]) : NaN
    const sequenceNo =
      Number.isInteger(rawSeq) && rawSeq > 0 ? rawSeq : autoSeq
    autoSeq = sequenceNo + 1

    const strategy =
      (colMap.strategy >= 0 ? normalizeOptionalText(row[colMap.strategy]) : null) ||
      'งานประจำ'
    const rawStatus =
      colMap.submissionStatus >= 0
        ? normalizeOptionalText(row[colMap.submissionStatus])
        : null
    const submissionStatus = normalizeImportedStatus(rawStatus)
    const rawSource =
      colMap.budgetSource >= 0 ? normalizeOptionalText(row[colMap.budgetSource]) : null
    const budgetSource = normalizeImportedBudgetSource(rawSource, submissionStatus)

    const input: ProjectCreateInput = {
      fiscalYear: options.fiscalYear,
      sequenceNo,
      projectCode:
        colMap.projectCode >= 0 ? normalizeOptionalText(row[colMap.projectCode]) : null,
      strategy,
      projectName,
      responsibleUnit:
        colMap.responsibleUnit >= 0
          ? normalizeOptionalText(row[colMap.responsibleUnit])
          : null,
      q1Budget: colMap.q1Budget >= 0 ? normalizeBudgetNumber(row[colMap.q1Budget]) : 0,
      q2Budget: colMap.q2Budget >= 0 ? normalizeBudgetNumber(row[colMap.q2Budget]) : 0,
      q3Budget: colMap.q3Budget >= 0 ? normalizeBudgetNumber(row[colMap.q3Budget]) : 0,
      q4Budget: colMap.q4Budget >= 0 ? normalizeBudgetNumber(row[colMap.q4Budget]) : 0,
      actualSpent:
        colMap.actualSpent >= 0 ? normalizeBudgetNumber(row[colMap.actualSpent]) : 0,
      submissionStatus,
      budgetSource,
      notes: colMap.notes >= 0 ? normalizeOptionalText(row[colMap.notes]) : null,
    }

    rows.push({ rowNumber, data: input })
  }

  return {
    rows,
    skippedEmptyRows,
    errors,
    detectedSheetName: options.sheetName || 'Sheet1',
    detectedFiscalYear: options.fiscalYear,
  }
}
