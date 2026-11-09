import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let members: any[] = []
    if (typeof apiGateway.app.getMembers === 'function') {
      try {
        const res = await apiGateway.app.getMembers()
        const rawList = Array.isArray(res) ? res : (res as any)?.data || []
        if (Array.isArray(rawList) && rawList.length > 0) {
          members = rawList
            .map((m: any) => ({
              id: m.id,
              name: m.name,
              position: m.position,
              department: m.department,
              email: m.email,
            }))
            .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'th'))
        }
      } catch {
        // Fallback to queryMemberDb
      }
    }

    if (members.length === 0) {
      members = await queryMemberDb(
        'SELECT id, name, position, department, email FROM members ORDER BY name ASC'
      )
    }

    return NextResponse.json({
      success: true,
      data: members,
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}
