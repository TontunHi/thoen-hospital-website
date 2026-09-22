import { Suspense } from 'react'
import RduPublicClient from './RduPublicClient'
import './rdu.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'RDU การใช้ยาอย่างสมเหตุผล | โรงพยาบาลเถิน',
  description: 'เอกสาร ข้อมูลวิชาการ และ Antibiogram โครงการการใช้ยาอย่างสมเหตุผล (Rational Drug Use) โรงพยาบาลเถิน'
}

export default function RduPage() {
  return (
    <div className="rduPublicPage">
      <Suspense fallback={<div className="rduLoading">กำลังโหลดข้อมูลเอกสาร RDU...</div>}>
        <RduPublicClient />
      </Suspense>
    </div>
  )
}
