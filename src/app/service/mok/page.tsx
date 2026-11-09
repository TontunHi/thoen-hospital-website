import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import MokClient from './MokClient'

export const metadata = {
  title: 'หมออนามัยครอบครัว (มอค.) | โรงพยาบาลเถิน',
  description: 'ระบบสืบค้นและติดตามทะเบียนผู้ป่วยกลุ่มเสี่ยงและโรคเรื้อรัง หมออนามัยครอบครัว โรงพยาบาลเถิน',
}

export default async function MokPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <MokClient user={session} />
}
