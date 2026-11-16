import { describe, it, expect } from 'vitest'
import {
  aggregateDashboardStats,
  computeBmi,
  enrichCohortRecord,
  getAvailableFiscalYears,
  getCurrentThaiFiscalYear,
  getPopulatedFiscalYears,
  normalizeCid,
  normalizeHn,
  resolveDefaultFiscalYear,
} from '../dmRemissionDomain'
import {
  carryoverSchema,
  cohortCreateSchema,
  cohortUpdateSchema,
  listQuerySchema,
  optionCreateSchema,
  optionUpdateSchema,
} from '../dmRemissionSchemas'
import type { DmRemissionCohortRaw, DmRemissionCohortRecord } from '../dmRemissionTypes'

function makeRawRecord(overrides: Partial<DmRemissionCohortRaw> = {}): DmRemissionCohortRaw {
  return {
    id: 1,
    fiscalYear: 2569,
    pcuName: 'รพ.สต.ล้อมแรด',
    patientName: 'นายทดสอบ ระบบ',
    cid: '1520000000001',
    hn: '0001234',
    age: 58,
    underlyingDiseases: 'HT, DLP',
    heightCm: 160,
    weightBeforeKg: 70,
    weightAfterKg: 64,
    waistBeforeCm: 92,
    waistAfterCm: 86,
    fpgBefore: 145,
    fpgAfter: 108,
    a1cBefore: 7.5,
    a1cAfter: 6.1,
    a1cPostStop3m: 6.0,
    medsBefore: 'Metformin 500mg 1x2',
    medsAfter: 'หยุดยา',
    summaryA1c: 'ลด',
    summaryMeds: 'หยุดยา',
    summaryWeight: 'ลด',
    summaryWaist: 'ลด',
    summaryDiet: 'ปรับอาหารดี',
    summaryExercise: 'สม่ำเสมอ',
    summaryIf: 'IF 16/8',
    summaryRemission: 'Remission',
    createdBy: 'staff01',
    updatedBy: 'staff01',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('dmRemissionDomain', () => {
  describe('getCurrentThaiFiscalYear', () => {
    it('returns Gregorian + 543 before Oct 1 in Asia/Bangkok', () => {
      // 2026-09-30 23:59:59 ICT
      const beforeMidnight = new Date('2026-09-30T16:59:59.000Z')
      expect(getCurrentThaiFiscalYear(beforeMidnight)).toBe(2569)
    })

    it('returns Gregorian + 544 from Oct 1 onward in Asia/Bangkok', () => {
      // 2026-10-01 00:00:00 ICT
      const atMidnight = new Date('2026-09-30T17:00:00.000Z')
      expect(getCurrentThaiFiscalYear(atMidnight)).toBe(2570)
    })

    it('handles mid-year months correctly', () => {
      expect(getCurrentThaiFiscalYear(new Date('2026-01-15T05:00:00.000Z'))).toBe(2569)
      expect(getCurrentThaiFiscalYear(new Date('2026-12-15T05:00:00.000Z'))).toBe(2570)
    })
  })

  describe('getAvailableFiscalYears', () => {
    it('merges default 4-year window with existing years, deduplicated and descending', () => {
      const ref = new Date('2026-11-13T00:00:00.000Z') // FY 2570
      const years = getAvailableFiscalYears([2566, 2570, 2572, -1, NaN], ref)
      expect(years).toEqual([2572, 2571, 2570, 2569, 2568, 2566])
    })
  })

  describe('getPopulatedFiscalYears & resolveDefaultFiscalYear', () => {
    it('returns only populated years descending and falls back to current FY when empty', () => {
      const ref = new Date('2026-11-16T00:00:00+07:00') // FY 2570
      expect(getPopulatedFiscalYears([2565, 2569, 2565, -1], ref)).toEqual([2569, 2565])
      expect(getPopulatedFiscalYears([], ref)).toEqual([2570])

      expect(resolveDefaultFiscalYear([2569], ref)).toBe(2569)
      expect(resolveDefaultFiscalYear([2565], ref)).toBe(2565)
      expect(resolveDefaultFiscalYear([2569, 2570], ref)).toBe(2570)
      expect(resolveDefaultFiscalYear([], ref)).toBe(2570)
    })
  })

  describe('computeBmi', () => {
    it('computes BMI rounded to 2 decimal places', () => {
      expect(computeBmi(68, 165)).toBe(24.98)
      expect(computeBmi(64, 160)).toBe(25)
    })

    it('returns null for missing, zero, negative, or non-finite inputs', () => {
      expect(computeBmi(null, 165)).toBeNull()
      expect(computeBmi(68, undefined)).toBeNull()
      expect(computeBmi(0, 165)).toBeNull()
      expect(computeBmi(68, 0)).toBeNull()
      expect(computeBmi(-60, 165)).toBeNull()
      expect(computeBmi(68, -165)).toBeNull()
      expect(computeBmi(Number.NaN, 165)).toBeNull()
      expect(computeBmi(68, Number.POSITIVE_INFINITY)).toBeNull()
    })
  })

  describe('normalizeHn & normalizeCid', () => {
    it('pads numeric HNs up to 7 digits and preserves alphanumeric/longer HNs', () => {
      expect(normalizeHn(' 1234 ')).toBe('0001234')
      expect(normalizeHn('0001234')).toBe('0001234')
      expect(normalizeHn('12345678')).toBe('12345678')
      expect(normalizeHn('HN-99')).toBe('HN-99')
      expect(normalizeHn('   ')).toBeNull()
      expect(normalizeHn(null)).toBeNull()
    })

    it('strips spaces and dashes from CID', () => {
      expect(normalizeCid(' 1-5200-12345-67-8 ')).toBe('1520012345678')
      expect(normalizeCid('1 5200 12345 67 8')).toBe('1520012345678')
      expect(normalizeCid('  ---  ')).toBeNull()
      expect(normalizeCid(undefined)).toBeNull()
    })
  })

  describe('enrichCohortRecord', () => {
    it('coerces MySQL decimal strings and attaches bmiBefore and bmiAfter', () => {
      const raw = makeRawRecord({
        age: '61' as unknown as number,
        heightCm: '165.00' as unknown as number,
        weightBeforeKg: '68.00' as unknown as number,
        weightAfterKg: '62.50' as unknown as number,
        a1cBefore: '7.80' as unknown as number,
        a1cAfter: null,
      })

      const enriched = enrichCohortRecord(raw)
      expect(enriched.age).toBe(61)
      expect(enriched.heightCm).toBe(165)
      expect(enriched.weightBeforeKg).toBe(68)
      expect(enriched.weightAfterKg).toBe(62.5)
      expect(enriched.a1cBefore).toBe(7.8)
      expect(enriched.a1cAfter).toBeNull()
      expect(enriched.bmiBefore).toBe(24.98)
      expect(enriched.bmiAfter).toBe(22.96)
    })
  })

  describe('aggregateDashboardStats', () => {
    it('returns zeroed metrics and null averages when empty', () => {
      const stats = aggregateDashboardStats([], ['Remission', 'ไม่ Remission', 'รอ lab A1c'])
      expect(stats.totalPatients).toBe(0)
      expect(stats.remissionCount).toBe(0)
      expect(stats.remissionRate).toBe(0)
      expect(stats.statusCounts).toEqual({
        Remission: 0,
        'ไม่ Remission': 0,
        'รอ lab A1c': 0,
        ยังไม่ระบุ: 0,
      })
      expect(stats.averages.a1cBefore).toBeNull()
      expect(stats.averages.a1cDelta).toBeNull()
      expect(stats.averages.weightDelta).toBeNull()
      expect(stats.byPcu).toEqual([])
    })

    it('aggregates counts, paired deltas, PCU summaries, and breakdowns accurately', () => {
      const r1: DmRemissionCohortRecord = enrichCohortRecord(
        makeRawRecord({
          id: 1,
          pcuName: 'รพ.สต.ล้อมแรด',
          heightCm: 160,
          weightBeforeKg: 70,
          weightAfterKg: 64,
          a1cBefore: 7.5,
          a1cAfter: 6.1,
          a1cPostStop3m: 6.0,
          summaryRemission: 'Remission',
        })
      )
      const r2: DmRemissionCohortRecord = enrichCohortRecord(
        makeRawRecord({
          id: 2,
          pcuName: 'รพ.สต.ล้อมแรด',
          heightCm: 160,
          weightBeforeKg: 80,
          weightAfterKg: null, // unpaired weight should not enter weightDelta
          a1cBefore: 8.5,
          a1cAfter: 7.9,
          a1cPostStop3m: null,
          summaryA1c: 'ลด',
          summaryMeds: 'คงที่',
          summaryWeight: null,
          summaryWaist: null,
          summaryDiet: null,
          summaryExercise: null,
          summaryIf: null,
          summaryRemission: 'สถานะเดิมในประวัติ',
        })
      )
      const r3: DmRemissionCohortRecord = enrichCohortRecord(
        makeRawRecord({
          id: 3,
          pcuName: null,
          heightCm: 170,
          weightBeforeKg: 75,
          weightAfterKg: 72,
          a1cBefore: 7.0,
          a1cAfter: null, // unpaired a1c should not enter a1cDelta
          a1cPostStop3m: null,
          summaryA1c: 'เพิ่ม',
          summaryMeds: 'เพิ่ม',
          summaryRemission: null,
        })
      )

      const stats = aggregateDashboardStats(
        [r1, r2, r3],
        ['Remission', 'ไม่ Remission', 'รอ lab A1c']
      )

      expect(stats.totalPatients).toBe(3)
      expect(stats.remissionCount).toBe(1)
      expect(stats.remissionRate).toBe(33.3)
      expect(stats.statusCounts).toEqual({
        Remission: 1,
        'ไม่ Remission': 0,
        'รอ lab A1c': 0,
        ยังไม่ระบุ: 1,
        สถานะเดิมในประวัติ: 1,
      })

      // Paired deltas: r1 (6.1 - 7.5 = -1.4), r2 (7.9 - 8.5 = -0.6) => mean -1
      expect(stats.averages.a1cDelta).toBe(-1)
      // Paired weight deltas: r1 (64 - 70 = -6), r3 (72 - 75 = -3) => mean -4.5
      expect(stats.averages.weightDelta).toBe(-4.5)
      expect(stats.averages.a1cBefore).toBe(7.67)
      expect(stats.averages.a1cAfter).toBe(7)
      expect(stats.averages.a1cPostStop3m).toBe(6)

      expect(stats.byPcu).toHaveLength(2)
      expect(stats.byPcu[0]).toMatchObject({
        pcuName: 'รพ.สต.ล้อมแรด',
        total: 2,
        remissionCount: 1,
        remissionRate: 50,
      })
      expect(stats.byPcu[1]).toMatchObject({
        pcuName: 'ไม่ระบุ รพ.สต.',
        total: 1,
        remissionCount: 0,
        remissionRate: 0,
      })

      expect(stats.breakdowns.summaryA1c).toEqual({ ลด: 2, เพิ่ม: 1 })
      expect(stats.breakdowns.summaryMeds).toEqual({ หยุดยา: 1, คงที่: 1, เพิ่ม: 1 })
      expect(stats.breakdowns.summaryWeight).toEqual({ ลด: 2, ยังไม่ระบุ: 1 })
    })
  })
})

describe('dmRemissionSchemas', () => {
  it('validates and coerces cohortCreateSchema inputs cleanly', () => {
    const parsed = cohortCreateSchema.safeParse({
      fiscalYear: '2569',
      patientName: '  นายสมชาย ใจดี  ',
      hn: '1234',
      cid: '',
      age: '55',
      heightCm: '168.5',
      weightBeforeKg: '',
      a1cBefore: '7.4',
      summaryA1c: 'ลด',
      summaryMeds: 'หยุดยา',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.fiscalYear).toBe(2569)
      expect(parsed.data.patientName).toBe('นายสมชาย ใจดี')
      expect(parsed.data.cid).toBeNull()
      expect(parsed.data.age).toBe(55)
      expect(parsed.data.heightCm).toBe(168.5)
      expect(parsed.data.weightBeforeKg).toBeNull()
      expect(parsed.data.a1cBefore).toBe(7.4)
    }
  })

  it('rejects invalid numeric bounds, booleans, and invalid enum values', () => {
    expect(
      cohortCreateSchema.safeParse({
        fiscalYear: 2569,
        patientName: 'นายสมชาย',
        heightCm: true,
      }).success
    ).toBe(false)

    expect(
      cohortCreateSchema.safeParse({
        fiscalYear: 2569,
        patientName: 'นายสมชาย',
        a1cBefore: 35,
      }).success
    ).toBe(false)

    expect(
      cohortCreateSchema.safeParse({
        fiscalYear: 2569,
        patientName: 'นายสมชาย',
        summaryMeds: 'offยา 1 ตัว + ลดโดสยาอีกชนิด',
      }).success
    ).toBe(true)

    expect(
      cohortCreateSchema.safeParse({
        fiscalYear: 2569,
        patientName: 'นายสมชาย',
        summaryMeds: 'x'.repeat(51),
      }).success
    ).toBe(false)
  })

  it('validates cohortUpdateSchema with partial payloads', () => {
    const res = cohortUpdateSchema.safeParse({ weightAfterKg: '62.5', summaryRemission: 'Remission' })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.weightAfterKg).toBe(62.5)
    }
  })

  it('validates carryoverSchema requiring target year > source year', () => {
    expect(carryoverSchema.safeParse({ fromFiscalYear: 2569, toFiscalYear: 2570 }).success).toBe(
      true
    )
    expect(carryoverSchema.safeParse({ fromFiscalYear: 2569, toFiscalYear: 2569 }).success).toBe(
      false
    )
    expect(carryoverSchema.safeParse({ fromFiscalYear: 2570, toFiscalYear: 2569 }).success).toBe(
      false
    )
  })

  it('validates optionCreateSchema, optionUpdateSchema, and listQuerySchema', () => {
    const opt = optionCreateSchema.safeParse({ category: 'pcu', label: ' รพ.สต.แม่ถอด ' })
    expect(opt.success).toBe(true)
    if (opt.success) {
      expect(opt.data.label).toBe('รพ.สต.แม่ถอด')
      expect(opt.data.sortOrder).toBe(0)
      expect(opt.data.isActive).toBe(true)
    }

    expect(optionUpdateSchema.safeParse({ isActive: false, sortOrder: '3' }).success).toBe(true)

    const query = listQuerySchema.safeParse({
      fiscalYear: '',
      pcuName: '  ',
      search: 'สมชาย',
    })
    expect(query.success).toBe(true)
    if (query.success) {
      expect(query.data.fiscalYear).toBeUndefined()
      expect(query.data.pcuName).toBeUndefined()
      expect(query.data.search).toBe('สมชาย')
    }
  })
})
