import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logger } from '@/lib/logger'
import {
  readMemberSignatureImage,
  SignatureServiceError,
} from '@/lib/auth/memberSignatureService'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const fileBuffer = await readMemberSignatureImage(session, {
      path: searchParams.get('path'),
      userId: searchParams.get('userId'),
    })

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    if (error instanceof SignatureServiceError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      )
    }
    logger.error({ err: error }, 'Serve signature image failed')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงรูปภาพลายเซ็น' },
      { status: 500 }
    )
  }
}
