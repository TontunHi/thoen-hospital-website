import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

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

    let where = 'WHERE is_active = 1'
    const params: any[] = []

    if (buildingId) {
      where += ' AND building_id = ?'
      params.push(buildingId)
    }

    if (search) {
      where += ' AND (room_name LIKE ? OR building_name LIKE ? OR full_name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(1000, Math.max(1, parseInt(limitParam, 10))) : 500

    const locations = await queryMemberDb(
      `SELECT id, room_name, floor_id, floor_name, building_id, building_name, full_name 
       FROM hospital_locations 
       ${where} 
       ORDER BY building_name ASC, floor_id ASC, room_name ASC 
       LIMIT ${limit}`,
      params
    )

    return NextResponse.json({
      success: true,
      data: locations,
    })
  } catch (error: any) {
    console.error('Fetch locations error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่' }, { status: 500 })
  }
}
