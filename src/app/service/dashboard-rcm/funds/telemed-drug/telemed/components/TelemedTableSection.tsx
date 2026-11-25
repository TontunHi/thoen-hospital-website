'use client'

import React from 'react'
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Columns,
} from 'lucide-react'
import type { TelemedItem, TelemedSortField } from '@/lib/clinical/rcmTelemedDrugService'
import { formatThaiDate } from '@/lib/formatters'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
import { RcmSeamlessSubAmount, RcmSeamlessRepBadges } from '@/components/rcm/RcmSeamlessRepDisplay'
import RepMultiSelect, { RcmRepActiveBadge } from '@/components/rcm/RepMultiSelect'
import type { RepBreakdownSummary } from '@/lib/clinical/rcmRepTagHelper'
import {
  formatMoney,
  maskCid,
  cleanStatusName,
  type CompensationCard,
  type ClaimCard,
  type ActiveCardsState,
} from './telemedHelpers'

export interface TelemedVisibleColumns {
  vstdate: boolean
  ptname: boolean
  vn: boolean
  pttype: boolean
  pdx: boolean
  fee: boolean
  claimCode: boolean
  compensated: boolean
  status: boolean
  cid: boolean
  ovstist: boolean
  no: boolean
}

export interface TelemedTableSectionProps {
  items: TelemedItem[]
  totalCount: number
  totalSumPrice: number
  loading: boolean
  isRefreshing: boolean
  error: string | null
  density: 'comfortable' | 'compact'
  visibleColumns: TelemedVisibleColumns
  isColumnDropdownOpen: boolean
  columnDropdownRef: React.RefObject<HTMLDivElement | null>
  filterPopoverRef: React.RefObject<HTMLDivElement | null>
  isFilterPopoverOpen: boolean
  search: string
  debouncedSearch: string
  selectedReps: string[]
  effectiveRepBreakdown: RepBreakdownSummary
  pttypes: string[]
  filterSex: string
  filterOvstist5: boolean
  filterAgeMin: string
  filterAgeMax: string
  filterPdx: string
  activePopoverFilterCount: number
  hasActiveFilters: boolean
  activeCards: ActiveCardsState
  sortBy: TelemedSortField
  sortOrder: 'asc' | 'desc'
  currentPage: number
  pageSize: number
  totalPages: number
  jumpPageInput: string
  selectedItemIndex: number | null
  unmaskedCids: Record<string, boolean>
  onDensityChange: (d: 'comfortable' | 'compact') => void
  onToggleColumnDropdown: () => void
  onToggleColumn: (col: keyof TelemedVisibleColumns) => void
  onSearchChange: (val: string) => void
  onSelectedRepsChange: (reps: string[]) => void
  onToggleFilterPopover: () => void
  onCloseFilterPopover: () => void
  onPttypesChange: (codes: string[]) => void
  onFilterSexChange: (sex: string) => void
  onFilterOvstist5Change: (checked: boolean) => void
  onFilterAgeMinChange: (val: string) => void
  onFilterAgeMaxChange: (val: string) => void
  onFilterPdxChange: (val: string) => void
  onClearPopoverFilters: () => void
  onClearAllFilters: () => void
  onToggleCompensationCard: (type?: CompensationCard) => void
  onToggleClaimCard: (type: ClaimCard) => void
  onToggleFeeCard: () => void
  onToggleUcCard: () => void
  onToggleType5Card: () => void
  onRetry: () => void
  onSort: (field: TelemedSortField) => void
  onRowClick: (idx: number) => void
  onUnmaskCid: (vn: string, hn: string, cid: string) => void
  onPageSizeChange: (size: number) => void
  onPageChange: React.Dispatch<React.SetStateAction<number>>
  onJumpPageInputChange: (val: string) => void
  onJumpPageSubmit: (e: React.FormEvent) => void
}

