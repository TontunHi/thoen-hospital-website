import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import { z } from 'zod'

const ToggleLoanableSchema = z.object({
  assetId: z.number().int().positive('รหัสครุภัณฑ์ไม่ถูกต้อง'),
  isLoanable: z.boolean(),
})

export async function GET(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined
    const isLoanableParam = searchParams.get('isLoanable')
    const isLoanable = isLoanableParam !== null ? isLoanableParam === 'true' : true
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await equipmentBorrowService.getLoanableAssets({
      search,
      category,
      isLoanable,
      page,
      limit,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการโหลดครุภัณฑ์' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireMemberApi({ requiredPermission: 'manage_borrow' })
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { assetId, isLoanable } = ToggleLoanableSchema.parse(body)

    const updated = await equipmentBorrowService.toggleAssetLoanable(assetId, isLoanable, {
      id: auth.member.id,
      name: auth.member.name,
      username: auth.member.username,
      role: auth.member.role,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการปรับสถานะครุภัณฑ์' },
      { status: 500 }
    )
  }
}
