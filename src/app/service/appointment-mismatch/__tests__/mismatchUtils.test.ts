import { describe, expect, it } from 'vitest'
import { buildMismatchWorkbook } from '../exportMismatchExcel'
import {
  filterAndSortMismatches,
  formatThaiShortDate,
  getDaysUntilDate,
  getUrgencyMeta,
  normalizeDepartmentLabel,
  normalizeUserLabel,
  parseCalendarDate,
  summarizeMismatches,
  type AppointmentMismatch,
} from '../mismatchUtils'

const SAMPLE_FIXTURES: AppointmentMismatch[] = [
  {
    hn: '0009001',
    department: 'ห้องตรวจอายุรกรรม 1',
    vstdate: '2026-11-10',
    nextdate: '2026-11-19',
    appUser: 'สมหญิง ใจดี',
  },
  {
    hn: '0009002',
    department: 'คลินิกเบาหวาน',
    vstdate: '2026-11-12',
    nextdate: '2026-11-24',
    appUser: 'วิชัย รักงาน',
  },
  {
    hn: '0009003',
    department: 'ห้องตรวจอายุรกรรม 1',
    vstdate: '2026-11-15',
    nextdate: '2026-12-20',
    appUser: 'สมหญิง ใจดี',
  },
  {
    hn: '0009004',
    department: '',
    vstdate: '2026-11-01',
    nextdate: '2026-11-18',
    appUser: '',
  },
]

const REF_DATE = new Date('2026-11-18T09:00:00+07:00')

describe('mismatchUtils & Excel export', () => {
  it('parses plain dates and Bangkok ISO timestamps consistently', () => {
    expect(parseCalendarDate('2026-11-19')).toEqual({ year: 2026, month: 11, day: 19 })
    expect(parseCalendarDate('2026-11-18T18:00:00.000Z')).toEqual({
      year: 2026,
      month: 11,
      day: 19,
    })
    expect(parseCalendarDate('')).toBeNull()
  })

  it('formats dates in Thai Buddhist calendar (พ.ศ.)', () => {
    expect(formatThaiShortDate('2026-11-19')).toBe('19 พ.ย. 2569')
    expect(formatThaiShortDate('2026-01-05')).toBe('5 ม.ค. 2569')
    expect(formatThaiShortDate('')).toBe('-')
  })

  it('computes days until appointment and classifies urgency accurately', () => {
    expect(getDaysUntilDate('2026-11-18', REF_DATE)).toBe(0)
    expect(getDaysUntilDate('2026-11-19', REF_DATE)).toBe(1)
    expect(getDaysUntilDate('2026-11-24', REF_DATE)).toBe(6)

    expect(getUrgencyMeta(0)).toEqual({ tone: 'critical', label: 'วันนี้ / เกินกำหนด' })
    expect(getUrgencyMeta(1)).toEqual({ tone: 'critical', label: 'พรุ่งนี้' })
    expect(getUrgencyMeta(6)).toEqual({ tone: 'warning', label: 'อีก 6 วัน' })
    expect(getUrgencyMeta(32)).toEqual({ tone: 'neutral', label: 'อีก 32 วัน' })
  })

  it('summarizes totals, urgency counts, and ranked breakdowns', () => {
    const summary = summarizeMismatches(SAMPLE_FIXTURES, REF_DATE)

    expect(summary.total).toBe(4)
    expect(summary.tomorrowCount).toBe(2)
    expect(summary.urgent7Count).toBe(3)
    expect(summary.uniqueDepartments).toBe(3)
    expect(summary.uniqueUsers).toBe(3)

    expect(summary.departmentBreakdown[0]).toEqual({
      name: 'ห้องตรวจอายุรกรรม 1',
      count: 2,
      percent: 50,
    })
    expect(summary.userBreakdown[0]).toEqual({
      name: 'สมหญิง ใจดี',
      count: 2,
      percent: 50,
    })
  })

  it('filters by urgency, department, search query and sorts by soonest nextdate first', () => {
    const allSorted = filterAndSortMismatches(
      SAMPLE_FIXTURES,
      {
        searchQuery: '',
        urgencyFilter: 'all',
        departmentFilter: 'all',
        userFilter: 'all',
        sortBy: 'nextdate_asc',
      },
      REF_DATE
    )
    expect(allSorted.map((item) => item.hn)).toEqual(['0009004', '0009001', '0009002', '0009003'])

    const urgentOnly = filterAndSortMismatches(
      SAMPLE_FIXTURES,
      {
        searchQuery: '9001',
        urgencyFilter: 'tomorrow',
        departmentFilter: 'ห้องตรวจอายุรกรรม 1',
        userFilter: 'all',
        sortBy: 'nextdate_asc',
      },
      REF_DATE
    )
    expect(urgentOnly).toHaveLength(1)
    expect(urgentOnly[0]?.hn).toBe('0009001')
  })

  it('builds an Excel workbook with centered cells, Thai Buddhist dates, and formula escaping', async () => {
    const workbook = await buildMismatchWorkbook(
      [
        {
          hn: '=CMD()',
          department: 'ห้องตรวจ, 1',
          vstdate: '2026-11-10',
          nextdate: '2026-11-19',
          appUser: 'สมหญิง ใจดี',
        },
      ],
      REF_DATE
    )

    const sheet = workbook.getWorksheet('รายการนัดผิดห้องตรวจ')
    expect(sheet).toBeDefined()
    expect(sheet?.rowCount).toBe(2)

    const dataRow = sheet?.getRow(2)
    expect(dataRow?.getCell(1).value).toBe(1)
    expect(dataRow?.getCell(2).value).toBe("'=CMD()")
    expect(dataRow?.getCell(3).value).toBe('ห้องตรวจ, 1')
    expect(dataRow?.getCell(4).value).toBe('สมหญิง ใจดี')
    expect(dataRow?.getCell(5).value).toBe('10 พ.ย. 2569')
    expect(dataRow?.getCell(6).value).toBe('19 พ.ย. 2569')
    expect(dataRow?.getCell(7).value).toBe('พรุ่งนี้')
    expect(dataRow?.getCell(3).alignment?.horizontal).toBe('center')
  })

  it('handles null or undefined fields gracefully without throwing on trim()', () => {
    const nullableRows = [
      {
        hn: null,
        department: null,
        vstdate: null,
        nextdate: null,
        appUser: undefined,
      },
    ] as unknown as AppointmentMismatch[]

    expect(parseCalendarDate(null)).toBeNull()
    expect(formatThaiShortDate(null)).toBe('-')
    expect(normalizeDepartmentLabel(null)).toBe('ไม่ระบุห้องตรวจ')
    expect(normalizeUserLabel(undefined)).toBe('ไม่ระบุผู้นัด')

    const summary = summarizeMismatches(nullableRows, REF_DATE)
    expect(summary.total).toBe(1)
    expect(summary.departmentBreakdown[0]?.name).toBe('ไม่ระบุห้องตรวจ')
    expect(summary.userBreakdown[0]?.name).toBe('ไม่ระบุผู้นัด')

    const filtered = filterAndSortMismatches(
      nullableRows,
      {
        searchQuery: '',
        urgencyFilter: 'all',
        departmentFilter: 'all',
        userFilter: 'all',
        sortBy: 'nextdate_asc',
      },
      REF_DATE
    )
    expect(filtered).toHaveLength(1)
  })
})
