import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmRehabilitationService } from '@/lib/clinical/rcmRehabilitationService'
import DisabilityServicesClient from './DisabilityServicesClient'

export const metadata: Metadata = {
  title: 'รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์: รายการการให้บริการฟื้นฟูสมรรถภาพ: รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability เปรียบเทียบข้อมูลบริการ HOSxP และการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function DisabilityServicesPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect(
      '/member/login?returnUrl=/service/dashboard-rcm/funds/rehabilitation/services/disability-services'
    )
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmRehabilitationService.getDisabilityServicesReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <DisabilityServicesClient initialData={initialData} />
}
