import { NextResponse } from 'next/server'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import fs from 'fs/promises'
import path from 'path'
import { z } from 'zod'

const documentSchema = z.object({
  yearId: z.coerce.number().int(),
  parentId: z.coerce.number().int().optional().nullable(),
  title: z.string().trim().min(1, 'กรุณาระบุชื่อเอกสาร').max(500),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

async function checkManageAuth() {
  const session = await verifyMemberSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 }), session: null }
  }

  const isAuthorized = await checkPositionPermission(session.username, 'manage_ethics')
  if (!isAuthorized) {
    return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการข้อมูลชมรมจริยธรรม' }, { status: 403 }), session: null }
  }

  return { error: null, session }
}

// Helper to delete physical file if exists
async function deletePhysicalFile(filePath: string | null) {
  if (!filePath) return
  try {
    const fullPath = path.join(process.cwd(), 'public', filePath.replace(/^\//, ''))
    await fs.unlink(fullPath)
  } catch (err) {
    // Ignore error if file not found
  }
}

// POST: Upload a PDF file or create document entry
export async function POST(request: Request) {
  try {
    const { error, session } = await checkManageAuth()
    if (error || !session) return error

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
      // Validate PDF
      const ext = path.extname(file.name).toLowerCase()
      if (ext !== '.pdf' && file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'รองรับเฉพาะไฟล์เอกสาร .pdf เท่านั้น' }, { status: 400 })
      }

      // Max 25MB
      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json({ error: 'ขนาดไฟล์เกินกำหนด (สูงสุด 25MB)' }, { status: 400 })
      }

      // Target directory: public/documents/ethics/[year]/
      const targetDir = path.join(process.cwd(), 'public', 'documents', 'ethics', yearRecord.year)
      await fs.mkdir(targetDir, { recursive: true })

      const sanitizedOriginalName = path.basename(file.name, ext).replace(/[\\/:*?"<>|]/g, '_').trim()
      const uniqueName = `${Date.now()}_${sanitizedOriginalName}${ext}`
      const finalDiskPath = path.join(targetDir, uniqueName)

      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(finalDiskPath, buffer)

      filePath = `/documents/ethics/${yearRecord.year}/${uniqueName}`
      fileSize = BigInt(file.size)
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
      `เพิ่มเอกสารจริยธรรม "${title}" ปี ${yearRecord.year} โดย ${session.username}`,
      session
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
    console.error('Create ethics document error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกเอกสาร' }, { status: 500 })
  }
}

// PUT: Update an existing document (title, displayOrder, isActive, or replace file)
export async function PUT(request: Request) {
  try {
    const { error, session } = await checkManageAuth()
    if (error || !session) return error

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
      const ext = path.extname(file.name).toLowerCase()
      if (ext !== '.pdf' && file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'รองรับเฉพาะไฟล์เอกสาร .pdf เท่านั้น' }, { status: 400 })
      }

      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json({ error: 'ขนาดไฟล์เกินกำหนด (สูงสุด 25MB)' }, { status: 400 })
      }

      const targetDir = path.join(process.cwd(), 'public', 'documents', 'ethics', existing.year.year)
      await fs.mkdir(targetDir, { recursive: true })

      const sanitizedOriginalName = path.basename(file.name, ext).replace(/[\\/:*?"<>|]/g, '_').trim()
      const uniqueName = `${Date.now()}_${sanitizedOriginalName}${ext}`
      const finalDiskPath = path.join(targetDir, uniqueName)

      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(finalDiskPath, buffer)

      // Optionally delete old file if it was a generated timestamped upload
      if (existing.filePath && existing.filePath.includes(`${existing.year.year}/`)) {
        await deletePhysicalFile(existing.filePath)
      }

      filePath = `/documents/ethics/${existing.year.year}/${uniqueName}`
      fileSize = BigInt(file.size)
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
      `แก้ไขเอกสารจริยธรรม ID: ${id} ("${updated.title}") โดย ${session.username}`,
      session
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
    console.error('Update ethics document error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตเอกสาร' }, { status: 500 })
  }
}

// DELETE: Delete a document (and its children)
export async function DELETE(request: Request) {
  try {
    const { error, session } = await checkManageAuth()
    if (error || !session) return error

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
        await deletePhysicalFile(child.filePath)
      }
    }
    // Delete parent file
    if (existing.filePath) {
      await deletePhysicalFile(existing.filePath)
    }

    await prisma.ethicsDocument.delete({
      where: { id }
    })

    await logAudit(
      'DELETE',
      'ethics_documents',
      `ลบเอกสารจริยธรรม "${existing.title}" (ID: ${id}) พร้อมเอกสารย่อย โดย ${session.username}`,
      session
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
