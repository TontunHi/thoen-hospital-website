'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { formatThaiDate } from '@/lib/formatters'
import type { DmLabPatientTimeline, DmLabTrackingRecord } from '@/lib/clinical/dmRemissionLabTypes'

interface DmLabPatientModalProps {
  record: DmLabTrackingRecord | null
  timeline: DmLabPatientTimeline | null
  loading: boolean
  error: string | null
  onClose: () => void
}

export default function DmLabPatientModal({
  record,
  timeline,
  loading,
  error,
  onClose,
}: DmLabPatientModalProps) {
  useEffect(() => {
    if (!record) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [record, onClose])

  if (!record) return null

  return (
    <div
      className="dmltBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dmlt-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dmltDrawer">
        <div className="dmltDrawerHeader">
          <div>
            <h2 id="dmlt-drawer-title" className="dmltDrawerTitle">
              {record.patientName}
            </h2>
            <div className="dmltSubCell dmltMono">
              HN {record.hn}
              {record.cid ? ` · เลขบัตร ${record.cid}` : ''}
              {record.ageYears !== null ? ` · อายุ ${record.ageYears} ปี` : ''}
            </div>
          </div>
          <button
            type="button"
            className="dmltBtn dmltBtnGhost dmltBtnSm"
            onClick={onClose}
            aria-label="ปิดหน้าต่างรายละเอียด"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="dmltDrawerBody">
          <div className="dmltCard" style={{ boxShadow: 'none' }}>
            <div className="dmltRuleMetaRow">
              <span>
                สิทธิ์ ณ Visit ล่าสุด:{' '}
                <strong>{record.visitPttypeName || record.visitPttypeCode || 'ไม่ระบุ'}</strong>
              </span>
              <span>
                สิทธิ์ปัจจุบัน:{' '}
                <strong>{record.currentPttypeName || record.currentPttypeCode || 'ไม่ระบุ'}</strong>
              </span>
            </div>
            <div className="dmltSubCell" style={{ marginTop: '0.375rem' }}>
              ที่อยู่: {record.villageName ? `${record.villageName} ` : ''}
              {record.villageMoo ? `หมู่ ${record.villageMoo} ` : ''}
              {record.tambonName ? `ต.${record.tambonName}` : 'ไม่ระบุตำบล'}
            </div>
          </div>

          {loading && <div className="dmltEmpty">กำลังดึงประวัติ Lab, ICD-10 และยาจาก HOSxP</div>}
          {error && <div className="dmltAlert dmltAlertError">{error}</div>}

          {!loading && !error && timeline && (
            <>
              <section>
                <h3 className="dmltSectionTitle">
                  ประวัติผล Lab HbA1c / FPG (15 ครั้งล่าสุด)
                </h3>
                {timeline.labHistory.length === 0 ? (
                  <div className="dmltSubCell">ไม่พบประวัติผล Lab</div>
                ) : (
                  <table className="dmltMiniTable">
                    <thead>
                      <tr>
                        <th>วันที่เจาะ</th>
                        <th>VN</th>
                        <th>HbA1c (%)</th>
                        <th>FPG (mg/dL)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.labHistory.map((lab) => (
                        <tr key={lab.labOrderNumber}>
                          <td>{formatThaiDate(lab.orderDate)}</td>
                          <td className="dmltMono">{lab.vn || '—'}</td>
                          <td className="dmltA1cStrong">
                            {lab.a1c !== null ? lab.a1c.toFixed(2) : '—'}
                          </td>
                          <td className="dmltNum">
                            {lab.fpg !== null ? lab.fpg.toFixed(0) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section>
                <h3 className="dmltSectionTitle">
                  ประวัติการวินิจฉัย E11 (15 ครั้งล่าสุด)
                </h3>
                {timeline.e11Diagnoses.length === 0 ? (
                  <div className="dmltSubCell">ไม่พบประวัติรหัสวินิจฉัย E11</div>
                ) : (
                  <table className="dmltMiniTable">
                    <thead>
                      <tr>
                        <th>วันที่รับบริการ</th>
                        <th>VN</th>
                        <th>ICD-10</th>
                        <th>ประเภท</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.e11Diagnoses.map((diag, idx) => (
                        <tr key={`${diag.vn}-${diag.icd10}-${idx}`}>
                          <td>{formatThaiDate(diag.vstdate)}</td>
                          <td className="dmltMono">{diag.vn}</td>
                          <td className="dmltMono">{diag.icd10}</td>
                          <td className="dmltNum">{diag.diagType || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section>
                <h3 className="dmltSectionTitle">
                  ประวัติการสั่งยาเบาหวานใน HOSxP (25 รายการล่าสุด)
                </h3>
                {timeline.dmPrescriptions.length === 0 ? (
                  <div className="dmltPill dmltPillSuccess">
                    ไม่พบประวัติการสั่งยาเบาหวานในกลุ่มตรวจสอบ
                  </div>
                ) : (
                  <table className="dmltMiniTable">
                    <thead>
                      <tr>
                        <th>วันที่สั่งยา</th>
                        <th>ชื่อรายการยา</th>
                        <th>จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.dmPrescriptions.map((rx, idx) => (
                        <tr key={`${rx.vn}-${rx.icode}-${idx}`}>
                          <td>{formatThaiDate(rx.vstdate)}</td>
                          <td>{rx.drugName}</td>
                          <td className="dmltNum">{rx.qty ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
