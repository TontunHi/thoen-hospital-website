import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    // Even if not logged in, we can still record public requests as guest
    const body = await request.json()
    const { actionType, targetTable, actionDetails } = body

    await logAudit(
      actionType || 'REQUEST',
      targetTable || 'unknown',
      actionDetails || '',
      session ? { username: session.username, email: session.email } : null
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Audit log API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
