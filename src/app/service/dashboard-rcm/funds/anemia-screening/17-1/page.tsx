import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmAnemiaScreeningService } from '@/lib/clinical/rcmAnemiaScreeningService'
import AnemiaScreening171Client from './AnemiaScreening171Client'

export const metadata: Metadata = {
  title: '17.1 บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี รหัส ADP 13001 รายงานกองทุนและการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function AnemiaScreening171Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/anemia-screening/17-1')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmAnemiaScreeningService.getAnemiaScreeningReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <AnemiaScreening171Client initialData={initialData} />
}
