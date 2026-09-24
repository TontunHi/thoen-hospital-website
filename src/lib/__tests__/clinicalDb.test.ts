import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getClinicalDbConfig, fetchAppointmentMismatches, queryClinicalDb } from '../clinicalDb'

vi.mock('../clinicalDb', async () => {
  const actual = await vi.importActual<any>('../clinicalDb')
  return {
    ...actual,
    queryClinicalDb: vi.fn(),
  }
})

describe('clinicalDb module', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  it('resolves HOSXP_DB_* config first', () => {
    process.env.HOSXP_DB_HOST = '192.168.1.50'
    process.env.APPOINT_DB_HOST = '192.168.1.4'
    const config = getClinicalDbConfig()
    expect(config.host).toBe('192.168.1.50')
  })

  it('falls back to APPOINT_DB_* when HOSXP_DB_* is not present', () => {
    delete process.env.HOSXP_DB_HOST
    process.env.APPOINT_DB_HOST = '192.168.1.99'
    const config = getClinicalDbConfig()
    expect(config.host).toBe('192.168.1.99')
  })

  it('fetches and maps appointment mismatches correctly', async () => {
    const fakeQuery = vi.fn().mockResolvedValueOnce([
      {
        hn: '0012345',
        department: 'คลินิกเบาหวาน',
        vstdate: '2026-09-24',
        nextdate: '2026-10-01',
        app_user: 'doctor_a',
      },
    ])

    const records = await fetchAppointmentMismatches(fakeQuery)
    expect(fakeQuery).toHaveBeenCalledTimes(1)
    expect(records).toHaveLength(1)
    expect(records[0].hn).toBe('0012345')
    expect(records[0].department).toBe('คลินิกเบาหวาน')
    expect(records[0].appUser).toBe('doctor_a')
  })
})
