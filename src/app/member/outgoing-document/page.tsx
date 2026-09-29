import { getAuthenticatedMember } from '@/lib/memberAuth'
import OutgoingDocAdminClient from './OutgoingDocAdminClient'

export const metadata = {
  title: 'จัดการลิงก์หนังสือส่งออก Online | Thoen Hospital Member Portal',
  description: 'ระบบจัดการลิงก์ Google Sheets สำหรับระบบหนังสือส่งออก Online ของโรงพยาบาลเถิน',
}

export default async function MemberOutgoingDocPage() {
  const member = await getAuthenticatedMember({
    requiredPermission: 'manage_outgoing_doc',
    redirectTo: '/member',
  })

  return <OutgoingDocAdminClient username={member.username} />
}

