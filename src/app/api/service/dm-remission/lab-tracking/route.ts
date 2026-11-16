import { NextRequest, NextResponse } from 'next/server'
import { logThrottledAudit } from '@/lib/audit'
import { dmRemissionLabService } from '@/lib/clinical/dmRemissionLabService'
import { labTrackingQuerySchema } from '@/lib/clinical/dmRemissionSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import { handleDmRemissionRouteError, requireDmRemissionSession } from '../_shared'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDmRemissionSession('view')
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const parsedQuery = labTrackingQuerySchema.safeParse({
      fiscalYear: searchParams.get('fiscalYear') ?? undefined,
      a1cMax: searchParams.get('a1cMax') ?? undefined,
      ucScope: searchParams.get('ucScope') ?? undefined,
      diagScope: searchParams.get('diagScope') ?? undefined,
      drugScope: searchParams.get('drugScope') ?? undefined,
      cohortStatus: searchParams.get('cohortStatus') ?? undefined,
      tambon: searchParams.get('tambon') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      includeDeceased: searchParams.get('includeDeceased') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      exportAll: searchParams.get('exportAll') ?? undefined,
      refresh: searchParams.get('refresh') ?? undefined,
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

    const result = await dmRemissionLabService.getLabTracking(parsedQuery.data)

    await logThrottledAudit(
      'READ',
      'dm_remission_lab_tracking',
      `Viewed DM Remission lab tracking FY ${result.fiscalYear} (eligible: ${result.summary.totalEligible}, page: ${result.pagination.page})`,
      auth.session
    )

    const response = NextResponse.json(
      { success: true, data: result },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleDmRemissionRouteError(error, 'GET /api/service/dm-remission/lab-tracking')
  }
}
