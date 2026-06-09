import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { heroSlideSchema } from '@/lib/schemas/heroSlide'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(request: Request, props: any) {
  try {
    const authResult = await requireMemberAdmin()
    if (authResult.error) return authResult.error

    const resolvedParams = await props.params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 })
    }

    // Find slide to get the file path
    const slide = await prisma.heroSlide.findUnique({
      where: { id },
    })

    if (!slide) {
      return NextResponse.json({ error: 'ไม่พบสไลด์ภาพที่ต้องการลบ' }, { status: 404 })
    }

    // Try deleting file from disk
    try {
      if (slide.imagePath) {
        const absolutePath = path.join(process.cwd(), 'public', slide.imagePath)
        await unlink(absolutePath)
        console.log('Successfully deleted slide file from disk:', absolutePath)
      }
    } catch (fsError: any) {
      console.warn('Failed to delete slide file from disk, it might not exist:', fsError.message)
    }

    // Delete record from Database
    await prisma.heroSlide.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'ลบสไลด์ภาพเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Delete slide error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบสไลด์ภาพ' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, props: any) {
  try {
    const authResult = await requireMemberAdmin()
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

    const { imagePath, title, linkUrl, startDate, endDate, displayOrder } = parsed.data

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Check if slide exists
    const existingSlide = await prisma.heroSlide.findUnique({
      where: { id }
    })
    if (!existingSlide) {
      return NextResponse.json({ error: 'ไม่พบสไลด์ภาพที่ต้องการแก้ไข' }, { status: 404 })
    }

    // Update record in Database
    const slide = await prisma.heroSlide.update({
      where: { id },
      data: {
        imagePath,
        title: title || null,
        linkUrl: linkUrl || null,
        startDate: start,
        endDate: end,
        displayOrder: displayOrder || 0,
      },
    })

    return NextResponse.json({ success: true, slide })
  } catch (error: any) {
    console.error('Update slide error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขสไลด์ภาพ' },
      { status: 500 }
    )
  }
}
