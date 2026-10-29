import { GET as providerIdCallbackHandler } from '@/app/api/auth/provider-id/callback/route'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return providerIdCallbackHandler(request)
}
