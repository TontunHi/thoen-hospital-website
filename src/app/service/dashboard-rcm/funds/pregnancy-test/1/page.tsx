import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PregnancyTestClient from './PregnancyTestClient'
import { RcmPregnancyTestService } from '@/lib/clinical/rcmPregnancyTestService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: '8.1 บริการตรวจการตั้งครรภ์ (Pregnancy Test) | กองทุน Dashboard-RCM',
  description:
    'รายงาน 8.1 บริการตรวจการตั้งครรภ์ รหัส ADP 8.1 / ตรวจสอบการบันทึก Lab, ผลตรวจ, สิทธิการรักษา และการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function PregnancyTestPage() {
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
    initialData = await RcmPregnancyTestService.getPregnancyTestReport({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      cardFilter: 'ALL',
      ucOnly: false,
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
    })
  } catch (error) {
    console.error('Failed to prefetch Pregnancy Test SSR data:', error)
  }

  return <PregnancyTestClient initialData={initialData} initialRange={defaultRange} />
}
