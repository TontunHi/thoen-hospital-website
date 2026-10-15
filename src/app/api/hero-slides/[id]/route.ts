import { NextResponse } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
import { requireNewsPermission } from '@/lib/memberAuth'
import { heroSlideSchema } from '@/lib/schemas/heroSlide'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { logAudit } from '@/lib/audit'

interface RouteProps {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, props: RouteProps) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const resolvedParams = await props.params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 })
    }

    // Find slide to get the file path
    const slideRows = await queryMemberDb('SELECT id, title, image_path AS imagePath FROM hero_slides WHERE id = ? LIMIT 1', [id])
    if (slideRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบสไลด์ภาพที่ต้องการลบ' }, { status: 404 })
    }
    const slide = slideRows[0]

    // Delete file safely from storage seam
    if (slide.imagePath) {
      await DocumentStorage.delete(slide.imagePath)
    }

    // Delete record from Database
    await queryMemberDb('DELETE FROM hero_slides WHERE id = ?', [id])

    // Re-index remaining slides to 1..N sequentially so no gaps exist
    const remainingSlides = await queryMemberDb(`
      SELECT id, display_order AS displayOrder
      FROM hero_slides
      ORDER BY display_order ASC, created_at DESC
    `)

    for (let i = 0; i < remainingSlides.length; i++) {
      if (remainingSlides[i].displayOrder !== i + 1) {
        await queryMemberDb('UPDATE hero_slides SET display_order = ? WHERE id = ?', [i + 1, remainingSlides[i].id])
      }
    }

    await logAudit(
      'DELETE',
      'hero_slides',
      `ลบสไลด์หัวเว็บ ID ${id}: ${slide.title || 'ไม่มีหัวข้อ'} (${slide.imagePath})`,
      authResult.session
    )

    return NextResponse.json({ success: true, message: 'ลบสไลด์ภาพเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Delete slide error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบสไลด์ภาพ' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, props: RouteProps) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const resolvedParams = await props.params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = heroSlideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { imagePath, title, linkUrl, startDate, endDate, displayOrder, duration } = parsed.data

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Check if slide exists
    const existingRows = await queryMemberDb('SELECT id, image_path AS imagePath FROM hero_slides WHERE id = ? LIMIT 1', [id])
    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบสไลด์ภาพที่ต้องการแก้ไข' }, { status: 404 })
    }
    const existingSlide = existingRows[0]

    // If image path changed, clean up previous file safely
    if (existingSlide.imagePath && existingSlide.imagePath !== imagePath) {
      await DocumentStorage.delete(existingSlide.imagePath)
    }

    // Update record in Database
    await queryMemberDb(`
      UPDATE hero_slides
      SET image_path = ?, title = ?, link_url = ?, start_date = ?, end_date = ?, display_order = ?, duration = ?, updated_at = NOW()
      WHERE id = ?
    `, [imagePath, title || null, linkUrl || null, start, end, displayOrder || 0, duration || 6, id])

    const slide = {
      id,
      imagePath,
      title: title || null,
      linkUrl: linkUrl || null,
      startDate: start,
      endDate: end,
      displayOrder: displayOrder || 0,
      duration: duration || 6,
    }

    await logAudit(
      'UPDATE',
      'hero_slides',
      `แก้ไขสไลด์หัวเว็บ ID ${id}: ${title || 'ไม่มีหัวข้อ'} (${imagePath.endsWith('.mp4') ? 'วิดีโอ MP4' : 'รูปภาพ'})`,
      authResult.session
    )

    return NextResponse.json({ success: true, slide })
  } catch (error: any) {
    console.error('Update slide error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขสไลด์ภาพ' },
      { status: 500 }
    )
  }
}
