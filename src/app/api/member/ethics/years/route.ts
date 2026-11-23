import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { z } from 'zod'
import {
  EthicsDocumentService,
  EthicsServiceError,
} from '@/lib/cms/EthicsDocumentService'
import { logger } from '@/lib/logger'

const yearSchema = z.object({
  year: z.string().trim().min(1, 'กรุณาระบุปีงบประมาณ เช่น 2570').max(10),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

export async function GET() {
  try {
    const { error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error) return error

    const safeYears = await EthicsDocumentService.getYears()

    return NextResponse.json({
      success: true,
      years: safeYears,
    })
  } catch (error) {
    logger.error({ err: error }, 'Member fetch ethics error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const body = await request.json()
    const parsed = yearSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    const created = await EthicsDocumentService.createYear(parsed.data, {
      username: member.username,
      session: member.session,
    })

    return NextResponse.json({
      success: true,
      year: created,
      message: 'เพิ่มปีงบประมาณสำเร็จ',
    })
  } catch (error) {
    if (error instanceof EthicsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Create ethics year error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างปีงบประมาณ' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const body = (await request.json()) as { id?: unknown } & Record<string, unknown>
    const { id, ...dataToValidate } = body

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'รหัสปีงบประมาณ (id) ไม่ถูกต้อง' }, { status: 400 })
    }

    const parsed = yearSchema.safeParse(dataToValidate)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      )
    }

    const updated = await EthicsDocumentService.updateYear(id, parsed.data, {
      username: member.username,
      session: member.session,
    })

    return NextResponse.json({
      success: true,
      year: updated,
      message: 'อัปเดตข้อมูลปีงบประมาณสำเร็จ',
    })
  } catch (error) {
    if (error instanceof EthicsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Update ethics year error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดต' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_ethics' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    const id = idParam ? parseInt(idParam, 10) : null

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'รหัสปีงบประมาณไม่ถูกต้อง' }, { status: 400 })
    }

    const deleted = await EthicsDocumentService.deleteYear(id, {
      username: member.username,
      session: member.session,
    })

    return NextResponse.json({
      success: true,
      message: `ลบปีงบประมาณ ${deleted.year} เรียบร้อยแล้ว`,
    })
  } catch (error) {
    if (error instanceof EthicsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Delete ethics year error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบปีงบประมาณ' }, { status: 500 })
  }
}
