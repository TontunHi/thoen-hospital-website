import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import {
  MemberProfileError,
  MemberProfileService,
} from '@/lib/auth/memberProfileService'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const { buffer, contentType } = await MemberProfileService.readProfileImage(
      { username: member.username },
      searchParams.get('userId')
    )

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    if (error instanceof MemberProfileError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Serve profile image error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงรูปโปรไฟล์' },
      { status: 500 }
    )
  }
}
