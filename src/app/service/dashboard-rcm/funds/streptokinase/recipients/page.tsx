import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmStreptokinaseService } from '@/lib/clinical/rcmStreptokinaseService'
import StreptokinaseRecipientsClient from './StreptokinaseRecipientsClient'

export const metadata: Metadata = {
  title: 'รายชื่อรับยา Stroke และSTEMI | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'ตรวจสอบการบันทึกการรับยา Stroke และ STEMI ทั้งผู้ป่วยใน IPD และผู้ป่วยนอก OPD พร้อมการตรวจความถูกต้องของรหัสโรคและหัตถการ กองทุน RCM โรงพยาบาลเถิน',
}

export default async function StreptokinaseRecipientsPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/streptokinase/recipients')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmStreptokinaseService.getStreptokinaseReport({
      patientType: 'IPD',
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <StreptokinaseRecipientsClient initialData={initialData} />
}
