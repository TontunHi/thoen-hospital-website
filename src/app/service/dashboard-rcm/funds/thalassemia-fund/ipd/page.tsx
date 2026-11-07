import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmThalassemiaFundService } from '@/lib/clinical/rcmThalassemiaFundService'
import ThalassemiaIpdClient from './ThalassemiaIpdClient'

export const metadata: Metadata = {
  title: 'ผู้ป่วยใน Thalassemia | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานผู้ป่วยในโรคโลหิตจางธาลัสซีเมียชนิดรุนแรง ได้รับการให้เลือด (ICD-9 9904 หรือ ADP 232xxxx) หรือยาขับธาตุเหล็ก ผลตรวจ Ferritin, Hb, Hct และการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function ThalassemiaIpdPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/thalassemia-fund/ipd')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data on server to reduce waterfall (Zero Skeleton first paint)
  let initialData = null
  try {
    initialData = await RcmThalassemiaFundService.getIpdReport({
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <ThalassemiaIpdClient initialData={initialData} />
}
