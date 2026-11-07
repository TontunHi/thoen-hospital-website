import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmThalassemiaFundService } from '@/lib/clinical/rcmThalassemiaFundService'
import ThalassemiaOpdClient from './ThalassemiaOpdClient'

export const metadata: Metadata = {
  title: 'ผู้ป่วยนอก Thalassemia | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานผู้ป่วยนอกโรคโลหิตจางธาลัสซีเมียชนิดรุนแรง ได้รับยาขับธาตุเหล็ก หรือได้รับการให้เลือด ผลตรวจ Ferritin, Hb, Hct และการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function ThalassemiaOpdPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/thalassemia-fund/opd')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmThalassemiaFundService.getOpdReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <ThalassemiaOpdClient initialData={initialData} />
}
