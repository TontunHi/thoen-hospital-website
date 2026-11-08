import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  RcmAdpSearchService,
  type AdpOption,
  type AdpSearchReportResult,
} from '@/lib/clinical/rcmAdpSearchService'
import AdpSearchClient from './AdpSearchClient'

export const metadata: Metadata = {
  title: 'ค้นหาจากรหัส ADPCODE | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'ค้นหารายชื่อผู้รับบริการและข้อมูลการชดเชยค่าบริการทางการแพทย์จากรหัส ADP (OPD และ IPD) กองทุน RCM โรงพยาบาลเถิน',
}

export default async function AdpSearchAdpCodePage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/adp-search/adpcode')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Pre-fetch initial data and available ADP options on server to reduce waterfall (Zero Skeleton first paint)
  let initialData: AdpSearchReportResult | null = null
  let availableOptions: AdpOption[] = []
  try {
    const [report, options] = await Promise.all([
      RcmAdpSearchService.getAdpSearchReport({
        patientType: 'OPD',
        adpCode: '14001',
        page: 1,
        pageSize: 50,
      }),
      RcmAdpSearchService.getAvailableAdpCodes(),
    ])
    initialData = report
    availableOptions = options
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
    availableOptions = []
  }

  return <AdpSearchClient initialData={initialData} availableOptions={availableOptions} />
}
