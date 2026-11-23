import { NextRequest } from 'next/server'
import { handleOnlineMediaUploadPost } from '@/lib/media/onlineMediaUploadHelper'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return handleOnlineMediaUploadPost(request)
}
