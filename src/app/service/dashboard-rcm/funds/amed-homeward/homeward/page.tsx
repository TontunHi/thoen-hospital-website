import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmAmedHomewardService } from '@/lib/clinical/rcmAmedHomewardService'
import HomewardReportClient from './HomewardReportClient'

export const metadata: Metadata = {
  title: 'รายงาน HOMEWARD | ระบบ AMed และ Home Ward | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานข้อมูลผู้ป่วยในระบบการดูแล Home Ward และระบบ AMed Tele-medicine สิทธิการรักษาบัตรทองและกองทุนย่อย โรงพยาบาลเถิน',
}

export default async function HomewardReportPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/amed-homeward/homeward')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmAmedHomewardService.getHomewardReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <HomewardReportClient initialData={initialData} />
}
