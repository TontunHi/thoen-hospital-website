import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmTelemedDrugService } from '@/lib/clinical/rcmTelemedDrugService'
import PostalDrugClient from './PostalDrugClient'

export const metadata: Metadata = {
  title: '11.52 รายชื่อผู้ได้รับการส่งยาทางไปรษณีย์ | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการจัดส่งยาทางไปรษณีย์ (Health Rider Project code) รหัส ADP DRUGP กองทุน RCM โรงพยาบาลเถิน',
}

export default async function PostalDrugPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/telemed-drug/postal-drug')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmTelemedDrugService.getPostalDrugReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <PostalDrugClient initialData={initialData} />
}
