import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { departmentService } from '@/lib/departments/departmentService'
import { z } from 'zod'
import { getErrorMessage } from '@/lib/http/apiResponse'

const createRoleSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อบทบาท').max(100),
  orderIndex: z.coerce.number().int().optional(),
  isDefault: z.boolean().optional(),
})

export async function GET() {
  try {
    const roles = await departmentService.getRoles()
    return NextResponse.json({ success: true, data: roles })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'เกิดข้อผิดพลาดในการดึงข้อมูลระดับบทบาท') },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const body = await request.json()
    const parsed = createRoleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    const created = await departmentService.createRole(parsed.data, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'เกิดข้อผิดพลาดในการสร้างระดับบทบาท') },
      { status: 500 }
    )
  }
}
