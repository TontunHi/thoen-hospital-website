import { describe, it, expect } from 'vitest'
import { getInitials } from '../formatters'

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
