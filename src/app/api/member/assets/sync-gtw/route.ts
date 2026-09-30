import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roles'
import { hospitalAssetService } from '@/lib/assets/assetService'
import { logAudit } from '@/lib/audit'

// POST: Trigger GTW sync to hospital_assets
export async function POST(request: Request) {
  const auth = await requirePermission('manage_assets')
  if (auth.error) return auth.error

  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit ? parseInt(body.limit, 10) : undefined

    const result = await hospitalAssetService.syncFromGtw(undefined, { limit })

    await logAudit(
      'UPDATE',
      'hospital_assets',
      `ซิงค์ข้อมูลครุภัณฑ์จาก GTW: พบ ${result.totalFound} รายการ, เพิ่มใหม่ ${result.inserted}, อัปเดต ${result.updated}, ผิดพลาด ${result.errors}`,
      auth.session
    )

    return NextResponse.json({
      success: true,
      message: `ซิงค์ข้อมูลจาก GTW เรียบร้อยแล้ว (เพิ่มใหม่: ${result.inserted}, ปรับปรุง: ${result.updated})`,
      data: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลจาก GTW: ' + error.message },
      { status: 500 }
    )
  }
}
