import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PostpartumService30016Client from './PostpartumService30016Client'

export const metadata = {
  title: '7.3 การจ่ายยา Triforine ADP (30016) | กองทุนการตรวจหลังคลอด Dashboard-RCM',
  description:
    'รายงานหัวข้อที่ 7.3 การจ่ายยา Triforine ADP รหัส 30016 ในกองทุนการตรวจหลังคลอด ตรวจสอบการสั่งจ่ายยา การวินิจฉัย หัตถการ และสถานะการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function PostpartumService30016Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <PostpartumService30016Client />
}
