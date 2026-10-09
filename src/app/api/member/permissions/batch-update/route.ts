import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const batchSchema = z.object({
  updates: z
    .array(
      z.object({
        memberId: z.number().int().positive('รหัสสมาชิกต้องเป็นจำนวนเต็มบวก'),
        permissions: z.array(z.string()),
      })
    )
    .min(1, 'ต้องมีข้อมูลอย่างน้อย 1 รายการ'),
})

// POST: Atomically update permissions for multiple members in a single transaction
export async function POST(request: Request) {
  try {
    const auth = await requireRole(['admin'])
    if (auth.error) return auth.error
    const session = auth.session

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const parseResult = batchSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'ข้อมูลไม่ถูกต้อง',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { updates } = parseResult.data

    // Execute atomic batch replacement in a single database transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of updates) {
        const cleanPerms = Array.from(
          new Set(item.permissions.map((p) => p.trim()).filter(Boolean))
        )

        // 1. Delete all existing permissions for this member
        await tx.memberPermission.deleteMany({
          where: { memberId: item.memberId },
        })

        // 2. Insert new cleaned permissions if any
        if (cleanPerms.length > 0) {
          await tx.memberPermission.createMany({
            data: cleanPerms.map((permissionKey) => ({
              memberId: item.memberId,
              permissionKey,
              createdBy: session.username,
            })),
          })
        }
      }
    })

    // Call audit logging
    await logAudit(
      'BATCH_UPDATE_MEMBER_PERMISSIONS' as any,
      'members',
      JSON.stringify({
        updatedCount: updates.length,
        memberIds: updates.map((u) => u.memberId),
      }),
      session
    )

    return NextResponse.json({
      success: true,
      message: 'บันทึกสิทธิ์แบบกลุ่มเรียบร้อยแล้ว',
      updatedCount: updates.length,
    })
  } catch (error: any) {
    logger.error({ error }, 'Batch update member permissions error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์' },
      { status: 500 }
    )
  }
}
