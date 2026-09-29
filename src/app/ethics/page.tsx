import type { Metadata } from 'next'
import { Suspense } from 'react'
import { siteConfig } from '@/config/site'
import EthicsClientView from './EthicsClientView'

export const metadata: Metadata = {
  title: 'ชมรมจริยธรรม',
  description: 'เอกสาร แผนการดำเนินงาน และคำสั่งขับเคลื่อนชมรมจริยธรรม โรงพยาบาลเถิน จังหวัดลำปาง',
  openGraph: {
    title: `ชมรมจริยธรรม | ${siteConfig.name}`,
    description: 'เอกสาร แผนการดำเนินงาน และคำสั่งขับเคลื่อนชมรมจริยธรรม โรงพยาบาลเถิน',
  },
}

export default function EthicsPage() {
  return (
    <Suspense
      fallback={
        <div className="ethics-page" style={{ padding: '3rem 0', textAlign: 'center' }}>
          <div className="container">กำลังโหลดข้อมูลเอกสาร...</div>
        </div>
      }
    >
      <EthicsClientView />
    </Suspense>
  )
}
