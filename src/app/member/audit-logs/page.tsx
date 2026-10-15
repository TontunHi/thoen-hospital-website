import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AuditLogsClient from './AuditLogsClient'
import './page.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ประวัติความปลอดภัยและ Audit Logs | โรงพยาบาลเถิน',
  description: 'ระบบตรวจสอบและบันทึกประวัติความปลอดภัย กิจกรรมระบบ และการเข้าถึงข้อมูลสำคัญ โรงพยาบาลเถิน',
}

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
      <div className="auditLogsWrapper">
        <AuditLogsClient />
      </div>
    </div>
  )
}
