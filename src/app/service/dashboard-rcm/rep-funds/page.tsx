import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import {
  RcmRepFundsService,
  type PatientClaimRecord,
  type RepFundsSummaryResult,
} from '@/lib/clinical/rcmRepFundsService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import RepFundsClient from './RepFundsClient'

export const metadata = {
  title: 'ข้อมูล Rep แต่ละกองทุน (3.1.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description:
    'ตรวจสอบการชดเชยค่าบริการทางการแพทย์จากทั้ง rcmdb.repdata, rcmdb.repeclaim และ rcmdb.seamless (DMIS) รวมหลาย Rep และหลาย HN ในที่เดียว',
}

export default async function RepFundsPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/rep-funds')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  const defaultFiscalBeYear = String(new Date(`${defaultRange.endDate}T00:00:00`).getFullYear() + 543)
  let initialSummary: RepFundsSummaryResult | null = null
  let initialCases: PatientClaimRecord[] | null = null

  try {
    const [summaryRes, casesRes] = await Promise.all([
      RcmRepFundsService.getRepFundsSummary({
        source: 'repdata',
        fiscalYear: defaultFiscalBeYear,
        department: 'ALL',
      }),
      RcmRepFundsService.getRepCases({
        source: 'repdata',
        fiscalYear: defaultFiscalBeYear,
        department: 'ALL',
        limit: 250,
      }),
    ])
    initialSummary = summaryRes
    initialCases = casesRes
  } catch {
    initialSummary = null
    initialCases = null
  }

  return (
    <RepFundsClient
      initialSummary={initialSummary}
      initialCases={initialCases}
      initialRange={defaultRange}
    />
  )
}
