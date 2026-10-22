import { describe, it, expect, vi } from 'vitest'
import { OutpatientDrugService } from '../outpatientDrugService'

describe('OutpatientDrugService', () => {
  it('fetches drug queue items and masks patient names per PDPA', async () => {
    const mockDb = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('st.service6 IS NULL AND st.service7 IS NOT NULL')) {
        return Promise.resolve([
          {
            hn: '0011223',
            ptname: 'นายสมชาย ใจดี',
            service_time: '10:30:00',
            timelast: '00:15:00',
            department: 'ห้องตรวจ 1',
          },
        ])
      }
      return Promise.resolve([
        {
          hn: '0099887',
          ptname: 'นางสาวสุดา สวยงาม',
          service_time: '10:45:00',
          timelast: '00:05:00',
        },
      ])
    })

    const service = new OutpatientDrugService(mockDb)
    const result = await service.getDrugDispenseQueue()

    expect(result.paidPatients.length).toBe(1)
    expect(result.paidPatients[0].hn).toBe('0011223')
    expect(result.paidPatients[0].ptname).toBe('นาย***') // Masked per PDPA
    expect(result.printedPatients.length).toBe(1)
    expect(result.printedPatients[0].hn).toBe('0099887')
    expect(result.printedPatients[0].ptname).toBe('นาง***') // Masked per PDPA
  })
})
