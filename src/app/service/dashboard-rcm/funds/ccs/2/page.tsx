import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import CcsScreenedRecipientsClient from './CcsScreenedRecipientsClient'

export const metadata = {
  title: '1.2 รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก | คัดกรองมะเร็งปากมดลูก (CCS) กองทุน Dashboard-RCM',
  description:
    'รายงาน 1.2 รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก (CCS) ตรวจสอบรหัสบริการ ผลการตรวจ และการชดเชย Seamless / สปสช. โรงพยาบาลเถิน',
}

export default async function CcsScreenedRecipientsPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <CcsScreenedRecipientsClient />
}
