import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
import { logger } from '@/lib/logger'

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
    const buildingId = searchParams.get('buildingId') || undefined
    const status = (searchParams.get('status') || 'all') as 'active' | 'inactive' | 'all'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const res = await apiGateway.app.getLocations({
      search,
      buildingId,
      status,
      page,
      limit,
      detailed: true,
    })

    const data = res?.data ?? res

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Admin locations GET error')
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

    const res = await apiGateway.app.createLocation({
      room_name,
      floor_id: floor_id ? Number(floor_id) : undefined,
      floor_name,
      building_id: building_id ? Number(building_id) : undefined,
      building_name,
      is_active,
    })

    const resMessage = (r: unknown): string | undefined =>
      r && typeof r === 'object' && 'message' in r && typeof (r as { message?: unknown }).message === 'string'
        ? (r as { message: string }).message
        : undefined

    const payload = res && typeof res === 'object' && 'success' in res
      ? res
      : { success: true, message: resMessage(res) || 'เพิ่มข้อมูลสถานที่สำเร็จ', data: res }

    return NextResponse.json(payload)
  } catch (error: unknown) {
    logger.error({ error }, 'Admin locations POST error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' }, { status: 500 })
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

    const res = await apiGateway.app.updateLocation(id, {
      is_active,
      room_name,
      floor_id: floor_id !== undefined ? Number(floor_id) : undefined,
      floor_name,
      building_id: building_id !== undefined ? Number(building_id) : undefined,
      building_name,
    })

    const resMessage =
      res && typeof res === 'object' && 'message' in res && typeof (res as { message?: unknown }).message === 'string'
        ? (res as { message: string }).message
        : undefined

    const payload = res && typeof res === 'object' && 'success' in res
      ? res
      : { success: true, message: resMessage || 'แก้ไขข้อมูลสถานที่สำเร็จ', data: res }

    return NextResponse.json(payload)
  } catch (error: unknown) {
    logger.error({ error }, 'Admin locations PATCH error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' }, { status: 500 })
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

    const res = await apiGateway.app.deleteLocation(id)

    const resMessage =
      res && typeof res === 'object' && 'message' in res && typeof (res as { message?: unknown }).message === 'string'
        ? (res as { message: string }).message
        : undefined

    const payload = res && typeof res === 'object' && 'success' in res
      ? res
      : { success: true, message: resMessage || 'ลบข้อมูลสถานที่สำเร็จ', data: res }

    return NextResponse.json(payload)
  } catch (error: unknown) {
    logger.error({ error }, 'Admin locations DELETE error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูล' }, { status: 500 })
  }
}
