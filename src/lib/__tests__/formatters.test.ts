import { describe, it, expect } from 'vitest'
import { getInitials, formatThaiDate, formatThaiDateRange } from '../formatters'

describe('getInitials', () => {
  it('returns fallback ? for empty or falsy inputs', () => {
    expect(getInitials('')).toBe('?')
    expect(getInitials('   ')).toBe('?')
    expect(getInitials(null)).toBe('?')
    expect(getInitials(undefined)).toBe('?')
  })

  it('strips Thai honorifics and returns first two characters', () => {
    expect(getInitials('นายสมเกียรติ มั่นคง')).toBe('สม')
    expect(getInitials('นางสาวกานดา วัฒนา')).toBe('กา')
    expect(getInitials('นางสมศรี ใจดี')).toBe('สม')
    expect(getInitials('นพ.วิศรุต สุขเกษม')).toBe('วิ')
    expect(getInitials('พญ.สมหญิง ใจดี')).toBe('สม')
    expect(getInitials('ทพ.เอกชัย สว่าง')).toBe('เอ')
    expect(getInitials('ภก.ชาตรี มิ่งขวัญ')).toBe('ชา')
    expect(getInitials('ภญ.พิมพา รัตนา')).toBe('พิ')
    expect(getInitials('พยาบาลกานดา ดาแก้ว')).toBe('กา')
    expect(getInitials('ดร.ประสิทธิ์ วาริน')).toBe('ปร')
  })

  it('handles names without honorifics', () => {
    expect(getInitials('Tontun')).toBe('To')
    expect(getInitials('John Doe')).toBe('Jo')
  })

  it('supports uppercase option for latin names', () => {
    expect(getInitials('admin', true)).toBe('AD')
    expect(getInitials('staff01', true)).toBe('ST')
  })
})

describe('formatThaiDate', () => {
  it('returns fallback for empty, null, or undefined values', () => {
    expect(formatThaiDate(null)).toBe('—')
    expect(formatThaiDate(undefined)).toBe('—')
    expect(formatThaiDate('')).toBe('—')
    expect(formatThaiDate('-', '-')).toBe('-')
    expect(formatThaiDate(null, '-')).toBe('-')
  })

  it('formats YYYY-MM-DD into Thai Buddhist date (วัน เดือน ปี)', () => {
    expect(formatThaiDate('2026-11-04')).toBe('4 พ.ย. 2569')
    expect(formatThaiDate('2026-10-01')).toBe('1 ต.ค. 2569')
    expect(formatThaiDate('2025-01-15')).toBe('15 ม.ค. 2568')
  })

  it('formats Date instances properly', () => {
    const d = new Date(2026, 10, 4) // month 10 is November in 0-indexed JS
    expect(formatThaiDate(d)).toBe('4 พ.ย. 2569')
  })

  it('handles already Buddhist era years (>2400)', () => {
    expect(formatThaiDate('2569-11-04')).toBe('4 พ.ย. 2569')
    expect(formatThaiDate('15/10/2568')).toBe('15 ต.ค. 2568')
  })

  it('formats YYYYMMDD and ISO strings with time', () => {
    expect(formatThaiDate('20261104')).toBe('4 พ.ย. 2569')
    expect(formatThaiDate('2026-10-21 13:16:43')).toBe('21 ต.ค. 2569')
    expect(formatThaiDate('2026-10-21T13:16:43.000Z')).toBe('21 ต.ค. 2569')
  })
})

describe('formatThaiDateRange', () => {
  it('formats date ranges correctly', () => {
    expect(formatThaiDateRange('2026-10-01', '2026-10-31')).toBe('1 ต.ค. 2569 ถึง 31 ต.ค. 2569')
    expect(formatThaiDateRange(null, null)).toBe('—')
    expect(formatThaiDateRange('2026-10-01', null)).toBe('1 ต.ค. 2569')
  })
})
