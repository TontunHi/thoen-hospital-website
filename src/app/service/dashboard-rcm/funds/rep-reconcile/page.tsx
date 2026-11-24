import type { Metadata } from 'next'
import '../../../../../../opendesigner/build/css/tokens.css'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import {
  RcmFundsRepReconcileService,
  type RepReconcileResult,
} from '@/lib/clinical/rcmFundsRepReconcileService'
import RepReconcileClient from './RepReconcileClient'

export const metadata: Metadata = {
  title: 'รวมข้อมูล REP กองทุน (All Funds REP) | Dashboard-RCM โรงพยาบาลเถิน',
  description:
    'ศูนย์รวมตรวจสอบและกระทบยอด REP ข้ามทุกกองทุนจาก rcmdb.seamless, rcmdb.repdata และ rcmdb.repeclaim',
}

export default async function FundsRepReconcilePage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/rep-reconcile')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  logThrottledAudit(
    'READ',
    'rcm_funds_rep_reconcile_page',
    'Loaded SSR page for Unified Funds REP Reconcile',
    { username: session.username, email: session.email }
  ).catch(() => {})

  const initialRange = getDefaultFiscalYearDateRange()
  let initialData: RepReconcileResult | null = null
  let initialError: string | null = null

  try {
    initialData = await RcmFundsRepReconcileService.getReconcileReport({
      ds1: initialRange.startDate,
      ds2: initialRange.endDate,
      page: 1,
      pageSize: 50,
    })
  } catch (err: unknown) {
    console.error('SSR Prefetch Error (funds/rep-reconcile):', err)
    initialError = 'ไม่สามารถโหลดข้อมูลเริ่มต้นได้ กรุณากดปุ่มรีเฟรชเพื่อลองใหม่'
  }

  return (
    <RepReconcileClient
      initialData={initialData}
      initialRange={initialRange}
      initialError={initialError}
    />
  )
}
