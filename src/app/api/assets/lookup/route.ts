import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { hospitalAssetService } from '@/lib/assets/assetService'

// GET: Fast lookup for assets by number or name (used by repair forms)
export async function GET(request: Request) {
  const session = await verifyMemberSession()
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() || searchParams.get('search')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ success: true, data: [] })
  }

  try {
    const result = await hospitalAssetService.getAssets({
      search: query,
      limit: 10,
    })

    const now = new Date()

    const mapped = result.items.map((item: any) => {
      const isUnderWarranty =
        (item.warrantyEndDate && new Date(item.warrantyEndDate) >= now) ||
        (!item.warrantyEndDate && item.expireDate && new Date(item.expireDate) >= now)

      return {
        id: item.id,
        articleNum: item.articleNum,
        name: item.name,
        brand: item.brand,
        model: item.model,
        serialNo: item.serialNo,
        category: item.category,
        department: item.department,
        locationId: item.locationId,
        locationFullName: item.locationFullName,
        warrantyStartDate: item.warrantyStartDate,
        warrantyEndDate: item.warrantyEndDate || item.expireDate,
        expireDate: item.expireDate,
        status: item.status,
        isUnderWarranty: Boolean(isUnderWarranty),
      }
    })

    return NextResponse.json({
      success: true,
      data: mapped,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการค้นหาครุภัณฑ์: ' + error.message },
      { status: 500 }
    )
  }
}
