import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmSeamlessImportService } from '@/lib/clinical/rcmSeamlessImportService'
import { NextRequest } from 'next/server'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmSeamlessImportService', () => ({
  RcmSeamlessImportService: {
    getSeamlessDatabaseStats: vi.fn(),
    parseWorkbook: vi.fn(),
  },
}))

describe('/api/service/dashboard-rcm/seamless-import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns 401 when session is not authenticated', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.success).toBe(false)
      expect(json.error).toContain('กรุณาเข้าสู่ระบบ')
    })

    it('returns 403 when user does not have permission', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'unauthorized_user',
        role: 'user',
        email: 'user@test.com',
      } as any)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(false)

      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(403)
      expect(json.success).toBe(false)
      expect(json.error).toContain('คุณไม่มีสิทธิ์')
    })

    it('returns 200 with database stats when authorized', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'admin_user',
        role: 'admin',
        email: 'admin@test.com',
      } as any)

      const mockStats = {
        totalRecords: 86087,
        totalFiles: 155,
        totalCompensation: 5000000,
        latestImportDate: '2025-01-15',
        fundBreakdown: [{ fundGroup: 'DAMD', count: 1200, totalPaid: 150000 }],
        recentFiles: [],
      }
      vi.mocked(RcmSeamlessImportService.getSeamlessDatabaseStats).mockResolvedValue(mockStats as any)

      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.totalRecords).toBe(86087)
    })
  })

  describe('POST', () => {
    it('returns 401 when session is not authenticated', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/seamless-import', {
        method: 'POST',
      })
      const response = await POST(req)
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.success).toBe(false)
    })

    it('returns 403 when user lacks import permission', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'viewer_user',
        role: 'viewer',
        email: 'viewer@test.com',
      } as any)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(false)

      const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/seamless-import', {
        method: 'POST',
      })
      const response = await POST(req)
      const json = await response.json()

      expect(response.status).toBe(403)
      expect(json.success).toBe(false)
    })

    it('returns 400 when no file is uploaded', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'admin_user',
        role: 'admin',
        email: 'admin@test.com',
      } as any)

      const formData = new FormData()
      const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/seamless-import', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(req)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error).toContain('ไม่พบไฟล์')
    })

    it('returns 400 when non-Excel file is uploaded', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'admin_user',
        role: 'admin',
        email: 'admin@test.com',
      } as any)

      const fakeFile = {
        name: 'test.txt',
        size: 100,
        arrayBuffer: async () => Buffer.from('test text'),
      }
      const mockFormData = {
        get: (key: string) => (key === 'file' ? fakeFile : null),
      }
      const req = { formData: async () => mockFormData } as any

      const response = await POST(req)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error).toContain('ไม่ใช่ไฟล์ Excel')
    })

    it('parses valid Excel file and returns import result', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'admin_user',
        role: 'admin',
        email: 'admin@test.com',
      } as any)

      const mockResult = {
        fileName: 'DAMD_202501.xlsx',
        totalRows: 10,
        validRows: 10,
        errorRows: 0,
        records: [],
        budgetCases: [],
        denyCodes: [],
        summary: {
          totalCompensation: 25000,
          uniquePatients: 10,
          uniqueFunds: ['DAMD'],
          matchedPatientsHOSxP: 10,
          matchedVnsHOSxP: 10,
        },
      }
      vi.mocked(RcmSeamlessImportService.parseWorkbook).mockResolvedValue(mockResult as any)

      const fakeFile = {
        name: 'DAMD_202501.xlsx',
        size: 1024,
        arrayBuffer: async () => Buffer.from('fake excel buffer'),
      }
      const mockFormData = {
        get: (key: string) => {
          if (key === 'file') return fakeFile
          if (key === 'dryRun') return 'true'
          return null
        },
      }
      const req = { formData: async () => mockFormData } as any

      const response = await POST(req)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.validRows).toBe(10)
      expect(json.message).toContain('ตรวจสอบโครงสร้างไฟล์สำเร็จ')
    })
  })
})
