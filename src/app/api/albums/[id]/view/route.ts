import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { photoAlbumService } from '@/lib/cms/PhotoAlbumService'

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    await photoAlbumService.incrementView(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
