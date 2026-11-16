import { NextRequest, NextResponse } from 'next/server'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import { projectUpdateSchema } from '@/lib/projects/projectTrackerSchemas'
import { projectTrackerService } from '@/lib/projects/projectTrackerService'
import {
  handleProjectTrackerRouteError,
  parseJsonBody,
  parsePositiveIntId,
  requireProjectTrackerSession,
} from '../_shared'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireProjectTrackerSession('manage')
    if (auth.response) return auth.response

    const { id: rawId } = await context.params
    const id = parsePositiveIntId(rawId)
    if (id === null) {
      return NextResponse.json(
        { success: false, error: 'รหัสรายการโครงการไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = projectUpdateSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลสำหรับอัปเดตไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const updated = await projectTrackerService.updateProject(id, parsedBody.data, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json(
      { success: true, data: updated },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleProjectTrackerRouteError(error, 'PATCH /api/service/project-tracker/[id]')
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireProjectTrackerSession('manage')
    if (auth.response) return auth.response

    const { id: rawId } = await context.params
    const id = parsePositiveIntId(rawId)
    if (id === null) {
      return NextResponse.json(
        { success: false, error: 'รหัสรายการโครงการไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const deleted = await projectTrackerService.deleteProject(id, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json(
      { success: true, data: deleted },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleProjectTrackerRouteError(error, 'DELETE /api/service/project-tracker/[id]')
  }
}
