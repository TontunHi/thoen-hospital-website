import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { checkPositionPermission } from '@/lib/memberAuth'
import { RcmSeamlessImportService } from '@/lib/clinical/rcmSeamlessImportService'

/**
 * Helper to check if user has permission to import or view seamless data
 */
async function checkImportPermission(
  username: string,
  role: string,
  action: 'view' | 'import' | 'manage'
): Promise<boolean> {
  if (role === 'admin') return true

  if (action === 'view') {
    return checkPositionPermission(username, [
      'view_rcm_import',
      'import_rcm_data',
      'manage_rcm_import',
    ])
  }

  if (action === 'import') {
    return checkPositionPermission(username, [
      'import_rcm_data',
      'manage_rcm_import',
    ])
  }

  if (action === 'manage') {
    return checkPositionPermission(username, 'manage_rcm_import')
  }

  return false
}

/**
 * GET: Fetch database overview and recent statistics for Seamless records
 */
export async function GET() {
  const session = await verifyMemberSession()
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'กรุณาเข้าสู่ระบบก่อนเข้าถึงข้อมูล' },
      { status: 401 }
    )
  }

  const allowed = await checkImportPermission(session.username, session.role, 'view')
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงหน้านำเข้าข้อมูล RCM / Seamless' },
      { status: 403 }
    )
  }

  try {
    const stats = await RcmSeamlessImportService.getSeamlessDatabaseStats()
    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ error }, 'Failed to fetch seamless stats')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ Seamless' },
      { status: 500 }
    )
  }
}

/**
 * POST: Process and import Seamless Excel file (.xlsx / .xls)
 */
export async function POST(req: NextRequest) {
  const session = await verifyMemberSession()
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' },
      { status: 401 }
    )
  }

  const allowed = await checkImportPermission(session.username, session.role, 'import')
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'คุณไม่มีสิทธิ์นำเข้าข้อมูล Seamless' },
      { status: 403 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const isDryRun = formData.get('dryRun') === 'true'
    const autoEnrichHosp = formData.get('autoEnrichHosp') !== 'false'
    const updatePayment = formData.get('updatePayment') !== 'false'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบไฟล์ที่ต้องการนำเข้า กรุณาเลือกไฟล์ Excel (.xlsx, .xls)' },
        { status: 400 }
      )
    }

    const fileName = file.name
    const isExcel = /\.(xlsx|xls)$/i.test(fileName)
    if (!isExcel) {
      return NextResponse.json(
        { success: false, error: 'ไฟล์ที่อัปโหลดไม่ใช่ไฟล์ Excel (.xlsx, .xls)' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Execute parsing and batch enrichment
    const result = await RcmSeamlessImportService.parseWorkbook(buffer, fileName, {
      isDryRun,
      autoEnrichHosp,
      updatePayment,
    })

    // Audit logging
    logAudit(
      isDryRun ? 'READ' : 'CREATE',
      'SEAMLESS_IMPORT',
      JSON.stringify({
        fileName,
        fileSizeBytes: buffer.length,
        totalRows: result.totalRows,
        validRows: result.validRows,
        errorRows: result.errorRows,
        isDryRun,
      }),
      { username: session.username, email: session.email }
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      data: result,
      message: isDryRun
        ? `ตรวจสอบโครงสร้างไฟล์สำเร็จ พบ ${result.validRows.toLocaleString()} รายการที่ถูกต้อง`
        : `ประมวลผลไฟล์สำเร็จ พบ ${result.validRows.toLocaleString()} รายการ`,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ error }, 'Failed to parse and import Seamless file')
    return NextResponse.json(
      {
        success: false,
        error: `เกิดข้อผิดพลาดในการประมวลผลไฟล์: ${message}`,
      },
      { status: 500 }
    )
  }
}
