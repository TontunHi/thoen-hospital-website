import { NextRequest, NextResponse } from 'next/server'
import { fctHomeVisitService } from '@/lib/clinical/fctHomeVisitService'
import { fctOptionCreateSchema } from '@/lib/clinical/fctHomeVisitSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import {
  handleFctHomeVisitRouteError,
  parseJsonBody,
  requireFctHomeVisitSession,
} from '../_shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireFctHomeVisitSession()
    if (auth.response) return auth.response

    const options = await fctHomeVisitService.listOptions()
    const response = NextResponse.json({ success: true, data: options }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleFctHomeVisitRouteError(error, 'GET /api/service/fct-home-visit/options')
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireFctHomeVisitSession('admin')
    if (auth.response) return auth.response

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = fctOptionCreateSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลตัวเลือกไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const created = await fctHomeVisitService.createOption(parsedBody.data, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json({ success: true, data: created }, { status: 201 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleFctHomeVisitRouteError(error, 'POST /api/service/fct-home-visit/options')
  }
}
