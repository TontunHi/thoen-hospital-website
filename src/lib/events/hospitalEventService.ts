import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export interface Actor {
  id?: number | null
  name?: string | null
  username?: string | null
  role?: string | null
  department?: string | null
}

export interface BorrowItemInput {
  itemType: 'ASSET' | 'MATERIAL'
  assetId?: number | null
  materialId?: number | null
  itemName: string
  itemCode?: string | null
  quantity: number
}

export interface CreateEventInput {
  title: string
  description?: string | null
  location?: string | null
  bannerUrl?: string | null
  eventStartDate: Date | string
  eventEndDate: Date | string
  checkinOpenTime?: Date | string | null
  checkinCloseTime?: Date | string | null
  fiscalYear?: string | null
  coOrganizerMemberIds?: number[]
  borrowItems?: BorrowItemInput[]
}

export interface UpdateEventInput {
  title?: string
  description?: string | null
  location?: string | null
  bannerUrl?: string | null
  eventStartDate?: Date | string
  eventEndDate?: Date | string
  checkinOpenTime?: Date | string | null
  checkinCloseTime?: Date | string | null
  fiscalYear?: string | null
  status?: string
  coOrganizerMemberIds?: number[]
}

export interface GetEventsOptions {
  status?: string
  search?: string
  fiscalYear?: string
  memberId?: number
  onlyMyEvents?: boolean
  onlyMyRegistrations?: boolean
  page?: number
  limit?: number
}

import { calculateThaiFiscalYear } from './eventUtils'
export { calculateThaiFiscalYear }

/**
 * Calculates Thai Fiscal Year (ปีงบประมาณ พ.ศ.)
 * Begins October 1st of previous year.
 */
export const calculateCurrentFiscalYear = calculateThaiFiscalYear

export class HospitalEventService {
  constructor(private db: any = prisma) {}

  async createEvent(input: CreateEventInput, actor: Actor) {
    if (!actor.id) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนสร้างกิจกรรม')
    }
    if (!input.title || !input.title.trim()) {
      throw new Error('กรุณาระบุชื่อกิจกรรม')
    }

