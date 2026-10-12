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
  borrowDate: z.string().min(1, 'กรุณาระบุวันที่เริ่มยืม'),
  expectedReturnDate: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(BasketItemSchema).min(1, 'กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ'),
})

export async function GET(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'my' // 'my' | 'pending' | 'active'
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const overdueOnly = searchParams.get('overdue') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const canManage = auth.member.isAdmin || auth.member.can('manage_borrow')

    if (mode === 'pending') {
      if (!canManage) {
        return NextResponse.json({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงรายการรออนุมัติ' }, { status: 403 })
      }
      const result = await equipmentBorrowService.getPendingRequests({ search, page, limit })
      return NextResponse.json({ success: true, ...result })
    }

    if (mode === 'active') {
      if (!canManage) {
        return NextResponse.json({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงรายการกำลังยืม' }, { status: 403 })
      }
      const result = await equipmentBorrowService.getActiveLoans({ search, overdueOnly, page, limit })
      return NextResponse.json({ success: true, ...result })
    }

    if (mode === 'all') {
      if (!canManage) {
        return NextResponse.json({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงประวัติคำขอทั้งหมด' }, { status: 403 })
      }
      const result = await equipmentBorrowService.getAllBorrowRequests({ status, search, page, limit })
      return NextResponse.json({ success: true, ...result })
    }

    // Default: My requests
    const result = await equipmentBorrowService.getMyBorrowRequests(auth.member.id, {
      status,
      page,
      limit,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการโหลดคำขอยืม' },
      { status: 500 }
    )
  }
}

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
