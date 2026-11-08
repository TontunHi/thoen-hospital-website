import { describe, it, expect } from 'vitest'
import {
  rcmDateRegex,
  baseFiscalDateSchema,
  paginationSchema,
  opdDeptSummaryQuerySchema,
  ipdReportQuerySchema,
  clopidogrelReportQuerySchema,
  validateSearchParams,
} from '../rcmValidation'

describe('rcmValidation module', () => {
  it('validates standard YYYY-MM-DD dates correctly', () => {
    expect(rcmDateRegex.test('2026-10-01')).toBe(true)
    expect(rcmDateRegex.test('2026/10/01')).toBe(false)
    expect(rcmDateRegex.test('01-10-2026')).toBe(false)
    expect(rcmDateRegex.test('invalid')).toBe(false)
  })

  it('validates baseFiscalDateSchema', () => {
    const valid = baseFiscalDateSchema.safeParse({ ds1: '2026-10-01', ds2: '2027-09-30' })
    expect(valid.success).toBe(true)

    const invalid = baseFiscalDateSchema.safeParse({ ds1: 'invalid-date' })
    expect(invalid.success).toBe(false)
  })

  it('validates and coerces paginationSchema', () => {
    const parsed = paginationSchema.safeParse({ page: '2', pageSize: '100', exportAll: 'true' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.page).toBe(2)
      expect(parsed.data.pageSize).toBe(100)
      expect(parsed.data.exportAll).toBe(true)
    }
  })

  it('validates ipdReportQuerySchema modes and defaults', () => {
    const parsed = ipdReportQuerySchema.safeParse({
      ds1: '2026-10-01',
      ds2: '2027-09-30',
      mode: 'details',
      page: '1',
      pageSize: '50',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.mode).toBe('details')
      expect(parsed.data.page).toBe(1)
      expect(parsed.data.pageSize).toBe(50)
    }
  })

  it('helper validateSearchParams formats error messages clearly', () => {
    const invalidParams = new URLSearchParams({ ds1: 'wrong-date-format' })
    const result = validateSearchParams(opdDeptSummaryQuerySchema, invalidParams)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('YYYY-MM-DD')
    }

    const validParams = new URLSearchParams({ ds1: '2026-10-01', ds2: '2027-09-30' })
    const validResult = validateSearchParams(opdDeptSummaryQuerySchema, validParams)
    expect(validResult.success).toBe(true)
  })

  it('validates clopidogrelReportQuerySchema cardFilter and pagination defaults', () => {
    const parsed = clopidogrelReportQuerySchema.safeParse({
      ds1: '2026-10-01',
      ds2: '2026-10-31',
      cardFilter: 'COMPENSATED',
      search: 'สมชาย',
      page: '1',
      pageSize: '50',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.cardFilter).toBe('COMPENSATED')
      expect(parsed.data.search).toBe('สมชาย')
      expect(parsed.data.page).toBe(1)
      expect(parsed.data.pageSize).toBe(50)
    }
  })
})

