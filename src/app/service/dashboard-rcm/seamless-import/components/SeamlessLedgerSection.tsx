'use client'

import React, { useState } from 'react'
import {
  Database,
  Search,
  Download,
  RefreshCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  BookOpen,
  X,
  Eye,
  Trash2,
  FileSpreadsheet,
  Filter,
} from 'lucide-react'
import type {
  SeamlessDenyCode,
  SeamlessHospFilter,
  SeamlessLedgerItem,
  SeamlessLedgerResult,
  SeamlessLedgerSortField,
  SeamlessPayStatusFilter,
} from '@/lib/clinical/rcmSeamlessImportService'
import { formatThaiDate } from '@/lib/formatters'

interface SeamlessLedgerSectionProps {
  ledger: SeamlessLedgerResult | null
  isLoadingLedger: boolean
  ledgerError: string | null
  denyCodes: SeamlessDenyCode[]
  isLoadingDenyCodes: boolean
  search: string
  onSearchChange: (val: string) => void
  hospFilter: SeamlessHospFilter
  onHospFilterChange: (val: SeamlessHospFilter) => void
  payStatus: SeamlessPayStatusFilter
  onPayStatusChange: (val: SeamlessPayStatusFilter) => void
  fundFilter: string
  onFundFilterChange: (val: string) => void
  fileNameFilter: string
  onClearFileFilter: () => void
  sortBy: SeamlessLedgerSortField
  sortOrder: 'asc' | 'desc'
  onSortChange: (field: SeamlessLedgerSortField) => void
  page: number
  onPageChange: (nextPage: number) => void
  denySearch: string
  onDenySearchChange: (val: string) => void
  onRefreshLedger: () => void
  onExportAllLedger: () => void
  isExportingLedger: boolean
  canImport: boolean
  onDeleteSingleFile: (fileName: string) => void
}

type DbExplorerTab = 'ledger' | 'deny_codes'

