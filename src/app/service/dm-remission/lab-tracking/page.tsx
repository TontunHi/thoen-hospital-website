import { redirect } from 'next/navigation'
import { logThrottledAudit } from '@/lib/audit'
import { dmRemissionLabService } from '@/lib/clinical/dmRemissionLabService'
import type { DmLabTrackingResult } from '@/lib/clinical/dmRemissionLabTypes'
import { verifyMemberSession } from '@/lib/memberAuth'
import DmLabTrackingClient from './DmLabTrackingClient'
import '../../../../../opendesigner/build/css/tokens.css'
import './page.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ติดตามการเจาะ HbA1c ผู้ป่วยเบาหวาน | DM Remission โรงพยาบาลเถิน',
  description:
    'ระบบคัดกรองและติดตามการเจาะ HbA1c ผู้ป่วยเบาหวานชนิดที่ 2 (E11) สิทธิ์ UC ที่ไม่มีคำสั่งใช้ยาเบาหวานจากฐานข้อมูล HOSxP',
}

export default async function DmLabTrackingPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  let initialData: DmLabTrackingResult | null = null
  let initialError: string | null = null

  try {
    initialData = await dmRemissionLabService.getLabTracking()
    logThrottledAudit(
      'READ',
      'dm_remission_lab_tracking',
      `Viewed DM Remission lab tracking SSR FY ${initialData.fiscalYear} (eligible: ${initialData.summary.totalEligible})`,
      session
    ).catch(() => {})
  } catch (err: unknown) {
    initialError =
      err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลติดตามการเจาะ HbA1c ได้'
  }

  return (
    <DmLabTrackingClient
      userRole={session.role}
      initialData={initialData}
      initialError={initialError}
    />
  )
}
