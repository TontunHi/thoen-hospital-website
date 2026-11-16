import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/projects/projectTrackerService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/projects/projectTrackerService')>(
    '@/lib/projects/projectTrackerService'
  )
  return {
    ...actual,
    projectTrackerService: {
      listProjects: vi.fn(),
      createProject: vi.fn(),
      updateProject: vi.fn(),
      deleteProject: vi.fn(),
      batchImportProjects: vi.fn(),
    },
  }
})

import { GET as getProjects, POST as createProject } from '../route'
import { PATCH as patchProject, DELETE as deleteProject } from '../[id]/route'
import { POST as importProjects } from '../import/route'
import * as memberAuth from '@/lib/memberAuth'
import { GatewayTimeoutError, GatewayUnavailableError } from '@/lib/apiGateway'
import {
  ProjectTrackerNotFoundError,
  projectTrackerService,
} from '@/lib/projects/projectTrackerService'

function makeSession(role: string, username = 'staff_test') {
  const now = Date.now()
  return {
    username,
    email: `${username}@thoen.local`,
    role,
    aud: 'member' as const,
    iat: now,
    exp: now + 1800 * 1000,
  }
}

const sampleProject = {
  id: 1,
  fiscalYear: 2570,
  sequenceNo: 1,
  projectCode: '080101',
  strategy: 'ย.1',
  projectName: 'โครงการทดสอบ',
  responsibleUnit: 'งานปฐมภูมิ',
  q1Budget: 3000,
  q2Budget: 2000,
  q3Budget: 0,
  q4Budget: 0,
  allocatedBudget: 5000,
  actualSpent: 1000,
  remainingBudget: 4000,
  disbursementRate: 20,
  submissionStatus: 'ส่งแล้ว',
  budgetSource: 'เงินบำรุง',
  notes: null,
  createdBy: 'staff_test',
  updatedBy: 'staff_test',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

describe('/api/service/project-tracker routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(memberAuth, 'attachRenewedMemberSessionCookie').mockImplementation(
      async (res) => res
    )
    vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(false)
  })

  it('returns 401 when unauthenticated on GET', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/service/project-tracker')
    const res = await getProjects(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with project list for any authenticated member on GET', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
    vi.mocked(projectTrackerService.listProjects).mockResolvedValue({
      fiscalYear: 2570,
      availableFiscalYears: [2570],
      availableStrategies: ['ย.1'],
      availableStatuses: ['ส่งแล้ว'],
      availableBudgetSources: ['เงินบำรุง'],
      items: [sampleProject],
      stats: {
        totalProjects: 1,
        submittedCount: 1,
        pendingCount: 0,
        noBudgetCount: 0,
        cancelledCount: 0,
        submissionRate: 100,
        allocatedBudgetTotal: 5000,
        actualSpentTotal: 1000,
        remainingBudgetTotal: 4000,
        disbursementRate: 20,
        remainingRate: 80,
        byStrategy: [],
        byStatus: { ส่งแล้ว: 1 },
        byBudgetSource: [],
        byQuarter: [],
      },
    })

    const req = new NextRequest('http://localhost/api/service/project-tracker?fiscalYear=2570')
    const res = await getProjects(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(json.success).toBe(true)
    expect(json.data.items).toHaveLength(1)
  })

  it('returns 403 on POST when member lacks manage_project_tracker permission', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
    vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(false)

    const req = new NextRequest('http://localhost/api/service/project-tracker', {
      method: 'POST',
      body: JSON.stringify({
        fiscalYear: 2570,
        strategy: 'ย.1',
        projectName: 'โครงการใหม่',
      }),
    })
    const res = await createProject(req)
    expect(res.status).toBe(403)
  })

  it('allows POST when member has manage_project_tracker via /member/settings', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
    vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
    vi.mocked(projectTrackerService.createProject).mockResolvedValue(sampleProject)

    const req = new NextRequest('http://localhost/api/service/project-tracker', {
      method: 'POST',
      body: JSON.stringify({
        fiscalYear: 2570,
        strategy: 'ย.1',
        projectName: 'โครงการทดสอบ',
        q1Budget: 3000,
        q2Budget: 2000,
      }),
    })
    const res = await createProject(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(json.success).toBe(true)
    expect(memberAuth.checkPositionPermission).toHaveBeenCalledWith(
      'staff_test',
      'manage_project_tracker'
    )
  })

  it('validates PATCH payload and returns 404 when project is missing', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin'))
    vi.mocked(projectTrackerService.updateProject).mockRejectedValue(
      new ProjectTrackerNotFoundError('ไม่พบข้อมูลโครงการที่ระบุ')
    )

    const req = new NextRequest('http://localhost/api/service/project-tracker/999', {
      method: 'PATCH',
      body: JSON.stringify({ submissionStatus: 'ส่งแล้ว' }),
    })
    const res = await patchProject(req, { params: Promise.resolve({ id: '999' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with no-store on PATCH', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin'))
    vi.mocked(projectTrackerService.updateProject).mockResolvedValue(sampleProject)

    const req = new NextRequest('http://localhost/api/service/project-tracker/1', {
      method: 'PATCH',
      body: JSON.stringify({ submissionStatus: 'ส่งแล้ว' }),
    })
    const res = await patchProject(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('handles DELETE and batch import with admin permission', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin'))
    vi.mocked(projectTrackerService.deleteProject).mockResolvedValue({ id: 1 })
    vi.mocked(projectTrackerService.batchImportProjects).mockResolvedValue({
      inserted: 1,
      updated: 0,
      totalProcessed: 1,
      fiscalYear: 2571,
    })

    const delRes = await deleteProject(
      new NextRequest('http://localhost/api/service/project-tracker/1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '1' }) }
    )
    expect(delRes.status).toBe(200)
    expect(delRes.headers.get('Cache-Control')).toBe('no-store')

    const impRes = await importProjects(
      new NextRequest('http://localhost/api/service/project-tracker/import', {
        method: 'POST',
        body: JSON.stringify({
          fiscalYear: 2571,
          mode: 'append',
          rows: [
            {
              fiscalYear: 2571,
              strategy: 'ย.1',
              projectName: 'โครงการนำเข้า',
            },
          ],
        }),
      })
    )
    expect(impRes.status).toBe(200)
    expect(impRes.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 503 when API Gateway is unavailable', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin'))
    vi.mocked(projectTrackerService.listProjects).mockRejectedValue(
      new GatewayUnavailableError('Gateway offline')
    )

    const req = new NextRequest('http://localhost/api/service/project-tracker')
    const res = await getProjects(req)
    expect(res.status).toBe(503)
  })

  it('returns 504 when API Gateway times out', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin'))
    vi.mocked(projectTrackerService.listProjects).mockRejectedValue(
      new GatewayTimeoutError('Gateway timeout')
    )

    const req = new NextRequest('http://localhost/api/service/project-tracker')
    const res = await getProjects(req)
    expect(res.status).toBe(504)
  })
})
