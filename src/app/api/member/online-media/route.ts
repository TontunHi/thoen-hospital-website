import { NextRequest, NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import {
  OnlineMediaService,
  OnlineMediaValidationError,
  OnlineMediaNotFoundError,
} from '@/lib/media/onlineMediaService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_online_media' })
    if (error || !member) return error

    const [categories, items] = await Promise.all([
      OnlineMediaService.listCategories({ includeInactive: true, isAuthenticated: true }),
      OnlineMediaService.listMediaItems({
        visibility: 'ALL',
        includeUnpublished: true,
        isAuthenticated: true,
      }),
    ])

    const stats = {
      total: items.length,
      publicCount: items.filter((i) => i.visibility === 'PUBLIC').length,
      internalCount: items.filter((i) => i.visibility === 'INTERNAL').length,
      totalViews: items.reduce((sum, i) => sum + i.viewCount, 0),
    }

    return NextResponse.json(
      {
        success: true,
        data: { categories, items, stats },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    logger.error({ error }, 'Fetch admin online media error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลจัดการสื่อออนไลน์' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_online_media' })
    if (error || !member) return error

    const body = await request.json()
    const actor = {
      id: member.id,
      username: member.username,
      email: member.email,
      name: member.name,
    }

    if (body?.action === 'save_category') {
      const category = await OnlineMediaService.saveCategory(body, actor)
      return NextResponse.json({ success: true, data: { category } }, { status: 201 })
    }

    const item = await OnlineMediaService.createMediaItem(body, actor)
    return NextResponse.json({ success: true, data: { item } }, { status: 201 })
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
    logger.error({ error }, 'Create online media error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกสื่อออนไลน์' },
      { status: 500 }
    )
  }
}
