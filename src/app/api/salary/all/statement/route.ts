import { NextResponse } from 'next/server'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { querySalaryDb } from '@/lib/salaryDb'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { buildStatementData, StatementRange } from '@/lib/salary/salaryStatementService'
import { generateStatementExcel } from '@/lib/salary/statementExcelExporter'

export async function GET(request: Request) {
  try {
    // 1. Verify caller session
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    // 2. Check permission (admin or position has 'view_all_salary')
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

    // 3. Find target member in memberDb (optional augmentation)
    const memberRows = await queryMemberDb(
      'SELECT id, username, email, name, department, position, salary_user FROM members WHERE username = ? OR salary_user = ? LIMIT 1',
      [targetUsername, targetUsername]
    )

    const targetMember = memberRows && memberRows.length > 0 ? memberRows[0] : null
    const salaryLookupId = targetMember?.salary_user || targetUsername

    // 4. Query salary and ot records
    let salaryRows: any[] = []
    let otRows: any[] = []

    try {
      salaryRows = await querySalaryDb(
        'SELECT * FROM salary WHERE c2 = ? ORDER BY c1 DESC',
        [salaryLookupId]
      )
      otRows = await querySalaryDb(
        'SELECT * FROM ot WHERE c2 = ? ORDER BY c1 DESC',
        [salaryLookupId]
      )
    } catch (dbError: any) {
      console.error('Failed to query salary database for statement:', dbError)
      return NextResponse.json(
        { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลเงินเดือนได้ในขณะนี้' },
        { status: 500 }
      )
    }

    if ((!salaryRows || salaryRows.length === 0) && (!otRows || otRows.length === 0)) {
      return NextResponse.json(
        { error: `ไม่พบข้อมูลเงินเดือนสำหรับรหัส "${targetUsername}"` },
        { status: 404 }
      )
    }

    const resolvedMember = {
      id: targetMember?.id || 0,
      username: targetMember?.username || targetUsername,
      name: targetMember?.name || salaryRows[0]?.c4?.trim() || otRows[0]?.c4?.trim() || targetUsername,
      department: targetMember?.department || '-',
      position: targetMember?.position || '-',
      salary_user: targetMember?.salary_user || targetUsername
    }

    // 5. Build statement data
    const statementData = buildStatementData(resolvedMember, salaryRows, otRows, {
      range,
      fromPeriod,
      toPeriod
    })

    // 6. Audit Logging (Tier 1)
    logAudit(
      'READ',
      'salary',
      `Exported salary statement (${statementData.rangeLabel}, format: ${format}) for employee: ${resolvedMember.username}`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Salary statement audit log failed'))

    // 7. Return Excel binary or JSON response
    if (format === 'excel') {
      const buffer = await generateStatementExcel(statementData)
      const fileNameSuffix = statementData.range === 'custom'
        ? `${statementData.summary.fromPeriod}_${statementData.summary.toPeriod}`.replace(/\s+/g, '_')
        : statementData.range
      const fileName = `salary_statement_${resolvedMember.username}_${fileNameSuffix}.xlsx`

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      })
    }

    return NextResponse.json({
      success: true,
      statement: statementData
    })
  } catch (error: any) {
    console.error('Statement API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ขณะสร้างเอกสาร Statement' },
      { status: 500 }
    )
  }
}
