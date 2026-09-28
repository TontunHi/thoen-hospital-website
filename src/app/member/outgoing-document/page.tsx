import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import OutgoingDocAdminClient from './OutgoingDocAdminClient'

export const metadata = {
  title: 'จัดการลิงก์หนังสือส่งออก Online | Thoen Hospital Member Portal',
  description: 'ระบบจัดการลิงก์ Google Sheets สำหรับระบบหนังสือส่งออก Online ของโรงพยาบาลเถิน',
}

export default async function MemberOutgoingDocPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  const isAuthorized = await checkPositionPermission(session.username, 'manage_outgoing_doc')
  if (!isAuthorized) {
    redirect('/member')
  }

  return <OutgoingDocAdminClient username={session.username} />
}
