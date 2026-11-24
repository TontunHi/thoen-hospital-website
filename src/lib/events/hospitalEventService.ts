import crypto from 'crypto'
import { apiGateway } from '@/lib/apiGateway'
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

export interface AddEventAttachmentInput {
  attachmentType: 'IMAGE' | 'DOCUMENT' | 'NOTE'
  title: string
  filePath?: string | null
  fileType?: string | null
  fileSize?: number | bigint | null
  textContent?: string | null
  displayOrder?: number
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
  onlyUpcoming?: boolean
  onlyCompleted?: boolean
  onlyMyEvents?: boolean
  onlyMyRegistrations?: boolean
  page?: number
  limit?: number
}

import { calculateThaiFiscalYear } from './eventUtils'
import {
  toDbThaiDateTime,
  toDbSqlDateTime,
  toBangkokIsoString,
  validateCheckinWindow,
  getNowBangkokForDb,
  getNowBangkokForDbSql,
} from './eventTimeUtils'
export { calculateThaiFiscalYear }

/**
 * Calculates Thai Fiscal Year (ปีงบประมาณ พ.ศ.)
 * Begins October 1st of previous year.
 */
export const calculateCurrentFiscalYear = calculateThaiFiscalYear

export class HospitalEventService {
  constructor(
    private db: any = null,
    private readonly gateway = apiGateway.app
  ) {
    this.addAttachment = this.addAttachment.bind(this)
    this.getAttachments = this.getAttachments.bind(this)
    this.deleteAttachment = this.deleteAttachment.bind(this)
  }

  async createEvent(input: CreateEventInput, actor: Actor) {
    if (!actor.id) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนสร้างกิจกรรม')
    }
    if (actor.role !== 'admin') {
      throw new Error('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสร้างกิจกรรมได้')
    }
    if (!input.title || !input.title.trim()) {
      throw new Error('กรุณาระบุชื่อกิจกรรม')
    }

