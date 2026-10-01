import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roles'
import { SalaryBatchService } from '@/lib/salary/salaryBatchService'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('upload_salary')
    if (auth.error || !auth.session) {
      return auth.error
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'salary' | 'ot'

    if (!type || (type !== 'salary' && type !== 'ot')) {
      return NextResponse.json(
        { error: 'กรุณาระบุประเภทตารางข้อมูลที่ถูกต้อง (salary หรือ ot)' },
        { status: 400 }
      )
    }

    const latestBatch = await SalaryBatchService.getLatestBatchSummary(type)

    return NextResponse.json({
      success: true,
      latestBatch,
    })
  } catch (error: any) {
    console.error('Fetch latest salary batch error:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลชุดข้อมูลล่าสุดได้' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requirePermission('upload_salary')
    if (auth.error || !auth.session) {
      return auth.error
    }

    const body = await request.json()
    const { type, confirmedDate } = body

    if (!type || (type !== 'salary' && type !== 'ot')) {
      return NextResponse.json(
        { error: 'กรุณาระบุประเภทตารางข้อมูลที่ถูกต้อง (salary หรือ ot)' },
        { status: 400 }
      )
    }

    if (!confirmedDate || typeof confirmedDate !== 'string') {
      return NextResponse.json(
        { error: 'กรุณาระบุวันที่ของชุดข้อมูลที่ต้องการลบ' },
        { status: 400 }
      )
    }

    const result = await SalaryBatchService.deleteLatestBatch({
      type,
      confirmedDate,
      user: auth.session,
    })

    return NextResponse.json({
      success: true,
      message: `ลบชุดข้อมูล ${type === 'salary' ? 'เงินเดือน' : 'ค่าเวร/OT'} ประจำงวดวันที่ ${result.deletedDate} เรียบร้อยแล้ว ทั้งหมด ${result.deletedCount} รายการ`,
      deletedCount: result.deletedCount,
      deletedDate: result.deletedDate,
    })
  } catch (error: any) {
    console.error('Delete salary batch error:', error)
    return NextResponse.json(
      { error: error?.message || 'เกิดข้อผิดพลาดในการลบชุดข้อมูล' },
      { status: error?.message?.includes('ข้อมูลมีการเปลี่ยนแปลง') ? 409 : 500 }
    )
  }
}
