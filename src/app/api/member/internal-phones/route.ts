import { NextRequest, NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import {
  internalPhoneCreateSchema,
  internalPhoneQuerySchema,
} from '@/lib/internalPhones/internalPhoneSchemas'
import { internalPhoneService } from '@/lib/internalPhones/internalPhoneService'
import { handleInternalPhoneRouteError, parseJsonBody } from './_shared'

export async function GET(request: NextRequest) {
  const auth = await requireMemberApi({ requiredFeature: 'feature_internal_phones' })
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const parsedQuery = internalPhoneQuerySchema.safeParse({
    building: searchParams.get('building') ?? undefined,
    floor: searchParams.get('floor') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    includeInactive: searchParams.get('includeInactive') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsedQuery.error.issues.map((issue) => issue.message).join(', '),
      },
      { status: 400 }
    )
  }

  try {
    const result = await internalPhoneService.listPhones(parsedQuery.data)
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return handleInternalPhoneRouteError(error, 'GET /api/member/internal-phones')
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMemberApi({
    requiredFeature: 'feature_internal_phones',
    requiredPermission: 'manage_internal_phones',
  })
  if (auth.error) return auth.error

  const parsedJson = await parseJsonBody(request)
  if (parsedJson.response) return parsedJson.response

  const parsedBody = internalPhoneCreateSchema.safeParse(parsedJson.body)
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsedBody.error.issues.map((issue) => issue.message).join(', '),
      },
      { status: 400 }
    )
  }

  try {
    const created = await internalPhoneService.createPhone(parsedBody.data, auth.member.session)
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    return handleInternalPhoneRouteError(error, 'POST /api/member/internal-phones')
  }
}
