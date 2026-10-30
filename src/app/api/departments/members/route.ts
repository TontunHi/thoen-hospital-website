import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { departmentService } from '@/lib/departments/departmentService'
import { z } from 'zod'

const createMemberSchema = z.object({
  groupId: z.coerce.number().int().positive('กรุณาระบุกลุ่มงาน'),
  name: z.string().trim().min(1, 'กรุณาระบุชื่อ-นามสกุล').max(255),
  position: z.string().trim().min(1, 'กรุณาระบุตำแหน่ง').max(200),
  role: z.enum(['leader', 'member']).default('member'),
  orderIndex: z.coerce.number().int().default(0),
  imagePath: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  memberId: z.coerce.number().int().optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const groupIdStr = searchParams.get('groupId')
    if (!groupIdStr) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ groupId' }, { status: 400 })
    }
    const groupId = parseInt(groupIdStr, 10)
    if (isNaN(groupId)) {
      return NextResponse.json({ success: false, error: 'groupId ไม่ถูกต้อง' }, { status: 400 })
    }

    // Check if authenticated member to allow seeing internal phone
    let isInternal = false
    try {
      const { member } = await requireMemberApi()
      if (member) isInternal = true
    } catch {
      isInternal = false
    }

    const members = await departmentService.getMembersByGroupId(groupId, { isPublic: !isInternal })
    return NextResponse.json({ success: true, data: members })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const body = await request.json()
    const parsed = createMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    const created = await departmentService.createMember(parsed.data, {
      id: member.id,
      name: member.name
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มสมาชิก' },
      { status: 500 }
    )
  }
}
