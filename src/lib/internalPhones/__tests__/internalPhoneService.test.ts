import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

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
  type InternalPhoneDbDeps,
} from '../internalPhoneService'
import type { InternalPhoneRecordRaw } from '../internalPhoneTypes'

function createInMemoryDeps(initialRows: InternalPhoneRecordRaw[] = []): {
  deps: InternalPhoneDbDeps
  rows: InternalPhoneRecordRaw[]
  meta: Map<string, string>
} {
  let nextId = initialRows.reduce((max, r) => Math.max(max, r.id), 0) + 1
  const rows: InternalPhoneRecordRaw[] = [...initialRows]
  const meta = new Map<string, string>()

  const executeStatement = (sql: string, params: unknown[] = []) => {
    const normalized = sql.trim().replace(/\s+/g, ' ').toUpperCase()

    if (
      normalized.startsWith('SET NAMES') ||
      normalized.startsWith('CREATE TABLE')
    ) {
      return { affectedRows: 0, insertId: null }
    }

    if (normalized.startsWith('INSERT INTO HOSPITAL_INTERNAL_PHONES_META')) {
      meta.set('initial_seed_v1', 'done')
      return { affectedRows: 1, insertId: null }
    }

    if (normalized.startsWith('INSERT INTO HOSPITAL_INTERNAL_PHONES')) {
      const [
        building,
        floor,
        room,
        phone,
        note,
        displayOrder,
        isActive,
        createdBy,
        updatedBy,
      ] = params as [
        string,
        string | null,
        string,
        string,
        string | null,
        number,
        number,
        string,
        string,
      ]
      const newRow: InternalPhoneRecordRaw = {
        id: nextId++,
        building,
        floor,
        room,
        phone,
        note,
        displayOrder,
        isActive,
        createdBy,
        updatedBy,
        createdAt: '2026-11-20T06:00:00.000Z',
        updatedAt: '2026-11-20T06:00:00.000Z',
      }
      rows.push(newRow)
      return { affectedRows: 1, insertId: newRow.id }
    }

    if (normalized.startsWith('UPDATE HOSPITAL_INTERNAL_PHONES SET')) {
      const id = Number(params[params.length - 1])
      const target = rows.find((r) => r.id === id)
      if (!target) return { affectedRows: 0, insertId: null }

      const setClause = sql.slice(sql.indexOf('SET') + 3, sql.indexOf('WHERE')).trim()
      const fields = setClause.split(',').map((part) => part.split('=')[0].trim())
      fields.forEach((col, idx) => {
        const val = params[idx]
        if (col === 'building') target.building = String(val)
        if (col === 'floor') target.floor = (val as string | null) ?? null
        if (col === 'room') target.room = String(val)
        if (col === 'phone') target.phone = String(val)
        if (col === 'note') target.note = (val as string | null) ?? null
        if (col === 'display_order') target.displayOrder = Number(val)
        if (col === 'is_active') target.isActive = Number(val)
        if (col === 'updated_by') target.updatedBy = String(val)
      })
      return { affectedRows: 1, insertId: null }
    }

    if (normalized.startsWith('DELETE FROM HOSPITAL_INTERNAL_PHONES WHERE ID =')) {
      const id = Number(params[0])
      const idx = rows.findIndex((r) => r.id === id)
      if (idx === -1) return { affectedRows: 0, insertId: null }
      rows.splice(idx, 1)
      return { affectedRows: 1, insertId: null }
    }

    return { affectedRows: 0, insertId: null }
  }

  const deps: InternalPhoneDbDeps = {
    appQuery: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
      const normalized = sql.trim().replace(/\s+/g, ' ').toUpperCase()
      if (normalized.includes('FROM HOSPITAL_INTERNAL_PHONES_META')) {
        const val = meta.get(String(params[0] ?? ''))
        return (val ? [{ meta_value: val }] : []) as T[]
      }
      if (normalized.includes('SELECT COUNT(*) AS TOTAL FROM HOSPITAL_INTERNAL_PHONES')) {
        return [{ total: rows.length }] as T[]
      }
      if (normalized.includes('SELECT MAX(DISPLAY_ORDER)')) {
        const maxOrder = rows.reduce((m, r) => Math.max(m, r.displayOrder), 0)
        return [{ maxOrder }] as T[]
      }
      if (normalized.includes('WHERE ID = ?')) {
        const id = Number(params[0])
        return rows.filter((r) => r.id === id) as T[]
      }
      if (normalized.includes('FROM HOSPITAL_INTERNAL_PHONES')) {
        return [...rows] as T[]
      }
      return [] as T[]
    },
    appTransaction: async (statements) => {
      const results = statements.map((stmt) => executeStatement(stmt.sql, stmt.params))
      return { count: results.length, results }
    },
  }

  return { deps, rows, meta }
}

describe('internalPhoneDomain', () => {
  it('normalizes legacy building aliases ("ตึกเก่า", "ตึกใหม่") to "อาคารร่มฉัตร"', () => {
    expect(normalizeBuildingName('ตึกเก่า')).toBe('อาคารร่มฉัตร')
    expect(normalizeBuildingName('ตึกใหม่')).toBe('อาคารร่มฉัตร')
    expect(normalizeBuildingName('  อาคารร่มบุญ  ')).toBe('อาคารร่มบุญ')
  })

  it('splits multi-extension strings cleanly', () => {
    expect(splitPhoneNumbers('1100, 1101')).toEqual(['1100', '1101'])
    expect(splitPhoneNumbers('2100; 2400 ')).toEqual(['2100', '2400'])
    expect(splitPhoneNumbers('')).toEqual([])
    expect(normalizePhoneString('1100,1101')).toBe('1100, 1101')
  })

  it('contains 62 clean initial records including fixed entries', () => {
    expect(INITIAL_INTERNAL_PHONES).toHaveLength(62)
    const adminRow = INITIAL_INTERNAL_PHONES.find((r) => r.room === 'บริหารฯ')
    expect(adminRow?.phone).toBe('2100, 2400')
    expect(adminRow?.building).toBe('อาคารร่มฉัตร')
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
    const { deps, rows, meta } = createInMemoryDeps()
    const service = new InternalPhoneService(deps)

    const result = await service.listPhones()
    expect(rows).toHaveLength(62)
    expect(meta.get('initial_seed_v1')).toBe('done')
    expect(result.items).toHaveLength(62)
    expect(result.buildings).toContain('อาคารร่มฉัตร')
    expect(result.stats.totalCount).toBe(62)
  })

  it('creates, updates, and deletes entries and writes audit logs', async () => {
    const { deps } = createInMemoryDeps()
    const service = new InternalPhoneService(deps)

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

    expect(created.building).toBe('อาคารร่มฉัตร')
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
