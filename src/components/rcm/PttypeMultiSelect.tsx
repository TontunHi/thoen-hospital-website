'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Filter, ChevronDown, Check, X, Search } from 'lucide-react'
import {
  HOSPITAL_PTTYPE_OPTIONS,
  PttypeOption,
  UC_ECLAIM_CODES,
} from '@/lib/clinical/pttypeConstants'

export interface PttypeMultiSelectProps {
  /**
   * List of selected rights (e.g. ['ประกันสุขภาพถ้วนหน้า', 'ชำระเงินเอง']).
   * An empty array represents "ทุกสิทธิการรักษา (All Rights)".
   */
  selectedCodes: string[]
  /**
   * Callback invoked when selection changes.
   */
  onChange: (codes: string[]) => void
  /**
   * Optional custom options list. Defaults to discovery from items or HOSPITAL_PTTYPE_OPTIONS.
   */
  options?: readonly (PttypeOption | string)[]
  /**
   * Optional list of records or data items to automatically discover available สิทธิการรักษา in this report.
   */
  items?: readonly any[]
  /**
   * Placeholder / trigger label text. Default: 'ทุกสิทธิการรักษา'
   */
  placeholder?: string
  /**
   * Optional disabled state.
   */
  disabled?: boolean
  /**
   * Additional custom CSS class name for the wrapper.
   */
  className?: string
  /**
   * Alignment for dropdown panel: 'left' | 'right'. Default: 'left'.
   */
  align?: 'left' | 'right'
}

