import React from 'react'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import BudgetTrackerShell from './BudgetTrackerShell'
import './budget-tracker.css'
import './budget-tracker-sidebar.css'

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
      <BudgetTrackerShell>{children}</BudgetTrackerShell>
    </div>
  )
}
