import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { DocumentStorage, StorageValidationError, sanitizeName } from '@/lib/storage/documentStorage'

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'กรุณาเลือกไฟล์' },
        { status: 400 }
      )
    }

    const title = (formData.get('title') as string) || 'pr-attachment'
    const publishedAt = (formData.get('publishedAt') as string) || ''

    // Format date folder as DD-MM-YYYY
    let dateStr = ''
    if (publishedAt) {
      const d = new Date(publishedAt)
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        dateStr = `${day}-${month}-${year}`
      }
    }
    if (!dateStr) {
      const d = new Date()
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      dateStr = `${day}-${month}-${year}`
    }

    const cleanTitle = sanitizeName(title) || 'untitled'
    const isPdf = file.type === 'application/pdf'
    const maxSizeBytes = isPdf ? 15 * 1024 * 1024 : 5 * 1024 * 1024

    const saved = await DocumentStorage.save(file, {
      destinationDir: `public/uploads/member-pr/${dateStr}`,
      baseName: cleanTitle,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'],
      maxSizeBytes,
      collisionStrategy: 'timestamp',
    })

    return NextResponse.json(
      { success: true, url: saved.publicUrl, filename: file.name, isPdf },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Member upload error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: 'ไม่ระบุพาธของไฟล์' }, { status: 400 })
    }

    if (!filePath.startsWith('/uploads/member-pr/') || filePath.includes('..')) {
      return NextResponse.json({ error: 'พาธของไฟล์ไม่ถูกต้อง' }, { status: 400 })
    }

    await DocumentStorage.delete(filePath)
    return NextResponse.json({ success: true, message: 'ลบไฟล์เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Delete member upload error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบไฟล์อัปโหลด' },
      { status: 500 }
    )
  }
}

