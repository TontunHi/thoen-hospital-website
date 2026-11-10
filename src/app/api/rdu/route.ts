import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
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
        return (await apiGateway.app.getRduTree({ includeInactive: false })) as RduFolder[]
      },
      10000
    )

    return NextResponse.json({ success: true, folders: result })
  } catch (error: any) {
    console.error('Error fetching public RDU data:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch RDU data' }, { status: 500 })
  }
}
