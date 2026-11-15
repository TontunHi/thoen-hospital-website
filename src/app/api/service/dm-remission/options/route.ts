import { NextRequest, NextResponse } from 'next/server'
import { dmRemissionService } from '@/lib/clinical/dmRemissionService'
import { optionCreateSchema } from '@/lib/clinical/dmRemissionSchemas'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import {
  handleDmRemissionRouteError,
  parseJsonBody,
  requireDmRemissionSession,
} from '../_shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireDmRemissionSession()
    if (auth.response) return auth.response

    const options = await dmRemissionService.listOptions()
    const response = NextResponse.json({ success: true, data: options }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleDmRemissionRouteError(error, 'GET /api/service/dm-remission/options')
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDmRemissionSession('admin')
    if (auth.response) return auth.response

    const parsedJson = await parseJsonBody(request)
    if (parsedJson.response) return parsedJson.response

    const parsedBody = optionCreateSchema.safeParse(parsedJson.body)
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedBody.error.issues[0]?.message || 'ข้อมูลตัวเลือกไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const created = await dmRemissionService.createOption(parsedBody.data, {
      username: auth.session.username,
      email: auth.session.email,
    })

    const response = NextResponse.json({ success: true, data: created }, { status: 201 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleDmRemissionRouteError(error, 'POST /api/service/dm-remission/options')
  }
}
