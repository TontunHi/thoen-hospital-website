import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSession, requireMemberApi } from '@/lib/memberAuth'
import { KpiService } from '@/lib/kpi/kpiService'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบ' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const topicIdStr = searchParams.get('topicId')
    if (!topicIdStr) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'กรุณาระบุ topicId' } },
        { status: 400 }
      )
    }

    const topicId = parseInt(topicIdStr, 10)
    const fiscalYear = searchParams.get('fiscalYear') || undefined
    const category = searchParams.get('category') || undefined
    const frequency = searchParams.get('frequency') || undefined
    const responsibleName = searchParams.get('responsibleName') || undefined
    const search = searchParams.get('search') || undefined
    const periodKey = searchParams.get('periodKey') || undefined

    const [indicators, categories, responsiblePersons] = await Promise.all([
      KpiService.getIndicators({
        topicId,
        fiscalYear,
        category,
        frequency,
        responsibleName,
        search,
        periodKey,
      }),
      KpiService.getCategories(topicId),
      KpiService.getResponsiblePersons(topicId),
    ])

    return NextResponse.json({
      success: true,
      data: {
        indicators,
        categories,
        responsiblePersons,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลตัวชี้วัด' } },
      { status: 500 }
    )
  }
}

const indicatorSchema = z.object({
  topicId: z.number().int().positive(),
  sequence: z.string().nullable().optional(),
  category: z.string().min(1, 'กรุณาระบุหมวดตัวชี้วัด'),
  subcategory: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  oldCode: z.string().nullable().optional(),
  frequency: z.string().min(1, 'กรุณาระบุความถี่'),
  title: z.string().min(1, 'กรุณาระบุชื่อตัวชี้วัด / คำถามหลัก'),
  numeratorName: z.string().nullable().optional(),
  denominatorName: z.string().nullable().optional(),
  targetRaw: z.string().nullable().optional(),
  targetOperator: z.string().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  targetUnit: z.string().nullable().optional(),
  responsibleName: z.string().nullable().optional(),
  indicatorType: z.string().nullable().optional(),
  displayOrder: z.number().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    if (!member.isAdmin && !member.can('manage_kpi')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'เฉพาะผู้ดูแลระบบหรือศูนย์คุณภาพเท่านั้นที่สามารถเพิ่มตัวชี้วัดได้' } },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = indicatorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const newId = await KpiService.createIndicator({
      ...parsed.data,
      createdByName: member.name || member.username,
    })

    return NextResponse.json({
      success: true,
      data: { id: newId },
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_FAILED', message: err.message || 'เพิ่มตัวชี้วัดไม่สำเร็จ' } },
      { status: 500 }
    )
  }
}

const updateSchema = indicatorSchema.partial().extend({
  id: z.number().int().positive(),
})

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    if (!member.isAdmin && !member.can('manage_kpi')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'เฉพาะผู้ดูแลระบบหรือศูนย์คุณภาพเท่านั้นที่สามารถแก้ไขข้อมูลตัวชี้วัดได้' } },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    // Check if indicator exists
    const existing = await KpiService.getIndicatorById(parsed.data.id)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบตัวชี้วัดที่ระบุ' } },
        { status: 404 }
      )
    }

    await KpiService.updateIndicator({
      ...parsed.data,
      updatedByName: member.name || member.username,
    })

    return NextResponse.json({
      success: true,
      message: 'บันทึกการแก้ไขเรียบร้อยแล้ว',
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: err.message || 'แก้ไขตัวชี้วัดไม่สำเร็จ' } },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    if (!member.isAdmin && !member.can('manage_kpi')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'เฉพาะผู้ดูแลระบบหรือศูนย์คุณภาพเท่านั้นที่สามารถลบตัวชี้วัดได้' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const idStr = searchParams.get('id')
    if (!idStr) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'กรุณาระบุ id' } },
        { status: 400 }
      )
    }

    const id = parseInt(idStr, 10)
    const existing = await KpiService.getIndicatorById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบตัวชี้วัดที่ระบุ' } },
        { status: 404 }
      )
    }

    await KpiService.deleteIndicator(id, member.name || member.username)

    return NextResponse.json({
      success: true,
      message: 'ลบตัวชี้วัดเรียบร้อยแล้ว',
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: err.message || 'ลบตัวชี้วัดไม่สำเร็จ' } },
      { status: 500 }
    )
  }
}
