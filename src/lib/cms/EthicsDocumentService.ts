import { apiGateway, GatewayError } from '@/lib/apiGateway'
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

export interface EthicsGatewayAdapter {
  getEthicsTreeRawV2: typeof apiGateway.app.getEthicsTreeRawV2
  getEthicsYearByIdV2: typeof apiGateway.app.getEthicsYearByIdV2
  createEthicsYearV2: typeof apiGateway.app.createEthicsYearV2
  updateEthicsYearV2: typeof apiGateway.app.updateEthicsYearV2
  deleteEthicsYearV2: typeof apiGateway.app.deleteEthicsYearV2
  getEthicsDocumentByIdV2: typeof apiGateway.app.getEthicsDocumentByIdV2
  createEthicsDocumentV2: typeof apiGateway.app.createEthicsDocumentV2
  updateEthicsDocumentV2: typeof apiGateway.app.updateEthicsDocumentV2
  deleteEthicsDocumentV2: typeof apiGateway.app.deleteEthicsDocumentV2
}

const defaultEthicsGateway: EthicsGatewayAdapter = {
  getEthicsTreeRawV2: (activeOnly) => apiGateway.app.getEthicsTreeRawV2(activeOnly),
  getEthicsYearByIdV2: (id) => apiGateway.app.getEthicsYearByIdV2(id),
  createEthicsYearV2: (body) => apiGateway.app.createEthicsYearV2(body),
  updateEthicsYearV2: (id, body) => apiGateway.app.updateEthicsYearV2(id, body),
  deleteEthicsYearV2: (id) => apiGateway.app.deleteEthicsYearV2(id),
  getEthicsDocumentByIdV2: (id) => apiGateway.app.getEthicsDocumentByIdV2(id),
  createEthicsDocumentV2: (body) => apiGateway.app.createEthicsDocumentV2(body),
  updateEthicsDocumentV2: (id, body) => apiGateway.app.updateEthicsDocumentV2(id, body),
  deleteEthicsDocumentV2: (id) => apiGateway.app.deleteEthicsDocumentV2(id),
}

const documentSchema = z.object({
  yearId: z.coerce.number().int(),
  parentId: z.coerce.number().int().optional().nullable(),
  title: z.string().trim().min(1, 'กรุณาระบุชื่อเอกสาร').max(500),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
})

function mapGatewayError(err: unknown, fallbackMessage: string): never {
  if (err instanceof EthicsServiceError) throw err
  if (err instanceof GatewayError && (err.status === 400 || err.status === 404)) {
    throw new EthicsServiceError(err.message || fallbackMessage, err.status)
  }
  throw err
}

