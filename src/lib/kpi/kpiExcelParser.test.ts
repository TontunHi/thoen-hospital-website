import { describe, it, expect } from 'vitest'
import {
  parseTarget,
  normalizeFrequency,
  detectHeaderMapping,
  parseKpiRows,
} from './kpiExcelParser'

describe('kpiExcelParser - parseTarget', () => {
  it('parses >= operator and percentage value', () => {
    const res = parseTarget('>= 80%')
    expect(res.operator).toBe('>=')
    expect(res.value).toBe(80)
    expect(res.unit).toBe('%')
  })

  it('parses Thai wording "ไม่ต่ำกว่า 90%"', () => {
    const res = parseTarget('ไม่ต่ำกว่า 90%')
    expect(res.operator).toBe('>=')
    expect(res.value).toBe(90)
    expect(res.unit).toBe('%')
  })

  it('parses MIN condition', () => {
    const res = parseTarget('MIN')
    expect(res.operator).toBe('MIN')
    expect(res.value).toBeNull()
  })

  it('parses <= operator with days unit', () => {
    const res = parseTarget('<= 3 วัน')
    expect(res.operator).toBe('<=')
    expect(res.value).toBe(3)
    expect(res.unit).toBe('วัน')
  })

  it('handles null or empty target gracefully', () => {
    expect(parseTarget(null)).toEqual({ operator: null, value: null, unit: null })
    expect(parseTarget('')).toEqual({ operator: null, value: null, unit: null })
  })
})

describe('kpiExcelParser - normalizeFrequency', () => {
  it('normalizes 6-month variations', () => {
    expect(normalizeFrequency('ราย 6 เดือน')).toBe('ราย 6 เดือน')
    expect(normalizeFrequency('6 เดือน')).toBe('ราย 6 เดือน')
    expect(normalizeFrequency('ครึ่งปี')).toBe('ราย 6 เดือน')
  })

  it('normalizes quarterly variations', () => {
    expect(normalizeFrequency('รายไตรมาส')).toBe('รายไตรมาส')
    expect(normalizeFrequency('ไตรมาส')).toBe('รายไตรมาส')
    expect(normalizeFrequency('3 เดือน')).toBe('รายไตรมาส')
  })

  it('normalizes monthly variations', () => {
    expect(normalizeFrequency('รายเดือน')).toBe('รายเดือน')
    expect(normalizeFrequency('เดือน')).toBe('รายเดือน')
  })
})

describe('kpiExcelParser - Smart Header Detection & Row Parsing', () => {
  it('detects headers and parses rows accurately', () => {
    const mockExcelRows = [
      ['ลำดับ', 'หมวดตัวชี้วัด', 'เข็มมุ่ง', 'ปี', 'รหัส', 'รหัสเดิม', 'ความถี่', 'ตัวชี้วัด', 'ตัวตั้ง', 'ตัวหาร', 'เป้าหมาย', 'ผู้รับผิดชอบ'],
      ['1', 'หมวด 1 การดูแลผู้ป่วย', 'โรคหลอดเลือดสมอง', '2570', 'ST-01', null, 'ราย 6 เดือน', 'ร้อยละผู้ป่วยได้รับยาละลายลิ่มเลือด', 'จำนวนผู้ป่วยที่ได้รับยา', 'จำนวนผู้ป่วยทั้งหมด', '>= 80%', 'กลุ่มงานอายุรกรรม'],
      ['2', null, 'โรคหัวใจ', '2570', 'HR-01', null, 'รายไตรมาส', 'อัตราการเสียชีวิตผู้ป่วย STEMI', null, null, '<= 5%', 'พญ.สมใจ'],
    ]

    const parsed = parseKpiRows(mockExcelRows)
    expect(parsed.indicators).toHaveLength(2)

    // Row 1
    const r1 = parsed.indicators[0]
    expect(r1.sequence).toBe('1')
    expect(r1.category).toBe('หมวด 1 การดูแลผู้ป่วย')
    expect(r1.code).toBe('ST-01')
    expect(r1.frequency).toBe('ราย 6 เดือน')
    expect(r1.title).toBe('ร้อยละผู้ป่วยได้รับยาละลายลิ่มเลือด')
    expect(r1.numeratorName).toBe('จำนวนผู้ป่วยที่ได้รับยา')
    expect(r1.denominatorName).toBe('จำนวนผู้ป่วยทั้งหมด')
    expect(r1.targetOperator).toBe('>=')
    expect(r1.targetValue).toBe(80)
    expect(r1.responsibleName).toBe('กลุ่มงานอายุรกรรม')

    // Row 2 (inherits category from row 1)
    const r2 = parsed.indicators[1]
    expect(r2.category).toBe('หมวด 1 การดูแลผู้ป่วย')
    expect(r2.code).toBe('HR-01')
    expect(r2.frequency).toBe('รายไตรมาส')
    expect(r2.title).toBe('อัตราการเสียชีวิตผู้ป่วย STEMI')
    expect(r2.numeratorName).toBeNull()
    expect(r2.denominatorName).toBeNull()
    expect(r2.targetOperator).toBe('<=')
    expect(r2.targetValue).toBe(5)
    expect(r2.responsibleName).toBe('พญ.สมใจ')
  })
})
