'use client'

import React, { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { computeBmi } from '@/lib/clinical/dmRemissionDomain'
import {
  DM_A1C_OUTCOMES,
  DM_DEFAULT_REMISSION_STATUS,
  DM_MEDS_OUTCOMES,
  DM_WAIST_OUTCOMES,
  DM_WEIGHT_OUTCOMES,
  type DmOptionCategory,
  type DmRemissionCohortRecord,
  type DmRemissionCreateInput,
  type DmRemissionOptionRecord,
} from '@/lib/clinical/dmRemissionTypes'

interface DmRemissionFormModalProps {
  isOpen: boolean
  editingRecord: DmRemissionCohortRecord | null
  defaultFiscalYear: number
  availableFiscalYears: number[]
  availablePcus: string[]
  options: Record<DmOptionCategory, DmRemissionOptionRecord[]>
  onClose: () => void
  onSaved: () => Promise<void> | void
}

interface FormState {
  fiscalYear: string
  pcuName: string
  hn: string
  cid: string
  patientName: string
  age: string
  underlyingDiseases: string
  heightCm: string
  weightBeforeKg: string
  weightAfterKg: string
  waistBeforeCm: string
  waistAfterCm: string
  fpgBefore: string
  fpgAfter: string
  a1cBefore: string
  a1cAfter: string
  a1cPostStop3m: string
  medsBefore: string
  medsAfter: string
  summaryA1c: string
  summaryMeds: string
  summaryWeight: string
  summaryWaist: string
  summaryDiet: string
  summaryExercise: string
  summaryIf: string
  summaryRemission: string
}

function toStr(val: string | number | null | undefined): string {
  return val === null || val === undefined ? '' : String(val)
}

function toOptNum(val: string): number | null {
  const trimmed = val.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

function buildInitialState(
  editingRecord: DmRemissionCohortRecord | null,
  defaultFiscalYear: number
): FormState {
  if (!editingRecord) {
    return {
      fiscalYear: String(defaultFiscalYear),
      pcuName: '',
      hn: '',
      cid: '',
      patientName: '',
      age: '',
      underlyingDiseases: '',
      heightCm: '',
      weightBeforeKg: '',
      weightAfterKg: '',
      waistBeforeCm: '',
      waistAfterCm: '',
      fpgBefore: '',
      fpgAfter: '',
      a1cBefore: '',
      a1cAfter: '',
      a1cPostStop3m: '',
      medsBefore: '',
      medsAfter: '',
      summaryA1c: '',
      summaryMeds: '',
      summaryWeight: '',
      summaryWaist: '',
      summaryDiet: '',
      summaryExercise: '',
      summaryIf: '',
      summaryRemission: DM_DEFAULT_REMISSION_STATUS,
    }
  }

  return {
    fiscalYear: String(editingRecord.fiscalYear),
    pcuName: toStr(editingRecord.pcuName),
    hn: toStr(editingRecord.hn),
    cid: toStr(editingRecord.cid),
    patientName: toStr(editingRecord.patientName),
    age: toStr(editingRecord.age),
    underlyingDiseases: toStr(editingRecord.underlyingDiseases),
    heightCm: toStr(editingRecord.heightCm),
    weightBeforeKg: toStr(editingRecord.weightBeforeKg),
    weightAfterKg: toStr(editingRecord.weightAfterKg),
    waistBeforeCm: toStr(editingRecord.waistBeforeCm),
    waistAfterCm: toStr(editingRecord.waistAfterCm),
    fpgBefore: toStr(editingRecord.fpgBefore),
    fpgAfter: toStr(editingRecord.fpgAfter),
    a1cBefore: toStr(editingRecord.a1cBefore),
    a1cAfter: toStr(editingRecord.a1cAfter),
    a1cPostStop3m: toStr(editingRecord.a1cPostStop3m),
    medsBefore: toStr(editingRecord.medsBefore),
    medsAfter: toStr(editingRecord.medsAfter),
    summaryA1c: toStr(editingRecord.summaryA1c),
    summaryMeds: toStr(editingRecord.summaryMeds),
    summaryWeight: toStr(editingRecord.summaryWeight),
    summaryWaist: toStr(editingRecord.summaryWaist),
    summaryDiet: toStr(editingRecord.summaryDiet),
    summaryExercise: toStr(editingRecord.summaryExercise),
    summaryIf: toStr(editingRecord.summaryIf),
    summaryRemission: toStr(editingRecord.summaryRemission),
  }
}

export default function DmRemissionFormModal({
  isOpen,
  editingRecord,
  defaultFiscalYear,
  availableFiscalYears,
  availablePcus,
  options,
  onClose,
  onSaved,
}: DmRemissionFormModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(editingRecord, defaultFiscalYear)
  )
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupNotice, setLookupNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialState(editingRecord, defaultFiscalYear))
      setLookupNotice(null)
      setError(null)
    }
  }, [isOpen, editingRecord, defaultFiscalYear])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, submitting, onClose])

  if (!isOpen) return null

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const bmiBefore = computeBmi(toOptNum(form.weightBeforeKg), toOptNum(form.heightCm))
  const bmiAfter = computeBmi(toOptNum(form.weightAfterKg), toOptNum(form.heightCm))

  const activeOptions = (cat: DmOptionCategory, currentVal: string) => {
    const list = (options[cat] || []).filter((o) => o.isActive).map((o) => o.label)
    if (currentVal && !list.includes(currentVal)) {
      return [currentVal, ...list]
    }
    return list
  }

  const presetWithCurrent = (presets: readonly string[], currentVal: string) => {
    if (currentVal && !presets.includes(currentVal)) {
      return [currentVal, ...presets]
    }
    return presets
  }

  const pcuSuggestions = Array.from(
    new Set([
      ...(options.pcu || []).filter((o) => o.isActive).map((o) => o.label),
      ...availablePcus,
    ])
  ).sort((a, b) => a.localeCompare(b, 'th'))

  const handleLookupHn = async () => {
    const cleanHn = form.hn.trim()
    if (!cleanHn) {
      setLookupNotice('กรุณากรอก HN ก่อนค้นหา')
      return
    }

    setLookingUp(true)
    setLookupNotice(null)
    setError(null)
    try {
      const res = await fetch(
        `/api/service/dm-remission/lookup-hn?hn=${encodeURIComponent(cleanHn)}`
      )
      const json = await res.json()
      if (res.status === 404) {
        setLookupNotice('ไม่พบ HN นี้ใน HOSxP สามารถกรอกข้อมูลผู้ป่วยเองได้')
        return
      }
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'ไม่สามารถค้นหาข้อมูลจาก HOSxP ได้')
      }
      setForm((prev) => ({
        ...prev,
        hn: json.data.hn || prev.hn,
        patientName: json.data.patientName || prev.patientName,
        cid: json.data.cid ?? prev.cid,
        age:
          json.data.age !== null && json.data.age !== undefined
            ? String(json.data.age)
            : prev.age,
      }))
      setLookupNotice('ดึงข้อมูลพื้นฐานจาก HOSxP เรียบร้อยแล้ว')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการค้นหา HN')
    } finally {
      setLookingUp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.patientName.trim()) {
      setError('กรุณาระบุชื่อ-นามสกุลผู้ป่วย')
      return
    }

    const payload: DmRemissionCreateInput = {
      fiscalYear: Number(form.fiscalYear) || defaultFiscalYear,
      pcuName: form.pcuName.trim() || null,
      patientName: form.patientName.trim(),
      cid: form.cid.trim() || null,
      hn: form.hn.trim() || null,
      age: toOptNum(form.age),
      underlyingDiseases: form.underlyingDiseases.trim() || null,
      heightCm: toOptNum(form.heightCm),
      weightBeforeKg: toOptNum(form.weightBeforeKg),
      weightAfterKg: toOptNum(form.weightAfterKg),
      waistBeforeCm: toOptNum(form.waistBeforeCm),
      waistAfterCm: toOptNum(form.waistAfterCm),
      fpgBefore: toOptNum(form.fpgBefore),
      fpgAfter: toOptNum(form.fpgAfter),
      a1cBefore: toOptNum(form.a1cBefore),
      a1cAfter: toOptNum(form.a1cAfter),
      a1cPostStop3m: toOptNum(form.a1cPostStop3m),
      medsBefore: form.medsBefore.trim() || null,
      medsAfter: form.medsAfter.trim() || null,
      summaryA1c: (form.summaryA1c || null) as DmRemissionCreateInput['summaryA1c'],
      summaryMeds: (form.summaryMeds || null) as DmRemissionCreateInput['summaryMeds'],
      summaryWeight: (form.summaryWeight || null) as DmRemissionCreateInput['summaryWeight'],
      summaryWaist: (form.summaryWaist || null) as DmRemissionCreateInput['summaryWaist'],
      summaryDiet: form.summaryDiet || null,
      summaryExercise: form.summaryExercise || null,
      summaryIf: form.summaryIf || null,
      summaryRemission: form.summaryRemission || null,
    }

    setSubmitting(true)
    setError(null)
    try {
      const url = editingRecord
        ? `/api/service/dm-remission/${editingRecord.id}`
        : '/api/service/dm-remission'
      const method = editingRecord ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'บันทึกข้อมูลไม่สำเร็จ')
      }
      await onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dmrModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="dmr-form-title">
      <div className="dmrModal">
        <div className="dmrModalHeader">
          <h2 id="dmr-form-title" className="dmrModalTitle">
            {editingRecord ? 'แก้ไขข้อมูลผู้ป่วย DM Remission' : 'เพิ่มผู้ป่วยเข้าโครงการ DM Remission'}
          </h2>
          <button type="button" className="dmrBtn dmrBtnSm" onClick={onClose} aria-label="ปิดฟอร์ม">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dmrFormContents">
          <div className="dmrModalBody">
            {error && <div className="dmrAlert dmrAlertError">{error}</div>}
            {lookupNotice && <div className="dmrAlert dmrAlertInfo">{lookupNotice}</div>}

            <div className="dmrSectionBox">
              <h3 className="dmrSectionTitle">ข้อมูลพื้นฐานและหน่วยบริการ</h3>
              <div className="dmrFormGrid">
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-fy">ปีงบประมาณ (พ.ศ.)</label>
                  <select
                    id="dmr-fy"
                    className="dmrSelect"
                    value={form.fiscalYear}
                    onChange={(e) => setField('fiscalYear', e.target.value)}
                    disabled={Boolean(editingRecord)}
                  >
                    {availableFiscalYears.map((fy) => (
                      <option key={fy} value={String(fy)}>
                        {fy}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-pcu">รพ.สต.</label>
                  <input
                    id="dmr-pcu"
                    type="text"
                    list="dmr-pcu-datalist"
                    className="dmrInput"
                    value={form.pcuName}
                    onChange={(e) => setField('pcuName', e.target.value)}
                    placeholder="เลือกหรือพิมพ์ชื่อ รพ.สต."
                  />
                  <datalist id="dmr-pcu-datalist">
                    {pcuSuggestions.map((pcu) => (
                      <option key={pcu} value={pcu} />
                    ))}
                  </datalist>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-hn">HN รพ. (ค้นหา HOSxP)</label>
                  <div className="dmrHnRow">
                    <input
                      id="dmr-hn"
                      type="text"
                      className="dmrInput"
                      value={form.hn}
                      onChange={(e) => setField('hn', e.target.value)}
                      placeholder="เช่น 0012345"
                    />
                    <button
                      type="button"
                      className="dmrBtn"
                      onClick={handleLookupHn}
                      disabled={lookingUp}
                    >
                      <Search size={15} />
                      {lookingUp ? 'กำลังค้น...' : 'ดึงข้อมูล'}
                    </button>
                  </div>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-name">ชื่อ-นามสกุล *</label>
                  <input
                    id="dmr-name"
                    type="text"
                    className="dmrInput"
                    value={form.patientName}
                    onChange={(e) => setField('patientName', e.target.value)}
                    required
                  />
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-cid">เลขบัตรประชาชน</label>
                  <input
                    id="dmr-cid"
                    type="text"
                    className="dmrInput"
                    value={form.cid}
                    onChange={(e) => setField('cid', e.target.value)}
                    placeholder="13 หลัก"
                  />
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-age">อายุ (ปี)</label>
                  <input
                    id="dmr-age"
                    type="number"
                    min={0}
                    max={150}
                    className="dmrInput"
                    value={form.age}
                    onChange={(e) => setField('age', e.target.value)}
                  />
                </div>
              </div>

              <div className="dmrField dmrFieldSpaced">
                <label className="dmrFieldLabel" htmlFor="dmr-ud">U/D อื่น เช่น HT DLP CKD</label>
                <input
                  id="dmr-ud"
                  type="text"
                  className="dmrInput"
                  value={form.underlyingDiseases}
                  onChange={(e) => setField('underlyingDiseases', e.target.value)}
                  placeholder="เช่น HT, DLP, CKD stage 3"
                />
              </div>
            </div>

            <div className="dmrSectionBox">
              <h3 className="dmrSectionTitle">สัดส่วนร่างกายและผลตรวจทางห้องปฏิบัติการ</h3>
              <div className="dmrFormGrid">
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-height">ส่วนสูง (cm)</label>
                  <input
                    id="dmr-height"
                    type="number"
                    step="0.1"
                    className="dmrInput"
                    value={form.heightCm}
                    onChange={(e) => setField('heightCm', e.target.value)}
                  />
                </div>
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-wb">น้ำหนัก ก่อน (kg)</label>
                  <input
                    id="dmr-wb"
                    type="number"
                    step="0.1"
                    className="dmrInput"
                    value={form.weightBeforeKg}
                    onChange={(e) => setField('weightBeforeKg', e.target.value)}
                  />
                </div>
                <div className="dmrField">
                  <span className="dmrFieldLabel">BMI ก่อน (auto)</span>
                  <div className="dmrReadonlyBox">{bmiBefore !== null ? bmiBefore.toFixed(2) : '-'}</div>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-wa">น้ำหนัก หลัง (kg)</label>
                  <input
                    id="dmr-wa"
                    type="number"
                    step="0.1"
                    className="dmrInput"
                    value={form.weightAfterKg}
                    onChange={(e) => setField('weightAfterKg', e.target.value)}
                  />
                </div>
                <div className="dmrField">
                  <span className="dmrFieldLabel">BMI หลัง (auto)</span>
                  <div className="dmrReadonlyBox">{bmiAfter !== null ? bmiAfter.toFixed(2) : '-'}</div>
                </div>
                <div />

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-waistb">รอบเอว ก่อน (cm)</label>
                  <input
                    id="dmr-waistb"
                    type="number"
                    step="0.1"
                    className="dmrInput"
                    value={form.waistBeforeCm}
                    onChange={(e) => setField('waistBeforeCm', e.target.value)}
                  />
                </div>
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-waista">รอบเอว หลัง (cm)</label>
                  <input
                    id="dmr-waista"
                    type="number"
                    step="0.1"
                    className="dmrInput"
                    value={form.waistAfterCm}
                    onChange={(e) => setField('waistAfterCm', e.target.value)}
                  />
                </div>
                <div />

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-fpgb">FPG ก่อน</label>
                  <input
                    id="dmr-fpgb"
                    type="number"
                    step="0.1"
                    className="dmrInput"
                    value={form.fpgBefore}
                    onChange={(e) => setField('fpgBefore', e.target.value)}
                  />
                </div>
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-fpga">FPG หลัง</label>
                  <input
                    id="dmr-fpga"
                    type="number"
                    step="0.1"
                    className="dmrInput"
                    value={form.fpgAfter}
                    onChange={(e) => setField('fpgAfter', e.target.value)}
                  />
                </div>
                <div />

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-a1cb">A1c ก่อน</label>
                  <input
                    id="dmr-a1cb"
                    type="number"
                    step="0.01"
                    className="dmrInput"
                    value={form.a1cBefore}
                    onChange={(e) => setField('a1cBefore', e.target.value)}
                  />
                </div>
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-a1ca">A1c หลัง</label>
                  <input
                    id="dmr-a1ca"
                    type="number"
                    step="0.01"
                    className="dmrInput"
                    value={form.a1cAfter}
                    onChange={(e) => setField('a1cAfter', e.target.value)}
                  />
                </div>
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-a1c3m">A1c หลังหยุดยา 3 เดือน</label>
                  <input
                    id="dmr-a1c3m"
                    type="number"
                    step="0.01"
                    className="dmrInput"
                    value={form.a1cPostStop3m}
                    onChange={(e) => setField('a1cPostStop3m', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="dmrSectionBox">
              <h3 className="dmrSectionTitle">รายการยาเบาหวาน (ชื่อยา, dose)</h3>
              <div className="dmrFormGrid2">
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-medsb">ยา ก่อน (ชื่อยา, dose)</label>
                  <textarea
                    id="dmr-medsb"
                    className="dmrTextarea"
                    value={form.medsBefore}
                    onChange={(e) => setField('medsBefore', e.target.value)}
                    placeholder="เช่น Metformin 500mg 1x2 pc"
                  />
                </div>
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-medsa">ยา หลัง (ชื่อยา, dose)</label>
                  <textarea
                    id="dmr-medsa"
                    className="dmrTextarea"
                    value={form.medsAfter}
                    onChange={(e) => setField('medsAfter', e.target.value)}
                    placeholder="เช่น Off medication"
                  />
                </div>
              </div>
            </div>

            <div className="dmrSectionBox">
              <h3 className="dmrSectionTitle">สรุปผลลัพธ์และ Remission</h3>
              <div className="dmrFormGrid">
                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-sa1c">สรุป A1c</label>
                  <select
                    id="dmr-sa1c"
                    className="dmrSelect"
                    value={form.summaryA1c}
                    onChange={(e) => setField('summaryA1c', e.target.value)}
                  >
                    <option value="">-- เลือก --</option>
                    {presetWithCurrent(DM_A1C_OUTCOMES, form.summaryA1c).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-smeds">สรุป ยาเบาหวาน</label>
                  <select
                    id="dmr-smeds"
                    className="dmrSelect"
                    value={form.summaryMeds}
                    onChange={(e) => setField('summaryMeds', e.target.value)}
                  >
                    <option value="">-- เลือก --</option>
                    {presetWithCurrent(DM_MEDS_OUTCOMES, form.summaryMeds).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-sweight">สรุป น้ำหนัก</label>
                  <select
                    id="dmr-sweight"
                    className="dmrSelect"
                    value={form.summaryWeight}
                    onChange={(e) => setField('summaryWeight', e.target.value)}
                  >
                    <option value="">-- เลือก --</option>
                    {presetWithCurrent(DM_WEIGHT_OUTCOMES, form.summaryWeight).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-swaist">สรุป รอบเอว</label>
                  <select
                    id="dmr-swaist"
                    className="dmrSelect"
                    value={form.summaryWaist}
                    onChange={(e) => setField('summaryWaist', e.target.value)}
                  >
                    <option value="">-- เลือก --</option>
                    {presetWithCurrent(DM_WAIST_OUTCOMES, form.summaryWaist).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-sdiet">สรุป การปรับอาหาร</label>
                  <select
                    id="dmr-sdiet"
                    className="dmrSelect"
                    value={form.summaryDiet}
                    onChange={(e) => setField('summaryDiet', e.target.value)}
                  >
                    <option value="">-- เลือก --</option>
                    {activeOptions('diet', form.summaryDiet).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-sexercise">สรุป การออกกำลังกาย</label>
                  <select
                    id="dmr-sexercise"
                    className="dmrSelect"
                    value={form.summaryExercise}
                    onChange={(e) => setField('summaryExercise', e.target.value)}
                  >
                    <option value="">-- เลือก --</option>
                    {activeOptions('exercise', form.summaryExercise).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-sif">สรุป IF</label>
                  <select
                    id="dmr-sif"
                    className="dmrSelect"
                    value={form.summaryIf}
                    onChange={(e) => setField('summaryIf', e.target.value)}
                  >
                    <option value="">-- เลือก --</option>
                    {activeOptions('if_fasting', form.summaryIf).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="dmrField">
                  <label className="dmrFieldLabel" htmlFor="dmr-srem">สรุป Remission</label>
                  <select
                    id="dmr-srem"
                    className="dmrSelect"
                    value={form.summaryRemission}
                    onChange={(e) => setField('summaryRemission', e.target.value)}
                  >
                    <option value="">-- เลือก --</option>
                    {activeOptions('remission', form.summaryRemission).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="dmrModalFooter">
            <button type="button" className="dmrBtn" onClick={onClose} disabled={submitting}>
              ยกเลิก
            </button>
            <button type="submit" className="dmrBtn dmrBtnPrimary" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : editingRecord ? 'บันทึกการแก้ไข' : 'เพิ่มข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
