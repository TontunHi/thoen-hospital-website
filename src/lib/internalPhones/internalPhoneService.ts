import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import {
  computeInternalPhoneStats,
  extractBuildingFacets,
  filterInternalPhones,
  normalizeBuildingName,
  normalizeOptionalText,
  normalizePhoneString,
  sortInternalPhones,
} from './internalPhoneDomain'
import { INITIAL_INTERNAL_PHONES } from './internalPhoneSeedData'
import type {
  InternalPhoneActor,
  InternalPhoneCreateInput,
  InternalPhoneListFilters,
  InternalPhoneListResult,
  InternalPhoneRecord,
  InternalPhoneRecordRaw,
  InternalPhoneUpdateInput,
} from './internalPhoneTypes'

export class InternalPhoneNotFoundError extends Error {
  readonly status = 404
  constructor(message: string) {
    super(message)
    this.name = 'InternalPhoneNotFoundError'
  }
}

export class InternalPhoneValidationError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'InternalPhoneValidationError'
  }
}

export interface InternalPhoneDbDeps {
  appQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
  appTransaction: (
    statements: Array<{ sql: string; params?: unknown[] }>
  ) => Promise<{
    count: number
    results: Array<{ affectedRows: number; insertId: number | null }>
  }>
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hospital_internal_phones (
    id INT NOT NULL AUTO_INCREMENT,
    building VARCHAR(150) NOT NULL,
    floor VARCHAR(50) NULL,
    room VARCHAR(255) NOT NULL,
    phone VARCHAR(100) NOT NULL DEFAULT '',
    note VARCHAR(500) NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by VARCHAR(100) NULL,
    updated_by VARCHAR(100) NULL,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    INDEX idx_internal_phone_building_floor (building, floor),
    INDEX idx_internal_phone_active_order (is_active, display_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const CREATE_META_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hospital_internal_phones_meta (
    meta_key VARCHAR(100) NOT NULL,
    meta_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (meta_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const SELECT_PHONES_SQL = `
  SELECT
    id,
    building,
    floor,
    room,
    phone,
    note,
    display_order AS displayOrder,
    is_active AS isActive,
    created_by AS createdBy,
    updated_by AS updatedBy,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM hospital_internal_phones
`

function serializeTimestamp(val: unknown): string {
  if (!val) return new Date().toISOString()
  if (val instanceof Date) return val.toISOString()
  return String(val)
}

function mapRow(raw: InternalPhoneRecordRaw): InternalPhoneRecord {
  return {
    id: Number(raw.id),
    building: String(raw.building ?? '').trim(),
    floor: normalizeOptionalText(raw.floor),
    room: String(raw.room ?? '').trim(),
    phone: String(raw.phone ?? '').trim(),
    note: normalizeOptionalText(raw.note),
    displayOrder: Number(raw.displayOrder ?? 0),
    isActive: Boolean(Number(raw.isActive ?? 1)),
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : null,
    createdAt: serializeTimestamp(raw.createdAt),
    updatedAt: serializeTimestamp(raw.updatedAt),
  }
}

export class InternalPhoneService {
  private readonly deps: InternalPhoneDbDeps
  private initPromise: Promise<void> | null = null

  constructor(deps?: InternalPhoneDbDeps) {
    this.deps = deps ?? {
      appQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
        apiGateway.app.query<T>(sql, params),
      appTransaction: (statements) => apiGateway.app.transaction(statements),
    }
  }

  /**
   * Ensures tables exist and seeds initial 62 directory entries once (only when
   * `initial_seed_v1` marker is absent and table is empty).
   */
  async ensureTablesAndSeed(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.runEnsureTablesAndSeed().catch((err) => {
        this.initPromise = null
        throw err
      })
    }
    await this.initPromise
  }

  private async runEnsureTablesAndSeed(): Promise<void> {
    await this.deps.appTransaction([
      { sql: 'SET NAMES utf8mb4' },
      { sql: CREATE_TABLE_SQL },
      { sql: CREATE_META_TABLE_SQL },
    ])

    const metaRows = await this.deps.appQuery<{ meta_value: string }>(
      'SELECT meta_value FROM hospital_internal_phones_meta WHERE meta_key = ?',
      ['initial_seed_v1']
    )
    if (metaRows.length > 0) return

    const countRows = await this.deps.appQuery<{ total: number }>(
      'SELECT COUNT(*) AS total FROM hospital_internal_phones'
    )
    const existingCount = Number(countRows[0]?.total ?? 0)

    if (existingCount === 0) {
      const statements: Array<{ sql: string; params?: unknown[] }> = [
        { sql: 'SET NAMES utf8mb4' },
        ...INITIAL_INTERNAL_PHONES.map((item, idx) => ({
          sql: `
            INSERT INTO hospital_internal_phones
              (building, floor, room, phone, note, display_order, is_active, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            normalizeBuildingName(item.building),
            normalizeOptionalText(item.floor),
            item.room.trim(),
            normalizePhoneString(item.phone),
            normalizeOptionalText(item.note),
            item.displayOrder ?? idx + 1,
            item.isActive === false ? 0 : 1,
            'system-seed',
            'system-seed',
          ],
        })),
        {
          sql: `
            INSERT INTO hospital_internal_phones_meta (meta_key, meta_value)
            VALUES ('initial_seed_v1', 'done')
            ON DUPLICATE KEY UPDATE meta_value = 'done'
          `,
        },
      ]
      await this.deps.appTransaction(statements)
      return
    }

    await this.deps.appTransaction([
      { sql: 'SET NAMES utf8mb4' },
      {
        sql: `
          INSERT INTO hospital_internal_phones_meta (meta_key, meta_value)
          VALUES ('initial_seed_v1', 'done')
          ON DUPLICATE KEY UPDATE meta_value = 'done'
        `,
      },
    ])
  }

  async listPhones(filters: InternalPhoneListFilters = {}): Promise<InternalPhoneListResult> {
    await this.ensureTablesAndSeed()

    const rows = await this.deps.appQuery<InternalPhoneRecordRaw>(
      `${SELECT_PHONES_SQL} ORDER BY display_order ASC, id ASC`
    )
    const allSorted = sortInternalPhones(rows.map(mapRow))
    const activeRecords = filters.includeInactive
      ? allSorted
      : allSorted.filter((item) => item.isActive)

    const { buildings, floorsByBuilding } = extractBuildingFacets(activeRecords)
    const items = filterInternalPhones(activeRecords, filters)
    const stats = computeInternalPhoneStats(activeRecords)

    return {
      items,
      buildings,
      floorsByBuilding,
      stats,
    }
  }

  async getPhoneById(id: number): Promise<InternalPhoneRecord> {
    await this.ensureTablesAndSeed()
    const rows = await this.deps.appQuery<InternalPhoneRecordRaw>(
      `${SELECT_PHONES_SQL} WHERE id = ? LIMIT 1`,
      [id]
    )
    if (rows.length === 0) {
      throw new InternalPhoneNotFoundError('ไม่พบข้อมูลเบอร์โทรภายในรายการนี้')
    }
    return mapRow(rows[0])
  }

  async createPhone(
    input: InternalPhoneCreateInput,
    actor: InternalPhoneActor
  ): Promise<InternalPhoneRecord> {
    await this.ensureTablesAndSeed()

    const building = normalizeBuildingName(input.building)
    const floor = normalizeOptionalText(input.floor)
    const room = input.room.trim()
    const phone = normalizePhoneString(input.phone ?? '')
    const note = normalizeOptionalText(input.note)
    const actorUsername = actor.username ?? 'system'

    if (!building) {
      throw new InternalPhoneValidationError('กรุณาระบุชื่ออาคาร')
    }
    if (!room) {
      throw new InternalPhoneValidationError('กรุณาระบุชื่อห้องหรือหน่วยงาน')
    }

    let displayOrder = input.displayOrder
    if (displayOrder === undefined) {
      const maxRows = await this.deps.appQuery<{ maxOrder: number | null }>(
        'SELECT MAX(display_order) AS maxOrder FROM hospital_internal_phones'
      )
      displayOrder = Number(maxRows[0]?.maxOrder ?? 0) + 1
    }

    const tx = await this.deps.appTransaction([
      { sql: 'SET NAMES utf8mb4' },
      {
        sql: `
          INSERT INTO hospital_internal_phones
            (building, floor, room, phone, note, display_order, is_active, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          building,
          floor,
          room,
          phone,
          note,
          displayOrder,
          input.isActive === false ? 0 : 1,
          actorUsername,
          actorUsername,
        ],
      },
    ])

    const insertId = Number(tx.results?.[1]?.insertId ?? 0)
    const created = await this.getPhoneById(insertId)

    await logAudit(
      'CREATE',
      'hospital_internal_phones',
      `เพิ่มเบอร์โทรภายใน #${created.id}: ${created.building}${created.floor ? ` ชั้น ${created.floor}` : ''} - ${created.room} (${created.phone || '-'})`,
      actor
    )

    return created
  }

  async updatePhone(
    id: number,
    input: InternalPhoneUpdateInput,
    actor: InternalPhoneActor
  ): Promise<InternalPhoneRecord> {
    const existing = await this.getPhoneById(id)

    const setClauses: string[] = []
    const params: unknown[] = []

    if (input.building !== undefined) {
      const building = normalizeBuildingName(input.building)
      if (!building) {
        throw new InternalPhoneValidationError('กรุณาระบุชื่ออาคาร')
      }
      setClauses.push('building = ?')
      params.push(building)
    }

    if (input.floor !== undefined) {
      setClauses.push('floor = ?')
      params.push(normalizeOptionalText(input.floor))
    }

    if (input.room !== undefined) {
      const room = input.room.trim()
      if (!room) {
        throw new InternalPhoneValidationError('กรุณาระบุชื่อห้องหรือหน่วยงาน')
      }
      setClauses.push('room = ?')
      params.push(room)
    }

    if (input.phone !== undefined) {
      setClauses.push('phone = ?')
      params.push(normalizePhoneString(input.phone))
    }

    if (input.note !== undefined) {
      setClauses.push('note = ?')
      params.push(normalizeOptionalText(input.note))
    }

    if (input.displayOrder !== undefined) {
      setClauses.push('display_order = ?')
      params.push(input.displayOrder)
    }

    if (input.isActive !== undefined) {
      setClauses.push('is_active = ?')
      params.push(input.isActive ? 1 : 0)
    }

    if (setClauses.length === 0) {
      return existing
    }

    const actorUsername = actor.username ?? 'system'
    setClauses.push('updated_by = ?')
    params.push(actorUsername)
    params.push(id)

    await this.deps.appTransaction([
      { sql: 'SET NAMES utf8mb4' },
      {
        sql: `UPDATE hospital_internal_phones SET ${setClauses.join(', ')} WHERE id = ?`,
        params,
      },
    ])

    const updated = await this.getPhoneById(id)

    await logAudit(
      'UPDATE',
      'hospital_internal_phones',
      `แก้ไขเบอร์โทรภายใน #${id}: ${updated.building}${updated.floor ? ` ชั้น ${updated.floor}` : ''} - ${updated.room} (${updated.phone || '-'})`,
      actor
    )

    return updated
  }

  async deletePhone(id: number, actor: InternalPhoneActor): Promise<{ id: number }> {
    const existing = await this.getPhoneById(id)

    await this.deps.appTransaction([
      { sql: 'SET NAMES utf8mb4' },
      { sql: 'DELETE FROM hospital_internal_phones WHERE id = ?', params: [id] },
    ])

    await logAudit(
      'DELETE',
      'hospital_internal_phones',
      `ลบเบอร์โทรภายใน #${id}: ${existing.building}${existing.floor ? ` ชั้น ${existing.floor}` : ''} - ${existing.room} (${existing.phone || '-'})`,
      actor
    )

    return { id }
  }
}

export const internalPhoneService = new InternalPhoneService()
