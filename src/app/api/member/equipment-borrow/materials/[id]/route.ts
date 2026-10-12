import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import { z } from 'zod'

const UpdateMaterialSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อวัสดุ').optional(),
  category: z.string().optional(),
  materialType: z.enum(['REUSABLE', 'CONSUMABLE']).optional(),
  totalQty: z.number().int().min(0).optional(),
  availableQty: z.number().int().min(0).optional(),
  unit: z.string().optional(),
  location: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMemberApi({ requiredPermission: 'manage_borrow' })
  if (auth.error) return auth.error

  try {
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'รหัสวัสดุไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json()
    const validated = UpdateMaterialSchema.parse(body)

    const updated = await equipmentBorrowService.updateMaterial(id, validated, {
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
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขวัสดุ' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMemberApi({ requiredPermission: 'manage_borrow' })
  if (auth.error) return auth.error

  try {
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'รหัสวัสดุไม่ถูกต้อง' }, { status: 400 })
    }

    const result = await equipmentBorrowService.deleteMaterial(id, {
      id: auth.member.id,
      name: auth.member.name,
      username: auth.member.username,
      role: auth.member.role,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบวัสดุ' },
      { status: 500 }
    )
  }
}
