import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DepartmentService, CreateGroupInput, CreateMemberInput } from '../departmentService'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined)
}))

describe('DepartmentService (TDD)', () => {
  let mockExecutor: ReturnType<typeof vi.fn>
  let service: DepartmentService

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecutor = vi.fn()
    service = new DepartmentService(mockExecutor as any, { skipEnsureTables: true })
  })

  describe('Table Schema Initialization', () => {
    it('executes CREATE TABLE IF NOT EXISTS for groups and members', async () => {
      const freshService = new DepartmentService(mockExecutor as any, { skipEnsureTables: false })
      mockExecutor.mockResolvedValue([])

      await freshService.ensureTablesExist()
      expect(mockExecutor).toHaveBeenCalledTimes(2)
      expect(mockExecutor.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS department_groups')
      expect(mockExecutor.mock.calls[1][0]).toContain('CREATE TABLE IF NOT EXISTS department_members')
    })
  })

  describe('Group Management', () => {
    it('creates a root department group with correct defaults', async () => {
      mockExecutor.mockResolvedValueOnce({ insertId: 1, affectedRows: 1 })

      const input: CreateGroupInput = {
        name: 'กลุ่มงานการพยาบาล',
        orderIndex: 1
      }

      const result = await service.createGroup(input, { id: 99, name: 'Admin User' })
      expect(result).toEqual({ id: 1, name: 'กลุ่มงานการพยาบาล', parentId: null, orderIndex: 1, isActive: true })
      expect(mockExecutor).toHaveBeenCalledTimes(1)
      const [sql, params] = mockExecutor.mock.calls[0]
      expect(sql).toContain('INSERT INTO department_groups')
      expect(params).toEqual(['กลุ่มงานการพยาบาล', null, 1])
    })

    it('builds a hierarchical tree from flat group records', async () => {
      mockExecutor.mockResolvedValueOnce([
        { id: 1, name: 'กลุ่มงานการพยาบาล', parent_id: null, order_index: 0, is_active: 1 },
        { id: 2, name: 'งานอุบัติเหตุและฉุกเฉิน', parent_id: 1, order_index: 0, is_active: 1 },
        { id: 3, name: 'งานผู้ป่วยนอก', parent_id: 1, order_index: 1, is_active: 1 },
        { id: 4, name: 'หน่วยรถพยาบาล EMS', parent_id: 2, order_index: 0, is_active: 1 },
        { id: 5, name: 'กลุ่มงานเภสัชกรรม', parent_id: null, order_index: 1, is_active: 1 },
      ])

      const tree = await service.getGroupTree()
      expect(tree).toHaveLength(2) // 2 root groups: พยาบาล and เภสัชกรรม
      expect(tree[0].name).toBe('กลุ่มงานการพยาบาล')
      expect(tree[0].children).toHaveLength(2) // อุบัติเหตุ and ผู้ป่วยนอก
      expect(tree[0].children[0].name).toBe('งานอุบัติเหตุและฉุกเฉิน')
      expect(tree[0].children[0].children).toHaveLength(1) // EMS
      expect(tree[0].children[0].children[0].name).toBe('หน่วยรถพยาบาล EMS')
      expect(tree[1].name).toBe('กลุ่มงานเภสัชกรรม')
      expect(tree[1].children).toHaveLength(0)
    })

    it('prevents deleting a group if it has subgroups', async () => {
      // Check subgroups count > 0
      mockExecutor.mockResolvedValueOnce([{ count: 2 }])

      await expect(service.deleteGroup(1, { id: 99, name: 'Admin' })).rejects.toThrow(
        'ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากมีกลุ่มงานย่อยอยู่ภายใน'
      )
    })

    it('prevents deleting a group if it has members', async () => {
      // Subgroups = 0, Members = 3
      mockExecutor
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 3 }])

      await expect(service.deleteGroup(1, { id: 99, name: 'Admin' })).rejects.toThrow(
        'ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากยังมีสมาชิกอยู่ภายในกลุ่มงาน'
      )
    })

    it('successfully deletes an empty group', async () => {
      mockExecutor
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce({ affectedRows: 1 })

      const result = await service.deleteGroup(1, { id: 99, name: 'Admin' })
      expect(result).toBe(true)
      expect(mockExecutor).toHaveBeenCalledTimes(3)
    })
  })

  describe('Member Management & Privacy', () => {
    it('creates a member with leader role and optional phone', async () => {
      mockExecutor.mockResolvedValueOnce({ insertId: 10, affectedRows: 1 })

      const input: CreateMemberInput = {
        groupId: 1,
        name: 'พว.สมหญิง ใจดี',
        position: 'หัวหน้ากลุ่มงานการพยาบาล',
        role: 'leader',
        phone: '101',
        orderIndex: 0
      }

      const result = await service.createMember(input, { id: 99, name: 'Admin' })
      expect(result.id).toBe(10)
      expect(result.role).toBe('leader')
      expect(result.phone).toBe('101')
      const [sql, params] = mockExecutor.mock.calls[0]
      expect(sql).toContain('INSERT INTO department_members')
      expect(params).toEqual([1, 'พว.สมหญิง ใจดี', 'หัวหน้ากลุ่มงานการพยาบาล', 'leader', 0, null, '101', null])
    })

    it('strips phone numbers when retrieving members for public view', async () => {
      mockExecutor.mockResolvedValueOnce([
        {
          id: 1,
          group_id: 1,
          name: 'นพ.ใจดี รักษาดี',
          position: 'นายแพทย์ชำนาญการ',
          role: 'leader',
          order_index: 0,
          image_path: '/uploads/doc.jpg',
          phone: '0812345678', // Sensitive phone number
          member_id: 5
        }
      ])

      const publicMembers = await service.getMembersByGroupId(1, { isPublic: true })
      expect(publicMembers).toHaveLength(1)
      expect(publicMembers[0].name).toBe('นพ.ใจดี รักษาดี')
      expect(publicMembers[0].phone).toBeUndefined() // Stripped for PDPA privacy
      expect(publicMembers[0].role).toBe('leader')
    })

    it('reorders members in a group sequentially', async () => {
      mockExecutor.mockResolvedValue({ affectedRows: 1 })

      const success = await service.reorderMembers(1, [103, 101, 102], { id: 99, name: 'Admin' })
      expect(success).toBe(true)
      // 3 updates for the 3 members
      expect(mockExecutor).toHaveBeenCalledTimes(3)
      expect(mockExecutor.mock.calls[0][1]).toEqual([0, 103, 1])
      expect(mockExecutor.mock.calls[1][1]).toEqual([1, 101, 1])
      expect(mockExecutor.mock.calls[2][1]).toEqual([2, 102, 1])
    })

    it('fetches complete public org chart without phone numbers', async () => {
      mockExecutor
        .mockResolvedValueOnce([
          { id: 1, name: 'กลุ่มงานการพยาบาล', parent_id: null, order_index: 0 },
          { id: 2, name: 'งานอุบัติเหตุและฉุกเฉิน', parent_id: 1, order_index: 0 },
        ])
        .mockResolvedValueOnce([
          { id: 10, group_id: 1, name: 'หัวหน้ากลุ่ม', position: 'พยาบาลวิชาชีพชำนาญการพิเศษ', role: 'leader', order_index: 0, image_path: '/img/h.jpg', phone: '123' },
          { id: 20, group_id: 2, name: 'พยาบาล ER', position: 'พยาบาลวิชาชีพ', role: 'member', order_index: 0, image_path: null, phone: '456' },
        ])

      const chart = await service.getPublicOrgChart()
      expect(chart).toHaveLength(1)
      expect(chart[0].name).toBe('กลุ่มงานการพยาบาล')
      expect(chart[0].members).toHaveLength(1)
      expect(chart[0].members[0].name).toBe('หัวหน้ากลุ่ม')
      expect(chart[0].members[0].phone).toBeUndefined() // Privacy check: phone must be stripped
      expect(chart[0].children).toHaveLength(1)
      expect(chart[0].children[0].name).toBe('งานอุบัติเหตุและฉุกเฉิน')
      expect(chart[0].children[0].members).toHaveLength(1)
      expect(chart[0].children[0].members[0].name).toBe('พยาบาล ER')
      expect(chart[0].children[0].members[0].phone).toBeUndefined()
    })

    it('searches staff by keyword', async () => {
      mockExecutor.mockResolvedValueOnce([
        { id: 10, group_id: 1, name: 'พญ.ใจดี', position: 'แพทย์', role: 'leader', order_index: 0, image_path: null, group_name: 'กลุ่มงานการแพทย์' }
      ])

      const results = await service.searchStaff('ใจดี')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('พญ.ใจดี')
      expect(results[0].groupName).toBe('กลุ่มงานการแพทย์')
    })
  })
})
