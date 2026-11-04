import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import RepFundsClient from './RepFundsClient'

export const metadata = {
  title: 'ข้อมูล Rep แต่ละกองทุน (3.1.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานการชดเชยค่าบริการทางการแพทย์จาก สปสช. (REP) จำแนกตามกองทุนหลัก กองทุนย่อย และระบบค้นหารายบุคคล (HN + วันที่)',
}

export default async function RepFundsPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <RepFundsClient />
}
