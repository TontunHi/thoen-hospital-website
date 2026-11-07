import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmThaiTraditionalMedicineService } from '@/lib/clinical/rcmThaiTraditionalMedicineService'
import ThaiTraditionalMedicine11Client from './ThaiTraditionalMedicine11Client'

export const metadata: Metadata = {
  title: 'รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานบริการแพทย์แผนไทย และการแพทย์ทางเลือก หัวข้อที่ 11: รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ สิทธิบัตรทอง (UCS/WEL) และการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function ThaiTraditionalMedicine11Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/thai-traditional-medicine/11')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmThaiTraditionalMedicineService.getReportTopic11({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <ThaiTraditionalMedicine11Client initialData={initialData} />
}
