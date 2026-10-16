import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import { EthicsDocumentService } from '@/lib/cms/EthicsDocumentService'

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

    const safeYears = await EthicsDocumentService.getYears()

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

    const existingRows = await queryMemberDb('SELECT id FROM ethics_years WHERE year = ?', [year])
    if (existingRows.length > 0) {
      return NextResponse.json({ error: `ปีงบประมาณ ${year} มีอยู่ในระบบแล้ว` }, { status: 400 })
    }

    const res: any = await queryMemberDb(
      'INSERT INTO ethics_years (year, display_order, is_active, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [year, displayOrder, isActive ? 1 : 0]
    )

    const createdId = res?.insertId || res?.[0]?.insertId

    await logAudit(
      'CREATE',
      'ethics_years',
      `เพิ่มปีงบประมาณชมรมจริยธรรม ${year} โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      year: {
        id: createdId,
        year,
        displayOrder,
        isActive
      },
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

    await queryMemberDb(
      'UPDATE ethics_years SET year = ?, display_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [year, displayOrder, isActive ? 1 : 0, id]
    )

    await logAudit(
      'UPDATE',
      'ethics_years',
      `แก้ไขปีงบประมาณชมรมจริยธรรม ID: ${id} (${year}) โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      year: {
        id,
        year,
        displayOrder,
        isActive
      },
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

    const existingRows = await queryMemberDb('SELECT id, year FROM ethics_years WHERE id = ?', [id])
    const existing = existingRows[0]
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบปีงบประมาณที่ต้องการลบ' }, { status: 404 })
    }

    await queryMemberDb('DELETE FROM ethics_documents WHERE year_id = ?', [id])
    await queryMemberDb('DELETE FROM ethics_years WHERE id = ?', [id])

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
