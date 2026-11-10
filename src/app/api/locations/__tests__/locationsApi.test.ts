import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getLocations } from '../route'
import { GET as getAdminLocations, POST as createAdminLocation, PATCH as updateAdminLocation, DELETE as deleteAdminLocation } from '../../admin/locations/route'
import { apiGateway } from '@/lib/apiGateway'

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      getLocations: vi.fn(),
      createLocation: vi.fn(),
      updateLocation: vi.fn(),
      deleteLocation: vi.fn(),
    },
  },
}))

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn().mockResolvedValue({
    id: 1,
    username: 'admin',
    role: 'admin',
  }),
}))

describe('Hospital Locations API Routes (Named Gateway Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/locations returns simple list of active locations for members', async () => {
    vi.mocked(apiGateway.app.getLocations).mockResolvedValue({
      success: true,
      data: [
        { id: 1, room_name: 'OPD 1', full_name: 'อาคารผู้ป่วยนอก ชั้น 1 (OPD 1)' },
      ],
    })

    const req = new Request('http://localhost:3000/api/locations?search=OPD')
    const res = await getLocations(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(apiGateway.app.getLocations).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'OPD', detailed: false })
    )
  })

  it('GET /api/admin/locations returns detailed locations and stats for admin', async () => {
    vi.mocked(apiGateway.app.getLocations).mockResolvedValue({
      success: true,
      data: {
        items: [{ id: 1, room_name: 'OPD 1' }],
        total: 1,
        page: 1,
        totalPages: 1,
        buildings: [{ building_id: 1, building_name: 'อาคาร 1' }],
        buildingFloors: [],
        stats: { totalCount: 1, activeCount: 1, buildingCount: 1 },
      },
    })

    const req = new Request('http://localhost:3000/api/admin/locations?page=1&limit=50')
    const res = await getAdminLocations(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.stats.totalCount).toBe(1)
    expect(apiGateway.app.getLocations).toHaveBeenCalledWith(
      expect.objectContaining({ detailed: true, page: 1, limit: 50 })
    )
  })

  it('POST /api/admin/locations creates a new hospital location', async () => {
    vi.mocked(apiGateway.app.createLocation).mockResolvedValue({
      success: true,
      message: 'เพิ่มข้อมูลสถานที่สำเร็จ',
      data: { id: 10, room_name: 'ห้องยา', building_name: 'อาคารหลัก', floor_name: 'ชั้น 1' },
    })

    const req = new Request('http://localhost:3000/api/admin/locations', {
      method: 'POST',
      body: JSON.stringify({
        room_name: 'ห้องยา',
        building_name: 'อาคารหลัก',
        floor_name: 'ชั้น 1',
      }),
    })

    const res = await createAdminLocation(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.createLocation).toHaveBeenCalledWith(
      expect.objectContaining({ room_name: 'ห้องยา', building_name: 'อาคารหลัก' })
    )
  })

  it('PATCH /api/admin/locations updates hospital location', async () => {
    vi.mocked(apiGateway.app.updateLocation).mockResolvedValue({
      success: true,
      message: 'แก้ไขข้อมูลสถานที่สำเร็จ',
      data: { id: 10, is_active: 0 },
    })

    const req = new Request('http://localhost:3000/api/admin/locations', {
      method: 'PATCH',
      body: JSON.stringify({ id: 10, is_active: 0 }),
    })

    const res = await updateAdminLocation(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.updateLocation).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ is_active: 0 })
    )
  })

  it('DELETE /api/admin/locations removes hospital location', async () => {
    vi.mocked(apiGateway.app.deleteLocation).mockResolvedValue({
      success: true,
      message: 'ลบข้อมูลสถานที่สำเร็จ',
    })

    const req = new Request('http://localhost:3000/api/admin/locations?id=10', {
      method: 'DELETE',
    })

    const res = await deleteAdminLocation(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(apiGateway.app.deleteLocation).toHaveBeenCalledWith('10')
  })
})
