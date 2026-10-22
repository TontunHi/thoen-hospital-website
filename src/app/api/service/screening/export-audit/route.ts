import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMemberApi } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'

const auditExportSchema = z.object({
  count: z.number().int().nonnegative(),
  dateFilter: z.string().optional().default('today'),
  statusFilter: z.string().optional().default('ALL'),
  searchApplied: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    const body = await req.json().catch(() => ({}))
    const parsed = auditExportSchema.safeParse(body)
    const { count, dateFilter, statusFilter, searchApplied } = parsed.success
      ? parsed.data
      : { count: 0, dateFilter: 'today', statusFilter: 'ALL', searchApplied: false }

    await logAudit(
      'READ',
      'screening_queue',
      `Export screening queue to Excel (count: ${count}, date: ${dateFilter}, status: ${statusFilter}, search: ${searchApplied})`,
      { username: member.username, email: member.email }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'AUDIT_LOG_ERROR',
          message: error?.message || 'เกิดข้อผิดพลาดในการบันทึก Audit Log',
        },
      },
      { status: 500 }
    )
  }
}
