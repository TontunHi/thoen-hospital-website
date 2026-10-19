import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import { z } from 'zod'

const ReturnItemSchema = z.object({
  itemId: z.number().int().positive(),
  returnedQty: z.number().int().min(0, 'จำนวนที่ส่งคืนต้องไม่ติดลบ'),
  condition: z.enum(['NORMAL', 'DAMAGED', 'LOST']).default('NORMAL'),
  notes: z.string().nullable().optional(),
})

const ProcessReturnSchema = z.object({
  returns: z.array(ReturnItemSchema).default([]),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMemberApi({ requiredPermission: 'manage_borrow' })
  if (auth.error) return auth.error

  try {
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json()
    const { returns } = ProcessReturnSchema.parse(body)

    const updated = await equipmentBorrowService.processItemReturn(id, returns, {
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
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการบันทึกตรวจรับคืน' },
      { status: 400 }
    )
  }
}
