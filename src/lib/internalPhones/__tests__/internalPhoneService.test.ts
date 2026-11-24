import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { GatewayNotFoundError } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import {
  buildBuildingSummaries,
  computeInternalPhoneStats,
  extractBuildingFacets,
  filterInternalPhones,
  normalizeBuildingName,
  normalizePhoneString,
  splitPhoneNumbers,
} from '../internalPhoneDomain'
import { INITIAL_INTERNAL_PHONES } from '../internalPhoneSeedData'
import {
  InternalPhoneNotFoundError,
  InternalPhoneService,
  type InternalPhoneGatewayAdapter,
} from '../internalPhoneService'
import type { InternalPhoneRecordRaw } from '../internalPhoneTypes'

function createInMemoryGateway(initialRows: InternalPhoneRecordRaw[] = []): {
  gateway: InternalPhoneGatewayAdapter
  rows: InternalPhoneRecordRaw[]
  meta: Map<string, string>
} {
  let nextId = initialRows.reduce((max, r) => Math.max(max, r.id), 0) + 1
  const rows: InternalPhoneRecordRaw[] = [...initialRows]
  const meta = new Map<string, string>()

  const gateway: InternalPhoneGatewayAdapter = {
    ensureAndSeedInternalPhonesV2: async ({ seedKey = 'initial_seed_v2', initialItems }) => {
      if (meta.has(seedKey)) return { seeded: false }
      rows.length = 0
      for (const item of initialItems) {
        rows.push({
          id: nextId++,
          building: String(item.building),
          floor: (item.floor as string | null) ?? null,
          room: String(item.room),
          phone: String(item.phone),
          note: (item.note as string | null) ?? null,
          displayOrder: Number(item.displayOrder ?? 0),
          isActive: item.isActive === false ? 0 : 1,
          createdBy: 'system-seed',
          updatedBy: 'system-seed',
          createdAt: '2026-11-20T06:00:00.000Z',
          updatedAt: '2026-11-20T06:00:00.000Z',
        })
      }
      meta.set(seedKey, 'done')
      return { seeded: true }
    },
    listInternalPhonesV2: async () => [...rows] as unknown as Array<Record<string, unknown>>,
    getInternalPhoneByIdV2: async (id) => {
      const found = rows.find((r) => r.id === id)
      if (!found) throw new GatewayNotFoundError('Not found')
      return { ...found } as unknown as Record<string, unknown>
    },
    createInternalPhoneV2: async (body) => {
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.displayOrder), 0)
      const created: InternalPhoneRecordRaw = {
        id: nextId++,
        building: String(body.building),
        floor: (body.floor as string | null) ?? null,
        room: String(body.room),
        phone: String(body.phone ?? ''),
        note: (body.note as string | null) ?? null,
        displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : maxOrder + 1,
        isActive: body.isActive === false ? 0 : 1,
        createdBy: String(body.actorUsername ?? 'system'),
        updatedBy: String(body.actorUsername ?? 'system'),
        createdAt: '2026-11-20T06:00:00.000Z',
        updatedAt: '2026-11-20T06:00:00.000Z',
      }
      rows.push(created)
      return { ...created } as unknown as Record<string, unknown>
    },
    updateInternalPhoneV2: async (id, body) => {
      const target = rows.find((r) => r.id === id)
      if (!target) throw new GatewayNotFoundError('Not found')
      if (body.building !== undefined) target.building = String(body.building)
      if (body.floor !== undefined) target.floor = (body.floor as string | null) ?? null
      if (body.room !== undefined) target.room = String(body.room)
      if (body.phone !== undefined) target.phone = String(body.phone)
      if (body.note !== undefined) target.note = (body.note as string | null) ?? null
      if (body.displayOrder !== undefined) target.displayOrder = Number(body.displayOrder)
      if (body.isActive !== undefined) target.isActive = body.isActive ? 1 : 0
      if (body.actorUsername !== undefined) target.updatedBy = String(body.actorUsername)
      return { ...target } as unknown as Record<string, unknown>
    },
    deleteInternalPhoneV2: async (id) => {
      const idx = rows.findIndex((r) => r.id === id)
      if (idx === -1) throw new GatewayNotFoundError('Not found')
      const [removed] = rows.splice(idx, 1)
      return { ...removed } as unknown as Record<string, unknown>
    },
  }

  return { gateway, rows, meta }
}

