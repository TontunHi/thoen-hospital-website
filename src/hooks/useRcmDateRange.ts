import { useState, useMemo, useCallback } from 'react'

export const THAI_MONTHS = [
  { value: 1, label: 'มกราคม' },
  { value: 2, label: 'กุมภาพันธ์' },
  { value: 3, label: 'มีนาคม' },
  { value: 4, label: 'เมษายน' },
  { value: 5, label: 'พฤษภาคม' },
  { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' },
  { value: 8, label: 'สิงหาคม' },
  { value: 9, label: 'กันยายน' },
  { value: 10, label: 'ตุลาคม' },
  { value: 11, label: 'พฤศจิกายน' },
  { value: 12, label: 'ธันวาคม' },
] as const

export type RcmDateMode = 'custom' | 'monthly' | 'fiscal'

export interface UseRcmDateRangeOptions {
  initialDs1?: string
  initialDs2?: string
  initialMode?: RcmDateMode
  onRangeChange?: () => void
}

function formatMonthBounds(beYear: number, month: number): { ds1: string; ds2: string } {
  const ceYear = beYear - 543
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(ceYear, month, 0).getDate()
  return {
    ds1: `${ceYear}-${mm}-01`,
    ds2: `${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

function formatFiscalBounds(beFiscalYear: number): { ds1: string; ds2: string } {
  const ceFiscal = beFiscalYear - 543
  return {
    ds1: `${ceFiscal - 1}-10-01`,
    ds2: `${ceFiscal}-09-30`,
  }
}

/**
 * Shared Thai-calendar date range hook for RCM dashboards.
 * Supports custom date range, monthly stepper (พ.ศ.), and Thai fiscal year (1 Oct - 30 Sep).
 */
export function useRcmDateRange(options: UseRcmDateRangeOptions = {}) {
  const { initialDs1, initialDs2, initialMode = 'custom', onRangeChange } = options

  const today = useMemo(() => new Date(), [])
  const curCalYear = today.getFullYear()
  const curBeYear = curCalYear + 543
  const curMonth = today.getMonth() + 1
  const defaultFiscalCeYear = curMonth >= 10 ? curCalYear + 1 : curCalYear
  const defaultFiscalBeYear = defaultFiscalCeYear + 543

  const yearOptions = useMemo(() => {
    const list: number[] = []
    for (let y = defaultFiscalBeYear + 1; y >= defaultFiscalBeYear - 6; y--) {
      list.push(y)
    }
    return list
  }, [defaultFiscalBeYear])

  const [dateMode, setDateMode] = useState<RcmDateMode>(initialMode)
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(initialDs1 ?? `${defaultFiscalCeYear - 1}-10-01`)
  const [ds2, setDs2] = useState<string>(initialDs2 ?? `${defaultFiscalCeYear}-09-30`)

  const setCustomDs1 = useCallback(
    (val: string) => {
      setDs1(val)
      onRangeChange?.()
    },
    [onRangeChange]
  )

  const setCustomDs2 = useCallback(
    (val: string) => {
      setDs2(val)
      onRangeChange?.()
    },
    [onRangeChange]
  )

  const handleModeChange = useCallback(
    (mode: RcmDateMode) => {
      setDateMode(mode)
      if (mode === 'monthly') {
        const bounds = formatMonthBounds(selectedBeYear, selectedMonth)
        setDs1(bounds.ds1)
        setDs2(bounds.ds2)
      } else if (mode === 'fiscal') {
        const bounds = formatFiscalBounds(selectedFiscalYear)
        setDs1(bounds.ds1)
        setDs2(bounds.ds2)
      }
      onRangeChange?.()
    },
    [selectedBeYear, selectedMonth, selectedFiscalYear, onRangeChange]
  )

  const handleFiscalYearChange = useCallback(
    (beYear: number) => {
      setSelectedFiscalYear(beYear)
      const bounds = formatFiscalBounds(beYear)
      setDs1(bounds.ds1)
      setDs2(bounds.ds2)
      onRangeChange?.()
    },
    [onRangeChange]
  )

  const handleMonthChange = useCallback(
    (month: number) => {
      setSelectedMonth(month)
      const bounds = formatMonthBounds(selectedBeYear, month)
      setDs1(bounds.ds1)
      setDs2(bounds.ds2)
      onRangeChange?.()
    },
    [selectedBeYear, onRangeChange]
  )

  const handleBeYearChange = useCallback(
    (beYear: number) => {
      setSelectedBeYear(beYear)
      const bounds = formatMonthBounds(beYear, selectedMonth)
      setDs1(bounds.ds1)
      setDs2(bounds.ds2)
      onRangeChange?.()
    },
    [selectedMonth, onRangeChange]
  )

  const handlePrevMonth = useCallback(() => {
    let nextMonth = selectedMonth - 1
    let nextBeYear = selectedBeYear
    if (nextMonth < 1) {
      nextMonth = 12
      nextBeYear -= 1
    }
    setSelectedMonth(nextMonth)
    setSelectedBeYear(nextBeYear)
    const bounds = formatMonthBounds(nextBeYear, nextMonth)
    setDs1(bounds.ds1)
    setDs2(bounds.ds2)
    onRangeChange?.()
  }, [selectedMonth, selectedBeYear, onRangeChange])

  const handleNextMonth = useCallback(() => {
    let nextMonth = selectedMonth + 1
    let nextBeYear = selectedBeYear
    if (nextMonth > 12) {
      nextMonth = 1
      nextBeYear += 1
    }
    setSelectedMonth(nextMonth)
    setSelectedBeYear(nextBeYear)
    const bounds = formatMonthBounds(nextBeYear, nextMonth)
    setDs1(bounds.ds1)
    setDs2(bounds.ds2)
    onRangeChange?.()
  }, [selectedMonth, selectedBeYear, onRangeChange])

  return {
    dateMode,
    ds1,
    ds2,
    setDs1: setCustomDs1,
    setDs2: setCustomDs2,
    selectedFiscalYear,
    selectedMonth,
    selectedBeYear,
    yearOptions,
    handleModeChange,
    handleFiscalYearChange,
    handleMonthChange,
    handleBeYearChange,
    handlePrevMonth,
    handleNextMonth,
  }
}
