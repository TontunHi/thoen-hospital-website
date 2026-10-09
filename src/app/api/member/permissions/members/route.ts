import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'
import { TaskPermissionService } from '@/lib/permissions/taskPermissionService'
import { logger } from '@/lib/logger'

// GET: Retrieve list of members with their individual permissions
export async function GET(request: Request) {
  try {
    const auth = await requireRole(['admin'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || searchParams.get('query')?.trim() || ''
    const department = searchParams.get('department')?.trim() || undefined
    const hasPermissionsOnlyParam = searchParams.get('hasPermissionsOnly')
    const hasPermissionsOnly =
      hasPermissionsOnlyParam === 'true' || hasPermissionsOnlyParam === '1'

    const result = await TaskPermissionService.listMembersWithPermissions({
      query: search || undefined,
      department,
      hasPermissionsOnly,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Fetch member permissions error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์บุคลากร' },
      { status: 500 }
    )
  }
}
