import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

// GET: Retrieve list of members with their individual permissions
export async function GET(request: Request) {
  try {
    const auth = await requireRole(['admin'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const hasPermissionsOnlyParam = searchParams.get('hasPermissionsOnly')
    const hasPermissionsOnly =
      hasPermissionsOnlyParam === 'true' || hasPermissionsOnlyParam === '1'

    const where: Prisma.MemberWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { username: { contains: search } },
        { department: { contains: search } },
      ]
    }

    if (hasPermissionsOnly) {
      where.member_permissions = {
        some: {},
      }
    }

    const members = await prisma.member.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        department: true,
        position: true,
        role: true,
        member_permissions: {
          select: {
            permissionKey: true,
          },
        },
      },
      orderBy: [
        { department: 'asc' },
        { name: 'asc' },
      ],
    })

    const formattedMembers = members.map((m: {
      id: number
      username: string
      name: string | null
      department: string | null
      position: string | null
      role: string | null
      member_permissions: Array<{ permissionKey: string }>
    }) => ({
      id: m.id,
      username: m.username,
      name: m.name ?? '',
      department: m.department ?? '',
      position: m.position ?? '',
      role: m.role ?? 'member',
      permissions: m.member_permissions.map((p: { permissionKey: string }) => p.permissionKey),
    }))

    return NextResponse.json({
      success: true,
      data: {
        members: formattedMembers,
      },
    })
  } catch (error: any) {
    logger.error({ error }, 'Fetch member permissions error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์บุคลากร' },
      { status: 500 }
    )
  }
}
