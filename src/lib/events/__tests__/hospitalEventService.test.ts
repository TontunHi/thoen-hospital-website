import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HospitalEventService } from '../hospitalEventService'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('HospitalEventService', () => {
  let mockDb: any
  let service: HospitalEventService

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = {
      hospitalEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      eventOrganizer: {
        create: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      eventRegistration: {
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      eventAttendance: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      equipmentBorrowRequest: {
        create: vi.fn(),
      },
      member: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockDb)),
    }
    service = new HospitalEventService(mockDb)
  })

  describe('createEvent', () => {
    it('creates an event with head organizer and generates qrToken', async () => {
      const actor = { id: 10, name: 'นายแพทย์สมชาย', username: '1100200300401', role: 'member' }
      const input = {
        title: 'กิจกรรมวิ่งการกุศล รพ.เถิน มินิมาราธอน',
        description: 'งานวิ่งเพื่อสุขภาพบุคลากร',
        location: 'ลานหน้าโรงพยาบาลเถิน',
        eventStartDate: new Date('2026-10-20T06:00:00Z'),
        eventEndDate: new Date('2026-10-20T10:00:00Z'),
        checkinOpenTime: new Date('2026-10-20T05:30:00Z'),
        checkinCloseTime: new Date('2026-10-20T08:00:00Z'),
        coOrganizerMemberIds: [12, 15],
      }

      mockDb.hospitalEvent.create.mockResolvedValue({
        id: 1,
        ...input,
        headOrganizerId: actor.id,
        qrToken: 'test-token-123',
        status: 'UPCOMING',
      })

      const result = await service.createEvent(input, actor)

      expect(mockDb.hospitalEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: input.title,
            headOrganizerId: actor.id,
            qrToken: expect.any(String),
          }),
        })
      )
      expect(mockDb.eventOrganizer.createMany).toHaveBeenCalledWith({
        data: [
          { eventId: 1, memberId: 12, roleTitle: 'ผู้รับผิดชอบร่วม' },
          { eventId: 1, memberId: 15, roleTitle: 'ผู้รับผิดชอบร่วม' },
        ],
      })
      expect(result.id).toBe(1)
    })

    it('creates linked equipment borrow request when borrowItems are provided', async () => {
      const actor = { id: 10, name: 'นายแพทย์สมชาย', username: '1100200300401', role: 'member' }
      const input = {
        title: 'กิจกรรมอบรม CPR บุคลากร',
        eventStartDate: new Date('2026-10-25T09:00:00Z'),
        eventEndDate: new Date('2026-10-25T12:00:00Z'),
        borrowItems: [
          { itemType: 'MATERIAL' as const, materialId: 5, itemName: 'สายไฟพ่วง 10 เมตร', quantity: 2 },
          { itemType: 'ASSET' as const, assetId: 99, itemName: 'โปรเจคเตอร์ Epson', quantity: 1 },
        ],
      }

      mockDb.equipmentBorrowRequest.create.mockResolvedValue({
        id: 77,
        requestNo: 'BR-202610-0001',
      })
      mockDb.hospitalEvent.create.mockResolvedValue({
        id: 2,
        title: input.title,
        borrowRequestId: 77,
      })

      const result = await service.createEvent(input, actor)

      expect(mockDb.equipmentBorrowRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purpose: expect.stringContaining(input.title),
            requesterId: actor.id,
            items: {
              create: expect.arrayContaining([
                expect.objectContaining({ itemName: 'สายไฟพ่วง 10 เมตร', quantity: 2 }),
                expect.objectContaining({ itemName: 'โปรเจคเตอร์ Epson', quantity: 1 }),
              ]),
            },
          }),
        })
      )
      expect(mockDb.hospitalEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            borrowRequestId: 77,
          }),
        })
      )
      expect(result.id).toBe(2)
    })

    it('rejects if start date is after end date', async () => {
      const actor = { id: 10, name: 'นายแพทย์สมชาย', username: '1100200300401', role: 'member' }
      const input = {
        title: 'วันเวลาผิด',
        eventStartDate: new Date('2026-10-20T12:00:00Z'),
        eventEndDate: new Date('2026-10-20T10:00:00Z'),
      }

      await expect(service.createEvent(input, actor)).rejects.toThrow('วันเริ่มต้นกิจกรรมต้องมาก่อนวันสิ้นสุด')
    })
  })

  describe('checkinViaThaid', () => {
    it('successfully checks in member and awards 1 point during valid checkin window', async () => {
      const now = new Date('2026-10-20T06:30:00Z')
      const mockEvent = {
        id: 1,
        title: 'กิจกรรมวิ่งเพื่อสุขภาพ',
        checkinOpenTime: new Date('2026-10-20T06:00:00Z'),
        checkinCloseTime: new Date('2026-10-20T08:00:00Z'),
        status: 'UPCOMING',
      }
      const mockMember = {
        id: 5,
        username: '1234567890123',
        name: 'นางสมศรี ใจดี',
        department: 'กลุ่มงานการพยาบาล',
      }

      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)
      mockDb.member.findUnique.mockResolvedValue(mockMember)
      mockDb.eventAttendance.findUnique.mockResolvedValue(null)
      mockDb.eventAttendance.create.mockResolvedValue({
        id: 101,
        eventId: 1,
        memberId: 5,
        citizenId: '1234567890123',
        pointsAwarded: 1,
        checkedInAt: now,
      })

      const result = await service.checkinViaThaid('valid-token', '1234567890123', {
        now,
        ipAddress: '192.168.1.50',
      })

      expect(result.success).toBe(true)
      expect(result.pointsAwarded).toBe(1)
      expect(result.member.name).toBe('นางสมศรี ใจดี')
      expect(mockDb.eventAttendance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: 1,
          memberId: 5,
          citizenId: '1234567890123',
          pointsAwarded: 1,
        }),
      })
    })

    it('rejects check-in before checkinOpenTime', async () => {
      const now = new Date('2026-10-20T05:45:00Z')
      const mockEvent = {
        id: 1,
        title: 'กิจกรรมวิ่ง',
        checkinOpenTime: new Date('2026-10-20T06:00:00Z'),
        checkinCloseTime: new Date('2026-10-20T08:00:00Z'),
      }

      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)

      await expect(
        service.checkinViaThaid('valid-token', '1234567890123', { now })
      ).rejects.toThrow('ยังไม่ถึงเวลาเปิดรับสแกนเช็คอิน')
    })

    it('rejects check-in after checkinCloseTime', async () => {
      const now = new Date('2026-10-20T08:30:00Z')
      const mockEvent = {
        id: 1,
        title: 'กิจกรรมวิ่ง',
        checkinOpenTime: new Date('2026-10-20T06:00:00Z'),
        checkinCloseTime: new Date('2026-10-20T08:00:00Z'),
      }

      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)

      await expect(
        service.checkinViaThaid('valid-token', '1234567890123', { now })
      ).rejects.toThrow('หมดเวลาเช็คอินสำหรับกิจกรรมนี้แล้ว')
    })

    it('rejects check-in if citizenId is not a registered member', async () => {
      const now = new Date('2026-10-20T06:30:00Z')
      const mockEvent = {
        id: 1,
        checkinOpenTime: new Date('2026-10-20T06:00:00Z'),
        checkinCloseTime: new Date('2026-10-20T08:00:00Z'),
      }

      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)
      mockDb.member.findUnique.mockResolvedValue(null) // not found

      await expect(
        service.checkinViaThaid('valid-token', '9999999999999', { now })
      ).rejects.toThrow('ไม่พบข้อมูลบุคลากรในระบบ')
    })

    it('rejects duplicate check-in by the same person', async () => {
      const now = new Date('2026-10-20T06:30:00Z')
      const mockEvent = {
        id: 1,
        checkinOpenTime: new Date('2026-10-20T06:00:00Z'),
        checkinCloseTime: new Date('2026-10-20T08:00:00Z'),
      }
      const mockMember = { id: 5, username: '1234567890123' }

      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)
      mockDb.member.findUnique.mockResolvedValue(mockMember)
      mockDb.eventAttendance.findUnique.mockResolvedValue({
        id: 99,
        checkedInAt: new Date('2026-10-20T06:15:00Z'),
      })

      await expect(
        service.checkinViaThaid('valid-token', '1234567890123', { now })
      ).rejects.toThrow('ท่านได้เช็คอินเข้าร่วมกิจกรรมนี้ไปแล้ว')
    })
  })

  describe('Registration', () => {
    it('registers a member for an event', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue({ id: 1, status: 'UPCOMING' })
      mockDb.eventRegistration.findUnique.mockResolvedValue(null)
      mockDb.eventRegistration.create.mockResolvedValue({ id: 1, eventId: 1, memberId: 7 })

      const result = await service.registerForEvent(1, 7)
      expect(result.success).toBe(true)
      expect(mockDb.eventRegistration.create).toHaveBeenCalled()
    })

    it('cancels registration', async () => {
      mockDb.eventRegistration.delete.mockResolvedValue({ id: 1 })
      const result = await service.cancelRegistration(1, 7)
      expect(result.success).toBe(true)
    })
  })
})
