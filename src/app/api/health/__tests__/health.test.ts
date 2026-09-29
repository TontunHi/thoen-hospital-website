import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrismaQueryRaw = vi.fn()
const mockQueryClinicalDb = vi.fn()
const mockQuerySalaryDb = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: any[]) => mockPrismaQueryRaw(...args),
  },
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

  it('returns 200 and healthy when all databases respond', async () => {
    mockPrismaQueryRaw.mockResolvedValue([{ '1': 1 }])
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

  it('returns 200 and degraded when non-critical replica fails but primary DB is UP', async () => {
    mockPrismaQueryRaw.mockResolvedValue([{ '1': 1 }])
    mockQueryClinicalDb.mockRejectedValue(new Error('Replica connection refused'))
    mockQuerySalaryDb.mockResolvedValue([{ '1': 1 }])

    const { GET } = await import('../route')
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('degraded')
    expect(json.services.primaryDatabase.status).toBe('UP')
    expect(json.services.hosxpReplicaDatabase.status).toBe('DOWN')
    expect(json.services.salaryDatabase.status).toBe('UP')
  })

  it('returns 503 and unhealthy when primary database is DOWN', async () => {
    mockPrismaQueryRaw.mockRejectedValue(new Error('MySQL Primary dead'))
    mockQueryClinicalDb.mockResolvedValue([{ '1': 1 }])
    mockQuerySalaryDb.mockResolvedValue([{ '1': 1 }])

    const { GET } = await import('../route')
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json.status).toBe('unhealthy')
    expect(json.services.primaryDatabase.status).toBe('DOWN')
  })
})
