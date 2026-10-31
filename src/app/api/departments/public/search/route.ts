import { NextResponse } from 'next/server'
import { departmentService } from '@/lib/departments/departmentService'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const staffList = await departmentService.searchStaff(q)
    return NextResponse.json({ success: true, data: staffList })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการค้นหาบุคลากร' },
      { status: 500 }
    )
  }
}
