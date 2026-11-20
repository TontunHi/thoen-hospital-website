import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { OnlineMediaService } from '@/lib/media/onlineMediaService'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    let isAuthenticated = false
    try {
      const session = await verifyMemberSession()
      isAuthenticated = Boolean(session)
    } catch {
      isAuthenticated = false
    }

    const result = await OnlineMediaService.getMediaItemBySlugOrId(slug, { isAuthenticated })
    if (result.requiresAuth) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบบุคลากรเพื่อเข้าชมสื่อภายใน' },
        { status: 401 }
      )
    }

    if (!result.item) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบสื่อออนไลน์ที่ระบุ' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          item: result.item,
          isAuthenticated,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Fetch media detail error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสื่อออนไลน์' },
      { status: 500 }
    )
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const session = await verifyMemberSession().catch(() => null)
    const isAuthenticated = Boolean(session)

    const result = await OnlineMediaService.getMediaItemBySlugOrId(slug, { isAuthenticated })
    if (result.requiresAuth) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    if (!result.item) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบสื่อออนไลน์ที่ระบุ' },
        { status: 404 }
      )
    }

    let viewer: { memberId: number; memberName: string; memberDepartment?: string | null } | null = null
    if (session) {
      const member = await fetchAuthenticatedMember(session.username, session.email)
      if (member) {
        viewer = {
          memberId: member.id,
          memberName: member.name || member.username,
          memberDepartment: member.department,
        }
      }
    }

    await OnlineMediaService.recordMediaView(result.item.id, viewer)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Record media view error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกสถิติการเข้าชม' },
      { status: 500 }
    )
  }
}
