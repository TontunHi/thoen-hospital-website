import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roles'
import { hospitalAssetService } from '@/lib/assets/assetService'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const UpdateAssetSchema = z.object({
  articleNum: z.string().min(1, 'กรุณาระบุเลขครุภัณฑ์').optional(),
  fsnNum: z.string().nullable().optional(),
  name: z.string().min(1, 'กรุณาระบุชื่อครุภัณฑ์').optional(),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNo: z.string().nullable().optional(),
  category: z.enum(['IT', 'MEDICAL', 'GENERAL']).optional(),
  locationId: z.union([z.number(), z.string()]).nullable().optional(),
  locationFullName: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  custodianId: z.union([z.number(), z.string()]).nullable().optional(),
  receivedDate: z.string().nullable().optional(),
  warrantyStartDate: z.string().nullable().optional(),
  warrantyEndDate: z.string().nullable().optional(),
  expireDate: z.string().nullable().optional(),
  price: z.union([z.number(), z.string()]).nullable().optional(),
  vendorName: z.string().nullable().optional(),
  vendorContact: z.string().nullable().optional(),
  contractNo: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'IN_REPAIR', 'STANDBY', 'DISPOSED']).optional(),
  imageUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

// GET: Single Asset Details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('manage_assets')
  if (auth.error) return auth.error

  const { id } = await params
  const assetId = parseInt(id, 10)
  if (isNaN(assetId)) {
    return NextResponse.json({ error: 'รหัสครุภัณฑ์ไม่ถูกต้อง' }, { status: 400 })
  }

  try {
    const asset = await hospitalAssetService.getAssetById(assetId)
    if (!asset) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลครุภัณฑ์' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: asset })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลครุภัณฑ์: ' + error.message },
      { status: 500 }
    )
  }
}

// PUT: Update an existing asset
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('manage_assets')
  if (auth.error) return auth.error

  const { id } = await params
  const assetId = parseInt(id, 10)
  if (isNaN(assetId)) {
    return NextResponse.json({ error: 'รหัสครุภัณฑ์ไม่ถูกต้อง' }, { status: 400 })
  }

  try {
    const existing = await hospitalAssetService.getAssetById(assetId)
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลครุภัณฑ์ที่ต้องการแก้ไข' }, { status: 404 })
    }

    const body = await request.json()
    const validation = UpdateAssetSchema.safeParse(body)
    if (!validation.success) {
      const errorMsg = validation.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง'
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    const input = validation.data

    // If changing articleNum, verify no conflict
    if (input.articleNum && input.articleNum !== existing.articleNum) {
      const duplicate = await hospitalAssetService.getAssetByArticleNum(input.articleNum)
      if (duplicate && duplicate.id !== assetId) {
        return NextResponse.json(
          { error: `เลขครุภัณฑ์ "${input.articleNum}" มีอยู่ในระบบแล้ว` },
          { status: 409 }
        )
      }
    }

    const updated = await hospitalAssetService.updateAsset(assetId, {
      ...input,
      locationId: input.locationId !== undefined ? (input.locationId ? Number(input.locationId) : null) : undefined,
      custodianId: input.custodianId !== undefined ? (input.custodianId ? Number(input.custodianId) : null) : undefined,
      price: input.price !== undefined ? (input.price ? Number(input.price) : null) : undefined,
    })

    await logAudit(
      'UPDATE',
      'hospital_assets',
      `แก้ไขข้อมูลครุภัณฑ์ ID ${assetId}: ${updated.articleNum} (${updated.name})`,
      auth.session
    )

    return NextResponse.json({
      success: true,
      message: 'แก้ไขข้อมูลครุภัณฑ์สำเร็จ',
      data: updated,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขครุภัณฑ์: ' + error.message },
      { status: 500 }
    )
  }
}

// DELETE: Remove an asset
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('manage_assets')
  if (auth.error) return auth.error

  const { id } = await params
  const assetId = parseInt(id, 10)
  if (isNaN(assetId)) {
    return NextResponse.json({ error: 'รหัสครุภัณฑ์ไม่ถูกต้อง' }, { status: 400 })
  }

  try {
    const existing = await hospitalAssetService.getAssetById(assetId)
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลครุภัณฑ์ที่ต้องการลบ' }, { status: 404 })
    }

    await hospitalAssetService.deleteAsset(assetId)

    await logAudit(
      'DELETE',
      'hospital_assets',
      `ลบข้อมูลครุภัณฑ์ ID ${assetId}: ${existing.articleNum} (${existing.name})`,
      auth.session
    )

    return NextResponse.json({
      success: true,
      message: `ลบข้อมูลครุภัณฑ์ "${existing.name}" (${existing.articleNum}) สำเร็จ`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบครุภัณฑ์: ' + error.message },
      { status: 500 }
    )
  }
}
