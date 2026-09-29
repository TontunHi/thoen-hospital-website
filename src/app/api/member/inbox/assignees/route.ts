import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const members = await queryMemberDb(
      'SELECT id, name, position, department, email FROM members ORDER BY name ASC'
    )

    return NextResponse.json({
      success: true,
      data: members,
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}
