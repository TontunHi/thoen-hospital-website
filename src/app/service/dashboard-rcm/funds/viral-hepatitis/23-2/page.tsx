import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmHepatitisCService } from '@/lib/clinical/rcmHepatitisCService'
import HepatitisC232Client from '@/app/service/dashboard-rcm/funds/hepatitis-c/23-2/HepatitisC232Client'

export const metadata: Metadata = {
  title: '23.2 บริการตรวจคัดกรองไวรัสตับอักเสบ C | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการตรวจคัดกรองไวรัสตับอักเสบ C รหัส ADP 36331 รายงานกองทุนและการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function ViralHepatitis232Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/viral-hepatitis/23-2')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmHepatitisCService.getHepatitisCReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <HepatitisC232Client initialData={initialData} />
}
