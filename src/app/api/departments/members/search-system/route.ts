import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
import { resolvePublicProfilePath } from '@/lib/departments/departmentImageUtils'

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
      (rows || []).map(async (r: any) => {
        const publicProfile = await resolvePublicProfilePath(r.profilePath || r.profile_path, Number(r.id))
        return {
          id: Number(r.id),
          name: r.name ? String(r.name).trim() : '',
          position: r.position ? String(r.position).trim() : '',
          department: r.department ? String(r.department).trim() : '',
          profilePath: publicProfile,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการค้นหาบุคลากรในระบบ' },
      { status: 500 }
    )
  }
}
