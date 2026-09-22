import 'dotenv/config'
import { queryMemberDb } from '../src/lib/memberDb'
import fs from 'fs/promises'
import path from 'path'

async function cleanExistingRduFiles() {
  console.log('🔍 Checking existing RDU files in database...')
  try {
    const rows = await queryMemberDb(`
      SELECT f.id, f.folder_id, f.display_name, f.file_name, f.file_path, d.folder_name
      FROM rdu_files f
      JOIN rdu_folders d ON f.folder_id = d.id
    `)

    console.log(`📊 Found ${rows.length} files in database.`)

    for (const row of rows) {
      const { id, file_name, file_path, folder_name } = row
      console.log(`\nChecking ID: ${id} | Current file_name: ${file_name}`)

      const sanitizedFolder = String(folder_name).replace(/[\\/:*?"<>|]/g, '_')

      // Remove timestamp prefix if exists (e.g. 1790068108187_Antibiogram_All.pdf -> Antibiogram_All.pdf)
      const cleanFileName = file_name.replace(/^\d{10,14}_/, '')

      // Construct clean readable file_path
      const cleanFilePath = `/documents/rdu/${sanitizedFolder}/${cleanFileName}`

      console.log(`  ➔ Target clean file_name: ${cleanFileName}`)
      console.log(`  ➔ Target clean file_path: ${cleanFilePath}`)

      // Try renaming physical file on disk if original exists
      const oldDiskPath = path.join(process.cwd(), 'public', 'documents', 'rdu', sanitizedFolder, file_name)
      const newDiskPath = path.join(process.cwd(), 'public', 'documents', 'rdu', sanitizedFolder, cleanFileName)

      try {
        await fs.access(oldDiskPath)
        if (oldDiskPath !== newDiskPath) {
          await fs.rename(oldDiskPath, newDiskPath)
          console.log(`  ✅ Renamed on disk: ${file_name} -> ${cleanFileName}`)
        }
      } catch {
        // Old disk file might not be present or already named clean
      }

      // Update Database
      await queryMemberDb(
        `UPDATE rdu_files SET file_name = ?, file_path = ? WHERE id = ?`,
        [cleanFileName, cleanFilePath, id]
      )
      console.log(`  ✅ Updated DB record for ID ${id}`)
    }

    console.log('\n✨ All RDU files cleaned up successfully!')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  }
}

cleanExistingRduFiles()
