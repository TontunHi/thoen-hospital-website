import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { DocumentStorage, StorageValidationError, sanitizeName } from '@/lib/storage/documentStorage'

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'ไม่พบไฟล์ที่อัปโหลด' },
        { status: 400 }
      )
    }

    const safeUsername = sanitizeName(member.username)

    const saved = await DocumentStorage.save(file, {
      destinationDir: `storage/${safeUsername}`,
      baseName: 'profile',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
      allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
      maxSizeBytes: 5 * 1024 * 1024,
      collisionStrategy: 'fixed',
      allowedRootPrefixes: ['storage'],
    })

    const relativePath = saved.relativePath

    // Update profile_path in members table
    await queryMemberDb(
      'UPDATE members SET profile_path = ? WHERE username = ?',
      [relativePath, member.username]
    )

    return NextResponse.json({
      success: true,
      message: 'อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว',
      path: relativePath
    })
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Upload profile picture error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปโหลดรูปโปรไฟล์' },
      { status: 500 }
    )
  }
}

