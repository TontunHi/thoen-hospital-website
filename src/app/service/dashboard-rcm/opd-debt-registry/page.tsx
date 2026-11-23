import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import {
  RcmOpdDebtRegistryService,
  type OpdDebtRegistryResult,
} from '@/lib/clinical/rcmOpdDebtRegistryService'
import OpdDebtRegistryClient from './OpdDebtRegistryClient'

export const metadata: Metadata = {
  title: 'รายชื่อผู้ป่วยนอก รับบริการ ทะเบียนตั้งหนี้ (2.1.1.3) | Dashboard-RCM โรงพยาบาลเถิน',
  description:
    'ทะเบียนตั้งหนี้ผู้ป่วยนอกโรงพยาบาลเถิน (OPD) ตรวจสอบค่าใช้จ่าย สิทธิ e-Claim สิทธิผังบัญชี GFMIS เลขที่ใบเสร็จ และสถานะยืนยันตัวตน',
}

export default async function OpdDebtRegistryPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/opd-debt-registry')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  logThrottledAudit(
    'READ',
    'rcm_opd_debt_registry_page',
    'Accessed OPD Debt Registry (2.1.1.3) page',
    { username: session.username, email: session.email }
  ).catch(() => {})

  const initialRange = getDefaultFiscalYearDateRange()
  let initialData: OpdDebtRegistryResult | null = null
  let initialError: string | null = null

  try {
    initialData = await RcmOpdDebtRegistryService.getReportData({
      ds1: initialRange.startDate,
      ds2: initialRange.endDate,
      includeAdmitted: false,
      page: 1,
      pageSize: 50,
    })
  } catch (err: unknown) {
    console.error('OPD Debt Registry SSR Prefetch Error:', err)
    initialError = 'ไม่สามารถโหลดข้อมูลเริ่มต้นได้ กรุณากดปุ่มรีเฟรชเพื่อลองใหม่'
  }

  return (
    <OpdDebtRegistryClient
      initialData={initialData}
      initialRange={initialRange}
      initialError={initialError}
    />
  )
}
