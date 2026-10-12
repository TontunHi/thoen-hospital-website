import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import { z } from 'zod'

const CreateMaterialSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อวัสดุ'),
  category: z.string().optional(),
  materialType: z.enum(['REUSABLE', 'CONSUMABLE']).optional(),
  totalQty: z.number().int().min(0, 'จำนวนต้องไม่ติดลบ'),
  availableQty: z.number().int().min(0).optional(),
  unit: z.string().optional(),
  location: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined
    const materialType = searchParams.get('materialType') || undefined
    const isActiveParam = searchParams.get('isActive')
    const isActive = isActiveParam !== null ? isActiveParam === 'true' : undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await equipmentBorrowService.getMaterials({
      search,
      category,
      materialType,
      isActive,
      page,
      limit,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการโหลดรายการวัสดุ' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireMemberApi({ requiredPermission: 'manage_borrow' })
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const validated = CreateMaterialSchema.parse(body)

    const material = await equipmentBorrowService.createMaterial(validated, {
      id: auth.member.id,
      name: auth.member.name,
      username: auth.member.username,
      role: auth.member.role,
    })

    return NextResponse.json({ success: true, data: material }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการสร้างวัสดุ' },
      { status: 500 }
    )
  }
}