    const startDate = toDbThaiDateTime(input.eventStartDate)
    const endDate = toDbThaiDateTime(input.eventEndDate)

    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('วันเวลาจัดกิจกรรมไม่ถูกต้อง')
    }
    if (startDate > endDate) {
      throw new Error('วันเริ่มต้นกิจกรรมต้องมาก่อนวันสิ้นสุด')
    }

    const checkinOpen = input.checkinOpenTime ? toDbThaiDateTime(input.checkinOpenTime)! : startDate
    const checkinClose = input.checkinCloseTime ? toDbThaiDateTime(input.checkinCloseTime)! : endDate

    if (checkinOpen > checkinClose) {
      throw new Error('เวลาเปิดรับเช็คอินต้องมาก่อนเวลาปิดรับเช็คอิน')
    }

    const fiscalYear = input.fiscalYear || calculateCurrentFiscalYear(startDate)
    const qrToken = crypto.randomBytes(24).toString('hex')

    if (this.db?.hospitalEvent) {
      return await this.db.$transaction(async (tx: any) => {
        let borrowRequestId: number | null = null

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
                  status: 'PENDING',
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

    // Zero-SQL Gateway Production Implementation
    const { eventId, borrowRequestId } = await this.gateway.createEventV2({
      payload: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        location: input.location?.trim() || null,
        bannerUrl: input.bannerUrl?.trim() || null,
        eventStartDate: toDbSqlDateTime(startDate),
        eventEndDate: toDbSqlDateTime(endDate),
        checkinOpenTime: toDbSqlDateTime(checkinOpen),
        checkinCloseTime: toDbSqlDateTime(checkinClose),
        qrToken,
        fiscalYear,
      },
      actor: actor as unknown as Record<string, unknown>,
      borrowItems: (input.borrowItems || []) as unknown as Array<Record<string, unknown>>,
      coOrganizerMemberIds: input.coOrganizerMemberIds || [],
    })

    try {
      await logAudit(
        'CREATE',
        'hospital_events',
        `สร้างกิจกรรมใหม่: "${input.title.trim()}" (ID: ${eventId}) โดย ${actor.name || actor.username}`,
        { eventId, title: input.title.trim(), borrowRequestId }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to write audit log for event creation')
    }

    return this.getEventById(eventId)
  }

  async syncEventStatuses(referenceTime?: Date): Promise<{ updatedToOngoing: number; updatedToCompleted: number }> {
    if (typeof this.db?.hospitalEvent?.updateMany === 'function') {
      try {
        const dbNow = referenceTime ? toDbThaiDateTime(referenceTime) || getNowBangkokForDb() : getNowBangkokForDb()

        const [completedResult, ongoingResult] = await Promise.all([
          this.db.hospitalEvent.updateMany({
            where: {
              status: { in: ['UPCOMING', 'ONGOING'] },
              eventEndDate: { lt: dbNow },
            },
            data: { status: 'COMPLETED' },
          }),
          this.db.hospitalEvent.updateMany({
            where: {
              status: 'UPCOMING',
              eventStartDate: { lte: dbNow },
              eventEndDate: { gte: dbNow },
            },
            data: { status: 'ONGOING' },
          }),
        ])

        return {
          updatedToCompleted: completedResult?.count || 0,
          updatedToOngoing: ongoingResult?.count || 0,
        }
      } catch (err) {
        logger.error({ err }, 'Error syncing event statuses automatically')
        return { updatedToOngoing: 0, updatedToCompleted: 0 }
      }
    }

    try {
      const dbNow = referenceTime ? toDbSqlDateTime(referenceTime) || getNowBangkokForDbSql() : getNowBangkokForDbSql()
      const res = await this.gateway.syncEventStatusesV2(dbNow)

      return {
        updatedToCompleted: res?.updatedToCompleted || 0,
        updatedToOngoing: res?.updatedToOngoing || 0,
      }
    } catch (err) {
      logger.error({ err }, 'Error syncing event statuses automatically via gateway')
      return { updatedToOngoing: 0, updatedToCompleted: 0 }
    }
  }

  async getEvents(options: GetEventsOptions = {}) {
    await this.syncEventStatuses()

    const {
      status,
      search,
      fiscalYear,
      memberId,
      onlyUpcoming,
      onlyCompleted,
      onlyMyEvents,
      onlyMyRegistrations,
      page = 1,
      limit = 20,
    } = options

    const skip = (Math.max(1, page) - 1) * limit
    const dbNow = this.db?.hospitalEvent ? getNowBangkokForDb() : getNowBangkokForDbSql()

    if (this.db?.hospitalEvent) {
      const where: any = {}
      if (onlyUpcoming) where.eventEndDate = { gte: dbNow }
      else if (onlyCompleted) where.eventEndDate = { lt: dbNow }

      if (status && status !== 'ALL') where.status = status
      if (fiscalYear && fiscalYear !== 'ALL') where.fiscalYear = fiscalYear
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

      const includeConfig: any = {
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
          select: { registrations: true, attendances: true },
        },
      }

      if (memberId) {
        includeConfig.registrations = { where: { memberId }, select: { id: true } }
        includeConfig.attendances = { where: { memberId }, select: { id: true } }
      }

      let orderBy: any = { eventStartDate: 'asc' }
      if (onlyCompleted) orderBy = { eventEndDate: 'desc' }
      else if (onlyUpcoming) orderBy = { eventStartDate: 'asc' }
      else orderBy = [{ eventStartDate: 'desc' }]

      const [events, total] = await Promise.all([
        this.db.hospitalEvent.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: includeConfig,
        }),
        this.db.hospitalEvent.count({ where }),
      ])

      const mapped = events.map((ev: any) => {
        const isHeadOrganizer = memberId ? ev.headOrganizerId === memberId : false
        const isCoOrganizer = memberId ? ev.coOrganizers?.some((c: any) => c.memberId === memberId) : false
        const hasRegistered = memberId ? Boolean(Array.isArray(ev.registrations) && ev.registrations.length > 0) : false
        const hasAttended = memberId ? Boolean(Array.isArray(ev.attendances) && ev.attendances.length > 0) : false

        return {
          ...ev,
          eventStartDate: toBangkokIsoString(ev.eventStartDate) || ev.eventStartDate,
          eventEndDate: toBangkokIsoString(ev.eventEndDate) || ev.eventEndDate,
          checkinOpenTime: toBangkokIsoString(ev.checkinOpenTime) || ev.checkinOpenTime,
          checkinCloseTime: toBangkokIsoString(ev.checkinCloseTime) || ev.checkinCloseTime,
          registrationCount: ev._count?.registrations || 0,
          attendanceCount: ev._count?.attendances || 0,
          isOrganizer: isHeadOrganizer || isCoOrganizer,
          hasRegistered,
          hasAttended,
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

    // Gateway Named Endpoint implementation
    const { total: rawTotal, events: eventRows } = await this.gateway.listEventsV2({
      status,
      search,
      fiscalYear,
      memberId,
      onlyUpcoming,
      onlyCompleted,
      onlyMyEvents,
      onlyMyRegistrations,
      dbNow: typeof dbNow === 'string' ? dbNow : getNowBangkokForDbSql(),
      page,
      limit,
    })

    const total = Number(rawTotal || 0)

    const mapped = (eventRows || []).map((ev: any) => {
      const coRows = Array.isArray(ev.coRows) ? ev.coRows : []
      const isHeadOrganizer = memberId ? ev.headOrganizerId === memberId : false
      const isCoOrganizer = memberId ? coRows.some((c: any) => c.member_id === memberId) : false

      return {
        id: ev.id,
        title: ev.title,
        description: ev.description,
        location: ev.location,
        bannerUrl: ev.bannerUrl,
        eventStartDate: toBangkokIsoString(ev.eventStartDate) || ev.eventStartDate,
        eventEndDate: toBangkokIsoString(ev.eventEndDate) || ev.eventEndDate,
        checkinOpenTime: toBangkokIsoString(ev.checkinOpenTime) || ev.checkinOpenTime,
        checkinCloseTime: toBangkokIsoString(ev.checkinCloseTime) || ev.checkinCloseTime,
        headOrganizerId: ev.headOrganizerId,
        borrowRequestId: ev.borrowRequestId,
        qrToken: ev.qrToken,
        fiscalYear: ev.fiscalYear,
        status: ev.status,
        createdAt: ev.createdAt,
        updatedAt: ev.updatedAt,
        headOrganizer: ev.head_id ? { id: ev.head_id, name: ev.head_name, department: ev.head_dept, profilePath: ev.head_profile } : null,
        coOrganizers: coRows.map((c: any) => ({
          memberId: c.member_id,
          roleTitle: c.role_title,
          member: { id: c.id, name: c.name, department: c.department, profilePath: c.profilePath },
        })),
        registrationCount: Number(ev.registrationCount || 0),
        attendanceCount: Number(ev.attendanceCount || 0),
        isOrganizer: isHeadOrganizer || isCoOrganizer,
        hasRegistered: memberId ? Number(ev.userRegCount || 0) > 0 : false,
        hasAttended: memberId ? Number(ev.userAttCount || 0) > 0 : false,
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
    if (this.db?.hospitalEvent) {
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
            include: { items: true },
          },
          attachments: {
            include: {
              uploadedBy: {
                select: { id: true, name: true, department: true, profilePath: true },
              },
            },
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
          },
        },
      })

      if (!event) return null

      if (event.status !== 'CANCELLED') {
        const dbNow = getNowBangkokForDb()
        let nextStatus: string | null = null
        if (dbNow > event.eventEndDate && event.status !== 'COMPLETED') nextStatus = 'COMPLETED'
        else if (dbNow >= event.eventStartDate && dbNow <= event.eventEndDate && event.status === 'UPCOMING') nextStatus = 'ONGOING'

        if (nextStatus) {
          try {
            if (typeof this.db?.hospitalEvent?.update === 'function') {
              await this.db.hospitalEvent.update({ where: { id: event.id }, data: { status: nextStatus } })
            }
            event.status = nextStatus
          } catch (err) {
            logger.error({ err, eventId: event.id }, 'Failed to auto-update event status in getEventById')
          }
        }
      }

      const isHeadOrganizer = memberId ? event.headOrganizerId === memberId : false
      const isCoOrganizer = memberId ? event.coOrganizers?.some((c: any) => c.memberId === memberId) : false
      const hasRegistered = memberId ? event.registrations?.some((r: any) => r.memberId === memberId) : false
      const hasAttended = memberId ? event.attendances?.some((a: any) => a.memberId === memberId) : false

      return {
        ...event,
        eventStartDate: toBangkokIsoString(event.eventStartDate) || event.eventStartDate,
        eventEndDate: toBangkokIsoString(event.eventEndDate) || event.eventEndDate,
        checkinOpenTime: toBangkokIsoString(event.checkinOpenTime) || event.checkinOpenTime,
        checkinCloseTime: toBangkokIsoString(event.checkinCloseTime) || event.checkinCloseTime,
        attendances: (event.attendances || []).map((att: any) => ({
          ...att,
          checkedInAt: toBangkokIsoString(att.checkedInAt) || att.checkedInAt,
        })),
        registrations: (event.registrations || []).map((reg: any) => ({
          ...reg,
          registeredAt: toBangkokIsoString(reg.registeredAt) || reg.registeredAt,
        })),
        attachments: (event.attachments || []).map((att: any) => ({
          ...att,
          fileSize: att.fileSize ? Number(att.fileSize) : null,
          createdAt: toBangkokIsoString(att.createdAt) || att.createdAt,
          updatedAt: toBangkokIsoString(att.updatedAt) || att.updatedAt,
        })),
        registrationCount: event.registrations?.length || 0,
        attendanceCount: event.attendances?.length || 0,
        canManage: isHeadOrganizer || isCoOrganizer,
        hasRegistered,
        hasAttended,
      }
    }

    const bundle = await this.gateway.getEventByIdV2(id)
    if (!bundle || !bundle.event) return null
    const event: any = bundle.event

    // Just-in-Time status auto update
    if (event.status !== 'CANCELLED') {
      const dbNow = getNowBangkokForDb()
      const startDate = event.eventStartDate instanceof Date ? event.eventStartDate : new Date(event.eventStartDate)
      const endDate = event.eventEndDate instanceof Date ? event.eventEndDate : new Date(event.eventEndDate)
      let nextStatus: string | null = null
      if (!isNaN(endDate.getTime()) && dbNow > endDate && event.status !== 'COMPLETED') nextStatus = 'COMPLETED'
      else if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && dbNow >= startDate && dbNow <= endDate && event.status === 'UPCOMING') nextStatus = 'ONGOING'

      if (nextStatus) {
        await this.gateway.updateEventStatusV2(id, nextStatus)
        event.status = nextStatus
      }
    }

    const coRows: any[] = bundle.coRows || []
    const regRows: any[] = bundle.regRows || []
    const attRows: any[] = bundle.attRows || []
    const attachRows: any[] = bundle.attachRows || []
    const borrowRequest = bundle.borrowRequest || null

    const isHeadOrganizer = memberId ? event.headOrganizerId === memberId : false
    const isCoOrganizer = memberId ? coRows.some((c: any) => c.member_id === memberId) : false
    const hasRegistered = memberId ? regRows.some((r: any) => r.member_id === memberId) : false
    const hasAttended = memberId ? attRows.some((a: any) => a.member_id === memberId) : false

    return {
      ...event,
      eventStartDate: toBangkokIsoString(event.eventStartDate) || event.eventStartDate,
      eventEndDate: toBangkokIsoString(event.eventEndDate) || event.eventEndDate,
      checkinOpenTime: toBangkokIsoString(event.checkinOpenTime) || event.checkinOpenTime,
      checkinCloseTime: toBangkokIsoString(event.checkinCloseTime) || event.checkinCloseTime,
      headOrganizer: event.head_id ? { id: event.head_id, name: event.head_name, department: event.head_dept, profilePath: event.head_profile, position: event.head_pos } : null,
      coOrganizers: coRows.map((c: any) => ({
        memberId: c.member_id,
        roleTitle: c.role_title,
        member: { id: c.id, name: c.name, department: c.department, profilePath: c.profilePath, position: c.position },
      })),
      registrations: regRows.map((r: any) => ({
        id: r.id,
        eventId: r.event_id,
        memberId: r.member_id,
        registeredAt: toBangkokIsoString(r.registeredAt) || r.registeredAt,
        member: { id: r.m_id, name: r.m_name, department: r.m_department, profilePath: r.m_profile_path },
      })),
      attendances: attRows.map((a: any) => ({
        id: a.id,
        eventId: a.event_id,
        memberId: a.member_id,
        citizenId: a.citizen_id,
        pointsAwarded: a.pointsAwarded,
        checkedInAt: toBangkokIsoString(a.checkedInAt) || a.checkedInAt,
        member: { id: a.m_id, name: a.m_name, department: a.m_department, profilePath: a.m_profile_path },
      })),
      attachments: attachRows.map((r: any) => ({
        id: r.id,
        eventId: r.eventId,
        attachmentType: r.attachmentType,
        title: r.title,
        filePath: r.filePath,
        fileType: r.fileType,
        fileSize: r.fileSize ? Number(r.fileSize) : null,
        textContent: r.textContent,
        uploadedByMemberId: r.uploadedByMemberId,
        displayOrder: r.displayOrder,
        createdAt: toBangkokIsoString(r.createdAt) || r.createdAt,
        updatedAt: toBangkokIsoString(r.updatedAt) || r.updatedAt,
        uploadedBy: r.uploader_id ? {
          id: r.uploader_id,
          name: r.uploader_name,
          department: r.uploader_dept,
          profilePath: r.uploader_profile,
        } : null,
      })),
      borrowRequest,
      registrationCount: regRows.length,
      attendanceCount: attRows.length,
      canManage: isHeadOrganizer || isCoOrganizer,
      hasRegistered,
      hasAttended,
    }
  }

  async updateEvent(id: number, input: UpdateEventInput, actor: Actor) {
    if (this.db?.hospitalEvent) {
      const existing = await this.db.hospitalEvent.findUnique({
        where: { id },
        include: { coOrganizers: true },
      })

      if (!existing) throw new Error('ไม่พบข้อมูลกิจกรรม')

      const isAuthorized =
        actor.role === 'admin' ||
        existing.headOrganizerId === actor.id ||
        existing.coOrganizers?.some((c: any) => c.memberId === actor.id)

      if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์แก้ไขกิจกรรมนี้')

      const data: any = {}
      if (input.title !== undefined) data.title = input.title.trim()
      if (input.description !== undefined) data.description = input.description?.trim() || null
      if (input.location !== undefined) data.location = input.location?.trim() || null
      if (input.bannerUrl !== undefined) data.bannerUrl = input.bannerUrl?.trim() || null
      if (input.status !== undefined) data.status = input.status
      if (input.fiscalYear !== undefined) data.fiscalYear = input.fiscalYear

      if (input.eventStartDate !== undefined) data.eventStartDate = toDbThaiDateTime(input.eventStartDate)
      if (input.eventEndDate !== undefined) data.eventEndDate = toDbThaiDateTime(input.eventEndDate)
      if (input.checkinOpenTime !== undefined) data.checkinOpenTime = toDbThaiDateTime(input.checkinOpenTime)
      if (input.checkinCloseTime !== undefined) data.checkinCloseTime = toDbThaiDateTime(input.checkinCloseTime)

      return await this.db.$transaction(async (tx: any) => {
        const updated = await tx.hospitalEvent.update({ where: { id }, data })

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

        return {
          ...updated,
          eventStartDate: toBangkokIsoString(updated.eventStartDate) || updated.eventStartDate,
          eventEndDate: toBangkokIsoString(updated.eventEndDate) || updated.eventEndDate,
          checkinOpenTime: toBangkokIsoString(updated.checkinOpenTime) || updated.checkinOpenTime,
          checkinCloseTime: toBangkokIsoString(updated.checkinCloseTime) || updated.checkinCloseTime,
        }
      })
    }

    const fields: Record<string, unknown> = {}
    if (input.title !== undefined) fields.title = input.title.trim()
    if (input.description !== undefined) fields.description = input.description?.trim() || null
    if (input.location !== undefined) fields.location = input.location?.trim() || null
    if (input.bannerUrl !== undefined) fields.bannerUrl = input.bannerUrl?.trim() || null
    if (input.status !== undefined) fields.status = input.status
    if (input.fiscalYear !== undefined) fields.fiscalYear = input.fiscalYear
    if (input.eventStartDate !== undefined) fields.eventStartDate = toDbSqlDateTime(input.eventStartDate)
    if (input.eventEndDate !== undefined) fields.eventEndDate = toDbSqlDateTime(input.eventEndDate)
    if (input.checkinOpenTime !== undefined) fields.checkinOpenTime = toDbSqlDateTime(input.checkinOpenTime)
    if (input.checkinCloseTime !== undefined) fields.checkinCloseTime = toDbSqlDateTime(input.checkinCloseTime)

    const { title } = await this.gateway.updateEventV2(id, {
      fields,
      coOrganizerMemberIds: input.coOrganizerMemberIds,
      actor: actor as unknown as Record<string, unknown>,
    })

    try {
      await logAudit(
        'UPDATE',
        'hospital_events',
        `แก้ไขข้อมูลกิจกรรม: "${title}" (ID: ${id}) โดย ${actor.name || actor.username}`,
        { eventId: id, changes: input }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to write audit log for event update')
    }

    return this.getEventById(id)
  }

  async deleteEvent(id: number, actor: Actor) {
    if (this.db?.hospitalEvent) {
      const existing = await this.db.hospitalEvent.findUnique({
        where: { id },
        include: { coOrganizers: true },
      })
      if (!existing) throw new Error('ไม่พบข้อมูลกิจกรรม')

      const isAuthorized =
        actor.role === 'admin' ||
        existing.headOrganizerId === actor.id ||
        existing.coOrganizers?.some((c: any) => c.memberId === actor.id)

      if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์ลบกิจกรรมนี้')

      await this.db.hospitalEvent.delete({ where: { id } })

      try {
        await logAudit(
          'DELETE',
          'hospital_events',
          `ลบกิจกรรม: "${existing.title}" (ID: ${id}) โดย ${actor.name || actor.username || 'ผู้ดูแลระบบ'}`,
          { eventId: id, title: existing.title }
        )
      } catch (err) {
        logger.error({ err }, 'Failed to write audit log for event deletion')
      }

      return { success: true, message: 'ลบกิจกรรมเรียบร้อยแล้ว' }
    }

    const { title } = await this.gateway.deleteEventV2(id, actor as unknown as Record<string, unknown>)

    try {
      await logAudit(
        'DELETE',
        'hospital_events',
        `ลบกิจกรรม: "${title}" (ID: ${id}) โดย ${actor.name || actor.username || 'ผู้ดูแลระบบ'}`,
        { eventId: id, title }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to write audit log for event deletion')
    }

    return { success: true, message: 'ลบกิจกรรมเรียบร้อยแล้ว' }
  }

  async registerForEvent(eventId: number, memberId: number) {
    if (this.db?.hospitalEvent) {
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

    const res = await this.gateway.registerForEventV2(eventId, memberId)
    if (res.alreadyRegistered) {
      return { success: true, message: 'คุณได้ลงทะเบียนไว้แล้ว', registration: res.registration }
    }
    return { success: true, message: 'ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว', registration: res.registration }
  }

  async cancelRegistration(eventId: number, memberId: number) {
    if (this.db?.eventRegistration) {
      await this.db.eventRegistration.delete({
        where: { eventId_memberId: { eventId, memberId } },
      })
      return { success: true, message: 'ยกเลิกการลงทะเบียนเรียบร้อยแล้ว' }
    }

    await this.gateway.cancelEventRegistrationV2(eventId, memberId)
    return { success: true, message: 'ยกเลิกการลงทะเบียนเรียบร้อยแล้ว' }
  }

  async checkinViaThaid(
    qrToken: string,
    citizenId: string,
    options: { now?: Date; ipAddress?: string; userAgent?: string } = {}
  ) {
    const now = options.now || new Date()
    const sanitizedPid = citizenId.trim()

    if (this.db?.hospitalEvent) {
      const event = await this.db.hospitalEvent.findUnique({ where: { qrToken } })
      if (!event) throw new Error('ไม่พบข้อมูลกิจกรรมจาก QR Code นี้ หรือรหัสไม่ถูกต้อง')

      const windowCheck = validateCheckinWindow(event.checkinOpenTime, event.checkinCloseTime, now)
      if (windowCheck.isEarly) throw new Error(`ยังไม่ถึงเวลาเปิดรับสแกนเช็คอิน (เปิดรับสแกนเวลา ${windowCheck.openTimeStr})`)
      if (windowCheck.isLate) throw new Error(`หมดเวลาเช็คอินสำหรับกิจกรรมนี้แล้ว (ปิดรับสแกนเมื่อเวลา ${windowCheck.closeTimeStr})`)

      const member = await this.db.member.findUnique({
        where: { username: sanitizedPid },
        select: { id: true, name: true, department: true, position: true, username: true },
      })
      if (!member) throw new Error('ไม่พบข้อมูลบุคลากรในระบบ กรุณาติดต่อกลุ่มงานทรัพยากรบุคคลหรือลงทะเบียนสมาชิกโรงพยาบาลเถินก่อนเช็คอิน')

      const existingAttendance = await this.db.eventAttendance.findUnique({
        where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
      })
      if (existingAttendance) {
        const timeMatch = String(existingAttendance.checkedInAt).match(/[T ](\d{2}:\d{2})/)
        const checkedTime = timeMatch ? timeMatch[1] : new Date(existingAttendance.checkedInAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok', hour12: false })
        throw new Error(`ท่านได้เช็คอินเข้าร่วมกิจกรรมนี้ไปแล้วเมื่อเวลา ${checkedTime} น.`)
      }

      const attendance = await this.db.eventAttendance.create({
        data: {
          eventId: event.id,
          memberId: member.id,
          citizenId: sanitizedPid,
          pointsAwarded: 1,
          checkedInAt: toDbThaiDateTime(now) || now,
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
        event: { id: event.id, title: event.title, location: event.location },
        member: { id: member.id, name: member.name, department: member.department, position: member.position },
        checkedInAt: toBangkokIsoString(attendance.checkedInAt) || attendance.checkedInAt,
        pointsAwarded: 1,
      }
    }

    const event: any = await this.gateway.getEventByQrTokenV2(qrToken)
    if (!event) throw new Error('ไม่พบข้อมูลกิจกรรมจาก QR Code นี้ หรือรหัสไม่ถูกต้อง')

    const windowCheck = validateCheckinWindow(event.checkinOpenTime, event.checkinCloseTime, now)
    if (windowCheck.isEarly) throw new Error(`ยังไม่ถึงเวลาเปิดรับสแกนเช็คอิน (เปิดรับสแกนเวลา ${windowCheck.openTimeStr})`)
    if (windowCheck.isLate) throw new Error(`หมดเวลาเช็คอินสำหรับกิจกรรมนี้แล้ว (ปิดรับสแกนเมื่อเวลา ${windowCheck.closeTimeStr})`)

    const dbThaiNow = toDbThaiDateTime(now)
    const checkedInAt = dbThaiNow ? toDbSqlDateTime(dbThaiNow)! : getNowBangkokForDbSql()
    const checkinRes = await this.gateway.checkinEventViaThaidV2({
      eventId: Number(event.id),
      citizenId: sanitizedPid,
      checkedInAt,
    })

    if (checkinRes.duplicate) {
      const existingAt = checkinRes.existingCheckedInAt
      const timeMatch = String(existingAt).match(/[T ](\d{2}:\d{2})/)
      const checkedTime = timeMatch
        ? timeMatch[1]
        : new Date(String(existingAt)).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok', hour12: false })
      throw new Error(`ท่านได้เช็คอินเข้าร่วมกิจกรรมนี้ไปแล้วเมื่อเวลา ${checkedTime} น.`)
    }

    const member: any = checkinRes.member

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
      event: { id: event.id, title: event.title, location: event.location },
      member: { id: member.id, name: member.name, department: member.department, position: member.position },
      checkedInAt: toBangkokIsoString(checkedInAt) || checkedInAt,
      pointsAwarded: 1,
    }
  }

  async addManualAttendance(
    eventId: number,
    data: { memberId: number; pointsAwarded?: number; checkedInAt?: Date | string; note?: string },
    actor: Actor
  ) {
    if (this.db?.hospitalEvent) {
      const event = await this.db.hospitalEvent.findUnique({
        where: { id: eventId },
        include: { coOrganizers: true },
      })
      if (!event) throw new Error('ไม่พบข้อมูลกิจกรรม')

      const isAuthorized =
        actor.role === 'admin' ||
        event.headOrganizerId === actor.id ||
        event.coOrganizers?.some((c: any) => c.memberId === actor.id)
      if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้')

      const member = await this.db.member.findUnique({
        where: { id: data.memberId },
        select: { id: true, name: true, department: true, position: true, username: true },
      })
      if (!member) throw new Error('ไม่พบข้อมูลบุคลากรที่ระบุ')

      const existing = await this.db.eventAttendance.findUnique({
        where: { eventId_memberId: { eventId, memberId: member.id } },
      })
      if (existing) throw new Error(`${member.name || 'บุคลากรท่านนี้'} มีรายชื่อเข้าร่วมกิจกรรมนี้แล้ว`)

      const attendance = await this.db.eventAttendance.create({
        data: {
          eventId,
          memberId: member.id,
          citizenId: member.username,
          pointsAwarded: data.pointsAwarded !== undefined ? data.pointsAwarded : 1,
          checkedInAt: data.checkedInAt ? toDbThaiDateTime(data.checkedInAt)! : (toDbThaiDateTime(new Date()) || new Date()),
        },
        include: {
          member: { select: { id: true, name: true, department: true, position: true, profilePath: true } },
        },
      })

      try {
        await logAudit(
          'CREATE',
          'event_attendances',
          `ผู้ดูแลเพิ่มผู้เข้าร่วมงาน: ${member.name} ในกิจกรรม "${event.title}" (+${attendance.pointsAwarded} คะแนน) โดย ${actor.name || actor.username}`,
          { eventId, memberId: member.id, attendanceId: attendance.id, addedBy: actor.id, note: data.note }
        )
      } catch (err) {
        logger.error({ err }, 'Failed to log manual attendance audit')
      }

      return {
        ...attendance,
        checkedInAt: toBangkokIsoString(attendance.checkedInAt) || attendance.checkedInAt,
      }
    }

    const checkedInAt = data.checkedInAt
      ? (toDbSqlDateTime(toDbThaiDateTime(data.checkedInAt)) || getNowBangkokForDbSql())
      : getNowBangkokForDbSql()
    const pointsAwarded = data.pointsAwarded !== undefined ? data.pointsAwarded : 1

    const res = await this.gateway.addEventAttendanceV2(eventId, {
      memberId: data.memberId,
      pointsAwarded,
      checkedInAt,
      actor: actor as unknown as Record<string, unknown>,
    })
    const member: any = res.member

    try {
      await logAudit(
        'CREATE',
        'event_attendances',
        `ผู้ดูแลเพิ่มผู้เข้าร่วมงาน: ${member.name} ในกิจกรรม "${res.eventTitle}" (+${pointsAwarded} คะแนน) โดย ${actor.name || actor.username}`,
        { eventId, memberId: member.id, attendanceId: res.id, addedBy: actor.id, note: data.note }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to log manual attendance audit')
    }

    return {
      id: res.id,
      eventId,
      memberId: member.id,
      citizenId: member.username,
      pointsAwarded,
      checkedInAt: toBangkokIsoString(checkedInAt) || checkedInAt,
      member: { id: member.id, name: member.name, department: member.department, position: member.position, profilePath: member.profilePath },
    }
  }

  async updateAttendance(
    eventId: number,
    attendanceId: number,
    data: { pointsAwarded?: number; checkedInAt?: Date | string },
    actor: Actor
  ) {
    if (this.db?.hospitalEvent) {
      const event = await this.db.hospitalEvent.findUnique({
        where: { id: eventId },
        include: { coOrganizers: true },
      })
      if (!event) throw new Error('ไม่พบข้อมูลกิจกรรม')

      const isAuthorized =
        actor.role === 'admin' ||
        event.headOrganizerId === actor.id ||
        event.coOrganizers?.some((c: any) => c.memberId === actor.id)
      if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้')

      const existing = await this.db.eventAttendance.findUnique({
        where: { id: attendanceId },
        include: { member: { select: { id: true, name: true } } },
      })
      if (!existing || existing.eventId !== eventId) throw new Error('ไม่พบข้อมูลการเข้าร่วมกิจกรรมที่ต้องการแก้ไข')

      const updated = await this.db.eventAttendance.update({
        where: { id: attendanceId },
        data: {
          ...(data.pointsAwarded !== undefined && { pointsAwarded: data.pointsAwarded }),
          ...(data.checkedInAt && { checkedInAt: toDbThaiDateTime(data.checkedInAt)! }),
        },
        include: {
          member: { select: { id: true, name: true, department: true, position: true, profilePath: true } },
        },
      })

      try {
        await logAudit(
          'UPDATE',
          'event_attendances',
          `ผู้ดูแลแก้ไขข้อมูลการเข้าร่วม: ${existing.member?.name} ในกิจกรรม "${event.title}" (คะแนน: ${updated.pointsAwarded}) โดย ${actor.name || actor.username}`,
          { eventId, attendanceId, changes: data, updatedBy: actor.id }
        )
      } catch (err) {
        logger.error({ err }, 'Failed to log attendance update audit')
      }

      return {
        ...updated,
        checkedInAt: toBangkokIsoString(updated.checkedInAt) || updated.checkedInAt,
      }
    }

    const res = await this.gateway.updateEventAttendanceV2(eventId, attendanceId, {
      pointsAwarded: data.pointsAwarded,
      checkedInAt: data.checkedInAt ? (toDbSqlDateTime(toDbThaiDateTime(data.checkedInAt)) || undefined) : undefined,
      actor: actor as unknown as Record<string, unknown>,
    })

    try {
      await logAudit(
        'UPDATE',
        'event_attendances',
        `ผู้ดูแลแก้ไขข้อมูลการเข้าร่วม: ${res.memberName} ในกิจกรรม "${res.eventTitle}" (คะแนน: ${data.pointsAwarded}) โดย ${actor.name || actor.username}`,
        { eventId, attendanceId, changes: data, updatedBy: actor.id }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to log attendance update audit')
    }

    const row: any = res.row
    return {
      id: row.id,
      eventId: row.eventId,
      memberId: row.memberId,
      citizenId: row.citizenId,
      pointsAwarded: row.pointsAwarded,
      checkedInAt: toBangkokIsoString(row.checkedInAt) || row.checkedInAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      member: {
        id: row.m_id,
        name: row.name,
        department: row.department,
        position: row.position,
        profilePath: row.profilePath,
      },
    }
  }

  async deleteAttendance(eventId: number, attendanceId: number, actor: Actor) {
    if (this.db?.hospitalEvent) {
      const event = await this.db.hospitalEvent.findUnique({
        where: { id: eventId },
        include: { coOrganizers: true },
      })
      if (!event) throw new Error('ไม่พบข้อมูลกิจกรรม')

      const isAuthorized =
        actor.role === 'admin' ||
        event.headOrganizerId === actor.id ||
        event.coOrganizers?.some((c: any) => c.memberId === actor.id)
      if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้')

      const existing = await this.db.eventAttendance.findUnique({
        where: { id: attendanceId },
        include: { member: { select: { id: true, name: true } } },
      })
      if (!existing || existing.eventId !== eventId) throw new Error('ไม่พบข้อมูลการเข้าร่วมกิจกรรมที่ต้องการลบ')

      await this.db.eventAttendance.delete({ where: { id: attendanceId } })

      try {
        await logAudit(
          'DELETE',
          'event_attendances',
          `ผู้ดูแลลบรายชื่อผู้เข้าร่วม: ${existing.member?.name} ออกจากกิจกรรม "${event.title}" โดย ${actor.name || actor.username}`,
          { eventId, attendanceId, memberId: existing.memberId, deletedBy: actor.id }
        )
      } catch (err) {
        logger.error({ err }, 'Failed to log attendance delete audit')
      }

      return { success: true, message: 'ลบรายชื่อผู้เข้าร่วมเรียบร้อยแล้ว' }
    }

    const res = await this.gateway.deleteEventAttendanceV2(
      eventId,
      attendanceId,
      actor as unknown as Record<string, unknown>
    )

    try {
      await logAudit(
        'DELETE',
        'event_attendances',
        `ผู้ดูแลลบรายชื่อผู้เข้าร่วม: ${res.memberName} ออกจากกิจกรรม "${res.eventTitle}" โดย ${actor.name || actor.username}`,
        { eventId, attendanceId, memberId: res.memberId, deletedBy: actor.id }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to log attendance delete audit')
    }

    return { success: true, message: 'ลบรายชื่อผู้เข้าร่วมเรียบร้อยแล้ว' }
  }

  async getAttachments(eventId: number) {
    if (this.db?.eventAttachment) {
      const list = await this.db.eventAttachment.findMany({
        where: { eventId },
        include: {
          uploadedBy: {
            select: { id: true, name: true, department: true, profilePath: true },
          },
        },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      })
      return list.map((item: any) => ({
        ...item,
        fileSize: item.fileSize ? Number(item.fileSize) : null,
        createdAt: toBangkokIsoString(item.createdAt) || item.createdAt,
        updatedAt: toBangkokIsoString(item.updatedAt) || item.updatedAt,
      }))
    }

    const rows = await this.gateway.getEventAttachmentsV2(eventId)

    return (rows || []).map((r: any) => ({
      id: r.id,
      eventId: r.eventId,
      attachmentType: r.attachmentType,
      title: r.title,
      filePath: r.filePath,
      fileType: r.fileType,
      fileSize: r.fileSize ? Number(r.fileSize) : null,
      textContent: r.textContent,
      uploadedByMemberId: r.uploadedByMemberId,
      displayOrder: r.displayOrder,
      createdAt: toBangkokIsoString(r.createdAt) || r.createdAt,
      updatedAt: toBangkokIsoString(r.updatedAt) || r.updatedAt,
      uploadedBy: r.uploader_id ? {
        id: r.uploader_id,
        name: r.uploader_name,
        department: r.uploader_dept,
        profilePath: r.uploader_profile,
      } : null,
    }))
  }

  async addAttachment(eventId: number, input: AddEventAttachmentInput, actor: Actor) {
    const event = await this.getEventById(eventId)
    if (!event) throw new Error('ไม่พบข้อมูลกิจกรรม')

    if (!actor.id) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนดำเนินการ')
    }

    const isOrganizer =
      actor.role === 'admin' ||
      event.headOrganizerId === actor.id ||
      event.coOrganizers?.some((c: any) => c.member?.id === actor.id || c.memberId === actor.id)

    const isImageUpload = input.attachmentType === 'IMAGE'

    // Allow all authenticated members to upload activity photos (IMAGE).
    // Restrict DOCUMENT and NOTE creation to organizers and admins.
    if (!isOrganizer && !isImageUpload) {
      throw new Error('คุณไม่มีสิทธิ์แนบเอกสารหรือรูปภาพในกิจกรรมนี้')
    }

    if (!input.title || !input.title.trim()) {
      throw new Error('กรุณาระบุชื่อไฟล์หรือหัวข้อบันทึก')
    }

    if (this.db?.eventAttachment) {
      const created = await this.db.eventAttachment.create({
        data: {
          eventId,
          attachmentType: input.attachmentType,
          title: input.title.trim(),
          filePath: input.filePath || null,
          fileType: input.fileType || null,
          fileSize: input.fileSize ? BigInt(input.fileSize) : null,
          textContent: input.textContent?.trim() || null,
          uploadedByMemberId: actor.id,
          displayOrder: input.displayOrder ?? 0,
        },
        include: {
          uploadedBy: {
            select: { id: true, name: true, department: true, profilePath: true },
          },
        },
      })

      return {
        ...created,
        fileSize: created.fileSize ? Number(created.fileSize) : null,
        createdAt: toBangkokIsoString(created.createdAt) || created.createdAt,
        updatedAt: toBangkokIsoString(created.updatedAt) || created.updatedAt,
      }
    }

    const res = await this.gateway.addEventAttachmentV2(eventId, {
      attachmentType: input.attachmentType,
      title: input.title.trim(),
      filePath: input.filePath || null,
      fileType: input.fileType || null,
      fileSize: input.fileSize ? Number(input.fileSize) : null,
      textContent: input.textContent?.trim() || null,
      uploadedByMemberId: actor.id,
      displayOrder: input.displayOrder ?? 0,
    })

    const insertId = res?.insertId
    const list = await this.getAttachments(eventId)
    return list.find((a: any) => a.id === insertId) || list[0]
  }

  async deleteAttachment(eventId: number, attachmentId: number, actor: Actor) {
    const event = await this.getEventById(eventId)
    if (!event) throw new Error('ไม่พบข้อมูลกิจกรรม')

    if (!actor.id) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนดำเนินการ')
    }

    const isOrganizer =
      actor.role === 'admin' ||
      event.headOrganizerId === actor.id ||
      event.coOrganizers?.some((c: any) => c.member?.id === actor.id || c.memberId === actor.id)

    let filePathToDelete: string | null = null

    if (this.db?.eventAttachment) {
      const existing = await this.db.eventAttachment.findUnique({
        where: { id: attachmentId },
      })
      if (!existing || existing.eventId !== eventId) {
        throw new Error('ไม่พบข้อมูลเอกสารหรือไฟล์แนบที่ต้องการลบ')
      }

      const isUploader = Boolean(actor.id && existing.uploadedByMemberId === actor.id)
      if (!isOrganizer && !isUploader) {
        throw new Error('คุณไม่มีสิทธิ์ลบเอกสารหรือรูปภาพในกิจกรรมนี้')
      }

      filePathToDelete = existing.filePath
      await this.db.eventAttachment.delete({ where: { id: attachmentId } })
    } else {
      const delRes = await this.gateway.deleteEventAttachmentV2(eventId, attachmentId, {
        actor: actor as unknown as Record<string, unknown>,
        isOrganizer: Boolean(isOrganizer),
      })
      filePathToDelete = delRes.filePath
    }

    if (filePathToDelete) {
      try {
        const { DocumentStorage } = await import('@/lib/storage/documentStorage')
        await DocumentStorage.delete(filePathToDelete)
      } catch (err) {
        logger.warn({ err, filePath: filePathToDelete }, 'Failed to delete attachment physical file')
      }
    }

    return { success: true, message: 'ลบเอกสารหรือไฟล์แนบเรียบร้อยแล้ว' }
  }

  async getEventCheckinTargetByQrToken(token: string): Promise<{
    id: number
    title: string
    qrToken: string
    checkinOpenTime: Date | string
    checkinCloseTime: Date | string
  } | null> {
    const row = await this.gateway.getEventByQrTokenV2(token)
    return (row as any) ?? null
  }

  async getMemberEventParticipationStats(memberId: number): Promise<{
    totalPoints: number
    registeredCount: number
  }> {
    return this.gateway.getEventMemberStatsV2(memberId)
  }

  async getEventCreationPreloadData(excludeMemberId: number): Promise<{
    loanableMaterials: any[]
    loanableAssets: any[]
    hospitalMembers: any[]
  }> {
    const { materials, assets, members } = await this.gateway.getEventsPreloadV2()
    return {
      loanableMaterials: materials || [],
      loanableAssets: assets || [],
      hospitalMembers: (members || []).filter((m: any) => m.name && m.id !== excludeMemberId),
    }
  }

  async listAvailableMembersForPicker(): Promise<any[]> {
    return this.gateway.getEventsMembersPickerV2()
  }
}
