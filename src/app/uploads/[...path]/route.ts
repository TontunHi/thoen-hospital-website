import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: Request,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await props.params
    const pathArray = resolvedParams.path

    if (!pathArray || pathArray.length === 0) {
      return new Response('Not Found', { status: 404 })
    }

    // Security check: prevent directory traversal
    if (pathArray.some(p => p === '..' || p === '.')) {
      return new Response('Forbidden', { status: 403 })
    }

    // Build the absolute path to the file
    const absolutePath = path.join(process.cwd(), 'public', 'uploads', ...pathArray)

    // Check if file exists on disk
    if (!fs.existsSync(absolutePath)) {
      return new Response('Not Found', { status: 404 })
    }

    // Read the file content
    const fileBuffer = await fs.promises.readFile(absolutePath)

    // Determine content type based on extension
    const ext = path.extname(absolutePath).toLowerCase()
    let contentType = 'application/octet-stream'

    if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg'
    } else if (ext === '.png') {
      contentType = 'image/png'
    } else if (ext === '.webp') {
      contentType = 'image/webp'
    } else if (ext === '.gif') {
      contentType = 'image/gif'
    } else if (ext === '.pdf') {
      contentType = 'application/pdf'
    }

    // Return the file with proper content type header
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Dynamic file serving error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
