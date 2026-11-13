import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}))

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
  fetchAuthenticatedMember: vi.fn(),
}))

vi.mock('@/lib/clinical/ltcRegistryService', () => ({
  LtcRegistryService: {
    listRegistries: vi.fn(),
  },
}))

vi.mock('../LtcRegistryClient', () => ({
  default: (props: any) => ({ type: 'LtcRegistryClient', props }),
}))

import LtcRegistryPage from '../page'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { LtcRegistryService } from '@/lib/clinical/ltcRegistryService'

describe('LtcRegistryPage SSR authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(LtcRegistryService.listRegistries).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 1,
      availableAreaZones: [],
      stats: { total: 0, avgAdl: 0, zoneCounts: {} },
    })
  })

  it('redirects to /member/login when unauthenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)
    await expect(LtcRegistryPage()).rejects.toThrow('REDIRECT:/member/login')
  })

  it('redirects unauthorized member to pc-1 instead of registry', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'user1',
      role: 'member',
      email: 'user1@hospital.local',
    } as any)
    vi.mocked(fetchAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      role: 'member',
      can: vi.fn().mockReturnValue(false),
    } as any)

    await expect(LtcRegistryPage()).rejects.toThrow(
      'REDIRECT:/service/dashboard-rcm/palliative-care/pc-1'
    )
    expect(LtcRegistryService.listRegistries).not.toHaveBeenCalled()
  })

  it('allows member with view_ltc_registry and sets read-only props', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'viewer_ltc',
      role: 'member',
      email: 'viewer_ltc@hospital.local',
    } as any)
    vi.mocked(fetchAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      role: 'member',
      can: vi.fn((perms: string | string[]) => {
        const list = Array.isArray(perms) ? perms : [perms]
        return list.includes('view_ltc_registry')
      }),
    } as any)

    const tree: any = await LtcRegistryPage()
    const clientEl = tree.props.children

    expect(clientEl.props.canEdit).toBe(false)
    expect(clientEl.props.canManage).toBe(false)
    expect(clientEl.props.initialData.permissions).toEqual({
      canView: true,
      canEdit: false,
      canManage: false,
    })
  })

  it('allows member with edit_ltc_registry and sets canEdit=true, canManage=false', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'editor_ltc',
      role: 'member',
      email: 'editor_ltc@hospital.local',
    } as any)
    vi.mocked(fetchAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      role: 'member',
      can: vi.fn((perms: string | string[]) => {
        const list = Array.isArray(perms) ? perms : [perms]
        return list.includes('edit_ltc_registry')
      }),
    } as any)

    const tree: any = await LtcRegistryPage()
    const clientEl = tree.props.children

    expect(clientEl.props.canEdit).toBe(true)
    expect(clientEl.props.canManage).toBe(false)
  })
})
