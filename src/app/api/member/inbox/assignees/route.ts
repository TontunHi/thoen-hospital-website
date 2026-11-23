import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { TaskInboxApiService } from '@/lib/inbox/taskInboxApiService'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const members = await TaskInboxApiService.listAssignees()
    return NextResponse.json({
      success: true,
      data: members,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}
