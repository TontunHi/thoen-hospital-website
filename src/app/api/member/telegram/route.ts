import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { getMemberTelegramLink, createTelegramLinkChallenge, unlinkMemberTelegram } from '@/lib/telegramService'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

/**
 * GET: Retrieve the member's current Telegram link status
 */
export async function GET() {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const status = await getMemberTelegramLink(member.id)

    return NextResponse.json({ success: true, data: status })
  } catch (error: any) {
    logger.error({ error }, 'Error getting telegram link status')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST: Create a one-time linking challenge (token + bot deep link)
 */
export async function POST() {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const challenge = await createTelegramLinkChallenge(member.id)

    await logAudit(
      'REQUEST',
      'telegram_link_challenges',
      `Member requested Telegram link challenge token for member_id: ${member.id}`,
      member.session
    )

    return NextResponse.json({
      success: true,
      data: {
        botUrl: challenge.botUrl,
        expiresAt: challenge.expiresAt.toISOString(),
      },
    })
  } catch (error: any) {
    logger.error({ error }, 'Error creating telegram link challenge')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * DELETE: Unlink Telegram account from this member
 */
export async function DELETE() {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    await unlinkMemberTelegram(member.id)

    await logAudit(
      'DELETE',
      'member_telegram_links',
      `Member unlinked Telegram account for member_id: ${member.id}`,
      member.session
    )

    return NextResponse.json({ success: true, message: 'Unlinked successfully' })
  } catch (error: any) {
    logger.error({ error }, 'Error unlinking telegram')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
