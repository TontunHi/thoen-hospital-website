'use client'

import React from 'react'
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import type {
  StreptokinaseItem,
  StreptokinaseCardFilter,
  StreptokinasePatientType,
  StreptokinaseSortField,
} from '@/lib/clinical/rcmStreptokinaseService'
import { formatThaiDate } from '@/lib/formatters'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
import { RcmSeamlessSubAmount, RcmSeamlessRepBadges } from '@/components/rcm/RcmSeamlessRepDisplay'
import RepMultiSelect, { RcmRepActiveBadge } from '@/components/rcm/RepMultiSelect'
import type { RepBreakdownSummary } from '@/lib/clinical/rcmRepTagHelper'
import { formatStkMoney } from './StreptokinaseKpiGrid'

export interface StreptokinaseTableSectionProps {
  patientType: StreptokinasePatientType
  items: StreptokinaseItem[]
  totalCount: number
  totalPages: number
  currentPage: number
  loading: boolean
  isRefreshing: boolean
  search: string
  pttypes: string[]
  selectedReps: string[]
  effectiveRepBreakdown: RepBreakdownSummary
  cardFilter: StreptokinaseCardFilter
  sortBy: StreptokinaseSortField
  sortOrder: 'asc' | 'desc'
  onSearchChange: (val: string) => void
  onClearSearch: () => void
  onPttypesChange: (codes: string[]) => void
  onSelectedRepsChange: (reps: string[]) => void
  onClearCardFilter: () => void
  onSort: (field: StreptokinaseSortField) => void
  onRowClick: (item: StreptokinaseItem) => void
  onPageChange: React.Dispatch<React.SetStateAction<number>>
}

