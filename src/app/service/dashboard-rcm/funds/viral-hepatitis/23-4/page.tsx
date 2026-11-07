import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmHepatitisCService } from '@/lib/clinical/rcmHepatitisCService'
import HepatitisC234Client from './HepatitisC234Client'

export const metadata: Metadata = {
  title: '23.4 ตรวจยืนยันไวรัสตับ C HCV RNA (36333) | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการตรวจยืนยันการติดเชื้อไวรัสตับอักเสบซีด้วยวิธี HCV RNA รหัส ADP 36333 รายงานกองทุนและการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function ViralHepatitis234Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/viral-hepatitis/23-4')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmHepatitisCService.getHepatitisCReport({
      adpCode: '36333',
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <HepatitisC234Client initialData={initialData} />
}