export class EthicsDocumentService {
  static async getDocumentTree(
    gateway: Partial<EthicsGatewayAdapter> = {}
  ): Promise<EthicsYearNode[]> {
    const gw: EthicsGatewayAdapter = { ...defaultEthicsGateway, ...gateway }
    return getSwrCachedData(
      'ethics:tree',
      async () => {
        const raw = await gw.getEthicsTreeRawV2(true)
        const years = (raw?.years || []) as unknown as EthicsYearRow[]
        const documents = (raw?.documents || []) as unknown as EthicsDocumentRow[]

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

  static async getYears(
    gateway: Partial<EthicsGatewayAdapter> = {}
  ): Promise<Array<EthicsYearRow & { documents: Array<Omit<EthicsDocumentRow, 'fileSize'> & { fileSize: string | null }> }>> {
    const gw: EthicsGatewayAdapter = { ...defaultEthicsGateway, ...gateway }
    const raw = await gw.getEthicsTreeRawV2(false)
    const years = (raw?.years || []) as unknown as EthicsYearRow[]
    const documents = (raw?.documents || []) as unknown as EthicsDocumentRow[]

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
    actor: { username: string; session?: Record<string, unknown> | null },
    gateway: Partial<EthicsGatewayAdapter> = {}
  ): Promise<EthicsDocumentResponse> {
    const gw: EthicsGatewayAdapter = { ...defaultEthicsGateway, ...gateway }
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

    const yearRecord = await gw.getEthicsYearByIdV2(yearId)
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

    const created = await gw.createEthicsDocumentV2({
      yearId,
      parentId: parentId || null,
      title,
      filePath,
      fileSize: fileSize ? Number(fileSize) : null,
      displayOrder,
      isActive,
    })

    const createdId = Number(created?.id || 0)

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
    actor: { username: string; session?: Record<string, unknown> | null },
    gateway: Partial<EthicsGatewayAdapter> = {}
  ): Promise<EthicsDocumentResponse> {
    const gw: EthicsGatewayAdapter = { ...defaultEthicsGateway, ...gateway }
    const existing = (await gw.getEthicsDocumentByIdV2(input.id)) as unknown as EthicsDocumentRow | null
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

    await gw.updateEthicsDocumentV2(input.id, {
      title: newTitle,
      displayOrder: newDisplayOrder,
      isActive: newIsActive,
      filePath,
      fileSize: fileSize ? Number(fileSize) : null,
    })

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
    actorSession?: Record<string, unknown> | null,
    gateway: Partial<EthicsGatewayAdapter> = {}
  ): Promise<void> {
    const gw: EthicsGatewayAdapter = { ...defaultEthicsGateway, ...gateway }
    const docId = parseInt(id, 10)
    if (isNaN(docId)) throw new EthicsServiceError('Invalid ID', 400)

    let deleted: { title: string; filePaths: string[] }
    try {
      deleted = await gw.deleteEthicsDocumentV2(docId)
    } catch (err) {
      mapGatewayError(err, 'ไม่พบเอกสารที่ต้องการลบ')
    }

    for (const filePath of deleted.filePaths || []) {
      if (filePath) {
        await DocumentStorage.delete(filePath)
      }
    }

    await logAudit(
      'DELETE',
      'ethics_documents',
      `ลบเอกสารจริยธรรม "${deleted.title}" (ID: ${docId}) พร้อมเอกสารย่อย โดย ${actorId}`,
      actorSession
    )

    invalidateCacheKey('ethics:tree')
  }

  static async createYear(
    input: EthicsYearInput,
    actor: { username: string; session?: Record<string, unknown> | null },
    gateway: Partial<EthicsGatewayAdapter> = {}
  ) {
    const gw: EthicsGatewayAdapter = { ...defaultEthicsGateway, ...gateway }
    let created: { id: number }
    try {
      created = await gw.createEthicsYearV2({
        year: input.year,
        displayOrder: input.displayOrder,
        isActive: input.isActive,
      })
    } catch (err) {
      mapGatewayError(err, `ปีงบประมาณ ${input.year} มีอยู่ในระบบแล้ว`)
    }

    const createdId = Number(created?.id || 0)

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
    actor: { username: string; session?: Record<string, unknown> | null },
    gateway: Partial<EthicsGatewayAdapter> = {}
  ) {
    const gw: EthicsGatewayAdapter = { ...defaultEthicsGateway, ...gateway }
    await gw.updateEthicsYearV2(id, {
      year: input.year,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
    })

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
    actor: { username: string; session?: Record<string, unknown> | null },
    gateway: Partial<EthicsGatewayAdapter> = {}
  ): Promise<{ year: string }> {
    const gw: EthicsGatewayAdapter = { ...defaultEthicsGateway, ...gateway }
    let deleted: { year: string; filePaths: string[] }
    try {
      deleted = await gw.deleteEthicsYearV2(id)
    } catch (err) {
      mapGatewayError(err, 'ไม่พบปีงบประมาณที่ต้องการลบ')
    }

    for (const filePath of deleted.filePaths || []) {
      if (filePath) {
        await DocumentStorage.delete(filePath)
      }
    }

    await logAudit(
      'DELETE',
      'ethics_years',
      `ลบปีงบประมาณชมรมจริยธรรม ${deleted.year} (ID: ${id}) พร้อมเอกสารทั้งหมด โดย ${actor.username}`,
      actor.session
    )

    invalidateCacheKey('ethics:tree')
    return { year: deleted.year }
  }
}
