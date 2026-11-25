import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { logger } from '@/lib/logger'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const fileId = parseInt(id, 10)

    if (isNaN(fileId)) return NextResponse.json({ error: 'รหัสไฟล์ไม่ถูกต้อง' }, { status: 400 })

    interface RduFileRow {
      file_name?: string | null
      folder_name?: string | null
      display_name?: string | null
      file_path?: string | null
    }
    const res: unknown = await apiGateway.app.getRduFileById(fileId)
    const resObj = (res && typeof res === 'object') ? (res as { data?: RduFileRow } & RduFileRow) : null
    const fileRow: RduFileRow | null = resObj
      ? (resObj.data ? resObj.data : (resObj.file_name ? resObj : null))
      : null

    if (!fileRow) return NextResponse.json({ error: 'ไม่พบไฟล์ที่ระบุในฐานข้อมูล' }, { status: 404 })

    const { file_name, folder_name, display_name, file_path } = fileRow
    const sanitizedFolder = String(folder_name || '').replace(/[\\/:*?"<>|]/g, '_')
    const candidates = [
      file_path,
      `public/documents/rdu/${String(folder_name)}/${file_name}`,
      `public/documents/rdu/${sanitizedFolder}/${file_name}`,
      `public/uploads/rdu/${sanitizedFolder}/${file_name}`,
      `public/uploads/rdu/${String(folder_name)}/${file_name}`,
    ].filter((p): p is string => Boolean(p))

    let fileBuffer: Buffer | null = null
    for (const p of candidates) {
      try {
        fileBuffer = await DocumentStorage.readBuffer(p)
        break
      } catch {
        // continue
      }
    }

    if (!fileBuffer) return NextResponse.json({ error: 'ไม่พบไฟล์จริงบนระบบดิสก์' }, { status: 404 })

    const encodedDisplayName = encodeURIComponent(display_name || 'document')
    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    headers.set('Content-Length', fileBuffer.length.toString())
    headers.set('Content-Disposition', `inline; filename="${encodedDisplayName}.pdf"; filename*=UTF-8''${encodedDisplayName}.pdf`)
    headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')

    return new NextResponse(new Uint8Array(fileBuffer), { status: 200, headers })
  } catch (error: unknown) {
    logger.error({ error }, 'Error streaming RDU PDF file')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการโหลดไฟล์' }, { status: 500 })
  }
}
