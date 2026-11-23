import { NextResponse } from 'next/server'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { logger } from '@/lib/logger'
import { StatementRange } from '@/lib/salary/salaryStatementService'
import { generateStatementExcel } from '@/lib/salary/statementExcelExporter'
import {
  SalaryPortalError,
  SalaryPortalService,
} from '@/lib/salary/salaryPortalService'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    const isAuthorized =
      session.role === 'admin' ||
      (await checkPositionPermission(session.username, 'view_all_salary'))

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลสเตทเมนต์เงินเดือนของบุคลากร' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const targetUsername = searchParams.get('username')?.trim()
    const rawRange = searchParams.get('range')?.trim() || '6m'
    const fromPeriod = searchParams.get('fromPeriod')?.trim() || ''
    const toPeriod = searchParams.get('toPeriod')?.trim() || ''
    const format = searchParams.get('format')?.trim()?.toLowerCase() || 'json'

    if (!targetUsername) {
      return NextResponse.json(
        { error: 'กรุณาระบุ Username หรือรหัสประจำตัวของบุคลากร' },
        { status: 400 }
      )
    }

    const validRanges: StatementRange[] = ['1m', '3m', '6m', '1y', 'custom']
    const range: StatementRange = validRanges.includes(rawRange as StatementRange)
      ? (rawRange as StatementRange)
      : '6m'

    const { resolvedMember, statementData } =
      await SalaryPortalService.buildEmployeeSalaryStatement({
        targetUsername,
        range,
        fromPeriod,
        toPeriod,
        format,
        actor: { username: session.username, email: session.email },
      })

    if (format === 'excel') {
      const buffer = await generateStatementExcel(statementData)
      const fileNameSuffix =
        statementData.range === 'custom'
          ? `${statementData.summary.fromPeriod}_${statementData.summary.toPeriod}`.replace(
              /\s+/g,
              '_'
            )
          : statementData.range
      const fileName = `salary_statement_${resolvedMember.username}_${fileNameSuffix}.xlsx`

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    return NextResponse.json({
      success: true,
      statement: statementData,
    })
  } catch (error) {
    if (error instanceof SalaryPortalError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Statement API error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ขณะสร้างเอกสาร Statement' },
      { status: 500 }
    )
  }
}
