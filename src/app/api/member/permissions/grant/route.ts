import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'
import { TaskPermissionService } from '@/lib/permissions/taskPermissionService'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const grantSchema = z.object({
  type: z.enum(['member', 'position']),
  permissionKey: z.string().min(1, 'ต้องระบุรหัสสิทธิ์'),
  memberId: z.number().int().positive().optional(),
  positionName: z.string().min(1).optional(),
})

// POST: Grant permission to a member or position
export async function POST(request: Request) {
  try {
    const auth = await requireRole(['admin'])
    if (auth.error) return auth.error
    const session = auth.session

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'รูปแบบข้อมูล JSON ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const parseResult = grantSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ถูกต้อง', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { type, permissionKey, memberId, positionName } = parseResult.data

    let result
    if (type === 'member') {
      if (!memberId) {
        return NextResponse.json(
          { success: false, error: 'กรุณาระบุรหัสบุคลากร (memberId)' },
          { status: 400 }
        )
      }
      result = await TaskPermissionService.grantMemberPermission(session, memberId, permissionKey)
    } else {
      if (!positionName || !positionName.trim()) {
        return NextResponse.json(
          { success: false, error: 'กรุณาระบุชื่อตำแหน่ง (positionName)' },
          { status: 400 }
        )
      }
      result = await TaskPermissionService.grantPositionPermission(session, positionName, permissionKey)
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    })
  } catch (error: any) {
    logger.error({ error }, 'Grant permission error')
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มสิทธิ์' },
      { status: 500 }
    )
  }
}
