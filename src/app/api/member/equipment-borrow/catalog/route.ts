import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'

export async function GET(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined
    const type = (searchParams.get('type') as any) || 'ALL'

    const items = await equipmentBorrowService.getAvailableCatalog({
      search,
      category,
      type,
    })

    return NextResponse.json({ success: true, data: items })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการโหลดรายการอุปกรณ์' },
      { status: 500 }
    )
  }
}
