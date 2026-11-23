import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
import { SalaryPortalService } from '@/lib/salary/salaryPortalService'
import { logger } from '@/lib/logger'

async function checkFinanceAccess() {
  const session = await verifyMemberSession()
  if (!session) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน', status: 401 }
  }
  const access = await SalaryPortalService.verifyFinanceUploadAccess(session)
  if (!access.allowed) {
    return { error: access.error, status: access.status || 403 }
  }
  return { success: true }
}

export async function GET() {
  try {
    const auth = await checkFinanceAccess()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const periods = await apiGateway.salary.getPeriods()
    return NextResponse.json({ success: true, periods })
  } catch (error) {
    logger.error({ err: error }, 'Fetch salary periods error')
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลรอบการจ่ายเงินได้' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await checkFinanceAccess()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { type, datein, notesalary } = body

    if (!type || !datein) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลประเภทและวันที่ให้ครบถ้วน' },
        { status: 400 }
      )
    }

    await apiGateway.salary.createPeriod({
      type: type.toString(),
      datein,
      notesalary: notesalary || '',
    })

    return NextResponse.json({
      success: true,
      message: 'บันทึกรอบการจ่ายเงินสำเร็จ',
    })
  } catch (error) {
    logger.error({ err: error }, 'Create salary period error')
    return NextResponse.json(
      { error: 'ไม่สามารถบันทึกรอบการจ่ายเงินได้' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await checkFinanceAccess()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { id, type, datein, notesalary } = body

    if (!id || !type || !datein) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลรหัสรอบ ประเภท และวันที่ให้ครบถ้วน' },
        { status: 400 }
      )
    }

    await apiGateway.salary.updatePeriod(id, {
      type: type.toString(),
      datein,
      notesalary: notesalary || null,
    })

    return NextResponse.json({
      success: true,
      message: 'แก้ไขรอบการจ่ายเงินสำเร็จ',
    })
  } catch (error) {
    logger.error({ err: error }, 'Update salary period error')
    return NextResponse.json(
      { error: 'ไม่สามารถแก้ไขรอบการจ่ายเงินได้' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await checkFinanceAccess()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ไม่ระบุรหัสของรอบการจ่ายเงินที่ต้องการลบ' },
        { status: 400 }
      )
    }

    await apiGateway.salary.deletePeriod(id)

    return NextResponse.json({
      success: true,
      message: 'ลบรอบการจ่ายเงินเรียบร้อยแล้ว',
    })
  } catch (error) {
    logger.error({ err: error }, 'Delete salary period error')
    return NextResponse.json(
      { error: 'ไม่สามารถลบรอบการจ่ายเงินได้' },
      { status: 500 }
    )
  }
}
