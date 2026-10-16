import { NextRequest, NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { parseKpiRows, ParsedKpiRow } from '@/lib/kpi/kpiExcelParser'
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

const importSchema = z.object({
  fiscalYear: z.string().trim().min(1, 'กรุณาระบุปีงบประมาณ'),
  code: z.string().trim().min(1, 'กรุณาระบุรหัสชุดตัวชี้วัด'),
  title: z.string().trim().min(1, 'กรุณาระบุชื่อชุดตัวชี้วัด'),
  description: z.string().optional().nullable(),
  indicators: z.array(indicatorRowSchema).optional(),
  csvContent: z.string().optional(),
}).refine(data => (data.indicators && data.indicators.length > 0) || (data.csvContent && data.csvContent.length > 0), {
  message: 'กรุณาแนบรายการตัวชี้วัด (Excel หรือ CSV)',
})

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
      if (currentRow.some(c => c.length > 0)) {
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
    if (currentRow.some(c => c.length > 0)) {
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
        { success: false, error: { code: 'FORBIDDEN', message: 'เฉพาะผู้ดูแลระบบหรือศูนย์คุณภาพเท่านั้นที่สามารถนำเข้าชุดตัวชี้วัดได้' } },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = importSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' } },
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
        { success: false, error: { code: 'EMPTY_DATA', message: 'ไม่พบรายการตัวชี้วัดที่ถูกต้องในไฟล์' } },
        { status: 400 }
      )
    }

    // 1. Create or update topic
    const existingTopic = await queryMemberDb(
      'SELECT id FROM kpi_topics WHERE fiscal_year = ? AND code = ?',
      [fiscalYear, code]
    )

    let topicId: number
    if (existingTopic.length > 0) {
      topicId = existingTopic[0].id
      await queryMemberDb(
        'UPDATE kpi_topics SET title = ?, description = ?, is_active = 1 WHERE id = ?',
        [title, description ?? null, topicId]
      )
      // Delete old indicators if re-importing the same topic code & year
      await queryMemberDb('DELETE FROM kpi_indicators WHERE topic_id = ?', [topicId])
    } else {
      const insertTopic: any = await queryMemberDb(
        'INSERT INTO kpi_topics (fiscal_year, code, title, description, is_active) VALUES (?, ?, ?, ?, 1)',
        [fiscalYear, code, title, description ?? null]
      )
      topicId = insertTopic.insertId
    }

    // 2. Insert indicator rows via fast atomic transaction with SET NAMES utf8mb4
    const statements: Array<{ sql: string; params?: any[] }> = [
      { sql: 'SET NAMES utf8mb4' }
    ]

    for (let i = 0; i < rowsToInsert.length; i++) {
      const row = rowsToInsert[i]
      statements.push({
        sql: `INSERT INTO kpi_indicators (
          topic_id, sequence, category, subcategory, code, old_code,
          frequency, title, numerator_name, denominator_name,
          target_raw, target_operator, target_value, target_unit,
          responsible_name, indicator_type, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          topicId,
          row.sequence ?? null,
          row.category || 'ทั่วไป',
          row.subcategory ?? null,
          row.code ?? null,
          row.oldCode ?? null,
          row.frequency || 'ราย 6 เดือน',
          row.title,
          row.numeratorName ?? null,
          row.denominatorName ?? null,
          row.targetRaw ?? null,
          row.targetOperator ?? null,
          row.targetValue ?? null,
          row.targetUnit ?? null,
          row.responsibleName ?? null,
          row.indicatorType || 'HA',
          i + 1
        ]
      })
    }

    const CHUNK_SIZE = 100
    for (let c = 0; c < statements.length; c += CHUNK_SIZE) {
      const chunk = statements.slice(c, c + CHUNK_SIZE)
      if (c > 0) {
        chunk.unshift({ sql: 'SET NAMES utf8mb4' })
      }
      await apiGateway.app.transaction(chunk)
    }

    const inserted = rowsToInsert.length

    logAudit(
      'CREATE',
      'kpi_topics',
      JSON.stringify({
        topicId,
        fiscalYear,
        code,
        insertedCount: inserted,
        by: member.name || member.username
      })
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        topicId,
        fiscalYear,
        code,
        inserted,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'IMPORT_FAILED', message: err.message || 'การนำเข้าล้มเหลว' } },
      { status: 500 }
    )
  }
}
