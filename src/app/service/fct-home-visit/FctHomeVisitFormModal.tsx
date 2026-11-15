'use client'

import React, { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { suggestAdlGroup } from '@/lib/clinical/fctHomeVisitDomain'
import {
  FCT_OPTION_CATEGORY_META,
  type FctHomeVisitCreateInput,
  type FctHomeVisitOptionRecord,
  type FctHomeVisitRecord,
  type FctOptionCategory,
} from '@/lib/clinical/fctHomeVisitTypes'

interface FctHomeVisitFormModalProps {
  isOpen: boolean
  editingRecord: FctHomeVisitRecord | null
  availablePcus: string[]
  options: Record<FctOptionCategory, FctHomeVisitOptionRecord[]>
  onClose: () => void
  onSaved: () => Promise<void> | void
}

interface FormState {
  visitDate: string
  pcuName: string
  hn: string
  patientName: string
  age: string
  address: string
  adlScore: string
  adlGroup: string
  patientCategory: string
  diagnosis: string
  followUpPlan: string
  treatmentFacility: string
  visitOutcome: string
  overallRiskLevel: string
  riskLevel: string
  dentalNote: string
  pharmacyNote: string
  nutritionStatus: string
  nutritionNote: string
  ptCategory: string
  ptNote: string
  thaiMedCategory: string
  thaiMedNote: string
}

function getBangkokTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function toStr(val: string | number | null | undefined): string {
  return val === null || val === undefined ? '' : String(val)
}

function toOptInt(val: string): number | null {
  const trimmed = val.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? Math.trunc(num) : null
}

function getApiErrorMessage(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback
  const err = (json as { error?: unknown }).error
  if (typeof err === 'string' && err.trim()) return err
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return fallback
}

function buildInitialState(editingRecord: FctHomeVisitRecord | null): FormState {
  if (!editingRecord) {
    return {
      visitDate: getBangkokTodayIso(),
      pcuName: '',
      hn: '',
      patientName: '',
      age: '',
      address: '',
      adlScore: '',
      adlGroup: '',
      patientCategory: '',
      diagnosis: '',
      followUpPlan: '',
      treatmentFacility: '',
      visitOutcome: '',
      overallRiskLevel: '',
      riskLevel: '',
      dentalNote: '',
      pharmacyNote: '',
      nutritionStatus: '',
      nutritionNote: '',
      ptCategory: '',
      ptNote: '',
      thaiMedCategory: '',
      thaiMedNote: '',
    }
  }

  return {
    visitDate: editingRecord.visitDate || getBangkokTodayIso(),
    pcuName: toStr(editingRecord.pcuName),
    hn: toStr(editingRecord.hn),
    patientName: toStr(editingRecord.patientName),
    age: toStr(editingRecord.age),
    address: toStr(editingRecord.address),
    adlScore: toStr(editingRecord.adlScore),
    adlGroup: toStr(editingRecord.adlGroup),
    patientCategory: toStr(editingRecord.patientCategory),
    diagnosis: toStr(editingRecord.diagnosis),
    followUpPlan: toStr(editingRecord.followUpPlan),
    treatmentFacility: toStr(editingRecord.treatmentFacility),
    visitOutcome: toStr(editingRecord.visitOutcome),
    overallRiskLevel: toStr(editingRecord.overallRiskLevel),
    riskLevel: toStr(editingRecord.riskLevel),
    dentalNote: toStr(editingRecord.dentalNote),
    pharmacyNote: toStr(editingRecord.pharmacyNote),
    nutritionStatus: toStr(editingRecord.nutritionStatus),
    nutritionNote: toStr(editingRecord.nutritionNote),
    ptCategory: toStr(editingRecord.ptCategory),
    ptNote: toStr(editingRecord.ptNote),
    thaiMedCategory: toStr(editingRecord.thaiMedCategory),
    thaiMedNote: toStr(editingRecord.thaiMedNote),
  }
}

export default function FctHomeVisitFormModal({
  isOpen,
  editingRecord,
  availablePcus,
  options,
  onClose,
  onSaved,
}: FctHomeVisitFormModalProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(editingRecord))
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupNotice, setLookupNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialState(editingRecord))
      setLookupNotice(null)
      setError(null)
    }
  }, [isOpen, editingRecord])

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

  const handleAdlScoreChange = (rawScore: string) => {
    setForm((prev) => {
      const next: FormState = { ...prev, adlScore: rawScore }
      if (!prev.adlGroup.trim()) {
        const num = toOptInt(rawScore)
        if (num !== null && num >= 0 && num <= 20) {
          const suggested = suggestAdlGroup(num)
          if (suggested) {
            next.adlGroup = suggested
          }
        }
      }
      return next
    })
  }

  const getCategoryLabels = (
    cat: FctOptionCategory,
    currentVal: string,
    extras: string[] = []
  ): string[] => {
    const rawOpts = options[cat] || []
    const baseLabels =
      rawOpts.length > 0
        ? rawOpts.filter((o) => o.isActive).map((o) => o.label)
        : [...FCT_OPTION_CATEGORY_META[cat].seedLabels]

    const seen = new Set<string>()
    const result: string[] = []
    const pushUnique = (label: string | undefined) => {
      const clean = (label || '').trim()
      if (clean && !seen.has(clean)) {
        seen.add(clean)
        result.push(clean)
      }
    }

    pushUnique(currentVal)
    for (const label of baseLabels) pushUnique(label)
    for (const label of extras) pushUnique(label)
    return result
  }

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
        `/api/service/fct-home-visit/lookup-hn?hn=${encodeURIComponent(cleanHn)}`
      )
      const json = await res.json()
      if (res.status === 404) {
        setLookupNotice('ไม่พบ HN นี้ใน HOSxP สามารถกรอกข้อมูลผู้ป่วยเองได้')
        return
      }
      if (!res.ok || !json.success || !json.data) {
        throw new Error(getApiErrorMessage(json, 'ไม่สามารถค้นหาข้อมูลจาก HOSxP ได้'))
      }
      setForm((prev) => ({
        ...prev,
        hn: json.data.hn || prev.hn,
        patientName: json.data.patientName || prev.patientName,
        age:
          json.data.age !== null && json.data.age !== undefined
            ? String(json.data.age)
            : prev.age,
        address: json.data.address || prev.address,
      }))
      setLookupNotice('ดึงข้อมูลผู้ป่วยจาก HOSxP เรียบร้อยแล้ว')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการค้นหา HN')
    } finally {
      setLookingUp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.visitDate.trim()) {
      setError('กรุณาระบุวันที่เยี่ยมบ้าน')
      return
    }
    if (!form.patientName.trim()) {
      setError('กรุณาระบุชื่อ-สกุลผู้ป่วย')
      return
    }

    const adlScoreNum = toOptInt(form.adlScore)
    if (adlScoreNum !== null && (adlScoreNum < 0 || adlScoreNum > 20)) {
      setError('คะแนน ADL ต้องอยู่ระหว่าง 0 ถึง 20')
      return
    }

    const payload: FctHomeVisitCreateInput = {
      visitDate: form.visitDate.trim(),
      pcuName: form.pcuName.trim() || null,
      patientName: form.patientName.trim(),
      hn: form.hn.trim() || null,
      age: toOptInt(form.age),
      address: form.address.trim() || null,
      adlScore: adlScoreNum,
      adlGroup: form.adlGroup.trim() || null,
      diagnosis: form.diagnosis.trim() || null,
      patientCategory: form.patientCategory.trim() || null,
      followUpPlan: form.followUpPlan.trim() || null,
      treatmentFacility: form.treatmentFacility.trim() || null,
      visitOutcome: form.visitOutcome.trim() || null,
      overallRiskLevel: form.overallRiskLevel.trim() || null,
      riskLevel: form.riskLevel.trim() || null,
      dentalNote: form.dentalNote.trim() || null,
      pharmacyNote: form.pharmacyNote.trim() || null,
      nutritionStatus: form.nutritionStatus.trim() || null,
      nutritionNote: form.nutritionNote.trim() || null,
      ptCategory: form.ptCategory.trim() || null,
      ptNote: form.ptNote.trim() || null,
      thaiMedCategory: form.thaiMedCategory.trim() || null,
      thaiMedNote: form.thaiMedNote.trim() || null,
    }

    setSubmitting(true)
    setError(null)
    try {
      const url = editingRecord
        ? `/api/service/fct-home-visit/${editingRecord.id}`
        : '/api/service/fct-home-visit'
      const method = editingRecord ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(getApiErrorMessage(json, 'บันทึกข้อมูลไม่สำเร็จ'))
      }
      await onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setSubmitting(false)
    }
  }

  const pcuSuggestions = getCategoryLabels('pcu', form.pcuName, availablePcus)
  const patientCategorySuggestions = getCategoryLabels('patient_category', form.patientCategory)
  const treatmentFacilitySuggestions = getCategoryLabels(
    'treatment_facility',
    form.treatmentFacility
  )
  const ptCategorySuggestions = getCategoryLabels('pt_category', form.ptCategory)
  const thaiMedCategorySuggestions = getCategoryLabels('thai_med_category', form.thaiMedCategory)

  return (
    <div
      className="fctModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fct-form-title"
    >
      <div className="fctModal">
        <div className="fctModalHeader">
          <h2 id="fct-form-title" className="fctModalTitle">
            {editingRecord ? 'แก้ไขข้อมูลการเยี่ยมบ้าน FCT' : 'เพิ่มรายการเยี่ยมบ้านทีม FCT'}
          </h2>
          <button
            type="button"
            className="fctBtn fctBtnSm"
            onClick={onClose}
            aria-label="ปิดฟอร์ม"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="fctFormContents">
          <div className="fctModalBody">
            {error && <div className="fctAlert fctAlertError">{error}</div>}
            {lookupNotice && <div className="fctAlert fctAlertInfo">{lookupNotice}</div>}

            <div className="fctSectionBox">
              <h3 className="fctSectionTitle">1. ข้อมูลผู้ป่วยและพื้นที่</h3>
              <div className="fctFormGrid">
                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-visit-date">
                    วันที่เยี่ยมบ้าน *
                  </label>
                  <input
                    id="fct-visit-date"
                    type="date"
                    className="fctInput"
                    value={form.visitDate}
                    onChange={(e) => setField('visitDate', e.target.value)}
                    required
                  />
                </div>

                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-pcu">
                    รพ.สต. / หน่วยบริการ
                  </label>
                  <input
                    id="fct-pcu"
                    type="text"
                    list="fct-pcu-datalist"
                    className="fctInput"
                    value={form.pcuName}
                    onChange={(e) => setField('pcuName', e.target.value)}
                    placeholder="เลือกหรือพิมพ์ชื่อ รพ.สต."
                  />
                  <datalist id="fct-pcu-datalist">
                    {pcuSuggestions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>

                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-hn">
                    HN รพ. (ค้นหา HOSxP)
                  </label>
                  <div className="fctHnRow">
                    <input
                      id="fct-hn"
                      type="text"
                      className="fctInput"
                      value={form.hn}
                      onChange={(e) => setField('hn', e.target.value)}
                      placeholder="เช่น 0012345"
                    />
                    <button
                      type="button"
                      className="fctBtn"
                      onClick={handleLookupHn}
                      disabled={lookingUp}
                    >
                      <Search size={15} />
                      {lookingUp ? 'กำลังค้น...' : 'ดึงข้อมูล'}
                    </button>
                  </div>
                </div>

                <div className="fctField fctFieldSpan2">
                  <label className="fctFieldLabel" htmlFor="fct-name">
                    ชื่อ-สกุลผู้ป่วย *
                  </label>
                  <input
                    id="fct-name"
                    type="text"
                    className="fctInput"
                    value={form.patientName}
                    onChange={(e) => setField('patientName', e.target.value)}
                    required
                  />
                </div>

                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-age">
                    อายุ (ปี)
                  </label>
                  <input
                    id="fct-age"
                    type="number"
                    min={0}
                    max={150}
                    className="fctInput"
                    value={form.age}
                    onChange={(e) => setField('age', e.target.value)}
                  />
                </div>
              </div>

              <div className="fctField fctFieldSpaced">
                <label className="fctFieldLabel" htmlFor="fct-address">
                  ที่อยู่
                </label>
                <input
                  id="fct-address"
                  type="text"
                  className="fctInput"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ"
                />
              </div>
            </div>

            <div className="fctSectionBox">
              <h3 className="fctSectionTitle">2. ประเมิน ADL และโรคประจำตัว</h3>
              <div className="fctFormGrid">
                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-adl-score">
                    คะแนน ADL (0–20)
                  </label>
                  <input
                    id="fct-adl-score"
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    className="fctInput"
                    value={form.adlScore}
                    onChange={(e) => handleAdlScoreChange(e.target.value)}
                  />
                </div>

                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-adl-group">
                    กลุ่ม ADL
                  </label>
                  <select
                    id="fct-adl-group"
                    className="fctSelect"
                    value={form.adlGroup}
                    onChange={(e) => setField('adlGroup', e.target.value)}
                  >
                    <option value="">-- เลือกกลุ่ม ADL --</option>
                    {getCategoryLabels('adl_group', form.adlGroup).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-patient-category">
                    ประเภทคนไข้
                  </label>
                  <input
                    id="fct-patient-category"
                    type="text"
                    list="fct-patient-category-datalist"
                    className="fctInput"
                    value={form.patientCategory}
                    onChange={(e) => setField('patientCategory', e.target.value)}
                    placeholder="เช่น stroke, palliative"
                  />
                  <datalist id="fct-patient-category-datalist">
                    {patientCategorySuggestions.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="fctFormGrid2 fctFieldSpaced">
                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-dx">
                    การวินิจฉัยโรค (Dx)
                  </label>
                  <textarea
                    id="fct-dx"
                    className="fctTextarea"
                    value={form.diagnosis}
                    onChange={(e) => setField('diagnosis', e.target.value)}
                    placeholder="เช่น Ischemic Stroke, HT, DLP"
                  />
                </div>

                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-followup">
                    สิ่งที่ต้องติดตาม (Follow-up Plan)
                  </label>
                  <textarea
                    id="fct-followup"
                    className="fctTextarea"
                    value={form.followUpPlan}
                    onChange={(e) => setField('followUpPlan', e.target.value)}
                    placeholder="ระบุแผนการติดตามครั้งถัดไป"
                  />
                </div>
              </div>
            </div>

            <div className="fctSectionBox">
              <h3 className="fctSectionTitle">3. การเยี่ยมบ้านและผลลัพธ์</h3>
              <div className="fctFormGrid2">
                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-facility">
                    สถานที่รักษา
                  </label>
                  <input
                    id="fct-facility"
                    type="text"
                    list="fct-facility-datalist"
                    className="fctInput"
                    value={form.treatmentFacility}
                    onChange={(e) => setField('treatmentFacility', e.target.value)}
                    placeholder="เช่น รพ.เถิน, รพ.ลำปาง"
                  />
                  <datalist id="fct-facility-datalist">
                    {treatmentFacilitySuggestions.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-outcome">
                    ผลลัพธ์การเยี่ยม
                  </label>
                  <select
                    id="fct-outcome"
                    className="fctSelect"
                    value={form.visitOutcome}
                    onChange={(e) => setField('visitOutcome', e.target.value)}
                  >
                    <option value="">-- เลือกผลลัพธ์ --</option>
                    {getCategoryLabels('visit_outcome', form.visitOutcome).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-overall-risk">
                    ระดับความเสี่ยงโดยรวมของผู้ป่วย
                  </label>
                  <select
                    id="fct-overall-risk"
                    className="fctSelect"
                    value={form.overallRiskLevel}
                    onChange={(e) => setField('overallRiskLevel', e.target.value)}
                  >
                    <option value="">-- เลือกระดับความเสี่ยงโดยรวม --</option>
                    {getCategoryLabels('overall_risk', form.overallRiskLevel).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fctField">
                  <label className="fctFieldLabel" htmlFor="fct-risk-level">
                    ระดับความเสี่ยง
                  </label>
                  <select
                    id="fct-risk-level"
                    className="fctSelect"
                    value={form.riskLevel}
                    onChange={(e) => setField('riskLevel', e.target.value)}
                  >
                    <option value="">-- เลือกระดับความเสี่ยง --</option>
                    {getCategoryLabels('risk_level', form.riskLevel).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="fctSectionBox">
              <h3 className="fctSectionTitle">4. ทีมสหวิชาชีพ 5 ด้าน</h3>
              <div className="fctDisciplineGroup">
                <div className="fctFormGrid2">
                  <div className="fctDisciplineBox">
                    <h4 className="fctDisciplineBoxTitle">ทันตกรรม</h4>
                    <div className="fctField">
                      <label className="fctFieldLabel" htmlFor="fct-dental">
                        บันทึกทันตกรรม
                      </label>
                      <textarea
                        id="fct-dental"
                        className="fctTextarea"
                        value={form.dentalNote}
                        onChange={(e) => setField('dentalNote', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="fctDisciplineBox">
                    <h4 className="fctDisciplineBoxTitle">เภสัชกรรม</h4>
                    <div className="fctField">
                      <label className="fctFieldLabel" htmlFor="fct-pharmacy">
                        บันทึกเภสัช
                      </label>
                      <textarea
                        id="fct-pharmacy"
                        className="fctTextarea"
                        value={form.pharmacyNote}
                        onChange={(e) => setField('pharmacyNote', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="fctDisciplineBox">
                  <h4 className="fctDisciplineBoxTitle">โภชนาการ (นักโภช)</h4>
                  <div className="fctFormGrid2">
                    <div className="fctField">
                      <label className="fctFieldLabel" htmlFor="fct-nutrition-status">
                        สถานะโภชนาการ
                      </label>
                      <select
                        id="fct-nutrition-status"
                        className="fctSelect"
                        value={form.nutritionStatus}
                        onChange={(e) => setField('nutritionStatus', e.target.value)}
                      >
                        <option value="">-- เลือกสถานะโภชนาการ --</option>
                        {getCategoryLabels('nutrition_status', form.nutritionStatus).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fctField">
                      <label className="fctFieldLabel" htmlFor="fct-nutrition-note">
                        คำแนะนำ / บันทึกโภชนาการ
                      </label>
                      <textarea
                        id="fct-nutrition-note"
                        className="fctTextarea"
                        value={form.nutritionNote}
                        onChange={(e) => setField('nutritionNote', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="fctDisciplineBox">
                  <h4 className="fctDisciplineBoxTitle">กายภาพบำบัด</h4>
                  <div className="fctFormGrid2">
                    <div className="fctField">
                      <label className="fctFieldLabel" htmlFor="fct-pt-category">
                        หมวดกิจกรรมกายภาพบำบัด
                      </label>
                      <input
                        id="fct-pt-category"
                        type="text"
                        list="fct-pt-category-datalist"
                        className="fctInput"
                        value={form.ptCategory}
                        onChange={(e) => setField('ptCategory', e.target.value)}
                        placeholder="เลือกหรือพิมพ์หมวดกิจกรรม"
                      />
                      <datalist id="fct-pt-category-datalist">
                        {ptCategorySuggestions.map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    </div>
                    <div className="fctField">
                      <label className="fctFieldLabel" htmlFor="fct-pt-note">
                        บันทึกกายภาพบำบัด
                      </label>
                      <textarea
                        id="fct-pt-note"
                        className="fctTextarea"
                        value={form.ptNote}
                        onChange={(e) => setField('ptNote', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="fctDisciplineBox">
                  <h4 className="fctDisciplineBoxTitle">แพทย์แผนไทย</h4>
                  <div className="fctFormGrid2">
                    <div className="fctField">
                      <label className="fctFieldLabel" htmlFor="fct-thaimed-category">
                        หมวดอาการ / บริการแพทย์แผนไทย
                      </label>
                      <input
                        id="fct-thaimed-category"
                        type="text"
                        list="fct-thaimed-category-datalist"
                        className="fctInput"
                        value={form.thaiMedCategory}
                        onChange={(e) => setField('thaiMedCategory', e.target.value)}
                        placeholder="เลือกหรือพิมพ์หมวดบริการ"
                      />
                      <datalist id="fct-thaimed-category-datalist">
                        {thaiMedCategorySuggestions.map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    </div>
                    <div className="fctField">
                      <label className="fctFieldLabel" htmlFor="fct-thaimed-note">
                        บันทึกแพทย์แผนไทย
                      </label>
                      <textarea
                        id="fct-thaimed-note"
                        className="fctTextarea"
                        value={form.thaiMedNote}
                        onChange={(e) => setField('thaiMedNote', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="fctModalFooter">
            <button
              type="button"
              className="fctBtn"
              onClick={onClose}
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="fctBtn fctBtnPrimary"
              disabled={submitting}
            >
              {submitting
                ? 'กำลังบันทึก...'
                : editingRecord
                  ? 'บันทึกการแก้ไข'
                  : 'บันทึกรายการเยี่ยม'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
