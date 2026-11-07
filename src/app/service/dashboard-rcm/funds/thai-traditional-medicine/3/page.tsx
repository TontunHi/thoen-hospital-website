import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmThaiTraditionalMedicineService } from '@/lib/clinical/rcmThaiTraditionalMedicineService'
import ThaiTraditionalMedicine3Client from './ThaiTraditionalMedicine3Client'

export const metadata: Metadata = {
  title: 'รายชื่อผู้รับบริการแพทย์แผนไทยรวม | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานบริการแพทย์แผนไทย และการแพทย์ทางเลือก: รายชื่อผู้รับบริการแพทย์แผนไทยรวม การรักษา 7 ด้าน การชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function ThaiTraditionalMedicine3Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/thai-traditional-medicine/3')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmThaiTraditionalMedicineService.getReportTopic3({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <ThaiTraditionalMedicine3Client initialData={initialData} />
}
