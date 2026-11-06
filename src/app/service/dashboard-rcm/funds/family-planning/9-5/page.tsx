import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import SingleHormonePillClient from './SingleHormonePillClient'

export const metadata = {
  title: '9.5 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดียว (FP003_2) | กองทุนบริการวางแผนครอบครัว Dashboard-RCM',
  description:
    'รายงานหัวข้อที่ 9.5 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดียว รหัส ADP: FP003_2 ตรวจสอบการลงรหัส Dx Z304 ค่าบริการ และสถานะการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService95Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <SingleHormonePillClient />
}
