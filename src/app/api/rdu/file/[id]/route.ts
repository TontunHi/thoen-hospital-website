import { NextResponse } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
import fs from 'fs/promises'
import path from 'path'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const fileId = parseInt(id, 10)

    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'รหัสไฟล์ไม่ถูกต้อง' }, { status: 400 })
    }

    // Query file record and folder from database
    const fileRows = await queryMemberDb(
      `SELECT f.id, f.display_name, f.file_name, f.file_path, d.folder_name
       FROM rdu_files f
       JOIN rdu_folders d ON f.folder_id = d.id
       WHERE f.id = ? LIMIT 1`,
      [fileId]
    )

    if (!fileRows || fileRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ที่ระบุในฐานข้อมูล' }, { status: 404 })
    }

    const { file_name, folder_name, display_name } = fileRows[0]

    // Determine physical path on server
    // We check both new uploads location and previous documents location for backward compatibility
    const sanitizedFolder = String(folder_name).replace(/[\\/:*?"<>|]/g, '_')
    const candidates = [
      path.join(process.cwd(), 'public', 'uploads', 'rdu', sanitizedFolder, file_name),
      path.join(process.cwd(), 'public', 'documents', 'rdu', sanitizedFolder, file_name),
      path.join(process.cwd(), 'public', 'documents', 'rdu', String(folder_name), file_name),
    ]

    let resolvedPath: string | null = null
    for (const p of candidates) {
      try {
        await fs.access(p)
        resolvedPath = p
        break
      } catch {
        // continue checking next candidate
      }
    }

    if (!resolvedPath) {
      return NextResponse.json({ error: 'ไม่พบไฟล์จริงบนระบบดิสก์' }, { status: 404 })
    }

    // Read file buffer
    const fileBuffer = await fs.readFile(resolvedPath)

    // Build headers for inline PDF stream
    const encodedDisplayName = encodeURIComponent(display_name || 'document')
    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    headers.set('Content-Length', fileBuffer.length.toString())
    headers.set('Content-Disposition', `inline; filename="${encodedDisplayName}.pdf"; filename*=UTF-8''${encodedDisplayName}.pdf`)
    headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    })
  } catch (error: any) {
    console.error('Error streaming RDU PDF file:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการโหลดไฟล์' }, { status: 500 })
  }
}
