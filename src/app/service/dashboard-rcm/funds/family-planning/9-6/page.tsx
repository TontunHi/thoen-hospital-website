import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import EmergencyContraceptiveClient from './EmergencyContraceptiveClient'

export const metadata = {
  title: '9.6 ยาเม็ดคุมกำเนิดชนิดฉุกเฉิน (FP003_3) | กองทุนบริการวางแผนครอบครัว Dashboard-RCM',
  description:
    'รายงานหัวข้อที่ 9.6 ยาเม็ดคุมกำเนิดชนิดฉุกเฉิน รหัส ADP: FP003_3 ตรวจสอบการลงรหัส Dx Z304 ค่าบริการ และสถานะการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService96Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <EmergencyContraceptiveClient />
}
