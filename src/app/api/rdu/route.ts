import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { getSwrCachedData } from '@/lib/cache'
import { logger } from '@/lib/logger'

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
    // SWR cache with single-flight deduplication to avoid bursting the Gateway on Navbar loads
    const cacheKey = 'public_rdu_folders_tree'
    const result = await getSwrCachedData<RduFolder[]>(
      cacheKey,
      async () => {
        return (await apiGateway.app.getRduTree({ includeInactive: false })) as RduFolder[]
      },
      { staleTtlMs: 30000, maxTtlMs: 300000 }
    )

    return NextResponse.json({ success: true, folders: result })
  } catch (error: unknown) {
    logger.error({ error }, 'Error fetching public RDU data')
    return NextResponse.json({ success: false, error: 'Failed to fetch RDU data' }, { status: 500 })
  }
}
