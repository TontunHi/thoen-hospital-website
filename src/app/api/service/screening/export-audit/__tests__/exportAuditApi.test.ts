import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as exportAuditHandler } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import * as audit from '@/lib/audit'
import { NextRequest } from 'next/server'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

describe('POST /api/service/screening/export-audit', () => {
  const mockMember = {
    id: 1,
    username: 'nurse_sopha',
    email: 'sopha@thoenhospital.com',
    role: 'staff',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      error: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
      }) as any,
    })

    const req = new NextRequest('http://localhost:3000/api/service/screening/export-audit', {
      method: 'POST',
      body: JSON.stringify({ count: 10, dateFilter: 'today', statusFilter: 'ALL' }),
    })

    const res = await exportAuditHandler(req)
    expect(res.status).toBe(401)
    expect(audit.logAudit).not.toHaveBeenCalled()
  })

  it('records logAudit with metadata and returns success 200', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: mockMember as any,
    })

    const req = new NextRequest('http://localhost:3000/api/service/screening/export-audit', {
      method: 'POST',
      body: JSON.stringify({
        count: 25,
        dateFilter: '2026-10-22',
        statusFilter: 'VISIT_OPENED',
        searchApplied: true,
      }),
    })

    const res = await exportAuditHandler(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(audit.logAudit).toHaveBeenCalledWith(
      'READ',
      'screening_queue',
      'Export screening queue to Excel (count: 25, date: 2026-10-22, status: VISIT_OPENED, search: true)',
      { username: 'nurse_sopha', email: 'sopha@thoenhospital.com' }
    )
  })

  it('handles empty or default body gracefully', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: mockMember as any,
    })

    const req = new NextRequest('http://localhost:3000/api/service/screening/export-audit', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const res = await exportAuditHandler(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(audit.logAudit).toHaveBeenCalledWith(
      'READ',
      'screening_queue',
      expect.stringContaining('count: 0'),
      { username: 'nurse_sopha', email: 'sopha@thoenhospital.com' }
    )
  })
})
