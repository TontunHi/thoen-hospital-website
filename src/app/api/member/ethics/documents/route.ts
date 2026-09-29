import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { DocumentStorage, StorageValidationError } from '@/lib/storage/documentStorage'
import path from 'path'
import { z } from 'zod'

const documentSchema = z.object({
  yearId: z.coerce.number().int(),
  parentId: z.coerce.number().int().optional().nullable(),
  title: z.string().trim().min(1, 'กรุณาระบุชื่อเอกสาร').max(500),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

// POST: Upload a PDF file or create document entry
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

    const yearId = parseInt(yearIdStr, 10)
    const parentId = parentIdStr && parentIdStr !== '' && parentIdStr !== 'null' ? parseInt(parentIdStr, 10) : null
    const displayOrder = displayOrderStr ? parseInt(displayOrderStr, 10) : 0
    const isActive = isActiveStr !== 'false'

    const parsed = documentSchema.safeParse({
      yearId,
      parentId,
      title,
      displayOrder,
      isActive,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 })
    }

    const yearRecord = await prisma.ethicsYear.findUnique({
      where: { id: yearId }
    })
    if (!yearRecord) {
      return NextResponse.json({ error: 'ไม่พบปีงบประมาณที่ระบุ' }, { status: 404 })
    }

    let filePath: string | null = null
    let fileSize: bigint | null = null

    if (file && file.size > 0) {
      const saved = await DocumentStorage.save(file, {
        destinationDir: `public/documents/ethics/${yearRecord.year}`,
        allowedMimeTypes: ['application/pdf'],
        allowedExtensions: ['.pdf'],
        maxSizeBytes: 25 * 1024 * 1024,
        collisionStrategy: 'timestamp',
      })
      filePath = saved.publicUrl
      fileSize = BigInt(saved.fileSize)
    }

    const created = await prisma.ethicsDocument.create({
      data: {
        yearId,
        parentId,
        title,
        filePath,
        fileSize,
        displayOrder,
        isActive,
      }
    })

    await logAudit(
      'CREATE',
      'ethics_documents',
      `เพิ่มเอกสารจริยธรรม "${title}" ปี ${yearRecord.year} โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      document: {
        ...created,
        fileSize: created.fileSize ? created.fileSize.toString() : null
      },
      message: 'บันทึกเอกสารสำเร็จ'
    })
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Create ethics document error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกเอกสาร' }, { status: 500 })
  }
}

// PUT: Update an existing document (title, displayOrder, isActive, or replace file)
export async function PUT(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const formData = await request.formData()
    const idStr = formData.get('id') as string
    const title = formData.get('title') as string
    const displayOrderStr = formData.get('displayOrder') as string
    const isActiveStr = formData.get('isActive') as string
    const file = formData.get('file') as File | null

    const id = parseInt(idStr, 10)
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'รหัสเอกสารไม่ถูกต้อง' }, { status: 400 })
    }

    const existing = await prisma.ethicsDocument.findUnique({
      where: { id },
      include: { year: true }
    })
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบเอกสารที่ต้องการแก้ไข' }, { status: 404 })
    }

    let filePath = existing.filePath
    let fileSize = existing.fileSize

    if (file && file.size > 0) {
      const saved = await DocumentStorage.replace(existing.filePath, file, {
        destinationDir: `public/documents/ethics/${existing.year.year}`,
        allowedMimeTypes: ['application/pdf'],
        allowedExtensions: ['.pdf'],
        maxSizeBytes: 25 * 1024 * 1024,
        collisionStrategy: 'timestamp',
      })
      filePath = saved.publicUrl
      fileSize = BigInt(saved.fileSize)
    }

    const updated = await prisma.ethicsDocument.update({
      where: { id },
      data: {
        title: title || existing.title,
        displayOrder: displayOrderStr ? parseInt(displayOrderStr, 10) : existing.displayOrder,
        isActive: isActiveStr !== undefined ? isActiveStr !== 'false' : existing.isActive,
        filePath,
        fileSize,
      }
    })

    await logAudit(
      'UPDATE',
      'ethics_documents',
      `แก้ไขเอกสารจริยธรรม ID: ${id} ("${updated.title}") โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      document: {
        ...updated,
        fileSize: updated.fileSize ? updated.fileSize.toString() : null
      },
      message: 'อัปเดตข้อมูลสำเร็จ'
    })
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Update ethics document error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตเอกสาร' }, { status: 500 })
  }
}

// DELETE: Delete a document (and its children)
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

    const existing = await prisma.ethicsDocument.findUnique({
      where: { id },
      include: { children: true }
    })
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบเอกสารที่ต้องการลบ' }, { status: 404 })
    }

    // Delete child files
    for (const child of existing.children) {
      if (child.filePath) {
        await DocumentStorage.delete(child.filePath)
      }
    }
    // Delete parent file
    if (existing.filePath) {
      await DocumentStorage.delete(existing.filePath)
    }

    await prisma.ethicsDocument.delete({
      where: { id }
    })

    await logAudit(
      'DELETE',
      'ethics_documents',
      `ลบเอกสารจริยธรรม "${existing.title}" (ID: ${id}) พร้อมเอกสารย่อย โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      message: 'ลบเอกสารสำเร็จ'
    })
  } catch (error: any) {
    console.error('Delete ethics document error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบเอกสาร' }, { status: 500 })
  }
}

