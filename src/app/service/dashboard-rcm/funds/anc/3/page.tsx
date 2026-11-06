import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AncService23Client from './AncService23Client'

export const metadata = {
  title: '2.3 หญิงตั้งครรภ์ US - ตรวจช่องปาก - ขัดฟัน | กองทุนฝากครรภ์ (ANC) Dashboard-RCM',
  description:
    'รายงาน 2.3 หญิงตั้งครรภ์ ได้รับบริการตรวจ Ultrasound-ตรวจช่องปาก-ขัดทำความสะอาดฟัน ตรวจสอบการนัดฝากครรภ์ หัตถการทันตกรรม และการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function AncService23Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <AncService23Client />
}
