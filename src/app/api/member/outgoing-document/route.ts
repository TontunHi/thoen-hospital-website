import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const documentSchema = z.object({
  year: z.string().trim().min(1, 'กรุณาระบุปีงบประมาณ (เช่น 2569)').max(10),
  label: z.string().trim().min(1, 'กรุณาระบุชื่อแสดงผล (เช่น ปีงบประมาณ 2569)').max(255),
  note: z.string().trim().max(500).optional().nullable(),
  url: z.string().trim().url('ลิงก์ Google Sheets ต้องเป็นรูปแบบ URL ที่ถูกต้อง').max(1000),
  status: z.string().trim().min(1).max(50).default('เสร็จสิ้น'),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

// GET: Fetch all documents for CMS management (including inactive)
export async function GET() {
  try {
    const { error } = await requireMemberApi({ requiredPermission: 'manage_outgoing_doc' })
    if (error) return error

    const documents = await queryMemberDb(`
      SELECT id, year, label, note, url, status, display_order AS displayOrder, is_active AS isActive, created_by AS createdBy, updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
      FROM outgoing_documents
      ORDER BY display_order ASC, year ASC
    `)

    return NextResponse.json({
      success: true,
      documents
    })
  } catch (error: any) {
    console.error('Member fetch outgoing documents error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลหนังสือส่งออก' }, { status: 500 })
  }
}

// POST: Create a new document
export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_outgoing_doc' })
    if (error || !member) return error

    const body = await request.json()
    const parsed = documentSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ')
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { year, label, note, url, status, displayOrder, isActive } = parsed.data

    const insertRes = await queryMemberDb(`
      INSERT INTO outgoing_documents (year, label, note, url, status, display_order, is_active, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [year, label, note || '', url, status, displayOrder, isActive ? 1 : 0, member.username, member.username])

    const insertId = (insertRes as any)?.insertId || (insertRes as any)?.[0]?.insertId

    const created = {
      id: insertId,
      year,
      label,
      note: note || '',
      url,
      status,
      displayOrder,
      isActive,
      createdBy: member.username,
      updatedBy: member.username,
    }

    await logAudit(
      'CREATE',
      'outgoing_documents',
      `เพิ่มลิงก์หนังสือส่งออกปีงบประมาณ ${year} (${label}) โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      document: created,
      message: 'บันทึกข้อมูลลิงก์หนังสือส่งออกสำเร็จ'
    })
  } catch (error: any) {
    console.error('Create outgoing document error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' }, { status: 500 })
  }
}

// PUT: Update an existing document
export async function PUT(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_outgoing_doc' })
    if (error || !member) return error

    const body = await request.json()
    const { id, ...dataToValidate } = body

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'รหัสเอกสาร (id) ไม่ถูกต้อง' }, { status: 400 })
    }

    const parsed = documentSchema.safeParse(dataToValidate)
    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ')
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { year, label, note, url, status, displayOrder, isActive } = parsed.data

    const existingRows = await queryMemberDb('SELECT id, year, label FROM outgoing_documents WHERE id = ? LIMIT 1', [id])
    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลรายการหนังสือส่งออกนี้' }, { status: 404 })
    }

    await queryMemberDb(`
      UPDATE outgoing_documents
      SET year = ?, label = ?, note = ?, url = ?, status = ?, display_order = ?, is_active = ?, updated_by = ?, updated_at = NOW()
      WHERE id = ?
    `, [year, label, note || '', url, status, displayOrder, isActive ? 1 : 0, member.username, id])

    const updatedRows = await queryMemberDb('SELECT * FROM outgoing_documents WHERE id = ? LIMIT 1', [id])

    await logAudit(
      'UPDATE',
      'outgoing_documents',
      `แก้ไขลิงก์หนังสือส่งออก ID: ${id} (${year} - ${label}) โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      document: updatedRows[0] || { id, year, label },
      message: 'อัปเดตข้อมูลสำเร็จ'
    })
  } catch (error: any) {
    console.error('Update outgoing document error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' }, { status: 500 })
  }
}

// DELETE: Remove a document
export async function DELETE(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_outgoing_doc' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    const id = idParam ? parseInt(idParam, 10) : null

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'รหัสเอกสาร (id) ไม่ถูกต้อง' }, { status: 400 })
    }

    const existingRows = await queryMemberDb('SELECT id, year, label FROM outgoing_documents WHERE id = ? LIMIT 1', [id])
    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการที่ต้องการลบ' }, { status: 404 })
    }
    const existing = existingRows[0]

    await queryMemberDb('DELETE FROM outgoing_documents WHERE id = ?', [id])

    await logAudit(
      'DELETE',
      'outgoing_documents',
      `ลบรายการหนังสือส่งออก ID: ${id} (${existing.year} - ${existing.label}) โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      message: 'ลบรายการสำเร็จ'
    })
  } catch (error: any) {
    console.error('Delete outgoing document error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบรายการ' }, { status: 500 })
  }
}
