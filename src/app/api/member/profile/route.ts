import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { StorageValidationError } from '@/lib/storage/documentStorage'
import {
  MemberProfileError,
  MemberProfileService,
} from '@/lib/auth/memberProfileService'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    const result = await MemberProfileService.uploadProfilePicture(
      { username: member.username, email: member.email },
      file
    )

    return NextResponse.json({
      success: true,
      message: 'อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว',
      path: result.path,
    })
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof MemberProfileError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Upload profile picture error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปโหลดรูปโปรไฟล์' },
      { status: 500 }
    )
  }
}
