import { NextResponse } from 'next/server'
import { destroyMemberSession } from '@/lib/memberAuth'

export async function POST() {
  try {
    await destroyMemberSession()
    return NextResponse.json({ success: true, message: 'ออกจากระบบเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Member logout error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการออกจากระบบ' },
      { status: 500 }
    )
  }
}
