import { NextResponse } from 'next/server'
import { getCachedData } from '@/lib/cache'
import { RduService, type RduFolderItem } from '@/lib/rdu/rduService'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Short cache for 10 seconds to improve performance across rapid Navbar calls
    const cacheKey = 'public_rdu_folders_tree'
    const result = await getCachedData<RduFolderItem[]>(
      cacheKey,
      async () => {
        return RduService.getFolderTree({ isActiveOnly: true })
      },
      10 * 1000 // 10 seconds TTL
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Error fetching public RDU folders:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch RDU documents',
      },
      { status: 500 }
    )
  }
}
