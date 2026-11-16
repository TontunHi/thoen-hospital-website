import { NextRequest, NextResponse } from 'next/server'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import { projectBatchImportSchema } from '@/lib/projects/projectTrackerSchemas'
import { projectTrackerService } from '@/lib/projects/projectTrackerService'
import {
  handleProjectTrackerRouteError,
  parseJsonBody,
  requireProjectTrackerSession,
} from '../_shared'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireProjectTrackerSession('manage')
    if (auth.response) return auth.response

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = projectBatchImportSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลสำหรับนำเข้าไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const result = await projectTrackerService.batchImportProjects(
      parsedBody.data.fiscalYear,
      parsedBody.data.rows,
      parsedBody.data.mode,
      {
        username: auth.session.username,
        email: auth.session.email,
      }
    )

    const response = NextResponse.json(
      { success: true, data: result },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleProjectTrackerRouteError(error, 'POST /api/service/project-tracker/import')
  }
}
