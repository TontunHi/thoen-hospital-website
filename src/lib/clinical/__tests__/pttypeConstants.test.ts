import { describe, it, expect } from 'vitest'
import {
  ECLAIM_PTTYPE_OPTIONS,
  UC_ECLAIM_CODES,
  isUcEclaimCode,
  matchesPttypeFilter,
} from '../pttypeConstants'

describe('pttypeConstants', () => {
  it('contains exactly 37 e-Claim standard options', () => {
    expect(ECLAIM_PTTYPE_OPTIONS).toHaveLength(37)
    expect(ECLAIM_PTTYPE_OPTIONS[0]).toEqual({ code: '01', name: 'UC ใน CUP' })
    expect(ECLAIM_PTTYPE_OPTIONS[36]).toEqual({ code: '37', name: 'ค่าสินค้า หน่วยงานภาครัฐ' })
  })

  it('correctly identifies UC codes (01-09)', () => {
    expect(UC_ECLAIM_CODES).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09'])
    expect(isUcEclaimCode('01')).toBe(true)
    expect(isUcEclaimCode('09')).toBe(true)
    expect(isUcEclaimCode('10')).toBe(false)
    expect(isUcEclaimCode('17')).toBe(false)
    expect(isUcEclaimCode(null)).toBe(false)
    expect(isUcEclaimCode(undefined)).toBe(false)
    expect(isUcEclaimCode('')).toBe(false)
  })

  describe('matchesPttypeFilter', () => {
    it('returns true when selectedCodes is empty (all rights selected)', () => {
      expect(matchesPttypeFilter([], '01', true)).toBe(true)
      expect(matchesPttypeFilter([], '10', false)).toBe(true)
      expect(matchesPttypeFilter([], null, false)).toBe(true)
    })

    it('returns true when item pttype matches selected code', () => {
      expect(matchesPttypeFilter(['01', '02'], '01', true)).toBe(true)
      expect(matchesPttypeFilter(['01', '02'], '02', true)).toBe(true)
      expect(matchesPttypeFilter(['01', '02'], '03', true)).toBe(false)
      expect(matchesPttypeFilter(['10'], '10', false)).toBe(true)
    })

    it('returns true when UC preset is selected and item has isUc=true', () => {
      expect(matchesPttypeFilter(UC_ECLAIM_CODES, null, true)).toBe(true)
      expect(matchesPttypeFilter(UC_ECLAIM_CODES, null, false)).toBe(false)
    })

    it('returns false when no match', () => {
      expect(matchesPttypeFilter(['17', '18'], '01', true)).toBe(false)
    })
  })
})
