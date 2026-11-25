import { NextResponse } from 'next/server'
import { departmentService } from '@/lib/departments/departmentService'
import { getErrorMessage } from '@/lib/http/apiResponse'

export async function GET() {
  try {
    const orgChart = await departmentService.getPublicOrgChart()
    return NextResponse.json({ success: true, data: orgChart })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'เกิดข้อผิดพลาดในการดึงข้อมูลผังองค์กร') },
      { status: 500 }
    )
  }
}
