import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { RcmDashboardService, getDefaultFiscalYearDateRange, type IPDRecord, type IpdDepartmentAdjrwItem } from '@/lib/clinical/rcmDashboardService'
import IpdClient from './IpdClient'

export const metadata = {
  title: 'สรุปผู้ป่วยใน IPD (2.1.2.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานสรุปการให้บริการผู้ป่วยในโรงพยาบาลเถิน จำแนกตามหอผู้ป่วยและแพทย์ผู้สั่งจำหน่าย',
}

export default async function IpdPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData = null
  let initialReportData: IPDRecord[] | null = null
  let initialDeptData: IpdDepartmentAdjrwItem[] | null = null

  try {
    const [reportRes, deptRes] = await Promise.all([
      RcmDashboardService.getIpdReport({ startDate: defaultRange.startDate, endDate: defaultRange.endDate }),
      RcmDashboardService.getIpdDepartmentAdjrw({ startDate: defaultRange.startDate, endDate: defaultRange.endDate }),
    ])
    initialReportData = reportRes
    initialDeptData = deptRes
    initialData = reportRes
  } catch {
    initialReportData = null
    initialDeptData = null
  }

  return (
    <IpdClient
      initialReportData={initialReportData}
      initialDeptData={initialDeptData}
      initialRange={defaultRange}
    />
  )
}
