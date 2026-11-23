import { NextResponse } from 'next/server'
import { requireNewsPermission } from '@/lib/memberAuth'
import { albumCreateSchema } from '@/lib/schemas/album'
import { photoAlbumService } from '@/lib/cms/PhotoAlbumService'
import { GatewayUnavailableError } from '@/lib/apiGateway'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    if (all) {
      const authResult = await requireNewsPermission()
      if (authResult.error) return authResult.error
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '12', 10) || 12))
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const search = searchParams.get('search') || undefined

    const year = yearParam ? parseInt(yearParam, 10) : undefined
    const month = monthParam ? parseInt(monthParam, 10) : undefined

    const result = await photoAlbumService.listAlbums({
      all,
      page,
      limit,
      year: year && !Number.isNaN(year) ? year : undefined,
      month: month && !Number.isNaN(month) ? month : undefined,
      search,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logger.error({ err: error }, 'Failed to save photo album')
    if (error instanceof GatewayUnavailableError) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถเชื่อมต่อระบบฐานข้อมูลกลางได้ชั่วคราว' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการโหลดอัลบั้มภาพข่าว' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const parsed = albumCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const album = await photoAlbumService.createAlbum(parsed.data, authResult.session)
    return NextResponse.json({ success: true, album }, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'Failed to save photo album')
    if (error instanceof GatewayUnavailableError) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถเชื่อมต่อระบบฐานข้อมูลกลางได้ชั่วคราว' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกอัลบั้มภาพข่าว' },
      { status: 500 }
    )
  }
}
