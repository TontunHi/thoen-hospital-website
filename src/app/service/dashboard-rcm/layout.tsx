import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import DashboardRcmShell from './DashboardRcmShell'
import './layout.css'

export const metadata = {
  title: 'Dashboard-RCM | โรงพยาบาลเถิน',
  description: 'ระบบนำเสนอและกำกับติดตามรายได้โรงพยาบาล สิทธิเบิกชดเชย e-Claim และลูกหนี้คงค้าง โรงพยาบาลเถิน',
}

export default async function DashboardRcmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return (
    <DashboardRcmShell userRole={session.role}>
      {children}
    </DashboardRcmShell>
  )
}
