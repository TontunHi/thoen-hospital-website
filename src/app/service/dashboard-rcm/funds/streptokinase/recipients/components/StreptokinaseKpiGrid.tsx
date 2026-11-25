'use client'

import React from 'react'
import {
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  ReceiptText,
  Send,
} from 'lucide-react'
import type {
  StreptokinaseSummary,
  StreptokinaseCardFilter,
} from '@/lib/clinical/rcmStreptokinaseService'

export function formatStkMoney(val?: number | null, fallbackZero: boolean = false): string {
  if (val == null) return fallbackZero ? '0.00' : '—'
  if (val === 0) return fallbackZero ? '0.00' : '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface StreptokinaseKpiGridProps {
  summary: StreptokinaseSummary
  cardFilter: StreptokinaseCardFilter
  onCardClick: (filter: StreptokinaseCardFilter) => void
}

export function StreptokinaseKpiGrid({
  summary,
  cardFilter,
  onCardClick,
}: StreptokinaseKpiGridProps) {
  return (
    <div className="stk-kpi-grid">
      <div
        className={`stk-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
        onClick={() => onCardClick('ALL')}
        role="button"
        tabIndex={0}
      >
        <div className="stk-kpi-card-header">
          <span className="stk-kpi-label">ผู้รับยาทั้งหมด</span>
          <HeartPulse size={18} className="stk-kpi-icon" />
        </div>
        <div className="stk-kpi-value-row">
          <span className="stk-kpi-value">{summary.totalCases.toLocaleString()}</span>
          <span className="stk-kpi-sub">{summary.uniquePatients.toLocaleString()} คน</span>
        </div>
      </div>

      <div
        className={`stk-kpi-card ${cardFilter === 'AUDIT_PASS' ? 'is-active' : ''}`}
        onClick={() => onCardClick('AUDIT_PASS')}
        role="button"
        tabIndex={0}
      >
        <div className="stk-kpi-card-header">
          <span className="stk-kpi-label">บันทึก Dx/Op ถูกต้อง</span>
          <CheckCircle2 size={18} className="stk-kpi-icon text-emerald-600" />
        </div>
        <div className="stk-kpi-value-row">
          <span className="stk-kpi-value text-emerald-700">
            {summary.auditPassCases.toLocaleString()}
          </span>
          <span className="stk-kpi-sub text-emerald-600">{summary.auditPassRate}%</span>
        </div>
      </div>

      <div
        className={`stk-kpi-card is-error ${cardFilter === 'AUDIT_ERROR' ? 'is-active' : ''}`}
        onClick={() => onCardClick('AUDIT_ERROR')}
        role="button"
        tabIndex={0}
      >
        <div className="stk-kpi-card-header">
          <span className="stk-kpi-label text-rose-700">พบข้อผิดพลาด Dx/Op</span>
          <AlertTriangle size={18} className="stk-kpi-icon text-rose-600" />
        </div>
        <div className="stk-kpi-value-row">
          <span className="stk-kpi-value text-rose-600">
            {summary.auditErrorCases.toLocaleString()}
          </span>
          <span className="stk-kpi-sub text-rose-600">{summary.auditErrorRate}%</span>
        </div>
      </div>

      <div
        className={`stk-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
        onClick={() => onCardClick('COMPENSATED')}
        role="button"
        tabIndex={0}
      >
        <div className="stk-kpi-card-header">
          <span className="stk-kpi-label">ได้รับชดเชยแล้ว</span>
          <FileCheck2 size={18} className="stk-kpi-icon" />
        </div>
        <div className="stk-kpi-value-row">
          <span className="stk-kpi-value">{summary.compensatedCases.toLocaleString()}</span>
          <span className="stk-kpi-sub">{formatStkMoney(summary.totalCompensated, true)} บาท</span>
        </div>
      </div>

      <div
        className={`stk-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
        onClick={() => onCardClick('UNCOMPENSATED')}
        role="button"
        tabIndex={0}
      >
        <div className="stk-kpi-card-header">
          <span className="stk-kpi-label">รอการชดเชย</span>
          <ReceiptText size={18} className="stk-kpi-icon" />
        </div>
        <div className="stk-kpi-value-row">
          <span className="stk-kpi-value">{summary.uncompensatedCases.toLocaleString()}</span>
          <span className="stk-kpi-sub">ค้างชำระ {formatStkMoney(summary.totalDebit, true)} บาท</span>
        </div>
      </div>

      <div
        className={`stk-kpi-card ${cardFilter === 'WITH_INVOICE' ? 'is-active' : ''}`}
        onClick={() => onCardClick('WITH_INVOICE')}
        role="button"
        tabIndex={0}
      >
        <div className="stk-kpi-card-header">
          <span className="stk-kpi-label">ได้รับ Invoice (สปสช.)</span>
          <CheckCircle2 size={18} className="stk-kpi-icon text-blue-600" />
        </div>
        <div className="stk-kpi-value-row">
          <span className="stk-kpi-value">{summary.withInvoiceCases.toLocaleString()}</span>
          <span className="stk-kpi-sub">มี Invoice แล้ว</span>
        </div>
      </div>

      <div
        className={`stk-kpi-card ${cardFilter === 'WITH_REP' ? 'is-active' : ''}`}
        onClick={() => onCardClick('WITH_REP')}
        role="button"
        tabIndex={0}
      >
        <div className="stk-kpi-card-header">
          <span className="stk-kpi-label">ได้รับ Rep แล้ว</span>
          <ReceiptText size={18} className="stk-kpi-icon text-purple-600" />
        </div>
        <div className="stk-kpi-value-row">
          <span className="stk-kpi-value">{summary.withRepCases.toLocaleString()}</span>
          <span className="stk-kpi-sub">ตอบรับ Rep</span>
        </div>
      </div>

      <div
        className={`stk-kpi-card ${cardFilter === 'NOT_SENT' ? 'is-active' : ''}`}
        onClick={() => onCardClick('NOT_SENT')}
        role="button"
        tabIndex={0}
      >
        <div className="stk-kpi-card-header">
          <span className="stk-kpi-label">ยังไม่ส่ง E-Claim</span>
          <Send size={18} className="stk-kpi-icon text-amber-600" />
        </div>
        <div className="stk-kpi-value-row">
          <span className="stk-kpi-value text-amber-700">
            {summary.notSentCases.toLocaleString()}
          </span>
          <span className="stk-kpi-sub text-amber-600">รอดำเนินการ</span>
        </div>
      </div>
    </div>
  )
}
