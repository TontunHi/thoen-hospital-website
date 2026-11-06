import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import FamilyPlanning92Client from './FamilyPlanning92Client'

export const metadata: Metadata = {
  title: '9.2 บริการใส่ห่วงอนามัย | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานและตรวจสอบข้อมูลบริการใส่ห่วงอนามัย รหัสบริการ ADP: 20003, FP001, 71681, 71682 การลงรหัสการวินิจฉัยโรค (Dx Z301), หัตถการ (Op 697), ค่าบริการ และการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService92Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/family-planning/2')
  }

  return <FamilyPlanning92Client />
}
