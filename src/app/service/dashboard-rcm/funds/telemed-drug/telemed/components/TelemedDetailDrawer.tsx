'use client'

import React from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, Eye, RefreshCw, X } from 'lucide-react'
import type { TelemedItem } from '@/lib/clinical/rcmTelemedDrugService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import { RcmSeamlessModalSection } from '@/components/rcm/RcmSeamlessRepDisplay'
import { cleanStatusName, consolidateDrugs, formatMoney, maskCid } from './telemedHelpers'

export interface TelemedDetailDrawerProps {
  selectedItem: TelemedItem | null
  selectedItemIndex: number | null
  totalItemsCount: number
  setSelectedItemIndex: React.Dispatch<React.SetStateAction<number | null>>
  drawerTab: 'summary' | 'clinical'
  handleDrawerTabChange: (tab: 'summary' | 'clinical') => void
  vnDetails: VnClinicalDetails | null
  setVnDetails: React.Dispatch<React.SetStateAction<VnClinicalDetails | null>>
  loadingVnDetails: boolean
  copiedField: string | null
  handleCopyText: (text: string, fieldId: string) => void
  unmaskedCids: Record<string, boolean>
  handleUnmaskCid: (vn: string, hn: string, cid: string) => void
}

export function TelemedDetailDrawer({
  selectedItem,
  selectedItemIndex,
  totalItemsCount,
  setSelectedItemIndex,
  drawerTab,
  handleDrawerTabChange,
  vnDetails,
  setVnDetails,
  loadingVnDetails,
  copiedField,
  handleCopyText,
  unmaskedCids,
  handleUnmaskCid,
}: TelemedDetailDrawerProps) {
  if (!selectedItem) return null

  return (
    <div
      className="telemed-drawer-backdrop"
      onClick={() => setSelectedItemIndex(null)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="telemed-drawer-title-id"
    >
      <div className="telemed-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="telemed-drawer-header">
          <div className="telemed-drawer-header-left">
            <h3 id="telemed-drawer-title-id" className="telemed-drawer-title">
              รายละเอียดการรับบริการ TelMed
            </h3>
            <p className="telemed-drawer-subtitle">
              VN {selectedItem.vn} • HN {selectedItem.hn} • {formatThaiDate(selectedItem.vstdate)}
            </p>
          </div>

          <div className="telemed-drawer-header-actions">
            <button
              type="button"
              className="telemed-drawer-nav-btn"
              disabled={selectedItemIndex == null || selectedItemIndex <= 0}
              onClick={() => {
                if (selectedItemIndex != null && selectedItemIndex > 0) {
                  setSelectedItemIndex(selectedItemIndex - 1)
                  setVnDetails(null)
                }
              }}
              title="รายการก่อนหน้า (ลูกศรซ้าย)"
            >
              <ChevronLeft size={14} />
              <span>ก่อนหน้า</span>
            </button>
            <button
              type="button"
              className="telemed-drawer-nav-btn"
              disabled={selectedItemIndex == null || selectedItemIndex >= totalItemsCount - 1}
              onClick={() => {
                if (selectedItemIndex != null && selectedItemIndex < totalItemsCount - 1) {
                  setSelectedItemIndex(selectedItemIndex + 1)
                  setVnDetails(null)
                }
              }}
              title="รายการถัดไป (ลูกศรขวา)"
            >
              <span>ถัดไป</span>
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="telemed-drawer-close-btn"
              onClick={() => setSelectedItemIndex(null)}
              title="ปิดหน้าต่าง (Esc)"
              aria-label="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="telemed-drawer-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={drawerTab === 'summary'}
            className={`telemed-drawer-tab-btn ${drawerTab === 'summary' ? 'active' : ''}`}
            onClick={() => handleDrawerTabChange('summary')}
          >
            สรุปข้อมูลการรับบริการ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={drawerTab === 'clinical'}
            className={`telemed-drawer-tab-btn ${drawerTab === 'clinical' ? 'active' : ''}`}
            onClick={() => handleDrawerTabChange('clinical')}
          >
            ข้อมูลทางคลินิก (เวชระเบียน)
          </button>
        </div>

        <div className="telemed-drawer-body">
          {drawerTab === 'summary' ? (
            <>
              <div className="telemed-drawer-grid">
                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">ชื่อ-สกุลผู้ป่วย</span>
                  <div className="telemed-drawer-card-val">
                    <strong>{selectedItem.ptname}</strong>
                    <button
                      type="button"
                      className="telemed-copy-btn"
                      onClick={() => handleCopyText(selectedItem.ptname, 'ptname')}
                      title="คัดลอกชื่อ"
                    >
                      {copiedField === 'ptname' ? <Check size={14} color="var(--brand)" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">เลขประจำตัวประชาชน (CID)</span>
                  <div className="telemed-drawer-card-val">
                    <span>
                      {unmaskedCids[selectedItem.vn] ? selectedItem.cid : maskCid(selectedItem.cid)}
                    </span>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      {!unmaskedCids[selectedItem.vn] && selectedItem.cid && (
                        <button
                          type="button"
                          className="telemed-cid-reveal-btn"
                          onClick={() =>
                            handleUnmaskCid(selectedItem.vn, selectedItem.hn, selectedItem.cid)
                          }
                          title="ดูเลขบัตรประชาชนเต็ม (บันทึกลง Audit Logs)"
                        >
                          <Eye size={12} style={{ display: 'inline', marginRight: 2 }} />
                          ดูเต็ม
                        </button>
                      )}
                      {selectedItem.cid && (
                        <button
                          type="button"
                          className="telemed-copy-btn"
                          onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                          title="คัดลอกเลขบัตร"
                        >
                          {copiedField === 'cid' ? <Check size={14} color="var(--brand)" /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">เพศ / อายุ</span>
                  <div className="telemed-drawer-card-val">
                    {selectedItem.sex} • {selectedItem.age} ปี
                  </div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">วันที่และเวลา</span>
                  <div className="telemed-drawer-card-val">
                    {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime ? selectedItem.vsttime.slice(0, 5) : ''}
                  </div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">ประเภทการมา (ovstist)</span>
                  <div className="telemed-drawer-card-val">{selectedItem.ovstist || '—'}</div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">ClaimCode</span>
                  <div className="telemed-drawer-card-val">
                    {selectedItem.authencode ? (
                      <span className="telemed-code-badge info">{selectedItem.authencode}</span>
                    ) : (
                      <span className="telemed-code-badge danger">ไม่มี ClaimCode</span>
                    )}
                  </div>
                </div>

                <div className="telemed-drawer-card full-width">
                  <span className="telemed-drawer-card-label">สิทธิการรักษา</span>
                  <div className="telemed-drawer-card-val">{selectedItem.pttypename}</div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">แผนก / คลินิก</span>
                  <div className="telemed-drawer-card-val">
                    {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                  </div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">รพ.หลัก / รพ.รอง</span>
                  <div className="telemed-drawer-card-val">
                    {selectedItem.hospmain || '—'} / {selectedItem.hospsub || '—'}
                  </div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">การวินิจฉัยหลัก (PDX)</span>
                  <div className="telemed-drawer-card-val" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                    {selectedItem.pdx || '—'}
                  </div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">ค่าบริการ TelMed</span>
                  <div className="telemed-drawer-card-val" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                    {selectedItem.sum_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.
                  </div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">สถานะการชดเชย / REP</span>
                  <div className="telemed-drawer-card-val">
                    <span
                      className={`telemed-code-badge ${
                        selectedItem.isCompensated ? 'success' : 'warning'
                      }`}
                    >
                      {cleanStatusName(selectedItem.status, selectedItem.isCompensated)}
                    </span>
                    {selectedItem.rep && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        REP: {selectedItem.rep}
                      </span>
                    )}
                  </div>
                </div>

                <div className="telemed-drawer-card">
                  <span className="telemed-drawer-card-label">ยอดชดเชยที่ได้รับ</span>
                  <div className="telemed-drawer-card-val" style={{ color: 'var(--success)', fontWeight: 600 }}>
                    {selectedItem.compensated > 0 ? `${formatMoney(selectedItem.compensated)} บ.` : '–'}
                  </div>
                </div>
              </div>

              {selectedItem.listname && (
                <div className="telemed-drawer-card full-width" style={{ marginTop: 4 }}>
                  <span className="telemed-drawer-card-label">รายการค่าบริการ Telemedicine ที่ผูก ADP</span>
                  <div className="telemed-drawer-card-val">{selectedItem.listname}</div>
                </div>
              )}
            </>
          ) : (
            <div>
              {loadingVnDetails ? (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  <p>กำลังโหลดข้อมูลเวชระเบียน...</p>
                </div>
              ) : vnDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                      สัญญาณชีพ (Vital Signs)
                    </div>
                    <div className="telemed-vitals-row">
                      <div className="telemed-vital-box">
                        <span className="telemed-vital-label">ความดันโลหิต</span>
                        <span className="telemed-vital-val">
                          {vnDetails.screen?.bps || '—'}/{vnDetails.screen?.bpd || '—'}
                          <span style={{ fontSize: '0.6875rem', fontWeight: 400, marginLeft: 2 }}>mmHg</span>
                        </span>
                      </div>
                      <div className="telemed-vital-box">
                        <span className="telemed-vital-label">ชีพจร</span>
                        <span className="telemed-vital-val">
                          {vnDetails.screen?.pulse || '—'}
                          <span style={{ fontSize: '0.6875rem', fontWeight: 400, marginLeft: 2 }}>/min</span>
                        </span>
                      </div>
                      <div className="telemed-vital-box">
                        <span className="telemed-vital-label">น้ำหนัก</span>
                        <span className="telemed-vital-val">
                          {vnDetails.screen?.bw || '—'}
                          <span style={{ fontSize: '0.6875rem', fontWeight: 400, marginLeft: 2 }}>กก.</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                      อาการสำคัญ (Chief Complaint)
                    </div>
                    <div className="telemed-clinical-box">{vnDetails.screen?.cc || '—'}</div>
                  </div>

                  {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                        การวินิจฉัยโรค (Diagnoses)
                      </div>
                      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                        {vnDetails.diagnoses.map((d, i) => (
                          <div key={i} className="telemed-diag-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="telemed-code-badge brand">{d.icd10}</span>
                              <span>{d.icd_name}</span>
                            </div>
                            <span className="telemed-code-badge neutral">
                              {d.diagtype_name?.toLowerCase().includes('principal') || i === 0
                                ? 'โรคหลัก'
                                : 'อื่น ๆ'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {vnDetails.orders?.items && vnDetails.orders.items.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                        รายการยาและเวชภัณฑ์ (รวมรายการซ้ำ)
                      </div>
                      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                        <table className="telemed-sub-table">
                          <thead>
                            <tr>
                              <th>รายการ</th>
                              <th style={{ textAlign: 'center', width: 90 }}>จำนวน</th>
                              <th style={{ textAlign: 'right', width: 90 }}>ราคา (บ.)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consolidateDrugs(vnDetails.orders.items).map((m, i) => (
                              <tr key={i}>
                                <td>{m.item_name}</td>
                                <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                  {m.qty} {m.units}
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatMoney(m.sum_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="telemed-drawer-summary-card">
                    <div className="telemed-summary-row">
                      <span>ยาและเวชภัณฑ์</span>
                      <span>{formatMoney(vnDetails.orders?.total_price || 0)} บ.</span>
                    </div>
                    <div className="telemed-summary-row">
                      <span>ค่าบริการ TelMed</span>
                      <span>{formatMoney(selectedItem.sum_price)} บ.</span>
                    </div>
                    <div className="telemed-summary-row total">
                      <span>รวมทั้งสิ้น</span>
                      <span>
                        {formatMoney((vnDetails.orders?.total_price || 0) + selectedItem.sum_price)} บ.
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                  ไม่พบข้อมูลคลินิกเพิ่มเติมสำหรับ VN นี้
                </div>
              )}
            </div>
          )}
          <RcmSeamlessModalSection item={selectedItem} />
        </div>
      </div>
    </div>
  )
}
