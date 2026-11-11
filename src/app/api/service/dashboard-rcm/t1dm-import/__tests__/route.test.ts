import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, DELETE } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmT1dmImportService } from '@/lib/clinical/rcmT1dmImportService'
import { NextRequest } from 'next/server'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/rcmT1dmImportService', () => ({
  RcmT1dmImportService: {
    getRegistryList: vi.fn(),
    parseAndImportWorkbook: vi.fn(),
    deleteRegistries: vi.fn(),
  },
}))

describe('/api/service/dashboard-rcm/t1dm-import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns 401 when session is not authenticated', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/t1dm-import')
      const response = await GET(req)
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.success).toBe(false)
      expect(json.error).toContain('กรุณาเข้าสู่ระบบ')
    })

    it('returns 403 when user lacks permission', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 2,
        username: 'random_user',
        role: 'member',
        email: 'user@test.com',
      } as any)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(false)

      const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/t1dm-import')
      const response = await GET(req)
      const json = await response.json()

      expect(response.status).toBe(403)
      expect(json.success).toBe(false)
    })

    it('returns 200 with registry data when user is authorized', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'admin',
        role: 'admin',
        email: 'admin@test.com',
      } as any)

      const mockData = {
        items: [{ id: '1', pid: '1529900011111', ptname: 'ทดสอบ ผู้ป่วย' }],
        totalCount: 1,
        totalPages: 1,
        page: 1,
        pageSize: 50,
        summary: { totalRegistered: 1, myHospCount: 1, otherHospCount: 0 },
        importedFiles: [],
        availableTypes: ['T1DM', 'GDM'],
        myHospCode: '11152',
      }
      vi.mocked(RcmT1dmImportService.getRegistryList).mockResolvedValue(mockData as any)

      const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/t1dm-import?hospFilter=MINE')
      const response = await GET(req)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.totalCount).toBe(1)
    })
  })

  describe('POST', () => {
    it('returns 400 when no file is uploaded', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'admin',
        role: 'admin',
        email: 'admin@test.com',
      } as any)

      const formData = new FormData()
      const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/t1dm-import', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(req)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error).toContain('ไม่พบไฟล์')
    })

    it('returns 400 when file is not an Excel workbook', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'admin',
        role: 'admin',
        email: 'admin@test.com',
      } as any)

      const fakeFile = {
        name: 'document.pdf',
        size: 100,
        arrayBuffer: async () => Buffer.from('test'),
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
  })

  describe('DELETE', () => {
    it('handles delete by mode other_hospitals successfully', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'admin',
        role: 'admin',
        email: 'admin@test.com',
      } as any)

      vi.mocked(RcmT1dmImportService.deleteRegistries).mockResolvedValue({ deletedCount: 5 })

      const req = new NextRequest('http://localhost:3000/api/service/dashboard-rcm/t1dm-import', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'other_hospitals', myHospCode: '11152' }),
      })

      const response = await DELETE(req)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.deletedCount).toBe(5)
    })
  })
})
