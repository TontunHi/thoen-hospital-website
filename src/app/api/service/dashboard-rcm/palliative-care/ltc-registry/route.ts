import { NextResponse } from 'next/server'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { LtcRegistryService } from '@/lib/clinical/ltcRegistryService'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    const member = await fetchAuthenticatedMember(session.username, session.email)
    const canAccess =
      member?.isAdmin ||
      member?.can('manage_ltc_registry') ||
      member?.can('edit_ltc_registry') ||
      member?.can('view_ltc_registry')

    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: คุณไม่มีสิทธิ์เข้าถึงทะเบียน Long Term Care (LTC)' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const areaZone = searchParams.get('areaZone') || undefined
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20
    const exportAll = searchParams.get('exportAll') === 'true'

    const result = await LtcRegistryService.listRegistries({
      search,
      areaZone,
      page,
      limit,
      exportAll,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API GET /api/service/dashboard-rcm/palliative-care/ltc-registry Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลทะเบียน LTC' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    const member = await fetchAuthenticatedMember(session.username, session.email)
    const canManage = member?.isAdmin || member?.can('manage_ltc_registry') || member?.can('edit_ltc_registry')
    if (!canManage) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: คุณไม่มีสิทธิ์เพิ่มข้อมูลในทะเบียน Long Term Care (LTC)' },
        { status: 403 }
      )
    }

    const body = await request.json()
    if (!body || !body.hn || !body.patientName) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุข้อมูล HN และชื่อผู้ป่วยให้ครบถ้วน' },
        { status: 400 }
      )
    }

    const record = await LtcRegistryService.createRegistry(
      {
        hn: body.hn,
        cid: body.cid,
        patientName: body.patientName,
        address: body.address,
        moo: body.moo,
        tambon: body.tambon,
        age: body.age,
        adlScore: body.adlScore,
        areaZone: body.areaZone,
      },
      {
        username: session.username,
        email: session.email,
      }
    )

    return NextResponse.json({
      success: true,
      data: record,
    })
  } catch (error: any) {
    logger.error({ error: error?.message }, 'API POST /api/service/dashboard-rcm/palliative-care/ltc-registry Error')
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล LTC' },
      { status: 400 }
    )
  }
}
