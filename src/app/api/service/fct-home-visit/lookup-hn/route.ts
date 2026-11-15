import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logThrottledAudit } from '@/lib/audit'
import { fctHomeVisitService } from '@/lib/clinical/fctHomeVisitService'
import { attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import { handleFctHomeVisitRouteError, requireFctHomeVisitSession } from '../_shared'

export const dynamic = 'force-dynamic'

const hnQuerySchema = z.object({
  hn: z
    .string({ message: 'กรุณาระบุหมายเลข HN' })
    .trim()
    .min(1, 'กรุณาระบุหมายเลข HN')
    .max(20, 'หมายเลข HN ต้องไม่เกิน 20 ตัวอักษร'),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await requireFctHomeVisitSession('manage')
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const parsedQuery = hnQuerySchema.safeParse({
      hn: searchParams.get('hn') ?? '',
    })

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedQuery.error.issues[0]?.message || 'กรุณาระบุหมายเลข HN',
        },
        { status: 400 }
      )
    }

    const patient = await fctHomeVisitService.lookupPatientByHn(parsedQuery.data.hn)

    await logThrottledAudit(
      'READ',
      'fct_home_visit_patient_lookup',
      'Looked up patient demographics for FCT Home Visit',
      auth.session
    )

    if (!patient) {
      const notFoundResponse = NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลผู้ป่วยสำหรับ HN นี้ในระบบ HOSxP' },
        { status: 404 }
      )
      return await attachRenewedMemberSessionCookie(notFoundResponse, auth.session)
    }

    const response = NextResponse.json({ success: true, data: patient }, { status: 200 })
    return await attachRenewedMemberSessionCookie(response, auth.session)
  } catch (error) {
    return handleFctHomeVisitRouteError(error, 'GET /api/service/fct-home-visit/lookup-hn')
  }
}
