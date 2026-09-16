import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { actionType, targetTable, actionDetails } = body

    if (!actionType || !targetTable) {
      return NextResponse.json({ error: 'Invalid audit payload' }, { status: 400 })
    }

    await logAudit(
      actionType,
      targetTable,
      typeof actionDetails === 'string' ? actionDetails.slice(0, 1000) : '',
      { username: session.username, email: session.email }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Audit log API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
