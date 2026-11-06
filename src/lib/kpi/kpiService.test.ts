import { describe, it, expect, vi } from 'vitest'
import { KpiService } from '@/lib/kpi/kpiService'
import { checkPeriodStatus, getPeriodsForFrequency, checkIndicatorDueStatus, isIndicatorAnsweredForPeriod } from '@/lib/kpi/kpiTimeUtils'

// Mock audit logging
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('KpiTimeUtils', () => {
  it('returns appropriate periods for "ราย 6 เดือน"', () => {
    const periods = getPeriodsForFrequency('ราย 6 เดือน')
    expect(periods).toHaveLength(2)
    expect(periods[0].key).toBe('H1')
    expect(periods[1].key).toBe('H2')
  })

  it('correctly locks "ราย 6 เดือน" round 1 before April 1 and unlocks on/after April 1', () => {
    // FY 2570 corresponds to CE 2026-10-01 to 2027-09-30
    // H1 unlocks on 2027-04-01 (หลัง 31 มี.ค.)
    const beforeDate = new Date('2027-03-31T23:59:59Z')
    const onDate = new Date('2027-04-01T00:00:01Z')

    const locked = checkPeriodStatus('ราย 6 เดือน', 'H1', '2570', beforeDate)
    expect(locked.isOpen).toBe(false)
    expect(locked.message).toContain('เปิดให้บันทึกตั้งแต่ 1/4/2570')

    const unlocked = checkPeriodStatus('ราย 6 เดือน', 'H1', '2570', onDate)
    expect(unlocked.isOpen).toBe(true)
  })

  it('calculates due status right now and 5 days in advance accurately', () => {
    // Monthly (รายเดือน): M01 (Oct) unlocks on 2026-11-01
    // On 2026-11-02, M01 is due now
    const nov2 = new Date('2026-11-02T10:00:00Z')
    const monthlyNov2 = checkIndicatorDueStatus('รายเดือน', '2570', nov2)
    expect(monthlyNov2.isDue).toBe(true)
    expect(monthlyNov2.isDueNow).toBe(true)
    expect(monthlyNov2.relevantPeriod.key).toBe('M01')

    // Quarterly (รายไตรมาส): Q1 unlocks on 2027-01-01
    // On 2026-11-02, Q1 is 60 days away -> not due
    const quarterlyNov2 = checkIndicatorDueStatus('รายไตรมาส', '2570', nov2)
    expect(quarterlyNov2.isDue).toBe(false)
    expect(quarterlyNov2.isDueNow).toBe(false)

    // On 2026-12-28 (4 days before 2027-01-01), Q1 is due within 5 days!
    const dec28 = new Date('2026-12-28T10:00:00Z')
    const quarterlyDec28 = checkIndicatorDueStatus('รายไตรมาส', '2570', dec28)
    expect(quarterlyDec28.isDue).toBe(true)
    expect(quarterlyDec28.isDueSoon).toBe(true)
    expect(quarterlyDec28.daysUntil).toBe(4)
    expect(quarterlyDec28.relevantPeriod.key).toBe('Q1')

    // On 2027-01-01 (exact open date), Q1 is unlocked and due now
    const jan1 = new Date('2027-01-01T00:00:00Z')
    const quarterlyJan1 = checkIndicatorDueStatus('รายไตรมาส', '2570', jan1)
    expect(quarterlyJan1.isDue).toBe(true)
    expect(quarterlyJan1.isDueNow).toBe(true)
    expect(quarterlyJan1.relevantPeriod.key).toBe('Q1')
  })
})

