import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Coins } from 'lucide-react'
import { verifyMemberSession } from '@/lib/memberAuth'
import BudgetTrackerNav from './BudgetTrackerNav'
import './budget-tracker.css'

export const metadata = {
  title: 'ติดตามงบประมาณประจำปี | โรงพยาบาลเถิน',
  description: 'ระบบติดตามและกำกับผลงานงบประมาณรายกองทุน โรงพยาบาลเถิน เปรียบเทียบมาตรฐานเขตสุขภาพที่ 1',
}

export default async function BudgetTrackerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  return (
    <div className="bt-page-container">
      <div className="bt-wrap">
        {/* Top Header & Breadcrumb */}
        <div className="bt-top-bar">
          <div>
            <div className="bt-breadcrumb">
              <Link href="/service">บริการสารสนเทศ</Link>
              <ChevronRight size={14} />
              <span>ติดตามงบประมาณประจำปี</span>
            </div>
            <h1 className="bt-title">
              <Coins className="bt-title-icon" size={28} />
              <span>ระบบติดตามงบประมาณประจำปี</span>
            </h1>
          </div>
        </div>

        {/* Top-Level Multi-Topic Navigation */}
        <BudgetTrackerNav />

        {/* Topic-specific Page Content */}
        {children}
      </div>
    </div>
  )
}
