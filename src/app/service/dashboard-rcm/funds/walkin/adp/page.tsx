import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import { RcmWalkinFundService } from '@/lib/clinical/rcmWalkinFundService'
import { logThrottledAudit } from '@/lib/audit'
import WalkinFundClient from './WalkinFundClient'

export const metadata: Metadata = {
  title: 'รายชื่อผู้รับบริการจาก ADP (WALKIN) | กองทุน Walkin RCM โรงพยาบาลเถิน',
  description:
    'กองทุน Walkin: รายชื่อผู้รับบริการจาก ADP (WALKIN) ตรวจสอบและกระทบยอดค่าใช้จ่าย HOSxP, E-Claim, Rep Data และ NHSO Invoice โรงพยาบาลเถิน',
}

export default async function WalkinFundAdpPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect(
      '/member/login?returnUrl=/service/dashboard-rcm/funds/walkin/adp'
    )
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  logThrottledAudit(
    'READ',
    'rcm_funds_walkin_page',
    'Accessed Walkin Fund ADP Report page',
    { username: session.username, email: session.email }
  ).catch(() => {})

  const initialRange = getDefaultFiscalYearDateRange()
  let initialData = null
  let initialError: string | null = null

  try {
    initialData = await RcmWalkinFundService.getReportData({
      ds1: initialRange.startDate,
      ds2: initialRange.endDate,
      page: 1,
      pageSize: 50,
    })
  } catch (err: unknown) {
    console.error('Walkin Fund SSR Prefetch Error:', err)
    initialError = 'ไม่สามารถโหลดข้อมูลเริ่มต้นได้ กรุณากดปุ่มรีเฟรชเพื่อลองใหม่'
  }

  return (
    <WalkinFundClient
      initialData={initialData}
      initialRange={initialRange}
      initialError={initialError}
    />
  )
}
