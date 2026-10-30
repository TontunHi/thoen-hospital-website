import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const kw = `%${q}%`
    const rows = await queryMemberDb(
      `SELECT id, name, position, department, profile_path AS profilePath
       FROM members
       WHERE name LIKE ? OR department LIKE ? OR position LIKE ?
       ORDER BY name ASC
       LIMIT 20`,
      [kw, kw, kw]
    )

    return NextResponse.json({
      success: true,
      data: rows.map((r: any) => ({
        id: Number(r.id),
        name: r.name ? String(r.name).trim() : '',
        position: r.position ? String(r.position).trim() : '',
        department: r.department ? String(r.department).trim() : '',
        profilePath: r.profilePath ? String(r.profilePath).trim() : null
      }))
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการค้นหาบุคลากรในระบบ' },
      { status: 500 }
    )
  }
}
