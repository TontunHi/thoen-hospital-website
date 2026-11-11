import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { logAudit, logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { RcmT1dmImportService } from '@/lib/clinical/rcmT1dmImportService'

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

const getQuerySchema = z.object({
  search: z.string().max(150).optional(),
  typeFilter: z.string().max(30).optional(),
  hospFilter: z.enum(['ALL', 'MINE', 'OTHER']).optional(),
  fileName: z.string().max(255).optional(),
  sortBy: z
    .enum([
      'no',
      'id',
      'pid',
      'ptname',
      'regdate',
      'visitdate',
      'type',
      'maininscl',
      'hospmain',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).optional(),
  exportAll: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  refresh: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
})

const deleteBodySchema = z.object({
  mode: z.enum(['other_hospitals', 'by_file', 'all']),
  fileName: z.string().max(255).optional(),
  myHospCode: z.string().max(10).optional(),
})

/**
 * GET: Fetch T1DM/GDM/PDM registry ledger, KPI summary, and imported files list
 */
export async function GET(req: NextRequest) {
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
      { success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงเมนูนำเข้าข้อมูล (RCM Import)' },
      { status: 403 }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const rawParams = Object.fromEntries(searchParams.entries())
    const parsed = getQuerySchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'พารามิเตอร์การค้นหาไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    logThrottledAudit(
      'READ',
      'RCM_T1DM_IMPORT',
      `Viewed T1DM/GDM/PDM Registry Ledger (page: ${parsed.data.page || 1}, hospFilter: ${parsed.data.hospFilter || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch(() => {})

    const data = await RcmT1dmImportService.getRegistryList(parsed.data)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Failed to fetch T1DM registry list')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลทะเบียน T1DM/GDM/PDM' },
      { status: 500 }
    )
  }
}

/**
 * POST: Parse and import T1DM Excel file (.xlsx / .xls)
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
      { success: false, error: 'คุณไม่มีสิทธิ์นำเข้าไฟล์ข้อมูลทะเบียน T1DM/GDM/PDM' },
      { status: 403 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const isDryRun = formData.get('dryRun') === 'true'
    const filterMyHospOnly = formData.get('filterMyHospOnly') !== 'false'
    const myHospCode = String(formData.get('myHospCode') || '11152').trim()

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบไฟล์ที่ต้องการนำเข้า กรุณาเลือกไฟล์ Excel (.xlsx, .xls)' },
        { status: 400 }
      )
    }

    const fileName = file.name
    if (!/\.(xlsx|xls)$/i.test(fileName)) {
      return NextResponse.json(
        { success: false, error: 'ไฟล์ที่อัปโหลดไม่ใช่ไฟล์ Excel (.xlsx, .xls)' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await RcmT1dmImportService.parseAndImportWorkbook(buffer, fileName, {
      isDryRun,
      filterMyHospOnly,
      myHospCode,
    })

    logAudit(
      isDryRun ? 'READ' : 'CREATE',
      'RCM_T1DM_IMPORT',
      JSON.stringify({
        fileName,
        fileSizeBytes: buffer.length,
        totalRowsScanned: result.totalRowsScanned,
        importedCount: result.importedCount,
        skippedOtherHospCount: result.skippedOtherHospCount,
        isDryRun,
        filterMyHospOnly,
      }),
      { username: session.username, email: session.email }
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      data: result,
      message: isDryRun
        ? `ตรวจสอบไฟล์สำเร็จ พบข้อมูลที่ตรงเงื่อนไข ${result.importedCount.toLocaleString('th-TH')} รายการ`
        : `นำเข้าข้อมูลทะเบียนสำเร็จ ${result.importedCount.toLocaleString('th-TH')} รายการ`,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการประมวลผลไฟล์'
    logger.error({ error }, 'Failed to parse and import T1DM Excel file')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Delete records (other_hospitals: hospmain<>11152, by_file: filename=?, or all)
 */
export async function DELETE(req: NextRequest) {
  const session = await verifyMemberSession()
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' },
      { status: 401 }
    )
  }

  // Allow users with import or manage permission to clean up non-11152 or imported files
  const allowed = await checkImportPermission(session.username, session.role, 'import')
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'คุณไม่มีสิทธิ์ลบข้อมูลในทะเบียน T1DM/GDM/PDM' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const parsed = deleteBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'คำสั่งลบข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    if (parsed.data.mode === 'by_file' && !parsed.data.fileName?.trim()) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อไฟล์ที่ต้องการลบข้อมูล' },
        { status: 400 }
      )
    }

    // Only admin or manage_rcm_import can delete 'all'
    if (parsed.data.mode === 'all') {
      const canManage = await checkImportPermission(session.username, session.role, 'manage')
      if (!canManage) {
        return NextResponse.json(
          { success: false, error: 'เฉพาะผู้ดูแลระบบนำเข้าข้อมูลเท่านั้นที่สามารถล้างข้อมูลทั้งหมดได้' },
          { status: 403 }
        )
      }
    }

    const res = await RcmT1dmImportService.deleteRegistries(parsed.data)

    logAudit(
      'DELETE',
      'RCM_T1DM_IMPORT',
      JSON.stringify({
        mode: parsed.data.mode,
        fileName: parsed.data.fileName || null,
        deletedCount: res.deletedCount,
      }),
      { username: session.username, email: session.email }
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      data: res,
      message:
        parsed.data.mode === 'other_hospitals'
          ? `ลบรายการต่างหน่วยบริการ (นอกเหนือจาก ${parsed.data.myHospCode || '11152'}) เรียบร้อยแล้ว`
          : parsed.data.mode === 'by_file'
          ? `ลบข้อมูลจากไฟล์ ${parsed.data.fileName} เรียบร้อยแล้ว`
          : 'ล้างข้อมูลทะเบียนทั้งหมดเรียบร้อยแล้ว',
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Failed to delete T1DM registry records')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการลบข้อมูลทะเบียน T1DM/GDM/PDM' },
      { status: 500 }
    )
  }
}
