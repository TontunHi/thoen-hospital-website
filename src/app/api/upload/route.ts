import { NextResponse } from 'next/server'
import { requireNewsPermission } from '@/lib/memberAuth'
import { DocumentStorage, StorageValidationError, sanitizeName } from '@/lib/storage/documentStorage'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'กรุณาเลือกไฟล์' },
        { status: 400 }
      )
    }

    const title = (formData.get('title') as string) || ''
    const publishedAt = (formData.get('publishedAt') as string) || ''

    const dateStr = DocumentStorage.formatDateDirectory('', publishedAt, 'daily')

    const cleanTitle = sanitizeName(title) || 'untitled'
    const isPdf = file.type === 'application/pdf'
    const isVideo = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')
    const maxSizeBytes = isVideo 
      ? 100 * 1024 * 1024 
      : (isPdf ? 25 * 1024 * 1024 : 10 * 1024 * 1024)

    const saved = await DocumentStorage.save(file, {
      destinationDir: `public/uploads/${dateStr}/${cleanTitle}`,
      baseName: cleanTitle,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.mp4'],
      maxSizeBytes,
      collisionStrategy: 'timestamp',
    })

    await logAudit(
      'CREATE',
      'uploads',
      `อัปโหลดไฟล์ ${saved.fileName} (${isVideo ? 'วิดีโอ MP4' : isPdf ? 'เอกสาร PDF' : 'รูปภาพ'}, ${Math.round(saved.fileSize / 1024)} KB)`,
      authResult.session
    )

    return NextResponse.json(
      { success: true, url: saved.publicUrl, filename: saved.fileName, isPdf, isVideo },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: 'ไม่ระบุพาธของไฟล์' }, { status: 400 })
    }

    if (!filePath.startsWith('/uploads/') || filePath.includes('..')) {
      return NextResponse.json({ error: 'พาธของไฟล์ไม่ถูกต้อง' }, { status: 400 })
    }

    await DocumentStorage.delete(filePath)

    await logAudit(
      'DELETE',
      'uploads',
      `ลบไฟล์อัปโหลด: ${filePath}`,
      authResult.session
    )

    return NextResponse.json({ success: true, message: 'ลบไฟล์เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Delete upload error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบไฟล์อัปโหลด' },
      { status: 500 }
    )
  }
}

