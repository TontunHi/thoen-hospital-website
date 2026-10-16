import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export interface ScreeningQueueItem {
  id: number
  cid: string
  title: string | null
  firstName: string | null
  lastName: string | null
  fullName: string
  gender: string | null
  birthDate: string | null
  address: string | null
  photoBase64: string | null
  rawPayload: string | null
  status: string // 'WAITING' | 'VISIT_OPENED' | 'CANCELLED'
  vn: string | null
  recordedBy: number | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface CreateScreeningQueueInput {
  cid: string
  title?: string | null
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  gender?: string | null
  birthDate?: string | null
  address?: string | null
  photoBase64?: string | null
  rawPayload?: any
  status?: string
  vn?: string | null
  recordedBy?: number | null
}

export interface UpdateScreeningQueueStatusInput {
  status: 'WAITING' | 'VISIT_OPENED' | 'CANCELLED'
  vn?: string | null
}

export interface ScreeningQueueQueryOptions {
  date?: string // 'YYYY-MM-DD' or 'today'
  search?: string
  status?: string
  includePhoto?: boolean // default false in list to save bandwidth
  includeRawPayload?: boolean // default false in list to save bandwidth
  page?: number
  limit?: number
}

export interface Actor {
  id?: number | null
  name?: string | null
  username?: string | null
  role?: string | null
}

/**
 * Mask Thai National Citizen ID for PDPA compliance (shows only the last 4 characters).
 */
export function maskCid(cid: string): string {
  if (!cid) return ''
  const trimmed = cid.trim()
  if (trimmed.length <= 4) return trimmed
  return 'x-xxxx-xxxxx-xx-' + trimmed.slice(-4)
}

export interface BangkokDateRange {
  start: Date
  end: Date
  bangkokDateStr: string
  startSql: string
  endSql: string
}

/**
 * Normalizes a Date object or DB date string to Asia/Bangkok (+07:00) ISO string
 * to prevent client-side double timezone conversion.
 */
export function formatBangkokIso(date: Date | string | null | undefined): string | null {
  if (!date) return null
  if (typeof date === 'string') {
    const trimmed = date.trim()
    if (trimmed.endsWith('Z')) {
      return trimmed.replace(/Z$/, '+07:00')
    }
    if (trimmed.includes('+07:00')) {
      return trimmed
    }
    const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/)
    if (m) {
      return `${m[1]}T${m[2]}+07:00`
    }
  }
  if (date instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = date.getUTCFullYear()
    const mo = pad(date.getUTCMonth() + 1)
    const d = pad(date.getUTCDate())
    const h = date.getUTCHours()
    const mi = pad(date.getUTCMinutes())
    const s = pad(date.getUTCSeconds())
    return `${y}-${mo}-${d}T${h}:${mi}:${s}+07:00`
  }
  return String(date)
}

/**
 * Calculates start and end Date and SQL string bounds for a given Thailand (Asia/Bangkok) date (YYYY-MM-DD).
 * Hospital MariaDB stores created_at in local Thai time (NOW()), so local day bounds are 00:00:00 to 23:59:59.
 */
export function getBangkokDateRange(dateStr?: string): BangkokDateRange {
  let targetDateStr = dateStr?.trim()
  if (!targetDateStr || targetDateStr === 'today') {
    targetDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()) // Returns 'YYYY-MM-DD'
  }

  const [y, m, d] = targetDateStr.split('-').map(Number)
  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) {
    throw new Error(`รูปแบบวันที่ไม่ถูกต้อง: ${dateStr} (ต้องเป็น YYYY-MM-DD)`)
  }

  const startSql = `${targetDateStr} 00:00:00`
  const endSql = `${targetDateStr} 23:59:59`

  // For Prisma or UTC Date operations matching the local calendar day
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))

  return { start, end, bangkokDateStr: targetDateStr, startSql, endSql }
}

export class ScreeningQueueService {
  constructor(
    private db: any = null,
    private readonly queryExecutor: (sql: string, params?: any[]) => Promise<any[]> = queryMemberDb
  ) {}

