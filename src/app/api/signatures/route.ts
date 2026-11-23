import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logger } from '@/lib/logger'
import {
  getMemberSignatureStatus,
  saveMemberSignature,
  SignatureServiceError,
} from '@/lib/auth/memberSignatureService'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const status = await getMemberSignatureStatus(session)
    return NextResponse.json({
      success: true,
      ...status,
    })
  } catch (error) {
    if (error instanceof SignatureServiceError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      )
    }
    logger.error({ err: error }, 'Fetch signature status failed')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลลายเซ็น' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const body = (await request.json()) as { imageBase64?: unknown }
    const result = await saveMemberSignature(session, body?.imageBase64)

    return NextResponse.json({
      success: true,
      message: 'บันทึกลายเซ็นเรียบร้อยแล้ว',
      path: result.path,
    })
  } catch (error) {
    if (error instanceof SignatureServiceError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      )
    }
    logger.error({ err: error }, 'Save signature failed')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกลายเซ็น' },
      { status: 500 }
    )
  }
}
