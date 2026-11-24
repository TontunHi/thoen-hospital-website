import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

import {
  aggregateProjectDashboardStats,
  enrichProjectRecord,
  getPopulatedFiscalYears,
  normalizeBudgetNumber,
  parseProjectImportMatrix,
  sortStrategies,
} from '../projectTrackerDomain'
import { PROJECT_TRACKER_SEED_2570 } from './fixtures/projectTrackerSample2570'
import { ProjectTrackerService } from '../projectTrackerService'
import type { ProjectRecordRaw } from '../projectTrackerTypes'

function seedToRecord(idx: number): ProjectRecordRaw {
  const item = PROJECT_TRACKER_SEED_2570[idx]
  return {
    id: idx + 1,
    fiscalYear: item.fiscalYear,
    sequenceNo: item.sequenceNo ?? idx + 1,
    projectCode: item.projectCode ?? null,
    strategy: item.strategy,
    projectName: item.projectName,
    responsibleUnit: item.responsibleUnit ?? null,
    q1Budget: item.q1Budget ?? 0,
    q2Budget: item.q2Budget ?? 0,
    q3Budget: item.q3Budget ?? 0,
    q4Budget: item.q4Budget ?? 0,
    actualSpent: item.actualSpent ?? 0,
    submissionStatus: item.submissionStatus ?? 'ยังไม่ส่ง',
    budgetSource: item.budgetSource ?? 'เงินบำรุง',
    notes: item.notes ?? null,
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }
}

describe('projectTrackerDomain', () => {
  it('verifies sample FY 2570 dataset totals and only includes present categories', () => {
    expect(PROJECT_TRACKER_SEED_2570).toHaveLength(51)
    const enriched = PROJECT_TRACKER_SEED_2570.map((_, i) =>
      enrichProjectRecord(seedToRecord(i))
    )
    const stats = aggregateProjectDashboardStats(enriched)

    expect(stats.totalProjects).toBe(51)
    expect(stats.submittedCount).toBe(19)
    expect(stats.pendingCount).toBe(16)
    expect(stats.noBudgetCount).toBe(15)
    expect(stats.cancelledCount).toBe(1)
    expect(stats.submissionRate).toBe(37.3)
    expect(stats.allocatedBudgetTotal).toBe(4273433)
    expect(stats.actualSpentTotal).toBe(0)
    expect(stats.remainingBudgetTotal).toBe(4273433)
    expect(stats.byQuarter.map((q) => q.allocatedBudget)).toEqual([
      1602200,
      1066790,
      917118,
      687325,
    ])
  })

  it('derives stats strictly from existing records without hardcoded phantom defaults', () => {
    const emptyStats = aggregateProjectDashboardStats([])
    expect(emptyStats.totalProjects).toBe(0)
    expect(emptyStats.byStrategy).toEqual([])
    expect(emptyStats.byStatus).toEqual({})
    expect(emptyStats.byBudgetSource).toEqual([])
    expect(emptyStats.remainingRate).toBe(0)

    const partialStats = aggregateProjectDashboardStats([
      enrichProjectRecord({
        ...seedToRecord(0),
        strategy: 'ย.2',
        submissionStatus: 'ส่งแล้ว',
        budgetSource: 'กปท.',
      }),
    ])
    expect(partialStats.byStrategy.map((s) => s.strategy)).toEqual(['ย.2'])
    expect(partialStats.byStatus).toEqual({ ส่งแล้ว: 1 })
    expect(partialStats.byBudgetSource.map((b) => b.label)).toEqual(['กปท.'])
  })

  it('returns only populated fiscal years and sorts custom strategies naturally', () => {
    expect(getPopulatedFiscalYears([])).toEqual([])
    expect(getPopulatedFiscalYears([2569, 2570, 2569])).toEqual([2570, 2569])
    expect(sortStrategies(['งานประจำ', 'ย.10', 'ยุทธศาสตร์พิเศษ', 'ย.2', 'ย.1'])).toEqual([
      'ย.1',
      'ย.2',
      'ย.10',
      'ยุทธศาสตร์พิเศษ',
      'งานประจำ',
    ])
  })

  it('normalizes Thai/Excel dash and formatted money strings cleanly', () => {
    expect(normalizeBudgetNumber('-')).toBe(0)
    expect(normalizeBudgetNumber('฿12,500.50')).toBe(12500.5)
    expect(normalizeBudgetNumber(null)).toBe(0)
    expect(normalizeBudgetNumber(-500)).toBe(0)
  })

  it('parses an Excel-like matrix and skips total/empty rows', () => {
    const matrix: unknown[][] = [
      ['ลำดับ', 'รหัสโครงการ', 'ยุทธศาสตร์', 'ชื่อโครงการ', 'หน่วยงาน/ผู้รับผิดชอบ', 'ไตรมาส 1', 'ไตรมาส 2', 'ไตรมาส 3', 'ไตรมาส 4', 'งบประมาณที่ได้รับ', 'งบประมาณใช้จริง', 'งบประมาณคงเหลือ', 'สถานะการส่งสรุปงาน', 'แหล่งงบประมาณ', 'หมายเหตุ/ปัญหาอุปสรรค'],
      [1, '080101', 'ย.1', 'โครงการทดสอบ 1', 'กลุ่มงานปฐมภูมิ', 3000, '-', 2000, '-', 5000, 1000, 4000, 'ส่งแล้ว', 'เงินบำรุง', null],
      [2, null, 'งานประจำ', 'โครงการทดสอบ 2', 'งาน IT', '-', '-', '-', '-', 0, 0, 0, 'ไม่ใช้งบประมาณ', 'ไม่ใช้งบประมาณ', 'หมายเหตุทดสอบ'],
      ['รวม', null, null, null, null, 3000, 0, 2000, 0, 5000, 1000, 4000, null, null, null],
    ]

    const result = parseProjectImportMatrix(matrix, {
      fiscalYear: 2571,
      sheetName: 'ทะเบียนคุมโครงการ (Data)',
    })

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].data).toMatchObject({
      fiscalYear: 2571,
      sequenceNo: 1,
      projectCode: '080101',
      strategy: 'ย.1',
      projectName: 'โครงการทดสอบ 1',
      q1Budget: 3000,
      q3Budget: 2000,
      actualSpent: 1000,
      submissionStatus: 'ส่งแล้ว',
      budgetSource: 'เงินบำรุง',
    })
    expect(result.rows[1].data.budgetSource).toBe('ไม่ใช้งบประมาณ')
  })
})

