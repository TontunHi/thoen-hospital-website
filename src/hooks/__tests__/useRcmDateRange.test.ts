import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRcmDateRange } from '../useRcmDateRange'

describe('useRcmDateRange', () => {
  it('computes dynamic fiscal year options and handles mode switching', () => {
    const onRangeChange = vi.fn()
    const { result } = renderHook(() =>
      useRcmDateRange({
        initialDs1: '2026-10-01',
        initialDs2: '2027-09-30',
        onRangeChange,
      })
    )

    expect(result.current.dateMode).toBe('custom')
    expect(result.current.yearOptions).toHaveLength(8)

    act(() => {
      result.current.handleFiscalYearChange(2570)
    })
    expect(result.current.ds1).toBe('2026-10-01')
    expect(result.current.ds2).toBe('2027-09-30')
    expect(onRangeChange).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handleBeYearChange(2569)
      result.current.handleMonthChange(2)
    })
    expect(result.current.ds1).toBe('2026-02-01')
    expect(result.current.ds2).toBe('2026-02-28')
  })

  it('wraps month backward and forward across Buddhist years', () => {
    const { result } = renderHook(() => useRcmDateRange())

    act(() => {
      result.current.handleBeYearChange(2569)
      result.current.handleMonthChange(1)
    })
    act(() => {
      result.current.handlePrevMonth()
    })
    expect(result.current.selectedMonth).toBe(12)
    expect(result.current.selectedBeYear).toBe(2568)
    expect(result.current.ds1).toBe('2025-12-01')
    expect(result.current.ds2).toBe('2025-12-31')

    act(() => {
      result.current.handleNextMonth()
    })
    expect(result.current.selectedMonth).toBe(1)
    expect(result.current.selectedBeYear).toBe(2569)
    expect(result.current.ds1).toBe('2026-01-01')
    expect(result.current.ds2).toBe('2026-01-31')
  })
})
