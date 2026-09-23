import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { getMemberTelegramLink, createTelegramLinkChallenge, unlinkMemberTelegram } from '@/lib/telegramService'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

/**
 * GET: Retrieve the member's current Telegram link status
 */
export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const members = await queryMemberDb('SELECT id FROM members WHERE username = ? LIMIT 1', [session.username])
    if (!members || members.length === 0) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    const memberId = members[0].id
    const status = await getMemberTelegramLink(memberId)

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
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const members = await queryMemberDb('SELECT id, name FROM members WHERE username = ? LIMIT 1', [session.username])
    if (!members || members.length === 0) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    const memberId = members[0].id
    const challenge = await createTelegramLinkChallenge(memberId)

    await logAudit(
      'REQUEST',
      'telegram_link_challenges',
      `Member requested Telegram link challenge token for member_id: ${memberId}`
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
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const members = await queryMemberDb('SELECT id FROM members WHERE username = ? LIMIT 1', [session.username])
    if (!members || members.length === 0) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    const memberId = members[0].id
    await unlinkMemberTelegram(memberId)

    await logAudit(
      'DELETE',
      'member_telegram_links',
      `Member unlinked Telegram account for member_id: ${memberId}`
    )

    return NextResponse.json({ success: true, message: 'Unlinked successfully' })
  } catch (error: any) {
    logger.error({ error }, 'Error unlinking telegram')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
