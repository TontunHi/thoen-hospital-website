import { describe, it, expect } from 'vitest'
import {
  aggregateFctDashboardStats,
  formatThaiShortDate,
  getAvailableFiscalYears,
  getCurrentThaiFiscalYear,
  getFiscalYearDateBounds,
  getThaiFiscalYearFromDate,
  normalizeHn,
  parseFctImportMatrix,
  parseFlexibleVisitDate,
  suggestAdlGroup,
} from '../fctHomeVisitDomain'
import type { FctHomeVisitRecord } from '../fctHomeVisitTypes'

function makeVisit(overrides: Partial<FctHomeVisitRecord> = {}): FctHomeVisitRecord {
  return {
    id: 1,
    fiscalYear: 2570,
    visitDate: '2026-10-05',
    pcuName: 'รพ.สต.ทดสอบ',
    patientName: 'นายสมมติ ทดสอบ',
    hn: '0012345',
    age: 72,
    address: '99 ม.1 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
    adlScore: 4,
    adlGroup: 'ติดเตียง',
    diagnosis: 'Stroke HT',
    patientCategory: 'stroke',
    followUpPlan: 'ระวังแผลกดทับ',
    treatmentFacility: 'รพ.เถิน',
    visitOutcome: 'คงเดิม',
    overallRiskLevel: 'Moderate',
    riskLevel: null,
    dentalNote: null,
    pharmacyNote: null,
    nutritionStatus: 'ปกติ',
    nutritionNote: 'ไม่มีปัญหาด้านโภชนาการ',
    ptCategory: null,
    ptNote: null,
    thaiMedCategory: null,
    thaiMedNote: null,
    createdBy: 'tester',
    updatedBy: 'tester',
    createdAt: '2026-10-05T08:00:00.000Z',
    updatedAt: '2026-10-05T08:00:00.000Z',
    ...overrides,
  }
}