describe('internalPhoneDomain', () => {
  it('normalizes legacy building aliases ("ตึกเก่า" -> "อาคารร่มฉัตร", "ตึกใหม่" -> "อาคารผู้ป่วยนอก/บำบัดรักษาฯ6ชั้น")', () => {
    expect(normalizeBuildingName('ตึกเก่า')).toBe('อาคารร่มฉัตร')
    expect(normalizeBuildingName('ตึกใหม่')).toBe('อาคารผู้ป่วยนอก/บำบัดรักษาฯ6ชั้น')
    expect(normalizeBuildingName('  อาคารร่มบุญ  ')).toBe('อาคารร่มบุญ')
  })

  it('splits multi-extension strings cleanly', () => {
    expect(splitPhoneNumbers('1100, 1101')).toEqual(['1100', '1101'])
    expect(splitPhoneNumbers('2100; 2400 ')).toEqual(['2100', '2400'])
    expect(splitPhoneNumbers('')).toEqual([])
    expect(normalizePhoneString('1100,1101')).toBe('1100, 1101')
  })

  it('contains 62 clean initial records with separate old/new buildings', () => {
    expect(INITIAL_INTERNAL_PHONES).toHaveLength(62)
    const adminRow = INITIAL_INTERNAL_PHONES.find((r) => r.room === 'บริหารฯ')
    expect(adminRow?.phone).toBe('2100, 2400')
    expect(adminRow?.building).toBe('อาคารร่มฉัตร')
    const erRow = INITIAL_INTERNAL_PHONES.find((r) => r.room === 'ER / ฉุกเฉิน')
    expect(erRow?.building).toBe('อาคารผู้ป่วยนอก/บำบัดรักษาฯ6ชั้น')
    const thaiMedRow = INITIAL_INTERNAL_PHONES.find((r) => r.phone === '2108')
    expect(thaiMedRow?.room).toBe('แพทย์แผนไทย')
  })

  it('filters and extracts facets and stats accurately', () => {
    const sample = [
      {
        id: 1,
        building: 'อาคารร่มฉัตร',
        floor: '1',
        room: 'ER / ฉุกเฉิน',
        phone: '1100, 1101',
        note: null,
        displayOrder: 1,
        isActive: true,
        createdBy: 'a',
        updatedBy: 'a',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 2,
        building: 'อาคารร่มบุญ',
        floor: null,
        room: 'ตึกร่มบุญ',
        phone: '2110',
        note: null,
        displayOrder: 2,
        isActive: true,
        createdBy: 'a',
        updatedBy: 'a',
        createdAt: '',
        updatedAt: '',
      },
    ]

    expect(filterInternalPhones(sample, { search: '1101' })).toHaveLength(1)
    expect(filterInternalPhones(sample, { building: 'อาคารร่มฉัตร', floor: 'NONE' })).toHaveLength(0)
    expect(filterInternalPhones(sample, { building: 'อาคารร่มบุญ', floor: 'NONE' })).toHaveLength(1)
    expect(extractBuildingFacets(sample)).toEqual({
      buildings: ['อาคารร่มฉัตร', 'อาคารร่มบุญ'],
      floorsByBuilding: { อาคารร่มฉัตร: ['1'], อาคารร่มบุญ: [] },
    })
    expect(computeInternalPhoneStats(sample)).toEqual({
      totalCount: 2,
      buildingCount: 2,
      extensionCount: 3,
    })

    const summaries = buildBuildingSummaries(sample)
    expect(summaries).toHaveLength(2)
    expect(summaries[0]).toMatchObject({
      building: 'อาคารร่มฉัตร',
      requiresFloorSelection: false,
      roomCount: 1,
      extensionCount: 2,
    })
    expect(summaries[1]).toMatchObject({
      building: 'อาคารร่มบุญ',
      requiresFloorSelection: false,
      roomCount: 1,
      extensionCount: 1,
    })
  })
})

