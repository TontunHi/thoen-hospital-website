import { NextResponse } from 'next/server'
import { registrationService } from '@/lib/registration/registrationService.default'
import { handleRegisterRequest } from '@/lib/registration/registerHttp'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const res = await handleRegisterRequest(
    body ?? {},
    (input) => registrationService.submit(input),
    (context, message) => logger.error(context, message)
  )
  return NextResponse.json(res.body, { status: res.status, headers: res.headers })
}
