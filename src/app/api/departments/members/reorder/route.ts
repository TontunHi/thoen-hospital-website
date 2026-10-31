import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { departmentService } from '@/lib/departments/departmentService'
import { z } from 'zod'

const reorderSchema = z.object({
  groupId: z.coerce.number().int().positive(),
  memberIds: z.array(z.coerce.number().int()),
})

export async function PATCH(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const body = await request.json()
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    await departmentService.reorderMembers(parsed.data.groupId, parsed.data.memberIds, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, message: 'บันทึกลำดับสมาชิกสำเร็จ' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการจัดลำดับสมาชิก' },
      { status: 500 }
    )
  }
}
