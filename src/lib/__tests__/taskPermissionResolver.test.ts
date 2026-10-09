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
    current_role: null,
    status: 'PENDING',
  }

  const mediaTask: TaskLike = {
    id: 'task-media-1',
    task_no: 'PR-2570-10-0001',
    task_type: 'MEDIA_REQUEST',
    requester_id: 10,
    requester_dept: 'กลุ่มงานการพยาบาล',
    current_assignee: null,
    current_role: null,
    status: 'PENDING',
  }

  it('returns all false when member or task is null or undefined', () => {
    const res1 = resolveTaskPermissions(null, baseTask)
    expect(res1.canView).toBe(false)
    expect(res1.canEdit).toBe(false)
    expect(res1.canApprove).toBe(false)
    expect(res1.canTakeJob).toBe(false)

    const res2 = resolveTaskPermissions({ id: 1 }, null)
    expect(res2.canView).toBe(false)
    expect(res2.canEdit).toBe(false)
    expect(res2.canApprove).toBe(false)
    expect(res2.canTakeJob).toBe(false)
  })

  it('grants full view, edit, approve, and takeJob to admin role', () => {
    const adminMember: MemberLike = {
      id: 1,
      username: 'admin',
      role: 'admin',
      position: 'ผู้อำนวยการโรงพยาบาลเถิน',
    }

    const res = resolveTaskPermissions(adminMember, baseTask)
    expect(res.isAdmin).toBe(true)
    expect(res.isITStaff).toBe(true)
    expect(res.isTechStaff).toBe(true)
    expect(res.isPrStaff).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(true)
    expect(res.canApprove).toBe(true)
    expect(res.canCancel).toBe(true)
    expect(res.canTakeJob).toBe(true)
    expect(res.canHold).toBe(true)
  })

  it('grants view and edit to requester while task is pending', () => {
    const requester: MemberLike = {
      id: 10,
      username: 'nurse_somying',
      role: 'member',
      position: 'พยาบาลวิชาชีพชำนาญการ',
      department: 'กลุ่มงานการพยาบาล',
      permissions: [],
    }

    const res = resolveTaskPermissions(requester, baseTask)
    expect(res.isRequester).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(true)
    expect(res.canCancel).toBe(true)
    expect(res.canTakeJob).toBe(false)
    expect(res.canApprove).toBe(false)
  })

  it('disallows requester from editing or cancelling when task is COMPLETED', () => {
    const requester: MemberLike = {
      id: 10,
      username: 'nurse_somying',
      role: 'member',
      permissions: [],
    }
    const completedTask: TaskLike = {
      ...baseTask,
      status: 'COMPLETED',
    }

    const res = resolveTaskPermissions(requester, completedTask)
    expect(res.isRequester).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(false)
    expect(res.canCancel).toBe(false)
    expect(res.canApprove).toBe(false)
  })

  it('CRITICAL: grants canApprove: true and canEdit: false for approve_repairs permission', () => {
    const approver: MemberLike = {
      id: 25,
      username: 'director_somchai',
      role: 'member',
      position: 'ผู้อำนวยการโรงพยาบาลเถิน',
      permissions: ['approve_repairs'],
    }

    const res = resolveTaskPermissions(approver, baseTask)
    expect(res.canApprove).toBe(true)
    expect(res.canEdit).toBe(false)
    expect(res.canView).toBe(true)
    expect(res.canTakeJob).toBe(false)
  })

  it('CRITICAL: keeps canEdit: false even if approve_repairs user is current assignee on task', () => {
    const approver: MemberLike = {
      id: 25,
      username: 'director_somchai',
      role: 'member',
      permissions: ['approve_repairs'],
    }
    const assignedTask: TaskLike = {
      ...baseTask,
      current_assignee: 25,
    }

    const res = resolveTaskPermissions(approver, assignedTask)
    expect(res.isCurrentAssignee).toBe(true)
    expect(res.canApprove).toBe(true)
    expect(res.canEdit).toBe(false)
  })

  it('CRITICAL: grants canApprove: true and canEdit: false for approve_media on media requests', () => {
    const mediaApprover: MemberLike = {
      id: 26,
      username: 'head_pr_approver',
      role: 'member',
      permissions: ['approve_media'],
    }

    const res = resolveTaskPermissions(mediaApprover, mediaTask)
    expect(res.canApprove).toBe(true)
    expect(res.canEdit).toBe(false)
    expect(res.canView).toBe(true)
    expect(res.canTakeJob).toBe(false)
  })

  it('grants take_repairs_it: canTakeJob: true, canEdit: true, isITStaff: true', () => {
    const itStaff: MemberLike = {
      id: 20,
      username: 'it_staff',
      role: 'member',
      permissions: ['take_repairs_it'],
    }

    const res = resolveTaskPermissions(itStaff, baseTask)
    expect(res.isITStaff).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(true)
    expect(res.canTakeJob).toBe(true)
    expect(res.canApprove).toBe(false)
  })

  it('grants manage_repairs: canEdit: true, canTakeJob: true, canHold: true, isITStaff: true, isTechStaff: true', () => {
    const manager: MemberLike = {
      id: 22,
      username: 'repair_manager',
      role: 'member',
      permissions: ['manage_repairs'],
    }

    const res = resolveTaskPermissions(manager, baseTask)
    expect(res.canEdit).toBe(true)
    expect(res.canTakeJob).toBe(true)
    expect(res.canHold).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.isITStaff).toBe(true)
    expect(res.isTechStaff).toBe(true)
    expect(res.canApprove).toBe(false)

    // Check ON_HOLD status for canResume
    const holdTask: TaskLike = { ...baseTask, status: 'ON_HOLD' }
    const resHold = resolveTaskPermissions(manager, holdTask)
    expect(resHold.canHold).toBe(false)
    expect(resHold.canResume).toBe(true)
  })

  it('grants produce_media: canTakeJob: true, canEdit: true, isPrStaff: true on media tasks', () => {
    const prProducer: MemberLike = {
      id: 30,
      username: 'pr_officer',
      role: 'member',
      permissions: ['produce_media'],
    }

    const res = resolveTaskPermissions(prProducer, mediaTask)
    expect(res.isPrStaff).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(true)
    expect(res.canTakeJob).toBe(true)
    expect(res.canApprove).toBe(false)
  })

  it('grants manage_media_requests: canEdit: true, canTakeJob: true, canHold: true, isPrStaff: true', () => {
    const prHead: MemberLike = {
      id: 31,
      username: 'pr_head',
      role: 'member',
      permissions: ['manage_media_requests'],
    }

    const res = resolveTaskPermissions(prHead, mediaTask)
    expect(res.isPrStaff).toBe(true)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(true)
    expect(res.canTakeJob).toBe(true)
    expect(res.canHold).toBe(true)
    expect(res.canApprove).toBe(false)
  })

  it('allows assigned technician or co-worker to edit and take job', () => {
    const technician: MemberLike = {
      id: 40,
      username: 'tech_somchai',
      role: 'member',
      permissions: [],
    }

    const coWorker: MemberLike = {
      id: 41,
      username: 'tech_assistant',
      role: 'member',
      permissions: [],
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
      department: 'กลุ่มงานการพยาบาล',
      permissions: ['view_department_tasks'],
    }

    const res = resolveTaskPermissions(deptMember, baseTask)
    expect(res.canView).toBe(true)
    expect(res.canEdit).toBe(false)
  })

  it('handles general and medical repair task types with specific permissions', () => {
    const genTask: TaskLike = { ...baseTask, task_type: 'GENERAL_REPAIR' }
    const medTask: TaskLike = { ...baseTask, task_type: 'MEDICAL_REPAIR' }

    const genTech: MemberLike = {
      id: 60,
      username: 'gen_tech',
      role: 'member',
      permissions: ['take_repairs_general'],
    }

    const medTech: MemberLike = {
      id: 61,
      username: 'med_tech',
      role: 'member',
      permissions: ['take_repairs_medical'],
    }

    const resGen = resolveTaskPermissions(genTech, genTask)
    expect(resGen.isTechStaff).toBe(true)
    expect(resGen.canTakeJob).toBe(true)
    expect(resGen.canEdit).toBe(true)
    expect(resGen.canView).toBe(true)

    const resMed = resolveTaskPermissions(medTech, medTask)
    expect(resMed.isTechStaff).toBe(true)
    expect(resMed.canTakeJob).toBe(true)
    expect(resMed.canEdit).toBe(true)
    expect(resMed.canView).toBe(true)

    // Cross-type check: genTech cannot take medical repairs
    const resGenOnMed = resolveTaskPermissions(genTech, medTask)
    expect(resGenOnMed.canTakeJob).toBe(false)
    expect(resGenOnMed.canEdit).toBe(false)
  })

  it('CRITICAL: enforces read-only semantics for view_all_work across all task types', () => {
    const observer: MemberLike = {
      id: 70,
      username: 'hospital_observer',
      role: 'member',
      position: 'นักวิชาการสาธารณสุข',
      department: 'กลุ่มงานยุทธศาสตร์',
      permissions: ['view_all_work'],
    }

    const itTask: TaskLike = { ...baseTask, task_type: 'IT_REPAIR' }
    const genTask: TaskLike = { ...baseTask, task_type: 'GENERAL_REPAIR' }
    const medTask: TaskLike = { ...baseTask, task_type: 'MEDICAL_REPAIR' }

    for (const t of [itTask, genTask, medTask, mediaTask]) {
      const res = resolveTaskPermissions(observer, t)
      expect(res.canView).toBe(true)
      expect(res.canEdit).toBe(false)
      expect(res.canApprove).toBe(false)
      expect(res.canTakeJob).toBe(false)
      expect(res.canCancel).toBe(false)
      expect(res.canHold).toBe(false)
      expect(res.canResume).toBe(false)
    }
  })

  it('CRITICAL: enforces read-only semantics for type-specific view permissions', () => {
    const itViewer: MemberLike = { id: 80, role: 'member', permissions: ['view_it_repairs'] }
    const genViewer: MemberLike = { id: 81, role: 'member', permissions: ['view_general_repairs'] }
    const medViewer: MemberLike = { id: 82, role: 'member', permissions: ['view_medical_repairs'] }
    const mediaViewer: MemberLike = { id: 83, role: 'member', permissions: ['view_media_requests'] }

    const itTask: TaskLike = { ...baseTask, task_type: 'IT_REPAIR' }
    const genTask: TaskLike = { ...baseTask, task_type: 'GENERAL_REPAIR' }
    const medTask: TaskLike = { ...baseTask, task_type: 'MEDICAL_REPAIR' }

    // IT viewer
    const resIt = resolveTaskPermissions(itViewer, itTask)
    expect(resIt.canView).toBe(true)
    expect(resIt.canEdit).toBe(false)
    expect(resIt.canApprove).toBe(false)
    expect(resIt.canTakeJob).toBe(false)

    // General viewer
    const resGen = resolveTaskPermissions(genViewer, genTask)
    expect(resGen.canView).toBe(true)
    expect(resGen.canEdit).toBe(false)
    expect(resGen.canApprove).toBe(false)
    expect(resGen.canTakeJob).toBe(false)

    // Medical viewer
    const resMed = resolveTaskPermissions(medViewer, medTask)
    expect(resMed.canView).toBe(true)
    expect(resMed.canEdit).toBe(false)
    expect(resMed.canApprove).toBe(false)
    expect(resMed.canTakeJob).toBe(false)

    // Media viewer
    const resMedia = resolveTaskPermissions(mediaViewer, mediaTask)
    expect(resMedia.canView).toBe(true)
    expect(resMedia.canEdit).toBe(false)
    expect(resMedia.canApprove).toBe(false)
    expect(resMedia.canTakeJob).toBe(false)
  })
})
