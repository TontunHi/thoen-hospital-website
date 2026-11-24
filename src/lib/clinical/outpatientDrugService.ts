import { apiGateway } from '@/lib/apiGateway'
import { maskPatientName } from '@/lib/clinical/ipdWardService'

export interface OutpatientDrugQueueItem {
  hn: string
  ptname: string
  service_time: string
  timelast: string
  department?: string
}

export interface OutpatientDrugQueueResult {
  paidPatients: OutpatientDrugQueueItem[]
  printedPatients: OutpatientDrugQueueItem[]
  updatedAt: string
}

export interface OutpatientDrugGatewayAdapter {
  getDrugDispenseStatus: typeof apiGateway.clinical.getDrugDispenseStatus
}

const defaultGateway: OutpatientDrugGatewayAdapter = {
  getDrugDispenseStatus: () => apiGateway.clinical.getDrugDispenseStatus(),
}

export class OutpatientDrugService {
  private readonly gateway: OutpatientDrugGatewayAdapter

  constructor(gateway: OutpatientDrugGatewayAdapter = defaultGateway) {
    this.gateway = gateway
  }

  async getDrugDispenseQueue(): Promise<OutpatientDrugQueueResult> {
    const maskItems = (list: Array<Record<string, unknown>>): OutpatientDrugQueueItem[] =>
      (list || []).map((row) => ({
        hn: String(row.hn || ''),
        ptname: maskPatientName(String(row.ptname || '')),
        service_time: String(row.service_time || ''),
        timelast: String(row.timelast || ''),
        ...(row.department ? { department: String(row.department) } : {}),
      }))

    const gwRes = await this.gateway.getDrugDispenseStatus()
    return {
      paidPatients: maskItems(gwRes?.paid || []),
      printedPatients: maskItems(gwRes?.printed || []),
      updatedAt: gwRes?.updatedAt || new Date().toISOString(),
    }
  }
}

export const outpatientDrugService = new OutpatientDrugService()
