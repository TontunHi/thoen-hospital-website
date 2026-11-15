import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { logAudit, logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { GatewayUnavailableError } from '@/lib/apiGateway'
import {
  RcmSeamlessImportService,
  SeamlessDuplicateMode,
  SeamlessHospFilter,
  SeamlessLedgerSortField,
  SeamlessPayStatusFilter,
} from '@/lib/clinical/rcmSeamlessImportService'

const ledgerQuerySchema = z.object({
  view: z.enum(['stats', 'ledger', 'files', 'deny_codes']).default('stats'),
  search: z.string().max(200).optional().default(''),
  fundFilter: z.string().max(200).optional().default('ALL'),
  hospFilter: z.enum(['ALL', 'MINE', 'OTHER']).optional().default('ALL'),
  payStatus: z.enum(['ALL', 'PAID', 'UNPAID']).optional().default('ALL'),
  fileName: z.string().max(150).optional().default(''),
  sortBy: z
    .enum([
      'admDate',
      'id',
      'rep',
      'fund',
      'hn',
      'ptname',
      'collected',
      'compensated',
      'payDate',
      'fileName',
    ])
    .optional()
    .default('admDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
  exportAll: z.enum(['true', 'false']).optional().default('false'),
  refresh: z.enum(['true', 'false']).optional().default('false'),
})

const syncPaymentSchema = z.object({
  action: z.literal('sync_payment'),
  rep: z.string().max(50).optional(),
  payNo: z.string().max(100).optional(),
  payDate: z.string().max(20).nullable().optional(),
  codeAccount: z.string().max(50).nullable().optional(),
  force: z.boolean().optional().default(false),
})

const deleteRecordsSchema = z
  .object({
    mode: z.enum(['by_file', 'by_files', 'other_hospitals', 'all']),
    fileName: z.string().trim().min(1).max(150).optional(),
    fileNames: z.array(z.string().trim().min(1).max(150)).min(1).max(500).optional(),
    myHospCode: z.string().trim().max(5).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === 'by_file' && !val.fileName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'กรุณาระบุชื่อไฟล์ (fileName) สำหรับการลบรายไฟล์',
        path: ['fileName'],
      })
    }
    if (val.mode === 'by_files' && (!val.fileNames || val.fileNames.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'กรุณาเลือกอย่างน้อย 1 ไฟล์สำหรับการลบหลายไฟล์',
        path: ['fileNames'],
      })
    }
  })

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
export async function GET(req?: NextRequest) {
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
    const rawParams = req?.url ? Object.fromEntries(new URL(req.url).searchParams.entries()) : {}
    const parsedQuery = ledgerQuerySchema.safeParse(rawParams)
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsedQuery.error.issues[0]?.message || 'พารามิเตอร์ไม่ถูกต้อง',
        },
        { status: 400 }
      )
    }

    const q = parsedQuery.data
    const refresh = q.refresh === 'true'

    if (q.view === 'ledger') {
      logThrottledAudit('READ', 'RCM_SEAMLESS_LEDGER', session.username).catch(() => {})
      const ledger = await RcmSeamlessImportService.getSeamlessLedger({
        search: q.search,
        fundFilter: q.fundFilter,
        hospFilter: q.hospFilter as SeamlessHospFilter,
        payStatus: q.payStatus as SeamlessPayStatusFilter,
        fileName: q.fileName,
        sortBy: q.sortBy as SeamlessLedgerSortField,
        sortOrder: q.sortOrder,
        page: q.page,
        pageSize: q.pageSize,
        exportAll: q.exportAll === 'true',
        refresh,
      })
      return NextResponse.json({ success: true, data: ledger })
    }

    if (q.view === 'files') {
      logThrottledAudit('READ', 'RCM_SEAMLESS_FILES', session.username).catch(() => {})
      const files = await RcmSeamlessImportService.getSeamlessImportedFiles(undefined, refresh)
      return NextResponse.json({ success: true, data: files })
    }

    if (q.view === 'deny_codes') {
      const denyCodes = await RcmSeamlessImportService.getSeamlessDenyCodes(
        q.search,
        undefined,
        refresh
      )
      return NextResponse.json({ success: true, data: denyCodes })
    }

    const stats = await RcmSeamlessImportService.getSeamlessDatabaseStats(undefined, refresh)
    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error: unknown) {
    if (error instanceof GatewayUnavailableError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 503 }
      )
    }
    logger.error({ error }, 'Failed to fetch seamless stats')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ Seamless' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Manage / delete Seamless records by file, multiple files, other hospitals, or all
 */
