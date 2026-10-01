import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roles'
import { SalaryBatchService } from '@/lib/salary/salaryBatchService'

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('upload_salary')
    if (auth.error || !auth.session) {
      return auth.error
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as 'salary' | 'ot'

    if (!file || !type || (type !== 'salary' && type !== 'ot')) {
      return NextResponse.json(
        { error: 'กรุณาระบุไฟล์และประเภทนำเข้าที่ถูกต้อง' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const batch = SalaryBatchService.parseBatchBuffer(buffer, type)
    const { insertedCount } = await SalaryBatchService.ingestBatch(batch)

    return NextResponse.json({
      success: true,
      message: `นำเข้าข้อมูลเรียบร้อยแล้ว ทั้งหมด ${insertedCount} รายการ`,
      count: insertedCount,
    })
  } catch (error: any) {
    console.error('CSV upload error:', error)
    return NextResponse.json(
      { error: error?.message || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์และบันทึกข้อมูล' },
      { status: 500 }
    )
  }
}
