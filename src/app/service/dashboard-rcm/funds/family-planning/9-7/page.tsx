import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import InjectableContraceptivesClient from './InjectableContraceptivesClient'

export const metadata = {
  title: '9.7 ยาฉีดคุมกำเนิด (FP003_4) | กองทุนบริการวางแผนครอบครัว Dashboard-RCM',
  description:
    'รายงานหัวข้อที่ 9.7 ยาฉีดคุมกำเนิด รหัส ADP: FP003_4 ตรวจสอบการลงรหัส Dx Z304 ค่าบริการ และสถานะการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService97Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <InjectableContraceptivesClient />
}
