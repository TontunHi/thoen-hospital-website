import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMemberApi } from '@/lib/memberAuth'
import { KpiAuditService, PhiViolationError } from '@/lib/kpi/kpiAuditService'
import { logger } from '@/lib/logger'

const auditStatusSchema = z.enum([
  'MATCH',
  'MISMATCH',
  'NO_HUMAN_ENTRY',
  'MANUAL_OR_HYBRID',
  'UNCONFIGURED_RULE',
  'SQL_ERROR',
])

const auditItemSchema = z.object({
  indicatorId: z.number().int().positive(),
  ruleCode: z.string().min(1).max(50),
  status: auditStatusSchema,
  humanNumerator: z.number().nullable().optional(),
  humanDenominator: z.number().nullable().optional(),
  humanResult: z.number().nullable().optional(),
  aiNumerator: z.number().nullable().optional(),
  aiDenominator: z.number().nullable().optional(),
  aiResult: z.number().nullable().optional(),
  diffNumerator: z.number().nullable().optional(),
  diffDenominator: z.number().nullable().optional(),
  diffResult: z.number().nullable().optional(),
  thipManualRef: z.string().max(255).nullable().optional(),
  explanationTh: z.string().max(4000).nullable().optional(),
  diagnostics: z
    .record(z.string(), z.array(z.record(z.string(), z.unknown())))
    .nullable()
    .optional(),
})

const batchPayloadSchema = z.object({
  fiscalYear: z.string().min(4).max(10),
  periodKey: z.string().min(1).max(50),
  auditedAt: z.string().nullable().optional(),
  actorName: z.string().max(120).nullable().optional(),
  items: z.array(auditItemSchema).min(1).max(500),
})

function hasValidCronBearer(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = req.headers.get('authorization') || ''
  const expected = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) {
      return auth.error
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
    if (!Number.isFinite(topicId) || topicId <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'topicId ไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const fiscalYear = searchParams.get('fiscalYear') || undefined
    const periodKey = searchParams.get('periodKey') || undefined

    const audits = await KpiAuditService.getAuditsByTopic({
      topicId,
      fiscalYear,
      periodKey,
    })

    return NextResponse.json({
      success: true,
      data: { audits },
    })
  } catch (err: any) {
    logger.error({ err }, 'Failed to load KPI AI audits')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'ไม่สามารถโหลดผลตรวจทานจาก AI ได้' },
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    let actorName = 'thoen-kpi-auditor'

    if (!hasValidCronBearer(req)) {
      const auth = await requireMemberApi()
      if (auth.error) {
        return auth.error
      }
      const member = auth.member
      if (!member.isAdmin && !member.can('manage_kpi')) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เผยแพร่ผลตรวจทาน KPI AI' },
          },
          { status: 403 }
        )
      }
      actorName = member.name || member.username
    }

    const body = await req.json()
    const parsed = batchPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'รูปแบบข้อมูลไม่ถูกต้อง',
          },
        },
        { status: 400 }
      )
    }

    const result = await KpiAuditService.upsertAuditBatch({
      ...parsed.data,
      actorName: parsed.data.actorName || actorName,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    if (err instanceof PhiViolationError) {
      return NextResponse.json(
        { success: false, error: { code: 'PHI_BLOCKED', message: err.message } },
        { status: 400 }
      )
    }
    logger.error({ err }, 'Failed to publish KPI AI audit batch')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'ไม่สามารถบันทึกผลตรวจทาน AI ได้' },
      },
      { status: 500 }
    )
  }
}
