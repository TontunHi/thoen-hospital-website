import { describe, it, expect, vi } from 'vitest'
import {
  executeRepairAction,
  updateTaskByManager,
  MemberDbExecutor,
  generateSignatureStampHash,
  generateTaskNo,
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
      const mockExecutor: MemberDbExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM inbox_tasks')) {
          return Promise.resolve([
            { id: 'task-1', current_assignee: 99, requester_id: 100, status: 'PENDING' },
          ])
        }
        if (sql.includes('SELECT * FROM repair_details')) {
          return Promise.resolve([
            { task_id: 'task-1', co_workers: '[]', repair_status: 'PENDING' },
          ])
        }
        return Promise.resolve([])
      })

      const result = await executeRepairAction(
        {
          taskId: 'task-1',
          action: 'ACCEPT_JOB',
          performer: { id: 5, username: 'stranger', role: 'member' },
          dispatchNotifications: false,
        },
        mockExecutor
      )

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(403)
    })

    it('allows assignee technician to ACCEPT_JOB and transitions states', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM inbox_tasks')) {
          return Promise.resolve([
            {
              id: 'task-1',
              task_no: 'IT-256909-0001',
              task_type: 'IT_REPAIR',
              title: 'ซ่อมคอมพิวเตอร์',
              current_assignee: 10,
              requester_id: 20,
              status: 'PENDING',
            },
          ])
        }
        if (sql.includes('SELECT * FROM repair_details')) {
          return Promise.resolve([
            {
              task_id: 'task-1',
              co_workers: '[]',
              repair_status: 'PENDING',
              equipment_number: 'EQ-01',
            },
          ])
        }
        return Promise.resolve({ affectedRows: 1 })
      })

      const result = await executeRepairAction(
        {
          taskId: 'task-1',
          action: 'ACCEPT_JOB',
          performer: {
            id: 10,
            username: 'technician1',
            name: 'นายช่าง ทดสอบ',
            position: 'นายช่างเทคนิค',
            role: 'member',
          },
          dispatchNotifications: false,
        },
        mockExecutor
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('รับงานซ่อมเรียบร้อยแล้ว')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE inbox_tasks SET status = 'IN_PROGRESS'"),
        ['task-1']
      )
    })

    it('handles COMPLETE_REPAIR with cost and solution note', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM inbox_tasks')) {
          return Promise.resolve([
            {
              id: 'task-1',
              task_no: 'IT-256909-0001',
              task_type: 'IT_REPAIR',
              title: 'ซ่อมคอมพิวเตอร์',
              current_assignee: 10,
              requester_id: 20,
              status: 'IN_PROGRESS',
            },
          ])
        }
        if (sql.includes('SELECT * FROM repair_details')) {
          return Promise.resolve([
            {
              task_id: 'task-1',
              co_workers: '[]',
              repair_status: 'IN_PROGRESS',
            },
          ])
        }
        return Promise.resolve({ affectedRows: 1 })
      })

      const result = await executeRepairAction(
        {
          taskId: 'task-1',
          action: 'COMPLETE_REPAIR',
          performer: {
            id: 10,
            username: 'technician1',
            name: 'นายช่าง ทดสอบ',
            role: 'member',
          },
          payload: {
            foundProblem: 'พาวเวอร์ซัพพลายเสีย',
            solutionStep: 'เปลี่ยนพาวเวอร์ซัพพลายใหม่ 550W',
            costType: 'HAS_COST',
            costAmount: 1200,
          },
          dispatchNotifications: false,
        },
        mockExecutor
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('บันทึกการซ่อมเสร็จสิ้นสมบูรณ์')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE inbox_tasks SET status = 'APPROVED'"),
        ['task-1']
      )
    })

    it('allows requester to CANCEL_JOB before completion', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM inbox_tasks')) {
          return Promise.resolve([
            {
              id: 'task-1',
              task_no: 'IT-256909-0001',
              task_type: 'IT_REPAIR',
              title: 'ซ่อมคอมพิวเตอร์',
              current_assignee: 10,
              requester_id: 20,
              status: 'PENDING',
            },
          ])
        }
        if (sql.includes('SELECT * FROM repair_details')) {
          return Promise.resolve([
            {
              task_id: 'task-1',
              co_workers: '[]',
              repair_status: 'PENDING',
            },
          ])
        }
        return Promise.resolve({ affectedRows: 1 })
      })

      const result = await executeRepairAction(
        {
          taskId: 'task-1',
          action: 'CANCEL_JOB',
          performer: {
            id: 20,
            username: 'requester_user',
            name: 'ผู้ขอยกเลิก',
            role: 'member',
          },
          payload: {
            reason: 'เครื่องกลับมาเปิดติดใช้งานได้ปกติแล้ว',
          },
          dispatchNotifications: false,
        },
        mockExecutor
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('ยกเลิกรายการแจ้งซ่อมเรียบร้อยแล้ว')
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE inbox_tasks SET status = 'REJECTED'"),
        ['task-1']
      )
    })
  })

  describe('generateTaskNo (Thai Fiscal Year 1 Oct - 30 Sep)', () => {
    it('generates fiscal year 2570 for October 2026 (Month 10)', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockResolvedValue([{ cnt: 0 }])
      const octDate = new Date('2026-10-01T10:00:00Z')
      const taskNo = await generateTaskNo('IT_REPAIR', mockExecutor, octDate)
      expect(taskNo).toBe('IT-2570-10-0001')
      expect(mockExecutor).toHaveBeenCalledWith(
        'SELECT COUNT(*) as cnt FROM inbox_tasks WHERE task_no LIKE ?',
        ['IT-2570-10-%']
      )
    })

    it('generates fiscal year 2570 for December 2026 (Month 12)', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockResolvedValue([{ cnt: 4 }])
      const decDate = new Date('2026-12-15T10:00:00Z')
      const taskNo = await generateTaskNo('GENERAL_REPAIR', mockExecutor, decDate)
      expect(taskNo).toBe('GN-2570-12-0005')
    })

    it('generates fiscal year 2570 for January 2027 (Month 01)', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockResolvedValue([{ cnt: 0 }])
      const janDate = new Date('2027-01-10T10:00:00Z')
      const taskNo = await generateTaskNo('MEDICAL_REPAIR', mockExecutor, janDate)
      expect(taskNo).toBe('MED-2570-01-0001')
    })

    it('generates fiscal year 2570 for September 2027 (Month 09)', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockResolvedValue([{ cnt: 99 }])
      const sepDate = new Date('2027-09-30T10:00:00Z')
      const taskNo = await generateTaskNo('MEDIA_REQUEST', mockExecutor, sepDate)
      expect(taskNo).toBe('PR-2570-09-0100')
    })

    it('rolls over to fiscal year 2571 on October 2027 (Month 10)', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockResolvedValue([{ cnt: 0 }])
      const octNextYear = new Date('2027-10-01T10:00:00Z')
      const taskNo = await generateTaskNo('IT_REPAIR', mockExecutor, octNextYear)
      expect(taskNo).toBe('IT-2571-10-0001')
    })
  })

  describe('updateTaskByManager', () => {
    it('updates media request costType to HAS_COST and dynamically adds Step 4', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM inbox_tasks')) {
          return Promise.resolve([
            {
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
          ])
        }
        if (sql.includes('SELECT * FROM repair_details')) {
          return Promise.resolve([])
        }
        if (sql.includes('SELECT * FROM inbox_task_steps')) {
          return Promise.resolve([
            { id: 's1', step_no: 1, status: 'PENDING' },
            { id: 's2', step_no: 2, status: 'PENDING' },
            { id: 's3', step_no: 3, status: 'PENDING' },
          ])
        }
        if (sql.includes('SELECT id FROM inbox_task_steps WHERE task_id = ? AND step_no = 4')) {
          return Promise.resolve([])
        }
        return Promise.resolve({ affectedRows: 1 })
      })

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
        mockExecutor
      )

      expect(res.success).toBe(true)
      expect(res.diff?.costType).toEqual({ from: 'NO_COST', to: 'HAS_COST' })
      expect(res.diff?.estimatedBudget).toEqual({ from: undefined, to: 5000 })
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inbox_task_steps'),
        expect.arrayContaining(['task-pr-1'])
      )
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inbox_task_audit_logs'),
        expect.any(Array)
      )
    })

    it('removes Step 4 when media request is changed back to NO_COST', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM inbox_tasks')) {
          return Promise.resolve([
            {
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
          ])
        }
        if (sql.includes('SELECT * FROM repair_details')) {
          return Promise.resolve([])
        }
        if (sql.includes('SELECT * FROM inbox_task_steps')) {
          return Promise.resolve([
            { id: 's1', step_no: 1, status: 'PENDING' },
            { id: 's2', step_no: 2, status: 'PENDING' },
            { id: 's3', step_no: 3, status: 'PENDING' },
            { id: 's4', step_no: 4, status: 'PENDING' },
          ])
        }
        return Promise.resolve({ affectedRows: 1 })
      })

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
        mockExecutor
      )

      expect(res.success).toBe(true)
      expect(res.diff?.costType).toEqual({ from: 'HAS_COST', to: 'NO_COST' })
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM inbox_task_steps WHERE task_id = ? AND step_no = 4 AND status = 'PENDING'"),
        ['task-pr-2']
      )
    })

    it('rejects unauthorized user trying to edit task', async () => {
      const mockExecutor: MemberDbExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM inbox_tasks')) {
          return Promise.resolve([
            {
              id: 'task-pr-3',
              task_type: 'MEDIA_REQUEST',
              requester_id: 10,
              requester_dept: 'กลุ่มงานการพยาบาล',
              current_assignee: null,
              current_role: 'นักประชาสัมพันธ์',
              status: 'PENDING',
            },
          ])
        }
        return Promise.resolve([])
      })

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
        mockExecutor
      )

      expect(res.success).toBe(false)
      expect(res.statusCode).toBe(403)
    })
  })
})

