import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'
import { TaskPermissionService } from '@/lib/permissions/taskPermissionService'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const updateSchema = z.object({
  memberId: z.number().int().positive('รหัสสมาชิกต้องเป็นจำนวนเต็มบวก'),
  permissions: z.array(z.string().max(100, 'ชื่อสิทธิ์ต้องไม่เกิน 100 ตัวอักษร')),
})

// POST: Atomically update individual permissions for a specific member
export async function POST(request: Request) {
  try {
    const auth = await requireRole(['admin'])
    if (auth.error) return auth.error

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const parseResult = updateSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'ข้อมูลไม่ถูกต้อง',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      )
    }

    const result = await TaskPermissionService.updateMemberPermissions({
      memberId: parseResult.data.memberId,
      permissions: parseResult.data.permissions,
      performedBy: auth.session.username,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    logger.error({ error }, 'Update member permissions error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์' },
      { status: 500 }
    )
  }
}