    const startDate = new Date(input.eventStartDate)
    const endDate = new Date(input.eventEndDate)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('วันเวลาจัดกิจกรรมไม่ถูกต้อง')
    }
    if (startDate > endDate) {
      throw new Error('วันเริ่มต้นกิจกรรมต้องมาก่อนวันสิ้นสุด')
    }

    const checkinOpen = input.checkinOpenTime ? new Date(input.checkinOpenTime) : startDate
    const checkinClose = input.checkinCloseTime ? new Date(input.checkinCloseTime) : endDate

    if (checkinOpen > checkinClose) {
      throw new Error('เวลาเปิดรับเช็คอินต้องมาก่อนเวลาปิดรับเช็คอิน')
    }

    const fiscalYear = input.fiscalYear || calculateCurrentFiscalYear(startDate)
    const qrToken = crypto.randomBytes(24).toString('hex')

    return await this.db.$transaction(async (tx: any) => {
      let borrowRequestId: number | null = null

      // If user requested materials/assets, create linked EquipmentBorrowRequest
      if (input.borrowItems && input.borrowItems.length > 0) {
        const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
        const rand4 = Math.floor(1000 + Math.random() * 9000)
        const requestNo = `BR-${yyyymm}-${rand4}`

        const borrowReq = await tx.equipmentBorrowRequest.create({
          data: {
            requestNo,
            requesterId: actor.id,
            requesterName: actor.name || 'บุคลากรโรงพยาบาลเถิน',
            requesterDept: actor.department || null,
            purpose: `สำหรับกิจกรรม: ${input.title.trim()}`,
            location: input.location?.trim() || null,
            borrowDate: startDate,
            expectedReturnDate: endDate,
            status: 'PENDING',
            items: {
              create: input.borrowItems.map((item) => ({
                itemType: item.itemType,
                assetId: item.assetId || null,
                materialId: item.materialId || null,
                itemName: item.itemName,
                itemCode: item.itemCode || null,
                quantity: item.quantity || 1,
                status: 'BORROWED',
              })),
            },
          },
        })
        borrowRequestId = borrowReq.id
      }

      const event = await tx.hospitalEvent.create({
        data: {
          title: input.title.trim(),
          description: input.description?.trim() || null,
          location: input.location?.trim() || null,
          bannerUrl: input.bannerUrl?.trim() || null,
          eventStartDate: startDate,
          eventEndDate: endDate,
          checkinOpenTime: checkinOpen,
          checkinCloseTime: checkinClose,
          headOrganizerId: actor.id,
          borrowRequestId,
          qrToken,
          fiscalYear,
          status: 'UPCOMING',
        },
      })

      // Add co-organizers if any
      if (input.coOrganizerMemberIds && input.coOrganizerMemberIds.length > 0) {
        const uniqueIds = Array.from(new Set(input.coOrganizerMemberIds.filter((id) => id !== actor.id)))
        if (uniqueIds.length > 0) {
          await tx.eventOrganizer.createMany({
            data: uniqueIds.map((mId) => ({
              eventId: event.id,
              memberId: mId,
              roleTitle: 'ผู้รับผิดชอบร่วม',
            })),
          })
        }
      }

      try {
        await logAudit(
          'CREATE',
          'hospital_events',
          `สร้างกิจกรรมใหม่: "${event.title}" (ID: ${event.id}) โดย ${actor.name || actor.username}`,
          { eventId: event.id, title: event.title, borrowRequestId }
        )
      } catch (err) {
        logger.error({ err }, 'Failed to write audit log for event creation')
      }

      return event
    })
  }

  async getEvents(options: GetEventsOptions = {}) {
    const {
      status,
      search,
      fiscalYear,
      memberId,
      onlyMyEvents,
      onlyMyRegistrations,
      page = 1,
      limit = 20,
    } = options

    const skip = (Math.max(1, page) - 1) * limit
    const where: any = {}

    if (status && status !== 'ALL') {
      where.status = status
    }
    if (fiscalYear && fiscalYear !== 'ALL') {
      where.fiscalYear = fiscalYear
    }
    if (search && search.trim()) {
      const q = search.trim()
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { location: { contains: q } },
      ]
    }

    if (onlyMyEvents && memberId) {
      where.OR = [
        { headOrganizerId: memberId },
        { coOrganizers: { some: { memberId } } },
      ]
    }

    if (onlyMyRegistrations && memberId) {
      where.registrations = { some: { memberId } }
    }

    const [events, total] = await Promise.all([
      this.db.hospitalEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { eventStartDate: 'asc' },
        include: {
          headOrganizer: {
            select: { id: true, name: true, department: true, profilePath: true },
          },
          coOrganizers: {
            include: {
              member: {
                select: { id: true, name: true, department: true, profilePath: true },
              },
            },
          },
          _count: {
            select: {
              registrations: true,
              attendances: true,
            },
          },
        },
      }),
      this.db.hospitalEvent.count({ where }),
    ])

    // If caller provided memberId, map their interaction state
    const mapped = events.map((ev: any) => {
      const isHeadOrganizer = memberId ? ev.headOrganizerId === memberId : false
      const isCoOrganizer = memberId
        ? ev.coOrganizers?.some((c: any) => c.memberId === memberId)
        : false

      return {
        ...ev,
        registrationCount: ev._count?.registrations || 0,
        attendanceCount: ev._count?.attendances || 0,
        isOrganizer: isHeadOrganizer || isCoOrganizer,
      }
    })

    return {
      events: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async getEventById(id: number, memberId?: number) {
    const event = await this.db.hospitalEvent.findUnique({
      where: { id },
      include: {
        headOrganizer: {
          select: { id: true, name: true, department: true, profilePath: true, position: true },
        },
        coOrganizers: {
          include: {
            member: {
              select: { id: true, name: true, department: true, profilePath: true, position: true },
            },
          },
        },
        registrations: {
          include: {
            member: {
              select: { id: true, name: true, department: true, profilePath: true },
            },
          },
          orderBy: { registeredAt: 'desc' },
        },
        attendances: {
          include: {
            member: {
              select: { id: true, name: true, department: true, profilePath: true },
            },
          },
          orderBy: { checkedInAt: 'desc' },
        },
        borrowRequest: {
          include: {
            items: true,
          },
        },
      },
    })

    if (!event) return null

    const isHeadOrganizer = memberId ? event.headOrganizerId === memberId : false
    const isCoOrganizer = memberId
      ? event.coOrganizers?.some((c: any) => c.memberId === memberId)
      : false
    const hasRegistered = memberId
      ? event.registrations?.some((r: any) => r.memberId === memberId)
      : false
    const hasAttended = memberId
      ? event.attendances?.some((a: any) => a.memberId === memberId)
      : false

    return {
      ...event,
      registrationCount: event.registrations?.length || 0,
      attendanceCount: event.attendances?.length || 0,
      canManage: isHeadOrganizer || isCoOrganizer,
      hasRegistered,
      hasAttended,
    }
  }

  async updateEvent(id: number, input: UpdateEventInput, actor: Actor) {
    const existing = await this.db.hospitalEvent.findUnique({
      where: { id },
      include: { coOrganizers: true },
    })

    if (!existing) {
      throw new Error('ไม่พบข้อมูลกิจกรรม')
    }

    const isAuthorized =
      actor.role === 'admin' ||
      existing.headOrganizerId === actor.id ||
      existing.coOrganizers?.some((c: any) => c.memberId === actor.id)

    if (!isAuthorized) {
      throw new Error('คุณไม่มีสิทธิ์แก้ไขกิจกรรมนี้')
    }

    const data: any = {}
    if (input.title !== undefined) data.title = input.title.trim()
    if (input.description !== undefined) data.description = input.description?.trim() || null
    if (input.location !== undefined) data.location = input.location?.trim() || null
    if (input.bannerUrl !== undefined) data.bannerUrl = input.bannerUrl?.trim() || null
    if (input.status !== undefined) data.status = input.status
    if (input.fiscalYear !== undefined) data.fiscalYear = input.fiscalYear

    if (input.eventStartDate !== undefined) data.eventStartDate = new Date(input.eventStartDate)
    if (input.eventEndDate !== undefined) data.eventEndDate = new Date(input.eventEndDate)
    if (input.checkinOpenTime) data.checkinOpenTime = new Date(input.checkinOpenTime)
    if (input.checkinCloseTime) data.checkinCloseTime = new Date(input.checkinCloseTime)

    return await this.db.$transaction(async (tx: any) => {
      const updated = await tx.hospitalEvent.update({
        where: { id },
        data,
      })

      if (input.coOrganizerMemberIds !== undefined) {
        await tx.eventOrganizer.deleteMany({ where: { eventId: id } })
        const uniqueIds = Array.from(new Set(input.coOrganizerMemberIds.filter((mId) => mId !== existing.headOrganizerId)))
        if (uniqueIds.length > 0) {
          await tx.eventOrganizer.createMany({
            data: uniqueIds.map((mId) => ({
              eventId: id,
              memberId: mId,
              roleTitle: 'ผู้รับผิดชอบร่วม',
            })),
          })
        }
      }

      try {
        await logAudit(
          'UPDATE',
          'hospital_events',
          `แก้ไขข้อมูลกิจกรรม: "${updated.title}" (ID: ${id}) โดย ${actor.name || actor.username}`,
          { eventId: id, changes: data }
        )
      } catch (err) {
        logger.error({ err }, 'Failed to write audit log for event update')
      }

      return updated
    })
  }

  async registerForEvent(eventId: number, memberId: number) {
    const event = await this.db.hospitalEvent.findUnique({ where: { id: eventId } })
    if (!event) throw new Error('ไม่พบข้อมูลกิจกรรม')
    if (event.status === 'COMPLETED' || event.status === 'CANCELLED') {
      throw new Error('ไม่สามารถลงทะเบียนกิจกรรมที่สิ้นสุดหรือถูกยกเลิกแล้ว')
    }

    const existing = await this.db.eventRegistration.findUnique({
      where: { eventId_memberId: { eventId, memberId } },
    })

    if (existing) {
      return { success: true, message: 'คุณได้ลงทะเบียนไว้แล้ว', registration: existing }
    }

    const registration = await this.db.eventRegistration.create({
      data: { eventId, memberId },
    })

    return { success: true, message: 'ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว', registration }
  }

  async cancelRegistration(eventId: number, memberId: number) {
    await this.db.eventRegistration.delete({
      where: { eventId_memberId: { eventId, memberId } },
    })
    return { success: true, message: 'ยกเลิกการลงทะเบียนเรียบร้อยแล้ว' }
  }

  async checkinViaThaid(
    qrToken: string,
    citizenId: string,
    options: { now?: Date; ipAddress?: string; userAgent?: string } = {}
  ) {
    const now = options.now || new Date()
    const sanitizedPid = citizenId.trim()

    const event = await this.db.hospitalEvent.findUnique({
      where: { qrToken },
    })

    if (!event) {
      throw new Error('ไม่พบข้อมูลกิจกรรมจาก QR Code นี้ หรือรหัสไม่ถูกต้อง')
    }

    // 1. Validate Time-gated window
    if (now < event.checkinOpenTime) {
      const openStr = event.checkinOpenTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      throw new Error(`ยังไม่ถึงเวลาเปิดรับสแกนเช็คอิน (เปิดรับสแกนเวลา ${openStr} น.)`)
    }

    if (now > event.checkinCloseTime) {
      const closeStr = event.checkinCloseTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      throw new Error(`หมดเวลาเช็คอินสำหรับกิจกรรมนี้แล้ว (ปิดรับสแกนเมื่อเวลา ${closeStr} น.)`)
    }

    // 2. Lookup registered Member by Citizen ID (username)
    const member = await this.db.member.findUnique({
      where: { username: sanitizedPid },
      select: { id: true, name: true, department: true, position: true, username: true },
    })

    if (!member) {
      throw new Error('ไม่พบข้อมูลบุคลากรในระบบ กรุณาติดต่อกลุ่มงานทรัพยากรบุคคลหรือลงทะเบียนสมาชิกโรงพยาบาลเถินก่อนเช็คอิน')
    }

    // 3. Check for duplicate check-in
    const existingAttendance = await this.db.eventAttendance.findUnique({
      where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
    })

    if (existingAttendance) {
      const checkedTime = new Date(existingAttendance.checkedInAt).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      })
      throw new Error(`ท่านได้เช็คอินเข้าร่วมกิจกรรมนี้ไปแล้วเมื่อเวลา ${checkedTime} น.`)
    }

    // 4. Record attendance & award 1 point
    const attendance = await this.db.eventAttendance.create({
      data: {
        eventId: event.id,
        memberId: member.id,
        citizenId: sanitizedPid,
        pointsAwarded: 1,
        checkedInAt: now,
      },
    })

    try {
      await logAudit(
        'CREATE',
        'event_attendances',
        `เช็คอินกิจกรรม "${event.title}": ${member.name} (${member.department || 'ไม่ระบุแผนก'}) รับ 1 คะแนน`,
        {
          eventId: event.id,
          memberId: member.id,
          citizenIdMasked: sanitizedPid.slice(-4),
          ipAddress: options.ipAddress,
        }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to log event checkin audit')
    }

    return {
      success: true,
      event: {
        id: event.id,
        title: event.title,
        location: event.location,
      },
      member: {
        id: member.id,
        name: member.name,
        department: member.department,
        position: member.position,
      },
      checkedInAt: attendance.checkedInAt,
      pointsAwarded: 1,
    }
  }
}
