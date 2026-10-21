import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from '../route'
import { SmtBudgetService } from '@/lib/budget/smtBudgetService'
import * as memberAuth from '@/lib/memberAuth'
import * as audit from '@/lib/audit'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/budget/smtBudgetService', () => ({
  SmtBudgetService: {
    searchBudget: vi.fn(),
  },
}))

describe('SMT Budget API Route (/api/budget/smt)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/budget/smt', {
      method: 'POST',
      body: JSON.stringify({ budgetYears: ['2570'] }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('handles authenticated POST requests successfully', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      id: 1,
      username: 'doctor1',
      name: 'Dr. Test',
      role: 'staff',
    } as any)

    const mockResult = {
      source: 'upstream',
      fetchedAt: Date.now(),
      summary: {
        recordCount: 1,
        totalAmount: 50000,
        totalNetPayment: 48000,
        totalWait: 2000,
        totalDebt: 0,
        totalVat: 0,
        totalBond: 0,
        totalOdbt: 0,
      },
      datas: [{ amount: 50000, total: 48000 }],
    }
    vi.mocked(SmtBudgetService.searchBudget).mockResolvedValue(mockResult as any)

    const req = new Request('http://localhost:3000/api/budget/smt', {
      method: 'POST',
      body: JSON.stringify({ budgetYears: ['2570'], vendorId5Digit: '11152' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.summary.totalAmount).toBe(50000)
    expect(audit.logAudit).toHaveBeenCalledTimes(1)
  })

  it('handles authenticated GET requests successfully', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      id: 1,
      username: 'doctor1',
      name: 'Dr. Test',
      role: 'staff',
    } as any)

    vi.mocked(SmtBudgetService.searchBudget).mockResolvedValue({
      source: 'cache',
      fetchedAt: Date.now(),
      summary: { recordCount: 0 } as any,
      datas: [],
    })

    const req = new Request('http://localhost:3000/api/budget/smt?years=2570,2569&vendorId=11152')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(SmtBudgetService.searchBudget).toHaveBeenCalledWith({
      budgetYears: ['2570', '2569'],
      vendorId5Digit: '11152',
      forceRefresh: false,
    })
  })
})
