import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireNewsPermission } from '@/lib/memberAuth'
import { albumUpdateSchema } from '@/lib/schemas/album'
import { photoAlbumService } from '@/lib/cms/PhotoAlbumService'
import { GatewayNotFoundError, GatewayUnavailableError } from '@/lib/apiGateway'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const album = await photoAlbumService.getAlbum(id)
    if (!album) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบอัลบั้มภาพข่าวที่ต้องการ' },
        { status: 404 }
      )
    }

    if (album.status === 'DRAFT') {
      const authResult = await requireNewsPermission()
      if (authResult.error) {
        return NextResponse.json(
          { success: false, error: 'ไม่พบอัลบั้มภาพข่าวที่ต้องการ' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json({ success: true, album })
  } catch {
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการโหลดอัลบั้มภาพข่าว' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const { id } = await ctx.params
    const albumId = Number.parseInt(id, 10)
    if (Number.isNaN(albumId)) {
      return NextResponse.json({ success: false, error: 'รหัสอัลบั้มไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = albumUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const album = await photoAlbumService.updateAlbum(albumId, parsed.data, authResult.session)
    return NextResponse.json({ success: true, album })
  } catch (error) {
    if (error instanceof GatewayNotFoundError) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบอัลบั้มภาพข่าวที่ต้องการแก้ไข' },
        { status: 404 }
      )
    }
    if (error instanceof GatewayUnavailableError) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถเชื่อมต่อระบบฐานข้อมูลกลางได้ชั่วคราว' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขอัลบั้มภาพข่าว' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const { id } = await ctx.params
    const albumId = Number.parseInt(id, 10)
    if (Number.isNaN(albumId)) {
      return NextResponse.json({ success: false, error: 'รหัสอัลบั้มไม่ถูกต้อง' }, { status: 400 })
    }

    await photoAlbumService.deleteAlbum(albumId, authResult.session)
    return NextResponse.json({ success: true, message: 'ลบอัลบั้มภาพข่าวเรียบร้อยแล้ว' })
  } catch (error) {
    if (error instanceof GatewayNotFoundError) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบอัลบั้มภาพข่าวที่ต้องการลบ' },
        { status: 404 }
      )
    }
    if (error instanceof GatewayUnavailableError) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถเชื่อมต่อระบบฐานข้อมูลกลางได้ชั่วคราว' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการลบอัลบั้มภาพข่าว' },
      { status: 500 }
    )
  }
}
