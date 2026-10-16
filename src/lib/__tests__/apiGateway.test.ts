import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ApiGatewayClient,
  createApiGatewayClient,
  GatewayError,
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

  it('strict fail-closed: throws GatewayUnavailableError when request times out', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(abortError)

    const client = createApiGatewayClient({
      baseUrl: 'http://gateway.local:8443',
      timeoutMs: 100,
      fetchFn: mockFetch as unknown as typeof fetch
    })

    await expect(client.get('/api/v1/clinical/er/status')).rejects.toThrow(GatewayUnavailableError)
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
      json: async () => ({ success: false, error: 'Invalid SQL syntax' })
    })

    const client = createApiGatewayClient({
      baseUrl: 'http://gateway.local:8443',
      fetchFn: mockFetch as unknown as typeof fetch
    })

    await expect(client.clinical.query('INVALID SQL')).rejects.toThrow(GatewayError)
  })

  describe('Clinical Services Namespace', () => {
    it('clinical.query sends SQL and params and returns array of records', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, count: 2, data: [{ hn: '123' }, { hn: '456' }] })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const rows = await client.clinical.query('SELECT hn FROM patient WHERE hn IN (?, ?)', ['123', '456'])

      expect(rows).toEqual([{ hn: '123' }, { hn: '456' }])
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/clinical/query'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sql: 'SELECT hn FROM patient WHERE hn IN (?, ?)', params: ['123', '456'] })
        })
      )
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

    it('app.execute sends parameterized mutation query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, affectedRows: 1, insertId: 42 })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const res = await client.app.execute('UPDATE news SET view_count = view_count + 1 WHERE id = ?', [10])

      expect(res).toEqual({ success: true, affectedRows: 1, insertId: 42 })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/app/execute'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sql: 'UPDATE news SET view_count = view_count + 1 WHERE id = ?', params: [10] })
        })
      )
    })

    it('app.transaction executes statements atomically', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, count: 2, results: [{ affectedRows: 1 }, { affectedRows: 2 }] })
      })

      const client = createApiGatewayClient({ fetchFn: mockFetch as unknown as typeof fetch })
      const stmts = [
        { sql: 'INSERT INTO news (title) VALUES (?)', params: ['Test'] },
        { sql: 'UPDATE stats SET count = count + 1' }
      ]
      const res = await client.app.transaction(stmts)

      expect(res).toEqual({ success: true, count: 2, results: [{ affectedRows: 1 }, { affectedRows: 2 }] })
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
  })
})
