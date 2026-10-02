import { prisma } from '@/lib/prisma'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

export interface EthicsDocumentNode {
  id: number
  title: string
  fileUrl?: string
  displayOrder: number
  subItems?: Omit<EthicsDocumentNode, 'subItems'>[]
}

export interface EthicsYearNode {
  id: number
  year: string
  displayOrder: number
  documents: EthicsDocumentNode[]
}

export interface CreateEthicsDocumentInput {
  yearId: number
  parentId?: number | null
  title: string
  displayOrder?: number
  isActive?: boolean
  file?: File | null
}

export interface EthicsDocumentResponse {
  id: number
  yearId: number
  parentId: number | null
  title: string
  filePath: string | null
  fileSize: string | null
  displayOrder: number
  isActive: boolean
}

const documentSchema = z.object({
  yearId: z.coerce.number().int(),
  parentId: z.coerce.number().int().optional().nullable(),
  title: z.string().trim().min(1, 'กรุณาระบุชื่อเอกสาร').max(500),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

export class EthicsDocumentService {
  static async getDocumentTree(): Promise<EthicsYearNode[]> {
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

    return years.map((yearItem: any) => {
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
  }

  static async getYears(): Promise<any[]> {
    const years = await prisma.ethicsYear.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { year: 'desc' }
      ],
      include: {
        documents: {
          orderBy: [
            { displayOrder: 'asc' },
            { id: 'asc' }
          ]
        }
      }
    })

    return years.map((y: any) => ({
      ...y,
      documents: y.documents.map((d: any) => ({
        ...d,
        fileSize: d.fileSize ? d.fileSize.toString() : null
      }))
    }))
  }

  static async createDocument(
    input: CreateEthicsDocumentInput, 
    actor: { username: string; session?: any }
  ): Promise<EthicsDocumentResponse> {
    const parsed = documentSchema.safeParse({
      yearId: input.yearId,
      parentId: input.parentId,
      title: input.title,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
    })

    if (!parsed.success) {
      throw new Error(parsed.error.issues.map(i => i.message).join(', '))
    }

    const { yearId, parentId, title, displayOrder, isActive } = parsed.data

    const yearRecord = await prisma.ethicsYear.findUnique({
      where: { id: yearId }
    })
    if (!yearRecord) {
      throw new Error('ไม่พบปีงบประมาณที่ระบุ')
    }

    let filePath: string | null = null
    let fileSize: bigint | null = null

    if (input.file && input.file.size > 0) {
      const saved = await DocumentStorage.save(input.file, {
        destinationDir: `public/documents/ethics/${yearRecord.year}`,
        allowedMimeTypes: ['application/pdf'],
        allowedExtensions: ['.pdf'],
        maxSizeBytes: 25 * 1024 * 1024,
        collisionStrategy: 'timestamp',
      })
      filePath = saved.publicUrl
      fileSize = BigInt(saved.fileSize)
    }

    const created = await prisma.ethicsDocument.create({
      data: {
        yearId,
        parentId,
        title,
        filePath,
        fileSize,
        displayOrder,
        isActive,
      }
    })

    await logAudit(
      'CREATE',
      'ethics_documents',
      `เพิ่มเอกสารจริยธรรม "${title}" ปี ${yearRecord.year} โดย ${actor.username}`,
      actor.session
    )

    return {
      ...created,
      fileSize: created.fileSize ? created.fileSize.toString() : null
    }
  }

  static async deleteDocument(
    id: string, 
    actorId: string, 
    actorSession?: any
  ): Promise<void> {
    const docId = parseInt(id, 10)
    if (isNaN(docId)) throw new Error('Invalid ID')

    const existing = await prisma.ethicsDocument.findUnique({
      where: { id: docId },
      include: { children: true }
    })
    
    if (!existing) {
      throw new Error('ไม่พบเอกสารที่ต้องการลบ')
    }

    // Delete child files
    for (const child of existing.children) {
      if (child.filePath) {
        await DocumentStorage.delete(child.filePath)
      }
    }
    // Delete parent file
    if (existing.filePath) {
      await DocumentStorage.delete(existing.filePath)
    }

    await prisma.ethicsDocument.delete({
      where: { id: docId }
    })

    await logAudit(
      'DELETE',
      'ethics_documents',
      `ลบเอกสารจริยธรรม "${existing.title}" (ID: ${docId}) พร้อมเอกสารย่อย โดย ${actorId}`,
      actorSession
    )
  }
}
