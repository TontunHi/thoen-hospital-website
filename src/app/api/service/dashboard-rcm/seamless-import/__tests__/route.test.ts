import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, DELETE } from '../route'
import * as memberAuth from '@/lib/memberAuth'
import { RcmSeamlessImportService } from '@/lib/clinical/rcmSeamlessImportService'
import { GatewayUnavailableError } from '@/lib/apiGateway'
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

vi.mock('@/lib/clinical/rcmSeamlessImportService', () => ({
  RcmSeamlessImportService: {
    getSeamlessDatabaseStats: vi.fn(),
    getSeamlessLedger: vi.fn(),
    getSeamlessImportedFiles: vi.fn(),
    getSeamlessDenyCodes: vi.fn(),
    deleteSeamlessRecords: vi.fn(),
    syncSeamlessPaymentDates: vi.fn(),
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

      const response = await GET(new NextRequest('http://localhost/api/service/dashboard-rcm/seamless-import'))
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

      const response = await GET(new NextRequest('http://localhost/api/service/dashboard-rcm/seamless-import'))
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

      const response = await GET(new NextRequest('http://localhost/api/service/dashboard-rcm/seamless-import'))
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
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        existingInDbCount: 2,
        newInDbCount: 8,
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

    it('passes duplicateMode=skip and returns live insert/update/skip summary when dryRun=false', async () => {
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
        insertedCount: 7,
        updatedCount: 0,
        skippedCount: 3,
        existingInDbCount: 3,
        newInDbCount: 7,
        isDryRun: false,
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
          if (key === 'dryRun') return 'false'
          if (key === 'duplicateMode') return 'skip'
          if (key === 'filterMyHospOnly') return 'false'
          return null
        },
      }
      const req = { formData: async () => mockFormData } as any

      const response = await POST(req)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(RcmSeamlessImportService.parseWorkbook).toHaveBeenCalledWith(
        expect.any(Buffer),
        'DAMD_202501.xlsx',
        expect.objectContaining({
          isDryRun: false,
          duplicateMode: 'skip',
          filterMyHospOnly: false,
        })
      )
      expect(json.message).toContain('เพิ่มใหม่ 7 รายการ')
      expect(json.message).toContain('ข้าม 3 รายการ')
    })

    it('handles JSON sync_payment command via POST', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'staff',
        name: 'Staff',
        role: 'staff',
      } as any)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(RcmSeamlessImportService.syncSeamlessPaymentDates).mockResolvedValue({
        updatedPaymentCount: 25,
        backfilledDateCount: 10,
      })

      const req = new NextRequest('http://localhost/api/service/dashboard-rcm/seamless-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'sync_payment', force: true }),
      })

      const response = await POST(req)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toEqual({ updatedPaymentCount: 25, backfilledDateCount: 10 })
    })
  })

  describe('GET views & validation', () => {
    it('supports view=ledger, view=files, view=deny_codes and rejects invalid page', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'viewer',
        name: 'Viewer',
        role: 'staff',
      } as any)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

      vi.mocked(RcmSeamlessImportService.getSeamlessLedger).mockResolvedValue({
        items: [],
        totalCount: 0,
        totalPages: 1,
        page: 1,
        pageSize: 50,
        availableFunds: [],
        myHospCode: '11152',
      })
      const ledgerReq = new NextRequest(
        'http://localhost/api/service/dashboard-rcm/seamless-import?view=ledger&hospFilter=OTHER&page=2'
      )
      const ledgerRes = await GET(ledgerReq)
      expect(ledgerRes.status).toBe(200)
      expect(RcmSeamlessImportService.getSeamlessLedger).toHaveBeenCalledWith(
        expect.objectContaining({ hospFilter: 'OTHER', page: 2, pageSize: 50 })
      )

      vi.mocked(RcmSeamlessImportService.getSeamlessImportedFiles).mockResolvedValue([])
      const filesRes = await GET(
        new NextRequest('http://localhost/api/service/dashboard-rcm/seamless-import?view=files')
      )
      expect(filesRes.status).toBe(200)

      vi.mocked(RcmSeamlessImportService.getSeamlessDenyCodes).mockResolvedValue([
        { code: 'E01', name: 'ไม่ครบ' },
      ])
      const denyRes = await GET(
        new NextRequest(
          'http://localhost/api/service/dashboard-rcm/seamless-import?view=deny_codes&search=E01'
        )
      )
      const denyJson = await denyRes.json()
      expect(denyRes.status).toBe(200)
      expect(denyJson.data).toEqual([{ code: 'E01', name: 'ไม่ครบ' }])

      const invalidRes = await GET(
        new NextRequest('http://localhost/api/service/dashboard-rcm/seamless-import?view=ledger&page=-1')
      )
      expect(invalidRes.status).toBe(400)
    })
  })

  describe('DELETE', () => {
    it('validates mode payloads and enforces manage permission for mode=all', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 2,
        username: 'importer',
        name: 'Importer',
        role: 'staff',
      } as any)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockImplementation(async (_user, perm) => {
        if (perm === 'manage_rcm_import') return false
        return true
      })

      // Missing fileName for by_file -> 400
      const badReq = new NextRequest('http://localhost/api/service/dashboard-rcm/seamless-import', {
        method: 'DELETE',
        body: JSON.stringify({ mode: 'by_file' }),
      })
      expect((await DELETE(badReq)).status).toBe(400)

      // mode=all denied for non-manage user -> 403
      const forbiddenAllReq = new NextRequest(
        'http://localhost/api/service/dashboard-rcm/seamless-import',
        {
          method: 'DELETE',
          body: JSON.stringify({ mode: 'all' }),
        }
      )
      expect((await DELETE(forbiddenAllReq)).status).toBe(403)

      // mode=by_file allowed for import_rcm_data -> 200
      vi.mocked(RcmSeamlessImportService.deleteSeamlessRecords).mockResolvedValue({
        deletedCount: 15,
      })
      const okReq = new NextRequest('http://localhost/api/service/dashboard-rcm/seamless-import', {
        method: 'DELETE',
        body: JSON.stringify({ mode: 'by_file', fileName: '11152_DDSA.xlsx' }),
      })
      const okRes = await DELETE(okReq)
      const okJson = await okRes.json()
      expect(okRes.status).toBe(200)
      expect(okJson.data.deletedCount).toBe(15)
    })
  })

  describe('POST Gateway error mapping', () => {
    it('returns HTTP 504 on Gateway timeout and HTTP 503 on Gateway connection failure', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
        id: 1,
        username: 'admin_user',
        role: 'admin',
        email: 'admin@test.com',
      } as any)

      const fakeFile = {
        name: 'REP_individual_DSA_test.xlsx',
        size: 1024,
        arrayBuffer: async () => Buffer.from('fake excel buffer'),
      }
      const makeReq = () =>
        ({
          formData: async () => ({
            get: (key: string) => (key === 'file' ? fakeFile : key === 'dryRun' ? 'false' : null),
          }),
        }) as any

      vi.mocked(RcmSeamlessImportService.parseWorkbook).mockRejectedValueOnce(
        new GatewayUnavailableError('Gateway request to /api/v1/clinical/rcm/seamless/import timed out after 120000ms.')
      )
      const timeoutRes = await POST(makeReq())
      const timeoutJson = await timeoutRes.json()
      expect(timeoutRes.status).toBe(504)
      expect(timeoutJson.error).toContain('Timeout')

      vi.mocked(RcmSeamlessImportService.parseWorkbook).mockRejectedValueOnce(
        new GatewayUnavailableError('Connection to API Gateway failed: fetch failed (UND_ERR_SOCKET)')
      )
      const unavailableRes = await POST(makeReq())
      const unavailableJson = await unavailableRes.json()
      expect(unavailableRes.status).toBe(503)
      expect(unavailableJson.error).toContain('ไม่สามารถเชื่อมต่อ API Gateway')
    })
  })
})
