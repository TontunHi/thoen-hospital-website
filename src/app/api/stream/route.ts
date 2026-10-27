import { NextRequest, NextResponse } from 'next/server'
import { DocumentStorage } from '@/lib/storage/documentStorage'

export const dynamic = 'force-dynamic'

// Public media streaming is strictly restricted to public media upload roots
const ALLOWED_STREAM_ROOTS = ['public/uploads', 'public/documents']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawPath = searchParams.get('path')
    if (!rawPath) {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 })
    }
    return await DocumentStorage.serveFile(rawPath, request, ALLOWED_STREAM_ROOTS)
  } catch (err: any) {
    console.error('Stream route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

