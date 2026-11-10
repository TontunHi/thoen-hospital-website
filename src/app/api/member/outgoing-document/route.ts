import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
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

    const documents = await apiGateway.app.getOutgoingDocuments({ activeOnly: false, order: 'manager' })

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

    const res = await apiGateway.app.createOutgoingDocument({
      year,
      label,
      note: note || '',
      url,
      status,
      displayOrder,
      isActive,
      createdBy: member.username,
      updatedBy: member.username,
    })

    await logAudit(
      'CREATE',
      'outgoing_documents',
      `เพิ่มลิงก์หนังสือส่งออกปีงบประมาณ ${year} (${label}) โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      document: res.document,
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

    const res = await apiGateway.app.updateOutgoingDocument(id, {
      year,
      label,
      note: note || '',
      url,
      status,
      displayOrder,
      isActive,
      updatedBy: member.username,
    })

    await logAudit(
      'UPDATE',
      'outgoing_documents',
      `แก้ไขลิงก์หนังสือส่งออก ID: ${id} (${year} - ${label}) โดย ${member.username}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      document: res.document || { id, year, label },
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

    const res = await apiGateway.app.deleteOutgoingDocument(id)
    const existing = res.document || { year: '', label: '' }

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
