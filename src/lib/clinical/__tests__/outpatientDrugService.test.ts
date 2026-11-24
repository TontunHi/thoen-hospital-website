import { describe, it, expect, vi } from 'vitest'
import { OutpatientDrugService } from '../outpatientDrugService'

describe('OutpatientDrugService', () => {
  it('fetches drug queue items via Gateway Named API and masks patient names per PDPA', async () => {
    const getDrugDispenseStatus = vi.fn().mockResolvedValue({
      paid: [
        {
          hn: '0011223',
          ptname: 'นายสมชาย ใจดี',
          service_time: '10:30:00',
          timelast: '00:15:00',
          department: 'ห้องตรวจ 1',
        },
      ],
      printed: [
        {
          hn: '0099887',
          ptname: 'นางสาวสุดา สวยงาม',
          service_time: '10:45:00',
          timelast: '00:05:00',
        },
      ],
      updatedAt: '2026-11-24T10:45:00.000Z',
    })

    const service = new OutpatientDrugService({ getDrugDispenseStatus })
    const result = await service.getDrugDispenseQueue()

    expect(getDrugDispenseStatus).toHaveBeenCalledTimes(1)
    expect(result.paidPatients.length).toBe(1)
    expect(result.paidPatients[0].hn).toBe('0011223')
    expect(result.paidPatients[0].ptname).toBe('นาย***') // Masked per PDPA
    expect(result.printedPatients.length).toBe(1)
    expect(result.printedPatients[0].hn).toBe('0099887')
    expect(result.printedPatients[0].ptname).toBe('นาง***') // Masked per PDPA
  })
})
