import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MokService, MOK_CATEGORIES } from '../mokService'

describe('MokService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('contains all 17 clinical and audit categories', () => {
    expect(MOK_CATEGORIES).toHaveLength(17)
    const ids = MOK_CATEGORIES.map((c) => c.id)
    expect(ids).toContain('asthma')
    expect(ids).toContain('ca')
    expect(ids).toContain('ckd_all')
    expect(ids).toContain('ckd_45')
    expect(ids).toContain('copd')
    expect(ids).toContain('copd_readmit')
    expect(ids).toContain('dm')
    expect(ids).toContain('ht')
    expect(ids).toContain('palliative')
    expect(ids).toContain('stroke')
    expect(ids).toContain('tb')
    expect(ids).toContain('warfarin')
    expect(ids).toContain('type_area_mismatch')
    expect(ids).toContain('elderly_bedridden')
    expect(ids).toContain('disabled_dependent')
    expect(ids).toContain('pregnant_risk')
    expect(ids).toContain('child_delayed_dev')
  })

  it('fetches and maps in-catchment Asthma records correctly without masking', async () => {
    const mockDbResult = [
      {
        cid: '1520800012345',
        hn: '0012345',
        ptname: 'นาย สมชาย ใจดี',
        age: 45,
        tambon_name: 'ล้อมแรด',
        address: '123 หมู่ที่ 1 ตำบลล้อมแรด',
        addrpart: '123',
        moopart: '1',
        occupation_name: 'เกษตรกร',
        cn: '1',
        cn2: 'Level 1 Controlled',
      },
    ]

    const fakeQuery = vi.fn().mockImplementation((sql: string) => {
      // Check that the in-catchment SQL condition is applied
      expect(sql).toContain("pe.village_id NOT IN ('1')")
      expect(sql).toContain("pe.house_regist_type_id IN ('1', '3')")
      expect(sql).toContain("cl.clinic = '022'")
      return Promise.resolve(mockDbResult)
    })

    const results = await MokService.fetchCategoryRecords('asthma', 'in_catchment', fakeQuery)

    expect(fakeQuery).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(1)
    expect(results[0].cid).toBe('1520800012345') // No masking!
    expect(results[0].hn).toBe('0012345')
    expect(results[0].ptname).toBe('นาย สมชาย ใจดี')
    expect(results[0].age).toBe(45)
    expect(results[0].cn).toBe('1')
  })

  it('applies out-catchment filter when out_catchment is requested', async () => {
    const fakeQuery = vi.fn().mockImplementation((sql: string) => {
      expect(sql).toContain("pe.village_id = '1'")
      expect(sql).toContain("pe.house_regist_type_id IN ('4')")
      expect(sql).toContain("pt.chwpart = '52' AND pt.amppart = '08'")
      return Promise.resolve([])
    })

    const results = await MokService.fetchCategoryRecords('dm', 'out_catchment', fakeQuery)
    expect(fakeQuery).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(0)
  })

  it('fetches category counts using single-flight aggregation', async () => {
    const fakeRows = [
      { clinic: '022', stage_note: '', total: 15 },
      { clinic: '055', stage_note: '4', total: 8 },
      { clinic: '055', stage_note: '3', total: 20 },
      { clinic: '001', stage_note: '', total: 100 },
    ]
    const fakeQuery = vi.fn().mockResolvedValue(fakeRows)

    const counts = await MokService.fetchCategoryCounts('in_catchment', fakeQuery)

    expect(fakeQuery).toHaveBeenCalledTimes(1)
    expect(counts['asthma']).toBe(15)
    expect(counts['ckd_all']).toBe(28)
    expect(counts['ckd_45']).toBe(8)
    expect(counts['dm']).toBe(100)
    expect(counts['ht']).toBe(0)
  })

  it('throws error on invalid category ID', async () => {
    await expect(
      MokService.fetchCategoryRecords('non_existent_category', 'in_catchment')
    ).rejects.toThrow('Unknown MOK Category: non_existent_category')
  })
})
