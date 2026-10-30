import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { departmentService } from '@/lib/departments/departmentService'
import { z } from 'zod'

const updateGroupSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อกลุ่มงาน').max(200).optional(),
  parentId: z.coerce.number().int().optional().nullable(),
  orderIndex: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const { id } = await context.params
    const groupId = parseInt(id, 10)
    if (isNaN(groupId)) {
      return NextResponse.json({ success: false, error: 'รหัสกลุ่มงานไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    await departmentService.updateGroup(groupId, parsed.data, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, message: 'อัปเดตข้อมูลกลุ่มงานสำเร็จ' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการอัปเดตกลุ่มงาน' },
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
    const groupId = parseInt(id, 10)
    if (isNaN(groupId)) {
      return NextResponse.json({ success: false, error: 'รหัสกลุ่มงานไม่ถูกต้อง' }, { status: 400 })
    }

    await departmentService.deleteGroup(groupId, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, message: 'ลบกลุ่มงานสำเร็จ' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบกลุ่มงาน' },
      { status: 400 }
    )
  }
}
