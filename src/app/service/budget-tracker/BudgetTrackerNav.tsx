'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSelectedLayoutSegment } from 'next/navigation'
import { Building2, BarChart3, Activity, Layers } from 'lucide-react'

export default function BudgetTrackerNav() {
  const segment = useSelectedLayoutSegment()
  const pathname = usePathname()

  const isSmt = segment === 'smt' || pathname?.startsWith('/service/budget-tracker/smt') || false
  const isMisHos = segment === 'mishos' || pathname?.startsWith('/service/budget-tracker/mishos') || false
  const isPlanfin = segment === 'planfin' || pathname?.startsWith('/service/budget-tracker/planfin') || false
  const isRh1 = segment === 'rh1' || (!isSmt && !isMisHos && !isPlanfin)

  return (
    <div className="bt-main-tabs" role="tablist" aria-label="หมวดหมู่ระบบติดตามงบประมาณ">
      <Link
        href="/service/budget-tracker/rh1"
        role="tab"
        aria-selected={isRh1}
        className={`bt-main-tab-btn ${isRh1 ? 'active' : ''}`}
        suppressHydrationWarning
      >
        <Building2 size={18} />
        <span>ผลงานชดเชย เขต 1 (MIS HOS เขต 1)</span>
      </Link>

      <Link
        href="/service/budget-tracker/smt"
        role="tab"
        aria-selected={isSmt}
        className={`bt-main-tab-btn ${isSmt ? 'active' : ''}`}
        suppressHydrationWarning
      >
        <BarChart3 size={18} />
        <span>ติดตามงบ สปสช. (SMT Dashboard)</span>
      </Link>

      <Link
        href="/service/budget-tracker/mishos"
        role="tab"
        aria-selected={isMisHos}
        className={`bt-main-tab-btn ${isMisHos ? 'active' : ''}`}
        suppressHydrationWarning
      >
        <Activity size={18} />
        <span>MIS HOS สปสช. (ส่วนกลาง)</span>
      </Link>

      <Link
        href="/service/budget-tracker/planfin"
        role="tab"
        aria-selected={isPlanfin}
        className={`bt-main-tab-btn ${isPlanfin ? 'active' : ''}`}
        suppressHydrationWarning
      >
        <Layers size={18} />
        <span>แหล่งงบประมาณอื่น (Planfin / งบลงทุน)</span>
      </Link>
    </div>
  )
}
