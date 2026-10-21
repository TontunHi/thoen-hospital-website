import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as handleCreateRepair } from '../route'
import { POST as handleUploadPhoto } from '../upload/route'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { generateTaskNo } from '@/lib/taskInboxService'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/memberDb', () => ({
  queryMemberDb: vi.fn(),
}))

vi.mock('@/lib/taskInboxService', () => ({
  generateTaskNo: vi.fn(),
  notifyAssigneeOnTelegram: vi.fn().mockResolvedValue(undefined),
  notifyRepairCreatedRequesterOnTelegram: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    formatDateDirectory: vi.fn().mockReturnValue('public/uploads/repairs/2026-10'),
    saveBatch: vi.fn().mockResolvedValue([
      { publicUrl: '/uploads/repairs/2026-10/repair-123.jpg' }
    ]),
  },
  StorageValidationError: class extends Error {},
}))

describe('Repair Submission APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/member/repairs', () => {
    it('returns 401 if member is not authenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)

      const req = new Request('http://localhost:3000/api/member/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repairType: 'IT_REPAIR' }),
      })

      const res = await handleCreateRepair(req)
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toContain('กรุณาเข้าสู่ระบบก่อนใช้งาน')
    })

    it('returns 404 if member record is not found in database', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'unknown_user',
        email: 'test@thoenhospital.go.th',
        role: 'member',
      } as any)
      vi.mocked(queryMemberDb).mockResolvedValueOnce([]) // member lookup returns empty

      const req = new Request('http://localhost:3000/api/member/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repairType: 'IT_REPAIR' }),
      })

      const res = await handleCreateRepair(req)
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.error).toContain('ไม่พบข้อมูลสมาชิก')
    })

    it('returns 400 if validation fails (missing repair type)', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'nurse01',
        email: 'nurse@thoenhospital.go.th',
        role: 'member',
      } as any)
      vi.mocked(queryMemberDb).mockResolvedValueOnce([
        { id: 2, username: 'nurse01', name: 'พว. วันเพ็ญ', department: 'ICU', position: 'พยาบาล' }
      ])

      const req = new Request('http://localhost:3000/api/member/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repairType: 'INVALID_TYPE' }),
      })

      const res = await handleCreateRepair(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('กรุณาเลือกประเภทงานซ่อมที่ถูกต้อง')
    })

    it('returns 400 if equipment repair has neither equipment number nor name', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'nurse01',
        email: 'nurse@thoenhospital.go.th',
        role: 'member',
      } as any)
      vi.mocked(queryMemberDb).mockResolvedValueOnce([
        { id: 2, username: 'nurse01', name: 'พว. วันเพ็ญ', department: 'ICU', position: 'พยาบาล' }
      ])

      const req = new Request('http://localhost:3000/api/member/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repairType: 'IT_REPAIR',
          itemCategory: 'EQUIPMENT',
          equipmentNumber: '',
          equipmentName: '',
          locationFullName: 'อาคารผู้ป่วยนอก ชั้น 1',
          symptomDetail: 'เปิดไม่ติด',
        }),
      })

      const res = await handleCreateRepair(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('กรุณาระบุเลขทะเบียนครุภัณฑ์ หรือชื่อครุภัณฑ์')
    })

    it('successfully creates an IT repair ticket and inserts inbox task, steps, details, and audit log', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'nurse01',
        email: 'nurse@thoenhospital.go.th',
        role: 'member',
      } as any)

      // 1. Member query
      vi.mocked(queryMemberDb).mockResolvedValueOnce([
        { id: 2, username: 'nurse01', name: 'พว. วันเพ็ญ', department: 'ICU', position: 'พยาบาล' }
      ])
      // 2. generateTaskNo
      vi.mocked(generateTaskNo).mockResolvedValueOnce('IT-2570-10-0005')
      // 3. Insert inbox_tasks
      vi.mocked(queryMemberDb).mockResolvedValueOnce({ affectedRows: 1 } as any)
      // 4. Insert inbox_task_steps
      vi.mocked(queryMemberDb).mockResolvedValueOnce({ affectedRows: 1 } as any)
      // 5. Insert repair_details
      vi.mocked(queryMemberDb).mockResolvedValueOnce({ affectedRows: 1 } as any)
      // 6. Insert inbox_task_audit_logs
      vi.mocked(queryMemberDb).mockResolvedValueOnce({ affectedRows: 1 } as any)

      const payload = {
        repairType: 'IT_REPAIR',
        itemCategory: 'EQUIPMENT',
        equipmentNumber: '7440-001-0001',
        equipmentName: 'คอมพิวเตอร์ All-in-One Dell',
        nonEquipmentItem: '',
        locationId: 10,
        locationFullName: 'อาคารผู้ป่วยนอก (OPD) ชั้น 1 ห้องตรวจ 1',
        symptomDetail: 'เครื่องเปิดติดแต่จอดำ เข้าใช้งาน HOSxP ไม่ได้',
        assignedTechnicianId: null,
        urgency: 'HIGH',
        photos: ['/uploads/repairs/2026-10/repair-1.jpg'],
      }

      const req = new Request('http://localhost:3000/api/member/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const res = await handleCreateRepair(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.message).toBe('ยื่นใบแจ้งซ่อมสำเร็จเรียบร้อยแล้ว')
      expect(json.data.taskNo).toBe('IT-2570-10-0005')
      expect(json.data.taskId).toBeDefined()

      // Verify DB queries called
      expect(queryMemberDb).toHaveBeenCalledTimes(5)
    })
  })

  describe('POST /api/member/repairs/upload', () => {
    it('returns 401 if unauthenticated', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue(null)

      const formData = new FormData()
      formData.append('files', new File(['dummy'], 'test.png', { type: 'image/png' }))

      const req = new Request('http://localhost:3000/api/member/repairs/upload', {
        method: 'POST',
        body: formData,
      })

      const res = await handleUploadPhoto(req)
      expect(res.status).toBe(401)
    })

    it('returns 400 if no files uploaded', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'nurse01',
        email: 'nurse@thoenhospital.go.th',
        role: 'member',
      } as any)

      const formData = new FormData()

      const req = new Request('http://localhost:3000/api/member/repairs/upload', {
        method: 'POST',
        body: formData,
      })

      const res = await handleUploadPhoto(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('กรุณาเลือกรูปภาพอย่างน้อย 1 ไฟล์')
    })

    it('uploads files successfully via DocumentStorage', async () => {
      vi.mocked(verifyMemberSession).mockResolvedValue({
        username: 'nurse01',
        email: 'nurse@thoenhospital.go.th',
        role: 'member',
      } as any)

      const dummyFile = new File(['dummy image content'], 'photo1.jpg', { type: 'image/jpeg' })
      const req = {
        formData: vi.fn().mockResolvedValue({
          getAll: vi.fn().mockReturnValue([dummyFile]),
        }),
      } as unknown as Request

      const res = await handleUploadPhoto(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.urls).toEqual(['/uploads/repairs/2026-10/repair-123.jpg'])
    })
  })
})
