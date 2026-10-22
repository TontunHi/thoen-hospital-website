import { describe, it, expect, vi } from 'vitest'
import { SalaryLedgerService } from '../salaryLedgerService'

describe('SalaryLedgerService', () => {
  it('returns notFound when no member and no salary records exist', async () => {
    const mockMemberDb = vi.fn().mockResolvedValue([])
    const mockSalaryDb = vi.fn().mockResolvedValue([])
    const mockSalaryEditDb = vi.fn().mockResolvedValue([])

    const service = new SalaryLedgerService(mockMemberDb, mockSalaryDb, mockSalaryEditDb)
    const result = await service.getEmployeeSalaryLedger({ targetUsername: 'unknown_user' })

    expect(result.success).toBe(false)
    expect(result.notFound).toBe(true)
    expect(result.error).toMatch(/ไม่พบข้อมูลเงินเดือน/)
  })

  it('aggregates salary and OT periods and selects target period', async () => {
    const mockMemberDb = vi.fn().mockResolvedValue([
      { id: 5, username: '1529900123456', name: 'นายแพทย์ทดสอบ', department: 'กลุ่มงานการแพทย์', position: 'นายแพทย์ชำนาญการ', salary_user: '1529900123456' },
    ])
    const mockSalaryDb = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM salary')) {
        return Promise.resolve([
          { id: 1, c1: '2026-10-25', c2: '1529900123456', c4: 'นายแพทย์ทดสอบ', c8: 'ตุลาคม 2569', c5: 50000 },
        ])
      }
      if (sql.includes('FROM ot')) {
        return Promise.resolve([
          { id: 2, c1: '2026-10-25', c2: '1529900123456', c4: 'นายแพทย์ทดสอบ', c10: 'ตุลาคม', c6: 12000 },
        ])
      }
      return Promise.resolve([])
    })
    const mockSalaryEditDb = vi.fn().mockResolvedValue([])

    const service = new SalaryLedgerService(mockMemberDb, mockSalaryDb, mockSalaryEditDb)
    const result = await service.getEmployeeSalaryLedger({ targetUsername: '1529900123456' })

    expect(result.success).toBe(true)
    expect(result.member?.name).toBe('นายแพทย์ทดสอบ')
    expect(result.years).toContain('2569')
    expect(result.periods).toContain('ตุลาคม 2569')
    expect(result.salary?.c5).toBe(50000)
    expect(result.ot?.c6).toBe(12000)
  })
})
