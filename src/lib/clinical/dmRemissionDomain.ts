import type {
  DmRemissionCohortRaw,
  DmRemissionCohortRecord,
  DmRemissionDashboardStats,
  DmRemissionPcuSummary,
} from './dmRemissionTypes'

const BANGKOK_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'numeric',
})

const BREAKDOWN_FIELDS = [
  'summaryA1c',
  'summaryMeds',
  'summaryWeight',
  'summaryWaist',
  'summaryDiet',
  'summaryExercise',
  'summaryIf',
] as const

const UNSPECIFIED_STATUS = 'ยังไม่ระบุ'
const UNSPECIFIED_PCU = 'ไม่ระบุ รพ.สต.'
const REMISSION_LABEL = 'Remission'

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value === 'boolean') {
    return null
  }
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

export function getCurrentThaiFiscalYear(referenceDate: Date = new Date()): number {
  const parts = BANGKOK_PARTS_FORMATTER.formatToParts(referenceDate)
  const gregorianYear = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)

  // Thai fiscal year runs Oct 1 – Sep 30, so Oct–Dec belong to next Buddhist year.
  return month >= 10 ? gregorianYear + 544 : gregorianYear + 543
}

export function getAvailableFiscalYears(
  existingYears: number[] = [],
  referenceDate: Date = new Date()
): number[] {
  const current = getCurrentThaiFiscalYear(referenceDate)
  const yearSet = new Set<number>([current + 1, current, current - 1, current - 2])

  for (const year of existingYears) {
    if (Number.isInteger(year) && year > 0) {
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
    if (Number.isInteger(year) && year > 0) {
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

export function computeBmi(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined
): number | null {
  if (
    weightKg === null ||
    weightKg === undefined ||
    heightCm === null ||
    heightCm === undefined ||
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    weightKg <= 0 ||
    heightCm <= 0
  ) {
    return null
  }

  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 100) / 100
}

export function normalizeHn(hn?: string | null): string | null {
  if (hn === null || hn === undefined) {
    return null
  }
  const trimmed = String(hn).trim()
  if (!trimmed) {
    return null
  }
  if (/^\d+$/.test(trimmed) && trimmed.length <= 7) {
    return trimmed.padStart(7, '0')
  }
  return trimmed
}

export function normalizeCid(cid?: string | null): string | null {
  if (cid === null || cid === undefined) {
    return null
  }
  const cleaned = String(cid).trim().replace(/[\s-]+/g, '')
  return cleaned || null
}

export function enrichCohortRecord(raw: DmRemissionCohortRaw): DmRemissionCohortRecord {
  const heightCm = toNullableNumber(raw.heightCm)
  const weightBeforeKg = toNullableNumber(raw.weightBeforeKg)
  const weightAfterKg = toNullableNumber(raw.weightAfterKg)

  return {
    ...raw,
    age: toNullableNumber(raw.age),
    heightCm,
    weightBeforeKg,
    weightAfterKg,
    waistBeforeCm: toNullableNumber(raw.waistBeforeCm),
    waistAfterCm: toNullableNumber(raw.waistAfterCm),
    fpgBefore: toNullableNumber(raw.fpgBefore),
    fpgAfter: toNullableNumber(raw.fpgAfter),
    a1cBefore: toNullableNumber(raw.a1cBefore),
    a1cAfter: toNullableNumber(raw.a1cAfter),
    a1cPostStop3m: toNullableNumber(raw.a1cPostStop3m),
    bmiBefore: computeBmi(weightBeforeKg, heightCm),
    bmiAfter: computeBmi(weightAfterKg, heightCm),
  }
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function meanOf(values: Array<number | null | undefined>): number | null {
  let sum = 0
  let count = 0

  for (const val of values) {
    if (typeof val === 'number' && Number.isFinite(val)) {
      sum += val
      count += 1
    }
  }

  return count > 0 ? roundTo(sum / count, 2) : null
}

function meanPairedDelta(
  records: DmRemissionCohortRecord[],
  getBefore: (record: DmRemissionCohortRecord) => number | null,
  getAfter: (record: DmRemissionCohortRecord) => number | null
): number | null {
  const deltas: number[] = []
  for (const record of records) {
    const before = getBefore(record)
    const after = getAfter(record)
    if (
      typeof before === 'number' &&
      Number.isFinite(before) &&
      typeof after === 'number' &&
      Number.isFinite(after)
    ) {
      deltas.push(after - before)
    }
  }
  return meanOf(deltas)
}

function tallyCategoryField(
  records: DmRemissionCohortRecord[],
  field: (typeof BREAKDOWN_FIELDS)[number]
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const record of records) {
    const rawVal = record[field]
    const key = typeof rawVal === 'string' && rawVal.trim() ? rawVal.trim() : UNSPECIFIED_STATUS
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

export function aggregateDashboardStats(
  records: DmRemissionCohortRecord[],
  configuredRemissionLabels: string[]
): DmRemissionDashboardStats {
  const totalPatients = records.length
  let remissionCount = 0

  const statusCounts: Record<string, number> = {}
  for (const label of configuredRemissionLabels) {
    const trimmed = label.trim()
    if (trimmed) {
      statusCounts[trimmed] = 0
    }
  }
  statusCounts[UNSPECIFIED_STATUS] = statusCounts[UNSPECIFIED_STATUS] ?? 0

  const pcuMap = new Map<
    string,
    { total: number; remissionCount: number; statusCounts: Record<string, number> }
  >()

  for (const record of records) {
    const status = record.summaryRemission?.trim() || UNSPECIFIED_STATUS
    const isRemission = status === REMISSION_LABEL
    if (isRemission) {
      remissionCount += 1
    }
    statusCounts[status] = (statusCounts[status] ?? 0) + 1

    const pcuName = record.pcuName?.trim() || UNSPECIFIED_PCU
    let pcuEntry = pcuMap.get(pcuName)
    if (!pcuEntry) {
      pcuEntry = { total: 0, remissionCount: 0, statusCounts: {} }
      pcuMap.set(pcuName, pcuEntry)
    }
    pcuEntry.total += 1
    if (isRemission) {
      pcuEntry.remissionCount += 1
    }
    pcuEntry.statusCounts[status] = (pcuEntry.statusCounts[status] ?? 0) + 1
  }

  const remissionRate = totalPatients > 0 ? roundTo((remissionCount / totalPatients) * 100, 1) : 0

  const byPcu: DmRemissionPcuSummary[] = Array.from(pcuMap.entries())
    .map(([pcuName, data]) => ({
      pcuName,
      total: data.total,
      remissionCount: data.remissionCount,
      remissionRate: data.total > 0 ? roundTo((data.remissionCount / data.total) * 100, 1) : 0,
      statusCounts: data.statusCounts,
    }))
    .sort((a, b) => b.total - a.total || a.pcuName.localeCompare(b.pcuName, 'th'))

  const breakdowns = {} as DmRemissionDashboardStats['breakdowns']
  for (const field of BREAKDOWN_FIELDS) {
    breakdowns[field] = tallyCategoryField(records, field)
  }

  return {
    totalPatients,
    remissionCount,
    remissionRate,
    statusCounts,
    averages: {
      a1cBefore: meanOf(records.map((r) => r.a1cBefore)),
      a1cAfter: meanOf(records.map((r) => r.a1cAfter)),
      a1cPostStop3m: meanOf(records.map((r) => r.a1cPostStop3m)),
      a1cDelta: meanPairedDelta(records, (r) => r.a1cBefore, (r) => r.a1cAfter),
      weightBeforeKg: meanOf(records.map((r) => r.weightBeforeKg)),
      weightAfterKg: meanOf(records.map((r) => r.weightAfterKg)),
      weightDelta: meanPairedDelta(records, (r) => r.weightBeforeKg, (r) => r.weightAfterKg),
      bmiBefore: meanOf(records.map((r) => r.bmiBefore)),
      bmiAfter: meanOf(records.map((r) => r.bmiAfter)),
      waistBeforeCm: meanOf(records.map((r) => r.waistBeforeCm)),
      waistAfterCm: meanOf(records.map((r) => r.waistAfterCm)),
      fpgBefore: meanOf(records.map((r) => r.fpgBefore)),
      fpgAfter: meanOf(records.map((r) => r.fpgAfter)),
    },
    byPcu,
    breakdowns,
  }
}
