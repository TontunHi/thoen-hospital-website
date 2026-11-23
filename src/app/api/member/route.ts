import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import {
  MemberProfileError,
  MemberProfileService,
} from '@/lib/auth/memberProfileService'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const { error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const members = await MemberProfileService.listAllMembersForAdmin()
    return NextResponse.json({ success: true, members })
  } catch (error) {
    logger.error({ err: error }, 'Fetch members error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const body = await request.json()
    await MemberProfileService.updateMemberByAdmin(body, {
      username: member.username || '',
      email: member.email || '',
    })

    return NextResponse.json({
      success: true,
      message: 'แก้ไขข้อมูลสมาชิกเรียบร้อยแล้ว',
    })
  } catch (error) {
    if (error instanceof MemberProfileError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Update member error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลสมาชิก' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    await MemberProfileService.deleteMemberByAdmin(searchParams.get('id'), {
      username: member.username || '',
      email: member.email || '',
    })

    return NextResponse.json({
      success: true,
      message: 'ลบสมาชิกเรียบร้อยแล้ว',
    })
  } catch (error) {
    if (error instanceof MemberProfileError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Delete member error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูลสมาชิก' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const body = await request.json()
    await MemberProfileService.createMemberByAdmin(body, {
      username: member.username || '',
      email: member.email || '',
    })

    return NextResponse.json({
      success: true,
      message: 'เพิ่มสมาชิกใหม่เรียบร้อยแล้ว',
    })
  } catch (error) {
    if (error instanceof MemberProfileError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Create member error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างสมาชิกใหม่' },
      { status: 500 }
    )
  }
}
