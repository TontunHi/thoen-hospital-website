'use client'

import React from 'react'
import { AlertTriangle, Check, Copy, FileSpreadsheet, Info, Search, X } from 'lucide-react'
import type {
  ParsedSeamlessRow,
  SeamlessDenyCode,
  SeamlessFundBreakdownItem,
  SeamlessSummaryInfo,
} from '@/lib/clinical/rcmSeamlessImportService'

export interface SeamlessPreviewTabsProps {
  activeTab: 'individual' | 'summary' | 'denyCodes' | 'errors'
  setActiveTab: React.Dispatch<React.SetStateAction<'individual' | 'summary' | 'denyCodes' | 'errors'>>
  isProcessingBatch: boolean
  combinedMetrics: {
    validRows: number
  }
  displayedFunds: Array<{ fundCode: string; fundName: string; count: number }>
  displayedSummaryInfo: SeamlessSummaryInfo[]
  displayedDenyCodes: SeamlessDenyCode[]
  displayedErrors: Array<{ fileName: string; row: number; error: string }>
  tableSearch: string
  setTableSearch: React.Dispatch<React.SetStateAction<string>>
  displayedPreviewRows: ParsedSeamlessRow[]
  dynamicColumns: Array<{
    key: string
    header: string
    align?: 'left' | 'right' | 'center'
    width?: string
    render: (row: ParsedSeamlessRow, idx: number) => React.ReactNode
  }>
}