export function TelemedTableSection(props: TelemedTableSectionProps) {
  const {
    items,
    totalCount,
    totalSumPrice,
    loading,
    isRefreshing,
    error,
    density,
    visibleColumns,
    isColumnDropdownOpen,
    columnDropdownRef,
    filterPopoverRef,
    isFilterPopoverOpen,
    search,
    debouncedSearch,
    selectedReps,
    effectiveRepBreakdown,
    pttypes,
    filterSex,
    filterOvstist5,
    filterAgeMin,
    filterAgeMax,
    filterPdx,
    activePopoverFilterCount,
    hasActiveFilters,
    activeCards,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
    totalPages,
    jumpPageInput,
    selectedItemIndex,
    unmaskedCids,
  } = props

  const renderSortIcon = (field: TelemedSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.35, flexShrink: 0 }} />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={13} style={{ color: 'var(--brand)', flexShrink: 0 }} />
    ) : (
      <ArrowDown size={13} style={{ color: 'var(--brand)', flexShrink: 0 }} />
    )
  }

  return (
    <div className="telemed-data-section">
      {/* Section Header */}
      <div className="telemed-section-header">
        <div className="telemed-section-title-wrap">
          <h2 className="telemed-section-title">รายการผู้ได้รับบริการ</h2>
          <span className="telemed-item-count-badge" aria-live="polite">
            พบ {totalCount.toLocaleString('th-TH')} รายการ
          </span>
        </div>

        <div className="telemed-table-controls">
          <div className="telemed-density-toggle" role="group" aria-label="ความหนาแน่นตาราง">
            <button
              type="button"
              className={`telemed-density-btn ${density === 'comfortable' ? 'active' : ''}`}
              onClick={() => props.onDensityChange('comfortable')}
              title="ความหนาแน่นแถวแบบสบายตา (56px)"
            >
              สบายตา
            </button>
            <button
              type="button"
              className={`telemed-density-btn ${density === 'compact' ? 'active' : ''}`}
              onClick={() => props.onDensityChange('compact')}
              title="ความหนาแน่นแถวแบบกระชับ (40px)"
            >
              กระชับ
            </button>
          </div>

          <div className="telemed-popover-container" ref={columnDropdownRef}>
            <button
              type="button"
              className="telemed-btn"
              style={{ height: 32, padding: '0 10px', fontSize: '0.8125rem' }}
              onClick={props.onToggleColumnDropdown}
              aria-expanded={isColumnDropdownOpen}
              aria-label="เลือกคอลัมน์ที่จะแสดง"
            >
              <Columns size={14} />
              <span>คอลัมน์</span>
            </button>

            {isColumnDropdownOpen && (
              <div className="telemed-column-dropdown">
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)', paddingBottom: 4 }}>
                  คอลัมน์ที่แสดง
                </div>
                {(
                  [
                    ['vn', 'VN'],
                    ['cid', 'เลขบัตรประชาชน'],
                    ['ovstist', 'ประเภทการมา'],
                    ['no', 'ลำดับ'],
                    ['pttype', 'สิทธิการรักษา'],
                    ['pdx', 'PDX'],
                  ] as const
                ).map(([colKey, label]) => (
                  <label key={colKey} className="telemed-column-checkbox-item">
                    <input
                      type="checkbox"
                      checked={visibleColumns[colKey]}
                      onChange={() => props.onToggleColumn(colKey)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search & Popover Filters Row */}
      <div className="telemed-search-row">
        <div className="telemed-search-box">
          <Search size={16} className="telemed-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="telemed-search-input"
            placeholder="ค้นหา HN, เลขบัตรประชาชน, ชื่อ-สกุล, VN, PDX, สิทธิ"
            value={search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            aria-label="ค้นหารายการผู้รับบริการ"
          />
          {search && (
            <button
              type="button"
              className="telemed-search-clear"
              onClick={() => props.onSearchChange('')}
              title="ล้างคำค้นหา"
              aria-label="ล้างคำค้นหา"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <RepMultiSelect
          selectedReps={selectedReps}
          onChange={props.onSelectedRepsChange}
          repBreakdown={effectiveRepBreakdown}
          items={items}
        />
        <RcmRepActiveBadge
          selectedReps={selectedReps}
          onClear={() => props.onSelectedRepsChange([])}
        />

        <div className="telemed-popover-container" ref={filterPopoverRef}>
          <button
            type="button"
            className={`telemed-filter-btn ${activePopoverFilterCount > 0 ? 'active' : ''}`}
            onClick={props.onToggleFilterPopover}
            aria-expanded={isFilterPopoverOpen}
            aria-label="เปิดตัวกรองเพิ่มเติม"
          >
            <Filter size={15} />
            <span>ตัวกรองเพิ่มเติม</span>
            {activePopoverFilterCount > 0 && (
              <span className="telemed-filter-badge">{activePopoverFilterCount}</span>
            )}
          </button>

          {isFilterPopoverOpen && (
            <div className="telemed-popover-panel">
              <h3 className="telemed-popover-title">ตัวกรองเฉพาะหน้า</h3>

              <div className="telemed-popover-field">
                <label className="telemed-popover-label">สิทธิการรักษา</label>
                <PttypeMultiSelect
                  selectedCodes={pttypes}
                  onChange={props.onPttypesChange}
                  items={items}
                />
              </div>

              <div className="telemed-popover-field">
                <label className="telemed-popover-label">เพศ</label>
                <div className="telemed-segmented-group" style={{ width: '100%' }}>
                  {(
                    [
                      ['ALL', 'ทั้งหมด'],
                      ['M', 'ชาย'],
                      ['F', 'หญิง'],
                    ] as const
                  ).map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      className={`telemed-segment-btn ${filterSex === code ? 'active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => props.onFilterSexChange(code)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="telemed-popover-field">
                <label className="telemed-column-checkbox-item">
                  <input
                    type="checkbox"
                    checked={filterOvstist5}
                    onChange={(e) => props.onFilterOvstist5Change(e.target.checked)}
                  />
                  <span>เฉพาะประเภทมารหัส 5 (สาธารณสุขทางไกล)</span>
                </label>
              </div>

              <div className="telemed-popover-field">
                <label className="telemed-popover-label">ช่วงอายุ (ปี)</label>
                <div className="telemed-popover-row">
                  <input
                    type="number"
                    placeholder="จาก"
                    className="telemed-select"
                    style={{ flex: 1, height: 34 }}
                    value={filterAgeMin}
                    onChange={(e) => props.onFilterAgeMinChange(e.target.value)}
                  />
                  <span style={{ color: 'var(--muted)' }}>–</span>
                  <input
                    type="number"
                    placeholder="ถึง"
                    className="telemed-select"
                    style={{ flex: 1, height: 34 }}
                    value={filterAgeMax}
                    onChange={(e) => props.onFilterAgeMaxChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="telemed-popover-field">
                <label className="telemed-popover-label">วินิจฉัยโรคหลัก (PDX / ICD-10)</label>
                <input
                  type="text"
                  placeholder="เช่น I10, E119"
                  className="telemed-select"
                  style={{ height: 34 }}
                  value={filterPdx}
                  onChange={(e) => props.onFilterPdxChange(e.target.value)}
                />
              </div>

              <div className="telemed-popover-actions">
                <button
                  type="button"
                  className="telemed-btn"
                  style={{ height: 32, fontSize: '0.8125rem' }}
                  onClick={props.onClearPopoverFilters}
                >
                  ล้างตัวกรองเฉพาะ
                </button>
                <button
                  type="button"
                  className="telemed-btn telemed-btn-primary"
                  style={{ height: 32, fontSize: '0.8125rem' }}
                  onClick={props.onCloseFilterPopover}
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Chips Row */}
      {hasActiveFilters && (
        <div className="telemed-chips-row">
          {debouncedSearch && (
            <span className="telemed-chip">
              <span>ค้นหา: &ldquo;{debouncedSearch}&rdquo;</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={() => props.onSearchChange('')}
                aria-label="ล้างคำค้น"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {activeCards.compensation && (
            <span className="telemed-chip">
              <span>สถานะ: {activeCards.compensation === 'COMPENSATED' ? 'ชดเชยแล้ว' : 'รอชดเชย / ยังไม่ส่ง'}</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={() => props.onToggleCompensationCard(undefined)}
                aria-label="ลบตัวกรองสถานะ"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {activeCards.claim && (
            <span className="telemed-chip">
              <span>ClaimCode: {activeCards.claim === 'WITH_AUTHEN' ? 'มี ClaimCode' : 'ไม่มี ClaimCode'}</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={() => props.onToggleClaimCard(activeCards.claim!)}
                aria-label="ลบตัวกรอง ClaimCode"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {activeCards.hasFee && (
            <span className="telemed-chip">
              <span>มีค่าบริการ TelMed</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={props.onToggleFeeCard}
                aria-label="ลบตัวกรองค่าบริการ"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {activeCards.ucOnly && (
            <span className="telemed-chip">
              <span>สิทธิบัตรทอง (UC)</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={props.onToggleUcCard}
                aria-label="ลบตัวกรอง UC"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {activeCards.exportCode5 && (
            <span className="telemed-chip">
              <span>ประเภทมารหัส 5</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={props.onToggleType5Card}
                aria-label="ลบตัวกรองประเภทมารหัส 5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filterSex !== 'ALL' && (
            <span className="telemed-chip">
              <span>เพศ: {filterSex === 'M' ? 'ชาย' : 'หญิง'}</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={() => props.onFilterSexChange('ALL')}
                aria-label="ลบตัวกรองเพศ"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filterOvstist5 && (
            <span className="telemed-chip">
              <span>ประเภทมาสาธารณสุขทางไกล (รหัส 5)</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={() => props.onFilterOvstist5Change(false)}
                aria-label="ลบตัวกรองรหัส 5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {(filterAgeMin || filterAgeMax) && (
            <span className="telemed-chip">
              <span>อายุ: {filterAgeMin || '0'} – {filterAgeMax || '∞'} ปี</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={() => {
                  props.onFilterAgeMinChange('')
                  props.onFilterAgeMaxChange('')
                }}
                aria-label="ลบตัวกรองอายุ"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filterPdx && (
            <span className="telemed-chip">
              <span>PDX: {filterPdx}</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={() => props.onFilterPdxChange('')}
                aria-label="ลบตัวกรอง PDX"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {pttypes.length > 0 && (
            <span className="telemed-chip">
              <span>สิทธิ: {pttypes.join(', ')}</span>
              <button
                type="button"
                className="telemed-chip-remove"
                onClick={() => props.onPttypesChange([])}
                aria-label="ลบตัวกรองสิทธิ"
              >
                <X size={12} />
              </button>
            </span>
          )}

          <button
            type="button"
            className="telemed-clear-all-link"
            onClick={props.onClearAllFilters}
          >
            ล้างตัวกรอง
          </button>
        </div>
      )}

      {error && (
        <div className="telemed-alert-banner" role="alert">
          <div className="telemed-alert-message">
            <AlertTriangle size={18} />
            <span>โหลดข้อมูลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ ({error})</span>
          </div>
          <button type="button" className="telemed-alert-action-btn" onClick={props.onRetry}>
            ลองใหม่
          </button>
        </div>
      )}

      <div className="telemed-table-wrapper">
        <table className={`telemed-table density-${density}`}>
          <thead>
            <tr>
              {visibleColumns.no && (
                <th scope="col" className="cell-center" style={{ width: 50 }}>
                  ลำดับ
                </th>
              )}
              {visibleColumns.vstdate && (
                <th scope="col" className="col-sticky-1 cell-center" style={{ width: 140 }}>
                  <button
                    type="button"
                    className="telemed-th-btn"
                    onClick={() => props.onSort('vstdate')}
                    aria-sort={sortBy === 'vstdate' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span>วันที่รับบริการ</span>
                    {renderSortIcon('vstdate')}
                  </button>
                </th>
              )}
              {visibleColumns.ptname && (
                <th scope="col" className="col-sticky-2 cell-center" style={{ minWidth: 200 }}>
                  <button
                    type="button"
                    className="telemed-th-btn"
                    onClick={() => props.onSort('ptname')}
                    aria-sort={sortBy === 'ptname' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span>ผู้ป่วย</span>
                    {renderSortIcon('ptname')}
                  </button>
                </th>
              )}
              {visibleColumns.vn && (
                <th scope="col" className="cell-center" style={{ width: 130 }}>
                  VN
                </th>
              )}
              {visibleColumns.cid && (
                <th scope="col" className="cell-center" style={{ width: 160 }}>
                  เลขบัตรประชาชน
                </th>
              )}
              {visibleColumns.pttype && (
                <th scope="col" className="cell-center" style={{ minWidth: 160 }}>
                  สิทธิการรักษา
                </th>
              )}
              {visibleColumns.ovstist && (
                <th scope="col" className="cell-center" style={{ width: 130 }}>
                  ประเภทการมา
                </th>
              )}
              {visibleColumns.pdx && (
                <th scope="col" className="cell-center" style={{ width: 85 }}>
                  <button
                    type="button"
                    className="telemed-th-btn"
                    onClick={() => props.onSort('pdx')}
                    aria-sort={sortBy === 'pdx' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span>PDX</span>
                    {renderSortIcon('pdx')}
                  </button>
                </th>
              )}
              {visibleColumns.fee && (
                <th scope="col" className="cell-center" style={{ width: 110 }}>
                  <button
                    type="button"
                    className="telemed-th-btn"
                    onClick={() => props.onSort('sum_price')}
                    aria-sort={sortBy === 'sum_price' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span>ค่า TelMed</span>
                    {renderSortIcon('sum_price')}
                  </button>
                </th>
              )}
              {visibleColumns.claimCode && (
                <th scope="col" className="cell-center" style={{ width: 120 }}>
                  <button
                    type="button"
                    className="telemed-th-btn"
                    onClick={() => props.onSort('authencode')}
                    aria-sort={sortBy === 'authencode' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span>ClaimCode</span>
                    {renderSortIcon('authencode')}
                  </button>
                </th>
              )}
              {visibleColumns.compensated && (
                <th scope="col" className="cell-center" style={{ width: 110 }}>
                  <button
                    type="button"
                    className="telemed-th-btn"
                    onClick={() => props.onSort('compensated')}
                    aria-sort={sortBy === 'compensated' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span>ชดเชย (บ.)</span>
                    {renderSortIcon('compensated')}
                  </button>
                </th>
              )}
              {visibleColumns.status && (
                <th scope="col" className="col-sticky-right cell-center" style={{ width: 140 }}>
                  สถานะ / ใบตอบรับ
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading || isRefreshing ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="rcm-skeleton-row" aria-busy="true">
                  {Object.entries(visibleColumns)
                    .filter(([, visible]) => visible)
                    .map(([colKey]) => (
                      <td key={colKey} className="cell-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>
                      ไม่พบรายการตามตัวกรองนี้
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        className="telemed-btn"
                        style={{ height: 32, fontSize: '0.8125rem', marginTop: 4 }}
                        onClick={props.onClearAllFilters}
                      >
                        ล้างตัวกรอง
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const isSelected = selectedItemIndex === idx
                const unmasked = unmaskedCids[item.vn]
                const statusLabel = cleanStatusName(item.status, item.isCompensated)
                const pttypeCode = item.pttypename.split(':')[0] || ''
                const pttypeTitle = item.pttypename.split(':').slice(1).join(':').trim() || item.pttypename

                return (
                  <tr
                    key={item.vn}
                    className={isSelected ? 'row-selected' : ''}
                    onClick={() => props.onRowClick(idx)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') props.onRowClick(idx)
                    }}
                    title="คลิกเพื่อดูรายละเอียดใน Drawer ด้านขวา"
                  >
                    {visibleColumns.no && (
                      <td className="cell-center" style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                        {item.no}
                      </td>
                    )}
                    {visibleColumns.vstdate && (
                      <td className="col-sticky-1 cell-center">
                        <div style={{ fontWeight: 500 }}>{formatThaiDate(item.vstdate)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {item.vsttime ? item.vsttime.slice(0, 5) : '—'}
                        </div>
                      </td>
                    )}
                    {visibleColumns.ptname && (
                      <td className="col-sticky-2 cell-center">
                        <div className="telemed-ptname-bold">{item.ptname}</div>
                        <div className="telemed-ptmeta-sub" style={{ justifyContent: 'center' }}>
                          <span>HN {item.hn}</span>
                          <span>
                            {item.sex} {item.age} ปี
                          </span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.vn && (
                      <td className="cell-center font-mono" style={{ fontSize: '0.8125rem' }}>
                        {item.vn || '—'}
                      </td>
                    )}
                    {visibleColumns.cid && (
                      <td className="cell-center">
                        <div className="telemed-cid-wrap">
                          <span>{unmasked ? item.cid : maskCid(item.cid)}</span>
                          {!unmasked && item.cid && (
                            <button
                              type="button"
                              className="telemed-cid-reveal-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                props.onUnmaskCid(item.vn, item.hn, item.cid)
                              }}
                              title="ดูเลขบัตรประชาชนเต็ม (บันทึกลง Audit Logs)"
                            >
                              ดูเต็ม
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.pttype && (
                      <td className="cell-center">
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {pttypeCode && <span className="telemed-code-badge neutral">{pttypeCode}</span>}
                          <span
                            title={item.pttypename}
                            style={{
                              maxWidth: 160,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                            }}
                          >
                            {pttypeTitle}
                          </span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.ovstist && (
                      <td className="cell-center">
                        <span
                          className={`telemed-code-badge ${
                            item.ovstist_export_code === '5' ? 'info' : 'neutral'
                          }`}
                          title={item.ovstist}
                        >
                          รหัส {item.ovstist_export_code || '—'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.pdx && (
                      <td className="cell-center">
                        <span className="telemed-code-badge brand" title={`PDX: ${item.pdx || '—'}`}>
                          {item.pdx || '—'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.fee && (
                      <td className="cell-center" style={{ fontWeight: item.sum_price > 0 ? 600 : 400 }}>
                        {item.sum_price > 0
                          ? item.sum_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })
                          : '0.00'}
                      </td>
                    )}
                    {visibleColumns.claimCode && (
                      <td className="cell-center">
                        {item.authencode ? (
                          <span className="telemed-code-badge info">{item.authencode}</span>
                        ) : (
                          <span className="telemed-code-badge danger">ไม่มี</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.compensated && (
                      <td className="cell-center" style={{ fontWeight: item.compensated > 0 ? 600 : 400 }}>
                        {item.compensated > 0 ? formatMoney(item.compensated) : '–'}
                        <RcmSeamlessSubAmount row={item} />
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="col-sticky-right cell-center">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                          <span
                            className={`telemed-code-badge ${
                              item.isCompensated ? 'success' : 'warning'
                            }`}
                          >
                            {statusLabel}
                          </span>
                          {item.rep && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--muted)', textAlign: 'center' }}>
                              REP: {item.rep}
                            </span>
                          )}
                        </div>
                        <RcmSeamlessRepBadges row={item} />
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="telemed-footer">
        <div className="telemed-footer-stats">
          <span>
            แสดง {totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, totalCount)} จาก {totalCount.toLocaleString('th-TH')} รายการ
          </span>
          <span>•</span>
          <span className="telemed-footer-sum">
            ผลรวมค่า TelMed: {formatMoney(totalSumPrice)} บ.
          </span>
          <select
            className="telemed-select"
            style={{ height: 32, padding: '0 8px', fontSize: '0.8125rem' }}
            value={pageSize}
            onChange={(e) => props.onPageSizeChange(Number(e.target.value))}
            aria-label="จำนวนแถวต่อหน้า"
          >
            <option value={25}>25 แถว/หน้า</option>
            <option value={50}>50 แถว/หน้า</option>
            <option value={100}>100 แถว/หน้า</option>
          </select>
        </div>

        <div className="telemed-pagination-controls">
          <div className="telemed-page-nav-btns">
            <button
              type="button"
              className="telemed-page-num-btn"
              disabled={currentPage <= 1 || loading}
              onClick={() => props.onPageChange((p) => Math.max(1, p - 1))}
              title="หน้าก่อนหน้า"
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p = i + 1
              if (totalPages > 5) {
                if (currentPage > 3) p = currentPage - 2 + i
                if (p > totalPages) p = totalPages - 4 + i
              }
              if (p < 1 || p > totalPages) return null

              return (
                <button
                  key={p}
                  type="button"
                  className={`telemed-page-num-btn ${currentPage === p ? 'active' : ''}`}
                  onClick={() => props.onPageChange(p)}
                >
                  {p}
                </button>
              )
            })}

            <button
              type="button"
              className="telemed-page-num-btn"
              disabled={currentPage >= totalPages || loading}
              onClick={() => props.onPageChange((p) => Math.min(totalPages, p + 1))}
              title="หน้าถัดไป"
              aria-label="หน้าถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <form onSubmit={props.onJumpPageSubmit} className="telemed-jump-page-wrap">
            <span>ไปหน้า</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => props.onJumpPageInputChange(e.target.value)}
              placeholder={String(currentPage)}
              className="telemed-jump-input"
              aria-label="กรอกหน้าที่ต้องการข้ามไป"
            />
          </form>
        </div>
      </div>
    </div>
  )
}
