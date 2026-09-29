import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateTaskNo, generateSignatureStampHash, REGISTERED_TASK_TYPES } from '../taskInboxService'
import * as memberDb from '../memberDb'

vi.mock('../memberDb', () => ({
  queryMemberDb: vi.fn(),
}))

vi.mock('../telegramService', () => ({
  sendTelegramMessage: vi.fn(),
}))

vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('taskInboxService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('correctly registers default task types', () => {
    expect(REGISTERED_TASK_TYPES.IT_REPAIR).toBeDefined()
    expect(REGISTERED_TASK_TYPES.ROOM_BOOKING).toBeDefined()
    expect(REGISTERED_TASK_TYPES.DOC_APPROVAL).toBeDefined()
    expect(REGISTERED_TASK_TYPES.IT_REPAIR.titlePrefix).toBe('IT')
  })

  it('generates running task number with Thai year and prefix', async () => {
    vi.mocked(memberDb.queryMemberDb).mockResolvedValueOnce([{ cnt: 2 }])

    const taskNo = await generateTaskNo('IT_REPAIR')
    expect(taskNo).toMatch(/^IT-\d{6}-0003$/)
  })

  it('generates consistent cryptographic HMAC hash for e-signatures', () => {
    const hash1 = generateSignatureStampHash({
      taskId: 'test-task-1',
      stepNo: 1,
      signerId: 101,
      timestamp: '2026-09-28T14:00:00Z',
    })

    const hash2 = generateSignatureStampHash({
      taskId: 'test-task-1',
      stepNo: 1,
      signerId: 101,
      timestamp: '2026-09-28T14:00:00Z',
    })

    const hashDifferent = generateSignatureStampHash({
      taskId: 'test-task-1',
      stepNo: 2,
      signerId: 101,
      timestamp: '2026-09-28T14:00:00Z',
    })

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hashDifferent)
    expect(hash1.length).toBe(64)
  })
})