export function PttypeMultiSelect({
  selectedCodes = [],
  onChange,
  options,
  items,
  placeholder = 'ทุกสิทธิการรักษา',
  disabled = false,
  className = '',
  align = 'left',
}: PttypeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Track all unique pttypenames ever discovered in this session to prevent options from vanishing when filtered
  const discoveredRightsRef = useRef<Set<string>>(new Set())

  // Synchronously discover rights from items prop
  if (items && Array.isArray(items)) {
    items.forEach((item) => {
      if (item) {
        const name =
          item.pttypename ||
          item.pttypename_visit ||
          item.pttypenameVisit ||
          item.pttypename_patient ||
          item.pttypenamePatient
        if (name && typeof name === 'string' && name.trim()) {
          discoveredRightsRef.current.add(name.trim())
        }
      }
    })
  }
  if (Array.isArray(selectedCodes)) {
    selectedCodes.forEach((code) => {
      if (code && typeof code === 'string' && code.trim()) {
        discoveredRightsRef.current.add(code.trim())
      }
    })
  }

  // Resolve normalized options list
  const effectiveOptions: PttypeOption[] = useMemo(() => {
    if (options && options.length > 0) {
      return options.map((opt) => {
        if (typeof opt === 'string') {
          return { code: opt.trim(), name: opt.trim() }
        }
        return opt
      })
    }

    if (discoveredRightsRef.current.size > 0) {
      return Array.from(discoveredRightsRef.current)
        .sort((a, b) => a.localeCompare(b, 'th'))
        .map((name) => ({ code: name, name }))
    }

    // Default to hospital master options
    return HOSPITAL_PTTYPE_OPTIONS as PttypeOption[]
  }, [options, items, selectedCodes])

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return effectiveOptions
    return effectiveOptions.filter(
      (opt) => opt.code.toLowerCase().includes(q) || opt.name.toLowerCase().includes(q)
    )
  }, [effectiveOptions, search])

  // Helper to determine if an option belongs to Universal Coverage (UC / บัตรทอง)
  const isUcOption = useCallback((opt: PttypeOption) => {
    const n = opt.name.toLowerCase()
    return (
      n.includes('บัตรทอง') ||
      n.includes('ประกันสุขภาพถ้วนหน้า') ||
      n.includes('uc') ||
      n.includes('30 บาท') ||
      n.includes('ท.01') ||
      n.includes('ท.02') ||
      n.includes('ท.03')
    )
  }, [])

  // Universal Coverage options in the current effective list
  const ucOptions = useMemo(() => {
    return effectiveOptions.filter(isUcOption)
  }, [effectiveOptions, isUcOption])

  // Check if exactly all UC codes are selected
  const isUcPresetActive = useMemo(() => {
    if (selectedCodes.length === 0) return false
    return (
      (selectedCodes.length === UC_ECLAIM_CODES.length &&
        UC_ECLAIM_CODES.every((c) => selectedCodes.includes(c))) ||
      (ucOptions.length > 0 &&
        selectedCodes.length === ucOptions.length &&
        ucOptions.every((o) => selectedCodes.includes(o.code)))
    )
  }, [selectedCodes, ucOptions])

  const isAllSelected = selectedCodes.length === 0

  // Label to show on the dropdown trigger button
  const buttonLabel = useMemo(() => {
    if (isAllSelected) {
      return placeholder
    }
    if (isUcPresetActive) {
      return 'สิทธิบัตรทอง (UC)'
    }
    if (selectedCodes.length === 1) {
      const match = effectiveOptions.find((o) => o.code === selectedCodes[0])
      return `สิทธิ: ${match ? match.name : selectedCodes[0]}`
    }
    return `เลือก ${selectedCodes.length} สิทธิการรักษา`
  }, [isAllSelected, isUcPresetActive, selectedCodes, effectiveOptions, placeholder])

  const toggleOption = useCallback(
    (code: string) => {
      if (isAllSelected) {
        onChange([code])
        return
      }

      if (selectedCodes.includes(code)) {
        const next = selectedCodes.filter((c) => c !== code)
        onChange(next)
      } else {
        onChange([...selectedCodes, code])
      }
    },
    [isAllSelected, selectedCodes, onChange]
  )

  const handleSelectAll = useCallback(() => {
    onChange([])
  }, [onChange])

  const handleSelectUcOnly = useCallback(() => {
    onChange([...UC_ECLAIM_CODES])
  }, [onChange])

  const handleClear = useCallback(() => {
    onChange([])
  }, [onChange])

  return (
    <div
      ref={containerRef}
      className={`rcm-pttype-select-wrapper ${className}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="เลือกสิทธิการรักษา"
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
          minWidth: '220px',
          maxWidth: '340px',
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
          <Filter
            size={15}
            style={{
              color: isAllSelected ? '#6b7b70' : '#0d7446',
              flexShrink: 0,
            }}
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
            {isAllSelected && <span style={{ display: 'none' }}>✓ {placeholder}</span>}
            {isUcPresetActive && <span style={{ display: 'none' }}>🏥 เฉพาะสิทธิบัตรทอง (UC)</span>}
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
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="ตัวกรองสิทธิการรักษา"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align === 'right' ? 'right' : 'left']: 0,
            zIndex: 100,
            width: '380px',
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
          {/* Header & Quick Presets */}
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
                สิทธิการรักษา ({effectiveOptions.length} สิทธิ)
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
                {isAllSelected ? 'ทั้งหมด' : `เลือก ${selectedCodes.length}`}
              </span>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  fontWeight: isAllSelected ? 600 : 500,
                  backgroundColor: isAllSelected ? '#0d7446' : '#ffffff',
                  color: isAllSelected ? '#ffffff' : '#334237',
                  border: isAllSelected ? '1px solid #0d7446' : '1px solid #e2e8e4',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease, border-color 150ms ease',
                }}
              >
                <span>ทุกสิทธิ</span>
                <span style={{ display: 'none' }}>✓ ทุกสิทธิ</span>
              </button>
              <button
                type="button"
                onClick={handleSelectUcOnly}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  fontWeight: isUcPresetActive ? 600 : 500,
                  backgroundColor: isUcPresetActive ? '#0d7446' : '#ffffff',
                  color: isUcPresetActive ? '#ffffff' : '#334237',
                  border: isUcPresetActive ? '1px solid #0d7446' : '1px solid #e2e8e4',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease, border-color 150ms ease',
                }}
              >
                <span>สิทธิบัตรทอง (UC)</span>
                <span style={{ display: 'none' }}>🏥 สิทธิบัตรทอง (UC)</span>
                <span style={{ display: 'none' }}>🏥 เฉพาะ UC (01-09)</span>
              </button>
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    fontSize: '0.75rem',
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
                  <X size={12} /> ล้างค่า
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
            <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาสิทธิการรักษา..."
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
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            role="listbox"
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '0.25rem',
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '1.25rem 0.75rem',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                }}
              >
                ไม่พบสิทธิการรักษาที่ค้นหา
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedCodes.includes(opt.code)
                return (
                  <button
                    key={opt.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleOption(opt.code)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.5rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: isSelected ? '#ecfdf5' : 'transparent',
                      color: isSelected ? '#065f46' : '#1e293b',
                      fontSize: '0.8rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#f8fafc'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: isSelected ? '1.5px solid #059669' : '1px solid #cbd5e1',
                        backgroundColor: isSelected ? '#059669' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                    </div>
                    <span
                      style={{
                        flexGrow: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                      title={opt.name}
                    >
                      {opt.name}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PttypeMultiSelect
