import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { departmentService } from '@/lib/departments/departmentService'
import { z } from 'zod'

const updateRoleSchema = z.object({
  name: z.string().trim().min(1, 'ชื่อบทบาทไม่สามารถเว้นว่างได้').max(100).optional(),
  orderIndex: z.coerce.number().int().optional(),
  isDefault: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const { id } = await context.params
    const roleId = parseInt(id, 10)
    if (isNaN(roleId)) {
      return NextResponse.json({ success: false, error: 'รหัสบทบาทไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateRoleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    await departmentService.updateRole(roleId, parsed.data, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, message: 'อัปเดตบทบาทสำเร็จ' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขบทบาท' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const { id } = await context.params
    const roleId = parseInt(id, 10)
    if (isNaN(roleId)) {
      return NextResponse.json({ success: false, error: 'รหัสบทบาทไม่ถูกต้อง' }, { status: 400 })
    }

    await departmentService.deleteRole(roleId, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, message: 'ลบบทบาทสำเร็จ' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบบทบาท' },
      { status: 500 }
    )
  }
}
