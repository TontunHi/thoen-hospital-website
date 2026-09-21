import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import ERTvModeClient from './ERTvModeClient'

export const metadata = {
  title: 'ระบบแสดงผลสถานะห้องฉุกเฉิน (TV Mode) | โรงพยาบาลเถิน',
  description: 'จอแสดงผลสถานะห้องฉุกเฉินสำหรับตั้งบอร์ดทีวี โรงพยาบาลเถิน',
}

export default function ERTvModePage() {
  return <ERTvModeClient />
}
