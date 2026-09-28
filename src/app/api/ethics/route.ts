import { NextResponse } from 'next/server'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    let canManage = false
    try {
      const session = await verifyMemberSession()
      if (session) {
        canManage = await checkPositionPermission(session.username, 'manage_ethics')
      }
    } catch {
      // Public guest, not logged in
    }

    const years = await prisma.ethicsYear.findMany({
      where: { isActive: true },
      orderBy: [
        { year: 'desc' },
        { displayOrder: 'desc' }
      ],
      include: {
        documents: {
          where: { isActive: true },
          orderBy: [
            { displayOrder: 'asc' },
            { id: 'asc' }
          ]
        }
      }
    })

    // Organize documents into parent and children subItems
    const formattedYears = years.map((yearItem: any) => {
      const parentDocs = yearItem.documents.filter((doc: any) => !doc.parentId)
      const allChildren = yearItem.documents.filter((doc: any) => doc.parentId)

      const structuredDocs = parentDocs.map((parent: any) => {
        const subItems = allChildren
          .filter((child: any) => child.parentId === parent.id)
          .map((child: any) => ({
            id: child.id,
            title: child.title,
            fileUrl: child.filePath || '',
            displayOrder: child.displayOrder
          }))

        return {
          id: parent.id,
          title: parent.title,
          fileUrl: parent.filePath || undefined,
          displayOrder: parent.displayOrder,
          subItems: subItems.length > 0 ? subItems : undefined
        }
      })

      return {
        id: yearItem.id,
        year: yearItem.year,
        displayOrder: yearItem.displayOrder,
        documents: structuredDocs
      }
    })

    return NextResponse.json({
      success: true,
      canManage,
      years: formattedYears
    })
  } catch (error: any) {
    console.error('Fetch public ethics error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสารจริยธรรม' }, { status: 500 })
  }
}