export function SeamlessPreviewTabs({
  activeTab,
  setActiveTab,
  isProcessingBatch,
  combinedMetrics,
  displayedFunds,
  displayedSummaryInfo,
  displayedDenyCodes,
  displayedErrors,
  tableSearch,
  setTableSearch,
  displayedPreviewRows,
  dynamicColumns,
}: SeamlessPreviewTabsProps) {
  return (
    <>
      <div className="seamless-tabs-bar">
        {(isProcessingBatch || combinedMetrics.validRows > 0) && (
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={`seamless-tab-btn ${activeTab === 'individual' ? 'active' : ''}`}
          >
            <span>รายการผู้รับบริการ</span>
            <span className="seamless-tab-count tabular-nums">
              {combinedMetrics.validRows.toLocaleString('th-TH')}
            </span>
          </button>
        )}

        {(displayedFunds.length > 0 || displayedSummaryInfo.length > 0) && (
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`seamless-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          >
            <span>สรุปกองทุน</span>
            {displayedFunds.length > 0 && (
              <span className="seamless-tab-count tabular-nums">{displayedFunds.length}</span>
            )}
          </button>
        )}

        {displayedDenyCodes.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('denyCodes')}
            className={`seamless-tab-btn ${activeTab === 'denyCodes' ? 'active' : ''}`}
          >
            <span>รหัสปฏิเสธ</span>
            <span className="seamless-tab-count tabular-nums">{displayedDenyCodes.length}</span>
          </button>
        )}

        {displayedErrors.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('errors')}
            className={`seamless-tab-btn ${activeTab === 'errors' ? 'active' : ''}`}
          >
            <span>รายการผิดพลาด</span>
            <span className="seamless-tab-count alert tabular-nums">
              {displayedErrors.length}
            </span>
          </button>
        )}
      </div>

      {activeTab === 'individual' && (
        <div className="seamless-table-wrapper">
          <div className="seamless-table-toolbar">
            <div className="seamless-search-box">
              <Search size={15} style={{ color: '#94a3b8' }} />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="ค้นหาข้อมูล..."
                className="seamless-search-input"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  className="seamless-search-clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              แสดงตัวอย่าง {displayedPreviewRows.length} รายการ จากทั้งหมด {combinedMetrics.validRows.toLocaleString('th-TH')} รายการ
            </div>
          </div>

          <div className="seamless-table-container">
            <table className="seamless-table">
              <thead>
                <tr>
                  {(dynamicColumns.length > 0
                    ? dynamicColumns
                    : [
                        { key: 'index', header: 'ลำดับ', width: '60px' },
                        { key: 'id', header: 'Trans ID' },
                        { key: 'rep', header: 'Rep' },
                        { key: 'fund', header: 'กองทุน' },
                        { key: 'pid', header: 'เลขบัตรประชาชน' },
                        { key: 'hn', header: 'HN' },
                        { key: 'ptname', header: 'ชื่อ-สกุล' },
                        { key: 'admDate', header: 'วันที่บริการ' },
                        { key: 'compensated', header: 'ชดเชย' },
                        { key: 'hosMatch', header: 'สถานะ HOSxP' },
                      ]
                  ).map((col) => (
                    <th key={col.key} style={{ width: col.width, textAlign: 'center' }}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isProcessingBatch ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`skel-${idx}`} className="rcm-skeleton-row">
                      {Array.from({ length: Math.max(dynamicColumns.length, 10) }).map((__, colIdx) => (
                        <td key={colIdx} style={{ textAlign: 'center' }}>
                          <div className="rcm-skeleton-bar" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : displayedPreviewRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(dynamicColumns.length, 10)}
                      style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}
                    >
                      ไม่พบข้อมูลที่ตรงกับคำค้นหา
                    </td>
                  </tr>
                ) : (
                  displayedPreviewRows.slice(0, 100).map((row, idx) => (
                    <tr key={`${row.fileName || 'f'}-${row.rowNumber || idx}-${row.id || 'id'}-${idx}`}>
                      {dynamicColumns.map((col) => (
                        <td key={col.key} style={{ textAlign: 'center' }}>
                          {col.render(row, idx)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {displayedPreviewRows.length > 100 && (
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#64748b', textAlign: 'center', backgroundColor: '#f8fafc' }}>
              แสดงตัวอย่าง 100 รายการแรก เพื่อความรวดเร็วในการแสดงผล
            </div>
          )}
        </div>
      )}

      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayedSummaryInfo.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
              {displayedSummaryInfo.map((info, idx) => (
                <div key={`${info.rep}-${info.payNo}-${idx}`} style={{ padding: '0.875rem 1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#047857', marginBottom: '0.4rem' }}>
                    Rep: {info.rep}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {info.payNo && <div>เลขที่โอน: <strong>{info.payNo}</strong></div>}
                    {info.repDate && <div>วันที่ Rep: <strong>{info.repDate}</strong></div>}
                    {info.payDate && <div>วันที่โอน: <strong>{info.payDate}</strong></div>}
                    {info.codeAccount && <div>รหัสบัญชี: <strong>{info.codeAccount}</strong></div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {displayedFunds.length > 0 && (
            <div className="seamless-table-container">
              <table className="seamless-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>ลำดับ</th>
                    <th style={{ textAlign: 'center' }}>รหัสกองทุน</th>
                    <th style={{ textAlign: 'center' }}>ชื่อกองทุน สปสช.</th>
                    <th style={{ textAlign: 'center' }}>จำนวนรายการ</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedFunds.map((fund, idx) => (
                    <tr key={`${fund.fundCode}-${idx}`}>
                      <td className="tabular-nums" style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, textAlign: 'center' }}>{fund.fundCode}</td>
                      <td style={{ textAlign: 'center' }}>{fund.fundName}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }} className="tabular-nums">
                        {fund.count.toLocaleString('th-TH')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'denyCodes' && displayedDenyCodes.length > 0 && (
        <div className="seamless-table-container">
          <table className="seamless-table">
            <thead>
              <tr>
                <th style={{ width: '120px', textAlign: 'center' }}>รหัสปฏิเสธ</th>
                <th style={{ textAlign: 'center' }}>คำอธิบายข้อผิดพลาด</th>
              </tr>
            </thead>
            <tbody>
              {displayedDenyCodes.map((d, idx) => (
                <tr key={`${d.code}-${idx}`}>
                  <td style={{ textAlign: 'center' }}>
                    <span className="seamless-fund-tag alert">{d.code}</span>
                  </td>
                  <td style={{ fontWeight: 600, textAlign: 'center' }}>{d.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'errors' && displayedErrors.length > 0 && (
        <div className="seamless-table-container">
          <table className="seamless-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>ไฟล์</th>
                <th style={{ textAlign: 'center' }}>แถวที่</th>
                <th style={{ textAlign: 'center' }}>สาเหตุข้อผิดพลาด</th>
              </tr>
            </thead>
            <tbody>
              {displayedErrors.map((err, idx) => (
                <tr key={`${err.fileName}-${err.row}-${idx}`}>
                  <td style={{ fontWeight: 600, color: '#334155', textAlign: 'center' }}>{err.fileName}</td>
                  <td className="tabular-nums" style={{ textAlign: 'center' }}>{err.row > 0 ? err.row : 'ทั้งไฟล์'}</td>
                  <td style={{ color: '#b91c1c', textAlign: 'center' }}>{err.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export interface SeamlessErrorModalProps {
  errorModal: {
    isOpen: boolean
    title: string
    message: string
    fileName?: string
    details?: string
  } | null
  copiedError: boolean
  onClose: () => void
  onCopyError: () => void
}

export function SeamlessErrorModal({
  errorModal,
  copiedError,
  onClose,
  onCopyError,
}: SeamlessErrorModalProps) {
  if (!errorModal?.isOpen) return null

  return (
    <div
      className="seamless-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seamless-modal-title"
    >
      <div className="seamless-error-modal" onClick={(e) => e.stopPropagation()}>
        <div className="seamless-modal-head">
          <div className="seamless-modal-head-left">
            <div className="seamless-modal-icon-badge">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 id="seamless-modal-title" className="seamless-modal-title">
                {errorModal.title}
              </h3>
              <p className="seamless-modal-subtitle">
                ตรวจพบข้อผิดพลาดในการประมวลผลไฟล์ Seamless
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="seamless-modal-close-btn"
            aria-label="ปิดหน้าต่างข้อผิดพลาด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="seamless-modal-body">
          {errorModal.fileName && (
            <div className="seamless-modal-file-tag">
              <FileSpreadsheet size={15} style={{ color: '#059669' }} />
              <span>ไฟล์: {errorModal.fileName}</span>
            </div>
          )}

          <p className="seamless-modal-error-text">{errorModal.message}</p>

          {errorModal.details && (
            <div className="seamless-modal-details-box">
              <span className="seamless-modal-details-label">รายละเอียดทางเทคนิค</span>
              <pre className="seamless-modal-details-content">{errorModal.details}</pre>
            </div>
          )}

          <div className="seamless-modal-guidance">
            <Info size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>แนวทางแก้ไข:</strong> ตรวจสอบว่าไฟล์เป็นนามสกุล <code>.xlsx</code> หรือ <code>.csv</code> (หากเป็น <code>.xls</code> เก่า ให้เปิดใน Excel แล้ว Save As เป็น <code>.xlsx</code>), มีชีทหรือส่วนหัว <code>REP แบบ INDIVIDUAL</code> และไม่ได้เปิดไฟล์ค้างไว้ในโปรแกรมอื่น
            </div>
          </div>
        </div>

        <div className="seamless-modal-foot">
          <button
            type="button"
            onClick={onCopyError}
            className="seamless-btn secondary"
            style={{ fontSize: '0.8125rem' }}
          >
            {copiedError ? (
              <>
                <Check size={14} style={{ color: '#059669' }} />
                <span style={{ color: '#059669' }}>คัดลอกเรียบร้อย</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>คัดลอกข้อความผิดพลาด</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="seamless-btn primary"
            style={{ fontSize: '0.8125rem', padding: '0.5rem 1.25rem' }}
          >
            รับทราบ / ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
