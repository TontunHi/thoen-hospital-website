'use client'

import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  computeAllocatedBudget,
  normalizeBudgetNumber,
} from '@/lib/projects/projectTrackerDomain'
import {
  PROJECT_BUDGET_SOURCES,
  PROJECT_STRATEGY_OPTIONS,
  PROJECT_SUBMISSION_STATUSES,
  type ProjectCreateInput,
  type ProjectRecord,
} from '@/lib/projects/projectTrackerTypes'

interface ProjectFormModalProps {
  isOpen: boolean
  defaultFiscalYear: number
  availableFiscalYears: number[]
  availableStrategies: string[]
  onClose: () => void
  onSaved: (savedFiscalYear?: number, createdRecord?: ProjectRecord) => Promise<void> | void
}

interface FormState {
  fiscalYear: string
  sequenceNo: string
  projectCode: string
  strategy: string
  projectName: string
  responsibleUnit: string
  q1Budget: string
  q2Budget: string
  q3Budget: string
  q4Budget: string
  actualSpent: string
  submissionStatus: string
  budgetSource: string
  notes: string
}

function buildInitialState(
  defaultFiscalYear: number,
  defaultStrategy: string
): FormState {
  return {
    fiscalYear: String(defaultFiscalYear),
    sequenceNo: '',
    projectCode: '',
    strategy: defaultStrategy,
    projectName: '',
    responsibleUnit: '',
    q1Budget: '0',
    q2Budget: '0',
    q3Budget: '0',
    q4Budget: '0',
    actualSpent: '0',
    submissionStatus: 'ยังไม่ส่ง',
    budgetSource: 'เงินบำรุง',
    notes: '',
  }
}

