import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import OralContraceptivesClient from './OralContraceptivesClient'

export const metadata = {
  title: '9.4 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม (FP003_1) | กองทุนบริการวางแผนครอบครัว Dashboard-RCM',
  description:
    'รายงานหัวข้อที่ 9.4 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม รหัส ADP: FP003_1 ตรวจสอบการลงรหัส Dx Z304 ค่าบริการ และสถานะการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService94Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <OralContraceptivesClient />
}