describe('KpiService - evaluateTarget', () => {
  it('evaluates >= correctly', () => {
    expect(KpiService.evaluateTarget(85, '>=', 80)).toBe('PASS')
    expect(KpiService.evaluateTarget(80, '>=', 80)).toBe('PASS')
    expect(KpiService.evaluateTarget(79.9, '>=', 80)).toBe('FAIL')
  })

  it('evaluates <= correctly', () => {
    expect(KpiService.evaluateTarget(2.5, '<=', 3)).toBe('PASS')
    expect(KpiService.evaluateTarget(3.0, '<=', 3)).toBe('PASS')
    expect(KpiService.evaluateTarget(3.1, '<=', 3)).toBe('FAIL')
  })

  it('evaluates = correctly', () => {
    expect(KpiService.evaluateTarget(0, '=', 0)).toBe('PASS')
    expect(KpiService.evaluateTarget(1, '=', 0)).toBe('FAIL')
  })

  it('evaluates MIN correctly', () => {
    expect(KpiService.evaluateTarget(0, 'MIN', null)).toBe('PASS')
    expect(KpiService.evaluateTarget(5, 'MIN', null)).toBe('WAITING_TARGET')
    expect(KpiService.evaluateTarget(2, 'MIN', 3)).toBe('PASS')
  })

  it('returns WAITING_TARGET if target is undefined/null', () => {
    expect(KpiService.evaluateTarget(50, null, null)).toBe('WAITING_TARGET')
  })

  it('returns PENDING if resultValue is undefined/null', () => {
    expect(KpiService.evaluateTarget(null, '>=', 80)).toBe('PENDING')
  })
})

