import { NextRequest, NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { KpiExportService } from '@/lib/kpi/kpiExportService'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    const canExport =
      member.isAdmin ||
      member.role === 'admin' ||
      member.role === 'superadmin' ||
      member.can('manage_kpi') ||
      member.can('view_all_kpi')

    if (!canExport) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์ส่งออกรายงานตัวชี้วัด' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const topicIdStr = searchParams.get('topicId')
    const fiscalYear = searchParams.get('fiscalYear') || '2570'

    if (!topicIdStr) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'กรุณาระบุ topicId' } },
        { status: 400 }
      )
    }

    const topicId = parseInt(topicIdStr, 10)
    const periodKey = searchParams.get('periodKey') || undefined

    const exportResult = await KpiExportService.exportToExcel({
      topicId,
      fiscalYear,
      periodKey,
    })

    // Log export audit
    logAudit(
      'READ',
      'kpi_entries',
      JSON.stringify({
        action: 'EXPORT_EXCEL',
        topicId,
        fiscalYear,
        totalExported: exportResult.totalCount,
        passCount: exportResult.passCount,
        failCount: exportResult.failCount,
        by: member.username,
      })
    ).catch(() => {})

    const encodedFilename = encodeURIComponent(exportResult.filename)

    return new Response(new Uint8Array(exportResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${exportResult.filename}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': String(exportResult.buffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'EXPORT_FAILED', message: err.message || 'ส่งออกไฟล์ Excel ไม่สำเร็จ' } },
      { status: 500 }
    )
  }
}
