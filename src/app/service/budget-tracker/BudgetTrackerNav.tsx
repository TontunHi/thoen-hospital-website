'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSelectedLayoutSegment } from 'next/navigation'
import { BUDGET_NAV_GROUPS } from './budgetNavConfig'

export default function BudgetTrackerNav() {
  const segment = useSelectedLayoutSegment()
  const pathname = usePathname()

  const isSmt = segment === 'smt' || pathname?.startsWith('/service/budget-tracker/smt') || false
  const isMisHos = segment === 'mishos' || pathname?.startsWith('/service/budget-tracker/mishos') || false
  const isRh1 = segment === 'rh1' || (!isSmt && !isMisHos)

  // Top level active tabs from config (excluding unready/planfin)
  const items = BUDGET_NAV_GROUPS.flatMap((group) => group.items).filter(
    (item) => item.id !== 'planfin'
  )

  return (
    <div className="bt-main-tabs" role="tablist" aria-label="หมวดหมู่ระบบติดตามงบประมาณ">
      {items.map((item) => {
        const isCurrent =
          (item.id === 'rh1' && isRh1) ||
          (item.id === 'smt' && isSmt) ||
          (item.id === 'mishos' && isMisHos)
        const IconComponent = item.icon
        return (
          <Link
            key={item.id}
            href={item.href}
            role="tab"
            aria-selected={isCurrent}
            className={`bt-main-tab-btn ${isCurrent ? 'active' : ''}`}
            suppressHydrationWarning
          >
            <IconComponent size={18} />
            <span>{item.title}</span>
          </Link>
        )
      })}
    </div>
  )
}
