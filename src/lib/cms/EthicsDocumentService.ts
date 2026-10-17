import { queryMemberDb } from '@/lib/memberDb'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { logAudit } from '@/lib/audit'
import { getSwrCachedData, invalidateCacheKey } from '@/lib/cache'
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
    return getSwrCachedData(
      'ethics:tree',
      async () => {
        const [years, documents] = await Promise.all([
          queryMemberDb(`
            SELECT id, year, display_order AS displayOrder, is_active AS isActive
            FROM ethics_years
            WHERE is_active = 1
            ORDER BY year DESC, display_order DESC
          `),
          queryMemberDb(`
            SELECT id, year_id AS yearId, parent_id AS parentId, title, file_path AS filePath, file_size AS fileSize, display_order AS displayOrder, is_active AS isActive
            FROM ethics_documents
            WHERE is_active = 1
            ORDER BY display_order ASC, id ASC
          `),
        ])

        return years.map((yearItem: any) => {
          const yearDocs = documents.filter((doc: any) => doc.yearId === yearItem.id)
          const parentDocs = yearDocs.filter((doc: any) => !doc.parentId)
          const allChildren = yearDocs.filter((doc: any) => doc.parentId)

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
      },
      { staleTtlMs: 60_000, maxTtlMs: 300_000 }
    )
  }

  static async getYears(): Promise<any[]> {
    const [years, documents] = await Promise.all([
      queryMemberDb(`
        SELECT id, year, display_order AS displayOrder, is_active AS isActive
        FROM ethics_years
        ORDER BY display_order ASC, year DESC
      `),
      queryMemberDb(`
        SELECT id, year_id AS yearId, parent_id AS parentId, title, file_path AS filePath, file_size AS fileSize, display_order AS displayOrder, is_active AS isActive
        FROM ethics_documents
        ORDER BY display_order ASC, id ASC
      `),
    ])

    return years.map((y: any) => {
      const yearDocs = documents.filter((d: any) => d.yearId === y.id)
      return {
        ...y,
        documents: yearDocs.map((d: any) => ({
          ...d,
          fileSize: d.fileSize ? d.fileSize.toString() : null
        }))
      }
    })
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

    const yearRows = await queryMemberDb('SELECT id, year FROM ethics_years WHERE id = ?', [yearId])
    const yearRecord = yearRows[0]
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

    const res: any = await queryMemberDb(`
      INSERT INTO ethics_documents (year_id, parent_id, title, file_path, file_size, display_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [yearId, parentId || null, title, filePath, fileSize ? Number(fileSize) : null, displayOrder, isActive ? 1 : 0])

    const createdId = res?.insertId || res?.[0]?.insertId

    await logAudit(
      'CREATE',
      'ethics_documents',
      `เพิ่มเอกสารจริยธรรม "${title}" ปี ${yearRecord.year} โดย ${actor.username}`,
      actor.session
    )

    invalidateCacheKey('ethics:tree')

    return {
      id: createdId,
      yearId,
      parentId: parentId || null,
      title,
      filePath,
      fileSize: fileSize ? fileSize.toString() : null,
      displayOrder,
      isActive,
    }
  }

  static async deleteDocument(
    id: string, 
    actorId: string, 
    actorSession?: any
  ): Promise<void> {
    const docId = parseInt(id, 10)
    if (isNaN(docId)) throw new Error('Invalid ID')

    const rows = await queryMemberDb('SELECT id, title, file_path AS filePath FROM ethics_documents WHERE id = ?', [docId])
    const existing = rows[0]
    if (!existing) {
      throw new Error('ไม่พบเอกสารที่ต้องการลบ')
    }

    const children = await queryMemberDb('SELECT id, file_path AS filePath FROM ethics_documents WHERE parent_id = ?', [docId])

    // Delete child files
    for (const child of children) {
      if (child.filePath) {
        await DocumentStorage.delete(child.filePath)
      }
    }
    // Delete parent file
    if (existing.filePath) {
      await DocumentStorage.delete(existing.filePath)
    }

    await queryMemberDb('DELETE FROM ethics_documents WHERE parent_id = ?', [docId])
    await queryMemberDb('DELETE FROM ethics_documents WHERE id = ?', [docId])

    await logAudit(
      'DELETE',
      'ethics_documents',
      `ลบเอกสารจริยธรรม "${existing.title}" (ID: ${docId}) พร้อมเอกสารย่อย โดย ${actorId}`,
      actorSession
    )

    invalidateCacheKey('ethics:tree')
  }
}
