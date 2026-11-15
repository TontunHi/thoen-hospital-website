'use client'

import React, { useState, useEffect } from 'react'
import { Copy, X } from 'lucide-react'

interface DmRemissionCarryoverModalProps {
  isOpen: boolean
  targetFiscalYear: number
  availableFiscalYears: number[]
  onClose: () => void
  onCompleted: (message: string) => Promise<void> | void
}

export default function DmRemissionCarryoverModal({
  isOpen,
  targetFiscalYear,
  availableFiscalYears,
  onClose,
  onCompleted,
}: DmRemissionCarryoverModalProps) {
  const candidateSources = availableFiscalYears.filter((y) => y < targetFiscalYear)
  const [fromFiscalYear, setFromFiscalYear] = useState<number>(
    candidateSources.includes(targetFiscalYear - 1)
      ? targetFiscalYear - 1
      : candidateSources[0] ?? targetFiscalYear - 1
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      const next = availableFiscalYears.filter((y) => y < targetFiscalYear)
      setFromFiscalYear(
        next.includes(targetFiscalYear - 1)
          ? targetFiscalYear - 1
          : next[0] ?? targetFiscalYear - 1
      )
      setError(null)
    }
  }, [isOpen, targetFiscalYear, availableFiscalYears])

  if (!isOpen) return null

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/service/dm-remission/carryover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromFiscalYear,
          toFiscalYear: targetFiscalYear,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถคัดลอกข้อมูลข้ามปีงบประมาณได้')
      }
      const { copiedCount = 0, skippedCount = 0 } = json.data || {}
      await onCompleted(
        `คัดลอกรายชื่อค้างติดตามจากปีงบ ${fromFiscalYear} เข้าปีงบ ${targetFiscalYear} สำเร็จ (${copiedCount} ราย, ข้ามรายชื่อที่มีอยู่แล้ว ${skippedCount} ราย)`
      )
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการคัดลอกข้อมูล')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dmrModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="dmr-carry-title">
      <div className="dmrModal dmrModalSm">
        <div className="dmrModalHeader">
          <h2 id="dmr-carry-title" className="dmrModalTitle">
            คัดลอกผู้ป่วยค้างติดตามข้ามปีงบประมาณ
          </h2>
          <button type="button" className="dmrBtn dmrBtnSm" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="dmrFormContents">
          <div className="dmrModalBody">
            {error && <div className="dmrAlert dmrAlertError">{error}</div>}
            <p className="dmrCarryoverCopy">
              ระบบจะคัดลอกรายชื่อผู้ป่วยที่ยังไม่ได้สถานะ <strong>Remission</strong> จากปีงบประมาณต้นทางมาตั้งต้นในปีงบประมาณ <strong>{targetFiscalYear}</strong> โดยข้ามรายชื่อที่มี HN หรือเลขบัตรประชาชนอยู่ในปีงบปลายทางแล้ว
            </p>

            <div className="dmrField">
              <label className="dmrFieldLabel" htmlFor="dmr-carry-from">
                ปีงบประมาณต้นทาง
              </label>
              <select
                id="dmr-carry-from"
                className="dmrSelect"
                value={String(fromFiscalYear)}
                onChange={(e) => setFromFiscalYear(Number(e.target.value))}
                disabled={busy}
              >
                {candidateSources.map((fy) => (
                  <option key={fy} value={String(fy)}>
                    ปีงบประมาณ {fy}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="dmrModalFooter">
            <button type="button" className="dmrBtn" onClick={onClose} disabled={busy}>
              ยกเลิก
            </button>
            <button type="submit" className="dmrBtn dmrBtnPrimary" disabled={busy || candidateSources.length === 0}>
              <Copy size={15} />
              {busy ? 'กำลังคัดลอก...' : 'ยืนยันคัดลอก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