export async function DELETE(req: NextRequest) {
  const session = await verifyMemberSession()
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' } },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'รูปแบบข้อมูล JSON ไม่ถูกต้อง' } },
      { status: 400 }
    )
  }

  const parsed = deleteRecordsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'พารามิเตอร์การลบไม่ถูกต้อง',
        },
      },
      { status: 400 }
    )
  }

  const requiredPermission = parsed.data.mode === 'all' ? 'manage' : 'import'
  const allowed = await checkImportPermission(session.username, session.role, requiredPermission)
  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message:
            parsed.data.mode === 'all'
              ? 'เฉพาะผู้ดูแลระบบหรือผู้มีสิทธิ์ manage_rcm_import เท่านั้นที่สามารถล้างข้อมูลทั้งหมดได้'
              : 'ไม่มีสิทธิ์ลบข้อมูล Seamless',
        },
      },
      { status: 403 }
    )
  }

  try {
    const result = await RcmSeamlessImportService.deleteSeamlessRecords(parsed.data)

    await logAudit('DELETE', 'RCM_SEAMLESS_RECORDS', session.username, {
      mode: parsed.data.mode,
      fileName: parsed.data.fileName,
      fileCount: parsed.data.fileNames?.length,
      deletedCount: result.deletedCount,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    if (error instanceof GatewayUnavailableError) {
      return NextResponse.json(
        { success: false, error: { code: 'GATEWAY_UNAVAILABLE', message: error.message } },
        { status: 503 }
      )
    }
    const msg = error instanceof Error ? error.message : 'ไม่สามารถลบข้อมูล Seamless ได้'
    logger.error({ error, mode: parsed.data.mode }, 'Seamless delete operation failed')
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_ERROR', message: msg } },
      { status: 500 }
    )
  }
}

/**
 * POST: Process and import Seamless Excel file (.xlsx / .xls) OR trigger payment date sync (JSON)
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
    const contentType = req.headers?.get?.('content-type') || ''
    if (contentType.includes('application/json')) {
      let jsonBody: unknown
      try {
        jsonBody = await req.json()
      } catch {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_JSON', message: 'รูปแบบข้อมูล JSON ไม่ถูกต้อง' } },
          { status: 400 }
        )
      }

      const parsedAction = syncPaymentSchema.safeParse(jsonBody)
      if (!parsedAction.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: parsedAction.error.issues[0]?.message || 'คำสั่งไม่ถูกต้อง',
            },
          },
          { status: 400 }
        )
      }

      const result = await RcmSeamlessImportService.syncSeamlessPaymentDates({
        rep: parsedAction.data.rep,
        payNo: parsedAction.data.payNo,
        payDate: parsedAction.data.payDate,
        codeAccount: parsedAction.data.codeAccount,
        force: parsedAction.data.force,
      })

      await logAudit('UPDATE', 'RCM_SEAMLESS_SYNC_PAYMENT', session.username, {
        rep: parsedAction.data.rep,
        payNo: parsedAction.data.payNo,
        force: parsedAction.data.force,
        updatedPaymentCount: result.updatedPaymentCount,
        backfilledDateCount: result.backfilledDateCount,
      })

      return NextResponse.json({
        success: true,
        data: result,
      })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const isDryRun = formData.get('dryRun') === 'true'
    const autoEnrichHosp = formData.get('autoEnrichHosp') !== 'false'
    const updatePayment = formData.get('updatePayment') !== 'false'
    const filterMyHospOnly = formData.get('filterMyHospOnly') !== 'false'
    const duplicateModeRaw = formData.get('duplicateMode')
    const duplicateMode: SeamlessDuplicateMode =
      duplicateModeRaw === 'skip' ? 'skip' : 'update'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบไฟล์ที่ต้องการนำเข้า กรุณาเลือกไฟล์ Excel (.xlsx, .csv)' },
        { status: 400 }
      )
    }

    const fileName = file.name
    const isExcel = /\.(xlsx|xls|csv)$/i.test(fileName)
    if (!isExcel) {
      return NextResponse.json(
        { success: false, error: 'ไฟล์ที่อัปโหลดไม่ใช่ไฟล์ Excel หรือ CSV (.xlsx, .xls, .csv)' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Execute parsing, batch enrichment, and DB persistence (when !isDryRun)
    const result = await RcmSeamlessImportService.parseWorkbook(buffer, fileName, {
      isDryRun,
      autoEnrichHosp,
      updatePayment,
      filterMyHospOnly,
      duplicateMode,
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
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        skippedOtherHospCount: result.skippedOtherHospCount,
        filterMyHospOnly,
        duplicateMode,
        isDryRun,
      }),
      { username: session.username, email: session.email }
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      data: result,
      message: isDryRun
        ? `ตรวจสอบโครงสร้างไฟล์สำเร็จ พบ ${result.validRows.toLocaleString()} รายการ (ใหม่ ${result.newInDbCount.toLocaleString()}, ซ้ำในระบบ ${result.existingInDbCount.toLocaleString()})`
        : `นำเข้าข้อมูลสำเร็จ: เพิ่มใหม่ ${result.insertedCount.toLocaleString()} รายการ, อัปเดต ${result.updatedCount.toLocaleString()} รายการ, ข้าม ${result.skippedCount.toLocaleString()} รายการ`,
    })
  } catch (error: unknown) {
    if (error instanceof GatewayUnavailableError) {
      const isTimeout = /timed out after/i.test(error.message)
      logger.error(
        { error: error.message, details: error.details, isTimeout },
        'API Gateway unavailable during Seamless import'
      )
      return NextResponse.json(
        {
          success: false,
          error: isTimeout
            ? 'API Gateway ใช้เวลาประมวลผลนานเกินกำหนด (Timeout) ข้อมูลบางส่วนอาจถูกบันทึกแล้ว กรุณาตรวจสอบสถานะหรือนำเข้าไฟล์นี้อีกครั้ง'
            : 'ไม่สามารถเชื่อมต่อ API Gateway ของโรงพยาบาลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
        },
        { status: isTimeout ? 504 : 503 }
      )
    }
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
