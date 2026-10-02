import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { DocumentStorage } from '@/lib/storage/documentStorage'

async function checkSignatureAuth(session: any, queryUserId: string): Promise<{ targetUsername?: string; error?: string; status?: number }> {
  const sessionUsers = await queryMemberDb('SELECT id, role FROM members WHERE username = ? AND email = ? LIMIT 1', [session.username, session.email])
  if (sessionUsers.length === 0) return { error: 'ไม่พบผู้ใช้ของคุณในระบบ', status: 404 }
  const currentUser = sessionUsers[0]
  const targetUserIdParsed = Number.parseInt(queryUserId, 10)

  const users = await queryMemberDb('SELECT username FROM members WHERE id = ? LIMIT 1', [queryUserId])
  if (users.length === 0) return { error: 'ไม่พบผู้ใช้ที่ระบุ', status: 404 }
  
  if (currentUser.id !== targetUserIdParsed && currentUser.role !== 'admin') {
    return { error: 'คุณไม่มีสิทธิ์เข้าถึงลายเซ็นของผู้ใช้นี้', status: 403 }
  }
  return { targetUsername: users[0].username }
}

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const queryPath = searchParams.get('path')
    const queryUserId = searchParams.get('userId')

    if (queryPath) {
      try {
        const fileBuffer = await DocumentStorage.readBuffer(queryPath)
        return new Response(fileBuffer as any, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store, max-age=0' } })
      } catch (e: any) {
        if (e.code === 'FILE_NOT_FOUND') return NextResponse.json({ error: 'ไม่พบไฟล์ลายเซ็นบนเซิร์ฟเวอร์' }, { status: 404 })
        return NextResponse.json({ error: 'ไม่ได้รับอนุญาตให้เข้าถึงไฟล์นี้' }, { status: 403 })
      }
    }

    let targetUsername = session.username
    if (queryUserId) {
      const authCheck = await checkSignatureAuth(session, queryUserId)
      if (authCheck.error) return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
      targetUsername = authCheck.targetUsername!
    }

    const members = await queryMemberDb('SELECT signature_path FROM members WHERE username = ? LIMIT 1', [targetUsername])
    if (members.length === 0 || !members[0].signature_path) return NextResponse.json({ error: 'ไม่พบลายเซ็นดิจิทัล' }, { status: 404 })

    try {
      const fileBuffer = await DocumentStorage.readBuffer(members[0].signature_path)
      return new Response(fileBuffer as any, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store, max-age=0' } })
    } catch (e: any) {
      if (e.code === 'FILE_NOT_FOUND') return NextResponse.json({ error: 'ไม่พบไฟล์ลายเซ็นบนเซิร์ฟเวอร์' }, { status: 404 })
      throw e
    }
  } catch (error) {
    console.error('Serve signature image error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงรูปภาพลายเซ็น' }, { status: 500 })
  }
}
