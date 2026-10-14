import { prisma } from '@/lib/prisma'
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
  createdAt: Date
  updatedAt: Date
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

/**
 * Calculates start and end Date objects in UTC for a given Thailand (Asia/Bangkok) date (YYYY-MM-DD).
 */
export function getBangkokDateRange(dateStr?: string): { start: Date; end: Date; bangkokDateStr: string } {
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

  // Bangkok is UTC+7
  // 00:00:00 Bangkok = UTC -7 hours
  const start = new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0))
  // 23:59:59.999 Bangkok = UTC 16:59:59.999
  const end = new Date(Date.UTC(y, m - 1, d, 16, 59, 59, 999))

  return { start, end, bangkokDateStr: targetDateStr }
}

export class ScreeningQueueService {
  constructor(private db: any = prisma) {}

  /**
   * Retrieves queue items for a specific date (defaults to Today Bangkok time).
   */
  async getQueues(options: ScreeningQueueQueryOptions = {}) {
    const { start, end, bangkokDateStr } = getBangkokDateRange(options.date)

    const where: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
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
    })

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
    return this.db.screeningQueue.findUnique({
      where: { id },
    })
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

    const { start, end } = getBangkokDateRange('today')

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
          // If status was CANCELLED, reset to WAITING upon new scan
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

    // Tier 1 Audit log
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

    // Auto cleanup old queues (>30 days) asynchronously without blocking response
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

  /**
   * Cleans up screening queue records older than specified retention days (default 30 days).
   */
  async cleanupOldQueues(retentionDays: number = 30): Promise<{ count: number }> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    const result = await this.db.screeningQueue.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    })
    return { count: result.count }
  }
}

export const screeningQueueService = new ScreeningQueueService()
