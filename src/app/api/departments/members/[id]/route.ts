import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { departmentService } from '@/lib/departments/departmentService'
import { z } from 'zod'

const updateMemberSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อ-นามสกุล').max(255).optional(),
  position: z.string().trim().min(1, 'กรุณาระบุตำแหน่ง').max(200).optional(),
  role: z.enum(['leader', 'member']).optional(),
  orderIndex: z.coerce.number().int().optional(),
  imagePath: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  memberId: z.coerce.number().int().optional().nullable(),
})

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const { id } = await context.params
    const memberId = parseInt(id, 10)
    if (isNaN(memberId)) {
      return NextResponse.json({ success: false, error: 'รหัสสมาชิกไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    await departmentService.updateMember(memberId, parsed.data, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, message: 'อัปเดตข้อมูลสมาชิกสำเร็จ' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลสมาชิก' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const { id } = await context.params
    const memberId = parseInt(id, 10)
    if (isNaN(memberId)) {
      return NextResponse.json({ success: false, error: 'รหัสสมาชิกไม่ถูกต้อง' }, { status: 400 })
    }

    await departmentService.deleteMember(memberId, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, message: 'ลบสมาชิกสำเร็จ' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบสมาชิก' },
      { status: 400 }
    )
  }
}
