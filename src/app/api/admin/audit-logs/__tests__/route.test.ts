import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getAuditLogs } from '../route'
import { GET as exportAuditLogs } from '../export/route'

const mockListAuditLogsAdmin = vi.fn()
const mockExportAuditLogsAdminRaw = vi.fn()
const mockRequireMemberAdmin = vi.fn()

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      listAuditLogsAdmin: (...args: unknown[]) => mockListAuditLogsAdmin(...args),
      exportAuditLogsAdminRaw: (...args: unknown[]) => mockExportAuditLogsAdminRaw(...args),
    },
  },
}))

vi.mock('@/lib/memberAuth', () => ({
  requireMemberAdmin: () => mockRequireMemberAdmin(),
}))

describe('Admin Audit Logs API & Export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireMemberAdmin.mockResolvedValue({
      session: { username: 'admin', email: 'admin@hospital.go.th', role: 'admin' },
    })
  })

  it('masks citizen IDs and sensitive action details in returned JSON logs', async () => {
    mockListAuditLogsAdmin.mockResolvedValueOnce({
      total: 1,
      logs: [
        {
          id: 1,
          timestamp: '2026-10-31 10:00:00',
          username: '1234567890123',
          email: 'user@hospital.go.th',
          action_type: 'LOGIN',
          target_table: 'username',
          action_details: 'User 1234567890123 logged in to Salary portal manually (HN: 0012345)',
          ip_address: '192.168.1.100',
          user_agent: 'Chrome',
        },
      ],
    })

    const req = new Request('http://localhost/api/admin/audit-logs?page=1&limit=25')
    const res = await getAuditLogs(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.logs).toHaveLength(1)

    expect(json.logs[0].username).toBe('x-xxxx-xxxxx-01-23')
    expect(json.logs[0].action_details).toBe(
      'User x-xxxx-xxxxx-01-23 logged in to Salary portal manually (HN: xxxx2345)'
    )
  })

  it('masks citizen IDs and sensitive details in CSV export', async () => {
    mockExportAuditLogsAdminRaw.mockResolvedValueOnce([
      {
        id: 2,
        timestamp: '2026-10-31 11:00:00',
        username: '1234567890123',
        email: 'user@hospital.go.th',
        action_type: 'READ',
        target_table: 'patient_lab',
        action_details: 'พิมพ์เวชระเบียน HN: 0012345 (VN: 660101123456)',
        ip_address: '192.168.1.100',
        user_agent: 'Chrome',
      },
    ])

    const req = new Request('http://localhost/api/admin/audit-logs/export')
    const res = await exportAuditLogs(req)
    expect(res.status).toBe(200)

    const csv = await res.text()
    expect(csv).toContain('x-xxxx-xxxxx-01-23')
    expect(csv).toContain('พิมพ์เวชระเบียน HN: xxxx2345 (VN: 660101123456)')
    expect(csv).not.toContain('1234567890123')
    expect(csv).not.toContain('HN: 0012345')
  })

  it('searches by both raw and masked citizen ID when search query is a 13-digit CID', async () => {
    mockListAuditLogsAdmin.mockResolvedValueOnce({ total: 0, logs: [] })

    const req = new Request('http://localhost/api/admin/audit-logs?search=1234567890123')
    await getAuditLogs(req)

    expect(mockListAuditLogsAdmin).toHaveBeenCalledTimes(1)
    expect(mockListAuditLogsAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        search: '1234567890123',
        maskedSearch: 'x-xxxx-xxxxx-01-23',
      })
    )
  })
})
