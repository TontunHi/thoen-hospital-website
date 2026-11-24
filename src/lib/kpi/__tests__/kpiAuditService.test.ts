import { describe, it, expect, vi } from 'vitest'
import { KpiAuditService, PhiViolationError } from '@/lib/kpi/kpiAuditService'
import type { KpiIndicatorItem } from '@/lib/kpi/kpiService'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('KpiAuditService', () => {
  it('upserts valid zero-PHI batch via Gateway V2 and returns saved/skipped counts', async () => {
    const upsertKpiAuditBatchV2 = vi.fn().mockResolvedValue({ savedCount: 1, skippedCount: 1 })

    const res = await KpiAuditService.upsertAuditBatch(
      {
        fiscalYear: '2570',
        periodKey: 'M01',
        actorName: 'thoen-kpi-auditor',
        items: [
          {
            indicatorId: 48,
            ruleCode: 'HR-NVD-0101',
            status: 'MISMATCH',
            humanNumerator: 2,
            humanDenominator: 12,
            humanResult: 16.67,
            aiNumerator: 3,
            aiDenominator: 15,
            aiResult: 20.0,
            diffNumerator: -1,
            diffDenominator: -3,
            diffResult: -3.33,
            thipManualRef: 'THIP 2026: HR-NVD-0101',
            explanationTh: 'พบเคส Admit เฉพาะกิจ นอน < 4 ชม. 2 ราย',
            diagnostics: {
              by_ward: [{ ward_name: '12 Admit เฉพาะกิจ', under_4h_cases: 2 }],
            },
          },
          {
            indicatorId: 999,
            ruleCode: 'HR-UNKNOWN',
            status: 'UNCONFIGURED_RULE',
          },
        ],
      },
      { upsertKpiAuditBatchV2 }
    )

    expect(res).toEqual({ savedCount: 1, skippedCount: 1 })
    expect(upsertKpiAuditBatchV2).toHaveBeenCalledTimes(1)
    expect(upsertKpiAuditBatchV2.mock.calls[0][0]).toMatchObject({
      fiscalYear: '2570',
      periodKey: 'M01',
    })
  })

  it('rejects PHI columns and 13-digit CIDs before calling Gateway', async () => {
    const upsertKpiAuditBatchV2 = vi.fn().mockResolvedValue({ savedCount: 0, skippedCount: 0 })

    await expect(
      KpiAuditService.upsertAuditBatch(
        {
          fiscalYear: '2570',
          periodKey: 'M01',
          items: [
            {
              indicatorId: 48,
              ruleCode: 'HR-NVD-0101',
              status: 'MISMATCH',
              diagnostics: {
                bad: [{ hn: '000123456', total: 1 }],
              },
            },
          ],
        },
        { upsertKpiAuditBatchV2 }
      )
    ).rejects.toThrow(PhiViolationError)

    await expect(
      KpiAuditService.upsertAuditBatch(
        {
          fiscalYear: '2570',
          periodKey: 'M01',
          items: [
            {
              indicatorId: 48,
              ruleCode: 'HR-NVD-0101',
              status: 'MISMATCH',
              explanationTh: 'เลขบัตร 1520800012345 หลุด',
            },
          ],
        },
        { upsertKpiAuditBatchV2 }
      )
    ).rejects.toThrow(PhiViolationError)

    expect(upsertKpiAuditBatchV2).not.toHaveBeenCalled()
  })

  it('returns empty array cleanly when table does not exist yet', async () => {
    const getKpiAuditsByTopicV2 = vi.fn(async () => {
      throw new Error("Table 'thoen.kpi_ai_audits' doesn't exist")
    })
    const rows = await KpiAuditService.getAuditsByTopic(
      { topicId: 1, fiscalYear: '2570' },
      { getKpiAuditsByTopicV2 }
    )
    expect(rows).toEqual([])
  })

  it('attaches matching period aiAudit and aiAudits onto indicators', () => {
    const indicators: KpiIndicatorItem[] = [
      {
        id: 48,
        topicId: 1,
        sequence: '1',
        category: 'หมวด 1',
        subcategory: null,
        code: 'HR-NVD-0101',
        oldCode: null,
        frequency: 'รายเดือน',
        title: 'Stroke Mortality',
        numeratorName: 'ตาย',
        denominatorName: 'ทั้งหมด',
        targetRaw: '<= 10%',
        targetOperator: '<=',
        targetValue: 10,
        targetUnit: '%',
        responsibleName: 'ศัลย์/อายุรกรรม',
        indicatorType: 'THIP',
        displayOrder: 1,
        currentEntry: {
          id: 10,
          indicatorId: 48,
          fiscalYear: '2570',
          periodKey: 'M01',
          periodLabel: 'ตุลาคม 2569',
          numeratorValue: 2,
          denominatorValue: 12,
          resultValue: 16.67,
          resultText: null,
          status: 'FAIL',
          note: null,
          recordedById: 1,
          recordedByName: 'tester',
          recordedAt: null,
          updatedAt: null,
        },
      },
    ]

    const enriched = KpiAuditService.attachAuditsToIndicators(indicators, [
      {
        id: 1,
        indicatorId: 48,
        fiscalYear: '2570',
        periodKey: 'M01',
        ruleCode: 'HR-NVD-0101',
        status: 'MISMATCH',
        humanNumerator: 2,
        humanDenominator: 12,
        humanResult: 16.67,
        aiNumerator: 3,
        aiDenominator: 15,
        aiResult: 20,
        diffNumerator: -1,
        diffDenominator: -3,
        diffResult: -3.33,
        thipManualRef: 'THIP 2026',
        explanationTh: 'คลาดเคลื่อน 3 ราย',
        diagnostics: {},
        auditedAt: '2026-11-20 14:50:00',
        updatedAt: '2026-11-20 14:50:00',
      },
    ])

    expect(enriched[0].aiAudit?.ruleCode).toBe('HR-NVD-0101')
    expect(enriched[0].aiAudit?.aiResult).toBe(20)
    expect(enriched[0].aiAudits).toHaveLength(1)
  })
})
