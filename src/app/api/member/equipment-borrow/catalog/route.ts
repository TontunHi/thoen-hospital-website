import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import { getErrorMessage } from '@/lib/http/apiResponse'

export async function GET(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined
    const rawType = searchParams.get('type')
    const type: 'ALL' | 'ASSET' | 'MATERIAL' =
      rawType === 'ASSET' || rawType === 'MATERIAL' ? rawType : 'ALL'

    const items = await equipmentBorrowService.getAvailableCatalog({
      search,
      category,
      type,
    })

    return NextResponse.json({ success: true, data: items })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'เกิดข้อผิดพลาดในการโหลดรายการอุปกรณ์') },
      { status: 500 }
    )
  }
}
