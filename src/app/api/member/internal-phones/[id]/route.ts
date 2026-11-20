import { NextRequest, NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { internalPhoneUpdateSchema } from '@/lib/internalPhones/internalPhoneSchemas'
import { internalPhoneService } from '@/lib/internalPhones/internalPhoneService'
import {
  handleInternalPhoneRouteError,
  parseJsonBody,
  parsePositiveIntId,
} from '../_shared'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireMemberApi({
    requiredFeature: 'feature_internal_phones',
    requiredPermission: 'manage_internal_phones',
  })
  if (auth.error) return auth.error

  const { id: rawId } = await context.params
  const id = parsePositiveIntId(rawId)
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'รหัสรายการเบอร์โทรภายในไม่ถูกต้อง' },
      { status: 400 }
    )
  }

  const parsedJson = await parseJsonBody(request)
  if (parsedJson.response) return parsedJson.response

  const parsedBody = internalPhoneUpdateSchema.safeParse(parsedJson.body)
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
    const updated = await internalPhoneService.updatePhone(id, parsedBody.data, auth.member.session)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleInternalPhoneRouteError(error, 'PATCH /api/member/internal-phones/[id]')
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireMemberApi({
    requiredFeature: 'feature_internal_phones',
    requiredPermission: 'manage_internal_phones',
  })
  if (auth.error) return auth.error

  const { id: rawId } = await context.params
  const id = parsePositiveIntId(rawId)
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'รหัสรายการเบอร์โทรภายในไม่ถูกต้อง' },
      { status: 400 }
    )
  }

  try {
    const deleted = await internalPhoneService.deletePhone(id, auth.member.session)
    return NextResponse.json({ success: true, data: deleted })
  } catch (error) {
    return handleInternalPhoneRouteError(error, 'DELETE /api/member/internal-phones/[id]')
  }
}
