import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

// GET: Fetch list of members eligible to receive IT tasks
export async function GET() {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const ITStaff = await queryMemberDb(
      `SELECT id, name, position 
       FROM members 
       WHERE position LIKE '%คอมพิวเตอร์%' 
          OR position LIKE '%ดิจิทัล%' 
          OR position LIKE '%สารสนเทศ%' 
          OR role = 'admin' 
       ORDER BY name ASC`
    )

    return NextResponse.json({ success: true, staff: ITStaff })
  } catch (error: any) {
    console.error('Fetch assignees error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลเจ้าหน้าที่' }, { status: 500 })
  }
}
