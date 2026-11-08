import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import { RcmInstrumentFundService } from '@/lib/clinical/rcmInstrumentFundService'
import { logThrottledAudit } from '@/lib/audit'
import InstrumentFundClient from './InstrumentFundClient'

export const metadata: Metadata = {
  title: 'รายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์ | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'กองทุนอวัยวะเทียมและอุปกรณ์: รายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์ ตรวจสอบและกระทบยอดค่าใช้จ่าย HOSxP, E-Claim, Rep Data และ NHSO Invoice โรงพยาบาลเถิน',
}

export default async function InstrumentFundPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect(
      '/member/login?returnUrl=/service/dashboard-rcm/funds/instrument'
    )
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  logThrottledAudit(
    'READ',
    'rcm_funds_instrument_page',
    'Accessed Instrument & Prostheses Report page',
    { username: session.username, email: session.email }
  ).catch(() => {})

  const initialRange = getDefaultFiscalYearDateRange()
  let initialData = null
  let initialError: string | null = null

  try {
    initialData = await RcmInstrumentFundService.getReportData({
      ds1: initialRange.startDate,
      ds2: initialRange.endDate,
      patientType: 'OPD',
      page: 1,
      pageSize: 50,
    })
  } catch (err: unknown) {
    console.error('Instrument Fund SSR Prefetch Error:', err)
    initialError = 'ไม่สามารถโหลดข้อมูลเริ่มต้นได้ กรุณากดปุ่มรีเฟรชเพื่อลองใหม่'
  }

  return (
    <InstrumentFundClient
      initialData={initialData}
      initialRange={initialRange}
      initialError={initialError}
    />
  )
}
