import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmViralHepatitisService } from '@/lib/clinical/rcmViralHepatitisService'
import ViralHepatitis231Client from './ViralHepatitis231Client'

export const metadata: Metadata = {
  title: '23.1 บริการตรวจคัดกรองไวรัสตับอักเสบ B | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการตรวจคัดกรองไวรัสตับอักเสบ B (Hepatitis B Screening) รหัส ADP 36318, 36319 รายงานกองทุนและการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function ViralHepatitis231Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/viral-hepatitis/23-1')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmViralHepatitisService.getViralHepatitisReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <ViralHepatitis231Client initialData={initialData} />
}
