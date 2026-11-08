import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redirect } from 'next/navigation'
import * as memberAuth from '@/lib/memberAuth'
import { RcmImcService } from '@/lib/clinical/rcmImcService'
import ImcEligiblePatientsPage from '../page'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/memberAuth')
vi.mock('@/lib/clinical/rcmImcService')
vi.mock('../ImcEligiblePatientsClient', () => ({
  default: vi.fn(({ initialData }) => (
    <div data-testid="imc-client">{initialData?.reportTitle || 'no-data'}</div>
  )),
}))

describe('ImcEligiblePatientsPage Server Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login when unauthenticated', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue(null)

    await ImcEligiblePatientsPage()

    expect(redirect).toHaveBeenCalledWith(
      '/member/login?returnUrl=/service/dashboard-rcm/funds/rehabilitation/imc/eligible-patients'
    )
  })

  it('redirects to /service when unauthorized role', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'guest',
      role: 'guest',
    } as any)

    await ImcEligiblePatientsPage()

    expect(redirect).toHaveBeenCalledWith('/service')
  })

  it('prefetches initialData for authorized user', async () => {
    vi.mocked(memberAuth.verifyMemberSession).mockResolvedValue({
      username: 'staff01',
      role: 'staff',
    } as any)

    const mockReport = {
      reportTitle: 'รายชื่อผู้รับบริการตามเกณฑ์ IMC',
      totalCount: 10,
    }

    vi.mocked(RcmImcService.getImcReport).mockResolvedValue(mockReport as any)

    const result = await ImcEligiblePatientsPage()

    expect(RcmImcService.getImcReport).toHaveBeenCalledWith(
      expect.objectContaining({
        patientType: 'IPD',
        page: 1,
        pageSize: 50,
      })
    )
    expect(result).toBeDefined()
  })
})
