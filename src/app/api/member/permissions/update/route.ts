import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const updateSchema = z.object({
  memberId: z.number().int().positive('รหัสสมาชิกต้องเป็นจำนวนเต็มบวก'),
  permissions: z.array(z.string().max(100, 'ชื่อสิทธิ์ต้องไม่เกิน 100 ตัวอักษร')),
})

// POST: Atomically update individual permissions for a specific member
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

    const parseResult = updateSchema.safeParse(body)
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

    const { memberId, permissions } = parseResult.data
    const uniquePermissions = Array.from(
      new Set(permissions.map((p) => p.trim()).filter(Boolean))
    )

    // Execute atomic replacement in transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Delete all existing permissions for this member
      await tx.memberPermission.deleteMany({
        where: { memberId },
      })

      // 2. Insert new permissions if any
      if (uniquePermissions.length > 0) {
        await tx.memberPermission.createMany({
          data: uniquePermissions.map((permissionKey) => ({
            memberId,
            permissionKey,
            createdBy: session.username,
          })),
        })
      }
    })

    // Call audit logging
    await logAudit(
      'UPDATE_MEMBER_PERMISSIONS' as any,
      'members',
      `Updated permissions for member ${memberId}`,
      {
        memberId,
        permissions: uniquePermissions,
        admin: session.username,
        username: session.username,
        email: session.email,
      } as any
    )

    return NextResponse.json({
      success: true,
      message: 'บันทึกสิทธิ์เรียบร้อยแล้ว',
    })
  } catch (error: any) {
    logger.error({ error }, 'Update member permissions error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์' },
      { status: 500 }
    )
  }
}
