import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HospitalEventService } from '../hospitalEventService'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    delete: vi.fn().mockResolvedValue(true),
  },
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
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
        update: vi.fn(),
        delete: vi.fn(),
      },
      eventAttachment: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn(),
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
      const actor = { id: 10, name: 'นายแพทย์สมชาย', username: '1100200300401', role: 'admin' }
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
      const actor = { id: 10, name: 'นายแพทย์สมชาย', username: '1100200300401', role: 'admin' }
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
      const actor = { id: 10, name: 'นายแพทย์สมชาย', username: '1100200300401', role: 'admin' }
      const input = {
        title: 'วันเวลาผิด',
        eventStartDate: new Date('2026-10-20T12:00:00Z'),
        eventEndDate: new Date('2026-10-20T10:00:00Z'),
      }

      await expect(service.createEvent(input, actor)).rejects.toThrow('วันเริ่มต้นกิจกรรมต้องมาก่อนวันสิ้นสุด')
    })

    it('rejects if non-admin actor tries to create event', async () => {
      const actor = { id: 10, name: 'นายแพทย์สมชาย', username: '1100200300401', role: 'member' }
      const input = {
        title: 'กิจกรรมสมาชิกทั่วไป',
        eventStartDate: new Date('2026-10-20T06:00:00Z'),
        eventEndDate: new Date('2026-10-20T10:00:00Z'),
      }

      await expect(service.createEvent(input, actor)).rejects.toThrow('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสร้างกิจกรรมได้')
    })
  })

  describe('checkinViaThaid', () => {
    it('successfully checks in member and awards 1 point during valid checkin window', async () => {
      // 06:30 Bangkok time = 23:30 UTC of previous day
      const now = new Date('2026-10-19T23:30:00Z')
      const mockEvent = {
        id: 1,
        title: 'กิจกรรมวิ่งเพื่อสุขภาพ',
        checkinOpenTime: new Date(Date.UTC(2026, 9, 20, 6, 0, 0)),
        checkinCloseTime: new Date(Date.UTC(2026, 9, 20, 8, 0, 0)),
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
      // 05:45 Bangkok time = 22:45 UTC of previous day
      const now = new Date('2026-10-19T22:45:00Z')
      const mockEvent = {
        id: 1,
        title: 'กิจกรรมวิ่ง',
        checkinOpenTime: new Date(Date.UTC(2026, 9, 20, 6, 0, 0)),
        checkinCloseTime: new Date(Date.UTC(2026, 9, 20, 8, 0, 0)),
      }

      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)

      await expect(
        service.checkinViaThaid('valid-token', '1234567890123', { now })
      ).rejects.toThrow('ยังไม่ถึงเวลาเปิดรับสแกนเช็คอิน')
    })

    it('rejects check-in after checkinCloseTime', async () => {
      // 08:30 Bangkok time = 01:30 UTC
      const now = new Date('2026-10-20T01:30:00Z')
      const mockEvent = {
        id: 1,
        title: 'กิจกรรมวิ่ง',
        checkinOpenTime: new Date(Date.UTC(2026, 9, 20, 6, 0, 0)),
        checkinCloseTime: new Date(Date.UTC(2026, 9, 20, 8, 0, 0)),
      }

      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)

      await expect(
        service.checkinViaThaid('valid-token', '1234567890123', { now })
      ).rejects.toThrow('หมดเวลาเช็คอินสำหรับกิจกรรมนี้แล้ว')
    })

    it('rejects check-in if citizenId is not a registered member', async () => {
      const now = new Date('2026-10-19T23:30:00Z')
      const mockEvent = {
        id: 1,
        checkinOpenTime: new Date(Date.UTC(2026, 9, 20, 6, 0, 0)),
        checkinCloseTime: new Date(Date.UTC(2026, 9, 20, 8, 0, 0)),
      }

      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)
      mockDb.member.findUnique.mockResolvedValue(null) // not found

      await expect(
        service.checkinViaThaid('valid-token', '9999999999999', { now })
      ).rejects.toThrow('ไม่พบข้อมูลบุคลากรในระบบ')
    })

    it('rejects duplicate check-in by the same person', async () => {
      const now = new Date('2026-10-19T23:30:00Z')
      const mockEvent = {
        id: 1,
        checkinOpenTime: new Date(Date.UTC(2026, 9, 20, 6, 0, 0)),
        checkinCloseTime: new Date(Date.UTC(2026, 9, 20, 8, 0, 0)),
      }
      const mockMember = { id: 5, username: '1234567890123' }

      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)
      mockDb.member.findUnique.mockResolvedValue(mockMember)
      mockDb.eventAttendance.findUnique.mockResolvedValue({
        id: 99,
        checkedInAt: new Date(Date.UTC(2026, 9, 20, 6, 15, 0)),
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

  describe('Manual Attendance Management', () => {
    const actorOrganizer = { id: 10, name: 'ผู้จัดงาน', username: '1100200300401', role: 'member' }
    const actorAdmin = { id: 99, name: 'แอดมิน', username: 'admin01', role: 'admin' }
    const actorStranger = { id: 50, name: 'บุคคลอื่น', username: 'stranger', role: 'member' }

    const mockEvent = {
      id: 1,
      title: 'กิจกรรมสุขภาพ',
      headOrganizerId: 10,
      coOrganizers: [{ memberId: 12 }],
    }

    const mockMember = {
      id: 25,
      name: 'สมศรี มีสุข',
      username: '1234567890123',
      department: 'กลุ่มงานการพยาบาล',
    }

    it('organizer can manually add attendee', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)
      mockDb.member.findUnique.mockResolvedValue(mockMember)
      mockDb.eventAttendance.findUnique.mockResolvedValue(null)
      mockDb.eventAttendance.create.mockResolvedValue({
        id: 101,
        eventId: 1,
        memberId: 25,
        pointsAwarded: 1,
        member: mockMember,
      })

      const result = await service.addManualAttendance(1, { memberId: 25 }, actorOrganizer)
      expect(result.id).toBe(101)
      expect(mockDb.eventAttendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventId: 1,
            memberId: 25,
            pointsAwarded: 1,
          }),
        })
      )
    })

    it('rejects manual add if unauthorized user attempts', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)

      await expect(
        service.addManualAttendance(1, { memberId: 25 }, actorStranger)
      ).rejects.toThrow('คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้')
    })

    it('rejects duplicate manual add if already attended', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)
      mockDb.member.findUnique.mockResolvedValue(mockMember)
      mockDb.eventAttendance.findUnique.mockResolvedValue({ id: 55 })

      await expect(
        service.addManualAttendance(1, { memberId: 25 }, actorOrganizer)
      ).rejects.toThrow('มีรายชื่อเข้าร่วมกิจกรรมนี้แล้ว')
    })

    it('admin or organizer can update attendance points and time', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)
      mockDb.eventAttendance.findUnique.mockResolvedValue({
        id: 101,
        eventId: 1,
        memberId: 25,
        member: { id: 25, name: 'สมศรี มีสุข' },
      })
      mockDb.eventAttendance.update.mockResolvedValue({
        id: 101,
        pointsAwarded: 2,
        member: mockMember,
      })

      const result = await service.updateAttendance(1, 101, { pointsAwarded: 2 }, actorAdmin)
      expect(result.pointsAwarded).toBe(2)
      expect(mockDb.eventAttendance.update).toHaveBeenCalled()
    })

    it('organizer can delete attendance record', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue(mockEvent)
      mockDb.eventAttendance.findUnique.mockResolvedValue({
        id: 101,
        eventId: 1,
        memberId: 25,
        member: { id: 25, name: 'สมศรี มีสุข' },
      })
      mockDb.eventAttendance.delete.mockResolvedValue({ id: 101 })

      const result = await service.deleteAttendance(1, 101, actorOrganizer)
      expect(result.success).toBe(true)
      expect(mockDb.eventAttendance.delete).toHaveBeenCalledWith({
        where: { id: 101 },
      })
    })
  })

  describe('syncEventStatuses & JIT auto-transition', () => {
    it('transitions ended events to COMPLETED and ongoing events to ONGOING', async () => {
      mockDb.hospitalEvent.updateMany
        .mockResolvedValueOnce({ count: 2 }) // completed
        .mockResolvedValueOnce({ count: 1 }) // ongoing

      const result = await service.syncEventStatuses(new Date('2026-10-14T12:00:00Z'))
      expect(result.updatedToCompleted).toBe(2)
      expect(result.updatedToOngoing).toBe(1)
      expect(mockDb.hospitalEvent.updateMany).toHaveBeenCalledTimes(2)
    })

    it('getEvents automatically invokes syncEventStatuses', async () => {
      mockDb.hospitalEvent.findMany.mockResolvedValue([])
      mockDb.hospitalEvent.count.mockResolvedValue(0)

      await service.getEvents()
      expect(mockDb.hospitalEvent.updateMany).toHaveBeenCalled()
      expect(mockDb.hospitalEvent.findMany).toHaveBeenCalled()
    })

    it('getEventById automatically updates status if event is past end date', async () => {
      const pastEvent = {
        id: 99,
        title: 'งานที่ผ่านมาแล้ว',
        status: 'UPCOMING',
        eventStartDate: new Date('2026-10-01T08:00:00Z'),
        eventEndDate: new Date('2026-10-01T10:00:00Z'),
        checkinOpenTime: new Date('2026-10-01T08:00:00Z'),
        checkinCloseTime: new Date('2026-10-01T10:00:00Z'),
        headOrganizerId: 10,
        coOrganizers: [],
        registrations: [],
        attendances: [],
      }
      mockDb.hospitalEvent.findUnique.mockResolvedValue(pastEvent)
      mockDb.hospitalEvent.update.mockResolvedValue({ ...pastEvent, status: 'COMPLETED' })

      const event = await service.getEventById(99)
      expect(event?.status).toBe('COMPLETED')
      expect(mockDb.hospitalEvent.update).toHaveBeenCalledWith({
        where: { id: 99 },
        data: { status: 'COMPLETED' },
      })
    })

    it('getEventById leaves CANCELLED events untouched', async () => {
      const cancelledEvent = {
        id: 100,
        title: 'งานที่ถูกยกเลิก',
        status: 'CANCELLED',
        eventStartDate: new Date('2026-10-01T08:00:00Z'),
        eventEndDate: new Date('2026-10-01T10:00:00Z'),
        checkinOpenTime: new Date('2026-10-01T08:00:00Z'),
        checkinCloseTime: new Date('2026-10-01T10:00:00Z'),
        headOrganizerId: 10,
        coOrganizers: [],
        registrations: [],
        attendances: [],
      }
      mockDb.hospitalEvent.findUnique.mockResolvedValue(cancelledEvent)

      const event = await service.getEventById(100)
      expect(event?.status).toBe('CANCELLED')
      expect(mockDb.hospitalEvent.update).not.toHaveBeenCalled()
    })
  })
  describe('Event & Attendance time editing accuracy', () => {
    it('updateEvent preserves selected Thai local datetime without timezone drift in queryExecutor path', async () => {
      const executedSqls: { sql: string; params?: any[] }[] = []
      const mockQueryExecutor = vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
        executedSqls.push({ sql, params })
        if (sql.includes('SELECT id, title, head_organizer_id FROM hospital_events')) {
          return [{ id: 14, title: 'กิจกรรมตัวอย่าง', head_organizer_id: 10 }]
        }
        if (sql.includes('SELECT member_id FROM event_organizers WHERE event_id = ?')) {
          return []
        }
        if (sql.includes('UPDATE hospital_events SET')) {
          return { affectedRows: 1 }
        }
        if (sql.includes('SELECT') && sql.includes('FROM hospital_events e')) {
          return [{
            id: 14,
            title: 'กิจกรรมตัวอย่าง',
            description: null,
            location: 'ห้องประชุม',
            bannerUrl: null,
            eventStartDate: '2026-10-25 13:30:00', // MySQL DATETIME string
            eventEndDate: '2026-10-25 16:30:00',
            checkinOpenTime: '2026-10-25 13:00:00',
            checkinCloseTime: '2026-10-25 16:30:00',
            headOrganizerId: 10,
            borrowRequestId: null,
            qrToken: 'test-token',
            fiscalYear: '2570',
            status: 'UPCOMING',
            createdAt: '2026-10-21 08:00:00',
            updatedAt: '2026-10-21 09:00:00',
            head_id: 10,
            head_name: 'นพ.สมชาย',
            head_dept: 'IT',
            head_profile: null,
            head_pos: 'แพทย์',
          }]
        }
        if (sql.includes('FROM event_organizers')) return []
        if (sql.includes('FROM event_registrations')) return []
        if (sql.includes('FROM event_attendances')) return []
        return []
      })

      const rawService = new HospitalEventService(null, mockQueryExecutor)
      const actor = { id: 10, name: 'นพ.สมชาย', username: '1234567890123', role: 'admin' }

      const updated = await rawService.updateEvent(14, {
        eventStartDate: '2026-10-25T13:30',
        eventEndDate: '2026-10-25T16:30',
        checkinOpenTime: '2026-10-25T13:00',
        checkinCloseTime: '2026-10-25T16:30',
      }, actor)

      // Ensure SQL UPDATE wrote the exact local time string
      const updateCall = executedSqls.find((item) => item.sql.includes('UPDATE hospital_events SET'))
      expect(updateCall).toBeDefined()
      expect(updateCall?.params).toContain('2026-10-25 13:30:00')
      expect(updateCall?.params).toContain('2026-10-25 16:30:00')
      expect(updateCall?.params).toContain('2026-10-25 13:00:00')

      // Ensure returned ISO string matches the selected 13:30 and 16:30 (+07:00) without subtracting 7 hours
      expect(updated.eventStartDate).toBe('2026-10-25T13:30:00+07:00')
      expect(updated.eventEndDate).toBe('2026-10-25T16:30:00+07:00')
      expect(updated.checkinOpenTime).toBe('2026-10-25T13:00:00+07:00')
      expect(updated.checkinCloseTime).toBe('2026-10-25T16:30:00+07:00')
    })

    it('updateAttendance in queryExecutor path returns camelCase checkedInAt formatted in Bangkok time', async () => {
      const mockQueryExecutor = vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT id, title, head_organizer_id FROM hospital_events')) {
          return [{ id: 14, title: 'กิจกรรมตัวอย่าง', head_organizer_id: 10 }]
        }
        if (sql.includes('SELECT member_id FROM event_organizers')) return []
        if (sql.includes('SELECT a.*, m.name')) {
          return [{ id: 50, event_id: 14, member_id: 25, name: 'สมศรี' }]
        }
        if (sql.includes('UPDATE event_attendances SET')) return { affectedRows: 1 }
        if (sql.includes('a.event_id AS eventId')) {
          return [{
            id: 50,
            eventId: 14,
            memberId: 25,
            citizenId: '1234567890123',
            pointsAwarded: 2,
            checkedInAt: '2026-10-25 14:00:00', // MySQL DATETIME string
            createdAt: '2026-10-25 13:00:00',
            updatedAt: '2026-10-25 14:00:00',
            m_id: 25,
            name: 'สมศรี',
            department: 'พยาบาล',
            position: 'พยาบาล',
            profilePath: null,
          }]
        }
        return []
      })

      const rawService = new HospitalEventService(null, mockQueryExecutor)
      const actor = { id: 10, name: 'นพ.สมชาย', username: '1234567890123', role: 'admin' }

      const updated = await rawService.updateAttendance(14, 50, {
        pointsAwarded: 2,
        checkedInAt: '2026-10-25T14:00',
      }, actor)

      expect(updated.checkedInAt).toBe('2026-10-25T14:00:00+07:00')
      expect(updated.pointsAwarded).toBe(2)
      expect(updated.member.name).toBe('สมศรี')
    })
  })

  describe('event attachments', () => {
    const adminActor = { id: 1, name: 'Admin User', username: 'admin1', role: 'admin' }
    const headActor = { id: 10, name: 'นพ.สมชาย', username: 'head1', role: 'member' }
    const nonOrganizerActor = { id: 99, name: 'นายคนอื่น', username: 'other1', role: 'member' }

    it('getAttachments returns mapped attachments', async () => {
      mockDb.eventAttachment.findMany.mockResolvedValue([
        {
          id: 1,
          eventId: 14,
          attachmentType: 'IMAGE',
          title: 'ภาพกิจกรรม 1',
          filePath: '/uploads/events/14/img1.jpg',
          fileType: 'image/jpeg',
          fileSize: BigInt(2048),
          textContent: null,
          uploadedByMemberId: 10,
          displayOrder: 0,
          createdAt: new Date('2026-10-25T14:00:00Z'),
          updatedAt: new Date('2026-10-25T14:00:00Z'),
          uploadedBy: { id: 10, name: 'นพ.สมชาย', department: 'องค์กรแพทย์', profilePath: null },
        },
      ])

      const attachments = await service.getAttachments(14)
      expect(mockDb.eventAttachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: 14 } })
      )
      expect(attachments).toHaveLength(1)
      expect(attachments[0].title).toBe('ภาพกิจกรรม 1')
      expect(attachments[0].fileSize).toBe(2048)
      expect(attachments[0].uploadedBy?.name).toBe('นพ.สมชาย')
    })

    it('addAttachment succeeds for head organizer', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue({
        id: 14,
        title: 'กิจกรรมสุขภาพ',
        headOrganizerId: 10,
        coOrganizers: [],
      })

      mockDb.eventAttachment.create.mockResolvedValue({
        id: 5,
        eventId: 14,
        attachmentType: 'NOTE',
        title: 'สรุปการประชุม',
        filePath: null,
        fileType: null,
        fileSize: null,
        textContent: 'เนื้อหาบันทึก',
        uploadedByMemberId: 10,
        displayOrder: 0,
        createdAt: new Date('2026-10-25T14:00:00Z'),
        updatedAt: new Date('2026-10-25T14:00:00Z'),
        uploadedBy: { id: 10, name: 'นพ.สมชาย', department: 'องค์กรแพทย์', profilePath: null },
      })

      const created = await service.addAttachment(
        14,
        {
          attachmentType: 'NOTE',
          title: 'สรุปการประชุม',
          textContent: 'เนื้อหาบันทึก',
        },
        headActor
      )

      expect(created.id).toBe(5)
      expect(created.title).toBe('สรุปการประชุม')
      expect(mockDb.eventAttachment.create).toHaveBeenCalled()
    })

    it('addAttachment allows regular member to upload IMAGE', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue({
        id: 14,
        title: 'กิจกรรมสุขภาพ',
        headOrganizerId: 10,
        coOrganizers: [],
      })

      mockDb.eventAttachment.create.mockResolvedValue({
        id: 8,
        eventId: 14,
        attachmentType: 'IMAGE',
        title: 'ภาพจากเจ้าหน้าที่ทั่วไป',
        filePath: '/uploads/events/14/member-photo.jpg',
        fileType: 'image/jpeg',
        fileSize: BigInt(1024),
        textContent: null,
        uploadedByMemberId: 99,
        displayOrder: 0,
        createdAt: new Date('2026-10-25T14:30:00Z'),
        updatedAt: new Date('2026-10-25T14:30:00Z'),
        uploadedBy: { id: 99, name: 'จนท.ทดสอบ', department: 'เภสัชกรรม', profilePath: null },
      })

      const created = await service.addAttachment(
        14,
        {
          attachmentType: 'IMAGE',
          title: 'ภาพจากเจ้าหน้าที่ทั่วไป',
          filePath: '/uploads/events/14/member-photo.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
        nonOrganizerActor
      )

      expect(created.id).toBe(8)
      expect(created.uploadedByMemberId).toBe(99)
      expect(mockDb.eventAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventId: 14,
            attachmentType: 'IMAGE',
            uploadedByMemberId: 99,
          }),
        })
      )
    })

    it('addAttachment rejects unauthorized member', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue({
        id: 14,
        title: 'กิจกรรมสุขภาพ',
        headOrganizerId: 10,
        coOrganizers: [],
      })

      await expect(
        service.addAttachment(
          14,
          {
            attachmentType: 'NOTE',
            title: 'พยายามแทรก',
            textContent: 'hack',
          },
          nonOrganizerActor
        )
      ).rejects.toThrow('คุณไม่มีสิทธิ์แนบเอกสารหรือรูปภาพในกิจกรรมนี้')
    })

    it('deleteAttachment removes DB record and deletes physical file via DocumentStorage', async () => {
      const { DocumentStorage } = await import('@/lib/storage/documentStorage')

      mockDb.hospitalEvent.findUnique.mockResolvedValue({
        id: 14,
        title: 'กิจกรรมสุขภาพ',
        headOrganizerId: 10,
        coOrganizers: [],
      })

      mockDb.eventAttachment.findUnique.mockResolvedValue({
        id: 5,
        eventId: 14,
        filePath: '/uploads/events/14/file.pdf',
      })
      mockDb.eventAttachment.delete.mockResolvedValue({ id: 5 })

      const res = await service.deleteAttachment(14, 5, adminActor)

      expect(res.success).toBe(true)
      expect(mockDb.eventAttachment.delete).toHaveBeenCalledWith({ where: { id: 5 } })
      expect(DocumentStorage.delete).toHaveBeenCalledWith('/uploads/events/14/file.pdf')
    })

    it('deleteAttachment allows uploader member to delete their own attachment', async () => {
      const { DocumentStorage } = await import('@/lib/storage/documentStorage')

      mockDb.hospitalEvent.findUnique.mockResolvedValue({
        id: 14,
        title: 'กิจกรรมสุขภาพ',
        headOrganizerId: 10,
        coOrganizers: [],
      })

      mockDb.eventAttachment.findUnique.mockResolvedValue({
        id: 8,
        eventId: 14,
        uploadedByMemberId: 99, // Uploaded by nonOrganizerActor
        filePath: '/uploads/events/14/member-photo.jpg',
      })
      mockDb.eventAttachment.delete.mockResolvedValue({ id: 8 })

      const res = await service.deleteAttachment(14, 8, nonOrganizerActor)

      expect(res.success).toBe(true)
      expect(mockDb.eventAttachment.delete).toHaveBeenCalledWith({ where: { id: 8 } })
      expect(DocumentStorage.delete).toHaveBeenCalledWith('/uploads/events/14/member-photo.jpg')
    })

    it('deleteAttachment rejects unauthorized member', async () => {
      mockDb.hospitalEvent.findUnique.mockResolvedValue({
        id: 14,
        title: 'กิจกรรมสุขภาพ',
        headOrganizerId: 10,
        coOrganizers: [],
      })

      mockDb.eventAttachment.findUnique.mockResolvedValue({
        id: 5,
        eventId: 14,
        uploadedByMemberId: 10,
        filePath: '/uploads/events/14/file.pdf',
      })

      await expect(
        service.deleteAttachment(14, 5, nonOrganizerActor)
      ).rejects.toThrow('คุณไม่มีสิทธิ์ลบเอกสารหรือรูปภาพในกิจกรรมนี้')
    })
  })
})
