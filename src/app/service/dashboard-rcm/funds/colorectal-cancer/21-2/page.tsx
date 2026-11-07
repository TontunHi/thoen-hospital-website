import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmColorectalCancerService } from '@/lib/clinical/rcmColorectalCancerService'
import ColorectalCancer212Client from './ColorectalCancer212Client'

export const metadata: Metadata = {
  title: '21.2 รายชื่อผู้รับบริการ ADP (90005) | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test) อายุ 50-70 ปี รหัส ADP 90005 รายงานกองทุนและการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function ColorectalCancer212Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/colorectal-cancer/21-2')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmColorectalCancerService.getColorectalCancerReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <ColorectalCancer212Client initialData={initialData} />
}
