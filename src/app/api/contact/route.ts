import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/roles'
import { contactCreateSchema, contactUpdateSchema } from '@/lib/schemas/contact'
import { checkRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    // Require admin session to view citizen contact submissions
    const authResult = await requireRole(['admin'])
    if (authResult.error) return authResult.error

    const contacts = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ contacts })
  } catch (error) {
    logger.error({ error }, 'GET contacts error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อความ' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const rateCheck = await checkRateLimit({ key: 'contact-form', maxAttempts: 5, windowSeconds: 900 })
    if (!rateCheck.allowed) return rateCheck.response!

    const body = await request.json()
    const { name, email, phone, message } = body

    const parsed = contactCreateSchema.safeParse({ name, email, phone, message })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const newContact = await prisma.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        message: parsed.data.message,
      },
    })

    return NextResponse.json(
      { success: true, message: 'ส่งข้อความเรียบร้อยแล้ว', contact: newContact },
      { status: 201 }
    )
  } catch (error) {
    logger.error({ error }, 'Contact submit error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการส่งข้อความ' },
      { status: 500 }
    )
  }
}

// PUT to mark as read or update status
export async function PUT(request: Request) {
  try {
    const authResult = await requireRole(['admin'])
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { id, isRead } = body

    const parsed = contactUpdateSchema.safeParse({ id, isRead })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const updated = await prisma.contactMessage.update({
      where: { id: parsed.data.id },
      data: {
        isRead: parsed.data.isRead !== undefined ? parsed.data.isRead : true,
      },
    })

    return NextResponse.json({ success: true, contact: updated })
  } catch (error) {
    logger.error({ error }, 'PUT contact error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขสถานะข้อความ' },
      { status: 500 }
    )
  }
}

// DELETE to remove a contact message
export async function DELETE(request: Request) {
  try {
    const authResult = await requireRole(['admin'])
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const idStr = searchParams.get('id')

    if (!idStr) {
      return NextResponse.json(
        { error: 'กรุณาระบุ ID ของข้อความที่ต้องการลบ' },
        { status: 400 }
      )
    }

    const id = parseInt(idStr)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    await prisma.contactMessage.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'DELETE contact error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อความ' },
      { status: 500 }
    )
  }
}
