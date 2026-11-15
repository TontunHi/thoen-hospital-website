import { NextRequest, NextResponse } from 'next/server'
import { fctHomeVisitService } from '@/lib/clinical/fctHomeVisitService'
import { fctBatchImportSchema } from '@/lib/clinical/fctHomeVisitSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import {
  handleFctHomeVisitRouteError,
  parseJsonBody,
  requireFctHomeVisitSession,
} from '../_shared'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireFctHomeVisitSession('manage')
    if (auth.response) return auth.response

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = fctBatchImportSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลสำหรับนำเข้าไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const result = await fctHomeVisitService.batchImportVisits(parsedBody.data.rows, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json({ success: true, data: result }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleFctHomeVisitRouteError(error, 'POST /api/service/fct-home-visit/import')
  }
}
