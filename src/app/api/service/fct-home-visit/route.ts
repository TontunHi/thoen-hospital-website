import { NextRequest, NextResponse } from 'next/server'
import { logThrottledAudit } from '@/lib/audit'
import { fctHomeVisitService } from '@/lib/clinical/fctHomeVisitService'
import {
  fctHomeVisitCreateSchema,
  fctListQuerySchema,
} from '@/lib/clinical/fctHomeVisitSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import {
  handleFctHomeVisitRouteError,
  parseJsonBody,
  requireFctHomeVisitSession,
} from './_shared'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireFctHomeVisitSession()
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const parsedQuery = fctListQuerySchema.safeParse({
      fiscalYear: searchParams.get('fiscalYear') ?? undefined,
      pcuName: searchParams.get('pcuName') ?? undefined,
      adlGroup: searchParams.get('adlGroup') ?? undefined,
      visitOutcome: searchParams.get('visitOutcome') ?? undefined,
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

    const result = await fctHomeVisitService.listVisits(parsedQuery.data)

    await logThrottledAudit(
      'READ',
      'fct_home_visits',
      'Viewed FCT Home Visit registry FY ' + result.fiscalYear + ' (count: ' + result.items.length + ')',
      auth.session
    )

    const response = NextResponse.json({ success: true, data: result }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleFctHomeVisitRouteError(error, 'GET /api/service/fct-home-visit')
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireFctHomeVisitSession('manage')
    if (auth.response) return auth.response

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = fctHomeVisitCreateSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลการเยี่ยมบ้านไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const created = await fctHomeVisitService.createVisit(parsedBody.data, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json({ success: true, data: created }, { status: 201 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleFctHomeVisitRouteError(error, 'POST /api/service/fct-home-visit')
  }
}
