import { NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { verifyRefreshToken, createRefreshToken } from '@/lib/refreshToken'

/**
 * POST /api/auth/refresh
 * 
 * Exchanges a valid refresh token for a new session token.
 * The refresh token (8-hour lifetime) allows users to get new
 * session tokens (30-minute lifetime) without re-entering credentials.
 */
export async function POST() {
  try {
    const refreshData = await verifyRefreshToken()

    if (!refreshData) {
      return NextResponse.json(
        { error: 'รีเฟรชโทเค็นหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' },
        { status: 401 }
      )
    }

    // Issue new session token
    await createSession(refreshData.adminId, refreshData.role)

    // Issue new refresh token (rotate for security)
    await createRefreshToken(refreshData.adminId, refreshData.role)

    return NextResponse.json({
      success: true,
      message: 'รีเฟรชเซสชันสำเร็จ',
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการรีเฟรชเซสชัน' },
      { status: 500 }
    )
  }
}
