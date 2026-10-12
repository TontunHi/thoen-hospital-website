import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'
import { sendTelegramMessage } from '@/lib/telegramService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function POST() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    if (session.role !== 'admin' && session.role !== 'staff') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: ไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้' },
        { status: 403 }
      )
    }

    const chatId = process.env.TELEGRAM_IPD_CHAT_ID || process.env.TELEGRAM_CHAT_ID

    if (!chatId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ยังไม่ได้ระบุ TELEGRAM_IPD_CHAT_ID หรือ TELEGRAM_CHAT_ID ในการตั้งค่าระบบ (.env)',
        },
        { status: 400 }
      )
    }

    const reportData = await RcmDashboardService.getIpdDoctorChartSummary()
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://thlp.moph.go.th'
    const appUrl = `${baseUrl.replace(/\/+$/, '')}/service/dashboard-rcm/ipd`
    const message = RcmDashboardService.formatTelegramChartSummary(reportData, appUrl)

    const result = await sendTelegramMessage(chatId, message, 'HTML')

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: `เกิดข้อผิดพลาดในการส่งข้อความ: ${result.error || 'Telegram delivery failed'}`,
        },
        { status: 502 }
      )
    }

    logThrottledAudit(
      'UPDATE',
      'telegram_notify_ipd',
      `Sent IPD pending charts summary to Telegram (chatId: ${chatId})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Telegram notify audit log failed'))

    return NextResponse.json({
      success: true,
      message: 'ส่งข้อความสรุปชาร์ตค้าง IPD เข้ากลุ่ม Telegram สำเร็จเรียบร้อยแล้ว',
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/telegram-notify Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน Telegram' },
      { status: 500 }
    )
  }
}