describe('ProjectTrackerService', () => {
  it('ensures schema via Gateway V2, does not auto-seed hardcoded records, and derives filter options from DB rows', async () => {
    const sampleRow = seedToRecord(0)
    const ensureProjectsSchemaV2 = vi.fn().mockResolvedValue({ ensured: true })
    const getProjectsBundleV2 = vi.fn().mockResolvedValue({
      targetFiscalYear: 2570,
      fyRows: [{ fiscalYear: 2570 }],
      allYearRows: [sampleRow],
    })
    const createProjectV2 = vi.fn().mockResolvedValue({
      ...sampleRow,
      id: 99,
      sequenceNo: 2,
      projectName: 'โครงการใหม่',
    })

    const service = new ProjectTrackerService({
      ensureProjectsSchemaV2,
      getProjectsBundleV2,
      createProjectV2,
    })
    const listResult = await service.listProjects({ fiscalYear: 2570 })

    expect(ensureProjectsSchemaV2).toHaveBeenCalledTimes(1)
    expect(getProjectsBundleV2).toHaveBeenCalledWith(2570)
    expect(listResult.items).toHaveLength(1)
    expect(listResult.items[0].allocatedBudget).toBe(26500)
    expect(listResult.availableFiscalYears).toEqual([2570])
    expect(listResult.availableStrategies).toEqual(['ย.1'])
    expect(listResult.availableStatuses).toEqual(['ส่งแล้ว'])
    expect(listResult.availableBudgetSources).toEqual(['เงินบำรุง'])

    const created = await service.createProject(
      {
        fiscalYear: 2570,
        strategy: 'ย.1',
        projectName: 'โครงการใหม่',
        q1Budget: 1000,
      },
      { username: 'tester', email: 'tester@thoen.local' }
    )
    expect(created.id).toBe(99)
    expect(createProjectV2).toHaveBeenCalledWith(
      expect.objectContaining({ fiscalYear: 2570, projectName: 'โครงการใหม่', q1Budget: 1000 }),
      'tester'
    )
  })

  it('delegates batchImportProjects to Gateway V2 in replace mode and preserves total count', async () => {
    const ensureProjectsSchemaV2 = vi.fn().mockResolvedValue({ ensured: true })
    const batchImportProjectsV2 = vi.fn().mockResolvedValue({
      inserted: 150,
      deletedCount: 12,
      fiscalYear: 2571,
    })

    const rows = Array.from({ length: 150 }, (_, idx) => ({
      fiscalYear: 2571,
      strategy: 'ย.1',
      projectName: `โครงการนำเข้า ${idx + 1}`,
      q1Budget: 1000,
    }))

    const service = new ProjectTrackerService({
      ensureProjectsSchemaV2,
      batchImportProjectsV2,
    })
    const res = await service.batchImportProjects(2571, rows, 'replace', {
      username: 'importer',
      email: 'importer@thoen.local',
    })

    expect(res).toEqual({
      inserted: 150,
      updated: 0,
      totalProcessed: 150,
      fiscalYear: 2571,
    })

    expect(ensureProjectsSchemaV2).toHaveBeenCalledTimes(1)
    expect(batchImportProjectsV2).toHaveBeenCalledWith(
      expect.objectContaining({
        fiscalYear: 2571,
        mode: 'replace',
        actorKey: 'importer',
      })
    )
    expect(batchImportProjectsV2.mock.calls[0][0].rows).toHaveLength(150)
  })
})
