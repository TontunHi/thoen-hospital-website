import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import { ItaBlogService } from '@/lib/cms/ItaBlogService'
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
  let blogs: any[] = []
  try {
    const res = await ItaBlogService.listBlogs({
      authorId: isAdmin ? undefined : member.id,
      limit: 100,
    })
    blogs = res.data
  } catch (error) {
    console.error('Failed to query blogs:', error)
  }

  return <ItaManagementClient initialBlogs={blogs} currentUserId={member.id} isAdmin={isAdmin} />
}
