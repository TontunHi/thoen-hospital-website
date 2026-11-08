import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { RcmDashboardService, getDefaultFiscalYearDateRange, type InvoiceSummaryResult, type InvoiceDetailResult } from '@/lib/clinical/rcmDashboardService'
import InvoiceSummaryClient from './InvoiceSummaryClient'

export const metadata = {
  title: 'สรุปรายรับจาก Invoice (5.2.2.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานสรุปรายรับจาก Invoice และการชดเชยค่าบริการทางการแพทย์ โรงพยาบาลเถิน',
}

export default async function InvoiceSummaryPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData = null
  let initialSummary: InvoiceSummaryResult | null = null
  let initialDetail: InvoiceDetailResult | null = null

  try {
    const [summaryRes, detailRes] = await Promise.all([
      RcmDashboardService.getInvoiceSummary({
        department: 'OP',
        ds1: defaultRange.startDate,
        ds2: defaultRange.endDate,
        dateType: 'bill_date',
      }),
      RcmDashboardService.getInvoiceDetails({
        department: 'OP',
        ds1: defaultRange.startDate,
        ds2: defaultRange.endDate,
        dateType: 'bill_date',
        page: 1,
        pageSize: 50,
      }),
    ])
    initialSummary = summaryRes
    initialDetail = detailRes
    initialData = summaryRes
  } catch {
    initialSummary = null
    initialDetail = null
  }

  return (
    <InvoiceSummaryClient
      initialSummary={initialSummary}
      initialDetail={initialDetail}
      initialRange={defaultRange}
    />
  )
}
