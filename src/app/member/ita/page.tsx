import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import ItaManagementClient from './ItaManagementClient'
import './page.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ระบบจัดการบทความ ITA | โรงพยาบาลเถิน',
  description: 'เขียนบทความ แก้ไขข้อมูลการประเมินคุณธรรมและความโปร่งใสสู่สาธารณะ',
}

export default async function MemberItaPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  // Get current user details
  const members = await queryMemberDb(
    'SELECT id, username, name, position, role FROM members WHERE username = ? LIMIT 1',
    [session.username]
  )

  if (!members || members.length === 0) {
    redirect('/member/login')
  }

  const member = members[0]
  const isAdmin = member.role === 'admin'

  // Fetch blogs: admin can view/manage all blogs, normal members view/manage only their own
  let blogs = []
  try {
    if (isAdmin) {
      blogs = await queryMemberDb(
        'SELECT id, title, author_name, author_position, created_at, updated_at FROM ita_blogs ORDER BY created_at DESC'
      )
    } else {
      blogs = await queryMemberDb(
        'SELECT id, title, author_name, author_position, created_at, updated_at FROM ita_blogs WHERE author_id = ? ORDER BY created_at DESC',
        [member.id]
      )
    }
  } catch (error) {
    console.error('Failed to query blogs:', error)
  }

  return <ItaManagementClient initialBlogs={blogs} currentUserId={member.id} isAdmin={isAdmin} />
}
