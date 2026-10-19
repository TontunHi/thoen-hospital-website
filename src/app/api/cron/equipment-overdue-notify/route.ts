import { NextResponse } from 'next/server'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import { logger } from '@/lib/logger'

/**
 * Automated Equipment Overdue Notification Cron Endpoint
 *
 * Runs daily at 15:00 (Asia/Bangkok) to notify borrowers whose loan period
 * has expired (> 1 day overdue) directly via Telegram Bot DM.
 *
 * Protected with CRON_SECRET bearer token.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid cron secret' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const siteUrl = searchParams.get('siteUrl') || process.env.NEXT_PUBLIC_SITE_URL

    const result = await equipmentBorrowService.dispatchOverdueNotifications({
      siteUrl: siteUrl || undefined,
    })

    logger.info(
      {
        totalOverdue: result.totalOverdue,
        sentCount: result.sentCount,
        skippedCount: result.skippedNoTelegramCount,
        failedCount: result.failedCount,
      },
      'Equipment overdue notification cron job completed'
    )

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error({ error }, 'Equipment overdue notification cron job failed')
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error in overdue notification job' },
      { status: 500 }
    )
  }
}
