import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { DocumentStorage, StorageValidationError } from '@/lib/storage/documentStorage'

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกรูปภาพอย่างน้อย 1 ไฟล์' }, { status: 400 })
    }

    if (files.length > 5) {
      return NextResponse.json({ error: 'สามารถอัปโหลดรูปภาพได้สูงสุดไม่เกิน 5 ไฟล์' }, { status: 400 })
    }

    const destinationDir = DocumentStorage.formatDateDirectory('public/uploads/repairs', new Date(), 'monthly')

    const savedFiles = await DocumentStorage.saveBatch(files, {
      destinationDir,
      baseName: 'repair',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      maxSizeBytes: 10 * 1024 * 1024, // 10MB per file
      collisionStrategy: 'timestamp',
    })

    const uploadedUrls = savedFiles.map((f) => f.publicUrl)

    return NextResponse.json({
      success: true,
      message: `อัปโหลดรูปภาพสำเร็จ ${uploadedUrls.length} ไฟล์`,
      data: {
        urls: uploadedUrls,
      },
    })
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Repair photo upload error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' + (error.message || 'Unknown error') },
      { status: 500 }
    )
  }
}
