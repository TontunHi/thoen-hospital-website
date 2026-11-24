import { apiGateway } from '@/lib/apiGateway'
import { getCachedData } from '@/lib/cache'
import {
  type InvoiceSummaryResult,
  type InvoiceSummaryItem,
  type InvoiceDetailResult,
  type InvoiceDetailItem,
  resolveFiscalDateRange,
} from './typesAndHelpers'

export interface InvoiceReportsGatewayAdapter {
  getRcmInvoiceSummary: typeof apiGateway.clinical.getRcmInvoiceSummary
  getRcmInvoiceDetails: typeof apiGateway.clinical.getRcmInvoiceDetails
}

const defaultInvoiceGateway: InvoiceReportsGatewayAdapter = {
  getRcmInvoiceSummary: (params) => apiGateway.clinical.getRcmInvoiceSummary(params),
  getRcmInvoiceDetails: (params) => apiGateway.clinical.getRcmInvoiceDetails(params),
}

/**
 * 5.2.2.1 รายงานสรุปรายรับจาก Invoice (e-Claim Reconciliation Summary)
 */
export async function getInvoiceSummary(
  params: {
    department?: 'OP' | 'IP'
    ds1?: string
    ds2?: string
    dateType?: 'bill_date' | 'admdate'
  } = {},
  gateway: Partial<InvoiceReportsGatewayAdapter> = defaultInvoiceGateway
): Promise<InvoiceSummaryResult> {
  const department = params.department === 'IP' ? 'IP' : 'OP'
  const dateType = params.dateType === 'admdate' ? 'admdate' : 'bill_date'
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const cacheKey = `rcm-invoice-summary-${department}-${dateType}-${ds1}-${ds2}`
  const gw: InvoiceReportsGatewayAdapter = { ...defaultInvoiceGateway, ...gateway }

  return getCachedData(
    cacheKey,
    async () => {
      const gwRes = await gw.getRcmInvoiceSummary({
        department,
        startDate: ds1,
        endDate: ds2,
        dateType,
      })

      const rawItems = (gwRes?.items || []).filter((r) => Number(r.visit || 0) > 0)
      const items: InvoiceSummaryItem[] = rawItems.map((r) => ({
        code: String(r.code || ''),
        name: String(r.name || ''),
        visit: Number(r.visit || 0),
        receipt: Math.round(Number(r.receipt || 0) * 100) / 100,
        compensated: Math.round(Number(r.compensated || 0) * 100) / 100,
        down: Math.round(Number(r.down || 0) * 100) / 100,
        up: Math.round(Number(r.up || 0) * 100) / 100,
        debit: Math.round(Number(r.debit || 0) * 100) / 100,
      }))

      const grandTotal = gwRes?.grandTotal || {
        visit: items.reduce((s, x) => s + x.visit, 0),
        receipt: Math.round(items.reduce((s, x) => s + x.receipt, 0) * 100) / 100,
        compensated: Math.round(items.reduce((s, x) => s + x.compensated, 0) * 100) / 100,
        down: Math.round(items.reduce((s, x) => s + x.down, 0) * 100) / 100,
        up: Math.round(items.reduce((s, x) => s + x.up, 0) * 100) / 100,
        debit: Math.round(items.reduce((s, x) => s + x.debit, 0) * 100) / 100,
      }

      return {
        department,
        ds1,
        ds2,
        dateType,
        items,
        grandTotal,
      }
    },
    60_000 * 3
  )
}

/**
 * 5.2.2.1 รายชื่อผู้ป่วยและรายละเอียดการชดเชย Invoice (Drill-down Patient List)
 */
export async function getInvoiceDetails(
  params: {
    department?: 'OP' | 'IP'
    ds1?: string
    ds2?: string
    pttype?: string
    search?: string
    page?: number
    pageSize?: number
    exportAll?: boolean
    dateType?: 'bill_date' | 'admdate'
  } = {},
  gateway: Partial<InvoiceReportsGatewayAdapter> = defaultInvoiceGateway
): Promise<InvoiceDetailResult> {
  const department = params.department === 'IP' ? 'IP' : 'OP'
  const dateType = params.dateType === 'admdate' ? 'admdate' : 'bill_date'
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const pttype = (params.pttype || '').trim()
  const search = (params.search || '').trim()
  const page = Math.max(1, Number(params.page || 1))
  const pageSize = params.exportAll ? 1000000 : Math.max(1, Number(params.pageSize || 50))
  const gw: InvoiceReportsGatewayAdapter = { ...defaultInvoiceGateway, ...gateway }

  const gwRes = await gw.getRcmInvoiceDetails({
    department,
    startDate: ds1,
    endDate: ds2,
    pttype: pttype || undefined,
    search: search || undefined,
    page,
    pageSize,
    exportAll: params.exportAll,
    dateType,
  })

  return {
    department,
    ds1,
    ds2,
    dateType,
    pttype: pttype || undefined,
    items: (gwRes?.items || []) as InvoiceDetailItem[],
    totalCount: Number(gwRes?.totalCount || 0),
    totalPages: Number(gwRes?.totalPages || 1),
    page: Number(gwRes?.page || page),
    pageSize: Number(gwRes?.pageSize || pageSize),
    filteredSummary: gwRes?.filteredSummary,
  }
}
