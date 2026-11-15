import { NextRequest, NextResponse } from 'next/server'
import { dmRemissionService } from '@/lib/clinical/dmRemissionService'
import { carryoverSchema } from '@/lib/clinical/dmRemissionSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import {
  handleDmRemissionRouteError,
  parseJsonBody,
  requireDmRemissionSession,
} from '../_shared'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDmRemissionSession('manage')
    if (auth.response) return auth.response

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = carryoverSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลปีงบประมาณไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const result = await dmRemissionService.carryoverFromFiscalYear(
      parsedBody.data.fromFiscalYear,
      parsedBody.data.toFiscalYear,
      { username: auth.session.username, email: auth.session.email }
    )

    const response = NextResponse.json({ success: true, data: result }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleDmRemissionRouteError(error, 'POST /api/service/dm-remission/carryover')
  }
}