  /**
   * Retrieves queue items for a specific date (defaults to Today Bangkok time).
   */
  async getQueues(options: ScreeningQueueQueryOptions = {}) {
    const isAll = options.date?.trim().toLowerCase() === 'all'
    const range = isAll ? null : getBangkokDateRange(options.date)
    const bangkokDateStr = isAll ? 'all' : range!.bangkokDateStr

    if (this.db?.screeningQueue) {
      const where: any = {}
      if (!isAll && range) {
        where.createdAt = {
          gte: range.start,
          lte: range.end,
        }
      }

      if (options.status && options.status !== 'ALL') {
        where.status = options.status
      }

      if (options.search && options.search.trim()) {
        const q = options.search.trim()
        where.OR = [
          { fullName: { contains: q } },
          { cid: { contains: q } },
          { vn: { contains: q } },
        ]
      }

      const select: any = {
        id: true,
        cid: true,
        title: true,
        firstName: true,
        lastName: true,
        fullName: true,
        gender: true,
        birthDate: true,
        address: true,
        status: true,
        vn: true,
        recordedBy: true,
        createdAt: true,
        updatedAt: true,
      }

      if (options.includePhoto) {
        select.photoBase64 = true
      }

      if (options.includeRawPayload) {
        select.rawPayload = true
      }

      const items = await this.db.screeningQueue.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        ...(options.limit ? { take: options.limit } : isAll ? { take: 500 } : {}),
      })

      const mappedItems = items.map((item: any) => ({
        ...item,
        createdAt: formatBangkokIso(item.createdAt) || item.createdAt,
        updatedAt: formatBangkokIso(item.updatedAt) || item.updatedAt,
      }))

