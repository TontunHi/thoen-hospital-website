import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmClopidogrelService } from '@/lib/clinical/rcmClopidogrelService'
import ClopidogrelUsageClient from './ClopidogrelUsageClient'

export const metadata: Metadata = {
  title: 'รายชื่อการใช้ยา Clopidogrel | กองทุนยา Clopidogrel โรงพยาบาลเถิน',
  description:
    'รายงานการใช้ยา Clopidogrel และการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function ClopidogrelUsagePage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/clopidogrel/usage')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmClopidogrelService.getClopidogrelReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <ClopidogrelUsageClient initialData={initialData} />
}
