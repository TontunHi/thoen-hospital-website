'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ReceiptText, ChevronDown, Check, X, Search } from 'lucide-react'
import {
  buildRepBreakdownSummary,
  NO_REP_FILTER_VALUE,
  type RepBreakdownSummary,
  type RepRowLike,
  type RepTagEntry,
} from '@/lib/clinical/rcmRepTagHelper'

export interface RepMultiSelectProps {
  selectedReps: string[]
  onChange: (reps: string[]) => void
  repBreakdown?: RepBreakdownSummary | null
  items?: readonly RepRowLike[]
  placeholder?: string
  disabled?: boolean
  className?: string
  align?: 'left' | 'right'
}

function formatMoneyCompact(val?: number | null): string {
  const num = Number(val ?? 0)
  if (!Number.isFinite(num) || num <= 0) return '0.00'
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function RepMultiSelect({
  selectedReps = [],
  onChange,
  repBreakdown,
  items,
  placeholder = 'ทุกเลขที่ REP',
  disabled = false,
  className = '',
  align = 'left',
}: RepMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const discoveredRef = useRef<Map<string, RepTagEntry>>(new Map())

  const effectiveBreakdown = useMemo(() => {
    if (repBreakdown) return repBreakdown
    return buildRepBreakdownSummary(items || [])
  }, [repBreakdown, items])

  useMemo(() => {
    for (const entry of effectiveBreakdown.repItems) {
      discoveredRef.current.set(entry.rep, entry)
    }
  }, [effectiveBreakdown.repItems])

  const allRepItems = useMemo(() => {
    const merged = new Map<string, RepTagEntry>()
    for (const entry of discoveredRef.current.values()) {
      merged.set(entry.rep, entry)
    }
    for (const entry of effectiveBreakdown.repItems) {
      merged.set(entry.rep, entry)
    }
    for (const code of selectedReps) {
      if (code !== NO_REP_FILTER_VALUE && !merged.has(code)) {
        merged.set(code, {
          rep: code,
          source: 'eclaim',
          tag: 'REP',
          prefix: null,
          fund: null,
          visitCount: 0,
          compensated: 0,
        })
      }
    }
    return Array.from(merged.values()).sort(
      (a, b) => b.visitCount - a.visitCount || b.compensated - a.compensated || a.rep.localeCompare(b.rep)
    )
  }, [effectiveBreakdown.repItems, selectedReps])

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allRepItems
    return allRepItems.filter(
      (item) =>
        item.rep.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q) ||
        (item.fund && item.fund.toLowerCase().includes(q))
    )
  }, [allRepItems, search])

  const eclaimReps = useMemo(
    () => allRepItems.filter((r) => r.source === 'eclaim').map((r) => r.rep),
    [allRepItems]
  )
  const seamlessReps = useMemo(
    () => allRepItems.filter((r) => r.source === 'seamless').map((r) => r.rep),
    [allRepItems]
  )

  const isAllSelected = selectedReps.length === 0

  const buttonLabel = useMemo(() => {
    if (isAllSelected) return placeholder
    if (selectedReps.length === 1) {
      if (selectedReps[0] === NO_REP_FILTER_VALUE) return 'ยังไม่มีเลข REP'
      return `REP: ${selectedReps[0]}`
    }
    return `เลือก ${selectedReps.length} เลข REP`
  }, [isAllSelected, selectedReps, placeholder])

  const toggleRep = useCallback(
    (repCode: string) => {
      if (selectedReps.includes(repCode)) {
        onChange(selectedReps.filter((c) => c !== repCode))
      } else {
        onChange([...selectedReps, repCode])
      }
    },
    [selectedReps, onChange]
  )

  const selectPreset = useCallback(
    (codes: string[]) => {
      onChange(Array.from(new Set(codes)))
    },
    [onChange]
  )

  const showNoRepOption = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return effectiveBreakdown.withoutRepCount > 0 || selectedReps.includes(NO_REP_FILTER_VALUE)
    return 'ยังไม่มีเลข rep ไม่มี rep'.includes(q)
  }, [search, effectiveBreakdown.withoutRepCount, selectedReps])

  return (
    <div
      ref={containerRef}
      className={`rcm-rep-select-wrapper ${className}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="ตัวกรองเลขที่ REP"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.45rem 0.85rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          backgroundColor: '#ffffff',
          border: isOpen ? '1px solid #0d7446' : '1px solid #e2e8e4',
          borderRadius: '8px',
          color: '#111e14',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          minWidth: '200px',
          maxWidth: '300px',
          minHeight: '44px',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(13, 116, 70, 0.12)' : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <ReceiptText
            size={15}
            style={{
              color: isAllSelected ? '#6b7b70' : '#0d7446',
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: isAllSelected ? '#334237' : '#095c38',
            }}
            title={buttonLabel}
          >
            {buttonLabel}
          </span>
        </div>
        <ChevronDown
          size={14}
          style={{
            color: '#64748b',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="เลือกเลขที่ REP"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align === 'right' ? 'right' : 'left']: 0,
            zIndex: 110,
            width: '410px',
            maxWidth: '92vw',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15), 0 4px 6px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header & Presets */}
          <div
            style={{
              padding: '0.75rem',
              borderBottom: '1px solid #e2e8e4',
              backgroundColor: '#f4f7f5',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111e14' }}>
                เลขที่ REP ในช่วงข้อมูล ({allRepItems.length} ใบ)
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: isAllSelected ? '#0d7446' : '#92400e',
                  backgroundColor: isAllSelected ? '#eaf6ef' : '#fef6e7',
                  border: isAllSelected ? '1px solid #bce2ce' : '1px solid #fcd34d',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                }}
              >
                {isAllSelected ? 'ทั้งหมด' : `เลือก ${selectedReps.length}`}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onChange([])}
                style={{
                  fontSize: '0.74rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  fontWeight: isAllSelected ? 600 : 500,
                  backgroundColor: isAllSelected ? '#0d7446' : '#ffffff',
                  color: isAllSelected ? '#ffffff' : '#334237',
                  border: isAllSelected ? '1px solid #0d7446' : '1px solid #e2e8e4',
                  cursor: 'pointer',
                }}
              >
                ทุกเลข REP
              </button>
              {eclaimReps.length > 0 && (
                <button
                  type="button"
                  onClick={() => selectPreset(eclaimReps)}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    fontWeight: 500,
                    backgroundColor: '#ffffff',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                    cursor: 'pointer',
                  }}
                >
                  e-Claim ({eclaimReps.length})
                </button>
              )}
              {seamlessReps.length > 0 && (
                <button
                  type="button"
                  onClick={() => selectPreset(seamlessReps)}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    fontWeight: 500,
                    backgroundColor: '#ffffff',
                    color: '#6b21a8',
                    border: '1px solid #e9d5ff',
                    cursor: 'pointer',
                  }}
                >
                  Seamless ({seamlessReps.length})
                </button>
              )}
              {effectiveBreakdown.withoutRepCount > 0 && (
                <button
                  type="button"
                  onClick={() => selectPreset([NO_REP_FILTER_VALUE])}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    fontWeight: selectedReps.includes(NO_REP_FILTER_VALUE) ? 600 : 500,
                    backgroundColor: selectedReps.includes(NO_REP_FILTER_VALUE) ? '#fef3c7' : '#ffffff',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    cursor: 'pointer',
                  }}
                >
                  ยังไม่มี REP ({effectiveBreakdown.withoutRepCount})
                </button>
              )}
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    fontWeight: 500,
                    backgroundColor: '#ffffff',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                  }}
                >
                  <X size={12} aria-hidden="true" /> ล้างค่า
                </button>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#ffffff',
            }}
          >
            <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลข REP หรือชื่อกองทุน..."
              aria-label="ค้นหาเลข REP หรือชื่อกองทุน"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '0.8rem',
                color: '#0f172a',
                backgroundColor: 'transparent',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา REP"
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Checkbox Options List */}
          <div
            role="listbox"
            aria-multiselectable="true"
            style={{
              maxHeight: '280px',
              overflowY: 'auto',
              padding: '0.35rem',
            }}
          >
            {showNoRepOption && (
              <label
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '6px',
                  backgroundColor: selectedReps.includes(NO_REP_FILTER_VALUE) ? '#fffbeb' : 'transparent',
                  color: '#78350f',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  marginBottom: '2px',
                  borderBottom: '1px dashed #e2e8f0',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedReps.includes(NO_REP_FILTER_VALUE)}
                    onChange={() => toggleRep(NO_REP_FILTER_VALUE)}
                    style={{ accentColor: '#d97706', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 600 }}>ยังไม่มีเลข REP</span>
                </span>
                <span style={{ fontSize: '0.72rem', color: '#92400e', fontVariantNumeric: 'tabular-nums' }}>
                  {effectiveBreakdown.withoutRepCount.toLocaleString('th-TH')} ครั้ง
                </span>
              </label>
            )}

            {filteredItems.length === 0 && !showNoRepOption ? (
              <div
                style={{
                  padding: '1.25rem 0.75rem',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                }}
              >
                ไม่พบเลขที่ REP ที่ค้นหา
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedReps.includes(item.rep)
                const isSeamless = item.source === 'seamless'
                return (
                  <label
                    key={`${item.source}-${item.rep}`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.45rem 0.5rem',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? '#ecfdf5' : 'transparent',
                      color: isSelected ? '#065f46' : '#1e293b',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRep(item.rep)}
                        aria-label={`เลือก REP ${item.rep}`}
                        style={{
                          position: 'absolute',
                          opacity: 0,
                          width: 1,
                          height: 1,
                          pointerEvents: 'none',
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          border: isSelected ? '1.5px solid #059669' : '1px solid #cbd5e1',
                          backgroundColor: isSelected ? '#059669' : '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span className="font-mono" style={{ fontWeight: 600 }}>
                            {item.rep}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: isSeamless ? '#f3e8ff' : '#e0f2fe',
                              color: isSeamless ? '#6b21a8' : '#0369a1',
                              border: isSeamless ? '1px solid #e9d5ff' : '1px solid #bae6fd',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isSeamless ? `Seamless${item.prefix ? ` · ${item.prefix}` : ''}` : 'e-Claim'}
                          </span>
                        </div>
                        {item.fund && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '215px',
                            }}
                            title={item.fund}
                          >
                            {item.fund}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        flexShrink: 0,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                        {item.visitCount.toLocaleString('th-TH')} ครั้ง
                      </span>
                      {item.compensated > 0 && (
                        <span style={{ fontSize: '0.69rem', color: isSeamless ? '#6b21a8' : '#047857' }}>
                          {formatMoneyCompact(item.compensated)} ฿
                        </span>
                      )}
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function RcmRepActiveBadge({
  selectedReps,
  onClear,
}: {
  selectedReps: string[]
  onClear: () => void
}) {
  if (!selectedReps || selectedReps.length === 0) return null
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: '#f3e8ff',
        color: '#6b21a8',
        border: '1px solid #e9d5ff',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: '0.8rem',
        fontWeight: 600,
      }}
    >
      <span>
        REP:{' '}
        {selectedReps.length === 1
          ? selectedReps[0] === NO_REP_FILTER_VALUE
            ? 'ยังไม่มีเลข REP'
            : selectedReps[0]
          : `${selectedReps.length} เลข REP`}
      </span>
      <button
        type="button"
        onClick={onClear}
        style={{
          border: 'none',
          background: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
        }}
        title="ล้างตัวกรองเลข REP"
        aria-label="ล้างตัวกรองเลข REP"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  )
}

export default RepMultiSelect
