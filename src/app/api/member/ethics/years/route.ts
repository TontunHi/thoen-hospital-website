import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const yearSchema = z.object({
  year: z.string().trim().min(1, 'กรุณาระบุปีงบประมาณ เช่น 2570').max(10),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

// GET: Fetch all years and their documents for Member CMS
export async function GET() {
  try {
    const { error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error) return error

    const years = await prisma.ethicsYear.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { year: 'desc' }
      ],
      include: {
        documents: {
          orderBy: [
            { displayOrder: 'asc' },
            { id: 'asc' }
          ]
        }
      }
    })

    const safeYears = years.map((y: any) => ({
      ...y,
      documents: y.documents.map((d: any) => ({
        ...d,
        fileSize: d.fileSize ? d.fileSize.toString() : null
      }))
    }))


    return NextResponse.json({
      success: true,
      years: safeYears
    })
  } catch (error: any) {

    console.error('Member fetch ethics error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}

// POST: Create a new year
export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const body = await request.json()
    const parsed = yearSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 })
    }

    const { year, displayOrder, isActive } = parsed.data

    const existing = await prisma.ethicsYear.findUnique({
      where: { year }
    })
    if (existing) {
      return NextResponse.json({ error: `ปีงบประมาณ ${year} มีอยู่ในระบบแล้ว` }, { status: 400 })
    }

    const created = await prisma.ethicsYear.create({
      data: {
        year,
        displayOrder,
        isActive
      }
    })

    await logAudit(
      'CREATE',
      'ethics_years',
      `เพิ่มปีงบประมาณชมรมจริยธรรม ${year} โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      year: created,
      message: 'เพิ่มปีงบประมาณสำเร็จ'
    })
  } catch (error: any) {
    console.error('Create ethics year error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างปีงบประมาณ' }, { status: 500 })
  }
}

// PUT: Update an existing year
export async function PUT(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const body = await request.json()
    const { id, ...dataToValidate } = body

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'รหัสปีงบประมาณ (id) ไม่ถูกต้อง' }, { status: 400 })
    }

    const parsed = yearSchema.safeParse(dataToValidate)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 })
    }

    const { year, displayOrder, isActive } = parsed.data

    const updated = await prisma.ethicsYear.update({
      where: { id },
      data: {
        year,
        displayOrder,
        isActive
      }
    })

    await logAudit(
      'UPDATE',
      'ethics_years',
      `แก้ไขปีงบประมาณชมรมจริยธรรม ID: ${id} (${year}) โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      year: updated,
      message: 'อัปเดตข้อมูลปีงบประมาณสำเร็จ'
    })
  } catch (error: any) {
    console.error('Update ethics year error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดต' }, { status: 500 })
  }
}

// DELETE: Delete a year (Cascade deletes its documents)
export async function DELETE(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    const id = idParam ? parseInt(idParam, 10) : null

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'รหัสปีงบประมาณไม่ถูกต้อง' }, { status: 400 })
    }

    const existing = await prisma.ethicsYear.findUnique({
      where: { id }
    })
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบปีงบประมาณที่ต้องการลบ' }, { status: 404 })
    }

    await prisma.ethicsYear.delete({
      where: { id }
    })

    await logAudit(
      'DELETE',
      'ethics_years',
      `ลบปีงบประมาณชมรมจริยธรรม ${existing.year} (ID: ${id}) พร้อมเอกสารทั้งหมด โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      message: `ลบปีงบประมาณ ${existing.year} เรียบร้อยแล้ว`
    })
  } catch (error: any) {
    console.error('Delete ethics year error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบปีงบประมาณ' }, { status: 500 })
  }
}
