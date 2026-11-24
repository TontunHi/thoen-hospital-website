import {
  isPercentageIndicator,
  calculateIndicatorResult,
  formatKpiResultValue,
  formatKpiDecimal,
  formatKpiNumber,
  shouldDisplayPerThousandDays,
  type IndicatorMetricMeta,
} from '@/lib/kpi/kpiTimeUtils'

export interface CurrentUser {
  id: number
  username: string
  name: string
  role: string
  department: string | null
  isAdmin: boolean
  permissions?: string[]
}

export const formatThaiDate = (dateStr?: string | null): string => {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '-'
  }
}

export const formatThaiDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const thaiDate = d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${thaiDate} ${hours}:${mins} น.`
  } catch {
    return '-'
  }
}

export function formatAnswerDisplay(
  entry: any,
  unit?: string | null,
  ind?: IndicatorMetricMeta | null
): { main: string; sub?: string; fullSub?: string } | null {
  if (!entry) return null
  const hasValue = entry.resultValue !== null && entry.resultValue !== undefined
  const hasText = Boolean(entry.resultText && entry.resultText.trim() !== '' && entry.resultText !== 'ไม่มีรายงาน')
  const hasNumDen = entry.numeratorValue !== null && entry.denominatorValue !== null && entry.numeratorValue !== undefined && entry.denominatorValue !== undefined

  if (!hasValue && !hasText && !hasNumDen) return null

  const isPct = isPercentageIndicator(ind)

  let main = ''
  let rawVal: number | null = null
  if (hasText) {
    main = entry.resultText
  } else {
    if (hasNumDen && Number(entry.denominatorValue) > 0) {
      rawVal = calculateIndicatorResult(Number(entry.numeratorValue), Number(entry.denominatorValue), isPct)
    } else if (hasNumDen && Number(entry.denominatorValue) === 0 && Number(entry.numeratorValue) === 0) {
      rawVal = 0
    } else if (hasValue) {
      rawVal = Number(entry.resultValue)
    }

    if (rawVal !== null && !isNaN(rawVal)) {
      main = formatKpiResultValue(rawVal, ind)
    }
  }

  let sub: string | undefined = undefined
  let fullSub: string | undefined = undefined
  const isPerThousandDays = rawVal !== null && shouldDisplayPerThousandDays(rawVal, ind)
  const rawSuffix = isPerThousandDays && rawVal !== null
    ? `ค่าดิบ: ${formatKpiDecimal(rawVal, { minDecimals: 2, maxDecimals: 6 })}`
    : undefined

  if (hasNumDen) {
    const numFmt = formatKpiNumber(entry.numeratorValue)
    const denFmt = formatKpiNumber(entry.denominatorValue)
    sub = `(${numFmt}/${denFmt})`
    fullSub = rawSuffix
      ? `${rawSuffix} • ตัวตั้ง: ${numFmt} / ตัวหาร: ${denFmt}`
      : `ตัวตั้ง: ${numFmt} / ตัวหาร: ${denFmt}`
  } else if (rawSuffix) {
    fullSub = rawSuffix
  }

  return { main, sub, fullSub }
}

export function evaluateTargetClient(
  val: number | null | undefined,
  operator: string | null | undefined,
  targetValue: number | null | undefined
): 'PASS' | 'FAIL' | 'WAITING_TARGET' | 'PENDING' {
  if (val === null || val === undefined) return 'PENDING'
  const op = operator || '>='
  if (targetValue === null || targetValue === undefined) {
    if (op === 'MIN') return val === 0 ? 'PASS' : 'WAITING_TARGET'
    return 'WAITING_TARGET'
  }
  if (op === '>=') return val >= targetValue ? 'PASS' : 'FAIL'
  if (op === '<=') return val <= targetValue ? 'PASS' : 'FAIL'
  if (op === '>') return val > targetValue ? 'PASS' : 'FAIL'
  if (op === '<') return val < targetValue ? 'PASS' : 'FAIL'
  if (op === '=') return Math.abs(val - targetValue) < 1e-6 ? 'PASS' : 'FAIL'
  if (op === 'MIN') return val <= targetValue ? 'PASS' : 'FAIL'
  return 'WAITING_TARGET'
}
