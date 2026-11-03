import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { PalliativeRegistryService } from '@/lib/clinical/palliativeRegistryService'
import { logger } from '@/lib/logger'

const updateSchema = z.object({
  hn: z.string().optional(),
  patientName: z.string().optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  icd10Principal: z.string().optional().nullable(),
  icd10Palliative: z.string().optional().nullable(),
  projectCode: z.string().optional().nullable(),
  registrationStatus: z.enum(['ยังไม่ได้ดำเนินการ', 'ดำเนินการเรียบร้อย']).optional(),
  registeredDate: z.string().optional().nullable(),
  visit1Date: z.string().optional().nullable(),
  visit1Remark: z.string().optional().nullable(),
  visit1Status: z.string().optional().nullable(),
  visit2Date: z.string().optional().nullable(),
  visit2Remark: z.string().optional().nullable(),
  visit2Status: z.string().optional().nullable(),
  visit3Date: z.string().optional().nullable(),
  visit3Remark: z.string().optional().nullable(),
  visit3Status: z.string().optional().nullable(),
  visit4Date: z.string().optional().nullable(),
  visit4Remark: z.string().optional().nullable(),
  visit4Status: z.string().optional().nullable(),
  visit5Date: z.string().optional().nullable(),
  visit5Remark: z.string().optional().nullable(),
  visit5Status: z.string().optional().nullable(),
  visit6Date: z.string().optional().nullable(),
  visit6Remark: z.string().optional().nullable(),
  visit6Status: z.string().optional().nullable(),
  deathDate: z.string().optional().nullable(),
  deathEntryStatus: z.string().optional().nullable(),
  claimStatus: z.enum(['ยังไม่ได้ลงข้อมูล', 'ลงข้อมูล']).optional(),
  claimResult: z.string().optional().nullable(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const member = await getAuthenticatedMember()
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
    }

    const item = await PalliativeRegistryService.getRegistryById(id)
    if (!item) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูล' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: item })
  } catch (error: any) {
    logger.error({ error: error?.message }, 'GET [id] Error')
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const member = await getAuthenticatedMember()
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const canEdit =
      member.isAdmin ||
      member.can('edit_palliative_registry') ||
      member.can('manage_palliative_registry')

    if (!canEdit) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: คุณไม่มีสิทธิ์แก้ไขข้อมูล' },
        { status: 403 }
      )
    }

    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const updated = await PalliativeRegistryService.updateRegistry(
      id,
      parsed.data,
      member.name || member.username
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    logger.error({ error: error?.message }, 'PUT [id] Error')
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const member = await getAuthenticatedMember()
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const canManage =
      member.isAdmin || member.can('manage_palliative_registry')

    if (!canManage) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: คุณไม่มีสิทธิ์ลบข้อมูลเคสผู้ป่วย' },
        { status: 403 }
      )
    }

    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
    }

    await PalliativeRegistryService.deleteRegistry(
      id,
      member.name || member.username
    )

    return NextResponse.json({ success: true, message: 'ลบข้อมูลเรียบร้อยแล้ว' })
  } catch (error: any) {
    logger.error({ error: error?.message }, 'DELETE [id] Error')
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการลบข้อมูล' },
      { status: 500 }
    )
  }
}
