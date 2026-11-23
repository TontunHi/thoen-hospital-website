import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { TaskPermissionService } from '@/lib/permissions/taskPermissionService'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const { error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const { mappings, availablePositions } =
      await TaskPermissionService.listPositionPermissions()

    return NextResponse.json({
      success: true,
      mappings,
      availablePositions,
    })
  } catch (error) {
    logger.error({ err: error }, 'Fetch permissions error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const { permission_key, position_name } = (await request.json()) as {
      permission_key?: string
      position_name?: string
    }

    if (!permission_key || !position_name || !position_name.trim()) {
      return NextResponse.json(
        { error: 'กรุณาระบุสิทธิ์และชื่อตำแหน่งงาน' },
        { status: 400 }
      )
    }

    await TaskPermissionService.addPositionPermissionMapping(
      permission_key,
      position_name
    )

    return NextResponse.json({
      success: true,
      message: 'เพิ่มสิทธิ์สำหรับตำแหน่งสำเร็จ',
    })
  } catch (error) {
    logger.error({ err: error }, 'Add permission error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มสิทธิ์' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const { searchParams } = new URL(request.url)
    const permissionKey = searchParams.get('permission_key')
    const positionName = searchParams.get('position_name')

    if (!permissionKey || !positionName) {
      return NextResponse.json({ error: 'พารามิเตอร์ไม่ครบถ้วน' }, { status: 400 })
    }

    await TaskPermissionService.removePositionPermissionMapping(
      permissionKey,
      positionName
    )

    return NextResponse.json({
      success: true,
      message: 'ลบสิทธิ์สำหรับตำแหน่งสำเร็จ',
    })
  } catch (error) {
    logger.error({ err: error }, 'Delete permission error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบสิทธิ์' },
      { status: 500 }
    )
  }
}
