import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import ThalassemiaService31Client from './ThalassemiaService31Client'

export const metadata: Metadata = {
  title: '3.1 คัดกรองธาลัสซีเมียในหญิงตั้งครรภ์ | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานการตรวจคัดกรองโรคโลหิตจางธาลัสซีเมียในหญิงตั้งครรภ์ ติดตามผลตรวจทางห้องปฏิบัติการ DCIP, Hemoglobin typing และรหัส ADP 30313, 37532 โรงพยาบาลเถิน',
}

export default async function ThalassemiaService31Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/thalassemia/1')
  }

  return <ThalassemiaService31Client />
}
