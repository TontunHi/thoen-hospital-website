import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmIronSupplementsService } from '@/lib/clinical/rcmIronSupplementsService'
import IronSupplements182Client from './IronSupplements182Client'

export const metadata: Metadata = {
  title: '18.2 รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001) | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการยาเม็ดเสริมธาตุเหล็ก อายุ 13-45 ปี ADP + Drug รหัส ADP 14001 รายงานกองทุนและการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function IronSupplements182Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/iron-supplements/18-2')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmIronSupplementsService.getIronSupplementsReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <IronSupplements182Client initialData={initialData} />
}
