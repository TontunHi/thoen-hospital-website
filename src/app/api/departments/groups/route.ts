import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { departmentService } from '@/lib/departments/departmentService'
import { z } from 'zod'

const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อกลุ่มงาน').max(200),
  parentId: z.coerce.number().int().optional().nullable(),
  orderIndex: z.coerce.number().int().default(0),
})

export async function GET() {
  try {
    const tree = await departmentService.getGroupTree()
    return NextResponse.json({ success: true, data: tree })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่มงาน' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const body = await request.json()
    const parsed = createGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    const group = await departmentService.createGroup(parsed.data, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, data: group }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการสร้างกลุ่มงาน' },
      { status: 500 }
    )
  }
}
