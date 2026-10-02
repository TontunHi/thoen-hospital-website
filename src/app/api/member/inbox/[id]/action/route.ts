import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { executeWorkflowAction } from '@/lib/taskInboxService'
import { z } from 'zod'

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'SEND_BACK']),
  comment: z.string().optional(),
  nextAssigneeId: z.number().nullable().optional(),
  partialEdits: z.any().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id: taskId } = await params
    const body = await request.json()
    const parsed = actionSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Action ไม่ถูกต้อง' }, { status: 400 })
    }
    
    const { action, comment, nextAssigneeId, partialEdits } = parsed.data

    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role, signature_path FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]

    const result = await executeWorkflowAction({
      taskId,
      action,
      comment,
      nextAssigneeId: nextAssigneeId || null,
      partialEdits,
      actorMemberId: currentMember.id,
      actorUsername: currentMember.username,
      actorName: currentMember.name,
      actorPosition: currentMember.position,
      actorRole: currentMember.role,
      signaturePath: currentMember.signature_path,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Task action error:', error)
    if (error.message.includes('ไม่มีสิทธิ์')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error.message.includes('ไม่พบ')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message.includes('ไม่อยู่ในสถานะ')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลคำสั่ง' }, { status: 500 })
  }
}
