import { queryMemberDb } from '@/lib/memberDb'
import { DocumentStorage, sanitizeName } from '@/lib/storage/documentStorage'
import path from 'path'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any>

export interface RduFileItem {
  id: number
  folder_id: number
  display_name: string
  file_name: string
  file_path: string
  file_size: number | null
  display_order: number
  created_at?: string | Date
  updated_at?: string | Date
}

export interface RduFolderItem {
  id: number
  folder_name: string
  display_order: number
  is_active: number
  created_at?: string | Date
  updated_at?: string | Date
  files: RduFileItem[]
}

export class RduService {
  /**
   * Retrieves the full folder tree with files attached
   */
  static async getFolderTree(
    options: { isActiveOnly?: boolean } = {},
    executor: QueryExecutor = queryMemberDb
  ): Promise<RduFolderItem[]> {
    const { isActiveOnly = false } = options
    const sqlFolders = isActiveOnly
      ? 'SELECT id, folder_name, display_order, is_active FROM rdu_folders WHERE is_active = 1 ORDER BY id DESC'
      : 'SELECT id, folder_name, display_order, is_active, created_at, updated_at FROM rdu_folders ORDER BY id DESC'

    const folders = (await executor(sqlFolders)) as any[]
    if (!folders || folders.length === 0) {
      return []
    }

    const folderIds = folders.map((f) => f.id)
    const placeholders = folderIds.map(() => '?').join(',')

    const sqlFiles = `SELECT id, folder_id, display_name, file_name, file_path, file_size, display_order, created_at, updated_at 
       FROM rdu_files 
       WHERE folder_id IN (${placeholders}) 
       ORDER BY display_order ASC, id ASC`

    const files = (await executor(sqlFiles, folderIds)) as any[]

    const filesByFolder: Record<number, RduFileItem[]> = {}
    files.forEach((file) => {
      if (!filesByFolder[file.folder_id]) {
        filesByFolder[file.folder_id] = []
      }
      filesByFolder[file.folder_id].push({
        ...file,
        file_path: `/api/rdu/file/${file.id}`,
      })
    })

    return folders.map((folder) => ({
      ...folder,
      files: filesByFolder[folder.id] || [],
    }))
  }

  /**
   * Creates a new folder in database and on physical storage
   */
  static async createFolder(
    rawFolderName: string,
    executor: QueryExecutor = queryMemberDb
  ): Promise<{ id: number; folderName: string }> {
    const folderName = (rawFolderName || '').trim()
    if (!folderName) {
      throw new Error('กรุณาระบุชื่อโฟลเดอร์')
    }

    const existing = await executor('SELECT id FROM rdu_folders WHERE folder_name = ?', [folderName])
    if (existing && existing.length > 0) {
      throw new Error('มีโฟลเดอร์ชื่อนี้อยู่ในระบบแล้ว')
    }

    const maxOrderRes = await executor('SELECT MAX(display_order) as maxOrder FROM rdu_folders')
    const nextOrder = (maxOrderRes[0]?.maxOrder ?? -1) + 1

    const insertResult = await executor(
      'INSERT INTO rdu_folders (folder_name, display_order) VALUES (?, ?)',
      [folderName, nextOrder]
    )

    const sanitizedFolderName = sanitizeName(folderName)
    await DocumentStorage.createDirectory(`public/documents/rdu/${sanitizedFolderName}`)

    return {
      id: (insertResult as any).insertId,
      folderName,
    }
  }

  /**
   * Updates folder name and renames physical directory if needed
   */
  static async updateFolder(
    folderId: number,
    rawNewFolderName: string,
    executor: QueryExecutor = queryMemberDb
  ): Promise<void> {
    const newFolderName = (rawNewFolderName || '').trim()
    if (!folderId || !newFolderName) {
      throw new Error('ข้อมูลไม่ครบถ้วน')
    }

    const existing = await executor('SELECT folder_name FROM rdu_folders WHERE id = ?', [folderId])
    if (!existing || existing.length === 0) {
      throw new Error('ไม่พบโฟลเดอร์ที่ต้องการแก้ไข')
    }

    const oldFolderName = existing[0].folder_name
    if (oldFolderName !== newFolderName) {
      const checkDup = await executor('SELECT id FROM rdu_folders WHERE folder_name = ? AND id != ?', [
        newFolderName,
        folderId,
      ])
      if (checkDup && checkDup.length > 0) {
        throw new Error('มีโฟลเดอร์ชื่อนี้อยู่แล้ว')
      }

      const oldSanitized = sanitizeName(oldFolderName)
      const newSanitized = sanitizeName(newFolderName)

      await DocumentStorage.renameDirectory(
        `public/documents/rdu/${oldSanitized}`,
        `public/documents/rdu/${newSanitized}`
      )

      const files = await executor('SELECT id, file_name FROM rdu_files WHERE folder_id = ?', [folderId])
      for (const f of files || []) {
        const updatedFilePath = `/documents/rdu/${encodeURIComponent(newSanitized)}/${encodeURIComponent(f.file_name)}`
        await executor('UPDATE rdu_files SET file_path = ? WHERE id = ?', [updatedFilePath, f.id])
      }

      await executor('UPDATE rdu_folders SET folder_name = ? WHERE id = ?', [newFolderName, folderId])
    }
  }

