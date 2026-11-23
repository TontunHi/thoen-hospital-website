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

export interface UpdateEthicsDocumentInput {
  id: number
  title?: string | null
  displayOrder?: number | null
  isActive?: boolean
  file?: File | null
}

export interface EthicsYearInput {
  year: string
  displayOrder: number
  isActive: boolean
}

export interface EthicsDocumentResponse {
  id: number
  yearId?: number
  parentId?: number | null
  title: string
  filePath: string | null
  fileSize: string | null
  displayOrder: number
  isActive: boolean
}

export class EthicsServiceError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message)
    this.name = 'EthicsServiceError'
  }
}

interface EthicsYearRow {
  id: number
  year: string
  displayOrder: number
  isActive: boolean
}

interface EthicsDocumentRow {
  id: number
  yearId: number
  parentId: number | null
  title: string
  filePath: string | null
  fileSize: number | bigint | string | null
  displayOrder: number
  isActive: boolean
  year?: string
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
          queryMemberDb<EthicsYearRow>(`
            SELECT id, year, display_order AS displayOrder, is_active AS isActive
            FROM ethics_years
            WHERE is_active = 1
            ORDER BY year DESC, display_order DESC
          `),
          queryMemberDb<EthicsDocumentRow>(`
            SELECT id, year_id AS yearId, parent_id AS parentId, title, file_path AS filePath, file_size AS fileSize, display_order AS displayOrder, is_active AS isActive
            FROM ethics_documents
            WHERE is_active = 1
            ORDER BY display_order ASC, id ASC
          `),
        ])

        return years.map((yearItem) => {
          const yearDocs = documents.filter((doc) => doc.yearId === yearItem.id)
          const parentDocs = yearDocs.filter((doc) => !doc.parentId)
          const allChildren = yearDocs.filter((doc) => doc.parentId)

          const structuredDocs = parentDocs.map((parent) => {
            const subItems = allChildren
              .filter((child) => child.parentId === parent.id)
              .map((child) => ({
                id: child.id,
                title: child.title,
                fileUrl: child.filePath || '',
                displayOrder: child.displayOrder,
              }))

            return {
              id: parent.id,
              title: parent.title,
              fileUrl: parent.filePath || undefined,
              displayOrder: parent.displayOrder,
              subItems: subItems.length > 0 ? subItems : undefined,
            }
          })

          return {
            id: yearItem.id,
            year: yearItem.year,
            displayOrder: yearItem.displayOrder,
            documents: structuredDocs,
          }
        })
      },
      { staleTtlMs: 60_000, maxTtlMs: 300_000 }
    )
  }

  static async getYears(): Promise<Array<EthicsYearRow & { documents: Array<Omit<EthicsDocumentRow, 'fileSize'> & { fileSize: string | null }> }>> {
    const [years, documents] = await Promise.all([
      queryMemberDb<EthicsYearRow>(`
        SELECT id, year, display_order AS displayOrder, is_active AS isActive
        FROM ethics_years
        ORDER BY display_order ASC, year DESC
      `),
      queryMemberDb<EthicsDocumentRow>(`
        SELECT id, year_id AS yearId, parent_id AS parentId, title, file_path AS filePath, file_size AS fileSize, display_order AS displayOrder, is_active AS isActive
        FROM ethics_documents
        ORDER BY display_order ASC, id ASC
      `),
    ])

    return years.map((y) => {
      const yearDocs = documents.filter((d) => d.yearId === y.id)
      return {
        ...y,
        isActive: Boolean(y.isActive),
        documents: yearDocs.map((d) => ({
          ...d,
          isActive: Boolean(d.isActive),
          fileSize: d.fileSize ? d.fileSize.toString() : null,
        })),
      }
    })
  }

  static async createDocument(
    input: CreateEthicsDocumentInput,
    actor: { username: string; session?: Record<string, unknown> | null }
  ): Promise<EthicsDocumentResponse> {
    const parsed = documentSchema.safeParse({
      yearId: input.yearId,
      parentId: input.parentId,
      title: input.title,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
    })

    if (!parsed.success) {
      throw new EthicsServiceError(parsed.error.issues.map((i) => i.message).join(', '), 400)
    }

    const { yearId, parentId, title, displayOrder, isActive } = parsed.data

    const yearRows = await queryMemberDb<{ id: number; year: string }>(
      'SELECT id, year FROM ethics_years WHERE id = ?',
      [yearId]
    )
    const yearRecord = yearRows[0]
    if (!yearRecord) {
      throw new EthicsServiceError('ไม่พบปีงบประมาณที่ระบุ', 404)
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

    const res = (await queryMemberDb(
      `
      INSERT INTO ethics_documents (year_id, parent_id, title, file_path, file_size, display_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
      [
        yearId,
        parentId || null,
        title,
        filePath,
        fileSize ? Number(fileSize) : null,
        displayOrder,
        isActive ? 1 : 0,
      ]
    )) as unknown as { insertId?: number } & Array<{ insertId?: number }>

    const createdId = Number(res?.insertId || res?.[0]?.insertId || 0)

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

  static async updateDocument(
    input: UpdateEthicsDocumentInput,
    actor: { username: string; session?: Record<string, unknown> | null }
  ): Promise<EthicsDocumentResponse> {
    const existingRows = await queryMemberDb<EthicsDocumentRow>(
      `
      SELECT d.id, d.title, d.file_path AS filePath, d.file_size AS fileSize, d.display_order AS displayOrder, d.is_active AS isActive, y.year
      FROM ethics_documents d
      JOIN ethics_years y ON d.year_id = y.id
      WHERE d.id = ?
    `,
      [input.id]
    )
    const existing = existingRows[0]
    if (!existing) {
      throw new EthicsServiceError('ไม่พบเอกสารที่ต้องการแก้ไข', 404)
    }

    let filePath = existing.filePath
    let fileSize = existing.fileSize

    if (input.file && input.file.size > 0) {
      const saved = await DocumentStorage.replace(existing.filePath, input.file, {
        destinationDir: `public/documents/ethics/${existing.year}`,
        allowedMimeTypes: ['application/pdf'],
        allowedExtensions: ['.pdf'],
        maxSizeBytes: 25 * 1024 * 1024,
        collisionStrategy: 'timestamp',
      })
      filePath = saved.publicUrl
      fileSize = BigInt(saved.fileSize)
    }

    const newTitle = input.title || existing.title
    const newDisplayOrder =
      input.displayOrder !== null && input.displayOrder !== undefined
        ? input.displayOrder
        : existing.displayOrder
    const newIsActive =
      input.isActive !== undefined ? input.isActive : Boolean(existing.isActive)

    await queryMemberDb(
      `
      UPDATE ethics_documents
      SET title = ?, display_order = ?, is_active = ?, file_path = ?, file_size = ?, updated_at = NOW()
      WHERE id = ?
    `,
      [
        newTitle,
        newDisplayOrder,
        newIsActive ? 1 : 0,
        filePath,
        fileSize ? Number(fileSize) : null,
        input.id,
      ]
    )

    await logAudit(
      'UPDATE',
      'ethics_documents',
      `แก้ไขเอกสารจริยธรรม ID: ${input.id} ("${newTitle}") โดย ${actor.username}`,
      actor.session
    )

    invalidateCacheKey('ethics:tree')

    return {
      id: input.id,
      title: newTitle,
      displayOrder: newDisplayOrder,
      isActive: newIsActive,
      filePath,
      fileSize: fileSize ? fileSize.toString() : null,
    }
  }

  static async deleteDocument(
    id: string,
    actorId: string,
    actorSession?: Record<string, unknown> | null
  ): Promise<void> {
    const docId = parseInt(id, 10)
    if (isNaN(docId)) throw new EthicsServiceError('Invalid ID', 400)

    const rows = await queryMemberDb<{ id: number; title: string; filePath: string | null }>(
      'SELECT id, title, file_path AS filePath FROM ethics_documents WHERE id = ?',
      [docId]
    )
    const existing = rows[0]
    if (!existing) {
      throw new EthicsServiceError('ไม่พบเอกสารที่ต้องการลบ', 404)
    }

    const children = await queryMemberDb<{ id: number; filePath: string | null }>(
      'SELECT id, file_path AS filePath FROM ethics_documents WHERE parent_id = ?',
      [docId]
    )

    for (const child of children) {
      if (child.filePath) {
        await DocumentStorage.delete(child.filePath)
      }
    }
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

  static async createYear(
    input: EthicsYearInput,
    actor: { username: string; session?: Record<string, unknown> | null }
  ) {
    const existingRows = await queryMemberDb<{ id: number }>(
      'SELECT id FROM ethics_years WHERE year = ?',
      [input.year]
    )
    if (existingRows.length > 0) {
      throw new EthicsServiceError(`ปีงบประมาณ ${input.year} มีอยู่ในระบบแล้ว`, 400)
    }

    const res = (await queryMemberDb(
      'INSERT INTO ethics_years (year, display_order, is_active, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [input.year, input.displayOrder, input.isActive ? 1 : 0]
    )) as unknown as { insertId?: number } & Array<{ insertId?: number }>

    const createdId = Number(res?.insertId || res?.[0]?.insertId || 0)

    await logAudit(
      'CREATE',
      'ethics_years',
      `เพิ่มปีงบประมาณชมรมจริยธรรม ${input.year} โดย ${actor.username}`,
      actor.session
    )

    invalidateCacheKey('ethics:tree')

    return {
      id: createdId,
      year: input.year,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
    }
  }

  static async updateYear(
    id: number,
    input: EthicsYearInput,
    actor: { username: string; session?: Record<string, unknown> | null }
  ) {
    await queryMemberDb(
      'UPDATE ethics_years SET year = ?, display_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [input.year, input.displayOrder, input.isActive ? 1 : 0, id]
    )

    await logAudit(
      'UPDATE',
      'ethics_years',
      `แก้ไขปีงบประมาณชมรมจริยธรรม ID: ${id} (${input.year}) โดย ${actor.username}`,
      actor.session
    )

    invalidateCacheKey('ethics:tree')

    return {
      id,
      year: input.year,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
    }
  }

  static async deleteYear(
    id: number,
    actor: { username: string; session?: Record<string, unknown> | null }
  ): Promise<{ year: string }> {
    const existingRows = await queryMemberDb<{ id: number; year: string }>(
      'SELECT id, year FROM ethics_years WHERE id = ?',
      [id]
    )
    const existing = existingRows[0]
    if (!existing) {
      throw new EthicsServiceError('ไม่พบปีงบประมาณที่ต้องการลบ', 404)
    }

    const docs = await queryMemberDb<{ filePath: string | null }>(
      'SELECT file_path AS filePath FROM ethics_documents WHERE year_id = ?',
      [id]
    )
    for (const doc of docs) {
      if (doc.filePath) {
        await DocumentStorage.delete(doc.filePath)
      }
    }

    await queryMemberDb('DELETE FROM ethics_documents WHERE year_id = ?', [id])
    await queryMemberDb('DELETE FROM ethics_years WHERE id = ?', [id])

    await logAudit(
      'DELETE',
      'ethics_years',
      `ลบปีงบประมาณชมรมจริยธรรม ${existing.year} (ID: ${id}) พร้อมเอกสารทั้งหมด โดย ${actor.username}`,
      actor.session
    )

    invalidateCacheKey('ethics:tree')
    return { year: existing.year }
  }
}
