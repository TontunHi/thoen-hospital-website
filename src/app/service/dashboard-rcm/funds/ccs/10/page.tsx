import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import CcsService1B005Client from './CcsService1B005Client'

export const metadata = {
  title: '1.10 บริการ 1B005 | คัดกรองมะเร็งปากมดลูก (CCS) กองทุน Dashboard-RCM',
  description:
    'รายงาน 1.10 บริการ 1B005 (ตรวจคัดกรองมะเร็งปากมดลูก) ตรวจสอบการสั่งใช้รหัส ADP การวินิจฉัย หัตถการ และการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function CcsService1B005Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <CcsService1B005Client />
}
