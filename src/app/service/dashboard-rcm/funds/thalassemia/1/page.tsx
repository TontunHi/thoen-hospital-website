import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import ThalassemiaService31Client from './ThalassemiaService31Client'
import { RcmThalassemiaService } from '@/lib/clinical/rcmThalassemiaService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: '3.1 คัดกรองธาลัสซีเมียในหญิงตั้งครรภ์ | กองทุน Dashboard-RCM',
  description:
    'รายงาน 3.1 การตรวจคัดกรองธาลัสซีเมียในหญิงตั้งครรภ์และสามี ตรวจสอบการบันทึกข้อมูลคลอด Lab OF/DCIP/Hb Typing และการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function ThalassemiaPage() {
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
    initialData = await RcmThalassemiaService.getThalassemiaReport({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      cardFilter: 'ALL',
      laborTypeFilter: 'ALL',
      searchField: 'ALL',
      sortBy: 'labor_date',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
    })
  } catch (error) {
    console.error('Failed to prefetch Thalassemia SSR data:', error)
  }

  return <ThalassemiaService31Client initialData={initialData} initialRange={defaultRange} />
}