describe('InternalPhoneService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('seeds 62 initial entries automatically when table is empty', async () => {
    const { gateway, rows, meta } = createInMemoryGateway()
    const service = new InternalPhoneService(gateway)

    const result = await service.listPhones()
    expect(rows).toHaveLength(62)
    expect(meta.get('initial_seed_v2')).toBe('done')
    expect(result.items).toHaveLength(62)
    expect(result.buildings).toContain('อาคารผู้ป่วยนอก/บำบัดรักษาฯ6ชั้น')
    expect(result.buildings).toContain('อาคารร่มฉัตร')
    expect(result.stats.totalCount).toBe(62)
  })

  it('replaces legacy v1 rows completely when initial_seed_v2 has not run yet', async () => {
    const { gateway, rows, meta } = createInMemoryGateway([
      {
        id: 999,
        building: 'อาคารร่มฉัตร',
        floor: '1',
        room: 'รายการเก่าที่ต้องถูกลบ',
        phone: '9999',
        note: null,
        displayOrder: 1,
        isActive: 1,
        createdBy: 'system-seed',
        updatedBy: 'system-seed',
        createdAt: '',
        updatedAt: '',
      },
    ])
    meta.set('initial_seed_v1', 'done')
    const service = new InternalPhoneService(gateway)

    const result = await service.listPhones()
    expect(meta.get('initial_seed_v2')).toBe('done')
    expect(rows).toHaveLength(62)
    expect(result.items.find((r) => r.room === 'รายการเก่าที่ต้องถูกลบ')).toBeUndefined()
    expect(result.items.find((r) => r.room === 'ER / ฉุกเฉิน')?.building).toBe(
      'อาคารผู้ป่วยนอก/บำบัดรักษาฯ6ชั้น'
    )
  })

  it('creates, updates, and deletes entries and writes audit logs', async () => {
    const { gateway } = createInMemoryGateway()
    const service = new InternalPhoneService(gateway)

    const created = await service.createPhone(
      {
        building: 'ตึกใหม่',
        floor: '3',
        room: 'ห้องประชุมชั้น 3',
        phone: '1399,1398',
        note: 'ห้องประชุมย่อย',
      },
      { username: 'admin_test', email: 'admin@thoen.local' }
    )

    expect(created.building).toBe('อาคารผู้ป่วยนอก/บำบัดรักษาฯ6ชั้น')
    expect(created.phone).toBe('1399, 1398')
    expect(logAudit).toHaveBeenCalledWith(
      'CREATE',
      'hospital_internal_phones',
      expect.stringContaining('ห้องประชุมชั้น 3'),
      expect.objectContaining({ username: 'admin_test' })
    )

    const updated = await service.updatePhone(
      created.id,
      { phone: '1399', note: 'อัปเดตเบอร์' },
      { username: 'admin_test', email: 'admin@thoen.local' }
    )
    expect(updated.phone).toBe('1399')
    expect(updated.note).toBe('อัปเดตเบอร์')
    expect(logAudit).toHaveBeenCalledWith(
      'UPDATE',
      'hospital_internal_phones',
      expect.stringContaining(`#${created.id}`),
      expect.objectContaining({ username: 'admin_test' })
    )

    const deleted = await service.deletePhone(created.id, {
      username: 'admin_test',
      email: 'admin@thoen.local',
    })
    expect(deleted).toEqual({ id: created.id })
    expect(logAudit).toHaveBeenCalledWith(
      'DELETE',
      'hospital_internal_phones',
      expect.stringContaining(`#${created.id}`),
      expect.objectContaining({ username: 'admin_test' })
    )

    await expect(service.getPhoneById(created.id)).rejects.toBeInstanceOf(
      InternalPhoneNotFoundError
    )
  })
})
