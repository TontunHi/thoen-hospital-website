import { NextResponse } from 'next/server'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { LtcRegistryService } from '@/lib/clinical/ltcRegistryService'
import { logger } from '@/lib/logger'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, error: 'Forbidden: คุณไม่มีสิทธิ์แก้ไขข้อมูลในทะเบียน Long Term Care (LTC)' },
        { status: 403 }
      )
    }

    const { id } = await params
    const recordId = Number(id)
    if (!recordId || isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: 'Bad Request: ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const updated = await LtcRegistryService.updateRegistry(
      recordId,
      body,
      {
        username: session.username,
        email: session.email,
      }
    )

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error: any) {
    logger.error({ error: error?.message }, 'API PUT /api/service/dashboard-rcm/palliative-care/ltc-registry/[id] Error')
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล LTC' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    const member = await fetchAuthenticatedMember(session.username, session.email)
    const canDelete = member?.isAdmin || member?.can('manage_ltc_registry')
    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: คุณไม่มีสิทธิ์ลบข้อมูลในทะเบียน Long Term Care (LTC)' },
        { status: 403 }
      )
    }

    const { id } = await params
    const recordId = Number(id)
    if (!recordId || isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: 'Bad Request: ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    await LtcRegistryService.deleteRegistry(recordId, {
      username: session.username,
      email: session.email,
    })

    return NextResponse.json({
      success: true,
      message: 'ลบข้อมูลทะเบียน LTC สำเร็จ',
    })
  } catch (error: any) {
    logger.error({ error: error?.message }, 'API DELETE /api/service/dashboard-rcm/palliative-care/ltc-registry/[id] Error')
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการลบข้อมูล LTC' },
      { status: 400 }
    )
  }
}
