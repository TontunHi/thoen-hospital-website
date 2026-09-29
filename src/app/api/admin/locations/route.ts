import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

// GET: Fetch locations for admin management (with pagination, filters, and stats)
export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าถึงส่วนนี้' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const buildingId = searchParams.get('buildingId')
    const status = searchParams.get('status') // 'active', 'inactive', or 'all'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    let whereClauses: string[] = []
    const queryParams: any[] = []

    if (status === 'active') {
      whereClauses.push('is_active = 1')
    } else if (status === 'inactive') {
      whereClauses.push('is_active = 0')
    }

    if (buildingId) {
      whereClauses.push('building_id = ?')
      queryParams.push(buildingId)
    }

    if (search) {
      whereClauses.push('(room_name LIKE ? OR building_name LIKE ? OR floor_name LIKE ? OR full_name LIKE ?)')
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // Count Total
    const countRows = await queryMemberDb(
      `SELECT COUNT(*) as total FROM hospital_locations ${whereSql}`,
      queryParams
    )
    const total = countRows[0]?.total || 0

    // Fetch Items
    const items = await queryMemberDb(
      `SELECT id, room_name, floor_id, floor_name, building_id, building_name, full_name, is_active, updated_at 
       FROM hospital_locations 
       ${whereSql} 
       ORDER BY building_name ASC, floor_id ASC, room_name ASC 
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )

    // Distinct Buildings for dropdown filter
    const buildings = await queryMemberDb(
      `SELECT DISTINCT building_id, building_name 
       FROM hospital_locations 
       ORDER BY building_name ASC`
    )

    // Distinct Building + Floors for modal selector
    const buildingFloors = await queryMemberDb(
      `SELECT DISTINCT building_id, building_name, floor_id, floor_name 
       FROM hospital_locations 
       ORDER BY building_name ASC, floor_name ASC`
    )

    // Overall stats
    const statsRows = await queryMemberDb(`
      SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeCount,
        COUNT(DISTINCT building_id) as buildingCount
      FROM hospital_locations
    `)
    const stats = statsRows[0] || { totalCount: 0, activeCount: 0, buildingCount: 0 }

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        buildings,
        buildingFloors,
        stats: {
          totalCount: Number(stats.totalCount) || 0,
          activeCount: Number(stats.activeCount) || 0,
          buildingCount: Number(stats.buildingCount) || 0,
        },
      },
    })
  } catch (error: any) {
    console.error('Admin locations GET error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่' }, { status: 500 })
  }
}

// POST: Create New Location
export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { room_name, floor_id, floor_name, building_id, building_name, is_active } = body

    if (!room_name?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อห้อง / หน่วยงาน' }, { status: 400 })
    }
    if (!building_name?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่ออาคาร / ตึก' }, { status: 400 })
    }
    if (!floor_name?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชั้น' }, { status: 400 })
    }

    // Determine ID (get MAX(id) + 1)
    const maxRows = await queryMemberDb('SELECT COALESCE(MAX(id), 0) as maxId FROM hospital_locations')
    const newId = Number(maxRows[0]?.maxId || 0) + 1

    let finalBuildingId = building_id ? Number(building_id) : 0
    let finalFloorId = floor_id ? Number(floor_id) : 0

    // If new building or floor, assign suitable IDs
    if (!finalBuildingId) {
      const maxBRows = await queryMemberDb('SELECT COALESCE(MAX(building_id), 0) as maxB FROM hospital_locations')
      finalBuildingId = Number(maxBRows[0]?.maxB || 0) + 1
    }
    if (!finalFloorId) {
      const maxFRows = await queryMemberDb('SELECT COALESCE(MAX(floor_id), 0) as maxF FROM hospital_locations')
      finalFloorId = Number(maxFRows[0]?.maxF || 0) + 1
    }

    const trimmedRoom = room_name.trim()
    const trimmedFloor = floor_name.trim()
    const trimmedBuilding = building_name.trim()
    const fullName = `${trimmedBuilding} ${trimmedFloor} (${trimmedRoom})`
    const activeVal = is_active === false || is_active === 0 ? 0 : 1

    await queryMemberDb(
      `INSERT INTO hospital_locations (id, room_name, floor_id, floor_name, building_id, building_name, full_name, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [newId, trimmedRoom, finalFloorId, trimmedFloor, finalBuildingId, trimmedBuilding, fullName, activeVal]
    )

    return NextResponse.json({
      success: true,
      message: 'เพิ่มข้อมูลสถานที่สำเร็จ',
      data: {
        id: newId,
        room_name: trimmedRoom,
        floor_id: finalFloorId,
        floor_name: trimmedFloor,
        building_id: finalBuildingId,
        building_name: trimmedBuilding,
        full_name: fullName,
        is_active: activeVal,
      },
    })
  } catch (error: any) {
    console.error('Admin locations POST error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message }, { status: 500 })
  }
}

// PATCH: Edit location details or toggle active status
export async function PATCH(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น' }, { status: 403 })
    }

    const body = await request.json()
    const { id, is_active, room_name, floor_id, floor_name, building_id, building_name } = body

    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุรหัสสถานที่ (ID)' }, { status: 400 })
    }

    // Fetch existing
    const existing = await queryMemberDb('SELECT * FROM hospital_locations WHERE id = ?', [id])
    if (existing.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสถานที่ที่ต้องการแก้ไข' }, { status: 404 })
    }

    const current = existing[0]

    // Fast toggle active status
    if (is_active !== undefined && room_name === undefined && building_name === undefined) {
      await queryMemberDb(
        'UPDATE hospital_locations SET is_active = ?, updated_at = NOW() WHERE id = ?',
        [is_active ? 1 : 0, id]
      )
      return NextResponse.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' })
    }

    // Full or partial updates
    const targetRoom = room_name !== undefined ? room_name.trim() : current.room_name
    const targetBuildingName = building_name !== undefined ? building_name.trim() : current.building_name
    const targetFloorName = floor_name !== undefined ? floor_name.trim() : current.floor_name
    const targetBuildingId = building_id !== undefined ? Number(building_id) : current.building_id
    const targetFloorId = floor_id !== undefined ? Number(floor_id) : current.floor_id
    const targetIsActive = is_active !== undefined ? (is_active ? 1 : 0) : current.is_active

    const targetFullName = `${targetBuildingName} ${targetFloorName} (${targetRoom})`

    await queryMemberDb(
      `UPDATE hospital_locations 
       SET room_name = ?, 
           floor_id = ?, 
           floor_name = ?, 
           building_id = ?, 
           building_name = ?, 
           full_name = ?, 
           is_active = ?, 
           updated_at = NOW() 
       WHERE id = ?`,
      [
        targetRoom,
        targetFloorId,
        targetFloorName,
        targetBuildingId,
        targetBuildingName,
        targetFullName,
        targetIsActive,
        id,
      ]
    )

    return NextResponse.json({
      success: true,
      message: 'แก้ไขข้อมูลสถานที่สำเร็จ',
      data: {
        id,
        room_name: targetRoom,
        floor_id: targetFloorId,
        floor_name: targetFloorName,
        building_id: targetBuildingId,
        building_name: targetBuildingName,
        full_name: targetFullName,
        is_active: targetIsActive,
      },
    })
  } catch (error: any) {
    console.error('Admin locations PATCH error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล: ' + error.message }, { status: 500 })
  }
}

// DELETE: Remove location by ID
export async function DELETE(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุรหัสสถานที่ (ID) ที่ต้องการลบ' }, { status: 400 })
    }

    const check = await queryMemberDb('SELECT id, full_name FROM hospital_locations WHERE id = ?', [id])
    if (check.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสถานที่ที่ต้องการลบ' }, { status: 404 })
    }

    await queryMemberDb('DELETE FROM hospital_locations WHERE id = ?', [id])

    return NextResponse.json({
      success: true,
      message: `ลบข้อมูลสถานที่ "${check[0].full_name}" สำเร็จเรียบร้อย`,
    })
  } catch (error: any) {
    console.error('Admin locations DELETE error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message }, { status: 500 })
  }
}
