import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { PalliativeRegistryService } from '@/lib/clinical/palliativeRegistryService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const createSchema = z.object({
  hn: z.string().min(1, 'กรุณาระบุ HN'),
  patientName: z.string().min(1, 'กรุณาระบุชื่อ-สกุลผู้ป่วย'),
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

export async function GET(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember()
    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิกเพื่อดูข้อมูลทะเบียน Palliative Care',
        },
        { status: 401 }
      )
    }

    const canView =
      member.isAdmin ||
      member.can('view_palliative_registry') ||
      member.can('edit_palliative_registry') ||
      member.can('manage_palliative_registry') ||
      member.role === 'admin' ||
      member.role === 'staff'

    if (!canView) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: คุณไม่มีสิทธิ์เข้าถึงข้อมูลทะเบียน Palliative Care',
        },
        { status: 403 }
      )
    }

    const canEdit =
      member.isAdmin ||
      member.can('edit_palliative_registry') ||
      member.can('manage_palliative_registry')

    const canManage =
      member.isAdmin || member.can('manage_palliative_registry')

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || undefined
    const registrationStatus = searchParams.get('registrationStatus') || undefined
    const claimStatus = searchParams.get('claimStatus') || undefined
    const claimResult = searchParams.get('claimResult') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    logThrottledAudit(
      'READ',
      'palliative_care_registries',
      `Viewed Palliative Care Registry list (search: ${search || 'none'})`,
      { username: member.username, email: member.email }
    ).catch((err) => logger.error({ err }, 'Audit log failed'))

    const data = await PalliativeRegistryService.listRegistries({
      search,
      registrationStatus,
      claimStatus,
      claimResult,
      page,
      limit,
    })

    return NextResponse.json({
      success: true,
      permissions: {
        canView: true,
        canEdit,
        canManage,
      },
      ...data,
    })
  } catch (error: any) {
    logger.error({ error: error?.message }, 'GET /api/service/dashboard-rcm/palliative-care/registry Error')
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลทะเบียน Palliative Care',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
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
        { success: false, error: 'Forbidden: คุณไม่มีสิทธิ์บันทึกข้อมูลทะเบียน Palliative Care' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const created = await PalliativeRegistryService.createRegistry(
      parsed.data,
      member.name || member.username
    )

    return NextResponse.json({
      success: true,
      data: created,
    })
  } catch (error: any) {
    logger.error({ error: error?.message }, 'POST /api/service/dashboard-rcm/palliative-care/registry Error')
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
      },
      { status: 500 }
    )
  }
}
