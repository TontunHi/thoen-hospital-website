'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Search, Tag, X, ChevronDown, Check, Plus } from 'lucide-react'
import type { AdpOption } from '@/lib/clinical/rcmAdpSearchService'

export interface AdpMultiSelectProps {
  options: AdpOption[]
  selectedCodes: string[]
  onChange: (codes: string[]) => void
  onSearchSubmit?: () => void
  disabled?: boolean
}

export default function AdpMultiSelect({
  options,
  selectedCodes,
  onChange,
  onSearchSubmit,
  disabled = false,
}: AdpMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด')

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Map options by code for quick title lookup
  const optionMap = useMemo(() => {
    const map = new Map<string, AdpOption>()
    for (const opt of options) {
      map.set(opt.code, opt)
    }
    return map
  }, [options])

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const opt of options) {
      if (opt.category) set.add(opt.category)
    }
    return ['ทั้งหมด', ...Array.from(set)]
  }, [options])

  // Filtered options based on category and search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return options.filter((opt) => {
      const matchCategory =
        selectedCategory === 'ทั้งหมด' || opt.category === selectedCategory
      if (!matchCategory) return false

      if (!q) return true
      return (
        opt.code.toLowerCase().includes(q) ||
        opt.title.toLowerCase().includes(q) ||
        opt.category.toLowerCase().includes(q)
      )
    })
  }, [options, selectedCategory, searchQuery])

  // Check if current search query is a custom code not yet selected
  const cleanedSearch = searchQuery.trim().replace(/['"`]/g, '')
  const canAddCustomCode =
    Boolean(cleanedSearch) && !selectedCodes.includes(cleanedSearch)

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      // Auto-focus search input on open
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Toggle selection of a single code
  const toggleCode = useCallback(
    (code: string) => {
      if (disabled) return
      const clean = code.trim()
      if (!clean) return

      if (selectedCodes.includes(clean)) {
        onChange(selectedCodes.filter((c) => c !== clean))
      } else {
        onChange([...selectedCodes, clean])
      }
    },
    [disabled, selectedCodes, onChange]
  )

  // Remove a code
  const removeCode = useCallback(
    (code: string) => {
      if (disabled) return
      onChange(selectedCodes.filter((c) => c !== code))
    },
    [disabled, selectedCodes, onChange]
  )

  // Add custom code
  const handleAddCustomCode = useCallback(() => {
    if (!canAddCustomCode) return
    onChange([...selectedCodes, cleanedSearch])
    setSearchQuery('')
  }, [canAddCustomCode, cleanedSearch, selectedCodes, onChange])

  // Keydown in search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // If exact single result in filteredOptions, toggle it
      if (filteredOptions.length === 1) {
        toggleCode(filteredOptions[0].code)
        setSearchQuery('')
      } else if (canAddCustomCode) {
        handleAddCustomCode()
      } else if (onSearchSubmit) {
        setIsOpen(false)
        onSearchSubmit()
      }
    }
  }

  // Select all visible filtered options
  const handleSelectAllFiltered = () => {
    const newCodes = new Set(selectedCodes)
    for (const opt of filteredOptions) {
      newCodes.add(opt.code)
    }
    onChange(Array.from(newCodes))
  }

  // Deselect all
  const handleClearAll = () => {
    onChange([])
  }

  // Handle footer apply / submit
  const handleApplyAndSearch = () => {
    setIsOpen(false)
    if (onSearchSubmit) {
      onSearchSubmit()
    }
  }

  return (
    <div
      ref={containerRef}
      className={`adp-ms-container ${disabled ? 'disabled' : ''} ${isOpen ? 'is-open' : ''}`}
    >
      {/* ── Trigger Box ── */}
      <div
        className="adp-ms-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="เลือกหรือค้นหารหัส ADP"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!disabled) setIsOpen((prev) => !prev)
          }
        }}
      >
        <div className="adp-ms-trigger-left">
          <Tag size={18} className="adp-ms-icon" />

          <div className="adp-ms-tags-area">
            {selectedCodes.length === 0 ? (
              <span className="adp-ms-placeholder">
                เลือกรหัส ADP (สามารถเลือกได้หลายรหัส)...
              </span>
            ) : (
              selectedCodes.map((code) => {
                const opt = optionMap.get(code)
                const label = opt ? opt.title : null
                return (
                  <span key={code} className="adp-ms-chip" title={label || code}>
                    <span className="adp-ms-chip-code">{code}</span>
                    {label && (
                      <span className="adp-ms-chip-text">
                        {label.length > 25 ? `${label.substring(0, 25)}...` : label}
                      </span>
                    )}
                    <button
                      type="button"
                      className="adp-ms-chip-remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCode(code)
                      }}
                      aria-label={`ลบรหัส ${code}`}
                      title={`ลบรหัส ${code}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )
              })
            )}
          </div>
        </div>

        <div className="adp-ms-trigger-right">
          {selectedCodes.length > 0 && (
            <>
              <span className="adp-ms-count-badge">
                {selectedCodes.length} รหัส
              </span>
              <button
                type="button"
                className="adp-ms-clear-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearAll()
                }}
                title="ล้างรหัสที่เลือกทั้งหมด"
                aria-label="ล้างรหัสที่เลือกทั้งหมด"
              >
                <X size={14} />
              </button>
            </>
          )}
          <ChevronDown
            size={18}
            className={`adp-ms-chevron ${isOpen ? 'open' : ''}`}
          />
        </div>
      </div>

      {/* ── Dropdown Popover ── */}
      {isOpen && (
        <div className="adp-ms-dropdown" role="listbox" aria-multiselectable="true">
          {/* Search Box inside dropdown */}
          <div className="adp-ms-search-row">
            <Search size={16} className="adp-ms-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="adp-ms-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="พิมพ์เพื่อค้นหารหัส หรือชื่อรายการ..."
              aria-label="ค้นหารหัส ADP"
            />
            {searchQuery && (
              <button
                type="button"
                className="adp-ms-search-clear"
                onClick={() => setSearchQuery('')}
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Add Custom Code Suggestion */}
          {canAddCustomCode && (
            <div className="adp-ms-custom-add-banner">
              <span>ไม่พบในตัวเลือกหลัก หรือต้องการเพิ่มรหัสพิเศษ:</span>
              <button
                type="button"
                className="adp-ms-add-custom-btn"
                onClick={handleAddCustomCode}
              >
                <Plus size={14} />
                <span>เพิ่มรหัส <strong>{cleanedSearch}</strong> (ระบุเอง)</span>
              </button>
            </div>
          )}

          {/* Category Filter Pills */}
          <div className="adp-ms-category-tabs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`adp-ms-category-tab ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Quick Select Actions */}
          <div className="adp-ms-quick-actions">
            <span className="adp-ms-quick-hint">
              พบ {filteredOptions.length} รายการ
            </span>
            <div className="adp-ms-quick-btns">
              {filteredOptions.length > 0 && (
                <button
                  type="button"
                  className="adp-ms-quick-btn"
                  onClick={handleSelectAllFiltered}
                >
                  เลือกทั้งหมดในกลุ่มนี้
                </button>
              )}
              {selectedCodes.length > 0 && (
                <button
                  type="button"
                  className="adp-ms-quick-btn text-danger"
                  onClick={handleClearAll}
                >
                  ล้างค่าที่เลือก
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="adp-ms-options-list">
            {filteredOptions.length === 0 ? (
              <div className="adp-ms-empty">
                <span>ไม่พบรหัส ADP ที่ตรงกับคำค้นหา</span>
                {canAddCustomCode && (
                  <button
                    type="button"
                    className="adp-ms-empty-add-btn"
                    onClick={handleAddCustomCode}
                  >
                    <Plus size={14} />
                    <span>ใช้รหัส &quot;{cleanedSearch}&quot;</span>
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedCodes.includes(opt.code)
                return (
                  <div
                    key={opt.code}
                    className={`adp-ms-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleCode(opt.code)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="adp-ms-option-checkbox">
                      {isSelected ? (
                        <div className="adp-ms-check-icon checked">
                          <Check size={13} strokeWidth={2.5} />
                        </div>
                      ) : (
                        <div className="adp-ms-check-icon unchecked" />
                      )}
                    </div>

                    <div className="adp-ms-option-body">
                      <div className="adp-ms-option-title-row">
                        <span className="adp-ms-option-code">{opt.code}</span>
                        <span className="adp-ms-option-title">{opt.title}</span>
                      </div>
                      <div className="adp-ms-option-meta">
                        <span className="adp-ms-option-category">
                          {opt.category}
                        </span>
                        {typeof opt.mappedCount === 'number' && opt.mappedCount > 0 && (
                          <span className="adp-ms-option-mapped">
                            Map: {opt.mappedCount} รายการ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="adp-ms-footer">
            <div className="adp-ms-footer-info">
              <span>
                เลือกแล้ว <strong>{selectedCodes.length}</strong> รหัส
              </span>
            </div>
            <div className="adp-ms-footer-actions">
              <button
                type="button"
                className="adp-btn adp-btn-secondary adp-btn-sm"
                onClick={() => setIsOpen(false)}
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                className="adp-btn adp-btn-primary adp-btn-sm"
                onClick={handleApplyAndSearch}
              >
                <Search size={14} />
                <span>ค้นหาทันที</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
