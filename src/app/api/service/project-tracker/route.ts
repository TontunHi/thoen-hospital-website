import { NextRequest, NextResponse } from 'next/server'
import { logThrottledAudit } from '@/lib/audit'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import {
  projectCreateSchema,
  projectListQuerySchema,
} from '@/lib/projects/projectTrackerSchemas'
import { projectTrackerService } from '@/lib/projects/projectTrackerService'
import {
  handleProjectTrackerRouteError,
  parseJsonBody,
  requireProjectTrackerSession,
} from './_shared'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireProjectTrackerSession('view')
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const parsedQuery = projectListQuerySchema.safeParse({
      fiscalYear: searchParams.get('fiscalYear') ?? undefined,
      strategy: searchParams.get('strategy') ?? undefined,
      submissionStatus: searchParams.get('submissionStatus') ?? undefined,
      budgetSource: searchParams.get('budgetSource') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    })

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedQuery.error.issues[0]?.message || 'พารามิเตอร์ค้นหาไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const result = await projectTrackerService.listProjects(parsedQuery.data)

    await logThrottledAudit(
      'READ',
      'project_tracking_records',
      `Viewed project tracker FY ${result.fiscalYear} (count: ${result.items.length})`,
      auth.session
    )

    const response = NextResponse.json(
      { success: true, data: result },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleProjectTrackerRouteError(error, 'GET /api/service/project-tracker')
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireProjectTrackerSession('manage')
    if (auth.response) return auth.response

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = projectCreateSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลโครงการไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const created = await projectTrackerService.createProject(parsedBody.data, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json(
      { success: true, data: created },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleProjectTrackerRouteError(error, 'POST /api/service/project-tracker')
  }
}
