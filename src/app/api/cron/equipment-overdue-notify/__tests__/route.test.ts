import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDispatchOverdueNotifications = vi.fn()

vi.mock('@/lib/equipment/equipmentBorrowService', () => ({
  equipmentBorrowService: {
    dispatchOverdueNotifications: (...args: any[]) => mockDispatchOverdueNotifications(...args),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('Equipment Overdue Notification Cron API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('rejects unauthorized request with 401 when CRON_SECRET is set and token is invalid', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret-123')

    const { POST } = await import('../route')
    const request = new Request('http://localhost:3000/api/cron/equipment-overdue-notify', {
      method: 'POST',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error).toContain('Unauthorized')
    expect(mockDispatchOverdueNotifications).not.toHaveBeenCalled()
  })

  it('executes notification dispatch and returns 200 with valid CRON_SECRET', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret-123')
    mockDispatchOverdueNotifications.mockResolvedValueOnce({
      success: true,
      totalOverdue: 2,
      sentCount: 2,
      skippedNoTelegramCount: 0,
      failedCount: 0,
      timestamp: '2026-10-19T15:00:00.000Z',
      details: [
        {
          requestId: 1,
          requestNo: 'BR-202610-0001',
          requesterId: 10,
          requesterName: 'นายทดสอบ',
          overdueDays: 1,
          expectedReturnDate: '2026-10-18',
          remainingItemsCount: 1,
          status: 'SENT',
        },
      ],
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost:3000/api/cron/equipment-overdue-notify', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-cron-secret-123',
      },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.sentCount).toBe(2)
    expect(mockDispatchOverdueNotifications).toHaveBeenCalledTimes(1)
  })

  it('handles service errors gracefully with 500 status', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret-123')
    mockDispatchOverdueNotifications.mockRejectedValueOnce(new Error('Database connection failed'))

    const { POST } = await import('../route')
    const request = new Request('http://localhost:3000/api/cron/equipment-overdue-notify', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-cron-secret-123',
      },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error).toContain('Database connection failed')
  })
})
