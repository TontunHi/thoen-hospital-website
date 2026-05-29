import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'
import { destroyRefreshToken } from '@/lib/refreshToken'

export async function POST() {
  try {
    await destroySession()
    await destroyRefreshToken()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการออกจากระบบ' },
      { status: 500 }
    )
  }
}
