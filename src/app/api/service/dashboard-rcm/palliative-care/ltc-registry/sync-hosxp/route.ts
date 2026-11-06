import { NextResponse } from 'next/server'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { LtcRegistryService } from '@/lib/clinical/ltcRegistryService'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    const member = await fetchAuthenticatedMember(session.username, session.email)
    const canManage = member?.isAdmin || member?.can('manage_ltc_registry') || member?.can('edit_ltc_registry')
    if (!canManage) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: คุณไม่มีสิทธิ์จัดการข้อมูลในทะเบียน Long Term Care (LTC)' },
        { status: 403 }
      )
    }

    let recordId: number | undefined
    try {
      const body = await request.json()
      if (body?.recordId) {
        recordId = Number(body.recordId)
      }
    } catch {
      // No JSON body or empty body = sync all
    }

    const result = await LtcRegistryService.syncWithHosxp(recordId, {
      username: session.username,
      email: session.email,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `ซิงค์และตรวจสอบข้อมูลกับ HOSxP เรียบร้อยแล้ว (ตรวจสอบ ${result.totalChecked} ราย, อัปเดต ${result.updatedCount} ราย)`,
    })
  } catch (error: any) {
    logger.error({ error: error?.message }, 'API POST sync-hosxp Error')
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลกับ HOSxP' },
      { status: 500 }
    )
  }
}
