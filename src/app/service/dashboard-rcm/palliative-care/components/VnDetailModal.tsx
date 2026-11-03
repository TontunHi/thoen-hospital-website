'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type {
  VnClinicalDetails,
  VnOrderCategoryGroup,
} from '@/lib/clinical/rcmDashboardService'
import './VnDetailModal.css'

interface VnDetailModalProps {
  vn: string | null
  onClose: () => void
}

function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    if (!y || !m || !d) return dateStr
    const thaiMonths = [
      '',
      'ม.ค.',
      'ก.พ.',
      'มี.ค.',
      'เม.ย.',
      'พ.ค.',
      'มิ.ย.',
      'ก.ค.',
      'ส.ค.',
      'ก.ย.',
      'ต.ค.',
      'พ.ย.',
      'ธ.ค.',
    ]
    return `${d} ${thaiMonths[m]} ${y + 543}`
  } catch {
    return dateStr
  }
}

export function VnDetailModal({ vn, onClose }: VnDetailModalProps) {
  const [data, setData] = useState<VnClinicalDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'screen' | 'diag' | 'orders'>('screen')
  const [selectedCategory, setSelectedCategory] = useState<VnOrderCategoryGroup | 'ALL'>('ALL')

  // Fetch VN clinical details
  useEffect(() => {
    if (!vn) {
      setData(null)
      setError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    fetch(`/api/service/dashboard-rcm/palliative-care/vn-details?vn=${encodeURIComponent(vn)}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || `Error ${res.status}: ไม่สามารถดึงข้อมูลได้`)
        }
        return json.data as VnClinicalDetails
      })
      .then((resData) => {
        if (isMounted) {
          setData(resData)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [vn])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!data?.orders?.items) return []
    if (selectedCategory === 'ALL') return data.orders.items
    return data.orders.items.filter((item) => item.category_group === selectedCategory)
  }, [data, selectedCategory])

  if (!vn) return null

  return (
    <div
      className="vn-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vn-modal-title"
    >
      <div className="vn-modal-container">
        {/* Header / Patient Banner */}
        <div className="vn-modal-header">
          <div className="vn-modal-header-top">
            <div className="vn-modal-patient-info">
              <div className="vn-modal-patient-title">
                <span className="vn-badge-vn">VN: {vn}</span>
                <span className="vn-modal-patient-name" id="vn-modal-title">
                  {data?.header?.ptname || 'กำลังโหลดข้อมูลผู้ป่วย...'}
                </span>
                {data?.header && (
                  <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                    ({data.header.sex} • อายุ {data.header.age} ปี)
                  </span>
                )}
              </div>

              {data?.header && (
                <div className="vn-modal-meta-row">
                  <div className="vn-modal-meta-item">
                    <span className="vn-modal-meta-label">HN:</span>
                    <span className="vn-modal-meta-val">{data.header.hn}</span>
                  </div>
                  <div className="vn-modal-meta-item">
                    <span className="vn-modal-meta-label">CID:</span>
                    <span className="vn-modal-meta-val">{data.header.cid || '-'}</span>
                  </div>
                  <div className="vn-modal-meta-item">
                    <span className="vn-modal-meta-label">วันที่รับบริการ:</span>
                    <span className="vn-modal-meta-val">
                      {formatThaiDate(data.header.vstdate)} {data.header.vsttime ? `(${data.header.vsttime} น.)` : ''}
                    </span>
                  </div>
                  <div className="vn-modal-meta-item">
                    <span className="vn-modal-meta-label">สิทธิ:</span>
                    <span className="vn-modal-meta-val">{data.header.pttypename || '-'}</span>
                  </div>
                  <div className="vn-modal-meta-item">
                    <span className="vn-modal-meta-label">แผนก:</span>
                    <span className="vn-modal-meta-val">
                      {data.header.clinic} {data.header.department ? `(${data.header.department})` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="vn-modal-close-btn"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              title="ปิด (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="vn-modal-tabs">
          <button
            type="button"
            className={`vn-modal-tab-btn ${activeTab === 'screen' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('screen')}
          >
            🩺 ซักประวัติ &amp; สัญญาณชีพ (opdscreen)
          </button>
          <button
            type="button"
            className={`vn-modal-tab-btn ${activeTab === 'diag' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('diag')}
          >
            📋 การวินิจฉัยโรค (ovstdiag)
            {data?.diagnoses && (
              <span className="vn-modal-tab-pill">{data.diagnoses.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`vn-modal-tab-btn ${activeTab === 'orders' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            💊 รายการยาและค่ารักษา (opitemrece)
            {data?.orders && (
              <span className="vn-modal-tab-pill">{data.orders.items.length}</span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="vn-modal-body">
          {loading ? (
            <div className="vn-modal-loading">
              <div className="vn-modal-spinner" />
              <div style={{ color: '#64748b', fontSize: '0.925rem', fontWeight: 500 }}>
                กำลังดึงข้อมูลการรับบริการ VN: {vn} จากฐานข้อมูล HOSxP...
              </div>
            </div>
          ) : error ? (
            <div className="vn-modal-error">
              <div style={{ fontSize: '2.5rem' }}>⚠️</div>
              <div style={{ color: '#991b1b', fontWeight: 600 }}>{error}</div>
              <button
                type="button"
                className="vn-btn-close"
                onClick={() => {
                  setError(null)
                  setLoading(true)
                  fetch(`/api/service/dashboard-rcm/palliative-care/vn-details?vn=${encodeURIComponent(vn)}`)
                    .then((r) => r.json())
                    .then((j) => {
                      if (j.success) setData(j.data)
                      else setError(j.error)
                    })
                    .finally(() => setLoading(false))
                }}
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          ) : !data ? (
            <div className="vn-modal-loading">
              <div style={{ color: '#64748b' }}>ไม่พบข้อมูล</div>
            </div>
          ) : (
            <>
              {/* TAB 1: opdscreen */}
              {activeTab === 'screen' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Vital Signs Grid */}
                  <div>
                    <h4 style={{ margin: '0 0 0.65rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>
                      สัญญาณชีพและคัดกรองกายภาพ (Vital Signs)
                    </h4>
                    <div className="vn-vitals-grid">
                      <div className="vn-vital-card">
                        <span className="vn-vital-label">ความดันโลหิต (BP)</span>
                        <span className="vn-vital-value">
                          {data.screen?.bps != null && data.screen?.bpd != null
                            ? `${data.screen.bps}/${data.screen.bpd}`
                            : '-'}
                          <span className="vn-vital-unit">mmHg</span>
                        </span>
                      </div>
                      <div className="vn-vital-card">
                        <span className="vn-vital-label">ชีพจร (Pulse)</span>
                        <span className="vn-vital-value">
                          {data.screen?.pulse ?? '-'}
                          <span className="vn-vital-unit">bpm</span>
                        </span>
                      </div>
                      <div className="vn-vital-card">
                        <span className="vn-vital-label">หายใจ (RR)</span>
                        <span className="vn-vital-value">
                          {data.screen?.rr ?? '-'}
                          <span className="vn-vital-unit">/min</span>
                        </span>
                      </div>
                      <div className="vn-vital-card">
                        <span className="vn-vital-label">อุณหภูมิ (Temp)</span>
                        <span className="vn-vital-value">
                          {data.screen?.temperature ?? '-'}
                          <span className="vn-vital-unit">°C</span>
                        </span>
                      </div>
                      <div className="vn-vital-card">
                        <span className="vn-vital-label">น้ำหนัก (BW)</span>
                        <span className="vn-vital-value">
                          {data.screen?.bw ?? '-'}
                          <span className="vn-vital-unit">kg</span>
                        </span>
                      </div>
                      <div className="vn-vital-card">
                        <span className="vn-vital-label">ส่วนสูง (Height)</span>
                        <span className="vn-vital-value">
                          {data.screen?.height ?? '-'}
                          <span className="vn-vital-unit">cm</span>
                        </span>
                      </div>
                      <div className="vn-vital-card">
                        <span className="vn-vital-label">ดัชนีมวลกาย (BMI)</span>
                        <span className="vn-vital-value">
                          {data.screen?.bmi != null ? data.screen.bmi.toFixed(2) : '-'}
                          <span className="vn-vital-unit">kg/m²</span>
                        </span>
                      </div>
                      <div className="vn-vital-card">
                        <span className="vn-vital-label">ออกซิเจน (SpO2)</span>
                        <span className="vn-vital-value">
                          {data.screen?.spo2 ?? '-'}
                          <span className="vn-vital-unit">%</span>
                        </span>
                      </div>
                      <div className="vn-vital-card">
                        <span className="vn-vital-label">น้ำตาลในเลือด (FBS)</span>
                        <span className="vn-vital-value">
                          {data.screen?.fbs ? data.screen.fbs : '-'}
                          <span className="vn-vital-unit">mg/dL</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* History & Notes Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem' }}>
                    <div className="vn-clinical-notes-card">
                      <div className="vn-note-title">
                        <span>💬 อาการสำคัญ (Chief Complaint)</span>
                      </div>
                      <div className="vn-note-content">
                        {data.screen?.cc || 'ไม่ได้ระบุ'}
                      </div>
                    </div>

                    <div className="vn-clinical-notes-card">
                      <div className="vn-note-title">
                        <span>📝 ประวัติความเจ็บป่วยปัจจุบัน (HPI)</span>
                      </div>
                      <div className="vn-note-content">
                        {data.screen?.hpi || 'ไม่ได้ระบุ'}
                      </div>
                    </div>

                    <div className="vn-clinical-notes-card">
                      <div className="vn-note-title">
                        <span>🏥 ประวัติความเจ็บป่วยในอดีต / โรคประจำตัว (PMH)</span>
                      </div>
                      <div className="vn-note-content">
                        {data.screen?.pmh || 'ไม่ได้ระบุ'}
                      </div>
                    </div>

                    <div className="vn-clinical-notes-card">
                      <div className="vn-note-title">
                        <span>🔍 การตรวจร่างกาย (Physical Exam)</span>
                      </div>
                      <div className="vn-note-content">
                        {data.screen?.pe || 'ไม่มีบันทึกผลการตรวจร่างกาย'}
                      </div>
                    </div>
                  </div>

                  {/* Screening metadata */}
                  {data.screen?.screen_dep_name && (
                    <div style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', gap: '0.5rem' }}>
                      <span>จุดคัดกรอง:</span>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{data.screen.screen_dep_name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ovstdiag */}
              {activeTab === 'diag' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="vn-diag-table">
                      <thead>
                        <tr>
                          <th style={{ width: 45, textAlign: 'center' }}>ลำดับ</th>
                          <th style={{ width: 100 }}>รหัสโรค (ICD-10)</th>
                          <th>ชื่อการวินิจฉัย (Diagnosis Name)</th>
                          <th style={{ width: 220 }}>ประเภทการวินิจฉัย (Diag Type)</th>
                          <th style={{ width: 200 }}>แพทย์ผู้วินิจฉัย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.diagnoses.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                              ไม่พบข้อมูลการวินิจฉัยใน visit นี้
                            </td>
                          </tr>
                        ) : (
                          data.diagnoses.map((d, idx) => (
                            <tr key={`${d.icd10}-${idx}`}>
                              <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                              <td>
                                <span
                                  className={`vn-icd-badge ${
                                    d.diagtype === '1' ? 'vn-icd-pdx' : 'vn-icd-sdx'
                                  }`}
                                >
                                  {d.icd10}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{d.icd_name}</td>
                              <td>
                                <span
                                  style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: d.diagtype === '1' ? 700 : 500,
                                    color: d.diagtype === '1' ? '#1d4ed8' : '#334155',
                                  }}
                                >
                                  {d.diagtype_name}
                                </span>
                              </td>
                              <td style={{ color: '#475569' }}>{d.doctor_name || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: opitemrece */}
              {activeTab === 'orders' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Financial Summary Bar */}
                  <div className="vn-financial-bar">
                    <div className="vn-fin-stat">
                      <span className="vn-fin-stat-label">ยอดรวมค่าบริการทั้งหมด</span>
                      <span className="vn-fin-stat-value vn-fin-total">
                        {data.orders.total_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        จำนวน {data.orders.items.length} รายการ ({data.orders.total_items} หน่วย)
                      </span>
                    </div>

                    <div className="vn-fin-stat">
                      <span className="vn-fin-stat-label">ลูกหนี้สิทธิเบิกได้ (กองทุน/สิทธิ)</span>
                      <span className="vn-fin-stat-value vn-fin-claim">
                        {data.orders.total_claim.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {((data.orders.total_claim / (data.orders.total_price || 1)) * 100).toFixed(1)}% ของยอดรวม
                      </span>
                    </div>

                    <div className="vn-fin-stat">
                      <span className="vn-fin-stat-label">ชำระเงินเอง</span>
                      <span className="vn-fin-stat-value vn-fin-paid">
                        {data.orders.total_paid.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        เงินสด / ชำระเองเบิกได้
                      </span>
                    </div>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="vn-category-pills">
                    <button
                      type="button"
                      className={`vn-cat-pill-btn ${selectedCategory === 'ALL' ? 'is-active' : ''}`}
                      onClick={() => setSelectedCategory('ALL')}
                    >
                      ทั้งหมด <span className="vn-cat-pill-count">{data.orders.items.length}</span>
                    </button>

                    {data.orders.categories.map((cat) => (
                      <button
                        key={cat.category_group}
                        type="button"
                        className={`vn-cat-pill-btn ${selectedCategory === cat.category_group ? 'is-active' : ''}`}
                        onClick={() => setSelectedCategory(cat.category_group)}
                      >
                        {cat.title} <span className="vn-cat-pill-count">{cat.item_count}</span>
                      </button>
                    ))}
                  </div>

                  {/* Order Items Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="vn-order-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40, textAlign: 'center' }}>ลำดับ</th>
                          <th style={{ width: 90 }}>รหัส</th>
                          <th>รายการยา / เวชภัณฑ์ / บริการ</th>
                          <th>วิธีใช้ / คำแนะนำ (Drug Usage)</th>
                          <th style={{ width: 150 }}>หมวดรายได้</th>
                          <th style={{ width: 60, textAlign: 'center' }}>จำนวน</th>
                          <th style={{ width: 85, textAlign: 'right' }}>ราคา/หน่วย</th>
                          <th style={{ width: 95, textAlign: 'right' }}>รวมเงิน (฿)</th>
                          <th style={{ width: 110, textAlign: 'center' }}>การชำระ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                              ไม่พบรายการในหมวดนี้
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map((o, idx) => (
                            <tr key={`${o.icode}-${idx}`}>
                              <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
                                {o.icode}
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{o.item_name}</div>
                                {(o.strength || o.units) && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {[o.strength, o.units].filter(Boolean).join(' • ')}
                                  </div>
                                )}
                              </td>
                              <td style={{ fontSize: '0.8125rem', color: o.drugusage_text ? '#0f172a' : '#94a3b8' }}>
                                {o.drugusage_text || '-'}
                              </td>
                              <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                                {o.income_name || o.income_code || '-'}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{o.qty}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                                {o.unitprice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
                                {o.sum_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span
                                  className={`vn-paidst-badge ${
                                    o.paidst === '02'
                                      ? 'vn-paidst-claim'
                                      : o.paidst === '01' || o.paidst === '03'
                                      ? 'vn-paidst-paid'
                                      : 'vn-paidst-unpaid'
                                  }`}
                                  title={`รหัส paidst: ${o.paidst}`}
                                >
                                  {o.paidst_name || o.paidst || '-'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="vn-modal-footer">
          <button type="button" className="vn-btn-close" onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
