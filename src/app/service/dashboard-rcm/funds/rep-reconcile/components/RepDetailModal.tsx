'use client'

import React from 'react'
import { X } from 'lucide-react'
import type {
  RepReconcileItem,
  VnReconcileDetails,
} from '@/lib/clinical/funds-reconcile/types'

interface RepDetailModalProps {
  selectedItem: RepReconcileItem | null
  details: VnReconcileDetails | null
  isLoading: boolean
  error: string | null
  onClose: () => void
}

function formatMoney(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function RepDetailModal({
  selectedItem,
  details,
  isLoading,
  error,
  onClose,
}: RepDetailModalProps) {
  if (!selectedItem) return null

  const cidDisplay = details?.cid || selectedItem.cid || '—'
  const ptnameDisplay = details?.ptname || selectedItem.ptname || '—'
  const pttypeDisplay = details?.pttypeName || selectedItem.pttypeName || selectedItem.mainInscl || '—'

  return (
    <div
      className="rr-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rr-modal-title"
      onClick={onClose}
    >
      <div className="rr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rr-modal-head">
          <div>
            <h2 id="rr-modal-title" className="rr-modal-title">
              รายละเอียดการรับบริการและรายการ REP
            </h2>
            <div className="rr-subline rr-modal-subtitle">
              <span className="rr-mono">
                {selectedItem.department === 'IP' ? 'AN' : 'VN'}: {selectedItem.vn || selectedItem.an || '—'}
              </span>
              {' · '}
              <span>เลข Rep: </span>
              <span className="rr-rep-code">
                {selectedItem.rep || '—'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="rr-btn rr-btn-secondary rr-btn-sm"
            onClick={onClose}
            aria-label="ปิดหน้าต่างรายละเอียด"
          >
            <X size={16} strokeWidth={1.5} />
            ปิด
          </button>
        </div>

        <div className="rr-modal-body">
          {/* Instant First-Paint Patient & REP Header */}
          <div className="rr-detail-grid">
            <div className="rr-detail-field">
              <span className="rr-detail-label">ชื่อ-สกุล</span>
              <span className="rr-detail-val">{ptnameDisplay}</span>
            </div>
            <div className="rr-detail-field">
              <span className="rr-detail-label">HN</span>
              <span className="rr-detail-val rr-mono">{selectedItem.hn || '—'}</span>
            </div>
            <div className="rr-detail-field">
              <span className="rr-detail-label">เลขบัตรประชาชน (13 หลัก)</span>
              <span className="rr-detail-val rr-mono">{cidDisplay}</span>
            </div>
            <div className="rr-detail-field">
              <span className="rr-detail-label">วันที่รับบริการ</span>
              <span className="rr-detail-val">{selectedItem.admdateThai || '—'}</span>
            </div>
            <div className="rr-detail-field">
              <span className="rr-detail-label">สิทธิการรักษา</span>
              <span className="rr-detail-val">{pttypeDisplay}</span>
            </div>
            <div className="rr-detail-field">
              <span className="rr-detail-label">กองทุนที่จับคู่ (/funds/*)</span>
              <span className="rr-detail-val">
                {selectedItem.primaryFundLabel} ({selectedItem.matchReason})
              </span>
            </div>
            <div className="rr-detail-field">
              <span className="rr-detail-label">เลข Rep / ใบตอบรับ</span>
              <span className="rr-detail-val rr-mono">{selectedItem.rep || '—'}</span>
            </div>
            <div className="rr-detail-field">
              <span className="rr-detail-label">เลขที่ e-Claim / ใบจ่ายเงิน (PayNo)</span>
              <span className="rr-detail-val rr-mono">
                {selectedItem.eclaimNo || selectedItem.payNo || '—'}
                {selectedItem.payDateThai ? ` (${selectedItem.payDateThai})` : ''}
              </span>
            </div>
          </div>

          {error && (
            <div className="rr-error-banner">
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="rr-empty rr-empty-compact">
              กำลังโหลดรายการ REP ทั้งหมดและรหัส ADP จาก HOSxP...
            </div>
          ) : (
            <>
              {/* All REP Lines Across All 5 Tables */}
              <div>
                <h3 className="rr-modal-section-title">
                  ข้อมูลข้าม 5 ตารางของ Visit นี้ ({details?.allRepLines.length ?? 0} รายการ)
                </h3>
                <div className="rr-table-card">
                  <div className="rr-table-scroll">
                    <table className="rr-table">
                      <thead>
                        <tr>
                          <th>แหล่งข้อมูล</th>
                          <th>เลข REP</th>
                          <th>กองทุน / ประเภท</th>
                          <th className="num">เรียกเก็บ</th>
                          <th className="num">ชดเชย</th>
                          <th>สถานะ / Error / File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(details?.allRepLines || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="rr-cell-muted">
                              ไม่พบรายการเพิ่มเติม
                            </td>
                          </tr>
                        ) : (
                          details!.allRepLines.map((line, i) => (
                            <tr key={`${line.source}-${line.rep || 'none'}-${i}`} className="rr-modal-row-static">
                              <td>
                                <span className="rr-badge rr-badge-source">{line.source}</span>
                              </td>
                              <td className="rr-mono">{line.rep || '—'}</td>
                              <td>
                                {[line.fund, line.subFund].filter(Boolean).join(' · ') || '—'}
                              </td>
                              <td className="num">{formatMoney(line.income)}</td>
                              <td className="num rr-cell-comp">
                                {formatMoney(line.compensated)}
                              </td>
                              <td>
                                {line.errorCode || line.eclaimStatus || line.fileName || '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* HOSxP Diagnosis & ADP Items */}
              {details && (details.dxList.length > 0 || details.adpItems.length > 0) && (
                <div>
                  <h3 className="rr-modal-section-title">
                    รหัสโรค (ICD-10) และรายการ ADP ใน HOSxP
                  </h3>
                  {details.dxList.length > 0 && (
                    <div className="rr-subline rr-modal-dx-line">
                      ICD-10: <span className="rr-mono">{details.dxList.join(', ')}</span>
                    </div>
                  )}
                  {details.adpItems.length > 0 && (
                    <div className="rr-table-card">
                      <div className="rr-table-scroll">
                        <table className="rr-table">
                          <thead>
                            <tr>
                              <th>รหัส ADP</th>
                              <th>รหัสรายการ</th>
                              <th>รายการยา / บริการ</th>
                              <th className="num">จำนวน</th>
                              <th className="num">มูลค่า</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details.adpItems.map((adp, idx) => (
                              <tr key={`${adp.icode}-${idx}`} className="rr-modal-row-static">
                                <td className="rr-mono rr-cell-strong">
                                  {adp.nhsoAdpCode || 'Type2'}
                                </td>
                                <td className="rr-mono">{adp.icode}</td>
                                <td>{adp.name}</td>
                                <td className="num">{adp.qty.toLocaleString('th-TH')}</td>
                                <td className="num">{formatMoney(adp.sumPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
