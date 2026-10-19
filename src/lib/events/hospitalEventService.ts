import crypto from 'crypto'
import { queryMemberDb } from '@/lib/memberDb'
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
    private readonly queryExecutor: (sql: string, params?: any[]) => Promise<any[]> = queryMemberDb
  ) {}

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

    // Zero-DB Gateway Production Implementation
    let borrowRequestId: number | null = null
    if (input.borrowItems && input.borrowItems.length > 0) {
      const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
      const rand4 = Math.floor(1000 + Math.random() * 9000)
      const requestNo = `BR-${yyyymm}-${rand4}`

      const borrowRes: any = await this.queryExecutor(`
        INSERT INTO equipment_borrow_requests (
          request_no, requester_id, requester_name, requester_dept,
          purpose, location, borrow_date, expected_return_date, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())
      `, [
        requestNo,
        actor.id,
        actor.name || 'บุคลากรโรงพยาบาลเถิน',
        actor.department || null,
        `สำหรับกิจกรรม: ${input.title.trim()}`,
        input.location?.trim() || null,
        toDbSqlDateTime(startDate),
        toDbSqlDateTime(endDate),
      ])
      borrowRequestId = borrowRes.insertId

      for (const item of input.borrowItems) {
        await this.queryExecutor(`
          INSERT INTO equipment_borrow_items (
            request_id, item_type, asset_id, material_id,
            item_name, item_code, quantity, status, returned_qty,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, NOW(), NOW())
        `, [
          borrowRequestId,
          item.itemType,
          item.assetId || null,
          item.materialId || null,
          item.itemName,
          item.itemCode || null,
          item.quantity || 1,
        ])
      }
    }

    const eventRes: any = await this.queryExecutor(`
      INSERT INTO hospital_events (
        title, description, location, banner_url,
        event_start_date, event_end_date, checkin_open_time, checkin_close_time,
        head_organizer_id, borrow_request_id, qr_token, fiscal_year, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPCOMING', NOW(), NOW())
    `, [
      input.title.trim(),
      input.description?.trim() || null,
      input.location?.trim() || null,
      input.bannerUrl?.trim() || null,
      toDbSqlDateTime(startDate),
      toDbSqlDateTime(endDate),
      toDbSqlDateTime(checkinOpen),
      toDbSqlDateTime(checkinClose),
      actor.id,
      borrowRequestId,
      qrToken,
      fiscalYear,
    ])
    const eventId = eventRes.insertId

    if (input.coOrganizerMemberIds && input.coOrganizerMemberIds.length > 0) {
      const uniqueIds = Array.from(new Set(input.coOrganizerMemberIds.filter((id) => id !== actor.id)))
      for (const mId of uniqueIds) {
        await this.queryExecutor(`
          INSERT INTO event_organizers (event_id, member_id, role_title)
          VALUES (?, ?, 'ผู้รับผิดชอบร่วม')
        `, [eventId, mId])
      }
    }

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
      const [compRes, onRes]: any = await Promise.all([
        this.queryExecutor(
          "UPDATE hospital_events SET status = 'COMPLETED', updated_at = NOW() WHERE status IN ('UPCOMING', 'ONGOING') AND event_end_date < ?",
          [dbNow]
        ),
        this.queryExecutor(
          "UPDATE hospital_events SET status = 'ONGOING', updated_at = NOW() WHERE status = 'UPCOMING' AND event_start_date <= ? AND event_end_date >= ?",
          [dbNow, dbNow]
        ),
      ])

      return {
        updatedToCompleted: compRes?.affectedRows || 0,
        updatedToOngoing: onRes?.affectedRows || 0,
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

    // Gateway implementation
    const whereClauses: string[] = []
    const params: any[] = []

    if (onlyUpcoming) {
      whereClauses.push('e.event_end_date >= ?')
      params.push(dbNow)
    } else if (onlyCompleted) {
      whereClauses.push('e.event_end_date < ?')
      params.push(dbNow)
    }

    if (status && status !== 'ALL') {
      whereClauses.push('e.status = ?')
      params.push(status)
    }
    if (fiscalYear && fiscalYear !== 'ALL') {
      whereClauses.push('e.fiscal_year = ?')
      params.push(fiscalYear)
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      whereClauses.push('(e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)')
      params.push(q, q, q)
    }
    if (onlyMyEvents && memberId) {
      whereClauses.push('(e.head_organizer_id = ? OR EXISTS (SELECT 1 FROM event_organizers WHERE event_id = e.id AND member_id = ?))')
      params.push(memberId, memberId)
    }
    if (onlyMyRegistrations && memberId) {
      whereClauses.push('EXISTS (SELECT 1 FROM event_registrations WHERE event_id = e.id AND member_id = ?)')
      params.push(memberId)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    let sortSql = 'e.event_start_date DESC'
    if (onlyCompleted) sortSql = 'e.event_end_date DESC'
    else if (onlyUpcoming) sortSql = 'e.event_start_date ASC'

    const [countRows, eventRows] = await Promise.all([
      this.queryExecutor(`SELECT COUNT(*) AS total FROM hospital_events e ${whereSql}`, params),
      this.queryExecutor(`
        SELECT 
          e.id, e.title, e.description, e.location, e.banner_url AS bannerUrl,
          e.event_start_date AS eventStartDate, e.event_end_date AS eventEndDate,
          e.checkin_open_time AS checkinOpenTime, e.checkin_close_time AS checkinCloseTime,
          e.head_organizer_id AS headOrganizerId, e.borrow_request_id AS borrowRequestId,
          e.qr_token AS qrToken, e.fiscal_year AS fiscalYear, e.status,
          e.created_at AS createdAt, e.updated_at AS updatedAt,
          m.id AS head_id, m.name AS head_name, m.department AS head_dept, m.profile_path AS head_profile,
          (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) AS registrationCount,
          (SELECT COUNT(*) FROM event_attendances WHERE event_id = e.id) AS attendanceCount
          ${memberId ? `, (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND member_id = ${Number(memberId)}) AS userRegCount` : ''}
          ${memberId ? `, (SELECT COUNT(*) FROM event_attendances WHERE event_id = e.id AND member_id = ${Number(memberId)}) AS userAttCount` : ''}
        FROM hospital_events e
        LEFT JOIN members m ON e.head_organizer_id = m.id
        ${whereSql}
        ORDER BY ${sortSql}
        LIMIT ? OFFSET ?
      `, [...params, limit, skip]),
    ])

    const total = Number(countRows[0]?.total || 0)

    const mapped = await Promise.all(
      eventRows.map(async (ev: any) => {
        const coRows = await this.queryExecutor(`
          SELECT o.member_id, o.role_title, m.id, m.name, m.department, m.profile_path AS profilePath
          FROM event_organizers o
          JOIN members m ON o.member_id = m.id
          WHERE o.event_id = ?
        `, [ev.id])

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
    )

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
        registrationCount: event.registrations?.length || 0,
        attendanceCount: event.attendances?.length || 0,
        canManage: isHeadOrganizer || isCoOrganizer,
        hasRegistered,
        hasAttended,
      }
    }

    const rows = await this.queryExecutor(`
      SELECT 
        e.id, e.title, e.description, e.location, e.banner_url AS bannerUrl,
        e.event_start_date AS eventStartDate, e.event_end_date AS eventEndDate,
        e.checkin_open_time AS checkinOpenTime, e.checkin_close_time AS checkinCloseTime,
        e.head_organizer_id AS headOrganizerId, e.borrow_request_id AS borrowRequestId,
        e.qr_token AS qrToken, e.fiscal_year AS fiscalYear, e.status,
        e.created_at AS createdAt, e.updated_at AS updatedAt,
        m.id AS head_id, m.name AS head_name, m.department AS head_dept, m.profile_path AS head_profile, m.position AS head_pos
      FROM hospital_events e
      LEFT JOIN members m ON e.head_organizer_id = m.id
      WHERE e.id = ?
      LIMIT 1
    `, [id])

    if (rows.length === 0) return null
    const event = rows[0]

    // Just-in-Time status auto update
    if (event.status !== 'CANCELLED') {
      const dbNow = getNowBangkokForDb()
      let nextStatus: string | null = null
      if (dbNow > event.eventEndDate && event.status !== 'COMPLETED') nextStatus = 'COMPLETED'
      else if (dbNow >= event.eventStartDate && dbNow <= event.eventEndDate && event.status === 'UPCOMING') nextStatus = 'ONGOING'

      if (nextStatus) {
        await this.queryExecutor('UPDATE hospital_events SET status = ?, updated_at = NOW() WHERE id = ?', [nextStatus, id])
        event.status = nextStatus
      }
    }

    const [coRows, regRows, attRows, borrowRows] = await Promise.all([
      this.queryExecutor(`
        SELECT o.member_id, o.role_title, m.id, m.name, m.department, m.profile_path AS profilePath, m.position
        FROM event_organizers o
        JOIN members m ON o.member_id = m.id
        WHERE o.event_id = ?
      `, [id]),
      this.queryExecutor(`
        SELECT r.id, r.event_id, r.member_id, r.registered_at AS registeredAt,
          m.id AS m_id, m.name AS m_name, m.department AS m_department, m.profile_path AS m_profile_path
        FROM event_registrations r
        JOIN members m ON r.member_id = m.id
        WHERE r.event_id = ?
        ORDER BY r.registered_at DESC
      `, [id]),
      this.queryExecutor(`
        SELECT a.id, a.event_id, a.member_id, a.citizen_id, a.checked_in_at AS checkedInAt, a.points_awarded AS pointsAwarded,
          m.id AS m_id, m.name AS m_name, m.department AS m_department, m.profile_path AS m_profile_path
        FROM event_attendances a
        JOIN members m ON a.member_id = m.id
        WHERE a.event_id = ?
        ORDER BY a.checked_in_at DESC
      `, [id]),
      event.borrowRequestId
        ? this.queryExecutor('SELECT * FROM equipment_borrow_requests WHERE id = ?', [event.borrowRequestId])
        : Promise.resolve([]),
    ])

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
      borrowRequest: borrowRows[0] || null,
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

    const existingRows = await this.queryExecutor('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ?', [id])
    if (existingRows.length === 0) throw new Error('ไม่พบข้อมูลกิจกรรม')
    const existing = existingRows[0]

    const coRows = await this.queryExecutor('SELECT member_id FROM event_organizers WHERE event_id = ?', [id])
    const isAuthorized =
      actor.role === 'admin' ||
      existing.head_organizer_id === actor.id ||
      coRows.some((c: any) => c.member_id === actor.id)

    if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์แก้ไขกิจกรรมนี้')

    const fields: string[] = []
    const params: any[] = []

    if (input.title !== undefined) { fields.push('title = ?'); params.push(input.title.trim()) }
    if (input.description !== undefined) { fields.push('description = ?'); params.push(input.description?.trim() || null) }
    if (input.location !== undefined) { fields.push('location = ?'); params.push(input.location?.trim() || null) }
    if (input.bannerUrl !== undefined) { fields.push('banner_url = ?'); params.push(input.bannerUrl?.trim() || null) }
    if (input.status !== undefined) { fields.push('status = ?'); params.push(input.status) }
    if (input.fiscalYear !== undefined) { fields.push('fiscal_year = ?'); params.push(input.fiscalYear) }
    if (input.eventStartDate !== undefined) { fields.push('event_start_date = ?'); params.push(toDbSqlDateTime(input.eventStartDate)) }
    if (input.eventEndDate !== undefined) { fields.push('event_end_date = ?'); params.push(toDbSqlDateTime(input.eventEndDate)) }
    if (input.checkinOpenTime !== undefined) { fields.push('checkin_open_time = ?'); params.push(toDbSqlDateTime(input.checkinOpenTime)) }
    if (input.checkinCloseTime !== undefined) { fields.push('checkin_close_time = ?'); params.push(toDbSqlDateTime(input.checkinCloseTime)) }

    if (fields.length > 0) {
      fields.push('updated_at = NOW()')
      params.push(id)
      await this.queryExecutor(`UPDATE hospital_events SET ${fields.join(', ')} WHERE id = ?`, params)
    }

    if (input.coOrganizerMemberIds !== undefined) {
      await this.queryExecutor('DELETE FROM event_organizers WHERE event_id = ?', [id])
      const uniqueIds = Array.from(new Set(input.coOrganizerMemberIds.filter((mId) => mId !== existing.head_organizer_id)))
      for (const mId of uniqueIds) {
        await this.queryExecutor("INSERT INTO event_organizers (event_id, member_id, role_title) VALUES (?, ?, 'ผู้รับผิดชอบร่วม')", [id, mId])
      }
    }

    try {
      await logAudit(
        'UPDATE',
        'hospital_events',
        `แก้ไขข้อมูลกิจกรรม: "${input.title || existing.title}" (ID: ${id}) โดย ${actor.name || actor.username}`,
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

    const rows = await this.queryExecutor('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ?', [id])
    if (rows.length === 0) throw new Error('ไม่พบข้อมูลกิจกรรม')
    const existing = rows[0]

    const coRows = await this.queryExecutor('SELECT member_id FROM event_organizers WHERE event_id = ?', [id])
    const isAuthorized =
      actor.role === 'admin' ||
      existing.head_organizer_id === actor.id ||
      coRows.some((c: any) => c.member_id === actor.id)

    if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์ลบกิจกรรมนี้')

    await this.queryExecutor('DELETE FROM event_attendances WHERE event_id = ?', [id])
    await this.queryExecutor('DELETE FROM event_registrations WHERE event_id = ?', [id])
    await this.queryExecutor('DELETE FROM event_organizers WHERE event_id = ?', [id])
    await this.queryExecutor('DELETE FROM hospital_events WHERE id = ?', [id])

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

    const eventRows = await this.queryExecutor('SELECT id, status FROM hospital_events WHERE id = ?', [eventId])
    if (eventRows.length === 0) throw new Error('ไม่พบข้อมูลกิจกรรม')
    const event = eventRows[0]
    if (event.status === 'COMPLETED' || event.status === 'CANCELLED') {
      throw new Error('ไม่สามารถลงทะเบียนกิจกรรมที่สิ้นสุดหรือถูกยกเลิกแล้ว')
    }

    const regRows = await this.queryExecutor('SELECT id FROM event_registrations WHERE event_id = ? AND member_id = ?', [eventId, memberId])
    if (regRows.length > 0) {
      return { success: true, message: 'คุณได้ลงทะเบียนไว้แล้ว', registration: regRows[0] }
    }

    const res: any = await this.queryExecutor('INSERT INTO event_registrations (event_id, member_id, registered_at) VALUES (?, ?, NOW())', [eventId, memberId])
    return { success: true, message: 'ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว', registration: { id: res.insertId, eventId, memberId } }
  }

  async cancelRegistration(eventId: number, memberId: number) {
    if (this.db?.eventRegistration) {
      await this.db.eventRegistration.delete({
        where: { eventId_memberId: { eventId, memberId } },
      })
      return { success: true, message: 'ยกเลิกการลงทะเบียนเรียบร้อยแล้ว' }
    }

    await this.queryExecutor('DELETE FROM event_registrations WHERE event_id = ? AND member_id = ?', [eventId, memberId])
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
        const checkedTime = new Date(existingAttendance.checkedInAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
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
        checkedInAt: attendance.checkedInAt,
        pointsAwarded: 1,
      }
    }

    const eventRows = await this.queryExecutor('SELECT id, title, location, checkin_open_time, checkin_close_time FROM hospital_events WHERE qr_token = ?', [qrToken])
    if (eventRows.length === 0) throw new Error('ไม่พบข้อมูลกิจกรรมจาก QR Code นี้ หรือรหัสไม่ถูกต้อง')
    const event = eventRows[0]

    const windowCheck = validateCheckinWindow(event.checkin_open_time, event.checkin_close_time, now)
    if (windowCheck.isEarly) throw new Error(`ยังไม่ถึงเวลาเปิดรับสแกนเช็คอิน (เปิดรับสแกนเวลา ${windowCheck.openTimeStr})`)
    if (windowCheck.isLate) throw new Error(`หมดเวลาเช็คอินสำหรับกิจกรรมนี้แล้ว (ปิดรับสแกนเมื่อเวลา ${windowCheck.closeTimeStr})`)

    const memberRows = await this.queryExecutor('SELECT id, name, department, position, username FROM members WHERE username = ?', [sanitizedPid])
    if (memberRows.length === 0) throw new Error('ไม่พบข้อมูลบุคลากรในระบบ กรุณาติดต่อกลุ่มงานทรัพยากรบุคคลหรือลงทะเบียนสมาชิกโรงพยาบาลเถินก่อนเช็คอิน')
    const member = memberRows[0]

    const attRows = await this.queryExecutor('SELECT id, checked_in_at FROM event_attendances WHERE event_id = ? AND member_id = ?', [event.id, member.id])
    if (attRows.length > 0) {
      const checkedTime = new Date(attRows[0].checked_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      throw new Error(`ท่านได้เช็คอินเข้าร่วมกิจกรรมนี้ไปแล้วเมื่อเวลา ${checkedTime} น.`)
    }

    const checkedInAt = toDbSqlDateTime(now) || getNowBangkokForDbSql()
    await this.queryExecutor(`
      INSERT INTO event_attendances (event_id, member_id, citizen_id, points_awarded, checked_in_at)
      VALUES (?, ?, ?, 1, ?)
    `, [event.id, member.id, sanitizedPid, checkedInAt])

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
      checkedInAt,
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

      return attendance
    }

    const eventRows = await this.queryExecutor('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ?', [eventId])
    if (eventRows.length === 0) throw new Error('ไม่พบข้อมูลกิจกรรม')
    const event = eventRows[0]

    const coRows = await this.queryExecutor('SELECT member_id FROM event_organizers WHERE event_id = ?', [eventId])
    const isAuthorized =
      actor.role === 'admin' ||
      event.head_organizer_id === actor.id ||
      coRows.some((c: any) => c.member_id === actor.id)

    if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้')

    const memberRows = await this.queryExecutor('SELECT id, name, department, position, username, profile_path AS profilePath FROM members WHERE id = ?', [data.memberId])
    if (memberRows.length === 0) throw new Error('ไม่พบข้อมูลบุคลากรที่ระบุ')
    const member = memberRows[0]

    const attRows = await this.queryExecutor('SELECT id FROM event_attendances WHERE event_id = ? AND member_id = ?', [eventId, member.id])
    if (attRows.length > 0) throw new Error(`${member.name || 'บุคลากรท่านนี้'} มีรายชื่อเข้าร่วมกิจกรรมนี้แล้ว`)

    const checkedInAt = data.checkedInAt ? toDbSqlDateTime(data.checkedInAt)! : getNowBangkokForDbSql()
    const pointsAwarded = data.pointsAwarded !== undefined ? data.pointsAwarded : 1

    const res: any = await this.queryExecutor(`
      INSERT INTO event_attendances (event_id, member_id, citizen_id, points_awarded, checked_in_at)
      VALUES (?, ?, ?, ?, ?)
    `, [eventId, member.id, member.username, pointsAwarded, checkedInAt])

    try {
      await logAudit(
        'CREATE',
        'event_attendances',
        `ผู้ดูแลเพิ่มผู้เข้าร่วมงาน: ${member.name} ในกิจกรรม "${event.title}" (+${pointsAwarded} คะแนน) โดย ${actor.name || actor.username}`,
        { eventId, memberId: member.id, attendanceId: res.insertId, addedBy: actor.id, note: data.note }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to log manual attendance audit')
    }

    return {
      id: res.insertId,
      eventId,
      memberId: member.id,
      citizenId: member.username,
      pointsAwarded,
      checkedInAt,
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

      return updated
    }

    const eventRows = await this.queryExecutor('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ?', [eventId])
    if (eventRows.length === 0) throw new Error('ไม่พบข้อมูลกิจกรรม')
    const event = eventRows[0]

    const coRows = await this.queryExecutor('SELECT member_id FROM event_organizers WHERE event_id = ?', [eventId])
    const isAuthorized =
      actor.role === 'admin' ||
      event.head_organizer_id === actor.id ||
      coRows.some((c: any) => c.member_id === actor.id)

    if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้')

    const attRows = await this.queryExecutor(`
      SELECT a.*, m.name
      FROM event_attendances a
      JOIN members m ON a.member_id = m.id
      WHERE a.id = ?
    `, [attendanceId])

    if (attRows.length === 0 || attRows[0].event_id !== eventId) {
      throw new Error('ไม่พบข้อมูลการเข้าร่วมกิจกรรมที่ต้องการแก้ไข')
    }

    const fields: string[] = []
    const params: any[] = []

    if (data.pointsAwarded !== undefined) {
      fields.push('points_awarded = ?')
      params.push(data.pointsAwarded)
    }
    if (data.checkedInAt) {
      fields.push('checked_in_at = ?')
      params.push(toDbSqlDateTime(data.checkedInAt)!)
    }

    if (fields.length > 0) {
      params.push(attendanceId)
      await this.queryExecutor(`UPDATE event_attendances SET ${fields.join(', ')} WHERE id = ?`, params)
    }

    try {
      await logAudit(
        'UPDATE',
        'event_attendances',
        `ผู้ดูแลแก้ไขข้อมูลการเข้าร่วม: ${attRows[0].name} ในกิจกรรม "${event.title}" (คะแนน: ${data.pointsAwarded}) โดย ${actor.name || actor.username}`,
        { eventId, attendanceId, changes: data, updatedBy: actor.id }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to log attendance update audit')
    }

    const updatedRows = await this.queryExecutor(`
      SELECT a.*, m.id AS m_id, m.name, m.department, m.position, m.profile_path AS profilePath
      FROM event_attendances a
      JOIN members m ON a.member_id = m.id
      WHERE a.id = ?
    `, [attendanceId])

    return {
      ...updatedRows[0],
      member: { id: updatedRows[0].m_id, name: updatedRows[0].name, department: updatedRows[0].department, position: updatedRows[0].position, profilePath: updatedRows[0].profilePath },
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

    const eventRows = await this.queryExecutor('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ?', [eventId])
    if (eventRows.length === 0) throw new Error('ไม่พบข้อมูลกิจกรรม')
    const event = eventRows[0]

    const coRows = await this.queryExecutor('SELECT member_id FROM event_organizers WHERE event_id = ?', [eventId])
    const isAuthorized =
      actor.role === 'admin' ||
      event.head_organizer_id === actor.id ||
      coRows.some((c: any) => c.member_id === actor.id)

    if (!isAuthorized) throw new Error('คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้')

    const attRows = await this.queryExecutor(`
      SELECT a.*, m.name
      FROM event_attendances a
      JOIN members m ON a.member_id = m.id
      WHERE a.id = ?
    `, [attendanceId])

    if (attRows.length === 0 || attRows[0].event_id !== eventId) {
      throw new Error('ไม่พบข้อมูลการเข้าร่วมกิจกรรมที่ต้องการลบ')
    }

    await this.queryExecutor('DELETE FROM event_attendances WHERE id = ?', [attendanceId])

    try {
      await logAudit(
        'DELETE',
        'event_attendances',
        `ผู้ดูแลลบรายชื่อผู้เข้าร่วม: ${attRows[0].name} ออกจากกิจกรรม "${event.title}" โดย ${actor.name || actor.username}`,
        { eventId, attendanceId, memberId: attRows[0].member_id, deletedBy: actor.id }
      )
    } catch (err) {
      logger.error({ err }, 'Failed to log attendance delete audit')
    }

    return { success: true, message: 'ลบรายชื่อผู้เข้าร่วมเรียบร้อยแล้ว' }
  }
}
