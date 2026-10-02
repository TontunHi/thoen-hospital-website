import { NextResponse } from 'next/server'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { EthicsDocumentService } from '@/lib/cms/EthicsDocumentService'

export async function GET() {
  try {
    let canManage = false
    try {
      const session = await verifyMemberSession()
      if (session) {
        canManage = await checkPositionPermission(session.username, 'manage_ethics')
      }
    } catch {
      // Public guest, not logged in
    }

    const formattedYears = await EthicsDocumentService.getDocumentTree()

    return NextResponse.json({
      success: true,
      canManage,
      years: formattedYears
    })
  } catch (error: any) {
    console.error('Fetch public ethics error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสารจริยธรรม' }, { status: 500 })
  }
}
