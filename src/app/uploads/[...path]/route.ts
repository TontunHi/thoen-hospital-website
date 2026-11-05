import { NextRequest, NextResponse } from 'next/server'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { getObjectFromS3, S3_CONFIG } from '@/lib/storage/s3Client'
import path from 'path'

export const dynamic = 'force-dynamic'

/**
 * Route handler to serve uploaded assets: /uploads/[...path]
 * Streams from MinIO Object Storage (primary) with seamless fallback to local disk.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await context.params
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 })
    }

    // Sanitize path segments to prevent directory traversal
    const safeSegments = pathSegments.map(s => s.replace(/[/\\?%*:|"<>]/g, ''))
    if (safeSegments.some(s => s === '..' || s === '.')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const relativeSubPath = safeSegments.join('/')
    const s3Key = `uploads/${relativeSubPath}`
    const localRelPath = `public/uploads/${relativeSubPath}`

    // 1. Try MinIO / S3 Object Storage first
    try {
      const rangeHeader = request.headers.get('range') || undefined
      const s3Res = await getObjectFromS3({
        bucket: S3_CONFIG.publicBucket,
        key: s3Key,
        range: rangeHeader,
      })

      if (s3Res.Body) {
        const contentType = s3Res.ContentType || inferContentType(relativeSubPath)
        const contentLength = s3Res.ContentLength
        const contentRange = s3Res.ContentRange
        const isPartial = Boolean(rangeHeader && contentRange)

        // Convert S3 body to Web ReadableStream
        const bodyAny = s3Res.Body as any
        const webStream = typeof bodyAny.transformToWebStream === 'function'
          ? bodyAny.transformToWebStream()
          : (require('stream').Readable.toWeb(bodyAny) as ReadableStream)

        const headers: Record<string, string> = {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        }
        if (contentLength !== undefined) headers['Content-Length'] = String(contentLength)
        if (contentRange) headers['Content-Range'] = contentRange

        return new Response(webStream, {
          status: isPartial ? 206 : 200,
          headers,
        })
      }
    } catch (s3Err: any) {
      // If NoSuchKey / 404 on S3, fallback to local disk
      if (s3Err?.name !== 'NoSuchKey' && s3Err?.$metadata?.httpStatusCode !== 404) {
        console.warn(`[S3 Uploads] Fetch ${s3Key} failed, falling back to disk:`, s3Err?.message || s3Err)
      }
    }

    // 2. Fallback: serve from local disk (for pre-migration files)
    return await DocumentStorage.serveFile(localRelPath, request, ['public/uploads'])
  } catch (err: any) {
    console.error('[Uploads Route] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function inferContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.pdf':
      return 'application/pdf'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    default:
      return 'application/octet-stream'
  }
}
