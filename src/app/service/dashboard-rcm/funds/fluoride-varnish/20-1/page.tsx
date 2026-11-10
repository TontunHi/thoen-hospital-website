import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmFluorideVarnishService } from '@/lib/clinical/rcmFluorideVarnishService'
import FluorideVarnish201Client from './FluorideVarnish201Client'

export const metadata: Metadata = {
  title: '20.1 บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001) | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP รหัส ADP 15001 รายงานกองทุนและการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function FluorideVarnish201Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/fluoride-varnish/20-1')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmFluorideVarnishService.getFluorideVarnishReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <FluorideVarnish201Client initialData={initialData} />
}
