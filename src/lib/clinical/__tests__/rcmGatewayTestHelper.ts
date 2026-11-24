import { vi } from 'vitest'
import type { RcmFundGatewayAdapter } from '../rcmFundGatewayHelper'

export function createMockRcmFundGateway(options?: {
  adpItems?: Array<{ icode: string; name: string; strength?: string | null; nhso_adp_code: string }>
  rawRows?: Array<Record<string, any>>
  adpCode?: string
  fundKey?: string
}): RcmFundGatewayAdapter {
  const adpItems = options?.adpItems ?? [
    { icode: '3000001', name: 'Mock ADP Item', strength: null, nhso_adp_code: options?.adpCode || 'ADP' },
  ]
  const rawRows = options?.rawRows ?? []
  return {
    getAdpMapping: vi.fn().mockResolvedValue({
      success: true,
      adpCode: options?.adpCode || adpItems[0]?.nhso_adp_code || 'ADP',
      isMapped: adpItems.length > 0,
      mappedCount: adpItems.length,
      items: adpItems,
    }),
    getRcmFundData: vi.fn().mockResolvedValue({
      success: true,
      fundKey: options?.fundKey || 'mock-fund',
      data: { rawRows },
      rawRows,
    }),
  }
}