export default function SeamlessLedgerSection({
  ledger,
  isLoadingLedger,
  ledgerError,
  denyCodes,
  isLoadingDenyCodes,
  search,
  onSearchChange,
  hospFilter,
  onHospFilterChange,
  payStatus,
  onPayStatusChange,
  fundFilter,
  onFundFilterChange,
  fileNameFilter,
  onClearFileFilter,
  sortBy,
  sortOrder,
  onSortChange,
  page,
  onPageChange,
  denySearch,
  onDenySearchChange,
  onRefreshLedger,
  onExportAllLedger,
  isExportingLedger,
  canImport,
  onDeleteSingleFile,
}: SeamlessLedgerSectionProps) {
  const [explorerTab, setExplorerTab] = useState<DbExplorerTab>('ledger')
  const [selectedRow, setSelectedRow] = useState<SeamlessLedgerItem | null>(null)

  const items = ledger?.items || []
  const totalCount = ledger?.totalCount || 0
  const totalPages = Math.max(1, ledger?.totalPages || 1)
  const myHospCode = ledger?.myHospCode || '11152'

  const renderSortButton = (field: SeamlessLedgerSortField, label: string) => {
    const isActive = sortBy === field
    return (
      <button
        type="button"
        onClick={() => onSortChange(field)}
        className={`seamless-sort-th-btn ${isActive ? 'is-active' : ''}`}
      >
        <span>{label}</span>
        <ArrowUpDown size={12} />
        {isActive && <span className="seamless-sort-dir">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
      </button>
    )
  }

  return (
    <div className="seamless-card" style={{ marginTop: '1.5rem' }}>
      <div className="seamless-card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 className="seamless-card-title" style={{ margin: 0 }}>
            <Database size={20} style={{ color: '#059669' }} />
            <span>สำรวจข้อมูลจริงในฐานข้อมูล Seamless (Live Database)</span>
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
            ค้นหา กรองรายหน่วยบริการ / สถานะการโอน / กองทุน และดูพจนานุกรม Deny Code จากตาราง rcmdb.seamless_error
          </p>
        </div>

        <div className="seamless-db-tabs" role="tablist" aria-label="มุมมองฐานข้อมูล Seamless">
          <button
            type="button"
            role="tab"
            aria-selected={explorerTab === 'ledger'}
            onClick={() => setExplorerTab('ledger')}
            className={`seamless-tab-btn ${explorerTab === 'ledger' ? 'active' : ''}`}
          >
            <Database size={14} />
            <span>รายการชดเชย ({totalCount.toLocaleString('th-TH')})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={explorerTab === 'deny_codes'}
            onClick={() => setExplorerTab('deny_codes')}
            className={`seamless-tab-btn ${explorerTab === 'deny_codes' ? 'active' : ''}`}
          >
            <BookOpen size={14} />
            <span>รหัสปฏิเสธ DENY CODE ({denyCodes.length.toLocaleString('th-TH')})</span>
          </button>
        </div>
      </div>

      {explorerTab === 'ledger' ? (
        <div>
          {/* Filter Bar */}
          <div className="seamless-ledger-toolbar">
            <div className="seamless-search-wrap" style={{ flex: '1 1 260px' }}>
              <Search size={15} className="seamless-search-icon" />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="ค้นหา TransID, Rep, HN, VN, AN, เลขบัตร 13 หลัก, ชื่อผู้ป่วย, PayNo, ชื่อไฟล์..."
                className="seamless-search-input"
                aria-label="ค้นหารายการในฐานข้อมูล Seamless"
              />
            </div>

            <select
              value={hospFilter}
              onChange={(e) => onHospFilterChange(e.target.value as SeamlessHospFilter)}
              className="seamless-filter-select"
              aria-label="กรองตามหน่วยบริการ"
            >
              <option value="ALL">ทุกหน่วยบริการ (ทั้งหมด)</option>
              <option value="MINE">เฉพาะ รพ.เถิน ({myHospCode})</option>
              <option value="OTHER">ต่างหน่วยบริการ (HCode ≠ {myHospCode})</option>
            </select>

            <select
              value={payStatus}
              onChange={(e) => onPayStatusChange(e.target.value as SeamlessPayStatusFilter)}
              className="seamless-filter-select"
              aria-label="กรองตามสถานะวันโอน"
            >
              <option value="ALL">สถานะวันโอนทั้งหมด</option>
              <option value="PAID">ลงวันที่โอนแล้ว (PayDate มีค่า)</option>
              <option value="UNPAID">รอลงวันที่โอน (PayDate ว่าง)</option>
            </select>

            <select
              value={fundFilter}
              onChange={(e) => onFundFilterChange(e.target.value)}
              className="seamless-filter-select"
              aria-label="กรองตามกองทุน"
              style={{ maxWidth: '240px' }}
            >
              <option value="ALL">ทุกกองทุน ({(ledger?.availableFunds || []).length})</option>
              {(ledger?.availableFunds || []).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onRefreshLedger}
              disabled={isLoadingLedger}
              className="seamless-btn secondary"
              title="โหลดข้อมูลตารางล่าสุดจากเซิร์ฟเวอร์"
            >
              <RefreshCw size={14} className={isLoadingLedger ? 'seamless-spin' : ''} />
              <span>รีเฟรช</span>
            </button>

            <button
              type="button"
              onClick={onExportAllLedger}
              disabled={isExportingLedger || totalCount === 0}
              className="seamless-btn primary"
              title="ส่งออกรายการทั้งหมดตามตัวกรองปัจจุบันเป็นไฟล์ Excel (สูงสุด 50,000 แถว)"
            >
              <Download size={14} />
              <span>{isExportingLedger ? 'กำลังส่งออก...' : 'Export Excel (ตามตัวกรอง)'}</span>
            </button>
          </div>

          {/* Active File Filter Chip */}
          {fileNameFilter && (
            <div className="seamless-active-filter-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Filter size={14} style={{ color: '#0369a1' }} />
                <span>
                  กำลังกรองเฉพาะไฟล์: <strong>{fileNameFilter}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {canImport && (
                  <button
                    type="button"
                    onClick={() => onDeleteSingleFile(fileNameFilter)}
                    className="seamless-chip-danger-btn"
                  >
                    <Trash2 size={12} />
                    <span>ลบไฟล์นี้ออกจาก DB</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClearFileFilter}
                  className="seamless-chip-clear-btn"
                >
                  <X size={12} />
                  <span>ล้างตัวกรองไฟล์</span>
                </button>
              </div>
            </div>
          )}

          {ledgerError && (
            <div className="seamless-inline-alert error" role="alert">
              <AlertCircle size={16} />
              <span>{ledgerError}</span>
            </div>
          )}

          {/* Table */}
          <div className="seamless-table-wrapper">
            <table className="seamless-table">
              <thead>
                <tr>
                  <th>{renderSortButton('id', 'TransID')}</th>
                  <th>{renderSortButton('rep', 'Rep / กองทุน')}</th>
                  <th>{renderSortButton('hn', 'HN / VN / AN')}</th>
                  <th>{renderSortButton('ptname', 'ผู้ป่วย / CID 13 หลัก')}</th>
                  <th>{renderSortButton('admDate', 'วันที่รับบริการ')}</th>
                  <th>HCode</th>
                  <th style={{ textAlign: 'right' }}>{renderSortButton('collected', 'เรียกเก็บ')}</th>
                  <th style={{ textAlign: 'right' }}>{renderSortButton('compensated', 'ชดเชย')}</th>
                  <th>{renderSortButton('payDate', 'วันที่โอน / PayNo')}</th>
                  <th>{renderSortButton('fileName', 'ชื่อไฟล์')}</th>
                  <th style={{ textAlign: 'center' }}>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingLedger && items.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      กำลังโหลดข้อมูลจาก rcmdb.seamless...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={`${row.id}-${row.rep}`}
                      className={row.isOtherHosp ? 'seamless-row-other-hosp' : undefined}
                    >
                      <td className="tabular-nums" style={{ fontWeight: 600, color: '#0f172a' }}>
                        <div>{row.id}</div>
                        {row.mainInscl && (
                          <span className="seamless-mini-badge neutral">{row.mainInscl}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0369a1' }}>{row.rep}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.fund}>
                          {row.fund}
                        </div>
                      </td>
                      <td className="tabular-nums">
                        <div>HN: {row.hn || '-'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {row.an ? `AN: ${row.an}` : row.vn ? `VN: ${row.vn}` : 'VN/AN: -'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: '#0f172a' }}>{row.ptname || '-'}</div>
                        <div className="tabular-nums" style={{ fontSize: '0.75rem', color: '#475569' }}>
                          {row.pid || '-'}
                        </div>
                      </td>
                      <td className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                        <div>{formatThaiDate(row.admDate)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {row.yymm ? `YYMM ${row.yymm}` : ''}
                        </div>
                      </td>
                      <td className="tabular-nums">
                        <span
                          className={`seamless-mini-badge ${
                            row.isOtherHosp ? 'amber' : 'emerald'
                          }`}
                        >
                          {row.hcode || '-'}
                        </span>
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right' }}>
                        {row.collected.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td
                        className="tabular-nums"
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: row.compensated > 0 ? '#059669' : '#64748b',
                        }}
                      >
                        {row.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                        {row.payDate ? (
                          <>
                            <div style={{ color: '#059669', fontWeight: 600 }}>
                              {formatThaiDate(row.payDate)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {row.payNo || '-'}
                            </div>
                          </>
                        ) : (
                          <span className="seamless-mini-badge rose">รอวันที่โอน</span>
                        )}
                      </td>
                      <td>
                        <div
                          style={{
                            maxWidth: '170px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.75rem',
                            color: '#475569',
                          }}
                          title={row.fileName || ''}
                        >
                          {row.fileName || '-'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedRow(row)}
                          className="seamless-icon-action-btn"
                          title="ดูรายละเอียดทุกฟิลด์ (37 คอลัมน์)"
                          aria-label={`ดูรายละเอียดรายการ ${row.id}`}
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="seamless-pagination-bar">
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              แสดงหน้า <strong>{page.toLocaleString('th-TH')}</strong> จาก{' '}
              <strong>{totalPages.toLocaleString('th-TH')}</strong> • รวมทั้งหมด{' '}
              <strong>{totalCount.toLocaleString('th-TH')}</strong> รายการ (หน้าละ 50 รายการ)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1 || isLoadingLedger}
                className="seamless-btn secondary"
                style={{ padding: '0.35rem 0.75rem' }}
              >
                <ChevronLeft size={15} />
                <span>ก่อนหน้า</span>
              </button>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || isLoadingLedger}
                className="seamless-btn secondary"
                style={{ padding: '0.35rem 0.75rem' }}
              >
                <span>ถัดไป</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Deny Code Dictionary Tab */
        <div>
          <div className="seamless-ledger-toolbar">
            <div className="seamless-search-wrap" style={{ flex: '1 1 300px' }}>
              <Search size={15} className="seamless-search-icon" />
              <input
                type="search"
                value={denySearch}
                onChange={(e) => onDenySearchChange(e.target.value)}
                placeholder="ค้นหารหัสปฏิเสธ (Code) หรือคำอธิบาย..."
                className="seamless-search-input"
                aria-label="ค้นหารหัสปฏิเสธ DENY CODE"
              />
            </div>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              แสดง {denyCodes.length.toLocaleString('th-TH')} รหัสจากตาราง rcmdb.seamless_error
            </span>
          </div>

          <div className="seamless-table-wrapper">
            <table className="seamless-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>รหัสปฏิเสธ (Code)</th>
                  <th>คำอธิบายสาเหตุการปฏิเสธ (Name)</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingDenyCodes && denyCodes.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      กำลังโหลดรหัสปฏิเสธ...
                    </td>
                  </tr>
                ) : denyCodes.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      ไม่พบรหัสปฏิเสธในระบบ
                    </td>
                  </tr>
                ) : (
                  denyCodes.map((dc) => (
                    <tr key={dc.code}>
                      <td className="tabular-nums" style={{ fontWeight: 700, color: '#be123c' }}>
                        {dc.code}
                      </td>
                      <td>{dc.name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Row Detail Modal */}
      {selectedRow && (
        <div
          className="seamless-modal-backdrop"
          onClick={() => setSelectedRow(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="seamless-row-detail-title"
        >
          <div className="seamless-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="seamless-detail-modal-head">
              <div>
                <h3 id="seamless-row-detail-title" style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
                  รายละเอียดรายการ TransID: {selectedRow.id}
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                  {selectedRow.fund} • Rep: {selectedRow.rep}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="seamless-modal-close-btn"
                aria-label="ปิดหน้าต่างรายละเอียด"
              >
                <X size={18} />
              </button>
            </div>
            <div className="seamless-detail-modal-body">
              <div className="seamless-detail-grid">
                <div><span>ผู้ป่วย:</span><strong>{selectedRow.ptname || '-'}</strong></div>
                <div><span>CID 13 หลัก:</span><strong className="tabular-nums">{selectedRow.pid || '-'}</strong></div>
                <div><span>HN / VN / AN:</span><strong className="tabular-nums">{`${selectedRow.hn || '-'} / ${selectedRow.vn || '-'} / ${selectedRow.an || '-'}`}</strong></div>
                <div><span>สิทธิ / แผนก:</span><strong>{`${selectedRow.mainInscl || '-'} / ${selectedRow.department || '-'}`}</strong></div>
                <div><span>วันที่รับบริการ:</span><strong>{formatThaiDate(selectedRow.admDate)}</strong></div>
                <div><span>วันที่ส่งข้อมูล / ลงทะเบียน:</span><strong>{`${formatThaiDate(selectedRow.sendDate)} / ${formatThaiDate(selectedRow.regDate)}`}</strong></div>
                <div><span>YYMM / ปีงบประมาณ:</span><strong>{`${selectedRow.yymm || '-'} / ${selectedRow.yearBudget || '-'}`}</strong></div>
                <div><span>หน่วยบริการ (HCode / HSub / HSend):</span><strong>{`${selectedRow.hcode || '-'} / ${selectedRow.hsub || '-'} / ${selectedRow.hsend || '-'}`}</strong></div>
                <div><span>เรียกเก็บ (Collected):</span><strong className="tabular-nums">฿{selectedRow.collected.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></div>
                <div><span>ชดเชย (Compensated):</span><strong className="tabular-nums" style={{ color: '#059669' }}>฿{selectedRow.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></div>
                <div><span>ไม่ชดเชย / จ่ายเพิ่ม / เรียกคืน:</span><strong className="tabular-nums">{`${selectedRow.noCompensated.toFixed(2)} / ${selectedRow.payMore.toFixed(2)} / ${selectedRow.recall.toFixed(2)}`}</strong></div>
                <div><span>สถานะ / Period:</span><strong>{`${selectedRow.status || '-'} / ${selectedRow.period || '-'}`}</strong></div>
                <div><span>PayNo / วันที่โอน:</span><strong>{`${selectedRow.payNo || '-'} (${formatThaiDate(selectedRow.payDate)})`}</strong></div>
                <div><span>YYMM_Pay / YearBudget_Pay:</span><strong>{`${selectedRow.yymmPay || '-'} / ${selectedRow.yearBudgetPay || '-'}`}</strong></div>
                <div><span>CodeAccount / STMID:</span><strong>{`${selectedRow.codeAccount || '-'} / ${selectedRow.stmid || '-'}`}</strong></div>
                <div><span>อุปกรณ์ (Equip):</span><strong>{`${selectedRow.equipCode || '-'} ${selectedRow.equipName || ''}`.trim()}</strong></div>
                <div style={{ gridColumn: '1 / -1' }}><span>ประเภท (Type / SerialNo):</span><strong>{`${selectedRow.type || '-'} (SerialNo: ${selectedRow.serialNo || '-'})`}</strong></div>
                <div style={{ gridColumn: '1 / -1' }}><span>หมายเหตุ (Note):</span><strong>{selectedRow.note || '-'}</strong></div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span>ไฟล์ต้นทาง (FileName):</span>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <FileSpreadsheet size={14} style={{ color: '#059669' }} />
                    {selectedRow.fileName || '-'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
