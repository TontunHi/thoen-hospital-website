import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'
import { TaskPermissionService } from '@/lib/permissions/taskPermissionService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET: Retrieve all tasks, roles, assigned members, and assigned positions
export async function GET() {
  try {
    const auth = await requireRole(['admin'])
    if (auth.error) return auth.error

    const data = await TaskPermissionService.getTaskCentricData()

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    logger.error({ error }, 'Fetch task-centric permissions error')
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์ตามงาน' },
      { status: 500 }
    )
  }
}
