import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQueryMemberDb = vi.fn()
const mockQueryClinicalDb = vi.fn()
const mockQuerySalaryDb = vi.fn()
const mockApiGatewayHealth = vi.fn()

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    health: (...args: any[]) => mockApiGatewayHealth(...args),
  },
}))

vi.mock('@/lib/memberDb', () => ({
  queryMemberDb: (...args: any[]) => mockQueryMemberDb(...args),
}))

vi.mock('@/lib/clinicalDb', () => ({
  queryClinicalDb: (...args: any[]) => mockQueryClinicalDb(...args),
}))

vi.mock('@/lib/salaryDb', () => ({
  querySalaryDb: (...args: any[]) => mockQuerySalaryDb(...args),
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('System Health Check API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 and healthy when API Gateway reports all databases connected', async () => {
    mockApiGatewayHealth.mockResolvedValue({
      status: 'UP',
      service: 'Thoen Hospital Unified API Gateway',
      databases: {
        website: { host: '192.168.1.7:3306', database: 'thoen_hospital_website', connected: true, latencyMs: 2 },
        hosxp: { host: '192.168.1.4:3306', database: 'hos', connected: true, latencyMs: 1 },
        salary: { host: '192.168.1.4:3306', database: 'salary', connected: true, latencyMs: 1 },
      },
      uptime: 1000,
    })

    const { GET } = await import('../route')
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('healthy')
    expect(json.services.primaryDatabase.status).toBe('UP')
    expect(json.services.hosxpReplicaDatabase.status).toBe('UP')
    expect(json.services.salaryDatabase.status).toBe('UP')
  })

  it('returns 200 and degraded when Gateway reports non-critical replica down but website DB is UP', async () => {
    mockApiGatewayHealth.mockResolvedValue({
      status: 'UP',
      service: 'Thoen Hospital Unified API Gateway',
      databases: {
        website: { host: '192.168.1.7:3306', database: 'thoen_hospital_website', connected: true, latencyMs: 2 },
        hosxp: { host: '192.168.1.4:3306', database: 'hos', connected: false, latencyMs: 0 },
        salary: { host: '192.168.1.4:3306', database: 'salary', connected: true, latencyMs: 1 },
      },
      uptime: 1000,
    })

    const { GET } = await import('../route')
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('degraded')
    expect(json.services.primaryDatabase.status).toBe('UP')
    expect(json.services.hosxpReplicaDatabase.status).toBe('DOWN')
    expect(json.services.salaryDatabase.status).toBe('UP')
  })

  it('returns 503 and unhealthy when Gateway reports website DB is DOWN', async () => {
    mockApiGatewayHealth.mockResolvedValue({
      status: 'DOWN',
      service: 'Thoen Hospital Unified API Gateway',
      databases: {
        website: { host: '192.168.1.7:3306', database: 'thoen_hospital_website', connected: false, latencyMs: 0 },
        hosxp: { host: '192.168.1.4:3306', database: 'hos', connected: true, latencyMs: 1 },
        salary: { host: '192.168.1.4:3306', database: 'salary', connected: true, latencyMs: 1 },
      },
      uptime: 1000,
    })

    const { GET } = await import('../route')
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json.status).toBe('unhealthy')
    expect(json.services.primaryDatabase.status).toBe('DOWN')
  })

  it('falls back to individual queries when Gateway health call fails', async () => {
    mockApiGatewayHealth.mockRejectedValue(new Error('Gateway connection timeout'))
    mockQueryMemberDb.mockResolvedValue([{ '1': 1 }])
    mockQueryClinicalDb.mockResolvedValue([{ '1': 1 }])
    mockQuerySalaryDb.mockResolvedValue([{ '1': 1 }])

    const { GET } = await import('../route')
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('healthy')
    expect(json.services.primaryDatabase.status).toBe('UP')
    expect(json.services.hosxpReplicaDatabase.status).toBe('UP')
    expect(json.services.salaryDatabase.status).toBe('UP')
  })
})
