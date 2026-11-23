import { NextRequest, NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { parseKpiRows, ParsedKpiRow } from '@/lib/kpi/kpiExcelParser'
import { KpiService } from '@/lib/kpi/kpiService'
import { z } from 'zod'

const indicatorRowSchema = z.object({
  sequence: z.string().nullable().optional(),
  category: z.string().min(1),
  subcategory: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  oldCode: z.string().nullable().optional(),
  frequency: z.string().min(1),
  title: z.string().min(1),
  numeratorName: z.string().nullable().optional(),
  denominatorName: z.string().nullable().optional(),
  targetRaw: z.string().nullable().optional(),
  targetOperator: z.string().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  targetUnit: z.string().nullable().optional(),
  responsibleName: z.string().nullable().optional(),
  indicatorType: z.string().nullable().optional(),
})

const importSchema = z
  .object({
    fiscalYear: z.string().trim().min(1, 'กรุณาระบุปีงบประมาณ'),
    code: z.string().trim().min(1, 'กรุณาระบุรหัสชุดตัวชี้วัด'),
    title: z.string().trim().min(1, 'กรุณาระบุชื่อชุดตัวชี้วัด'),
    description: z.string().optional().nullable(),
    indicators: z.array(indicatorRowSchema).optional(),
    csvContent: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.indicators && data.indicators.length > 0) ||
      (data.csvContent && data.csvContent.length > 0),
    {
      message: 'กรุณาแนบรายการตัวชี้วัด (Excel หรือ CSV)',
    }
  )

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      currentRow.push(currentField.trim())
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentField = ''
    } else {
      currentField += char
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow)
    }
  }
  return rows
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    if (!member.isAdmin && !member.can('manage_kpi')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'เฉพาะผู้ดูแลระบบหรือศูนย์คุณภาพเท่านั้นที่สามารถนำเข้าชุดตัวชี้วัดได้',
          },
        },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = importSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง',
          },
        },
        { status: 400 }
      )
    }

    const { fiscalYear, code, title, description, indicators, csvContent } = parsed.data

    let rowsToInsert: ParsedKpiRow[] = []
    if (indicators && indicators.length > 0) {
      rowsToInsert = indicators as ParsedKpiRow[]
    } else if (csvContent) {
      const csvRows = parseCSV(csvContent)
      const parseRes = parseKpiRows(csvRows)
      rowsToInsert = parseRes.indicators
    }

    if (rowsToInsert.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'EMPTY_DATA', message: 'ไม่พบรายการตัวชี้วัดที่ถูกต้องในไฟล์' },
        },
        { status: 400 }
      )
    }

    const result = await KpiService.importTopicAndIndicators({
      fiscalYear,
      code,
      title,
      description,
      rows: rowsToInsert,
      actorName: member.name || member.username,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'การนำเข้าล้มเหลว'
    return NextResponse.json(
      { success: false, error: { code: 'IMPORT_FAILED', message } },
      { status: 500 }
    )
  }
}