function formatBaht(val: number): string {
  return `฿${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default function ProjectFormModal({
  isOpen,
  defaultFiscalYear,
  availableFiscalYears,
  availableStrategies,
  onClose,
  onSaved,
}: ProjectFormModalProps) {
  const defaultStrategy = availableStrategies[0] ?? PROJECT_STRATEGY_OPTIONS[0]
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(defaultFiscalYear, defaultStrategy)
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialState(defaultFiscalYear, availableStrategies[0] ?? PROJECT_STRATEGY_OPTIONS[0]))
      setError(null)
    }
  }, [isOpen, defaultFiscalYear, availableStrategies])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, submitting, onClose])

  if (!isOpen) return null

  const setField = (key: keyof FormState, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  const q1 = normalizeBudgetNumber(form.q1Budget)
  const q2 = normalizeBudgetNumber(form.q2Budget)
  const q3 = normalizeBudgetNumber(form.q3Budget)
  const q4 = normalizeBudgetNumber(form.q4Budget)
  const allocatedBudget = computeAllocatedBudget(q1, q2, q3, q4)
  const actualSpent = normalizeBudgetNumber(form.actualSpent)
  const remainingBudget = Math.round((allocatedBudget - actualSpent) * 100) / 100

  const strategyChoices = Array.from(
    new Set([...availableStrategies, ...PROJECT_STRATEGY_OPTIONS, form.strategy].filter(Boolean))
  )

  const handleSelectStatus = (nextStatus: string) => {
    setForm((prev) => {
      const next: FormState = { ...prev, submissionStatus: nextStatus }
      if (
        nextStatus === 'ไม่ใช้งบประมาณ' &&
        q1 === 0 &&
        q2 === 0 &&
        q3 === 0 &&
        q4 === 0
      ) {
        next.budgetSource = 'ไม่ใช้งบประมาณ'
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.projectName.trim()) {
      setError('กรุณาระบุชื่อโครงการ')
      return
    }

    const fiscalYearNum = Number(form.fiscalYear)
    const seqNum = form.sequenceNo.trim() ? Number(form.sequenceNo) : null

    const payload: ProjectCreateInput = {
      fiscalYear: fiscalYearNum,
      sequenceNo: seqNum && Number.isInteger(seqNum) && seqNum > 0 ? seqNum : null,
      projectCode: form.projectCode.trim() || null,
      strategy: form.strategy.trim() || 'งานประจำ',
      projectName: form.projectName.trim(),
      responsibleUnit: form.responsibleUnit.trim() || null,
      q1Budget: q1,
      q2Budget: q2,
      q3Budget: q3,
      q4Budget: q4,
      actualSpent,
      submissionStatus: form.submissionStatus,
      budgetSource: form.budgetSource,
      notes: form.notes.trim() || null,
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/service/project-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถบันทึกข้อมูลโครงการได้')
      }
      await onSaved(fiscalYearNum, json.data as ProjectRecord)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="ptModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pt-form-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="ptModalDialog">
        <div className="ptModalHeader">
          <h2 id="pt-form-modal-title" className="ptModalTitle">
            เพิ่มโครงการใหม่เข้าทะเบียน
          </h2>
          <button
            type="button"
            className="ptIconBtn"
            onClick={onClose}
            disabled={submitting}
            aria-label="ปิดหน้าต่าง"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ptModalBody">
            {error && <div className="ptAlert ptAlertError">{error}</div>}

            {/* Section 1: Basic Project Info */}
            <div className="ptFormSection">
              <h3 className="ptFormSectionTitle">1. ข้อมูลโครงการและผู้รับผิดชอบ</h3>
              <div className="ptFormGrid ptFormGrid2">
                <div className="ptField">
                  <label htmlFor="pt-fiscal-year" className="ptFieldLabel">
                    ปีงบประมาณ (พ.ศ.)
                  </label>
                  <select
                    id="pt-fiscal-year"
                    className="ptSelect"
                    value={form.fiscalYear}
                    onChange={(e) => setField('fiscalYear', e.target.value)}
                  >
                    {availableFiscalYears.map((fy) => (
                      <option key={fy} value={String(fy)}>
                        ปีงบประมาณ {fy}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ptField">
                  <label htmlFor="pt-strategy" className="ptFieldLabel">
                    ยุทธศาสตร์
                  </label>
                  <input
                    id="pt-strategy"
                    type="text"
                    list="pt-strategy-datalist"
                    required
                    className="ptInput"
                    value={form.strategy}
                    onChange={(e) => setField('strategy', e.target.value)}
                    placeholder="เลือกหรือระบุยุทธศาสตร์"
                  />
                  <datalist id="pt-strategy-datalist">
                    {strategyChoices.map((st) => (
                      <option key={st} value={st} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="ptFormGrid ptFormGrid2">
                <div className="ptField">
                  <label htmlFor="pt-project-code" className="ptFieldLabel">
                    รหัสโครงการ (ถ้ามี)
                  </label>
                  <input
                    id="pt-project-code"
                    type="text"
                    className="ptInput"
                    value={form.projectCode}
                    onChange={(e) => setField('projectCode', e.target.value)}
                    placeholder="เช่น 080101"
                  />
                </div>

                <div className="ptField">
                  <label htmlFor="pt-seq-no" className="ptFieldLabel">
                    ลำดับที่
                  </label>
                  <input
                    id="pt-seq-no"
                    type="number"
                    min={1}
                    className="ptInput"
                    value={form.sequenceNo}
                    onChange={(e) => setField('sequenceNo', e.target.value)}
                    placeholder="กำหนดอัตโนมัติหากเว้นว่าง"
                  />
                </div>
              </div>

              <div className="ptField">
                <label htmlFor="pt-project-name" className="ptFieldLabel">
                  ชื่อโครงการ *
                </label>
                <textarea
                  id="pt-project-name"
                  rows={2}
                  required
                  className="ptTextarea"
                  value={form.projectName}
                  onChange={(e) => setField('projectName', e.target.value)}
                  placeholder="ระบุชื่อโครงการตามแผนปฏิบัติการ"
                />
              </div>

              <div className="ptField">
                <label htmlFor="pt-responsible-unit" className="ptFieldLabel">
                  หน่วยงาน / ผู้รับผิดชอบ
                </label>
                <input
                  id="pt-responsible-unit"
                  type="text"
                  className="ptInput"
                  value={form.responsibleUnit}
                  onChange={(e) => setField('responsibleUnit', e.target.value)}
                  placeholder="เช่น กลุ่มงานบริการด้านปฐมภูมิ / ชื่อผู้รับผิดชอบ"
                />
              </div>
            </div>

            {/* Section 2: Quarterly Budget */}
            <div className="ptFormSection">
              <h3 className="ptFormSectionTitle">2. แผนงบประมาณรายไตรมาส (Q1–Q4) และการเบิกจ่าย</h3>
              <div className="ptFormGrid ptFormGrid4">
                <div className="ptField">
                  <label htmlFor="pt-q1" className="ptFieldLabel">
                    ไตรมาส 1 (บาท)
                  </label>
                  <input
                    id="pt-q1"
                    type="number"
                    min={0}
                    step="0.01"
                    className="ptInput"
                    value={form.q1Budget}
                    onChange={(e) => setField('q1Budget', e.target.value)}
                  />
                </div>
                <div className="ptField">
                  <label htmlFor="pt-q2" className="ptFieldLabel">
                    ไตรมาส 2 (บาท)
                  </label>
                  <input
                    id="pt-q2"
                    type="number"
                    min={0}
                    step="0.01"
                    className="ptInput"
                    value={form.q2Budget}
                    onChange={(e) => setField('q2Budget', e.target.value)}
                  />
                </div>
                <div className="ptField">
                  <label htmlFor="pt-q3" className="ptFieldLabel">
                    ไตรมาส 3 (บาท)
                  </label>
                  <input
                    id="pt-q3"
                    type="number"
                    min={0}
                    step="0.01"
                    className="ptInput"
                    value={form.q3Budget}
                    onChange={(e) => setField('q3Budget', e.target.value)}
                  />
                </div>
                <div className="ptField">
                  <label htmlFor="pt-q4" className="ptFieldLabel">
                    ไตรมาส 4 (บาท)
                  </label>
                  <input
                    id="pt-q4"
                    type="number"
                    min={0}
                    step="0.01"
                    className="ptInput"
                    value={form.q4Budget}
                    onChange={(e) => setField('q4Budget', e.target.value)}
                  />
                </div>
              </div>

              <div className="ptFormGrid ptFormGrid2">
                <div className="ptField">
                  <label htmlFor="pt-actual-spent" className="ptFieldLabel">
                    งบประมาณใช้จริง (บาท)
                  </label>
                  <input
                    id="pt-actual-spent"
                    type="number"
                    min={0}
                    step="0.01"
                    className="ptInput"
                    value={form.actualSpent}
                    onChange={(e) => setField('actualSpent', e.target.value)}
                  />
                </div>

                <div className="ptField">
                  <label htmlFor="pt-budget-source" className="ptFieldLabel">
                    แหล่งงบประมาณ
                  </label>
                  <select
                    id="pt-budget-source"
                    className="ptSelect"
                    value={form.budgetSource}
                    onChange={(e) => setField('budgetSource', e.target.value)}
                  >
                    {PROJECT_BUDGET_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ptBudgetPreviewBar">
                <div className="ptBudgetPreviewItem">
                  <span className="ptBudgetPreviewLabel">งบที่ได้รับรวม (อัตโนมัติ)</span>
                  <span className="ptBudgetPreviewVal">{formatBaht(allocatedBudget)}</span>
                </div>
                <div className="ptBudgetPreviewItem">
                  <span className="ptBudgetPreviewLabel">ใช้จริง</span>
                  <span className="ptBudgetPreviewVal">{formatBaht(actualSpent)}</span>
                </div>
                <div className="ptBudgetPreviewItem">
                  <span className="ptBudgetPreviewLabel">คงเหลือ (อัตโนมัติ)</span>
                  <span
                    className={`ptBudgetPreviewVal ${
                      remainingBudget < 0 ? 'ptBudgetPreviewValDanger' : ''
                    }`}
                  >
                    {formatBaht(remainingBudget)}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Submission Status & Notes */}
            <div className="ptFormSection">
              <h3 className="ptFormSectionTitle">3. สถานะการส่งสรุปงานและหมายเหตุ</h3>
              <div className="ptField">
                <span className="ptFieldLabel">เลือกสถานะการส่งสรุปงาน</span>
                <div className="ptStatusPills" role="group" aria-label="สถานะการส่งสรุปงาน">
                  {PROJECT_SUBMISSION_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`ptStatusPillBtn ${
                        form.submissionStatus === st ? 'active' : ''
                      }`}
                      onClick={() => handleSelectStatus(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ptField">
                <label htmlFor="pt-notes" className="ptFieldLabel">
                  หมายเหตุ / ปัญหาอุปสรรค
                </label>
                <textarea
                  id="pt-notes"
                  rows={2}
                  className="ptTextarea"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="ระบุหมายเหตุเพิ่มเติม เช่น โครงการนอกแผน หรือปัญหาอุปสรรค"
                />
              </div>
            </div>
          </div>

          <div className="ptModalFooter">
            <button
              type="button"
              className="ptBtn"
              onClick={onClose}
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="ptBtn ptBtnPrimary"
              disabled={submitting}
            >
              {submitting ? 'กำลังบันทึก...' : 'เพิ่มโครงการ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
