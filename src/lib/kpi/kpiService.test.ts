import { describe, it, expect, vi } from 'vitest'
import { KpiService } from '@/lib/kpi/kpiService'
import { checkPeriodStatus, getPeriodsForFrequency } from '@/lib/kpi/kpiTimeUtils'

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
})
