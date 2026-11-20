import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { OnlineMediaService } from '@/lib/media/onlineMediaService'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  visibility: z.enum(['PUBLIC', 'INTERNAL', 'ALL']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  mediaType: z.enum(['VIDEO', 'INFOGRAPHIC', 'DOCUMENT']).optional(),
  search: z.string().trim().max(200).optional(),
})

export async function GET(request: NextRequest) {
  try {
    let isAuthenticated = false
    try {
      const session = await verifyMemberSession()
      isAuthenticated = Boolean(session)
    } catch {
      isAuthenticated = false
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      visibility: searchParams.get('visibility') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      mediaType: searchParams.get('mediaType') || undefined,
      search: searchParams.get('search') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'พารามิเตอร์การค้นหาไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const [categories, items] = await Promise.all([
      OnlineMediaService.listCategories({ isAuthenticated }),
      OnlineMediaService.listMediaItems({
        ...parsed.data,
        isAuthenticated,
      }),
    ])

    return NextResponse.json(
      {
        success: true,
        data: {
          categories,
          items,
          isAuthenticated,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Fetch online media list error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการโหลดคลังสื่อออนไลน์' },
      { status: 500 }
    )
  }
}
