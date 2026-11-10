import { NextResponse } from 'next/server'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    if (session.role === 'subdistrict') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้' }, { status: 403 })
    }

    // Check if member has management permission
    const canManage = await checkPositionPermission(session.username, 'manage_outgoing_doc')

    const documents = await apiGateway.app.getOutgoingDocuments({ activeOnly: true, order: 'service' })

    return NextResponse.json({
      success: true,
      canManage,
      documents
    })
  } catch (error: any) {
    console.error('Fetch outgoing documents error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลหนังสือส่งออก' }, { status: 500 })
  }
}
