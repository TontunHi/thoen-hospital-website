import { describe, it, expect } from 'vitest'
import { resolveTaskPermissions, MemberLike, TaskLike } from '@/lib/taskPermissionResolver'

describe('resolveTaskPermissions Domain Module', () => {
  const baseTask: TaskLike = {
    id: 'task-1',
    task_no: 'IT-2570-10-0001',
    task_type: 'IT_REPAIR',
    requester_id: 10,
    requester_dept: 'กลุ่มงานการพยาบาล',
    current_assignee: null,
    current_role: 'นักวิชาการคอมพิวเตอร์',
    status: 'PENDING',
  }

  it('returns all false when member or task is null', () => {
    const res1 = resolveTaskPermissions(null, baseTask)
    expect(res1.canView).toBe(false)
    expect(res1.canEdit).toBe(false)

    const res2 = resolveTaskPermissions({ id: 1 }, null)
    expect(res2.canView).toBe(false)
    expect(res2.canEdit).toBe(false)
  })

  it('grants full view and edit to admin role', () => {
    const adminMember: MemberLike = {
      id: 1,
      username: 'admin',
      role: 'admin',
      position: 'ผู้อำนวยการโรงพยาบาลเถิน',
    }

    const res = resolveTaskPermissions(adminMember, baseTask)
    expect(res.isAdmin).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(true)
    expect(res.canApprove).toBe(true)
    expect(res.canCancel).toBe(true)
    expect(res.canTakeJob).toBe(true)
  })

  it('grants view and edit to requester while task is pending', () => {
    const requester: MemberLike = {
      id: 10,
      username: 'nurse_somying',
      role: 'member',
      position: 'พยาบาลวิชาชีพชำนาญการ',
      department: 'กลุ่มงานการพยาบาล',
    }

    const res = resolveTaskPermissions(requester, baseTask)
    expect(res.isRequester).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(true)
    expect(res.canCancel).toBe(true)
    expect(res.canTakeJob).toBe(false)
  })

  it('grants IT staff access to IT repair tasks', () => {
    const itStaff: MemberLike = {
      id: 20,
      username: 'it_staff',
      role: 'member',
      position: 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ',
      department: 'กลุ่มงานดิจิทัลทางการแพทย์',
    }

    const res = resolveTaskPermissions(itStaff, baseTask)
    expect(res.isITStaff).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(true)
    expect(res.canTakeJob).toBe(true)
  })

  it('grants PR staff access to media request tasks', () => {
    const prTask: TaskLike = {
      id: 'task-media-1',
      task_no: 'PR-2570-10-0001',
      task_type: 'MEDIA_REQUEST',
      requester_id: 10,
      requester_dept: 'กลุ่มงานการพยาบาล',
      current_assignee: null,
      current_role: 'นักประชาสัมพันธ์',
      status: 'PENDING',
    }

    const prStaff: MemberLike = {
      id: 30,
      username: 'pr_officer',
      role: 'member',
      position: 'นักประชาสัมพันธ์',
      department: 'กลุ่มงานบริหารทั่วไป',
    }

    const res = resolveTaskPermissions(prStaff, prTask)
    expect(res.isPrStaff).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(true)
    expect(res.isCurrentAssignee).toBe(true)
    expect(res.canApprove).toBe(true)
  })

  it('allows assigned technician or co-worker to edit and take job', () => {
    const technician: MemberLike = {
      id: 40,
      username: 'tech_somchai',
      role: 'member',
      position: 'นายช่างเทคนิค',
    }

    const coWorker: MemberLike = {
      id: 41,
      username: 'tech_assistant',
      role: 'member',
      position: 'ผู้ช่วยช่าง',
    }

    const repairDetail = {
      assigned_technician_id: 40,
      co_workers: [{ id: 41, name: 'ผู้ช่วยช่าง' }],
      repair_status: 'IN_PROGRESS',
    }

    const resTech = resolveTaskPermissions(technician, baseTask, { repairDetail })
    expect(resTech.isTechnicianAssigned).toBe(true)
    expect(resTech.canEdit).toBe(true)
    expect(resTech.canTakeJob).toBe(true)

    const resCoWorker = resolveTaskPermissions(coWorker, baseTask, { repairDetail })
    expect(resCoWorker.isCoWorker).toBe(true)
    expect(resCoWorker.canEdit).toBe(true)
    expect(resCoWorker.canTakeJob).toBe(true)
  })

  it('blocks unauthorized member from viewing other department tasks', () => {
    const unrelatedMember: MemberLike = {
      id: 99,
      username: 'pharmacist_jane',
      role: 'member',
      position: 'เภสัชกรชำนาญการ',
      department: 'กลุ่มงานเภสัชกรรม',
      permissions: [],
    }

    const res = resolveTaskPermissions(unrelatedMember, baseTask)
    expect(res.canView).toBe(false)
    expect(res.canEdit).toBe(false)
    expect(res.canApprove).toBe(false)
    expect(res.canTakeJob).toBe(false)
  })

  it('allows department members to view if they have view_department_tasks permission', () => {
    const deptMember: MemberLike = {
      id: 55,
      username: 'nurse_somsee',
      role: 'member',
      position: 'พยาบาลวิชาชีพ',
      department: 'กลุ่มงานการพยาบาล',
      permissions: ['view_department_tasks'],
    }

    const res = resolveTaskPermissions(deptMember, baseTask)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(false)
  })
})
