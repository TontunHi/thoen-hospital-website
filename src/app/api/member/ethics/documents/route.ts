import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { StorageValidationError } from '@/lib/storage/documentStorage'
import { z } from 'zod'
import {
  EthicsDocumentService,
  EthicsServiceError,
} from '@/lib/cms/EthicsDocumentService'
import { logger } from '@/lib/logger'

const documentSchema = z.object({
  yearId: z.coerce.number().int(),
  parentId: z.coerce.number().int().optional().nullable(),
  title: z.string().trim().min(1, 'กรุณาระบุชื่อเอกสาร').max(500),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const formData = await request.formData()
    const yearIdStr = formData.get('yearId') as string
    const parentIdStr = formData.get('parentId') as string | null
    const title = formData.get('title') as string
    const displayOrderStr = formData.get('displayOrder') as string
    const isActiveStr = formData.get('isActive') as string
    const file = formData.get('file') as File | null

    const parsed = documentSchema.safeParse({
      yearId: parseInt(yearIdStr, 10),
      parentId:
        parentIdStr && parentIdStr !== '' && parentIdStr !== 'null'
          ? parseInt(parentIdStr, 10)
          : null,
      title,
      displayOrder: displayOrderStr ? parseInt(displayOrderStr, 10) : 0,
      isActive: isActiveStr !== 'false',
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    const created = await EthicsDocumentService.createDocument(
      { ...parsed.data, file },
      { username: member.username, session: member.session }
    )

    return NextResponse.json({
      success: true,
      document: created,
      message: 'บันทึกเอกสารสำเร็จ',
    })
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof EthicsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Create ethics document error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกเอกสาร' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const formData = await request.formData()
    const idStr = formData.get('id') as string
    const title = formData.get('title') as string | null
    const displayOrderStr = formData.get('displayOrder') as string | null
    const isActiveStr = formData.get('isActive') as string | null
    const file = formData.get('file') as File | null

    const id = parseInt(idStr, 10)
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'รหัสเอกสารไม่ถูกต้อง' }, { status: 400 })
    }

    const updated = await EthicsDocumentService.updateDocument(
      {
        id,
        title,
        displayOrder: displayOrderStr ? parseInt(displayOrderStr, 10) : null,
        isActive: isActiveStr !== null ? isActiveStr !== 'false' : undefined,
        file,
      },
      { username: member.username, session: member.session }
    )

    return NextResponse.json({
      success: true,
      document: updated,
      message: 'อัปเดตข้อมูลสำเร็จ',
    })
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof EthicsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Update ethics document error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตเอกสาร' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    const id = idParam ? parseInt(idParam, 10) : null

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'รหัสเอกสารไม่ถูกต้อง' }, { status: 400 })
    }

    await EthicsDocumentService.deleteDocument(id.toString(), member.username, member.session)

    return NextResponse.json({
      success: true,
      message: 'ลบเอกสารสำเร็จ',
    })
  } catch (error) {
    if (error instanceof EthicsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Delete ethics document error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบเอกสาร' }, { status: 500 })
  }
}
