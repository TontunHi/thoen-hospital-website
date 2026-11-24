'use client'

import React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { FundSummaryCard, RepReconcileSummary } from '@/lib/clinical/funds-reconcile/types'

interface FundSummaryCardsProps {
  summary: RepReconcileSummary
  focusedFundId: string
  onFocusFund: (fundId: string) => void
}

function formatBaht(amount: number | null | undefined): string {
  return (amount ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function FundSummaryCards({
  summary,
  focusedFundId,
  onFocusFund,
}: FundSummaryCardsProps) {
  const totalCompensated = summary.totalCompensated ?? 0
  const totalIncome = summary.totalIncome ?? 0
  const totalDiff = summary.totalDiff ?? 0
  const rate = summary.reimbursementRate ?? 0
  const seamlessComp = summary.seamlessCompensated ?? 0
  const eclaimComp = summary.eclaimCompensated ?? 0
  const cards: FundSummaryCard[] = summary.fundCards || []

  return (
    <>
      {/* 1. Asymmetric Hero KPI Strip */}
      <section className="rr-kpi-grid" aria-label="สรุปยอดชดเชยรวม">
        <div className="rr-kpi-card rr-kpi-card-lead">
          <div className="rr-kpi-label">ยอดชดเชยสุทธิรวม (หลังตัดรายการ REP ซ้ำ)</div>
          <div className="rr-kpi-value rr-kpi-value-accent">
            ฿{formatBaht(totalCompensated)}
          </div>
          <div className="rr-kpi-sub">
            <span>อัตราชดเชย {(rate ?? 0).toFixed(1)}%</span>
            <span>·</span>
            <span>
              Seamless ฿{formatBaht(seamlessComp)} / e-Claim ฿{formatBaht(eclaimComp)}
            </span>
          </div>
        </div>

        <div className="rr-kpi-card">
          <div className="rr-kpi-label">จำนวนใบ REP และรายการ Statement</div>
          <div className="rr-kpi-value">{(summary.totalLines ?? 0).toLocaleString('th-TH')}</div>
          <div className="rr-kpi-sub">
            <span>{(summary.uniqueRepCount ?? 0).toLocaleString('th-TH')} เลข REP</span>
            <span>·</span>
            <span>{(summary.uniqueVisitCount ?? 0).toLocaleString('th-TH')} VN/AN</span>
          </div>
        </div>

        <div className="rr-kpi-card">
          <div className="rr-kpi-label">ยอดเรียกเก็บเทียบชดเชย (Diff)</div>
          <div className="rr-kpi-value">฿{formatBaht(totalIncome)}</div>
          <div className="rr-kpi-sub">
            <span>
              ส่วนต่าง {totalDiff >= 0 ? '+' : ''}
              {formatBaht(totalDiff)} บาท
            </span>
            {(summary.dedupRemovedCount ?? 0) > 0 && (
              <>
                <span>·</span>
                <span>รวมซ้ำ {summary.dedupRemovedCount} รายการ</span>
              </>
            )}
          </div>
        </div>

        <div className="rr-kpi-card">
          <div className="rr-kpi-label">สถานะติด Error / อุทธรณ์</div>
          <div className="rr-kpi-value">{(summary.errorCount ?? 0).toLocaleString('th-TH')}</div>
          <div className="rr-kpi-sub">
            <span>อุทธรณ์ {(summary.appealCount ?? 0).toLocaleString('th-TH')} รายการ</span>
            {(summary.pendingRepCount ?? 0) > 0 && (
              <>
                <span>·</span>
                <span>รอ REP {(summary.pendingRepCount ?? 0).toLocaleString('th-TH')}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. Per-Fund Summary Cards */}
      <section aria-label="การ์ดสรุปยอดแต่ละกองทุน" className="rr-cards-section">
        <div className="rr-section-head">
          <h2>สรุปยอดชดเชยรายกองทุน ({cards.length} กองทุน)</h2>
          <span className="rr-section-hint">
            คลิกที่การ์ดเพื่อกรองตารางเฉพาะกองทุนนั้น · กดซ้ำเพื่อแสดงทุกกองทุนที่เลือก
          </span>
        </div>

        {cards.length === 0 ? (
          <div className="rr-table-card">
            <div className="rr-empty">ไม่พบข้อมูล REP ในช่วงเวลาและกองทุนที่เลือก</div>
          </div>
        ) : (
          <div className="rr-fund-cards-grid">
            {cards.map((card) => {
              const isFocused = focusedFundId === card.fundId
              const compTotal = card.totalCompensated ?? 0
              const eclaimPct =
                compTotal > 0 ? Math.round(((card.eclaimCompensated ?? 0) / compTotal) * 100) : 100
              const seamlessPct = Math.max(0, 100 - eclaimPct)

              return (
                <div
                  key={card.fundId}
                  role="button"
                  tabIndex={0}
                  className={`rr-fund-card ${isFocused ? 'focused' : ''}`}
                  onClick={() => onFocusFund(isFocused ? '' : card.fundId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onFocusFund(isFocused ? '' : card.fundId)
                    }
                  }}
                >
                  <div className="rr-fund-card-top">
                    <div className="rr-fund-card-title-group">
                      <span className="rr-fund-code-tag">{card.code}</span>
                      <span className="rr-fund-card-name">{card.shortLabel}</span>
                    </div>
                    <Link
                      href={card.href}
                      onClick={(e) => e.stopPropagation()}
                      title={`เปิดหน้ารายงาน ${card.shortLabel}`}
                      className="rr-fund-card-link"
                    >
                      <ExternalLink size={14} strokeWidth={1.5} />
                    </Link>
                  </div>

                  <div>
                    <div className="rr-fund-card-amount">฿{formatBaht(compTotal)}</div>
                    <div className="rr-subline">
                      เรียกเก็บ ฿{formatBaht(card.totalIncome)} ({(card.reimbursementRate ?? 0).toFixed(1)}%)
                    </div>
                  </div>

                  <div className="rr-fund-card-meta">
                    <span>
                      {(card.repLineCount ?? 0).toLocaleString('th-TH')} รายการ ·{' '}
                      {(card.uniqueRepCount ?? 0).toLocaleString('th-TH')} REP
                    </span>
                    <span>{(card.uniqueVisitCount ?? 0).toLocaleString('th-TH')} VN/AN</span>
                  </div>

                  <div className="rr-split-bar" aria-hidden="true">
                    <div className="rr-split-eclaim" style={{ width: `${eclaimPct}%` }} />
                    <div className="rr-split-seamless" style={{ width: `${seamlessPct}%` }} />
                  </div>

                  <div className="rr-split-legend">
                    <span>e-Claim ฿{formatBaht(card.eclaimCompensated)}</span>
                    <span>Seamless ฿{formatBaht(card.seamlessCompensated)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
