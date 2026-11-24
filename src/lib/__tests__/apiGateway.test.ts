import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ApiGatewayClient,
  createApiGatewayClient,
  GatewayError,
  GatewayTimeoutError,
  GatewayUnavailableError,
  GatewayAuthError,
  GatewayNotFoundError
} from '../apiGateway'

describe('ApiGatewayClient (Ticket 01)', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
  })

  it('initializes with default or custom configuration and strips trailing slashes', () => {
    const client = createApiGatewayClient({
      baseUrl: 'http://test-gw:8443///',
      apiKey: 'custom_key_123',
      timeoutMs: 5000,
      fetchFn: mockFetch as unknown as typeof fetch
    })

    expect(client.getBaseUrl()).toBe('http://test-gw:8443')
  })

  it('attaches x-api-key header and Content-Type on requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { message: 'ok' } })
    })

    const client = createApiGatewayClient({
      baseUrl: 'http://gateway.local:8443',
      apiKey: 'my_secret_token',
      fetchFn: mockFetch as unknown as typeof fetch
    })

    const res = await client.post('/api/v1/test', { key: 'value' })

    expect(res).toEqual({ message: 'ok' })
    expect(mockFetch).toHaveBeenCalledWith(
      'http://gateway.local:8443/api/v1/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'my_secret_token',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }),
        body: JSON.stringify({ key: 'value' })
      })
    )
  })

  it('strict fail-closed: throws GatewayUnavailableError when network fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const client = createApiGatewayClient({
      baseUrl: 'http://gateway.local:8443',
      fetchFn: mockFetch as unknown as typeof fetch
    })

    await expect(client.get('/health')).rejects.toThrow(GatewayUnavailableError)
  })

  it('strict fail-closed: throws GatewayTimeoutError (subclass of GatewayUnavailableError) when request times out', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(abortError)

    const client = createApiGatewayClient({
      baseUrl: 'http://gateway.local:8443',
      timeoutMs: 100,
      fetchFn: mockFetch as unknown as typeof fetch
    })

    const err = await client.get('/api/v1/clinical/er/status').catch((e) => e)
    expect(err).toBeInstanceOf(GatewayTimeoutError)
    expect(err).toBeInstanceOf(GatewayUnavailableError)
    expect((err as GatewayTimeoutError).status).toBe(504)
  })

  it('throws GatewayAuthError on HTTP 401 and 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ success: false, error: 'Unauthorized: Invalid x-api-key' })
    })

    const client = createApiGatewayClient({
      baseUrl: 'http://gateway.local:8443',
      fetchFn: mockFetch as unknown as typeof fetch
    })

    await expect(client.get('/api/v1/app/members')).rejects.toThrow(GatewayAuthError)
  })

  it('throws GatewayNotFoundError on HTTP 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ success: false, error: 'Member not found' })
    })

    const client = createApiGatewayClient({
      baseUrl: 'http://gateway.local:8443',
      fetchFn: mockFetch as unknown as typeof fetch
    })

    await expect(client.get('/api/v1/app/members/999')).rejects.toThrow(GatewayNotFoundError)
  })

  it('throws GatewayUnavailableError on HTTP 503', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ status: 'DOWN', error: 'Database unreachable' })
    })

    const client = createApiGatewayClient({
      baseUrl: 'http://gateway.local:8443',
      fetchFn: mockFetch as unknown as typeof fetch
    })

    await expect(client.health()).rejects.toThrow(GatewayUnavailableError)
  })

  it('throws GatewayError when json contains success: false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: false, error: 'Upstream domain error' })
    })

    const client = createApiGatewayClient({
      baseUrl: 'http://gateway.local:8443',
      fetchFn: mockFetch as unknown as typeof fetch
    })

    await expect(client.clinical.getErStatus()).rejects.toThrow(GatewayError)
  })

  describe('Clinical Services Namespace', () => {
    it('does not expose deprecated raw SQL methods on any Gateway namespace (100% Zero-SQL)', () => {
      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      expect((client.clinical as Record<string, unknown>).query).toBeUndefined()
      expect((client.app as Record<string, unknown>).query).toBeUndefined()
      expect((client.app as Record<string, unknown>).execute).toBeUndefined()
      expect((client.app as Record<string, unknown>).transaction).toBeUndefined()
      expect((client.salary as Record<string, unknown>).query).toBeUndefined()
      expect((client.salary as Record<string, unknown>).execute).toBeUndefined()
    })

    it('clinical.getErStatus supports tv mode parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { levels: [], activePatients: [] } })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      await client.clinical.getErStatus('tv')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/clinical/er/status?mode=tv'),
        expect.anything()
      )
    })

    it('clinical.verifyScreeningVisits posts cids to /api/v1/clinical/screening/verify-visits', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 2,
          data: [
            { cid: '111', hasPatientRecord: true, hasVisitToday: true, status: 'VISIT_OPENED', vn: '6710160001' },
            { cid: '222', hasPatientRecord: false, hasVisitToday: false, status: 'NO_RECORD' }
          ]
        })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.clinical.verifyScreeningVisits(['111', '222'])

      expect(res).toHaveLength(2)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/clinical/screening/verify-visits'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ cids: ['111', '222'] })
        })
      )
    })

    it('clinical.getRcmInvoiceSummary calls GET /api/v1/clinical/rcm/invoice-summary', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 1,
          data: {
            department: 'OP',
            ds1: '2026-10-01',
            ds2: '2026-10-31',
            items: [
              { code: 'UCS', name: 'สิทธิบัตรทอง', visit: 10, receipt: 1000, compensated: 900, down: 0, up: -100, debit: 1000 }
            ],
            grandTotal: { visit: 10, receipt: 1000, compensated: 900, down: 0, up: -100, debit: 1000 }
          }
        })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.clinical.getRcmInvoiceSummary({ department: 'OP', startDate: '2026-10-01', endDate: '2026-10-31' })

      expect(res.department).toBe('OP')
      expect(res.items).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/clinical/rcm/invoice-summary?department=OP&startDate=2026-10-01&endDate=2026-10-31'),
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('clinical.getRcmInvoiceDetails calls GET /api/v1/clinical/rcm/invoice-details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 1,
          data: {
            items: [{ no: 1, vnOrAn: '6710160001', ptname: 'นายทดสอบ' }],
            totalCount: 1,
            totalPages: 1,
            page: 1,
            pageSize: 50
          }
        })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.clinical.getRcmInvoiceDetails({ department: 'IP', pttype: 'UCS' })

      expect(res.items).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/clinical/rcm/invoice-details?department=IP&pttype=UCS'),
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('clinical.getMokList calls /api/v1/clinical/mok/list with params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 1,
          data: [{ cid: '1529900000000', hn: '0001234', ptname: 'นายทดสอบ หมอครอบครัว' }]
        })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.clinical.getMokList({ category: 'asthma', catchment: 'in_catchment' })

      expect(res).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/clinical/mok/list?category=asthma&catchment=in_catchment'),
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('clinical.getMokSummary calls /api/v1/clinical/mok/summary', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { asthma: 30, ca: 12, dm: 150 }
        })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.clinical.getMokSummary({ catchment: 'in_catchment' })

      expect(res).toEqual({ asthma: 30, ca: 12, dm: 150 })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/clinical/mok/summary?catchment=in_catchment'),
        expect.objectContaining({ method: 'GET' })
      )
    })
  })


  describe('Salary Services Namespace', () => {
    it('salary.verifyLogin authenticates credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, user: { username: 'testuser', name: 'Test User', status: '1' } })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.salary.verifyLogin('testuser', 'pass123')

      expect(res).toEqual({ success: true, user: { username: 'testuser', name: 'Test User', status: '1' } })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/salary/verify-login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'testuser', password: 'pass123' })
        })
      )
    })
  })

  describe('Website Application Namespace', () => {
    it('app.getMembers fetches members list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [{ id: 1, name: 'Doctor One' }] })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const members = await client.app.getMembers()

      expect(members).toEqual([{ id: 1, name: 'Doctor One' }])
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/app/members'),
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('app.logAudit records compliance audit entry', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, logId: 9999 })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.app.logAudit({
        actionType: 'LOGIN_SUCCESS',
        username: 'admin',
        ipAddress: '127.0.0.1'
      })

      expect(res).toEqual({ success: true, logId: 9999 })
    })

    it('gtw.getArticles calls GET /api/v1/gtw/articles with query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 2,
          data: [
            { ARTICLE_ID: 101, ARTICLE_NUM: '7440-001', ARTICLE_NAME: 'PC' },
            { ARTICLE_ID: 102, ARTICLE_NUM: '7430-002', ARTICLE_NAME: 'Printer' }
          ]
        })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.gtw.getArticles({ limit: 50, since: '2026-01-01' })

      expect(res).toHaveLength(2)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/gtw/articles?limit=50&since=2026-01-01'),
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('app.getInboxTasks normalizes unwrapped { success: true, data } responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            tasks: [{ id: 't-1', task_no: 'IT-2570-11-0001' }],
            inboxCount: 1,
            departmentCount: 1,
            canViewAll: false,
            userDepartment: 'IT',
            stats: { pendingCount: 1, departmentCount: 1, allPendingCount: 1, approvedCount: 0, myRequestsCount: 0 }
          }
        })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.app.getInboxTasks({ tab: 'inbox', username: 'user1' })

      expect(res.success).toBe(true)
      expect(res.data.tasks).toHaveLength(1)
      expect(res.data.inboxCount).toBe(1)
    })

    it('app.createTask normalizes unwrapped { success: true, data: { taskId, taskNo } } responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'created',
          data: { taskId: 'uuid-1', taskNo: 'IT-2570-11-0004' }
        })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.app.createTask({
        task: {
          id: 'uuid-1',
          taskNo: 'IT-2570-11-0004',
          taskType: 'IT_REPAIR',
          title: 'แจ้งซ่อม: เครื่องปริ้น',
          requesterId: 105,
          requesterName: 'Test User'
        }
      })

      expect(res.success).toBe(true)
      expect(res.data).toEqual({ taskId: 'uuid-1', taskNo: 'IT-2570-11-0004' })
    })

    it('app.getTaskFullDetails normalizes unwrapped { success: true, data } responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            task: { id: 'uuid-1', task_no: 'IT-2570-11-0003' },
            steps: [{ step_no: 1 }],
            repairDetail: { repair_type: 'IT_REPAIR' },
            auditLogs: []
          }
        })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.app.getTaskFullDetails('uuid-1')

      expect(res.success).toBe(true)
      expect(res.data.task.task_no).toBe('IT-2570-11-0003')
      expect(res.data.steps).toHaveLength(1)
    })

    it('app.executeWorkflowAction and executeRepairAction handle both direct and data-wrapped responses', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { message: 'Approved', isFinalStep: false, nextStep: { step_no: 2 } }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { message: 'Accepted' }
          })
        })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const wfRes = await client.app.executeWorkflowAction({
        taskId: 'uuid-1',
        action: 'APPROVE',
        actor: { id: 1, username: 'admin' }
      })
      const repairRes = await client.app.executeRepairAction({
        taskId: 'uuid-1',
        action: 'ACCEPT_JOB',
        performer: { id: 1, username: 'tech' }
      })

      expect(wfRes).toEqual({
        success: true,
        message: 'Approved',
        isFinalStep: false,
        nextStep: { step_no: 2 }
      })
      expect(repairRes).toEqual({
        success: true,
        message: 'Accepted'
      })
    })
  })
})