      return {
        date: bangkokDateStr,
        total: mappedItems.length,
        items: mappedItems,
      }
    }

    // Zero-DB Gateway Production Implementation
    const whereClauses: string[] = []
    const params: any[] = []

    if (!isAll && range) {
      whereClauses.push('created_at >= ?', 'created_at <= ?')
      params.push(range.startSql, range.endSql)
    }

    if (options.status && options.status !== 'ALL') {
      whereClauses.push('status = ?')
      params.push(options.status)
    }

    if (options.search && options.search.trim()) {
      const q = `%${options.search.trim()}%`
      whereClauses.push('(full_name LIKE ? OR cid LIKE ? OR vn LIKE ?)')
      params.push(q, q, q)
    }

    const selectFields = [
      'id',
      'cid',
      'title',
      'first_name AS firstName',
      'last_name AS lastName',
      'full_name AS fullName',
      'gender',
      'birth_date AS birthDate',
      'address',
      'status',
      'vn',
      'recorded_by AS recordedBy',
      'created_at AS createdAt',
      'updated_at AS updatedAt',
    ]

    if (options.includePhoto) {
      selectFields.push('photo_base64 AS photoBase64')
    }
    if (options.includeRawPayload) {
      selectFields.push('raw_payload AS rawPayload')
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const limitClause = options.limit
      ? `LIMIT ${Number(options.limit)}`
      : isAll
      ? 'LIMIT 500'
      : ''
    const sql = `SELECT ${selectFields.join(', ')} FROM screening_queues ${whereSql} ORDER BY created_at DESC ${limitClause}`.trim()
    const rawItems = await this.queryExecutor(sql, params)

    const items = (rawItems || []).map((row: any) => ({
      ...row,
      createdAt: formatBangkokIso(row.createdAt || row.created_at) || row.createdAt,
      updatedAt: formatBangkokIso(row.updatedAt || row.updated_at) || row.updatedAt,
    }))

    return {
      date: bangkokDateStr,
      total: items.length,
      items,
    }
  }

  /**
   * Retrieves single queue item by ID (with rawPayload and photo).
   */
  async getQueueById(id: number): Promise<ScreeningQueueItem | null> {
    if (!id || isNaN(id)) return null

    if (this.db?.screeningQueue) {
      const item = await this.db.screeningQueue.findUnique({
        where: { id },
      })
      if (!item) return null
      return {
        ...item,
        createdAt: formatBangkokIso(item.createdAt) || item.createdAt,
        updatedAt: formatBangkokIso(item.updatedAt) || item.updatedAt,
      }
    }

    const rows = await this.queryExecutor(`
      SELECT 
        id, cid, title,
        first_name AS firstName,
        last_name AS lastName,
        full_name AS fullName,
        gender,
        birth_date AS birthDate,
        address,
        photo_base64 AS photoBase64,
        raw_payload AS rawPayload,
        status, vn,
        recorded_by AS recordedBy,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM screening_queues
      WHERE id = ?
      LIMIT 1
    `, [id])

    const row = rows[0] || null
    if (!row) return null
    return {
      ...row,
      createdAt: formatBangkokIso(row.createdAt || row.created_at) || row.createdAt,
      updatedAt: formatBangkokIso(row.updatedAt || row.updated_at) || row.updatedAt,
    }
  }

  /**
   * Adds or updates a screening queue entry from Smart Card reader.
   */
  async addToQueue(input: CreateScreeningQueueInput, actor?: Actor) {
    const rawCid = input.cid?.replace(/[^0-9]/g, '') || ''
    if (rawCid.length !== 13) {
      throw new Error('เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก')
    }

    const title = input.title?.trim() || null
    const firstName = input.firstName?.trim() || null
    const lastName = input.lastName?.trim() || null
    let fullName = input.fullName?.trim() || ''

    if (!fullName) {
      fullName = [title, firstName, lastName].filter(Boolean).join(' ').trim()
    }
    if (!fullName) {
      fullName = `ผู้รับบริการ (${rawCid})`
    }

    let rawPayloadString: string | null = null
    if (input.rawPayload) {
      rawPayloadString =
        typeof input.rawPayload === 'string'
          ? input.rawPayload
          : JSON.stringify(input.rawPayload)
    }

    const { start, end, startSql, endSql } = getBangkokDateRange('today')

    if (this.db?.screeningQueue) {
      // Check if the person is already queued today
      const existing = await this.db.screeningQueue.findFirst({
        where: {
          cid: rawCid,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      let queueRecord: ScreeningQueueItem

      if (existing) {
        // Update existing record for today with latest read data
        queueRecord = await this.db.screeningQueue.update({
          where: { id: existing.id },
          data: {
            title: title ?? existing.title,
            firstName: firstName ?? existing.firstName,
            lastName: lastName ?? existing.lastName,
            fullName: fullName ?? existing.fullName,
            gender: input.gender ?? existing.gender,
            birthDate: input.birthDate ?? existing.birthDate,
            address: input.address ?? existing.address,
            photoBase64: input.photoBase64 ?? existing.photoBase64,
            rawPayload: rawPayloadString ?? existing.rawPayload,
            recordedBy: actor?.id ?? existing.recordedBy,
            status: existing.status === 'CANCELLED' ? 'WAITING' : existing.status,
          },
        })
      } else {
        // Create new queue entry
        queueRecord = await this.db.screeningQueue.create({
          data: {
            cid: rawCid,
            title,
            firstName,
            lastName,
            fullName,
            gender: input.gender?.trim() || null,
            birthDate: input.birthDate?.trim() || null,
            address: input.address?.trim() || null,
            photoBase64: input.photoBase64 || null,
            rawPayload: rawPayloadString,
            status: input.status || 'WAITING',
            vn: input.vn || null,
            recordedBy: actor?.id ?? input.recordedBy ?? null,
          },
        })
      }

      try {
        await logAudit(
          'CREATE',
          'screening_queues',
          `บันทึกคิวตรวจนอกพื้นที่ ID: ${queueRecord.id}, CID: ${maskCid(rawCid)}, ชื่อ: ${fullName}`,
          actor?.username ? { username: actor.username } : null
        )
      } catch (auditErr) {
        logger.error({ err: auditErr }, 'Failed to write audit log for screening queue')
      }

      this.cleanupOldQueues(30).catch((err) => {
        logger.error({ err }, 'Background cleanup of old screening queues failed')
      })

      return queueRecord
    }

    // Zero-DB Gateway Production Implementation
    const existingRows = await this.queryExecutor(`
      SELECT id, title, first_name AS firstName, last_name AS lastName, full_name AS fullName,
        gender, birth_date AS birthDate, address, photo_base64 AS photoBase64,
        raw_payload AS rawPayload, status, vn, recorded_by AS recordedBy
      FROM screening_queues
      WHERE cid = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [rawCid, startSql, endSql])

    const existing = existingRows[0]
    let queueRecord: any

    if (existing) {
      const nextTitle = title ?? existing.title
      const nextFirstName = firstName ?? existing.firstName
      const nextLastName = lastName ?? existing.lastName
      const nextFullName = fullName ?? existing.fullName
      const nextGender = input.gender ?? existing.gender
      const nextBirthDate = input.birthDate ?? existing.birthDate
      const nextAddress = input.address ?? existing.address
      const nextPhoto = input.photoBase64 ?? existing.photoBase64
      const nextRaw = rawPayloadString ?? existing.rawPayload
      const nextRecordedBy = actor?.id ?? existing.recordedBy
      const nextStatus = existing.status === 'CANCELLED' ? 'WAITING' : existing.status

      await this.queryExecutor(`
        UPDATE screening_queues
        SET title = ?, first_name = ?, last_name = ?, full_name = ?,
            gender = ?, birth_date = ?, address = ?, photo_base64 = ?,
            raw_payload = ?, recorded_by = ?, status = ?, updated_at = NOW()
        WHERE id = ?
      `, [
        nextTitle, nextFirstName, nextLastName, nextFullName,
        nextGender, nextBirthDate, nextAddress, nextPhoto,
        nextRaw, nextRecordedBy, nextStatus, existing.id
      ])

      queueRecord = await this.getQueueById(existing.id)
    } else {
      const res: any = await this.queryExecutor(`
        INSERT INTO screening_queues (
          cid, title, first_name, last_name, full_name,
          gender, birth_date, address, photo_base64, raw_payload,
          status, vn, recorded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        rawCid,
        title,
        firstName,
        lastName,
        fullName,
        input.gender?.trim() || null,
        input.birthDate?.trim() || null,
        input.address?.trim() || null,
        input.photoBase64 || null,
        rawPayloadString,
        input.status || 'WAITING',
        input.vn || null,
        actor?.id ?? input.recordedBy ?? null,
      ])

      const newId = res.insertId
      queueRecord = await this.getQueueById(newId)
    }

    try {
      await logAudit(
        'CREATE',
        'screening_queues',
        `บันทึกคิวตรวจนอกพื้นที่ ID: ${queueRecord.id}, CID: ${maskCid(rawCid)}, ชื่อ: ${fullName}`,
        actor?.username ? { username: actor.username } : null
      )
    } catch (auditErr) {
      logger.error({ err: auditErr }, 'Failed to write audit log for screening queue')
    }

    this.cleanupOldQueues(30).catch((err) => {
      logger.error({ err }, 'Background cleanup of old screening queues failed')
    })

    return queueRecord
  }

  /**
   * Updates queue status (e.g. WAITING -> VISIT_OPENED or CANCELLED) and optional VN.
   */
  async updateQueueStatus(
    id: number,
    input: UpdateScreeningQueueStatusInput,
    actor?: Actor
  ): Promise<ScreeningQueueItem> {
    if (!id || isNaN(id)) {
      throw new Error('รหัสคิวไม่ถูกต้อง')
    }

    const validStatuses = ['WAITING', 'VISIT_OPENED', 'CANCELLED']
    if (!validStatuses.includes(input.status)) {
      throw new Error(`สถานะไม่ถูกต้อง: ${input.status}`)
    }

    if (this.db?.screeningQueue) {
      const existing = await this.db.screeningQueue.findUnique({
        where: { id },
      })

      if (!existing) {
        throw new Error(`ไม่พบคิวที่ต้องการอัปเดต (ID: ${id})`)
      }

      const updated = await this.db.screeningQueue.update({
        where: { id },
        data: {
          status: input.status,
          vn: input.vn !== undefined ? input.vn : existing.vn,
        },
      })

      try {
        await logAudit(
          'UPDATE',
          'screening_queues',
          `เปลี่ยนสถานะคิว ID: ${id} เป็น ${input.status}${input.vn ? ` (VN: ${input.vn})` : ''}`,
          actor?.username ? { username: actor.username } : null
        )
      } catch (auditErr) {
        logger.error({ err: auditErr }, 'Failed to write audit log for queue status update')
      }

      return updated
    }

    // Zero-DB Gateway Production Implementation
    const existing = await this.getQueueById(id)
    if (!existing) {
      throw new Error(`ไม่พบคิวที่ต้องการอัปเดต (ID: ${id})`)
    }

    const nextVn = input.vn !== undefined ? input.vn : existing.vn
    await this.queryExecutor(`
      UPDATE screening_queues
      SET status = ?, vn = ?, updated_at = NOW()
      WHERE id = ?
    `, [input.status, nextVn, id])

    const updated = await this.getQueueById(id)

    try {
      await logAudit(
        'UPDATE',
        'screening_queues',
        `เปลี่ยนสถานะคิว ID: ${id} เป็น ${input.status}${input.vn ? ` (VN: ${input.vn})` : ''}`,
        actor?.username ? { username: actor.username } : null
      )
    } catch (auditErr) {
      logger.error({ err: auditErr }, 'Failed to write audit log for queue status update')
    }

    return updated!
  }

  /**
   * Cleans up screening queue records older than specified retention days (default 30 days).
   */
  async cleanupOldQueues(retentionDays: number = 30): Promise<{ count: number }> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    if (this.db?.screeningQueue) {
      const result = await this.db.screeningQueue.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      })
      return { count: result.count }
    }

    const result: any = await this.queryExecutor(
      'DELETE FROM screening_queues WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [retentionDays]
    )
    return { count: result?.affectedRows || 0 }
  }
}

export const screeningQueueService = new ScreeningQueueService()
