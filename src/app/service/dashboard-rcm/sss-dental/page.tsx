import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import SssDentalClient from './SssDentalClient'

export const metadata = {
  title: 'ทันตกรรมประกันสังคม (2.1.1.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานการให้บริการทันตกรรมสิทธิ์ประกันสังคม โรงพยาบาลเถิน จำแนกตามทันตแพทย์',
}

export default async function SssDentalPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff') {
    redirect('/service')
  }

  return <SssDentalClient />
}
