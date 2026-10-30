import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { departmentService } from '@/lib/departments/departmentService'
import { z } from 'zod'

const reorderGroupsSchema = z.object({
  groupIds: z.array(z.coerce.number().int()).min(1, 'ต้องมีรหัสกลุ่มงานอย่างน้อย 1 รายการ'),
})

export async function PATCH(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const body = await request.json()
    const parsed = reorderGroupsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    await departmentService.reorderGroups(parsed.data.groupIds, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, message: 'บันทึกลำดับกลุ่มงานสำเร็จ' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการจัดลำดับกลุ่มงาน' },
      { status: 500 }
    )
  }
}
