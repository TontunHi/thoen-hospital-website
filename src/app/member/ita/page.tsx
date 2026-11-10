import { verifyMemberSession } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
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
  const members = await apiGateway.app.getMembers({ search: session.username, limit: 5 })
  const member = members.find((m: any) => m.username === session.username)

  if (!member) {
    redirect('/member/login')
  }

  const isAdmin = member.role === 'admin'

  // Fetch blogs: admin can view/manage all blogs, normal members view/manage only their own
  let blogs: any[] = []
  try {
    blogs = await apiGateway.app.getItaBlogs({
      authorId: member.id as number,
      admin: isAdmin
    })
  } catch (error) {
    console.error('Failed to query blogs:', error)
  }

  return <ItaManagementClient initialBlogs={blogs} currentUserId={member.id as number} isAdmin={isAdmin} />
}
