import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmTelemedDrugService } from '@/lib/clinical/rcmTelemedDrugService'
import TelemedClient from './TelemedClient'

export const metadata: Metadata = {
  title: '11.53 รายชื่อผู้ได้รับบริการ TelMed | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการการแพทย์ทางไกล รหัส ADP TELMED หรือประเภทการมาบริการสาธารณสุขทางไกล (รหัสส่งออก 5) กองทุน RCM โรงพยาบาลเถิน',
}

export default async function TelemedPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/telemed-drug/telemed')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmTelemedDrugService.getTelemedReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <TelemedClient initialData={initialData} />
}
