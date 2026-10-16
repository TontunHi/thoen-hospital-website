import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import InvoiceSummaryClient from './InvoiceSummaryClient'

export const metadata = {
  title: 'สรุปรายรับจาก Invoice (5.2.2.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานสรุปรายรับจาก Invoice และกระทบยอดชดเชย e-Claim (OPD / IPD) โรงพยาบาลเถิน',
}

export default async function InvoiceSummaryPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <InvoiceSummaryClient />
}
