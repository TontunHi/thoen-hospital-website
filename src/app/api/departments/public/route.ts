import { NextResponse } from 'next/server'
import { departmentService } from '@/lib/departments/departmentService'

export async function GET() {
  try {
    const orgChart = await departmentService.getPublicOrgChart()
    return NextResponse.json({ success: true, data: orgChart })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลผังองค์กร' },
      { status: 500 }
    )
  }
}