describe('KpiService with Mock QueryExecutor', () => {
  it('auto-calculates percentage and evaluates target on saveEntry', async () => {
    const mockDb: any[] = []
    const mockExecutor = vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
      if (sql.includes('FROM kpi_indicators i')) {
        return [{
          id: 1,
          topicId: 1,
          sequence: '1',
          category: 'หมวด 1',
          subcategory: 'โรคหัวใจ',
          code: 'HR-01',
          oldCode: null,
          frequency: 'ราย 6 เดือน',
          title: 'ร้อยละผู้ป่วย',
          numeratorName: 'ตัวตั้ง',
          denominatorName: 'ตัวหาร',
          targetRaw: '>= 80%',
          targetOperator: '>=',
          targetValue: '80.0000',
          targetUnit: '%',
          responsibleName: 'นิศานาถ',
          indicatorType: 'HA',
          displayOrder: 1,
          fiscalYear: '2570'
        }]
      }
      if (sql.includes('SELECT id, indicator_id AS indicatorId')) {
        return []
      }
      if (sql.includes('SELECT id FROM kpi_entries')) {
        return [] // not existing
      }
      if (sql.includes('INSERT INTO kpi_entries')) {
        mockDb.push(params)
        return { insertId: 99 }
      }
      return []
    })

    const entry = await KpiService.saveEntry({
      indicatorId: 1,
      fiscalYear: '2570',
      periodKey: 'H1',
      periodLabel: 'รอบ 6 เดือนแรก',
      numeratorValue: 45,
      denominatorValue: 50, // 45 / 50 * 100 = 90%
      isAdmin: true, // bypass timing lock in test
      recordedByName: 'นิศานาถ'
    }, mockExecutor)

    expect(entry.resultValue).toBe(90)
    expect(entry.status).toBe('PASS')
    expect(entry.id).toBe(99)
  })

  it('correctly calculates 0% and PASS when numerator and denominator are 0/0 (no cases)', async () => {
    const mockDb: any[] = []
    const mockExecutor = vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
      if (sql.includes('FROM kpi_indicators i')) {
        return [{
          id: 88,
          topicId: 1,
          sequence: '1',
          category: 'หมวด 1',
          subcategory: 'Sepsis',
          code: 'HR-ITC-0101',
          oldCode: null,
          frequency: 'รายเดือน',
          title: 'ร้อยละการเสียชีวิตของผู้ป่วยใน จากภาวะพิษเหตุติดเชื้อในชุมชน (Community-acquired sepsis)',
          numeratorName: 'จำนวนผู้เสียชีวิต',
          denominatorName: 'จำนวนผู้ป่วยทั้งหมด',
          targetRaw: '< ร้อยละ 24',
          targetOperator: '<',
          targetValue: '24.0000',
          targetUnit: '%',
          responsibleName: 'นิศานาถ',
          indicatorType: 'HA',
          displayOrder: 1,
          fiscalYear: '2570'
        }]
      }
      if (sql.includes('SELECT id, indicator_id AS indicatorId')) {
        return []
      }
      if (sql.includes('SELECT id FROM kpi_entries')) {
        return []
      }
      if (sql.includes('INSERT INTO kpi_entries')) {
        mockDb.push(params)
        return { insertId: 101 }
      }
      return []
    })

    const entry = await KpiService.saveEntry({
      indicatorId: 88,
      fiscalYear: '2570',
      periodKey: 'M01',
      periodLabel: 'ตุลาคม',
      numeratorValue: 0,
      denominatorValue: 0, // 0/0 no cases
      isAdmin: true,
      recordedByName: 'นิศานาถ'
    }, mockExecutor)

    expect(entry.resultValue).toBe(0)
    expect(entry.status).toBe('PASS')
    expect(entry.numeratorValue).toBe(0)
    expect(entry.denominatorValue).toBe(0)
  })

  it('creates, updates, and deletes an indicator', async () => {
    let insertedParams: any[] = []
    let updatedParams: any[] = []
    let deletedId: number | null = null

    const mockExecutor = vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
      if (sql.includes('INSERT INTO kpi_indicators')) {
        insertedParams = params
        return { insertId: 201 }
      }
      if (sql.includes('FROM kpi_indicators i') && sql.includes('WHERE i.id = ?')) {
        return [{
          id: 201,
          topicId: 1,
          sequence: '99',
          category: 'หมวด 1',
          subcategory: null,
          code: 'TEST-01',
          oldCode: null,
          frequency: 'ราย 6 เดือน',
          title: 'ทดสอบตัวชี้วัด',
          numeratorName: null,
          denominatorName: null,
          targetRaw: '>= 80%',
          targetOperator: '>=',
          targetValue: '80.0000',
          targetUnit: '%',
          responsibleName: 'นิศานาถ',
          indicatorType: 'HA',
          displayOrder: 1,
          fiscalYear: '2570'
        }]
      }
      if (sql.includes('SELECT id, indicator_id AS indicatorId')) {
        return []
      }
      if (sql.includes('UPDATE kpi_indicators SET')) {
        updatedParams = params
        return { affectedRows: 1 }
      }
      if (sql.includes('SELECT id, result_value AS resultValue FROM kpi_entries')) {
        return []
      }
      if (sql.includes('DELETE FROM kpi_indicators')) {
        deletedId = params[0]
        return { affectedRows: 1 }
      }
      return []
    })

    // Test Create
    const newId = await KpiService.createIndicator({
      topicId: 1,
      category: 'หมวด 1',
      frequency: 'ราย 6 เดือน',
      title: 'ตัวชี้วัดใหม่',
      targetOperator: '>=',
      targetValue: 80,
      responsibleName: 'นิศานาถ'
    }, mockExecutor)
    expect(newId).toBe(201)
    expect(insertedParams).toContain('ตัวชี้วัดใหม่')

    // Test Update
    await KpiService.updateIndicator({
      id: 201,
      title: 'ตัวชี้วัดแก้ไขแล้ว',
      targetValue: 85
    }, mockExecutor)
    expect(updatedParams).toContain('ตัวชี้วัดแก้ไขแล้ว')

    // Test Delete
    await KpiService.deleteIndicator(201, 'Admin', mockExecutor)
    expect(deletedId).toBe(201)
  })

  it('orders indicators by sequence number in getIndicators SQL query', async () => {
    let capturedSql = ''
    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      capturedSql = sql
      return []
    })

    await KpiService.getIndicators({ topicId: 1 }, mockExecutor)
    expect(capturedSql).toContain('ORDER BY')
    expect(capturedSql).toContain('i.sequence')
    expect(capturedSql).toContain('CAST(i.sequence AS UNSIGNED) ASC')
  })

  it('identifies whether an indicator is answered for a specific period', () => {
    // 1. No entries
    expect(isIndicatorAnsweredForPeriod({}, 'M01')).toBe(false)

    // 2. Unanswered / pending entry
    expect(isIndicatorAnsweredForPeriod({
      currentEntry: { periodKey: 'M01', status: 'PENDING', resultValue: null, resultText: null }
    }, 'M01')).toBe(false)

    // 3. 'ไม่มีรายงาน' text
    expect(isIndicatorAnsweredForPeriod({
      currentEntry: { periodKey: 'M01', status: 'WAITING_TARGET', resultValue: null, resultText: 'ไม่มีรายงาน' }
    }, 'M01')).toBe(false)

    // 4. Entry for a different period (M01 answered, checking M02)
    expect(isIndicatorAnsweredForPeriod({
      currentEntry: { periodKey: 'M01', status: 'PASS', resultValue: 90, resultText: null }
    }, 'M02')).toBe(false)

    // 5. Answered with numeric result (PASS/FAIL)
    expect(isIndicatorAnsweredForPeriod({
      currentEntry: { periodKey: 'M01', status: 'PASS', resultValue: 90, resultText: null }
    }, 'M01')).toBe(true)

    // 6. Answered with text in entries array
    expect(isIndicatorAnsweredForPeriod({
      entries: [
        { periodKey: 'M01', status: 'PASS', resultValue: 90 },
        { periodKey: 'M02', status: 'WAITING_TARGET', resultText: 'ดำเนินการเรียบร้อย' }
      ]
    }, 'M02')).toBe(true)
  })

  it('groups multiple period entry rows by indicator id and populates entries array', async () => {
    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM kpi_indicators i')) {
        return [
          {
            id: 10,
            topicId: 1,
            sequence: '1',
            category: 'หมวด 1',
            subcategory: null,
            code: 'M-01',
            oldCode: null,
            frequency: 'รายเดือน',
            title: 'ตัวชี้วัดรายเดือน',
            numeratorName: null,
            denominatorName: null,
            targetRaw: '>= 80%',
            targetOperator: '>=',
            targetValue: '80.0000',
            targetUnit: '%',
            responsibleName: 'นิศานาถ',
            indicatorType: 'HA',
            displayOrder: 1,
            entryId: 501,
            entryPeriodKey: 'M01',
            entryPeriodLabel: 'ตุลาคม',
            entryNumeratorValue: null,
            entryDenominatorValue: null,
            entryResultValue: '85.00',
            entryResultText: null,
            entryStatus: 'PASS',
            entryNote: null,
            entryRecordedById: 1,
            entryRecordedByName: 'Admin',
            entryRecordedAt: '2026-11-01',
            entryUpdatedAt: '2026-11-01',
          },
          {
            id: 10,
            topicId: 1,
            sequence: '1',
            category: 'หมวด 1',
            subcategory: null,
            code: 'M-01',
            oldCode: null,
            frequency: 'รายเดือน',
            title: 'ตัวชี้วัดรายเดือน',
            numeratorName: null,
            denominatorName: null,
            targetRaw: '>= 80%',
            targetOperator: '>=',
            targetValue: '80.0000',
            targetUnit: '%',
            responsibleName: 'นิศานาถ',
            indicatorType: 'HA',
            displayOrder: 1,
            entryId: 502,
            entryPeriodKey: 'M02',
            entryPeriodLabel: 'พฤศจิกายน',
            entryNumeratorValue: null,
            entryDenominatorValue: null,
            entryResultValue: '75.00',
            entryResultText: null,
            entryStatus: 'FAIL',
            entryNote: null,
            entryRecordedById: 1,
            entryRecordedByName: 'Admin',
            entryRecordedAt: '2026-12-01',
            entryUpdatedAt: '2026-12-01',
          }
        ]
      }
      return []
    })

    const indicators = await KpiService.getIndicators({ topicId: 1, fiscalYear: '2570' }, mockExecutor)
    expect(indicators).toHaveLength(1)
    expect(indicators[0].id).toBe(10)
    expect(indicators[0].entries).toHaveLength(2)
    expect(indicators[0].entries?.map(e => e.periodKey)).toEqual(['M01', 'M02'])
  })

})
