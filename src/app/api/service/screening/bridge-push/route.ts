import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { smartCardBridgeHub } from '@/lib/screening/smartCardBridgeHub'

const cardSchema = z.object({
  cid: z.string().min(13),
  titleTh: z.string().optional(),
  firstNameTh: z.string().optional(),
  lastNameTh: z.string().optional(),
  fullNameTh: z.string().optional(),
  titleEn: z.string().optional(),
  firstNameEn: z.string().optional(),
  lastNameEn: z.string().optional(),
  fullNameEn: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  photo: z.string().optional(),
  issuer: z.string().optional(),
  issueDate: z.string().optional(),
  expireDate: z.string().optional(),
  rawPayload: z.record(z.string(), z.any()).optional(),
})

const pushSchema = z.object({
  station: z.string().default('1'),
  action: z.enum(['heartbeat', 'card_read', 'card_removed']),
  reader: z.string().optional(),
  cardPresent: z.boolean().optional(),
  card: cardSchema.optional(),
})

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-bridge-token') || req.nextUrl.searchParams.get('token')
  if (!smartCardBridgeHub.verifyToken(token)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing bridge secret token' } },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    const parsed = pushSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message } },
        { status: 400 }
      )
    }

    const result = smartCardBridgeHub.handlePush(parsed.data)
    return NextResponse.json({ success: result.success })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Error processing bridge push' } },
      { status: 500 }
    )
  }
}
