import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { DocumentStorage } from '@/lib/storage/documentStorage'

export async function GET(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const queryUserId = searchParams.get('userId')

    let targetUsername = member.username
    if (queryUserId) {
      const users = await queryMemberDb('SELECT username FROM members WHERE id = ? LIMIT 1', [queryUserId])
      if (users.length > 0) targetUsername = users[0].username
      else return NextResponse.json({ error: 'ไม่พบผู้ใช้ที่ระบุ' }, { status: 404 })
    }

    const members = await queryMemberDb('SELECT profile_path FROM members WHERE username = ? LIMIT 1', [targetUsername])
    if (members.length === 0 || !members[0].profile_path) return NextResponse.json({ error: 'ไม่พบรูปโปรไฟล์' }, { status: 404 })

    const ext = members[0].profile_path.split('.').pop()?.toLowerCase() || 'png'
    let contentType = 'image/png'
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
    else if (ext === 'webp') contentType = 'image/webp'

    try {
      const fileBuffer = await DocumentStorage.readBuffer(members[0].profile_path)
      return new Response(fileBuffer as any, {
        headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
      })
    } catch (e: any) {
      if (e.code === 'FILE_NOT_FOUND') return NextResponse.json({ error: 'ไม่พบไฟล์รูปโปรไฟล์บนเซิร์ฟเวอร์' }, { status: 404 })
      throw e
    }
  } catch (error) {
    console.error('Serve profile image error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงรูปโปรไฟล์' }, { status: 500 })
  }
}
