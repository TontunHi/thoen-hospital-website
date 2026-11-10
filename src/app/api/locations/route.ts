import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'

// GET /api/locations?search=...&buildingId=...
export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const buildingId = searchParams.get('buildingId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(1000, Math.max(1, parseInt(limitParam, 10))) : 500

    const res = await apiGateway.app.getLocations({
      search,
      buildingId: buildingId || undefined,
      limit,
      detailed: false,
    })

    return NextResponse.json({
      success: true,
      data: res.data || res || [],
    })
  } catch (error: any) {
    console.error('Fetch locations error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่' }, { status: 500 })
  }
}
