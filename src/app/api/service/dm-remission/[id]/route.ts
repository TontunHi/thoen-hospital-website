import { NextRequest, NextResponse } from 'next/server'
import { dmRemissionService } from '@/lib/clinical/dmRemissionService'
import { cohortUpdateSchema } from '@/lib/clinical/dmRemissionSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import {
  handleDmRemissionRouteError,
  parseJsonBody,
  parsePositiveIntId,
  requireDmRemissionSession,
} from '../_shared'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireDmRemissionSession('manage')
    if (auth.response) return auth.response

    const { id: rawId } = await context.params
    const id = parsePositiveIntId(rawId)
    if (id === null) {
      return NextResponse.json(
        { success: false, error: 'รหัสรายการไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = cohortUpdateSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลสำหรับอัปเดตไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const updated = await dmRemissionService.updateCohort(id, parsedBody.data, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json({ success: true, data: updated }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleDmRemissionRouteError(error, 'PATCH /api/service/dm-remission/[id]')
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireDmRemissionSession('manage')
    if (auth.response) return auth.response

    const { id: rawId } = await context.params
    const id = parsePositiveIntId(rawId)
    if (id === null) {
      return NextResponse.json(
        { success: false, error: 'รหัสรายการไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const deleted = await dmRemissionService.deleteCohort(id, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json({ success: true, data: deleted }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleDmRemissionRouteError(error, 'DELETE /api/service/dm-remission/[id]')
  }
}