describe('fctHomeVisitDomain', () => {
  describe('Thai fiscal year helpers', () => {
    it('maps visit dates to the proper Thai fiscal year (Oct 1 – Sep 30)', () => {
      expect(getThaiFiscalYearFromDate('2026-10-01')).toBe(2570)
      expect(getThaiFiscalYearFromDate('2026-12-31')).toBe(2570)
      expect(getThaiFiscalYearFromDate('2027-01-15')).toBe(2570)
      expect(getThaiFiscalYearFromDate('2027-09-30')).toBe(2570)
      expect(getThaiFiscalYearFromDate('2026-09-30')).toBe(2569)
    })

    it('computes inclusive fiscal year date bounds', () => {
      expect(getFiscalYearDateBounds(2570)).toEqual({
        startDate: '2026-10-01',
        endDate: '2027-09-30',
      })
    })

    it('lists sorted unique fiscal years including current and existing DB years', () => {
      const current = getCurrentThaiFiscalYear(new Date('2026-10-10T00:00:00+07:00'))
      expect(current).toBe(2570)
      const list = getAvailableFiscalYears([2565, 2570], new Date('2026-10-10T00:00:00+07:00'))
      expect(list[0]).toBe(2571)
      expect(list).toContain(2565)
    })
  })

  describe('normalizeHn & suggestAdlGroup', () => {
    it('strips stray Thai vowels and pads numeric HNs to 7 digits', () => {
      expect(normalizeHn('ุ69905')).toBe('0069905')
      expect(normalizeHn('ึ78980')).toBe('0078980')
      expect(normalizeHn(' 1234 ')).toBe('0001234')
      expect(normalizeHn('   ')).toBeNull()
      expect(normalizeHn(null)).toBeNull()
    })

    it('suggests standard ADL groups from score bounds', () => {
      expect(suggestAdlGroup(0)).toBe('ติดเตียง')
      expect(suggestAdlGroup(4)).toBe('ติดเตียง')
      expect(suggestAdlGroup(5)).toBe('ติดบ้าน')
      expect(suggestAdlGroup(11)).toBe('ติดบ้าน')
      expect(suggestAdlGroup(12)).toBe('ติดสังคม')
      expect(suggestAdlGroup(20)).toBe('ติดสังคม')
      expect(suggestAdlGroup(null)).toBeNull()
    })
  })

  describe('parseFlexibleVisitDate & formatThaiShortDate', () => {
    it('parses Thai short dates, stray marks, ISO dates, slash dates, and Excel serials', () => {
      expect(parseFlexibleVisitDate('5 ตค 69')).toBe('2026-10-05')
      expect(parseFlexibleVisitDate('ุ6ตค 69')).toBe('2026-10-06')
      expect(parseFlexibleVisitDate('ุึ7ตค 69')).toBe('2026-10-07')
      expect(parseFlexibleVisitDate('8ตค 69')).toBe('2026-10-08')
      expect(parseFlexibleVisitDate('2026-10-15')).toBe('2026-10-15')
      expect(parseFlexibleVisitDate('2569-10-15')).toBe('2026-10-15')
      expect(parseFlexibleVisitDate('15/10/2569')).toBe('2026-10-15')
      expect(parseFlexibleVisitDate(new Date('2026-11-05T00:00:00Z'))).toBe('2026-11-05')
      expect(parseFlexibleVisitDate('invalid')).toBeNull()
    })

    it('formats ISO date in Thai Buddhist calendar', () => {
      expect(formatThaiShortDate('2026-10-05')).toBe('5 ต.ค. 2569')
    })
  })

  describe('parseFctImportMatrix', () => {
    it('parses 2-row merged spreadsheet templates and normalizes prefixes, HNs, dates, and typos', () => {
      const matrix: unknown[][] = [
        [
          'ลำดับ',
          '',
          'ชื่อ สกุล',
          'HN',
          'อายุ',
          'ที่อยู่',
          'รพสต',
          'สี/ ADL',
          '',
          'Dx',
          '',
          'สิ่งที่ต้องตาม',
          'วันที่เยี่ยมบ้าน',
          'สถานที่รักษา',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ],
        [
          '',
          'คำนำหน้า',
          '',
          '',
          '',
          '',
          '',
          'คะแนน',
          'ติดเตียง',
          '',
          'ประเภทคนไข้',
          '',
          '',
          '',
          'ดีขึ้น',
          '',
          'ทันตกรรม',
          'เภสัช',
          'นักโภช',
          'นักโภช',
          'กายภาพ, ฝึกเดิน, ป้องกันข้อติด',
          'กายภาพ',
          'แผนไทย',
          'แผนไทย',
        ],
        [
          1,
          'นาย',
          'สมมติ ทดสอบหนึ่ง',
          'ุ12345',
          78,
          '10 ม.1 ต.แม่วะ',
          'รพ เถิน',
          '4',
          'ติิดเตียง',
          'Stroke',
          'stroke',
          'ป้องกันหกล้ม',
          '5 ตค 69',
          'รพ.เถิน',
          'แย่ลง',
          'Moderate Lisk',
          'ดูแลช่องปาก',
          'กินยาถูกต้อง',
          'อ้วนBMI เกิน',
          'ลดหวานมันเค็ม',
          'ฝึกเดิน',
          'ประเมินกล้ามเนื้อ',
          'นวดประคบ',
          'ปวดเข่า',
        ],
        [
          2,
          'นาง',
          'สมมติ ไม่มีเอชเอ็น',
          '',
          73,
          '20 ม.2 ต.นาโป่ง',
          'กุุ่่มเนิ้ง',
          0,
          '',
          'DM',
          'palliative',
          '',
          '2026-10-15',
          'รพ.เถิน',
          'ดีขึ้น',
          'HIgh',
          '',
          '',
          'ขาดสารอาหารรุนแรง',
          'เพิ่มโปรตีน',
          '',
          '',
          '',
          '',
        ],
        [3, '', '', '', '', '', '', '', '', '', '', '', '', ''], // trailing blank row skipped
        [4, 'นาย', 'วันที่ผิดพลาด', '55555', 60, '', '', '', '', '', '', '', 'bad-date'],
      ]

      const parsed = parseFctImportMatrix(matrix)

      expect(parsed.totalScanned).toBe(3)
      expect(parsed.validRows).toHaveLength(2)
      expect(parsed.errors).toHaveLength(1)
      expect(parsed.errors[0].patientName).toBe('นายวันที่ผิดพลาด')

      const first = parsed.validRows[0]
      expect(first.data.patientName).toBe('นายสมมติ ทดสอบหนึ่ง')
      expect(first.data.hn).toBe('0012345')
      expect(first.data.pcuName).toBe('รพ.เถิน')
      expect(first.data.adlScore).toBe(4)
      expect(first.data.adlGroup).toBe('ติดเตียง')
      expect(first.data.visitDate).toBe('2026-10-05')
      expect(first.data.overallRiskLevel).toBe('Moderate')
      expect(first.data.nutritionStatus).toBe('อ้วน BMI เกิน')
      expect(first.data.thaiMedNote).toBe('ปวดเข่า')
      expect(first.warnings.length).toBeGreaterThan(0)

      const second = parsed.validRows[1]
      expect(second.data.hn).toBeNull()
      expect(second.data.pcuName).toBe('กุ่มเนิ้ง')
      expect(second.data.adlGroup).toBe('ติดเตียง')
      expect(second.data.overallRiskLevel).toBe('High')
      expect(second.warnings).toContain('ไม่มี HN')
    })

    it('parses single-row exported xlsx headers cleanly', () => {
      const matrix: unknown[][] = [
        [
          'ลำดับ',
          'ชื่อ-สกุล',
          'HN',
          'อายุ',
          'ที่อยู่',
          'รพ.สต.',
          'คะแนน ADL',
          'กลุ่ม ADL',
          'Dx',
          'ประเภทคนไข้',
          'สิ่งที่ต้องตาม',
          'วันที่เยี่ยมบ้าน',
          'สถานที่รักษา',
          'ผลลัพธ์การเยี่ยม',
          'ระดับความเสี่ยงโดยรวมของผู้ป่วย',
          'ระดับความเสี่ยง',
          'ทันตกรรม',
          'เภสัช',
          'นักโภช (สถานะ)',
          'นักโภช (คำแนะนำ)',
          'กายภาพ (หมวดกิจกรรม)',
          'กายภาพ (บันทึก)',
          'แผนไทย (หมวดอาการ/บริการ)',
          'แผนไทย (บันทึก)',
        ],
        [
          1,
          'นางสมมติ ส่งออก',
          '9988',
          68,
          '5 ม.3',
          'เด่นชัย',
          8,
          '',
          'HT',
          'stroke',
          'หกล้ม',
          '2026-11-05',
          'รพ.เถิน',
          'ดีขึ้น',
          'Low',
          'Moderate',
          'ฟันผุ',
          'ทานยาครบ',
          'ปกติ',
          'ขับถ่ายดี',
          'ฝึกยืน',
          'ดีขึ้น',
          'พอกเข่า',
          'ปวดลดลง',
        ],
      ]

      const parsed = parseFctImportMatrix(matrix)
      expect(parsed.errors).toHaveLength(0)
      expect(parsed.validRows).toHaveLength(1)
      expect(parsed.validRows[0].data.hn).toBe('0009988')
      expect(parsed.validRows[0].data.adlGroup).toBe('ติดบ้าน')
      expect(parsed.validRows[0].data.riskLevel).toBe('Moderate')
    })
  })

  describe('aggregateFctDashboardStats', () => {
    it('distinguishes total visits from unique patients and tallies discipline engagement', () => {
      const records: FctHomeVisitRecord[] = [
        makeVisit({
          id: 1,
          hn: '0001001',
          pcuName: 'เด่นชัย',
          visitDate: '2026-10-05',
          adlGroup: 'ติดเตียง',
          visitOutcome: 'แย่ลง',
          overallRiskLevel: 'High',
          patientCategory: 'stroke',
          dentalNote: 'ฟันผุ',
          nutritionStatus: 'ขาดสารอาหารรุนแรง',
        }),
        makeVisit({
          id: 2,
          hn: '0001001',
          pcuName: 'เด่นชัย',
          visitDate: '2026-11-05',
          adlGroup: 'ติดบ้าน',
          visitOutcome: 'ดีขึ้น',
          overallRiskLevel: 'Low',
          patientCategory: 'stroke',
          dentalNote: null,
          pharmacyNote: 'กินยาถูก',
          nutritionStatus: 'ปกติ',
        }),
        makeVisit({
          id: 3,
          hn: null,
          pcuName: 'แม่วะหลวง',
          visitDate: '2026-11-05',
          adlGroup: 'ติดสังคม',
          visitOutcome: 'คงเดิม',
          overallRiskLevel: 'Low',
          riskLevel: 'High',
          patientCategory: 'palliative',
          nutritionStatus: 'ปกติ',
          nutritionNote: '',
          ptCategory: 'ฝึกเดิน',
          thaiMedNote: 'ปวดเข่า',
        }),
      ]

      const stats = aggregateFctDashboardStats(records, 2570)
      expect(stats.totalVisits).toBe(3)
      expect(stats.uniquePatients).toBe(1)
      expect(stats.unidentifiedHnVisits).toBe(1)
      expect(stats.highRiskOrSevereCount).toBe(2)

      expect(stats.byPcu[0]).toMatchObject({
        pcuName: 'เด่นชัย',
        totalVisits: 2,
        uniquePatients: 1,
      })

      const oct = stats.monthlyTrend.find((m) => m.monthKey === '2026-10')
      const nov = stats.monthlyTrend.find((m) => m.monthKey === '2026-11')
      expect(oct?.count).toBe(1)
      expect(nov?.count).toBe(2)
      expect(stats.monthlyTrend).toHaveLength(12)

      const dental = stats.disciplineEngagement.find((d) => d.key === 'dental')
      const pharmacy = stats.disciplineEngagement.find((d) => d.key === 'pharmacy')
      expect(dental?.filledCount).toBe(1)
      expect(pharmacy?.filledCount).toBe(1)
    })
  })
})
