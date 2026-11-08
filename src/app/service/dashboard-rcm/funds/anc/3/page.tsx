import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AncService23Client from './AncService23Client'
import { RcmAncService } from '@/lib/clinical/rcmAncService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: '2.3 หญิงตั้งครรภ์ US - ตรวจช่องปาก - ขัดฟัน | กองทุนฝากครรภ์ (ANC) Dashboard-RCM',
  description:
    'รายงาน 2.3 หญิงตั้งครรภ์ ได้รับบริการตรวจ Ultrasound-ตรวจช่องปาก-ขัดทำความสะอาดฟัน ตรวจสอบการนัดฝากครรภ์ หัตถการทันตกรรม และการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function AncService23Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData = null

  try {
    initialData = await RcmAncService.getAncService23Report({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      cardFilter: 'ALL',
      serviceFilter: 'ALL',
      ucFilter: 'ALL',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
    })
  } catch (error) {
    console.error('Failed to prefetch ANC 2.3 SSR data:', error)
  }

  return <AncService23Client initialData={initialData} initialRange={defaultRange} />
}
