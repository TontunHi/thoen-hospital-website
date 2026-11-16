import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { dmRemissionLabService } from '@/lib/clinical/dmRemissionLabService'
import { labTrackingHnParamSchema } from '@/lib/clinical/dmRemissionSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import { handleDmRemissionRouteError, requireDmRemissionSession } from '../../_shared'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ hn: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireDmRemissionSession('view')
    if (auth.response) return auth.response

    const { hn: rawHn } = await context.params
    const parsedHn = labTrackingHnParamSchema.safeParse(rawHn)
    if (!parsedHn.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedHn.error.issues[0]?.message || 'รูปแบบ HN ไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const timeline = await dmRemissionLabService.getPatientLabTimeline(parsedHn.data)
    if (!timeline) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลผู้ป่วยตาม HN ที่ระบุในระบบ HOSxP' },
        { status: 404 }
      )
    }

    const maskedHnSuffix = timeline.hn.length > 4 ? `xxxx${timeline.hn.slice(-4)}` : 'xxxx'
    await logAudit(
      'READ',
      'dm_remission_lab_timeline',
      `Viewed DM lab & prescription timeline (${maskedHnSuffix})`,
      auth.session
    )

    const response = NextResponse.json(
      { success: true, data: timeline },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleDmRemissionRouteError(
      error,
      'GET /api/service/dm-remission/lab-tracking/[hn]'
    )
  }
}
