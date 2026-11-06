import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import ImplantRemovalClient from './ImplantRemovalClient'

export const metadata = {
  title: '9.3.2 รายการถอดยาคุม (FP002_2) | กองทุนบริการวางแผนครอบครัว Dashboard-RCM',
  description:
    'รายงานหัวข้อที่ 9.3.2 รายการถอดยาคุมกำเนิด รหัส ADP: FP002_2 ตรวจสอบการลงรหัส Dx Z308 ค่าบริการ และสถานะการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService932Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <ImplantRemovalClient />
}
