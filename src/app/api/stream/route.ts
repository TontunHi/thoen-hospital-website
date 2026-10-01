import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawPath = searchParams.get('path')

    if (!rawPath) {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 })
    }

    // Clean and normalize path
    let relPath = rawPath.trim().replace(/\\/g, '/')
    if (relPath.startsWith('/')) {
      relPath = relPath.substring(1)
    }
    if (relPath.startsWith('uploads/') || relPath.startsWith('documents/')) {
      relPath = 'public/' + relPath
    }

    // Prevent path traversal
    const normalized = path.normalize(relPath).replace(/\\/g, '/')
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
    }

    const allowedRoots = ['public/uploads', 'public/documents', 'storage']
    const isAllowed = allowedRoots.some(root => normalized === root || normalized.startsWith(root + '/'))
    if (!isAllowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const absolutePath = path.join(process.cwd(), normalized)
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const stat = fs.statSync(absolutePath)
    const fileSize = stat.size
    const ext = path.extname(absolutePath).toLowerCase()

    let contentType = 'application/octet-stream'
    if (ext === '.mp4') contentType = 'video/mp4'
    else if (ext === '.webm') contentType = 'video/webm'
    else if (ext === '.png') contentType = 'image/png'
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.pdf') contentType = 'application/pdf'

    const rangeHeader = request.headers.get('range')

    if (rangeHeader && ext === '.mp4') {
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

      if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        })
      }

      const chunksize = end - start + 1
      const stream = fs.createReadStream(absolutePath, { start, end })
      const webStream = Readable.toWeb(stream) as ReadableStream

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunksize),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    const stream = fs.createReadStream(absolutePath)
    const webStream = Readable.toWeb(stream) as ReadableStream

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err: any) {
    console.error('Stream route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
