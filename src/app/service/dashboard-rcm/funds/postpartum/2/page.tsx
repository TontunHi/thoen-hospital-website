import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import PostpartumService72Client from './PostpartumService72Client'

export const metadata: Metadata = {
  title: '7.2 การตรวจหลังคลอด ADP | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานการตรวจหลังคลอด ADP รหัส 30015 โครงการตรวจหลังคลอด (Z390-391-392) ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
}

export default async function PostpartumService72Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/postpartum/2')
  }

  return <PostpartumService72Client />
}
