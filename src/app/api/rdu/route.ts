import { NextResponse } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
import { getCachedData } from '@/lib/cache'

export const dynamic = 'force-dynamic'

interface RduFile {
  id: number
  folder_id: number
  display_name: string
  file_name: string
  file_path: string
  file_size: number | null
  display_order: number
}

interface RduFolder {
  id: number
  folder_name: string
  display_order: number
  is_active: number
  files: RduFile[]
}

export async function GET() {
  try {
    // Short cache for 10 seconds to improve performance across rapid Navbar calls
    const cacheKey = 'public_rdu_folders_tree'
    const result = await getCachedData<RduFolder[]>(
      cacheKey,
      async () => {
        const folders = (await queryMemberDb(
          'SELECT id, folder_name, display_order, is_active FROM rdu_folders WHERE is_active = 1 ORDER BY id DESC'
        )) as Omit<RduFolder, 'files'>[]

        if (!folders || folders.length === 0) {
          return []
        }

        const folderIds = folders.map((f) => f.id)
        const placeholders = folderIds.map(() => '?').join(',')
        
        const files = (await queryMemberDb(
          `SELECT id, folder_id, display_name, file_name, file_path, file_size, display_order 
           FROM rdu_files 
           WHERE folder_id IN (${placeholders}) 
           ORDER BY display_order ASC, id ASC`,
          folderIds
        )) as RduFile[]

        const filesByFolder: Record<number, RduFile[]> = {}
        files.forEach((file) => {
          if (!filesByFolder[file.folder_id]) {
            filesByFolder[file.folder_id] = []
          }
          filesByFolder[file.folder_id].push(file)
        })

        return folders.map((folder) => ({
          ...folder,
          files: filesByFolder[folder.id] || []
        }))
      },
      10000
    )

    return NextResponse.json({ success: true, folders: result })
  } catch (error: any) {
    console.error('Error fetching public RDU data:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch RDU data' }, { status: 500 })
  }
}
