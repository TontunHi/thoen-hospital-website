import { describe, it, expect, vi } from 'vitest'
import {
  executeRepairAction,
  updateTaskByManager,
  generateSignatureStampHash,
  generateTaskNo,
  TaskInboxService,
} from '../taskInboxService'

describe('taskInboxService', () => {
  describe('generateSignatureStampHash', () => {
    it('generates consistent sha256 hash for e-Signature stamp', () => {
      const hash1 = generateSignatureStampHash({
        taskId: 'task-123',
        stepNo: 1,
        signerId: 10,
        timestamp: '2026-09-30T12:00:00Z',
      })
      const hash2 = generateSignatureStampHash({
        taskId: 'task-123',
        stepNo: 1,
        signerId: 10,
        timestamp: '2026-09-30T12:00:00Z',
      })
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
    })
  })

  describe('executeRepairAction state machine', () => {
    it('rejects unauthorized member trying to act on task', async () => {
      const mockGw = {
        getTaskFullDetails: vi.fn().mockResolvedValue({
          success: true,
          data: {
            task: { id: 'task-1', current_assignee: 99, requester_id: 100, status: 'PENDING' },
            repairDetail: { task_id: 'task-1', co_workers: '[]', repair_status: 'PENDING' },
            steps: [],
            auditLogs: [],
          },
        }),
        executeRepairActionV2: vi.fn(),
      }

      const result = await executeRepairAction(
        {
          taskId: 'task-1',
          action: 'ACCEPT_JOB',
          performer: { id: 5, username: 'stranger', role: 'member' },
          dispatchNotifications: false,
        },
        mockGw
      )

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(403)
      expect(mockGw.executeRepairActionV2).not.toHaveBeenCalled()
    })

    it('allows assignee technician to ACCEPT_JOB and transitions states', async () => {
      const mockGw = {
        getTaskFullDetails: vi.fn().mockResolvedValue({
          success: true,
          data: {
            task: {
              id: 'task-1', task_no: 'IT-256909-0001', task_type: 'IT_REPAIR',
              title: 'ซ่อมคอมพิวเตอร์', current_assignee: 10, requester_id: 20, status: 'PENDING',
            },
            repairDetail: { task_id: 'task-1', co_workers: '[]', repair_status: 'PENDING', equipment_number: 'EQ-01' },
            steps: [],
            auditLogs: [],
          },
        }),
        executeRepairActionV2: vi.fn().mockResolvedValue({ message: 'รับงานซ่อมเรียบร้อยแล้ว' }),
      }

      const result = await executeRepairAction(
        {
          taskId: 'task-1',
          action: 'ACCEPT_JOB',
          performer: {
            id: 10, username: 'technician1', name: 'นายช่าง ทดสอบ',
            position: 'นายช่างเทคนิค', role: 'member',
          },
          dispatchNotifications: false,
        },
        mockGw
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('รับงานซ่อมเรียบร้อยแล้ว')
      expect(mockGw.executeRepairActionV2).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1', action: 'ACCEPT_JOB' })
      )
    })

    it('handles COMPLETE_REPAIR with cost and solution note', async () => {
      const mockGw = {
        getTaskFullDetails: vi.fn().mockResolvedValue({
          success: true,
          data: {
            task: {
              id: 'task-1', task_no: 'IT-256909-0001', task_type: 'IT_REPAIR',
              title: 'ซ่อมคอมพิวเตอร์', current_assignee: 10, requester_id: 20, status: 'IN_PROGRESS',
            },
            repairDetail: { task_id: 'task-1', co_workers: '[]', repair_status: 'IN_PROGRESS' },
            steps: [],
            auditLogs: [],
          },
        }),
        executeRepairActionV2: vi.fn().mockResolvedValue({ message: 'บันทึกการซ่อมเสร็จสิ้นสมบูรณ์' }),
      }

      const result = await executeRepairAction(
        {
          taskId: 'task-1',
          action: 'COMPLETE_REPAIR',
          performer: { id: 10, username: 'technician1', name: 'นายช่าง ทดสอบ', role: 'member' },
          payload: {
            foundProblem: 'พาวเวอร์ซัพพลายเสีย',
            solutionStep: 'เปลี่ยนพาวเวอร์ซัพพลายใหม่ 550W',
            costType: 'HAS_COST',
            costAmount: 1200,
          },
          dispatchNotifications: false,
        },
        mockGw
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('บันทึกการซ่อมเสร็จสิ้นสมบูรณ์')
      expect(mockGw.executeRepairActionV2).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1', action: 'COMPLETE_REPAIR' })
      )
    })

    it('allows requester to CANCEL_JOB before completion', async () => {
      const mockGw = {
        getTaskFullDetails: vi.fn().mockResolvedValue({
          success: true,
          data: {
            task: {
              id: 'task-1', task_no: 'IT-256909-0001', task_type: 'IT_REPAIR',
              title: 'ซ่อมคอมพิวเตอร์', current_assignee: 10, requester_id: 20, status: 'PENDING',
            },
            repairDetail: { task_id: 'task-1', co_workers: '[]', repair_status: 'PENDING' },
            steps: [],
            auditLogs: [],
          },
        }),
        executeRepairActionV2: vi.fn().mockResolvedValue({ message: 'ยกเลิกรายการแจ้งซ่อมเรียบร้อยแล้ว' }),
      }

      const result = await executeRepairAction(
        {
          taskId: 'task-1',
          action: 'CANCEL_JOB',
          performer: { id: 20, username: 'requester_user', name: 'ผู้ขอยกเลิก', role: 'member' },
          payload: { reason: 'เครื่องกลับมาเปิดติดใช้งานได้ปกติแล้ว' },
          dispatchNotifications: false,
        },
        mockGw
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('ยกเลิกรายการแจ้งซ่อมเรียบร้อยแล้ว')
      expect(mockGw.executeRepairActionV2).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1', action: 'CANCEL_JOB' })
      )
    })
  })

  describe('generateTaskNo (Thai Fiscal Year 1 Oct - 30 Sep)', () => {
    it('generates fiscal year 2570 for October 2026 (Month 10)', async () => {
      const mockGw = {
        generateTaskNo: vi.fn().mockImplementation(async (prefix: string) => ({
          success: true, count: 0, taskNo: `${prefix}0001`,
        })),
      }
      const octDate = new Date('2026-10-01T10:00:00Z')
      const taskNo = await generateTaskNo('IT_REPAIR', mockGw, octDate)
      expect(taskNo).toBe('IT-2570-10-0001')
      expect(mockGw.generateTaskNo).toHaveBeenCalledWith('IT-2570-10-')
    })

    it('generates fiscal year 2570 for December 2026 (Month 12)', async () => {
      const mockGw = {
        generateTaskNo: vi.fn().mockResolvedValue({ success: true, count: 4, taskNo: 'GN-2570-12-0005' }),
      }
      const decDate = new Date('2026-12-15T10:00:00Z')
      const taskNo = await generateTaskNo('GENERAL_REPAIR', mockGw, decDate)
      expect(taskNo).toBe('GN-2570-12-0005')
    })

    it('generates fiscal year 2570 for January 2027 (Month 01)', async () => {
      const mockGw = {
        generateTaskNo: vi.fn().mockResolvedValue({ success: true, count: 0, taskNo: 'MED-2570-01-0001' }),
      }
      const janDate = new Date('2027-01-10T10:00:00Z')
      const taskNo = await generateTaskNo('MEDICAL_REPAIR', mockGw, janDate)
      expect(taskNo).toBe('MED-2570-01-0001')
    })

    it('generates fiscal year 2570 for September 2027 (Month 09)', async () => {
      const mockGw = {
        generateTaskNo: vi.fn().mockResolvedValue({ success: true, count: 99, taskNo: 'PR-2570-09-0100' }),
      }
      const sepDate = new Date('2027-09-30T10:00:00Z')
      const taskNo = await generateTaskNo('MEDIA_REQUEST', mockGw, sepDate)
      expect(taskNo).toBe('PR-2570-09-0100')
    })

    it('rolls over to fiscal year 2571 on October 2027 (Month 10)', async () => {
      const mockGw = {
        generateTaskNo: vi.fn().mockResolvedValue({ success: true, count: 0, taskNo: 'IT-2571-10-0001' }),
      }
      const octNextYear = new Date('2027-10-01T10:00:00Z')
      const taskNo = await generateTaskNo('IT_REPAIR', mockGw, octNextYear)
      expect(taskNo).toBe('IT-2571-10-0001')
    })
  })

  describe('updateTaskByManager', () => {
    it('updates media request costType to HAS_COST and dynamically adds steps', async () => {
      const mockGw = {
        getInboxTaskBundleV2: vi.fn().mockResolvedValue({
          task: {
            id: 'task-pr-1',
            task_no: 'PR-2570-10-0001',
            task_type: 'MEDIA_REQUEST',
            title: 'ขอทำป้ายประชาสัมพันธ์',
            description: 'รายละเอียดป้าย',
            urgency: 'NORMAL',
            requester_id: 10,
            current_assignee: null,
            current_role: 'นักประชาสัมพันธ์',
            status: 'PENDING',
            custom_payload: JSON.stringify({ costType: 'NO_COST' }),
          },
          repairDetail: null,
          steps: [{ id: 's1', step_no: 1, status: 'PENDING' }],
        }),
        submitManagerTaskEditV2: vi.fn().mockResolvedValue({ updated: true }),
      }

      const adminPerformer = {
        id: 1,
        username: 'admin',
        role: 'admin',
      }

      const res = await updateTaskByManager(
        {
          taskId: 'task-pr-1',
          performer: adminPerformer,
          updates: {
            costType: 'HAS_COST',
            estimatedBudget: 5000,
          },
        },
        mockGw
      )

      expect(res.success).toBe(true)
      expect(res.diff?.costType).toEqual({ from: 'NO_COST', to: 'HAS_COST' })
      expect(res.diff?.estimatedBudget).toEqual({ from: undefined, to: 5000 })
      expect(mockGw.submitManagerTaskEditV2).toHaveBeenCalledWith(
        'task-pr-1',
        expect.objectContaining({
          stepSync: expect.objectContaining({ mode: 'HAS_COST' }),
          auditEntry: expect.objectContaining({ performedBy: 1 }),
        })
      )
    })

    it('removes Steps when media request is changed back to NO_COST', async () => {
      const mockGw = {
        getInboxTaskBundleV2: vi.fn().mockResolvedValue({
          task: {
            id: 'task-pr-2',
            task_no: 'PR-2570-10-0002',
            task_type: 'MEDIA_REQUEST',
            title: 'ขอทำป้ายประชาสัมพันธ์',
            description: 'รายละเอียดป้าย',
            urgency: 'NORMAL',
            requester_id: 10,
            current_assignee: null,
            current_role: 'นักประชาสัมพันธ์',
            status: 'PENDING',
            custom_payload: JSON.stringify({ costType: 'HAS_COST' }),
          },
          repairDetail: null,
          steps: [
            { id: 's1', step_no: 1, status: 'PENDING' },
            { id: 's2', step_no: 2, status: 'PENDING' },
            { id: 's3', step_no: 3, status: 'PENDING' },
            { id: 's4', step_no: 4, status: 'PENDING' },
            { id: 's5', step_no: 5, status: 'PENDING' },
            { id: 's6', step_no: 6, status: 'PENDING' },
            { id: 's7', step_no: 7, status: 'PENDING' },
          ],
        }),
        submitManagerTaskEditV2: vi.fn().mockResolvedValue({ updated: true }),
      }

      const prPerformer = {
        id: 30,
        username: 'pr_officer',
        position: 'นักประชาสัมพันธ์',
        role: 'member',
      }

      const res = await updateTaskByManager(
        {
          taskId: 'task-pr-2',
          performer: prPerformer,
          updates: {
            costType: 'NO_COST',
          },
        },
        mockGw
      )

      expect(res.success).toBe(true)
      expect(res.diff?.costType).toEqual({ from: 'HAS_COST', to: 'NO_COST' })
      expect(mockGw.submitManagerTaskEditV2).toHaveBeenCalledWith(
        'task-pr-2',
        expect.objectContaining({
          stepSync: expect.objectContaining({ mode: 'NO_COST' }),
        })
      )
    })

    it('rejects unauthorized user trying to edit task', async () => {
      const mockGw = {
        getInboxTaskBundleV2: vi.fn().mockResolvedValue({
          task: {
            id: 'task-pr-3',
            task_type: 'MEDIA_REQUEST',
            requester_id: 10,
            requester_dept: 'กลุ่มงานการพยาบาล',
            current_assignee: null,
            current_role: 'นักประชาสัมพันธ์',
            status: 'PENDING',
          },
          repairDetail: null,
          steps: [],
        }),
        submitManagerTaskEditV2: vi.fn(),
      }

      const stranger = {
        id: 999,
        username: 'unauthorized_user',
        position: 'พยาบาลวิชาชีพ',
        role: 'member',
      }

      const res = await updateTaskByManager(
        {
          taskId: 'task-pr-3',
          performer: stranger,
          updates: { title: 'แอบแก้' },
        },
        mockGw
      )

      expect(res.success).toBe(false)
      expect(res.statusCode).toBe(403)
      expect(mockGw.submitManagerTaskEditV2).not.toHaveBeenCalled()
    })

    it('updates full media request details including workTypes, channels, phone, driveLink, and attachments', async () => {
      const mockGw = {
        getInboxTaskBundleV2: vi.fn().mockResolvedValue({
          task: {
            id: 'task-pr-4',
            task_no: 'PR-2570-10-0004',
            task_type: 'MEDIA_REQUEST',
            title: 'ขอทำป้ายประชาสัมพันธ์เดิม',
            description: 'รายละเอียดเดิม',
            urgency: 'NORMAL',
            requester_id: 10,
            current_assignee: null,
            current_role: 'นักประชาสัมพันธ์',
            status: 'PENDING',
            custom_payload: JSON.stringify({
              costType: 'NO_COST',
              phone: '0811111111',
              workTypes: [{ key: 'poster', label: 'โปสเตอร์', customDetail: 'A4' }],
              channels: [{ key: 'facebook_page', label: 'Page Facebook' }],
              attachments: [{ fileName: 'old.pdf', filePath: '/uploads/old.pdf' }],
            }),
          },
          repairDetail: null,
          steps: [{ id: 's1', step_no: 1, status: 'PENDING' }],
        }),
        submitManagerTaskEditV2: vi.fn().mockResolvedValue({ updated: true }),
      }

      const adminPerformer = { id: 1, username: 'admin', role: 'admin' }

      const newWorkTypes = [
        { key: 'poster', label: 'โปสเตอร์', customDetail: 'A2' },
        { key: 'website_aw', label: 'AW ขึ้นเว็บไซต์', customDetail: null },
      ]
      const newChannels = [
        { key: 'indoor', label: 'ในอาคารโรงพยาบาล', customDetail: 'โถงชั้น 1' },
      ]
      const newAttachments = [
        { fileName: 'new.png', filePath: '/uploads/new.png', fileType: 'image/png', fileSize: 1024 },
      ]

      const res = await updateTaskByManager(
        {
          taskId: 'task-pr-4',
          performer: adminPerformer,
          updates: {
            title: 'ขอทำป้ายประชาสัมพันธ์และ AW เว็บไซต์',
            description: 'รายละเอียดที่แก้ไขใหม่',
            phone: '0899999999',
            driveLink: 'https://drive.google.com/test-folder',
            workTypes: newWorkTypes,
            channels: newChannels,
            attachments: newAttachments,
          },
        },
        mockGw
      )

      expect(res.success).toBe(true)
      expect(res.diff?.title).toEqual({ from: 'ขอทำป้ายประชาสัมพันธ์เดิม', to: 'ขอทำป้ายประชาสัมพันธ์และ AW เว็บไซต์' })
      expect(res.diff?.description).toEqual({ from: 'รายละเอียดเดิม', to: 'รายละเอียดที่แก้ไขใหม่' })
      expect(res.diff?.phone).toEqual({ from: '0811111111', to: '0899999999' })
      expect(res.diff?.driveLink).toEqual({ from: undefined, to: 'https://drive.google.com/test-folder' })
      expect(res.diff?.workTypes).toBeDefined()
      expect(res.diff?.channels).toBeDefined()
      expect(res.diff?.attachments).toBeDefined()

      expect(mockGw.submitManagerTaskEditV2).toHaveBeenCalledWith(
        'task-pr-4',
        expect.objectContaining({
          taskUpdates: expect.objectContaining({
            title: 'ขอทำป้ายประชาสัมพันธ์และ AW เว็บไซต์',
            description: 'รายละเอียดที่แก้ไขใหม่',
          }),
        })
      )
    })

    it('updates quotations array when manager edits media request', async () => {
      const mockGw = {
        getInboxTaskBundleV2: vi.fn().mockResolvedValue({
          task: {
            id: 'task-pr-5',
            task_no: 'PR-2570-10-0005',
            task_type: 'MEDIA_REQUEST',
            title: 'ขอทำป้ายไวนิล',
            description: 'รายละเอียดป้ายไวนิล',
            urgency: 'URGENT',
            requester_id: 10,
            current_assignee: null,
            current_role: 'นักประชาสัมพันธ์',
            status: 'PENDING',
            custom_payload: JSON.stringify({
              costType: 'HAS_COST',
              quotations: [{ fileName: 'quote_v1.pdf', filePath: '/uploads/quote_v1.pdf' }],
            }),
          },
          repairDetail: null,
          steps: [{ id: 's1', step_no: 1, status: 'PENDING' }],
        }),
        submitManagerTaskEditV2: vi.fn().mockResolvedValue({ updated: true }),
      }

      const prPerformer = {
        id: 30,
        username: 'pr_officer',
        position: 'นักประชาสัมพันธ์',
        role: 'member',
      }

      const updatedQuotations = [
        { fileName: 'quote_v1.pdf', filePath: '/uploads/quote_v1.pdf' },
        { fileName: 'quote_v2.pdf', filePath: '/uploads/quote_v2.pdf', fileType: 'application/pdf', fileSize: 2048 },
      ]

      const res = await updateTaskByManager(
        {
          taskId: 'task-pr-5',
          performer: prPerformer,
          updates: {
            quotations: updatedQuotations,
          },
        },
        mockGw
      )

      expect(res.success).toBe(true)
      expect(res.diff?.quotations).toBeDefined()
      expect(res.diff?.quotations.to).toEqual(updatedQuotations)
      expect(mockGw.submitManagerTaskEditV2).toHaveBeenCalledWith(
        'task-pr-5',
        expect.objectContaining({
          taskUpdates: expect.objectContaining({
            custom_payload: expect.any(String),
          }),
        })
      )
    })
  })

  describe('TaskInboxService.getMemberWorkSummary', () => {
    it('queries pending tasks for individual assignee and role queue', async () => {
      const mockGw = {
        getMemberWorkSummary: vi.fn().mockResolvedValue({ pendingInboxCount: 7, pendingRegistrationsCount: 0 }),
      }

      const summary = await TaskInboxService.getMemberWorkSummary(
        { memberId: 15, role: 'member', position: 'ช่างซ่อมบำรุง' },
        mockGw
      )

      expect(summary.pendingInboxCount).toBe(7)
      expect(summary.pendingRegistrationsCount).toBe(0)
      expect(mockGw.getMemberWorkSummary).toHaveBeenCalledWith({
        memberId: 15,
        role: 'member',
        position: 'ช่างซ่อมบำรุง',
      })
    })

    it('queries pending registrations count for admin role', async () => {
      const mockGw = {
        getMemberWorkSummary: vi.fn().mockResolvedValue({ pendingInboxCount: 3, pendingRegistrationsCount: 5 }),
      }

      const summary = await TaskInboxService.getMemberWorkSummary(
        { memberId: 1, role: 'admin', position: 'ผู้ดูแลระบบ' },
        mockGw
      )

      expect(summary.pendingInboxCount).toBe(3)
      expect(summary.pendingRegistrationsCount).toBe(5)
    })

    it('supports passing only memberId number', async () => {
      const mockGw = {
        getMemberWorkSummary: vi.fn().mockResolvedValue({ pendingInboxCount: 2, pendingRegistrationsCount: 0 }),
      }

      const summary = await TaskInboxService.getMemberWorkSummary(20, mockGw)

      expect(summary.pendingInboxCount).toBe(2)
      expect(summary.pendingRegistrationsCount).toBe(0)
      expect(mockGw.getMemberWorkSummary).toHaveBeenCalledWith({
        memberId: 20,
        role: undefined,
        position: undefined,
      })
    })

    it('handles gateway failures gracefully without throwing', async () => {
      const mockGw = {
        getMemberWorkSummary: vi.fn().mockRejectedValue(new Error('Gateway unavailable')),
      }

      const summary = await TaskInboxService.getMemberWorkSummary(
        { memberId: 99, role: 'member' },
        mockGw
      )

      expect(summary.pendingInboxCount).toBe(0)
      expect(summary.pendingRegistrationsCount).toBe(0)
    })
  })
})


