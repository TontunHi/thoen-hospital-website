import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roles'
import { hospitalAssetService } from '@/lib/assets/assetService'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const CreateAssetSchema = z.object({
  articleNum: z.string().min(1, 'กรุณาระบุเลขครุภัณฑ์'),
  fsnNum: z.string().nullable().optional(),
  name: z.string().min(1, 'กรุณาระบุชื่อครุภัณฑ์'),
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

// GET: Retrieve list of assets with filters
export async function GET(request: Request) {
  const auth = await requirePermission('manage_assets')
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined
    const warrantyStatus = searchParams.get('warrantyStatus') || undefined
    const department = searchParams.get('department') || undefined
    const status = searchParams.get('status') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const sortBy = (searchParams.get('sortBy') as any) || 'receivedDate'
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc'

    const result = await hospitalAssetService.getAssets({
      search,
      category,
      warrantyStatus,
      department,
      status,
      page,
      limit,
      sortBy,
      sortOrder,
    })

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลครุภัณฑ์: ' + error.message },
      { status: 500 }
    )
  }
}

// POST: Create a new asset
export async function POST(request: Request) {
  const auth = await requirePermission('manage_assets')
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const validation = CreateAssetSchema.safeParse(body)
    if (!validation.success) {
      const errorMsg = validation.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง'
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    const input = validation.data
    // Check duplicate
    const existing = await hospitalAssetService.getAssetByArticleNum(input.articleNum)
    if (existing) {
      return NextResponse.json(
        { error: `เลขครุภัณฑ์ "${input.articleNum}" มีอยู่ในระบบแล้ว` },
        { status: 409 }
      )
    }

    const created = await hospitalAssetService.createAsset({
      ...input,
      locationId: input.locationId ? Number(input.locationId) : null,
      custodianId: input.custodianId ? Number(input.custodianId) : null,
      price: input.price ? Number(input.price) : null,
    })

    await logAudit(
      'CREATE',
      'hospital_assets',
      `เพิ่มครุภัณฑ์ใหม่: ${created.articleNum} (${created.name})`,
      auth.session
    )

    return NextResponse.json({
      success: true,
      message: 'บันทึกข้อมูลครุภัณฑ์สำเร็จ',
      data: created,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มครุภัณฑ์: ' + error.message },
      { status: 500 }
    )
  }
}
