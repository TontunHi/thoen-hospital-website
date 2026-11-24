import { apiGateway, GatewayError, GatewayNotFoundError } from '@/lib/apiGateway'
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

export interface InternalPhoneGatewayAdapter {
  ensureAndSeedInternalPhonesV2: typeof apiGateway.app.ensureAndSeedInternalPhonesV2
  listInternalPhonesV2: typeof apiGateway.app.listInternalPhonesV2
  getInternalPhoneByIdV2: typeof apiGateway.app.getInternalPhoneByIdV2
  createInternalPhoneV2: typeof apiGateway.app.createInternalPhoneV2
  updateInternalPhoneV2: typeof apiGateway.app.updateInternalPhoneV2
  deleteInternalPhoneV2: typeof apiGateway.app.deleteInternalPhoneV2
}

const defaultInternalPhoneGateway: InternalPhoneGatewayAdapter = {
  ensureAndSeedInternalPhonesV2: (body) => apiGateway.app.ensureAndSeedInternalPhonesV2(body),
  listInternalPhonesV2: () => apiGateway.app.listInternalPhonesV2(),
  getInternalPhoneByIdV2: (id) => apiGateway.app.getInternalPhoneByIdV2(id),
  createInternalPhoneV2: (body) => apiGateway.app.createInternalPhoneV2(body),
  updateInternalPhoneV2: (id, body) => apiGateway.app.updateInternalPhoneV2(id, body),
  deleteInternalPhoneV2: (id) => apiGateway.app.deleteInternalPhoneV2(id),
}

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

function isNotFoundGatewayError(err: unknown): boolean {
  if (err instanceof GatewayNotFoundError) return true
  if (err instanceof GatewayError && err.status === 404) return true
  return false
}

const SEED_VERSION_KEY = 'initial_seed_v2'

export class InternalPhoneService {
  private readonly gw: InternalPhoneGatewayAdapter
  private initPromise: Promise<void> | null = null

  constructor(gateway: Partial<InternalPhoneGatewayAdapter> = {}) {
    this.gw = { ...defaultInternalPhoneGateway, ...gateway }
  }

  /**
   * Ensures tables exist and replaces any older seed data with the v2 directory
   * when `initial_seed_v2` marker is absent.
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
    const initialItems = INITIAL_INTERNAL_PHONES.map((item, idx) => ({
      building: normalizeBuildingName(item.building),
      floor: normalizeOptionalText(item.floor),
      room: item.room.trim(),
      phone: normalizePhoneString(item.phone),
      note: normalizeOptionalText(item.note),
      displayOrder: item.displayOrder ?? idx + 1,
      isActive: item.isActive !== false,
    }))
    await this.gw.ensureAndSeedInternalPhonesV2({
      seedKey: SEED_VERSION_KEY,
      initialItems,
    })
  }

  async listPhones(filters: InternalPhoneListFilters = {}): Promise<InternalPhoneListResult> {
    await this.ensureTablesAndSeed()

    const rows = (await this.gw.listInternalPhonesV2()) as unknown as InternalPhoneRecordRaw[]
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
    try {
      const raw = (await this.gw.getInternalPhoneByIdV2(id)) as unknown as InternalPhoneRecordRaw | null
      if (!raw) {
        throw new InternalPhoneNotFoundError('ไม่พบข้อมูลเบอร์โทรภายในรายการนี้')
      }
      return mapRow(raw)
    } catch (err) {
      if (err instanceof InternalPhoneNotFoundError) throw err
      if (isNotFoundGatewayError(err)) {
        throw new InternalPhoneNotFoundError('ไม่พบข้อมูลเบอร์โทรภายในรายการนี้')
      }
      throw err
    }
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

    const rawCreated = (await this.gw.createInternalPhoneV2({
      building,
      floor,
      room,
      phone,
      note,
      displayOrder: input.displayOrder,
      isActive: input.isActive !== false,
      actorUsername,
    })) as unknown as InternalPhoneRecordRaw

    const created = mapRow(rawCreated)

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

    const payload: Record<string, unknown> = {}

    if (input.building !== undefined) {
      const building = normalizeBuildingName(input.building)
      if (!building) {
        throw new InternalPhoneValidationError('กรุณาระบุชื่ออาคาร')
      }
      payload.building = building
    }

    if (input.floor !== undefined) {
      payload.floor = normalizeOptionalText(input.floor)
    }

    if (input.room !== undefined) {
      const room = input.room.trim()
      if (!room) {
        throw new InternalPhoneValidationError('กรุณาระบุชื่อห้องหรือหน่วยงาน')
      }
      payload.room = room
    }

    if (input.phone !== undefined) {
      payload.phone = normalizePhoneString(input.phone)
    }

    if (input.note !== undefined) {
      payload.note = normalizeOptionalText(input.note)
    }

    if (input.displayOrder !== undefined) {
      payload.displayOrder = input.displayOrder
    }

    if (input.isActive !== undefined) {
      payload.isActive = input.isActive
    }

    if (Object.keys(payload).length === 0) {
      return existing
    }

    payload.actorUsername = actor.username ?? 'system'

    let rawUpdated: InternalPhoneRecordRaw
    try {
      rawUpdated = (await this.gw.updateInternalPhoneV2(id, payload)) as unknown as InternalPhoneRecordRaw
    } catch (err) {
      if (isNotFoundGatewayError(err)) {
        throw new InternalPhoneNotFoundError('ไม่พบข้อมูลเบอร์โทรภายในรายการนี้')
      }
      throw err
    }

    const updated = mapRow(rawUpdated)

    await logAudit(
      'UPDATE',
      'hospital_internal_phones',
      `แก้ไขเบอร์โทรภายใน #${id}: ${updated.building}${updated.floor ? ` ชั้น ${updated.floor}` : ''} - ${updated.room} (${updated.phone || '-'})`,
      actor
    )

    return updated
  }

  async deletePhone(id: number, actor: InternalPhoneActor): Promise<{ id: number }> {
    await this.ensureTablesAndSeed()
    let rawExisting: InternalPhoneRecordRaw
    try {
      rawExisting = (await this.gw.deleteInternalPhoneV2(id)) as unknown as InternalPhoneRecordRaw
    } catch (err) {
      if (isNotFoundGatewayError(err)) {
        throw new InternalPhoneNotFoundError('ไม่พบข้อมูลเบอร์โทรภายในรายการนี้')
      }
      throw err
    }

    const existing = mapRow(rawExisting)

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
