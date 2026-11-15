import { NextRequest, NextResponse } from 'next/server'
import { fctHomeVisitService } from '@/lib/clinical/fctHomeVisitService'
import { fctHomeVisitUpdateSchema } from '@/lib/clinical/fctHomeVisitSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import {
  handleFctHomeVisitRouteError,
  parseJsonBody,
  parsePositiveIntId,
  requireFctHomeVisitSession,
} from '../_shared'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireFctHomeVisitSession('manage')
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

    const parsedBody = fctHomeVisitUpdateSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลสำหรับอัปเดตไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const updated = await fctHomeVisitService.updateVisit(id, parsedBody.data, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json({ success: true, data: updated }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleFctHomeVisitRouteError(error, 'PATCH /api/service/fct-home-visit/[id]')
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireFctHomeVisitSession('manage')
    if (auth.response) return auth.response

    const { id: rawId } = await context.params
    const id = parsePositiveIntId(rawId)
    if (id === null) {
      return NextResponse.json(
        { success: false, error: 'รหัสรายการไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const deleted = await fctHomeVisitService.deleteVisit(id, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json({ success: true, data: deleted }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleFctHomeVisitRouteError(error, 'DELETE /api/service/fct-home-visit/[id]')
  }
}
