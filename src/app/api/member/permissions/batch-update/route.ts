import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'
import { TaskPermissionService } from '@/lib/permissions/taskPermissionService'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const batchSchema = z.object({
  updates: z
    .array(
      z.object({
        memberId: z.number().int().positive('รหัสสมาชิกต้องเป็นจำนวนเต็มบวก'),
        permissions: z.array(z.string()),
      })
    )
    .min(1, 'ต้องมีข้อมูลอย่างน้อย 1 รายการ'),
})

// POST: Atomically update permissions for multiple members in a single transaction
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

    const parseResult = batchSchema.safeParse(body)
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

    const result = await TaskPermissionService.batchUpdateMemberPermissions({
      updates: parseResult.data.updates,
      performedBy: auth.session.username,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    logger.error({ error }, 'Batch update member permissions error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์' },
      { status: 500 }
    )
  }
}
