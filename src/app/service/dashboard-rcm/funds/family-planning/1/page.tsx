import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import FamilyPlanning91Client from './FamilyPlanning91Client'

export const metadata: Metadata = {
  title: '9.1 วางแผนครอบครัวและการป้องกันการตั้งครรภ์ | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานและตรวจสอบข้อมูลบริการวางแผนครอบครัวและการป้องกันการตั้งครรภ์ไม่พึงประสงค์ รหัสบริการ ADP หัตถการ ยาคุมกำเนิด และการชดเชยค่าบริการ โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService91Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/family-planning/1')
  }

  return <FamilyPlanning91Client />
}
