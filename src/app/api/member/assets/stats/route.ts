import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roles'
import { hospitalAssetService } from '@/lib/assets/assetService'

// GET: Retrieve summary statistics for asset dashboard
export async function GET() {
  const auth = await requirePermission('manage_assets')
  if (auth.error) return auth.error

  try {
    const stats = await hospitalAssetService.getAssetStats()
    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงสถิติครุภัณฑ์: ' + error.message },
      { status: 500 }
    )
  }
}
