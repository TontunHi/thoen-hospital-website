'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Layers, ChevronDown, Check, X, Search } from 'lucide-react'
import type { InstrumentOptionItem } from '@/lib/clinical/rcmInstrumentFundService'

export interface InstrumentSelectProps {
  value: string
  onChange: (value: string) => void
  items?: InstrumentOptionItem[]
  disabled?: boolean
  className?: string
}

export function InstrumentSelect({
  value = '',
  onChange,
  items = [],
  disabled = false,
  className = '',
}: InstrumentSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'OA' | 'DM' | 'OTHER'>('ALL')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Currently selected item details
  const selectedItem = useMemo(() => {
    if (!value) return null
    return (
      items.find(
        (it) => it.code.toLowerCase() === value.toLowerCase() || it.name.toLowerCase() === value.toLowerCase()
      ) || null
    )
  }, [value, items])

  // Filter items by active category tab and search text
  const filteredItems = useMemo(() => {
    let result = items

    // Filter by category
    if (selectedCategory !== 'ALL') {
      result = result.filter((it) => it.category === selectedCategory)
    }

    // Filter by search query
    const query = search.trim().toLowerCase()
    if (query) {
      result = result.filter(
        (it) => it.code.toLowerCase().includes(query) || it.name.toLowerCase().includes(query)
      )
    }

    return result
  }, [items, selectedCategory, search])

  // Count by category for tab badges
  const categoryCounts = useMemo(() => {
    let oa = 0
    let dm = 0
    let other = 0
    for (const it of items) {
      if (it.category === 'OA') oa++
      else if (it.category === 'DM') dm++
      else other++
    }
    return { all: items.length, oa, dm, other }
  }, [items])

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    onChange('')
    setSearch('')
  }

  return (
    <div
      ref={containerRef}
      className={`inst-select-container ${className}`}
      style={{ position: 'relative', display: 'inline-block', minWidth: '240px', maxWidth: '380px', flex: 1 }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        data-testid="instrument-select-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="ตัวกรองรายการอวัยวะเทียมและอุปกรณ์"
        className={`inst-select-trigger ${isOpen ? 'open' : ''} ${value ? 'has-value' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          height: '40px',
          padding: '0 12px',
          fontSize: '13px',
          fontFamily: 'inherit',
          backgroundColor: '#ffffff',
          border: isOpen ? '1px solid #0d7446' : '1px solid #cbd5e1',
          borderRadius: '8px',
          color: '#0f172a',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(13, 116, 70, 0.12)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Layers size={15} style={{ color: value ? '#0d7446' : '#64748b', flexShrink: 0 }} />
          {selectedItem ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedItem.code !== '-' && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: selectedItem.category === 'OA' ? '#ecfdf5' : selectedItem.category === 'DM' ? '#fffbeb' : '#f1f5f9',
                    color: selectedItem.category === 'OA' ? '#065f46' : selectedItem.category === 'DM' ? '#92400e' : '#334155',
                    border: `1px solid ${selectedItem.category === 'OA' ? '#a7f3d0' : selectedItem.category === 'DM' ? '#fde68a' : '#cbd5e1'}`,
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {selectedItem.code}
                </span>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#111e14' }}>
                {selectedItem.name}
              </span>
            </div>
          ) : (
            <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              อุปกรณ์ทั้งหมด {items.length > 0 ? `(${items.length} ชนิด)` : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  handleClear()
                }
              }}
              title="ล้างตัวกรองอุปกรณ์"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown
            size={14}
            style={{
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </div>
      </button>

      {/* Floating Modern Dropdown Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="เมนูเลือกรายการอวัยวะเทียมและอุปกรณ์"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 100,
            width: '430px',
            maxWidth: '92vw',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12), 0 4px 6px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                เลือกรายการอวัยวะเทียมและอุปกรณ์
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: value ? '#065f46' : '#475569',
                  backgroundColor: value ? '#ecfdf5' : '#f1f5f9',
                  border: `1px solid ${value ? '#a7f3d0' : '#e2e8f0'}`,
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {value ? 'เลือกอยู่ 1 ชนิด' : `ทั้งหมด ${items.length} ชนิด`}
              </span>
            </div>

            {/* Quick Category Chips */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                style={{
                  fontSize: '12px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontWeight: selectedCategory === 'ALL' ? 600 : 400,
                  backgroundColor: selectedCategory === 'ALL' ? '#0d7446' : '#ffffff',
                  color: selectedCategory === 'ALL' ? '#ffffff' : '#334155',
                  border: selectedCategory === 'ALL' ? '1px solid #0d7446' : '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                ทั้งหมด ({categoryCounts.all})
              </button>
              {categoryCounts.oa > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('OA')}
                  style={{
                    fontSize: '12px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: selectedCategory === 'OA' ? 600 : 400,
                    backgroundColor: selectedCategory === 'OA' ? '#0d7446' : '#ffffff',
                    color: selectedCategory === 'OA' ? '#ffffff' : '#065f46',
                    border: selectedCategory === 'OA' ? '1px solid #0d7446' : '1px solid #a7f3d0',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  ผ่าข้อเข่า OA ({categoryCounts.oa})
                </button>
              )}
              {categoryCounts.dm > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('DM')}
                  style={{
                    fontSize: '12px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: selectedCategory === 'DM' ? 600 : 400,
                    backgroundColor: selectedCategory === 'DM' ? '#0d7446' : '#ffffff',
                    color: selectedCategory === 'DM' ? '#ffffff' : '#92400e',
                    border: selectedCategory === 'DM' ? '1px solid #0d7446' : '1px solid #fde68a',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  อุปกรณ์เบาหวาน DM ({categoryCounts.dm})
                </button>
              )}
              {categoryCounts.other > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('OTHER')}
                  style={{
                    fontSize: '12px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: selectedCategory === 'OTHER' ? 600 : 400,
                    backgroundColor: selectedCategory === 'OTHER' ? '#0d7446' : '#ffffff',
                    color: selectedCategory === 'OTHER' ? '#ffffff' : '#334155',
                    border: selectedCategory === 'OTHER' ? '1px solid #0d7446' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  ทั่วไป ({categoryCounts.other})
                </button>
              )}
            </div>
          </div>

          {/* Search Box inside Panel */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
            }}
          >
            <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหารหัส ADP หรือชื่ออุปกรณ์..."
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                fontFamily: 'inherit',
                color: '#0f172a',
                backgroundColor: 'transparent',
              }}
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Option List (Sorted numerically by ADP Code) */}
          <div
            style={{
              maxHeight: '290px',
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {/* Default "All" Option */}
            <div
              role="button"
              tabIndex={0}
              data-testid="instrument-option-all"
              onClick={() => handleSelect('')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSelect('')
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: !value ? '#f0fdf4' : 'transparent',
                color: !value ? '#065f46' : '#1e293b',
                fontWeight: !value ? 600 : 400,
                borderBottom: '1px solid #f8fafc',
                transition: 'background-color 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (value) e.currentTarget.style.backgroundColor = '#f8fafc'
              }}
              onMouseLeave={(e) => {
                if (value) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  ทั้งหมด
                </span>
                <span>ทุกรายการอุปกรณ์ (แสดงทั้งหมด)</span>
              </div>
              {!value && <Check size={15} color="#0d7446" />}
            </div>

            {/* Filtered Item Rows */}
            {filteredItems.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                <p style={{ margin: 0 }}>ไม่พบรายการอุปกรณ์ตามคำค้นหา</p>
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      marginTop: '8px',
                      background: 'none',
                      border: 'none',
                      color: '#0d7446',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    ล้างคำค้นหา
                  </button>
                )}
              </div>
            ) : (
              filteredItems.map((inst) => {
                const isSelected =
                  value.toLowerCase() === inst.code.toLowerCase() ||
                  value.toLowerCase() === inst.name.toLowerCase()

                let badgeBg = '#f1f5f9'
                let badgeColor = '#334155'
                let badgeBorder = '#cbd5e1'

                if (inst.category === 'OA') {
                  badgeBg = '#ecfdf5'
                  badgeColor = '#065f46'
                  badgeBorder = '#a7f3d0'
                } else if (inst.category === 'DM') {
                  badgeBg = '#fffbeb'
                  badgeColor = '#92400e'
                  badgeBorder = '#fde68a'
                }

                const itemVal = inst.code !== '-' ? inst.code : inst.name

                return (
                  <div
                    key={inst.id}
                    data-testid={`instrument-option-${inst.code !== '-' ? inst.code : inst.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelect(itemVal)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSelect(itemVal)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#f0fdf4' : 'transparent',
                      borderBottom: '1px solid #f8fafc',
                      transition: 'background-color 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                          minWidth: inst.code !== '-' ? '42px' : 'auto',
                          textAlign: 'center',
                        }}
                      >
                        {inst.code !== '-' ? inst.code : 'ไม่มีรหัส'}
                      </span>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? '#065f46' : '#111e14',
                        }}
                        title={inst.name}
                      >
                        {inst.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {inst.count} เคส
                      </span>
                      {isSelected && <Check size={15} color="#0d7446" />}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Panel Footer */}
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            <span>
              แสดง {filteredItems.length} จาก {items.length} รายการ
            </span>
            {value && (
              <button
                type="button"
                onClick={() => handleClear()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <X size={12} /> ล้างการเลือก
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