export function StreptokinaseTableSection({
  patientType,
  items,
  totalCount,
  totalPages,
  currentPage,
  loading,
  isRefreshing,
  search,
  pttypes,
  selectedReps,
  effectiveRepBreakdown,
  cardFilter,
  sortBy,
  sortOrder,
  onSearchChange,
  onClearSearch,
  onPttypesChange,
  onSelectedRepsChange,
  onClearCardFilter,
  onSort,
  onRowClick,
  onPageChange,
}: StreptokinaseTableSectionProps) {
  const renderSortIcon = (field: StreptokinaseSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={14} className="stk-sort-inactive" />
    }
    return sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
  }

  return (
    <>
      {/* Toolbar & Unified Global Search */}
      <div className="stk-toolbar">
        <div className="stk-search-box">
          <Search size={18} className="stk-search-icon" />
          <input
            type="text"
            className="stk-search-input"
            placeholder="ค้นหาด้วย HN, CID, ชื่อผู้ป่วย, VN/AN, รหัสโรค, สิทธิการรักษา, Rep..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="stk-search-clear"
              onClick={onClearSearch}
              title="ล้างคำค้นหา"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <PttypeMultiSelect
          selectedCodes={pttypes}
          onChange={onPttypesChange}
          items={items}
        />

        <RepMultiSelect
          selectedReps={selectedReps}
          onChange={onSelectedRepsChange}
          repBreakdown={effectiveRepBreakdown}
          items={items}
        />

        <RcmRepActiveBadge
          selectedReps={selectedReps}
          onClear={() => onSelectedRepsChange([])}
        />

        <div className="stk-toolbar-meta">
          <span>
            แสดงผล <strong className="stk-count-badge">{items.length}</strong> จากทั้งหมด{' '}
            <strong className="stk-count-badge">{totalCount.toLocaleString()}</strong> รายการ
          </span>
          {cardFilter !== 'ALL' && (
            <button
              type="button"
              className="stk-badge stk-badge-neutral cursor-pointer hover:bg-slate-200"
              onClick={onClearCardFilter}
            >
              <span>ล้างตัวกรองการ์ด</span>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="stk-table-container">
        <div className="stk-table-scroll">
          <table className="stk-table">
            <thead>
              <tr>
                <th className="col-center" style={{ width: '56px' }}>
                  ลำดับ
                </th>
                <th className="col-center" style={{ width: '130px' }}>
                  <button
                    type="button"
                    className="stk-th-sort"
                    onClick={() => onSort('date')}
                  >
                    <span className="th-sort-inner">
                      <span>{patientType === 'OPD' ? 'วันที่รับบริการ' : 'วันจำหน่าย'}</span>
                      {renderSortIcon('date')}
                    </span>
                  </button>
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                  <span>{patientType === 'OPD' ? 'VN' : 'AN'}</span>
                </th>
                <th className="col-center" style={{ width: '90px' }}>
                  <button
                    type="button"
                    className="stk-th-sort"
                    onClick={() => onSort('hn')}
                  >
                    <span className="th-sort-inner">
                      <span>HN</span>
                      {renderSortIcon('hn')}
                    </span>
                  </button>
                </th>
                <th className="col-center" style={{ width: '140px' }}>
                  <span>เลขบัตรประชาชน</span>
                </th>
                <th className="col-center" style={{ minWidth: '170px' }}>
                  <button
                    type="button"
                    className="stk-th-sort"
                    onClick={() => onSort('ptname')}
                  >
                    <span className="th-sort-inner">
                      <span>ชื่อ-สกุล</span>
                      {renderSortIcon('ptname')}
                    </span>
                  </button>
                </th>
                <th className="col-center" style={{ width: '68px' }}>
                  <span>เพศ</span>
                </th>
                <th className="col-center" style={{ width: '80px' }}>
                  <button
                    type="button"
                    className="stk-th-sort"
                    onClick={() => onSort('age')}
                  >
                    <span className="th-sort-inner">
                      <span>อายุ</span>
                      {renderSortIcon('age')}
                    </span>
                  </button>
                </th>
                <th style={{ minWidth: '160px' }}>
                  <span>สิทธิการรักษา</span>
                </th>
                <th style={{ minWidth: '150px' }}>
                  <span>{patientType === 'OPD' ? 'ห้องตรวจ/แผนก' : 'ตึกผู้ป่วย'}</span>
                </th>
                <th className="col-center" style={{ width: '120px' }}>
                  <span>ผลตรวจ Dx STEMI</span>
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                  <span>ผลตรวจ Op 9910</span>
                </th>
                <th className="col-center" style={{ width: '120px' }}>
                  <button
                    type="button"
                    className="stk-th-sort justify-center"
                    onClick={() => onSort('money_hosxp')}
                  >
                    <span className="th-sort-inner">
                      <span>ค่ายา HOSxP</span>
                      {renderSortIcon('money_hosxp')}
                    </span>
                  </button>
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                  <span>ชดเชย (บาท)</span>
                </th>
                <th className="col-center" style={{ width: '100px' }}>
                  <span>เลขที่ Rep</span>
                </th>
                <th className="col-center" style={{ width: '150px' }}>
                  <span>สถานะ E-Claim</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`skel-${idx}`} className="rcm-skeleton-row">
                    {Array.from({ length: 16 }).map((__, colIdx) => (
                      <td key={colIdx} className="col-center">
                        <div className="rcm-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={16} className="stk-empty-state">
                    <HeartPulse size={36} className="stk-empty-icon" />
                    <div className="stk-empty-title">
                      {search ? 'ไม่พบผลการค้นหา' : 'ไม่พบข้อมูลผู้รับยา Stroke และSTEMI'}
                    </div>
                    <div className="stk-empty-desc">
                      {search
                        ? `ไม่พบข้อมูลที่ตรงกับ "${search}" ในช่วงเวลาที่เลือก`
                        : 'ไม่มีการบันทึกการใช้ยา Stroke และSTEMI ในช่วงเวลาที่เลือก'}
                    </div>
                    {search && (
                      <div className="stk-empty-action">
                        <button
                          type="button"
                          className="stk-btn stk-btn-secondary"
                          onClick={onClearSearch}
                        >
                          <X size={14} />
                          <span>ล้างคำค้นหาทั้งหมด</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isOpd = item.patientType === 'OPD'
                  const parts = (item.ptname || '').trim().split(/\s+/)
                  const firstPart = parts[0] || ''
                  const surnamePart = parts.slice(1).join(' ')
                  return (
                    <tr
                      key={item.vn || item.an || `${item.hn}-${item.no}`}
                      className="stk-row-clickable"
                      onClick={() => onRowClick(item)}
                      title="คลิกเพื่อดูรายละเอียดเวชระเบียนและการตรวจสอบ"
                    >
                      <td className="col-center stk-num">{item.no}</td>
                      <td className="col-center stk-num">
                        {formatThaiDate(isOpd ? item.vstdate : item.dchdate)}
                      </td>
                      <td className="col-center stk-num">{isOpd ? item.vn : item.an}</td>
                      <td className="col-center stk-num font-medium">{item.hn}</td>
                      <td className="col-center stk-cid">{item.cid || '—'}</td>
                      <td className="col-center stk-ptname">
                        <span className="pt-first-name">{firstPart}</span>
                        {surnamePart && (
                          <>
                            {' '}
                            <span className="pt-last-name">{surnamePart}</span>
                          </>
                        )}
                      </td>
                      <td className="col-center">{item.sex}</td>
                      <td className="col-center stk-age-nowrap">{item.age}&nbsp;ปี</td>
                      <td className="truncate max-w-[180px]" title={item.pttypename}>
                        {item.pttypename || '—'}
                      </td>
                      <td className="truncate max-w-[160px]">
                        {isOpd ? item.department || item.clinic || '—' : item.ward || '—'}
                      </td>
                      <td className="col-center">
                        {item.errorDx ? (
                          <span className="stk-badge stk-badge-danger" title={item.errorDx}>
                            <AlertTriangle size={12} />
                            <span>ไม่พบ Dx</span>
                          </span>
                        ) : (
                          <span
                            className="stk-badge stk-badge-success"
                            title={`รหัสโรค: ${item.dx || ''}`}
                          >
                            <CheckCircle2 size={12} />
                            <span>ถูกต้อง</span>
                          </span>
                        )}
                      </td>
                      <td className="col-center">
                        {item.errorOp ? (
                          <span className="stk-badge stk-badge-danger" title={item.errorOp}>
                            <AlertTriangle size={12} />
                            <span>ไม่พบ Op</span>
                          </span>
                        ) : (
                          <span
                            className="stk-badge stk-badge-success"
                            title={`หัตถการ: ${item.op || ''}`}
                          >
                            <CheckCircle2 size={12} />
                            <span>มี 9910</span>
                          </span>
                        )}
                      </td>
                      <td className="col-right stk-num font-medium">
                        {formatStkMoney(item.money_hosxp)}
                      </td>
                      <td className="col-center stk-num font-medium text-emerald-700">
                        {formatStkMoney(item.compensated)}
                        <RcmSeamlessSubAmount row={item} />
                      </td>
                      <td className="col-center stk-num">
                        {item.rep ? (
                          <span className="stk-badge stk-badge-purple">{item.rep}</span>
                        ) : (
                          '—'
                        )}
                        <RcmSeamlessRepBadges row={item} />
                      </td>
                      <td className="col-center">
                        {item.status.includes('Invoice') ? (
                          <span className="stk-badge stk-badge-info">มี Invoice</span>
                        ) : item.status.includes('Rep') ? (
                          <span className="stk-badge stk-badge-success">มี Rep</span>
                        ) : item.status.startsWith('-') ? (
                          <span className="stk-badge stk-badge-warning">ยังไม่ส่ง</span>
                        ) : (
                          <span className="stk-badge stk-badge-neutral">{item.status}</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="stk-pagination">
            <div>
              หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด{' '}
              {totalCount.toLocaleString()} รายการ)
            </div>

            <div className="stk-pagination-btns">
              <button
                type="button"
                className="stk-page-btn"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1 || loading}
              >
                «
              </button>
              <button
                type="button"
                className="stk-page-btn"
                onClick={() => onPageChange((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                ‹
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                let pNum = currentPage - 2 + idx
                if (pNum < 1) pNum = idx + 1
                if (pNum > totalPages) return null
                return (
                  <button
                    key={pNum}
                    type="button"
                    className={`stk-page-btn ${currentPage === pNum ? 'is-active' : ''}`}
                    onClick={() => onPageChange(pNum)}
                    disabled={loading}
                  >
                    {pNum}
                  </button>
                )
              })}

              <button
                type="button"
                className="stk-page-btn"
                onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
              >
                ›
              </button>
              <button
                type="button"
                className="stk-page-btn"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages || loading}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
