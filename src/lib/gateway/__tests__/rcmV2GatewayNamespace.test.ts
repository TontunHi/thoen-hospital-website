import { describe, expect, it, vi } from 'vitest'
import { createApiGatewayClient } from '@/lib/apiGateway'

describe('rcmV2GatewayNamespace envelope preservation with ApiGatewayClient', () => {
  const createMockClient = (payload: unknown) => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch

    return createApiGatewayClient({
      baseUrl: 'http://gateway.local',
      apiKey: 'test-key',
      fetchFn,
    })
  }

  it('preserves { success, data } envelope for Seamless V2 stats, ledger, files, denyCodes, and budget', async () => {
    const statsClient = createMockClient({
      success: true,
      data: { totalRows: 155886, totalReps: 120, totalFiles: 295 },
    })
    const stats = await statsClient.clinical.getSeamlessStats('11152')
    expect(stats.success).toBe(true)
    expect(stats.data.totalRows).toBe(155886)

    const ledgerClient = createMockClient({
      success: true,
      data: { itemRows: [{ id: 'TX-1' }], totalCount: 1, totalPages: 1, availableFunds: ['DDSA'] },
    })
    const ledger = await ledgerClient.clinical.getSeamlessLedger({ page: 1, pageSize: 50 })
    expect(ledger.success).toBe(true)
    expect(ledger.data.itemRows).toHaveLength(1)

    const filesClient = createMockClient({
      success: true,
      data: [{ fileName: 'test.xlsx', rowCount: 10 }],
    })
    const files = await filesClient.clinical.getSeamlessFiles('11152')
    expect(files.success).toBe(true)
    expect(files.data).toHaveLength(1)

    const denyClient = createMockClient({
      success: true,
      data: [{ Code: 'E01', Name: 'Test' }],
    })
    const denyCodes = await denyClient.clinical.getSeamlessDenyCodes()
    expect(denyCodes.success).toBe(true)
    expect(denyCodes.data).toHaveLength(1)

    const nullBudgetClient = createMockClient({ success: true, data: null })
    const budget = await nullBudgetClient.clinical.lookupSeamlessBudget('PAY-1')
    expect(budget).toEqual({ success: true, data: null })
  })

  it('preserves { success, data } envelope for T1DM V2 raw-registries and enrich-import', async () => {
    const rawClient = createMockClient({
      success: true,
      data: { clinicalRows: [{ id: '1' }], mirrorRows: [] },
    })
    const raw = await rawClient.clinical.getT1dmRawRegistries()
    expect(raw.success).toBe(true)
    expect(raw.data.clinicalRows).toHaveLength(1)

    const enrichClient = createMockClient({
      success: true,
      data: { patients: [{ cid: '1', hn: '001', ptname: 'Test' }], hospNames: [], existingFileRowCount: 2 },
    })
    const enrich = await enrichClient.clinical.enrichT1dmImport({
      cids: ['1'],
      hospCodes: ['11152'],
      fileName: 't1dm.xlsx',
    })
    expect(enrich.success).toBe(true)
    expect(enrich.data.patients).toHaveLength(1)
    expect(enrich.data.existingFileRowCount).toBe(2)
  })

  it('preserves { success, data } envelope for getAvailableAdpCodes and getAnClinicalDetails', async () => {
    const adpClient = createMockClient({
      success: true,
      data: [{ code: '1B004N', title: 'CCS', mappedCount: 2 }],
    })
    const adp = await adpClient.clinical.getAvailableAdpCodes()
    expect(adp.success).toBe(true)
    expect(adp.data).toHaveLength(1)

    const anClient = createMockClient({
      success: true,
      data: { header: { an: '690001' }, diagnoses: [], procedures: [], orders: [] },
    })
    const an = await anClient.clinical.getAnClinicalDetails('690001')
    expect(an.success).toBe(true)
    expect(an.data?.header.an).toBe('690001')
  })
})
