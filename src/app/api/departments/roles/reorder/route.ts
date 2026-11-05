import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { departmentService } from '@/lib/departments/departmentService'
import { z } from 'zod'

const reorderRolesSchema = z.object({
  roleIds: z.array(z.coerce.number().int()).min(1, 'ต้องมีรหัสบทบาทอย่างน้อย 1 รายการ'),
})

export async function PATCH(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const body = await request.json()
    const parsed = reorderRolesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    await departmentService.reorderRoles(parsed.data.roleIds, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, message: 'บันทึกลำดับระดับบทบาทสำเร็จ' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการจัดลำดับบทบาท' },
      { status: 500 }
    )
  }
}
