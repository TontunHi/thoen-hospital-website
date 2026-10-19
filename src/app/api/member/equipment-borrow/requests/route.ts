import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import { z } from 'zod'

const BasketItemSchema = z.object({
  itemType: z.enum(['ASSET', 'MATERIAL']),
  assetId: z.number().nullable().optional(),
  materialId: z.number().nullable().optional(),
  itemName: z.string().min(1, 'ต้องระบุชื่ออุปกรณ์'),
  itemCode: z.string().nullable().optional(),
  quantity: z.number().int().min(1, 'จำนวนต้องมากกว่า 0'),
})

const CreateBorrowRequestSchema = z.object({
  purpose: z.string().min(1, 'กรุณาระบุวัตถุประสงค์ในการยืม'),
  location: z.string().nullable().optional(),
  borrowDate: z.string({ message: 'กรุณาระบุวันที่เริ่มยืม' }).min(1, 'กรุณาระบุวันที่เริ่มยืม'),
  expectedReturnDate: z.string({ message: 'กรุณาระบุวันที่คาดว่าจะส่งคืน' }).min(1, 'กรุณาระบุวันที่คาดว่าจะส่งคืน'),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(BasketItemSchema).min(1, 'กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ'),
})

/**
 * Task-based Route: Create New Equipment / Material Borrow Request
 * Access: Any authenticated hospital member
 */
export async function POST(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const validated = CreateBorrowRequestSchema.parse(body)

    const borrowRequest = await equipmentBorrowService.createBorrowRequest(
      validated,
      {
        id: auth.member.id,
        name: auth.member.name || auth.member.username,
        department: auth.member.department,
      }
    )

    return NextResponse.json({ success: true, data: borrowRequest }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการบันทึกคำขอยืม' },
      { status: 400 }
    )
  }
}
