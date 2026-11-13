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

vi.mock('@/lib/clinical/palliativeRegistryService', () => ({
  PalliativeRegistryService: {
    listRegistries: vi.fn(),
  },
}))

vi.mock('../PalliativeRegistryClient', () => ({
  default: (props: any) => ({ type: 'PalliativeRegistryClient', props }),
}))

import PalliativeRegistryPage from '../page'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { PalliativeRegistryService } from '@/lib/clinical/palliativeRegistryService'

describe('PalliativeRegistryPage SSR authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(PalliativeRegistryService.listRegistries).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 1,
      stats: { total: 0, registered: 0, pendingRegistration: 0, claimed: 0, paid: 0, deny: 0 },
    })
  })

  it('redirects to /member/login when unauthenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)
    await expect(PalliativeRegistryPage()).rejects.toThrow('REDIRECT:/member/login')
  })

  it('redirects member without palliative registry permission to pc-1', async () => {
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

    await expect(PalliativeRegistryPage()).rejects.toThrow(
      'REDIRECT:/service/dashboard-rcm/palliative-care/pc-1'
    )
    expect(PalliativeRegistryService.listRegistries).not.toHaveBeenCalled()
  })

  it('passes initialPermissions for member with edit_palliative_registry (via user or position)', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'nurse_pc',
      role: 'member',
      email: 'nurse_pc@hospital.local',
    } as any)
    vi.mocked(fetchAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      role: 'member',
      can: vi.fn((perms: string | string[]) => {
        const list = Array.isArray(perms) ? perms : [perms]
        return list.includes('edit_palliative_registry')
      }),
    } as any)

    const tree: any = await PalliativeRegistryPage()
    const clientEl = tree.props.children

    expect(clientEl.props.userRole).toBe('member')
    expect(clientEl.props.initialPermissions).toEqual({
      canView: true,
      canEdit: true,
      canManage: false,
    })
    expect(clientEl.props.initialData.permissions).toEqual({
      canView: true,
      canEdit: true,
      canManage: false,
    })
  })

  it('passes read-only initialPermissions for member with view_palliative_registry', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      username: 'viewer_pc',
      role: 'member',
      email: 'viewer_pc@hospital.local',
    } as any)
    vi.mocked(fetchAuthenticatedMember).mockResolvedValue({
      isAdmin: false,
      role: 'member',
      can: vi.fn((perms: string | string[]) => {
        const list = Array.isArray(perms) ? perms : [perms]
        return list.includes('view_palliative_registry')
      }),
    } as any)

    const tree: any = await PalliativeRegistryPage()
    const clientEl = tree.props.children

    expect(clientEl.props.initialPermissions).toEqual({
      canView: true,
      canEdit: false,
      canManage: false,
    })
  })
})
