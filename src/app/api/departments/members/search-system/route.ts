import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
import { resolvePublicProfilePath } from '@/lib/departments/departmentImageUtils'
import { getErrorMessage } from '@/lib/http/apiResponse'

export async function GET(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const rows = await apiGateway.app.getMembers({ search: q, limit: 20 })

    const data = await Promise.all(
      (rows || []).map(async (r: Record<string, unknown>) => {
        const rawProfile =
          typeof r.profilePath === 'string'
            ? r.profilePath
            : typeof r.profile_path === 'string'
              ? r.profile_path
              : null
        const publicProfile = await resolvePublicProfilePath(rawProfile, Number(r.id))
        return {
          id: Number(r.id),
          name: typeof r.name === 'string' ? r.name.trim() : (r.name ? String(r.name).trim() : ''),
          position: typeof r.position === 'string' ? r.position.trim() : (r.position ? String(r.position).trim() : ''),
          department: typeof r.department === 'string' ? r.department.trim() : (r.department ? String(r.department).trim() : ''),
          profilePath: publicProfile,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'เกิดข้อผิดพลาดในการค้นหาบุคลากรในระบบ') },
      { status: 500 }
    )
  }
}
