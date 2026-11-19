import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const verifyMemberSessionMock = vi.fn()
const getIpdDoctorChartSummaryMock = vi.fn()
const formatTelegramChartSummaryMock = vi.fn()
const sendTelegramMessageMock = vi.fn()
const logThrottledAuditMock = vi.fn()

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: () => verifyMemberSessionMock(),
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getIpdDoctorChartSummary: (...args: unknown[]) => getIpdDoctorChartSummaryMock(...args),
    formatTelegramChartSummary: (...args: unknown[]) => formatTelegramChartSummaryMock(...args),
  },
}))

vi.mock('@/lib/telegramService', () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMessageMock(...args),
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: (...args: unknown[]) => logThrottledAuditMock(...args),
}))

import { POST } from '../route'

describe('POST /api/service/dashboard-rcm/telegram-notify', () => {
  const originalEnable = process.env.ENABLE_IPD_CHART_NOTIFY
  const originalChatId = process.env.TELEGRAM_IPD_CHAT_ID

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ENABLE_IPD_CHART_NOTIFY
    process.env.TELEGRAM_IPD_CHAT_ID = '-100123456'
    logThrottledAuditMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    if (originalEnable === undefined) {
      delete process.env.ENABLE_IPD_CHART_NOTIFY
    } else {
      process.env.ENABLE_IPD_CHART_NOTIFY = originalEnable
    }
    if (originalChatId === undefined) {
      delete process.env.TELEGRAM_IPD_CHAT_ID
    } else {
      process.env.TELEGRAM_IPD_CHAT_ID = originalChatId
    }
  })

  it('returns 401 when unauthenticated', async () => {
    verifyMemberSessionMock.mockResolvedValue(null)
    const res = await POST()
    expect(res.status).toBe(401)
    expect(sendTelegramMessageMock).not.toHaveBeenCalled()
  })

  it('returns 403 for unauthorized role', async () => {
    verifyMemberSessionMock.mockResolvedValue({ role: 'subdistrict', username: 'pcu1' })
    const res = await POST()
    expect(res.status).toBe(403)
    expect(sendTelegramMessageMock).not.toHaveBeenCalled()
  })

  it('returns 503 and skips HOSxP/Telegram when IPD chart notification is disabled (default)', async () => {
    verifyMemberSessionMock.mockResolvedValue({ role: 'admin', username: 'admin' })
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.success).toBe(false)
    expect(body.error).toContain('ปิดใช้งาน')
    expect(getIpdDoctorChartSummaryMock).not.toHaveBeenCalled()
    expect(sendTelegramMessageMock).not.toHaveBeenCalled()
  })

  it('sends notification when explicitly enabled via ENABLE_IPD_CHART_NOTIFY=true', async () => {
    process.env.ENABLE_IPD_CHART_NOTIFY = 'true'
    verifyMemberSessionMock.mockResolvedValue({ role: 'admin', username: 'admin', email: 'a@b.c' })
    getIpdDoctorChartSummaryMock.mockResolvedValue({ doctors: [], grandTotal: {} })
    formatTelegramChartSummaryMock.mockReturnValue('<b>Summary</b>')
    sendTelegramMessageMock.mockResolvedValue({ success: true })

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(getIpdDoctorChartSummaryMock).toHaveBeenCalledTimes(1)
    expect(sendTelegramMessageMock).toHaveBeenCalledWith('-100123456', '<b>Summary</b>', 'HTML')
  })
})
