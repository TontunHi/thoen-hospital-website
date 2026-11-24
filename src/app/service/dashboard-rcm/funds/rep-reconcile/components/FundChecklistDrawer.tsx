'use client'

import React, { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import type { FundCategoryGroup } from '@/lib/clinical/funds-reconcile/types'

export interface FundCatalogItemWithStats {
  id: string
  code: string
  label: string
  shortLabel: string
  category: FundCategoryGroup
  href: string
  lineCount: number
  totalCompensated: number
}

interface FundChecklistDrawerProps {
  isOpen: boolean
  catalog: FundCatalogItemWithStats[]
  selectedFundIds: string[]
  onToggleFund: (fundId: string) => void
  onSelectAll: () => void
  onSelectWithDataOnly: () => void
  onClearAll: () => void
  onSelectCategory: (category: FundCategoryGroup) => void
  onClose: () => void
}

const CATEGORY_LABELS: Record<FundCategoryGroup, string> = {
  pp: 'กองทุนส่งเสริมป้องกัน (PP / คัดกรอง)',
  disease_drug: 'กองทุนเฉพาะโรคและยา',
  rehab_special: 'ฟื้นฟู / อุปกรณ์ / บริการเฉพาะ',
  general: 'กองทุนสิทธิหลักทั่วไป / อื่นๆ',
}

const CATEGORY_ORDER: FundCategoryGroup[] = ['pp', 'disease_drug', 'rehab_special', 'general']

export default function FundChecklistDrawer({
  isOpen,
  catalog,
  selectedFundIds,
  onToggleFund,
  onSelectAll,
  onSelectWithDataOnly,
  onClearAll,
  onSelectCategory,
  onClose,
}: FundChecklistDrawerProps) {
  const [fundSearch, setFundSearch] = useState('')

  const selectedSet = useMemo(() => new Set(selectedFundIds), [selectedFundIds])

  const groupedFunds = useMemo(() => {
    const q = fundSearch.trim().toLowerCase()
    const filtered = q
      ? catalog.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            f.shortLabel.toLowerCase().includes(q) ||
            f.code.toLowerCase().includes(q)
        )
      : catalog

    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      title: CATEGORY_LABELS[cat],
      items: filtered.filter((f) => f.category === cat),
    })).filter((g) => g.items.length > 0)
  }, [catalog, fundSearch])

  if (!isOpen) return null

  return (
    <section className="rr-checklist-drawer" aria-label="ตัวกรองรายชื่อกองทุน">
      <div className="rr-checklist-header">
        <div className="rr-checklist-title">
          <h2>เลือกกองทุนจากระบบ /funds/* เพื่อแสดงผลและคำนวณยอด</h2>
          <p>
            ติ๊กเลือกได้หลายกองทุนพร้อมกัน (ไม่ติ๊กเลย = แสดงทุกกองทุน) · เลือกอยู่{' '}
            <span className="rr-mono">
              {selectedFundIds.length === 0 ? catalog.length : selectedFundIds.length}/{catalog.length}
            </span>{' '}
            กองทุน
          </p>
        </div>
        <div className="rr-checklist-tools">
          <div className="rr-search-wrap rr-search-wrap-compact">
            <Search size={16} strokeWidth={1.5} className="rr-search-icon" />
            <input
              type="text"
              className="rr-input rr-input-compact rr-search-input"
              placeholder="กรองชื่อกองทุน"
              value={fundSearch}
              onChange={(e) => setFundSearch(e.target.value)}
            />
            {fundSearch && (
              <button
                type="button"
                className="rr-search-clear"
                onClick={() => setFundSearch('')}
                aria-label="ล้างคำค้นหากองทุน"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
          <button type="button" className="rr-btn rr-btn-secondary rr-btn-sm" onClick={onSelectAll}>
            <Check size={14} strokeWidth={1.5} />
            เลือกทั้งหมด
          </button>
          <button
            type="button"
            className="rr-btn rr-btn-secondary rr-btn-sm"
            onClick={onSelectWithDataOnly}
          >
            เฉพาะที่มีรายการ
          </button>
          <button type="button" className="rr-btn rr-btn-secondary rr-btn-sm" onClick={onClearAll}>
            ล้างค่า
          </button>
          <button
            type="button"
            className="rr-btn rr-btn-primary rr-btn-sm"
            onClick={onClose}
          >
            พับแผงตัวกรอง
          </button>
        </div>
      </div>

      <div className="rr-checklist-groups">
        {groupedFunds.map((group) => (
          <div key={group.category} className="rr-fund-group-box">
            <div className="rr-fund-group-head">
              <span>{group.title}</span>
              <button
                type="button"
                className="rr-link-btn"
                onClick={() => onSelectCategory(group.category)}
              >
                เลือกทั้งหมวด
              </button>
            </div>
            <div className="rr-fund-check-list">
              {group.items.map((item) => {
                const isChecked =
                  selectedFundIds.length === 0 ? true : selectedSet.has(item.id)
                return (
                  <label key={item.id} className="rr-fund-check-item">
                    <span className="rr-fund-check-left">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleFund(item.id)}
                      />
                      <span className="rr-fund-code-tag">{item.code}</span>
                      <span className="rr-fund-name" title={item.label}>
                        {item.shortLabel}
                      </span>
                    </span>
                    <span className="rr-fund-count">
                      {(item.lineCount ?? 0).toLocaleString('th-TH')}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
