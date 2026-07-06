import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AuditLogsClient from './AuditLogsClient'
import './page.css'

export const dynamic = 'force-dynamic'

export default async function AdminAuditLogsPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin') {
    redirect('/member') // redirect back to dashboard if not admin
  }

  return (
    <div className="auditLogsContainer">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="auditLogsWrapper">
        <AuditLogsClient />
      </div>
    </div>
  )
}
