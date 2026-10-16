import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ScreeningQueueService,
  getBangkokDateRange,
  maskCid,
  formatBangkokIso,
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

  describe('formatBangkokIso', () => {
    it('normalizes UTC Z string to Bangkok +07:00 offset', () => {
      expect(formatBangkokIso('2026-10-16T17:26:41.000Z')).toBe('2026-10-16T17:26:41.000+07:00')
    })

    it('keeps existing +07:00 string unchanged', () => {
      expect(formatBangkokIso('2026-10-16T17:26:41+07:00')).toBe('2026-10-16T17:26:41+07:00')
    })

    it('formats Date object to Bangkok ISO with +07:00', () => {
      const d = new Date('2026-10-16T17:26:41.000Z')
      expect(formatBangkokIso(d)).toBe('2026-10-16T17:26:41+07:00')
    })

    it('returns null for null or undefined', () => {
      expect(formatBangkokIso(null)).toBeNull()
      expect(formatBangkokIso(undefined)).toBeNull()
    })
  })

  describe('getBangkokDateRange', () => {
    it('calculates start and end Date objects and SQL boundaries for a given Bangkok date', () => {
      const range = getBangkokDateRange('2026-10-14')
      expect(range.bangkokDateStr).toBe('2026-10-14')
      expect(range.startSql).toBe('2026-10-14 00:00:00')
      expect(range.endSql).toBe('2026-10-14 23:59:59')
      expect(range.start.toISOString()).toBe('2026-10-14T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2026-10-14T23:59:59.999Z')
    })

    it('defaults to today when date is omitted or "today"', () => {
      const range = getBangkokDateRange('today')
      expect(range.bangkokDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(range.startSql).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/)
      expect(range.endSql).toMatch(/^\d{4}-\d{2}-\d{2} 23:59:59$/)
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

    it('queries all queues without date filter when date is "all"', async () => {
      mockDb.screeningQueue.findMany.mockResolvedValue([
        { id: 1, cid: '1111111111111', fullName: 'นาย หนึ่ง', status: 'WAITING', createdAt: '2026-10-14T10:00:00.000Z' },
        { id: 2, cid: '2222222222222', fullName: 'นาย สอง', status: 'WAITING', createdAt: '2026-10-16T17:00:00.000Z' },
      ])

      const result = await service.getQueues({ date: 'all' })

      expect(mockDb.screeningQueue.findMany).toHaveBeenCalledTimes(1)
      const callArgs = mockDb.screeningQueue.findMany.mock.calls[0][0]
      expect(callArgs.where.createdAt).toBeUndefined()
      expect(result.items.length).toBe(2)
      expect(result.date).toBe('all')
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

  describe('ScreeningQueueService (Zero-DB Gateway direct SQL)', () => {
    let mockQueryExecutor: any
    let zeroDbService: ScreeningQueueService

    beforeEach(() => {
      mockQueryExecutor = vi.fn()
      zeroDbService = new ScreeningQueueService(null, mockQueryExecutor)
    })

    it('queries queues with Bangkok local 00:00:00 to 23:59:59 SQL bounds', async () => {
      mockQueryExecutor.mockResolvedValue([
        {
          id: 5,
          cid: '1520100109075',
          fullName: 'นาย ธนนันท์ กันชาติ',
          status: 'WAITING',
          created_at: '2026-10-14T03:34:29.000Z',
          updated_at: '2026-10-14T03:34:29.000Z',
        },
        {
          id: 6,
          cid: '1520800055172',
          fullName: 'น.ส. ชนิกา ปัญญาสิทธิ์',
          status: 'WAITING',
          created_at: '2026-10-14T17:25:58.000Z',
          updated_at: '2026-10-14T17:25:58.000Z',
        },
      ])

      const result = await zeroDbService.getQueues({ date: '2026-10-14' })

      expect(mockQueryExecutor).toHaveBeenCalledTimes(1)
      const [sql, params] = mockQueryExecutor.mock.calls[0]
      expect(sql).toContain('created_at >= ? AND created_at <= ?')
      expect(params[0]).toBe('2026-10-14 00:00:00')
      expect(params[1]).toBe('2026-10-14 23:59:59')
      expect(result.items.length).toBe(2)
      expect(result.items[1].createdAt).toBe('2026-10-14T17:25:58.000+07:00')
    })

    it('queries queues without date filter when date is "all"', async () => {
      mockQueryExecutor.mockResolvedValue([])

      await zeroDbService.getQueues({ date: 'all' })

      expect(mockQueryExecutor).toHaveBeenCalledTimes(1)
      const [sql, params] = mockQueryExecutor.mock.calls[0]
      expect(sql).not.toContain('created_at >=')
      expect(params.length).toBe(0)
    })

    it('addToQueue checks existing record within today full Bangkok range', async () => {
      mockQueryExecutor
        .mockResolvedValueOnce([]) // existing check
        .mockResolvedValueOnce({ insertId: 9 }) // insert
        .mockResolvedValueOnce([ // getQueueById
          {
            id: 9,
            cid: '1520800055172',
            fullName: 'น.ส. ชนิกา ปัญญาสิทธิ์',
            status: 'WAITING',
            created_at: '2026-10-16T17:40:00.000Z',
          },
        ])
        .mockResolvedValueOnce({ affectedRows: 0 }) // cleanup

      const res = await zeroDbService.addToQueue({
        cid: '1520800055172',
        fullName: 'น.ส. ชนิกา ปัญญาสิทธิ์',
      })

      expect(res.id).toBe(9)
      const [firstSql, firstParams] = mockQueryExecutor.mock.calls[0]
      expect(firstSql).toContain('WHERE cid = ? AND created_at >= ? AND created_at <= ?')
      expect(firstParams[1]).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/)
      expect(firstParams[2]).toMatch(/^\d{4}-\d{2}-\d{2} 23:59:59$/)
    })
  })

  describe('HOSxP Medical Record & Visit Verification (Dedicated Gateway API)', () => {
    let mockClinicalVerifier: any
    let mockQueryExecutor: any
    let serviceWithClinical: ScreeningQueueService

    beforeEach(() => {
      mockClinicalVerifier = vi.fn()
      mockQueryExecutor = vi.fn()
      serviceWithClinical = new ScreeningQueueService(null, mockQueryExecutor, mockClinicalVerifier)
    })

    it('verifyHosVisits chunks CIDs and calls dedicated gateway endpoint', async () => {
      mockClinicalVerifier.mockResolvedValue([
        { cid: '1111111111111', hn: '0001234', vn: undefined, hasPatientRecord: true, hasVisitToday: false, status: 'WAITING' },
        { cid: '2222222222222', hn: '0005678', vn: '6710160001', hasPatientRecord: true, hasVisitToday: true, status: 'VISIT_OPENED' },
        { cid: '3333333333333', hasPatientRecord: false, hasVisitToday: false, status: 'NO_RECORD' },
      ])

      const result = await serviceWithClinical.verifyHosVisits([
        '1111111111111',
        '2222222222222',
        '3333333333333',
      ])

      expect(mockClinicalVerifier).toHaveBeenCalledTimes(1)
      expect(mockClinicalVerifier).toHaveBeenCalledWith(['1111111111111', '2222222222222', '3333333333333'])

      expect(result.get('1111111111111')).toEqual({ inPatient: true, hn: '0001234', vn: undefined })
      expect(result.get('2222222222222')).toEqual({ inPatient: true, hn: '0005678', vn: '6710160001' })
      expect(result.get('3333333333333')).toBeUndefined()
    })

    it('enrichQueuesWithHosVisits marks NO_RECORD, WAITING, and VISIT_OPENED and persists updates', async () => {
      mockClinicalVerifier.mockResolvedValue([
        { cid: '1111111111111', hn: '0001234', hasPatientRecord: true, hasVisitToday: false, status: 'WAITING' },
        { cid: '2222222222222', hn: '0005678', vn: '6710160001', hasPatientRecord: true, hasVisitToday: true, status: 'VISIT_OPENED' },
        { cid: '3333333333333', hasPatientRecord: false, hasVisitToday: false, status: 'NO_RECORD' },
      ])

      const rawItems: any[] = [
        { id: 1, cid: '1111111111111', status: 'WAITING', vn: null },
        { id: 2, cid: '2222222222222', status: 'WAITING', vn: null },
        { id: 3, cid: '3333333333333', status: 'WAITING', vn: null }, // will be NO_RECORD
        { id: 4, cid: '4444444444444', status: 'CANCELLED', vn: null }, // preserves CANCELLED
      ]

      mockQueryExecutor.mockResolvedValue({ affectedRows: 1 })

      const enriched = await serviceWithClinical.enrichQueuesWithHosVisits(rawItems)

      expect(enriched[0].status).toBe('WAITING')
      expect(enriched[0].vn).toBeNull()

      expect(enriched[1].status).toBe('VISIT_OPENED')
      expect(enriched[1].vn).toBe('6710160001')

      expect(enriched[2].status).toBe('NO_RECORD')
      expect(enriched[2].vn).toBeNull()

      expect(enriched[3].status).toBe('CANCELLED')

      // Should have persisted updates for items 2 and 3
      expect(mockQueryExecutor).toHaveBeenCalledTimes(2)
      expect(mockQueryExecutor.mock.calls[0][0]).toContain('UPDATE screening_queues SET status = ?, vn = ?')
    })

    it('gracefully degrades and returns original items if Gateway clinical verification fails', async () => {
      mockClinicalVerifier.mockRejectedValue(new Error('Gateway clinical connection timeout'))

      const rawItems: any[] = [
        { id: 1, cid: '1111111111111', status: 'WAITING', vn: null },
      ]

      const enriched = await serviceWithClinical.enrichQueuesWithHosVisits(rawItems)
      expect(enriched).toEqual(rawItems)
      expect(enriched[0].status).toBe('WAITING')
    })

    it('getQueues for today enriches queue items with HOSxP check and filters in memory', async () => {
      mockQueryExecutor.mockResolvedValue([
        { id: 1, cid: '1111111111111', full_name: 'สมชาย', status: 'WAITING', created_at: new Date() },
        { id: 2, cid: '2222222222222', full_name: 'สมหญิง', status: 'WAITING', created_at: new Date() },
      ])

      mockClinicalVerifier.mockResolvedValue([
        { cid: '1111111111111', hn: '0001234', vn: '6710160002', hasPatientRecord: true, hasVisitToday: true, status: 'VISIT_OPENED' },
        { cid: '2222222222222', hasPatientRecord: false, hasVisitToday: false, status: 'NO_RECORD' },
      ])

      const res = await serviceWithClinical.getQueues({ date: 'today' })

      expect(res.items.length).toBe(2)
      expect(res.items[0].status).toBe('VISIT_OPENED')
      expect(res.items[0].vn).toBe('6710160002')
      expect(res.items[1].status).toBe('NO_RECORD')
    })
  })
})

