import { NextRequest, NextResponse } from 'next/server'
import { logThrottledAudit } from '@/lib/audit'
import { dmRemissionService } from '@/lib/clinical/dmRemissionService'
import { cohortCreateSchema, listQuerySchema } from '@/lib/clinical/dmRemissionSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import {
  handleDmRemissionRouteError,
  parseJsonBody,
  requireDmRemissionSession,
} from './_shared'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDmRemissionSession()
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const parsedQuery = listQuerySchema.safeParse({
      fiscalYear: searchParams.get('fiscalYear') ?? undefined,
      pcuName: searchParams.get('pcuName') ?? undefined,
      remissionStatus: searchParams.get('remissionStatus') ?? undefined,
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

    const result = await dmRemissionService.listCohorts(parsedQuery.data)

    await logThrottledAudit(
      'READ',
      'dm_remission_cohorts',
      'Viewed DM Remission cohort FY ' + result.fiscalYear + ' (count: ' + result.items.length + ')',
      auth.session
    )

    const response = NextResponse.json({ success: true, data: result }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleDmRemissionRouteError(error, 'GET /api/service/dm-remission')
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDmRemissionSession('manage')
    if (auth.response) return auth.response

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = cohortCreateSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลผู้ป่วยไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const created = await dmRemissionService.createCohort(parsedBody.data, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json({ success: true, data: created }, { status: 201 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleDmRemissionRouteError(error, 'POST /api/service/dm-remission')
  }
}
