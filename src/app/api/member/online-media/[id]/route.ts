import { NextRequest, NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import {
  OnlineMediaService,
  OnlineMediaValidationError,
  OnlineMediaNotFoundError,
} from '@/lib/media/onlineMediaService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_online_media' })
    if (error || !member) return error

    const { id } = await params
    const numericId = parseInt(id, 10)
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ success: false, error: 'รหัสสื่อไม่ถูกต้อง' }, { status: 400 })
    }

    const [item, viewers] = await Promise.all([
      OnlineMediaService.getMediaItemForManage(numericId),
      OnlineMediaService.listMediaViewers(numericId),
    ])

    if (!item) {
      return NextResponse.json({ success: false, error: 'ไม่พบรายการสื่อที่ระบุ' }, { status: 404 })
    }

    return NextResponse.json(
      { success: true, data: { item, viewers } },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    logger.error({ error }, 'Get online media detail/viewers error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสื่อออนไลน์' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_online_media' })
    if (error || !member) return error

    const { id } = await params
    const numericId = parseInt(id, 10)
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ success: false, error: 'รหัสสื่อไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json()
    const item = await OnlineMediaService.updateMediaItem(numericId, body, {
      id: member.id,
      username: member.username,
      email: member.email,
      name: member.name,
    })

    return NextResponse.json({ success: true, data: { item } })
  } catch (error: unknown) {
    const errObj = error as { name?: string; message?: string; status?: number }
    if (
      error instanceof OnlineMediaValidationError ||
      error instanceof OnlineMediaNotFoundError ||
      errObj?.name === 'OnlineMediaValidationError' ||
      errObj?.name === 'OnlineMediaNotFoundError'
    ) {
      return NextResponse.json(
        { success: false, error: errObj?.message || 'ข้อมูลสื่อออนไลน์ไม่ถูกต้อง' },
        { status: errObj?.status || 400 }
      )
    }
    logger.error({ error }, 'Update online media error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลสื่อออนไลน์' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_online_media' })
    if (error || !member) return error

    const { id } = await params
    const numericId = parseInt(id, 10)
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ success: false, error: 'รหัสไม่ถูกต้อง' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const actor = {
      id: member.id,
      username: member.username,
      email: member.email,
      name: member.name,
    }

    if (type === 'category') {
      await OnlineMediaService.deleteCategory(numericId, actor)
    } else {
      await OnlineMediaService.deleteMediaItem(numericId, actor)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errObj = error as { name?: string; message?: string; status?: number }
    if (
      error instanceof OnlineMediaValidationError ||
      error instanceof OnlineMediaNotFoundError ||
      errObj?.name === 'OnlineMediaValidationError' ||
      errObj?.name === 'OnlineMediaNotFoundError'
    ) {
      return NextResponse.json(
        { success: false, error: errObj?.message || 'ข้อมูลสื่อออนไลน์ไม่ถูกต้อง' },
        { status: errObj?.status || 400 }
      )
    }
    logger.error({ error }, 'Delete online media error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการลบข้อมูล' },
      { status: 500 }
    )
  }
}
