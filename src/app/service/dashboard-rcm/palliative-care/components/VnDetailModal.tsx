'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  CircleAlert,
  ClipboardList,
  Info,
  Pill,
  Stethoscope,
  UserPlus,
  X,
} from 'lucide-react'
import type {
  VnClinicalDetails,
  VnOrderCategoryGroup,
  VnScreenData,
} from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import './VnDetailModal.css'

interface VnDetailModalProps {
  vn: string | null
  onClose: () => void
}

type VnTab = 'screen' | 'diag' | 'orders'

interface PopupNotice {
  type: 'success' | 'warning' | 'error'
  title: string
  message: string
}

interface VitalItem {
  key: string
  label: string
  value: string | number
  unit: string
}

/** เงินบาท: ทศนิยม 2 ตำแหน่งคงที่ทั้งมุมมอง เพื่อให้เทียบหลักตรงกัน */
const formatMoney = (value: number | null | undefined): string =>
  (Number.isFinite(value ?? NaN) ? (value as number) : 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

/** สัญญาณชีพ 9 ค่า — สร้างจากข้อมูล opdscreen ตรง ๆ ไม่คำนวณซ้ำ */
function buildVitalItems(screen: VnScreenData | null): VitalItem[] {
  return [
    {
      key: 'bp',
      label: 'ความดันโลหิต',
      value: screen?.bps != null && screen?.bpd != null ? `${screen.bps}/${screen.bpd}` : '-',
      unit: 'mmHg',
    },
    { key: 'pulse', label: 'ชีพจร', value: screen?.pulse ?? '-', unit: 'bpm' },
    { key: 'rr', label: 'อัตราการหายใจ', value: screen?.rr ?? '-', unit: '/min' },
    { key: 'temp', label: 'อุณหภูมิ', value: screen?.temperature ?? '-', unit: '°C' },
    { key: 'bw', label: 'น้ำหนัก', value: screen?.bw ?? '-', unit: 'kg' },
    { key: 'height', label: 'ส่วนสูง', value: screen?.height ?? '-', unit: 'cm' },
    {
      key: 'bmi',
      label: 'ดัชนีมวลกาย (BMI)',
      value: screen?.bmi != null ? screen.bmi.toFixed(2) : '-',
      unit: 'kg/m²',
    },
    { key: 'spo2', label: 'ออกซิเจน (SpO2)', value: screen?.spo2 ?? '-', unit: '%' },
    { key: 'fbs', label: 'น้ำตาลในเลือด (FBS)', value: screen?.fbs ?? '-', unit: 'mg/dL' },
  ]
}

const NOTE_SECTIONS: Array<{ key: 'cc' | 'hpi' | 'pmh' | 'pe'; title: string; emptyText: string }> = [
  { key: 'cc', title: 'อาการสำคัญ (CC)', emptyText: 'ไม่ได้ระบุ' },
  { key: 'hpi', title: 'ประวัติความเจ็บป่วยปัจจุบัน (HPI)', emptyText: 'ไม่ได้ระบุ' },
  { key: 'pmh', title: 'ประวัติความเจ็บป่วยในอดีต / โรคประจำตัว (PMH)', emptyText: 'ไม่ได้ระบุ' },
  { key: 'pe', title: 'การตรวจร่างกาย (PE)', emptyText: 'ไม่มีบันทึกผลการตรวจร่างกาย' },
]

/** paidst 02 = ลูกหนี้สิทธิ, 01/03 = ชำระแล้ว, อื่น ๆ = รอชำระ */
function getPaidstTone(paidst: string): string {
  if (paidst === '02') return 'is-info'
  if (paidst === '01' || paidst === '03') return 'is-ok'
  return 'is-warn'
}

export function VnDetailModal({ vn, onClose }: VnDetailModalProps) {
  const [data, setData] = useState<VnClinicalDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<VnTab>('screen')
  const [selectedCategory, setSelectedCategory] = useState<VnOrderCategoryGroup | 'ALL'>('ALL')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isRegisteredSuccess, setIsRegisteredSuccess] = useState(false)
  const [popupNotice, setPopupNotice] = useState<PopupNotice | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const requestIdRef = useRef(0)

  // ── Fetch VN clinical details (กันคำตอบเก่าทับคำตอบใหม่) ──────────────
  const loadDetails = useCallback(async () => {
    if (!vn) return
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/palliative-care/vn-details?vn=${encodeURIComponent(vn)}`
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Error ${res.status}: ไม่สามารถดึงข้อมูลได้`)
      }
      if (requestId === requestIdRef.current) {
        setData(json.data as VnClinicalDetails)
      }
    } catch (err: unknown) {
      if (requestId === requestIdRef.current) {
        setError((err as Error).message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [vn])

  useEffect(() => {
    if (!vn) {
      setData(null)
      setError(null)
      setActiveTab('screen')
      setSelectedCategory('ALL')
      return
    }
    loadDetails()
  }, [vn, loadDetails])

  // โฟกัสในกล่องบทสนทนาเมื่อเปิด + ล็อกการเลื่อนพื้นหลัง (ทั้ง html และ body)
  useEffect(() => {
    if (!vn) return
    containerRef.current?.focus()
    const html = document.documentElement
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [vn])

  // ESC ปิดป๊อปอัปแจ้งเตือนก่อน แล้วจึงปิดหน้าต่าง
  useEffect(() => {
    if (!vn) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (popupNotice) setPopupNotice(null)
      else onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [vn, popupNotice, onClose])

  const filteredOrders = useMemo(() => {
    if (!data?.orders?.items) return []
    if (selectedCategory === 'ALL') return data.orders.items
    return data.orders.items.filter((item) => item.category_group === selectedCategory)
  }, [data, selectedCategory])

  // Direct register patient into Palliative Care registry without leaving page
  const handleDirectRegister = async () => {
    if (!data?.header?.hn || isRegistering || isRegisteredSuccess) return
    if (data.header.isLtc) {
      setPopupNotice({
        type: 'warning',
        title: 'ไม่สามารถลงทะเบียนได้',
        message: 'ผู้ป่วยรายนี้เป็นผู้มีทะเบียนใน LTC แล้ว ไม่สามารถลงทะเบียน Palliative Care ได้',
      })
      return
    }
    const targetHn = data.header.hn.trim()
    setIsRegistering(true)

    try {
      // 1. Lookup patient demographics and check existing registry status from HOSxP
      const lookupRes = await fetch(
        `/api/service/dashboard-rcm/palliative-care/registry/lookup-hn?hn=${encodeURIComponent(targetHn)}`
      )
      const lookupJson = await lookupRes.json()

      if (!lookupRes.ok || !lookupJson.success || !lookupJson.data) {
        setPopupNotice({
          type: 'warning',
          title: 'แจ้งเตือน',
          message: lookupJson.error || 'ไม่พบข้อมูลผู้ป่วยในระบบ HOSxP',
        })
        return
      }

      const lookupData = lookupJson.data

      // Check LTC status from lookup
      if (lookupData.isLtc) {
        setPopupNotice({
          type: 'warning',
          title: 'ไม่สามารถลงทะเบียนได้',
          message:
            lookupData.ltcMessage ||
            'ผู้ป่วยรายนี้เป็นผู้มีทะเบียนใน LTC แล้ว ไม่สามารถลงทะเบียน Palliative Care ได้',
        })
        return
      }

      // Check if already in registry
      if (lookupData.isAlreadyInRegistry) {
        setIsRegisteredSuccess(true)
        setPopupNotice({
          type: 'warning',
          title: 'ผู้ป่วยมีในระบบแล้ว',
          message: `ผู้ป่วยรายนี้ (HN: ${lookupData.hn} - ${lookupData.patientName}) มีอยู่ในระบบทะเบียน Palliative Care แล้ว ห้ามลงข้อมูลซ้ำ`,
        })
        return
      }

      // 2. Prepare payload
      const pDx = data.diagnoses?.find((d) => d.diagtype === '1')?.icd10 || ''
      const payload = {
        hn: lookupData.hn,
        patientName: lookupData.patientName || data.header.ptname || '-',
        address: lookupData.address || '',
        phone: lookupData.phone || '',
        icd10Principal: lookupData.icd10Principal || pDx || '',
        icd10Palliative: 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)',
        projectCode: '30001, Cons01',
        registrationStatus: lookupData.isRegistered ? 'ดำเนินการเรียบร้อย' : 'ยังไม่ได้ดำเนินการ',
        deathDate: lookupData.deathDate || null,
      }

      // 3. POST to save into registry
      const saveRes = await fetch('/api/service/dashboard-rcm/palliative-care/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saveJson = await saveRes.json()

      if (!saveRes.ok || !saveJson.success) {
        setPopupNotice({
          type: 'error',
          title: 'ไม่สามารถลงทะเบียนได้',
          message: saveJson.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลงทะเบียน',
        })
        return
      }

      setIsRegisteredSuccess(true)
      setPopupNotice({
        type: 'success',
        title: 'ลงทะเบียนสำเร็จ',
        message: `เพิ่มข้อมูลผู้ป่วย ${payload.patientName} (HN: ${payload.hn}) เข้าสู่ระบบทะเบียน Palliative Care เรียบร้อยแล้ว`,
      })
    } catch (err: unknown) {
      setPopupNotice({
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: (err as Error)?.message || 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง',
      })
    } finally {
      setIsRegistering(false)
    }
  }

  if (!vn) return null

  const header = data?.header
  const registerDisabled =
    !header?.hn || isRegistering || isRegisteredSuccess || Boolean(header?.isLtc)

  const registerLabel = isRegistering
    ? 'กำลังลงทะเบียน...'
    : isRegisteredSuccess
      ? 'ลงทะเบียนแล้ว'
      : header?.isLtc
        ? 'มีทะเบียนใน LTC'
        : 'เพิ่มลงทะเบียน'

  return (
    <div
      className="vn-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vn-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="vn-modal-container" ref={containerRef} tabIndex={-1}>
        {/* ── 1. Patient Banner ───────────────────────────────────────── */}
        <header className="vn-modal-header">
          <div className="vn-modal-header-top">
            <div className="vn-modal-patient-info">
              <div className="vn-modal-patient-title">
                <span className="vn-badge-vn">VN: {vn}</span>
                <h3 className="vn-modal-patient-name" id="vn-modal-title">
                  {header?.ptname || 'กำลังโหลดข้อมูลผู้ป่วย...'}
                </h3>
                {header && (
                  <span className="vn-modal-patient-demo">
                    {header.sex} · อายุ {header.age} ปี
                  </span>
                )}
                {header?.isLtc && <span className="vn-badge is-warn">มีทะเบียน LTC</span>}
              </div>

              {header && (
                <dl className="vn-modal-meta-row">
                  <div className="vn-modal-meta-item">
                    <dt className="vn-modal-meta-label">HN</dt>
                    <dd className="vn-modal-meta-val vn-mono">{header.hn}</dd>
                  </div>
                  <div className="vn-modal-meta-item">
                    <dt className="vn-modal-meta-label">CID</dt>
                    <dd className="vn-modal-meta-val vn-mono">{header.cid || '-'}</dd>
                  </div>
                  <div className="vn-modal-meta-item">
                    <dt className="vn-modal-meta-label">วันที่รับบริการ</dt>
                    <dd className="vn-modal-meta-val">
                      {formatThaiDate(header.vstdate)}
                      {header.vsttime ? ` ${header.vsttime.slice(0, 5)} น.` : ''}
                    </dd>
                  </div>
                  <div className="vn-modal-meta-item">
                    <dt className="vn-modal-meta-label">สิทธิ</dt>
                    <dd className="vn-modal-meta-val">{header.pttypename || '-'}</dd>
                  </div>
                  <div className="vn-modal-meta-item">
                    <dt className="vn-modal-meta-label">แผนก</dt>
                    <dd className="vn-modal-meta-val">
                      {header.clinic || '-'}
                      {header.department ? ` (${header.department})` : ''}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <button
              type="button"
              className="vn-modal-close-btn"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              title="ปิด (Esc)"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* ── 2. Tabs ─────────────────────────────────────────────────── */}
        <div className="vn-modal-tabs" role="group" aria-label="แท็บรายละเอียดคลินิก">
          <button
            type="button"
            className={`vn-modal-tab-btn ${activeTab === 'screen' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('screen')}
            aria-pressed={activeTab === 'screen'}
          >
            <Stethoscope size={16} className="vn-modal-tab-icon" aria-hidden="true" />
            <span>ซักประวัติและสัญญาณชีพ</span>
          </button>
          <button
            type="button"
            className={`vn-modal-tab-btn ${activeTab === 'diag' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('diag')}
            aria-pressed={activeTab === 'diag'}
          >
            <ClipboardList size={16} className="vn-modal-tab-icon" aria-hidden="true" />
            <span>การวินิจฉัยโรค</span>
            {data?.diagnoses && <span className="vn-modal-tab-pill">{data.diagnoses.length}</span>}
          </button>
          <button
            type="button"
            className={`vn-modal-tab-btn ${activeTab === 'orders' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('orders')}
            aria-pressed={activeTab === 'orders'}
          >
            <Pill size={16} className="vn-modal-tab-icon" aria-hidden="true" />
            <span>รายการยาและค่ารักษา</span>
            {data?.orders && (
              <span className="vn-modal-tab-pill">{data.orders.items.length}</span>
            )}
          </button>
        </div>

        {/* ── 3. Body ─────────────────────────────────────────────────── */}
        <div className="vn-modal-body">
          {loading ? (
            <div className="vn-modal-loading" role="status" aria-live="polite">
              <div className="vn-modal-spinner" aria-hidden="true" />
              <p className="vn-state-text">
                กำลังดึงข้อมูลการรับบริการ VN: {vn} จากฐานข้อมูล HOSxP...
              </p>
            </div>
          ) : error ? (
            <div className="vn-modal-error" role="alert">
              <CircleAlert size={32} className="vn-state-icon" aria-hidden="true" />
              <p className="vn-state-title">โหลดข้อมูลการรับบริการไม่สำเร็จ</p>
              <p className="vn-state-text">{error}</p>
              <button type="button" className="vn-btn-secondary" onClick={() => loadDetails()}>
                ลองอีกครั้ง
              </button>
            </div>
          ) : !data ? (
            <div className="vn-modal-loading">
              <p className="vn-state-text">ไม่พบข้อมูลการรับบริการของ VN นี้</p>
            </div>
          ) : (
            <>
              {/* TAB 1: opdscreen */}
              {activeTab === 'screen' && (
                <div className="vn-tab-panel">
                  <section className="vn-section">
                    <h4 className="vn-section-title">สัญญาณชีพและคัดกรองกายภาพ</h4>
                    <div className="vn-vitals-grid">
                      {buildVitalItems(data.screen).map((vital) => (
                        <div className="vn-vital-card" key={vital.key}>
                          <span className="vn-vital-label">{vital.label}</span>
                          <span className="vn-vital-value">
                            {vital.value}
                            <span className="vn-vital-unit">{vital.unit}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="vn-section">
                    <h4 className="vn-section-title">บันทึกทางคลินิก</h4>
                    <div className="vn-notes-grid">
                      {NOTE_SECTIONS.map((note) => {
                        const noteText = data.screen?.[note.key]
                        return (
                          <article className="vn-clinical-notes-card" key={note.key}>
                            <h5 className="vn-note-title">{note.title}</h5>
                            <p className={`vn-note-content ${noteText ? '' : 'is-empty'}`}>
                              {noteText || note.emptyText}
                            </p>
                          </article>
                        )
                      })}
                    </div>
                  </section>

                  {data.screen?.screen_dep_name && (
                    <p className="vn-screen-dep">
                      จุดคัดกรอง: <strong>{data.screen.screen_dep_name}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* TAB 2: ovstdiag */}
              {activeTab === 'diag' && (
                <div className="vn-tab-panel">
                  <div className="vn-table-wrap">
                    <table className="vn-diag-table" aria-label="รายการวินิจฉัยของ visit นี้">
                      <thead>
                        <tr>
                          <th className="col-center" style={{ width: 56 }}>
                            ลำดับ
                          </th>
                          <th className="col-center" style={{ width: 130 }}>
                            รหัสโรค (ICD-10)
                          </th>
                          <th className="col-left">ชื่อการวินิจฉัย</th>
                          <th className="col-left" style={{ width: 320 }}>
                            ประเภทการวินิจฉัย
                          </th>
                          <th className="col-left" style={{ width: 190 }}>
                            แพทย์ผู้วินิจฉัย
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.diagnoses.length === 0 ? (
                          <tr>
                            <td colSpan={5}>
                              <div className="vn-table-empty">
                                ไม่พบข้อมูลการวินิจฉัยใน visit นี้
                              </div>
                            </td>
                          </tr>
                        ) : (
                          data.diagnoses.map((diag, idx) => (
                            <tr key={`${diag.icd10}-${idx}`}>
                              <td className="col-center vn-cell-muted">{idx + 1}</td>
                              <td className="col-center">
                                <span
                                  className={`vn-icd-badge ${
                                    diag.diagtype === '1' ? 'vn-icd-pdx' : ''
                                  }`}
                                >
                                  {diag.icd10}
                                </span>
                              </td>
                              <td className="col-left">{diag.icd_name}</td>
                              <td className="col-left">
                                <span
                                  className={`vn-diagtype ${
                                    diag.diagtype === '1' ? 'is-primary' : ''
                                  }`}
                                >
                                  {diag.diagtype_name}
                                </span>
                              </td>
                              <td className="col-left vn-cell-muted">{diag.doctor_name || '-'}</td>
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
                <div className="vn-tab-panel">
                  <div className="vn-financial-bar">
                    <div className="vn-fin-stat">
                      <span className="vn-fin-stat-label">ยอดรวมค่าบริการทั้งหมด</span>
                      <span className="vn-fin-stat-value">{`${formatMoney(data.orders.total_price)} ฿`}</span>
                      <span className="vn-fin-stat-sub">
                        {data.orders.items.length} รายการ · {data.orders.total_items} หน่วย
                      </span>
                    </div>

                    <div className="vn-fin-stat">
                      <span className="vn-fin-stat-label">ลูกหนี้สิทธิเบิกได้</span>
                      <span className="vn-fin-stat-value">{`${formatMoney(data.orders.total_claim)} ฿`}</span>
                      <span className="vn-fin-stat-sub">
                        {((data.orders.total_claim / (data.orders.total_price || 1)) * 100).toFixed(
                          1
                        )}
                        % ของยอดรวม
                      </span>
                    </div>

                    <div className="vn-fin-stat">
                      <span className="vn-fin-stat-label">ชำระเงินเอง</span>
                      <span className="vn-fin-stat-value">{`${formatMoney(data.orders.total_paid)} ฿`}</span>
                      <span className="vn-fin-stat-sub">เงินสด / ชำระเองเบิกได้</span>
                    </div>
                  </div>

                  <div className="vn-category-pills" role="group" aria-label="กรองตามหมวดรายการ">
                    <button
                      type="button"
                      className={`vn-cat-pill-btn ${selectedCategory === 'ALL' ? 'is-active' : ''}`}
                      onClick={() => setSelectedCategory('ALL')}
                      aria-pressed={selectedCategory === 'ALL'}
                    >
                      ทั้งหมด
                      <span className="vn-cat-pill-count">{data.orders.items.length}</span>
                    </button>

                    {data.orders.categories.map((category) => (
                      <button
                        key={category.category_group}
                        type="button"
                        className={`vn-cat-pill-btn ${
                          selectedCategory === category.category_group ? 'is-active' : ''
                        }`}
                        onClick={() => setSelectedCategory(category.category_group)}
                        aria-pressed={selectedCategory === category.category_group}
                      >
                        {category.title}
                        <span className="vn-cat-pill-count">{category.item_count}</span>
                      </button>
                    ))}
                  </div>

                  <div className="vn-table-wrap">
                    <table className="vn-order-table" aria-label="รายการยาและค่ารักษาของ visit นี้">
                      <thead>
                        <tr>
                          <th className="col-center" style={{ width: 56 }}>
                            ลำดับ
                          </th>
                          <th className="col-center" style={{ width: 100 }}>
                            รหัส
                          </th>
                          <th className="col-left" style={{ minWidth: 220 }}>
                            รายการยา / เวชภัณฑ์ / บริการ
                          </th>
                          <th className="col-left" style={{ minWidth: 210 }}>
                            วิธีใช้ / คำแนะนำ
                          </th>
                          <th className="col-left" style={{ width: 170 }}>
                            หมวดรายได้
                          </th>
                          <th className="col-center" style={{ width: 72 }}>
                            จำนวน
                          </th>
                          <th className="col-right" style={{ width: 110 }}>
                            ราคา/หน่วย
                          </th>
                          <th className="col-right" style={{ width: 120 }}>
                            รวมเงิน (บาท)
                          </th>
                          <th className="col-center" style={{ width: 120 }}>
                            การชำระ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={9}>
                              <div className="vn-table-empty">ไม่พบรายการในหมวดนี้</div>
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map((order, idx) => (
                            <tr key={`${order.icode}-${idx}`}>
                              <td className="col-center vn-cell-muted">{idx + 1}</td>
                              <td className="col-center vn-mono vn-cell-muted">{order.icode}</td>
                              <td className="col-left">
                                <span className="vn-cell-title">{order.item_name}</span>
                                {(order.strength || order.units) && (
                                  <span className="vn-cell-sub">
                                    {[order.strength, order.units].filter(Boolean).join(' · ')}
                                  </span>
                                )}
                              </td>
                              <td className="col-left">
                                <span
                                  className={`vn-cell-usage ${order.drugusage_text ? '' : 'is-empty'}`}
                                >
                                  {order.drugusage_text || '-'}
                                </span>
                              </td>
                              <td className="col-left vn-cell-muted">
                                {order.income_name || order.income_code || '-'}
                              </td>
                              <td className="col-center vn-mono">{order.qty}</td>
                              <td className="col-right vn-cell-money">
                                {formatMoney(order.unitprice)}
                              </td>
                              <td className="col-right vn-cell-money is-strong">
                                {formatMoney(order.sum_price)}
                              </td>
                              <td className="col-center">
                                <span
                                  className={`vn-badge ${getPaidstTone(order.paidst)}`}
                                  title={`รหัส paidst: ${order.paidst}`}
                                >
                                  {order.paidst_name || order.paidst || '-'}
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

        {/* ── 4. Footer ───────────────────────────────────────────────── */}
        <footer className="vn-modal-footer">
          <button
            type="button"
            className={`vn-btn-register ${isRegisteredSuccess ? 'is-success' : ''}`}
            onClick={handleDirectRegister}
            disabled={registerDisabled}
            title={
              header?.isLtc
                ? 'ผู้ป่วยรายนี้มีรายชื่อในทะเบียน Long Term Care (LTC) แล้ว ไม่สามารถลงทะเบียน Palliative Care ได้'
                : isRegisteredSuccess
                  ? 'ลงทะเบียนผู้ป่วยรายนี้เรียบร้อยแล้ว'
                  : header?.hn
                    ? `บันทึก HN: ${header.hn} เข้าสู่ทะเบียน Palliative Care`
                    : 'กำลังโหลดข้อมูล...'
            }
          >
            {isRegisteredSuccess ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <UserPlus size={16} aria-hidden="true" />
            )}
            <span>{registerLabel}</span>
          </button>
          <button type="button" className="vn-btn-close" onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </footer>

        {/* ── 5. Registration Alert Dialog ────────────────────────────── */}
        {popupNotice && (
          <div
            className="vn-popup-backdrop"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="vn-popup-title"
            aria-describedby="vn-popup-message"
          >
            <div className="vn-popup-card">
              <span className={`vn-popup-icon vn-popup-icon-${popupNotice.type}`}>
                {popupNotice.type === 'success' ? (
                  <Check size={22} aria-hidden="true" />
                ) : popupNotice.type === 'warning' ? (
                  <Info size={22} aria-hidden="true" />
                ) : (
                  <X size={22} aria-hidden="true" />
                )}
              </span>
              <h3 className="vn-popup-title" id="vn-popup-title">
                {popupNotice.title}
              </h3>
              <p className="vn-popup-message" id="vn-popup-message">
                {popupNotice.message}
              </p>
              <div className="vn-popup-actions">
                <button
                  type="button"
                  className="vn-popup-btn"
                  onClick={() => setPopupNotice(null)}
                  autoFocus
                >
                  ตกลง
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
