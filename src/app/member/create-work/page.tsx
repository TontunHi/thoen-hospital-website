import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import CreateWorkClient from './CreateWorkClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ระบบส่งมอบและติดตามงานช่างฯ | โรงพยาบาลเถิน',
  description: 'ระบบส่งแบบฟอร์มคำขอ มอบหมายงานช่างรักษา และติดตามขั้นตอนความคืบหน้าการทำงาน',
}

export default async function CreateWorkPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  // Get current user details to check permissions server-side
  const members = await queryMemberDb(
    'SELECT id, position, role FROM members WHERE username = ? LIMIT 1',
    [session.username]
  )

  if (!members || members.length === 0) {
    redirect('/member/login')
  }

  const member = members[0]
  const userPosition = (member.position || '').trim()
  
  let isAuthorized = member.role === 'admin'
  if (!isAuthorized && userPosition) {
    const workPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key IN ('create_work', 'view_all_work') AND TRIM(position_name) = TRIM(?)",
      [userPosition]
    )
    isAuthorized = (workPerms[0]?.count || 0) > 0
  }

  if (!isAuthorized) {
    redirect('/unauthorized')
  }

  return <CreateWorkClient />
}