  /**
   * Reorders folders
   */
  static async reorderFolders(
    orders: { id: number; display_order: number }[],
    executor: QueryExecutor = queryMemberDb
  ): Promise<void> {
    for (const item of orders) {
      if (item.id !== undefined && item.display_order !== undefined) {
        await executor('UPDATE rdu_folders SET display_order = ? WHERE id = ?', [
          item.display_order,
          item.id,
        ])
      }
    }
  }

  /**
   * Deletes folder record and removes its directory on disk
   */
  static async deleteFolder(folderId: number, executor: QueryExecutor = queryMemberDb): Promise<void> {
    const folderRes = await executor('SELECT folder_name FROM rdu_folders WHERE id = ?', [folderId])
    if (!folderRes || folderRes.length === 0) {
      throw new Error('ไม่พบโฟลเดอร์')
    }

    await executor('DELETE FROM rdu_folders WHERE id = ?', [folderId])

    const sanitized = sanitizeName(folderRes[0].folder_name)
    await DocumentStorage.deleteDirectory(`public/documents/rdu/${sanitized}`)
  }

  /**
   * Uploads file to a folder
   */
  static async uploadFile(
    params: {
      folderId: number
      file: File
      customDisplayName?: string | null
    },
    executor: QueryExecutor = queryMemberDb
  ): Promise<RduFileItem> {
    const { folderId, file, customDisplayName } = params
    const folderRes = await executor('SELECT folder_name FROM rdu_folders WHERE id = ?', [folderId])
    if (!folderRes || folderRes.length === 0) {
      throw new Error('ไม่พบโฟลเดอร์ที่ระบุ')
    }

    const folderName = folderRes[0].folder_name
    const originalFileName = file.name
    const ext = path.extname(originalFileName).toLowerCase()

    let displayName = (customDisplayName || '').trim()
    if (!displayName) {
      const baseWithoutExt = path.basename(originalFileName, ext)
      displayName = baseWithoutExt.replace(/[_\-]+/g, ' ').trim()
    }

    const sanitizedFolderName = sanitizeName(folderName)
    const baseClean = sanitizeName(path.basename(originalFileName, ext))

    const saved = await DocumentStorage.save(file, {
      destinationDir: `public/documents/rdu/${sanitizedFolderName}`,
      baseName: baseClean,
      allowedMimeTypes: ['application/pdf'],
      allowedExtensions: ['.pdf'],
      maxSizeBytes: 25 * 1024 * 1024,
      collisionStrategy: 'increment',
    })

    const maxOrderRes = await executor(
      'SELECT MAX(display_order) as maxOrder FROM rdu_files WHERE folder_id = ?',
      [folderId]
    )
    const nextOrder = (maxOrderRes[0]?.maxOrder ?? -1) + 1

    const insertRes = await executor(
      `INSERT INTO rdu_files (folder_id, display_name, file_name, file_path, file_size, display_order) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [folderId, displayName, saved.fileName, saved.publicUrl, saved.fileSize, nextOrder]
    )
    const newFileId = (insertRes as any).insertId

    return {
      id: newFileId,
      folder_id: Number(folderId),
      display_name: displayName,
      file_name: saved.fileName,
      file_path: `/api/rdu/file/${newFileId}`,
      file_size: saved.fileSize,
      display_order: nextOrder,
    }
  }

  /**
   * Updates file display name
   */
  static async updateFileDisplayName(
    fileId: number,
    displayName: string,
    executor: QueryExecutor = queryMemberDb
  ): Promise<void> {
    const trimmed = (displayName || '').trim()
    if (!fileId || !trimmed) {
      throw new Error('กรุณาระบุชื่อแสดงผลของไฟล์')
    }
    await executor('UPDATE rdu_files SET display_name = ? WHERE id = ?', [trimmed, fileId])
  }

  /**
   * Reorders files within a folder
   */
  static async reorderFiles(
    orders: { id: number; display_order: number }[],
    executor: QueryExecutor = queryMemberDb
  ): Promise<void> {
    for (const item of orders) {
      if (item.id !== undefined && item.display_order !== undefined) {
        await executor('UPDATE rdu_files SET display_order = ? WHERE id = ?', [
          item.display_order,
          item.id,
        ])
      }
    }
  }

  /**
   * Deletes a file from database and disk
   */
  static async deleteFile(fileId: number, executor: QueryExecutor = queryMemberDb): Promise<void> {
    const fileRes = await executor(
      `SELECT f.id, f.file_name, f.file_path, d.folder_name 
       FROM rdu_files f 
       JOIN rdu_folders d ON f.folder_id = d.id 
       WHERE f.id = ?`,
      [fileId]
    )

    if (!fileRes || fileRes.length === 0) {
      throw new Error('ไม่พบไฟล์ที่ต้องการลบ')
    }

    const target = fileRes[0]
    await executor('DELETE FROM rdu_files WHERE id = ?', [fileId])

    const sanitizedFolder = sanitizeName(target.folder_name)
    const storagePath = `public/documents/rdu/${sanitizedFolder}/${target.file_name}`
    try {
      await DocumentStorage.delete(storagePath)
    } catch {
      // Ignore if physically missing on disk
    }
  }
}
