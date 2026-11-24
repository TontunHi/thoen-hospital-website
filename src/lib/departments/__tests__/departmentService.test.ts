import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DepartmentService,
  type CreateGroupInput,
  type CreateMemberInput,
  type DepartmentGatewayAdapter,
} from '../departmentService'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('DepartmentService (TDD)', () => {
  let mockGw: { [K in keyof DepartmentGatewayAdapter]: ReturnType<typeof vi.fn> }
  let service: DepartmentService

  beforeEach(() => {
    vi.clearAllMocks()
    mockGw = {
      listDepartmentGroupsV2: vi.fn(),
      getDepartmentGroupByIdV2: vi.fn(),
      createDepartmentGroupV2: vi.fn(),
      updateDepartmentGroupV2: vi.fn(),
      reorderDepartmentGroupsV2: vi.fn(),
      deleteDepartmentGroupV2: vi.fn(),
      listDepartmentRolesV2: vi.fn(),
      createDepartmentRoleV2: vi.fn(),
      updateDepartmentRoleV2: vi.fn(),
      deleteDepartmentRoleV2: vi.fn(),
      reorderDepartmentRolesV2: vi.fn(),
      listDepartmentMembersV2: vi.fn(),
      createDepartmentMemberV2: vi.fn(),
      updateDepartmentMemberV2: vi.fn(),
      deleteDepartmentMemberV2: vi.fn(),
      reorderDepartmentMembersV2: vi.fn(),
      searchDepartmentStaffV2: vi.fn(),
      getPublicOrgChartRawV2: vi.fn(),
    }
    service = new DepartmentService(mockGw as unknown as Partial<DepartmentGatewayAdapter>)
  })

  describe('Group Management', () => {
    it('creates a root department group with correct defaults', async () => {
      mockGw.createDepartmentGroupV2.mockResolvedValueOnce({ id: 1 })

      const input: CreateGroupInput = {
        name: 'กลุ่มงานการพยาบาล',
        orderIndex: 1,
      }

      const result = await service.createGroup(input, { id: 99, name: 'Admin User' })
      expect(result).toEqual({
        id: 1,
        name: 'กลุ่มงานการพยาบาล',
        parentId: null,
        orderIndex: 1,
        isActive: true,
      })
      expect(mockGw.createDepartmentGroupV2).toHaveBeenCalledWith({
        name: 'กลุ่มงานการพยาบาล',
        parentId: null,
        orderIndex: 1,
      })
    })

    it('builds a hierarchical tree from flat group records', async () => {
      mockGw.listDepartmentGroupsV2.mockResolvedValueOnce([
        { id: 1, name: 'กลุ่มงานการพยาบาล', parent_id: null, order_index: 0, is_active: 1 },
        { id: 2, name: 'งานอุบัติเหตุและฉุกเฉิน', parent_id: 1, order_index: 0, is_active: 1 },
        { id: 3, name: 'งานผู้ป่วยนอก', parent_id: 1, order_index: 1, is_active: 1 },
        { id: 4, name: 'หน่วยรถพยาบาล EMS', parent_id: 2, order_index: 0, is_active: 1 },
        { id: 5, name: 'กลุ่มงานเภสัชกรรม', parent_id: null, order_index: 1, is_active: 1 },
      ])

      const tree = await service.getGroupTree()
      expect(tree).toHaveLength(2)
      expect(tree[0].name).toBe('กลุ่มงานการพยาบาล')
      expect(tree[0].children).toHaveLength(2)
      expect(tree[0].children[0].name).toBe('งานอุบัติเหตุและฉุกเฉิน')
      expect(tree[0].children[0].children).toHaveLength(1)
      expect(tree[0].children[0].children[0].name).toBe('หน่วยรถพยาบาล EMS')
      expect(tree[1].name).toBe('กลุ่มงานเภสัชกรรม')
      expect(tree[1].children).toHaveLength(0)
    })

    it('prevents deleting a group if it has subgroups', async () => {
      mockGw.deleteDepartmentGroupV2.mockRejectedValueOnce(
        new Error('ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากมีกลุ่มงานย่อยอยู่ภายใน')
      )

      await expect(service.deleteGroup(1, { id: 99, name: 'Admin' })).rejects.toThrow(
        'ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากมีกลุ่มงานย่อยอยู่ภายใน'
      )
    })

    it('prevents deleting a group if it has members', async () => {
      mockGw.deleteDepartmentGroupV2.mockRejectedValueOnce(
        new Error('ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากยังมีสมาชิกอยู่ภายในกลุ่มงาน')
      )

      await expect(service.deleteGroup(1, { id: 99, name: 'Admin' })).rejects.toThrow(
        'ไม่สามารถลบกลุ่มงานนี้ได้ เนื่องจากยังมีสมาชิกอยู่ภายในกลุ่มงาน'
      )
    })

    it('successfully deletes an empty group', async () => {
      mockGw.deleteDepartmentGroupV2.mockResolvedValueOnce({ deleted: true })

      const result = await service.deleteGroup(1, { id: 99, name: 'Admin' })
      expect(result).toBe(true)
      expect(mockGw.deleteDepartmentGroupV2).toHaveBeenCalledWith(1)
    })

    it('reorders groups atomically within the hierarchy', async () => {
      mockGw.reorderDepartmentGroupsV2.mockResolvedValueOnce({ reordered: true })

      const success = await service.reorderGroups([5, 1, 3], { id: 99, name: 'Admin' })
      expect(success).toBe(true)
      expect(mockGw.reorderDepartmentGroupsV2).toHaveBeenCalledWith([5, 1, 3])
    })
  })

  describe('Member Management & Privacy', () => {
    it('creates a member with leader role and optional phone', async () => {
      mockGw.createDepartmentMemberV2.mockResolvedValueOnce({ id: 10 })

      const input: CreateMemberInput = {
        groupId: 1,
        name: 'พว.สมหญิง ใจดี',
        position: 'หัวหน้ากลุ่มงานการพยาบาล',
        role: 'leader',
        phone: '101',
        orderIndex: 0,
      }

      const result = await service.createMember(input, { id: 99, name: 'Admin' })
      expect(result.id).toBe(10)
      expect(result.role).toBe('leader')
      expect(result.phone).toBe('101')
      expect(mockGw.createDepartmentMemberV2).toHaveBeenCalledWith({
        groupId: 1,
        name: 'พว.สมหญิง ใจดี',
        position: 'หัวหน้ากลุ่มงานการพยาบาล',
        role: 'leader',
        orderIndex: 0,
        imagePath: null,
        phone: '101',
        memberId: null,
      })
    })

    it('strips phone numbers when retrieving members for public view', async () => {
      mockGw.listDepartmentMembersV2.mockResolvedValueOnce([
        {
          id: 1,
          group_id: 1,
          name: 'นพ.ใจดี รักษาดี',
          position: 'นายแพทย์ชำนาญการ',
          role: 'leader',
          order_index: 0,
          image_path: '/uploads/doc.jpg',
          phone: '0812345678',
          member_id: 5,
        },
      ])

      const publicMembers = await service.getMembersByGroupId(1, { isPublic: true })
      expect(publicMembers).toHaveLength(1)
      expect(publicMembers[0].name).toBe('นพ.ใจดี รักษาดี')
      expect(publicMembers[0].phone).toBeUndefined()
      expect(publicMembers[0].role).toBe('leader')
    })

    it('reorders members in a group in a single batch call', async () => {
      mockGw.reorderDepartmentMembersV2.mockResolvedValueOnce({ reordered: true })

      const success = await service.reorderMembers(1, [103, 101, 102], { id: 99, name: 'Admin' })
      expect(success).toBe(true)
      expect(mockGw.reorderDepartmentMembersV2).toHaveBeenCalledWith(1, [103, 101, 102])
    })

    it('fetches complete public org chart without phone numbers', async () => {
      mockGw.getPublicOrgChartRawV2.mockResolvedValueOnce({
        groups: [
          { id: 1, name: 'กลุ่มงานการพยาบาล', parent_id: null, order_index: 0 },
          { id: 2, name: 'งานอุบัติเหตุและฉุกเฉิน', parent_id: 1, order_index: 0 },
        ],
        members: [
          { id: 10, group_id: 1, name: 'หัวหน้ากลุ่ม', position: 'พยาบาลวิชาชีพชำนาญการพิเศษ', role: 'leader', order_index: 0, image_path: '/img/h.jpg', phone: '123' },
          { id: 20, group_id: 2, name: 'พยาบาล ER', position: 'พยาบาลวิชาชีพ', role: 'member', order_index: 0, image_path: null, phone: '456' },
        ],
      })

      const chart = await service.getPublicOrgChart()
      expect(chart).toHaveLength(1)
      expect(chart[0].name).toBe('กลุ่มงานการพยาบาล')
      expect(chart[0].members).toHaveLength(1)
      expect(chart[0].members[0].name).toBe('หัวหน้ากลุ่ม')
      expect((chart[0].members[0] as any).phone).toBeUndefined()
      expect(chart[0].children).toHaveLength(1)
      expect((chart[0].children[0] as any).name).toBe('งานอุบัติเหตุและฉุกเฉิน')
      expect((chart[0].children[0] as any).members).toHaveLength(1)
      expect((chart[0].children[0] as any).members[0].name).toBe('พยาบาล ER')
      expect((chart[0].children[0] as any).members[0].phone).toBeUndefined()
    })

    it('searches staff by keyword', async () => {
      mockGw.searchDepartmentStaffV2.mockResolvedValueOnce([
        { id: 10, group_id: 1, name: 'พญ.ใจดี', position: 'แพทย์', role: 'leader', order_index: 0, image_path: null, group_name: 'กลุ่มงานการแพทย์' },
      ])

      const results = await service.searchStaff('ใจดี')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('พญ.ใจดี')
      expect(results[0].groupName).toBe('กลุ่มงานการแพทย์')
    })
  })

  describe('Role Levels Management', () => {
    it('creates a custom department role', async () => {
      mockGw.createDepartmentRoleV2.mockResolvedValueOnce({ id: 5, orderIndex: 3 })

      const role = await service.createRole(
        { name: 'รองหัวหน้ากลุ่มงาน' },
        { id: 1, name: 'Admin' }
      )

      expect(role).toEqual({
        id: 5,
        name: 'รองหัวหน้ากลุ่มงาน',
        orderIndex: 3,
        isDefault: false,
      })
    })

    it('retrieves all roles ordered by priority', async () => {
      mockGw.listDepartmentRolesV2.mockResolvedValueOnce([
        { id: 1, name: 'หัวหน้ากลุ่มงาน', order_index: 0, is_default: 0 },
        { id: 2, name: 'รองหัวหน้ากลุ่มงาน', order_index: 1, is_default: 0 },
        { id: 3, name: 'เจ้าหน้าที่ผู้ปฏิบัติงาน', order_index: 2, is_default: 1 },
      ])

      const roles = await service.getRoles()
      expect(roles).toHaveLength(3)
      expect(roles[0].name).toBe('หัวหน้ากลุ่มงาน')
      expect(roles[1].name).toBe('รองหัวหน้ากลุ่มงาน')
      expect(roles[2].isDefault).toBe(true)
    })

    it('reorders roles atomically', async () => {
      mockGw.reorderDepartmentRolesV2.mockResolvedValueOnce({ reordered: true })

      const success = await service.reorderRoles([2, 1], { id: 1, name: 'Admin' })
      expect(success).toBe(true)
      expect(mockGw.reorderDepartmentRolesV2).toHaveBeenCalledWith([2, 1])
    })

    it('updates a role name', async () => {
      mockGw.updateDepartmentRoleV2.mockResolvedValueOnce({ updated: true })

      const success = await service.updateRole(
        2,
        { name: 'รองหัวหน้ากลุ่มงาน (ฝ่ายบริหาร)' },
        { id: 1, name: 'Admin' }
      )
      expect(success).toBe(true)
      expect(mockGw.updateDepartmentRoleV2).toHaveBeenCalledWith(2, {
        name: 'รองหัวหน้ากลุ่มงาน (ฝ่ายบริหาร)',
      })
    })

    it('deletes a role', async () => {
      mockGw.deleteDepartmentRoleV2.mockResolvedValueOnce({ deleted: true })

      const success = await service.deleteRole(2, { id: 1, name: 'Admin' })
      expect(success).toBe(true)
      expect(mockGw.deleteDepartmentRoleV2).toHaveBeenCalledWith(2)
    })
  })
})
