import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ScreeningQueueService,
  getBangkokDateRange,
  maskCid,
} from '../screeningService'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('ScreeningQueueService and Utilities', () => {
  let mockDb: any
  let service: ScreeningQueueService

  beforeEach(() => {
    vi.clearAllMocks()

    mockDb = {
      screeningQueue: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    }

    service = new ScreeningQueueService(mockDb)
  })

  describe('maskCid', () => {
    it('masks citizen ID showing only last 4 characters', () => {
      expect(maskCid('1529900123456')).toBe('x-xxxx-xxxxx-xx-3456')
      expect(maskCid('1234')).toBe('1234')
      expect(maskCid('')).toBe('')
    })
  })

  describe('getBangkokDateRange', () => {
    it('calculates start and end Date objects in UTC for a given Bangkok date', () => {
      const range = getBangkokDateRange('2026-10-14')
      expect(range.bangkokDateStr).toBe('2026-10-14')
      expect(range.start.toISOString()).toBe('2026-10-13T17:00:00.000Z')
      expect(range.end.toISOString()).toBe('2026-10-14T16:59:59.999Z')
    })

    it('defaults to today when date is omitted or "today"', () => {
      const range = getBangkokDateRange('today')
      expect(range.bangkokDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(range.start).toBeInstanceOf(Date)
      expect(range.end).toBeInstanceOf(Date)
    })

    it('throws error for invalid date format', () => {
      expect(() => getBangkokDateRange('invalid-date')).toThrow('รูปแบบวันที่ไม่ถูกต้อง')
    })
  })

  describe('getQueues', () => {
    it('queries queues with Bangkok date range and default filters', async () => {
      mockDb.screeningQueue.findMany.mockResolvedValue([
        {
          id: 1,
          cid: '1529900123456',
          fullName: 'นายทดสอบ ระบบ',
          status: 'WAITING',
          createdAt: new Date(),
        },
      ])

      const result = await service.getQueues({ date: '2026-10-14' })

      expect(mockDb.screeningQueue.findMany).toHaveBeenCalledTimes(1)
      const callArgs = mockDb.screeningQueue.findMany.mock.calls[0][0]
      expect(callArgs.where.createdAt).toBeDefined()
      expect(result.items.length).toBe(1)
      expect(result.date).toBe('2026-10-14')
    })

    it('applies search and status filters when specified', async () => {
      mockDb.screeningQueue.findMany.mockResolvedValue([])

      await service.getQueues({
        date: '2026-10-14',
        search: 'สมชาย',
        status: 'WAITING',
      })

      const callArgs = mockDb.screeningQueue.findMany.mock.calls[0][0]
      expect(callArgs.where.status).toBe('WAITING')
      expect(callArgs.where.OR).toBeDefined()
    })
  })

  describe('getQueueById', () => {
    it('returns queue record by id', async () => {
      const mockItem = { id: 10, cid: '1529900123456', fullName: 'นางสมศรี มีสุข' }
      mockDb.screeningQueue.findUnique.mockResolvedValue(mockItem)

      const res = await service.getQueueById(10)
      expect(res).toEqual(mockItem)
      expect(mockDb.screeningQueue.findUnique).toHaveBeenCalledWith({ where: { id: 10 } })
    })

    it('returns null for invalid id', async () => {
      const res = await service.getQueueById(NaN)
      expect(res).toBeNull()
    })
  })

  describe('addToQueue', () => {
    it('throws error if CID is not 13 digits', async () => {
      await expect(
        service.addToQueue({ cid: '12345' })
      ).rejects.toThrow('เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก')
    })

    it('creates new queue record if not queued today', async () => {
      mockDb.screeningQueue.findFirst.mockResolvedValue(null)
      mockDb.screeningQueue.create.mockResolvedValue({
        id: 1,
        cid: '1529900123456',
        fullName: 'นายสมศักดิ์ ทดสอบ',
        status: 'WAITING',
      })
      mockDb.screeningQueue.deleteMany.mockResolvedValue({ count: 0 })

      const item = await service.addToQueue({
        cid: '1-5299-00123-45-6',
        title: 'นาย',
        firstName: 'สมศักดิ์',
        lastName: 'ทดสอบ',
        gender: 'ชาย',
        birthDate: '2525-05-15',
        address: '123 ม.1 ต.ล้อมแรด',
        rawPayload: { simulated: true },
      })

      expect(mockDb.screeningQueue.create).toHaveBeenCalledTimes(1)
      expect(item.id).toBe(1)
      expect(item.status).toBe('WAITING')
    })

    it('updates existing record if already queued today', async () => {
      const existing = {
        id: 5,
        cid: '1529900123456',
        fullName: 'นายสมศักดิ์ ทดสอบ',
        status: 'CANCELLED',
      }
      mockDb.screeningQueue.findFirst.mockResolvedValue(existing)
      mockDb.screeningQueue.update.mockResolvedValue({
        ...existing,
        status: 'WAITING', // reset CANCELLED to WAITING on re-scan
      })
      mockDb.screeningQueue.deleteMany.mockResolvedValue({ count: 0 })

      const item = await service.addToQueue({
        cid: '1529900123456',
        fullName: 'นายสมศักดิ์ ทดสอบ',
      })

      expect(mockDb.screeningQueue.update).toHaveBeenCalledTimes(1)
      expect(mockDb.screeningQueue.create).not.toHaveBeenCalled()
      expect(item.status).toBe('WAITING')
    })
  })

  describe('updateQueueStatus', () => {
    it('throws error for invalid status value', async () => {
      await expect(
        service.updateQueueStatus(1, { status: 'INVALID_STATUS' as any })
      ).rejects.toThrow('สถานะไม่ถูกต้อง')
    })

    it('throws error if queue does not exist', async () => {
      mockDb.screeningQueue.findUnique.mockResolvedValue(null)
      await expect(
        service.updateQueueStatus(999, { status: 'VISIT_OPENED' })
      ).rejects.toThrow('ไม่พบคิวที่ต้องการอัปเดต')
    })

    it('successfully updates queue status and VN', async () => {
      mockDb.screeningQueue.findUnique.mockResolvedValue({ id: 1, status: 'WAITING', vn: null })
      mockDb.screeningQueue.update.mockResolvedValue({
        id: 1,
        status: 'VISIT_OPENED',
        vn: '691014120001',
      })

      const res = await service.updateQueueStatus(1, {
        status: 'VISIT_OPENED',
        vn: '691014120001',
      })

      expect(res.status).toBe('VISIT_OPENED')
      expect(res.vn).toBe('691014120001')
    })
  })

  describe('cleanupOldQueues', () => {
    it('deletes records older than retentionDays', async () => {
      mockDb.screeningQueue.deleteMany.mockResolvedValue({ count: 12 })
      const res = await service.cleanupOldQueues(30)
      expect(res.count).toBe(12)
      expect(mockDb.screeningQueue.deleteMany).toHaveBeenCalledTimes(1)
    })
  })
})
