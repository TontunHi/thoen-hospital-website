import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import ImplantInsertionClient from './ImplantInsertionClient'

export const metadata = {
  title: '9.3.1.1 รายการฝังยาคุม (FP002_1) | กองทุนบริการวางแผนครอบครัว Dashboard-RCM',
  description:
    'รายงานหัวข้อที่ 9.3.1.1 รายการฝังยาคุมกำเนิด รหัส ADP: FP002_1 ตรวจสอบการลงรหัส Dx Z308 ค่าบริการ และสถานะการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService9311Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <ImplantInsertionClient />
}
