'use client'

import React from 'react'
import {
  X,
  ChevronDown,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Lock,
  Edit,
} from 'lucide-react'
import type { KpiIndicatorItem } from '@/lib/kpi/kpiService'
import {
  getPeriodsForFrequency,
  checkPeriodStatus,
  checkIndicatorDueStatus,
  isIndicatorAnsweredForPeriod,
  matchesPeriodKey,
  isPercentageIndicator,
  isRateIndicator,
  formatKpiResultValue,
  formatKpiDecimal,
  formatKpiNumber,
  shouldDisplayPerThousandDays,
} from '@/lib/kpi/kpiTimeUtils'
import {
  formatThaiDateTime,
  formatAnswerDisplay,
} from '../kpiTrackerHelpers'

export function KpiAnswerAndHistoryModals(props: {
  answerModalOpen: boolean
  setAnswerModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  activeIndicator: KpiIndicatorItem | null
  formPeriodKey: string
  handleModalPeriodChange: (periodKey: string) => void
  formNumerator: string
  setFormNumerator: React.Dispatch<React.SetStateAction<string>>
  formDenominator: string
  setFormDenominator: React.Dispatch<React.SetStateAction<string>>
  formCalcMode: 'percentage' | 'ratio'
  setFormCalcMode: React.Dispatch<React.SetStateAction<'percentage' | 'ratio'>>
  computedPercentage: number | null
  liveEvaluationStatus: 'PASS' | 'FAIL' | 'WAITING_TARGET' | 'PENDING'
  formSingleAnswer: string
  setFormSingleAnswer: React.Dispatch<React.SetStateAction<string>>
  handleOpenHistoryModal: (ind: KpiIndicatorItem) => void
  handleSaveAnswer: () => Promise<void>
  saving: boolean
  historyModalOpen: boolean
  setHistoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  historyIndicator: KpiIndicatorItem | null
  selectedYear: string
  canAnswerIndicator: (ind: KpiIndicatorItem) => boolean
  handleEditRoundFromHistory: (ind: KpiIndicatorItem, periodKey: string, periodLabel: string) => void
  handleOpenAnswer: (ind: KpiIndicatorItem) => void
}) {
  const {
    answerModalOpen,
    setAnswerModalOpen,
    activeIndicator,
    formPeriodKey,
    handleModalPeriodChange,
    formNumerator,
    setFormNumerator,
    formDenominator,
    setFormDenominator,
    formCalcMode,
    setFormCalcMode,
    computedPercentage,
    liveEvaluationStatus,
    formSingleAnswer,
    setFormSingleAnswer,
    handleOpenHistoryModal,
    handleSaveAnswer,
    saving,
    historyModalOpen,
    setHistoryModalOpen,
    historyIndicator,
    selectedYear,
    canAnswerIndicator,
    handleEditRoundFromHistory,
    handleOpenAnswer,
  } = props

  return (
    <>
        {/* ── MODAL 1: ANSWER ENTRY (Simplified per user request) ── */}
        {answerModalOpen && activeIndicator && (
          <div className="kpiModalOverlay" onClick={() => setAnswerModalOpen(false)}>
            <div className="kpiModalCard" onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <div className="kpiModalSubBadge">
                    {activeIndicator.code ? `${activeIndicator.code} • ` : ''}{activeIndicator.frequency}
                  </div>
                  <h2>ตอบผลการดำเนินงานตัวชี้วัด</h2>
                </div>
                <button className="kpiModalClose" onClick={() => setAnswerModalOpen(false)} aria-label="ปิดหน้าต่าง">
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody">
                <div className="kpiIndicatorSummaryBox">
                  <div className="kpiSummaryCategory">
                    {activeIndicator.category} {activeIndicator.subcategory ? `› ${activeIndicator.subcategory}` : ''}
                  </div>
                  {(activeIndicator.numeratorName || activeIndicator.denominatorName) && (
                    <div className="kpiSummaryTitle">
                      {activeIndicator.title}
                    </div>
                  )}
                  <div className="kpiSummaryMeta">
                    <span>
                      <strong>เป้าหมาย:</strong>{' '}
                      {activeIndicator.targetValue !== null && activeIndicator.targetValue !== undefined
                        ? `${activeIndicator.targetOperator || '>='} ${activeIndicator.targetValue}${activeIndicator.targetUnit ?? (isPercentageIndicator(activeIndicator) ? '%' : '')}`
                        : activeIndicator.targetRaw || 'รอระบุเป้าหมาย'}
                    </span>
                    <span className="kpiSummaryMetaDivider">•</span>
                    <span><strong>ผู้รับผิดชอบ:</strong> {activeIndicator.responsibleName || 'ไม่ระบุ'}</span>
                  </div>
                </div>

                {/* Period Selector */}
                <div className="kpiFormGroup">
                  <label className="kpiFormLabel">
                    <span>รอบการประเมิน (ตามความถี่ {activeIndicator.frequency}):</span>
                  </label>
                  <div className="kpiSelectWrapper">
                    <select 
                      className="kpiSelectInput"
                      value={formPeriodKey}
                      onChange={(e) => handleModalPeriodChange(e.target.value)}
                    >
                      {getPeriodsForFrequency(activeIndicator.frequency).map(p => (
                        <option key={p.key} value={p.key}>{p.label} - {p.description}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="kpiSelectArrow" />
                  </div>
                </div>

                {/* If Indicator HAS Numerator and Denominator */}
                {activeIndicator.numeratorName || activeIndicator.denominatorName ? (
                  <>
                    <div className="kpiFormGroup">
                      <label className="kpiQuestionCardLabel">
                        <span className="kpiFieldBadge">คำถามตัวตั้ง (คำถามรอง 1)</span>
                        <span className="kpiQuestionText">
                          {activeIndicator.numeratorName || 'ระบุค่าตัวตั้ง'}
                        </span>
                      </label>
                      <input 
                        type="number"
                        step="any"
                        placeholder="กรอกค่าตัวตั้ง..."
                        className="kpiTextInput"
                        value={formNumerator}
                        onChange={(e) => setFormNumerator(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="kpiFormGroup">
                      <label className="kpiQuestionCardLabel">
                        <span className="kpiFieldBadge">คำถามตัวหาร (คำถามรอง 2)</span>
                        <span className="kpiQuestionText">
                          {activeIndicator.denominatorName || 'ระบุค่าตัวหาร'}
                        </span>
                      </label>
                      <input 
                        type="number"
                        step="any"
                        placeholder="กรอกค่าตัวหาร..."
                        className="kpiTextInput"
                        value={formDenominator}
                        onChange={(e) => setFormDenominator(e.target.value)}
                      />
                    </div>

                    {/* Auto-calculation Preview */}
                    <div className="kpiCalcPreview">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '13px' }}>ผลการคำนวณอัตโนมัติ:</strong>
                          <div style={{ display: 'inline-flex', gap: '4px', background: 'var(--canvas-subtle, #f1f5f9)', padding: '2px', borderRadius: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setFormCalcMode('percentage')}
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                background: formCalcMode === 'percentage' ? 'var(--primary, #0284c7)' : 'transparent',
                                color: formCalcMode === 'percentage' ? '#fff' : 'var(--ink-muted, #64748b)',
                                fontWeight: formCalcMode === 'percentage' ? 600 : 400,
                              }}
                            >
                              ร้อยละ (× 100)
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormCalcMode('ratio')}
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                background: formCalcMode === 'ratio' ? 'var(--primary, #0284c7)' : 'transparent',
                                color: formCalcMode === 'ratio' ? '#fff' : 'var(--ink-muted, #64748b)',
                                fontWeight: formCalcMode === 'ratio' ? 600 : 400,
                              }}
                            >
                              ค่าเฉลี่ย / สัดส่วนตรง (÷)
                            </button>
                          </div>
                        </div>
                        <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {computedPercentage !== null 
                            ? (parseFloat(formNumerator) === 0 && parseFloat(formDenominator) === 0
                                ? (formCalcMode === 'percentage'
                                    ? `${formatKpiNumber(parseFloat(formNumerator))} ÷ ${formatKpiNumber(parseFloat(formDenominator))} = 0% (ไม่มีเคสในรอบนี้)`
                                    : `${formatKpiNumber(parseFloat(formNumerator))} ÷ ${formatKpiNumber(parseFloat(formDenominator))} = 0.00 (ไม่มีเคสในรอบนี้)`)
                                : (formCalcMode === 'percentage'
                                    ? `${formatKpiNumber(parseFloat(formNumerator))} ÷ ${formatKpiNumber(parseFloat(formDenominator))} × 100 = ${formatKpiDecimal(computedPercentage, { minDecimals: 0, maxDecimals: 6 })}%`
                                    : shouldDisplayPerThousandDays(computedPercentage, activeIndicator)
                                      ? `${formatKpiNumber(parseFloat(formNumerator))} ÷ ${formatKpiNumber(parseFloat(formDenominator))} = ${formatKpiResultValue(computedPercentage, activeIndicator)} (ค่าดิบ ${formatKpiDecimal(computedPercentage, { minDecimals: 2, maxDecimals: 6 })})`
                                      : `${formatKpiNumber(parseFloat(formNumerator))} ÷ ${formatKpiNumber(parseFloat(formDenominator))} = ${formatKpiDecimal(computedPercentage, { minDecimals: 2, maxDecimals: 6 })}${activeIndicator.targetUnit && activeIndicator.targetUnit !== '%' && activeIndicator.targetUnit !== 'อัตรา' ? ` ${activeIndicator.targetUnit}` : ''}`))
                            : formNumerator.trim() !== '' && formDenominator.trim() === '0'
                              ? 'ตัวหารเป็น 0 ไม่สามารถคำนวณได้'
                              : 'กรอกตัวตั้งและตัวหารเพื่อคำนวณผลลัพธ์'}
                        </div>
                      </div>
                      <div>
                        {liveEvaluationStatus === 'PASS' && (
                          <span className="kpiStatusBadge pass">ผ่านเกณฑ์</span>
                        )}
                        {liveEvaluationStatus === 'FAIL' && (
                          <span className="kpiStatusBadge fail">ไม่ผ่านเกณฑ์</span>
                        )}
                        {liveEvaluationStatus === 'WAITING_TARGET' && (
                          <span className="kpiStatusBadge waiting">รอระบุเป้าหมาย</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Single Input Field if NO Numerator/Denominator (per user request) */
                  <div className="kpiFormGroup">
                    <label className="kpiQuestionCardLabel">
                      <span className="kpiFieldBadge">คำถามตัวชี้วัด (คำถามหลัก)</span>
                      <span className="kpiQuestionText">
                        {activeIndicator.title}
                      </span>
                    </label>
                    <input 
                      type="text"
                      placeholder="ระบุตัวเลขผลลัพธ์หรือคำตอบ..."
                      className="kpiTextInput"
                      value={formSingleAnswer}
                      onChange={(e) => setFormSingleAnswer(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}

                {/* Previous Rounds History Preview & Switcher */}
                {(() => {
                  const periods = getPeriodsForFrequency(activeIndicator.frequency)
                  if (periods.length <= 1) return null

                  return (
                    <div className="kpiModalPrevRoundsSection">
                      <div className="kpiModalPrevRoundsHeader">
                        <span>ประวัติคำตอบในรอบอื่น ๆ (คลิกเพื่อดูหรือสลับรอบ):</span>
                        <button
                          type="button"
                          className="kpiQuickActionBtn"
                          onClick={() => {
                            setAnswerModalOpen(false)
                            handleOpenHistoryModal(activeIndicator)
                          }}
                        >
                          เปิดดูประวัติแบบละเอียด
                        </button>
                      </div>
                      <div className="kpiModalPrevRoundsGrid">
                        {periods.map(p => {
                          const isCurrent = matchesPeriodKey(formPeriodKey, p.key)
                          const entry = activeIndicator.entries?.find(e => matchesPeriodKey(e.periodKey, p.key)) ||
                            (activeIndicator.currentEntry && matchesPeriodKey(activeIndicator.currentEntry.periodKey, p.key) ? activeIndicator.currentEntry : null)
                          const ansDisplay = formatAnswerDisplay(entry, activeIndicator.targetUnit, activeIndicator)

                          return (
                            <div
                              key={p.key}
                              className={`kpiModalPrevRoundChip ${isCurrent ? 'active' : ''}`}
                              onClick={() => handleModalPeriodChange(p.key)}
                              title={ansDisplay ? `ตอบแล้ว: ${ansDisplay.main}` : 'ยังไม่บันทึก (คลิกเพื่อกรอกรอบนี้)'}
                            >
                              <div className="kpiModalPrevRoundChipName">{p.label}</div>
                              <div className="kpiModalPrevRoundChipVal">
                                {ansDisplay ? ansDisplay.main : 'ยังไม่บันทึก'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div className="kpiModalFooter">
                <button 
                  className="kpiBtn kpiBtnSecondary" 
                  onClick={() => setAnswerModalOpen(false)}
                >
                  <X size={16} />
                  ยกเลิก
                </button>
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={handleSaveAnswer}
                  disabled={saving}
                >
                  <Check size={16} />
                  {saving ? 'กำลังบันทึก...' : 'บันทึกผลการดำเนินงาน'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 5: ROUND HISTORY MODAL (ดูข้อมูลย้อนหลังแต่ละรอบ) ── */}
        {historyModalOpen && historyIndicator && (
          <div className="kpiModalOverlay" onClick={() => setHistoryModalOpen(false)}>
            <div className="kpiModalCard kpiHistoryModalCard" onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <div className="kpiModalSubBadge">
                    {historyIndicator.code ? `${historyIndicator.code} • ` : ''}{historyIndicator.frequency} • ปี {selectedYear}
                  </div>
                  <h2>ประวัติคำตอบย้อนหลังในแต่ละรอบ</h2>
                </div>
                <button
                  type="button"
                  className="kpiModalClose"
                  onClick={() => setHistoryModalOpen(false)}
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Indicator Context Summary */}
                <div className="kpiIndicatorSummaryBox">
                  <div className="kpiSummaryCategory">
                    {historyIndicator.category} {historyIndicator.subcategory ? `› ${historyIndicator.subcategory}` : ''}
                  </div>
                  <div className="kpiSummaryTitle" style={{ fontSize: '15px', fontWeight: 600 }}>
                    {historyIndicator.title}
                  </div>
                  <div className="kpiSummaryMeta">
                    <span>
                      <strong>เป้าหมาย:</strong>{' '}
                      {historyIndicator.targetValue !== null && historyIndicator.targetValue !== undefined
                        ? `${historyIndicator.targetOperator || '>='} ${formatKpiDecimal(Number(historyIndicator.targetValue), { minDecimals: isRateIndicator(historyIndicator) ? 2 : 0, maxDecimals: 6, normalDecimals: 4 })}${historyIndicator.targetUnit ?? (isPercentageIndicator(historyIndicator) ? '%' : '')}`
                        : historyIndicator.targetRaw || 'รอระบุเป้าหมาย'}
                    </span>
                    <span className="kpiSummaryMetaDivider">•</span>
                    <span><strong>ผู้รับผิดชอบ:</strong> {historyIndicator.responsibleName || 'ไม่ระบุ'}</span>
                  </div>
                </div>

                {/* Subquestions breakdown if any */}
                {(historyIndicator.numeratorName || historyIndicator.denominatorName) && (
                  <div className="kpiHistoryQuestionsCard">
                    {historyIndicator.numeratorName && (
                      <div className="kpiHistoryQuestionRow">
                        <span className="kpiHistoryQuestionTag num">คำถามตัวตั้ง</span>
                        <span>{historyIndicator.numeratorName}</span>
                      </div>
                    )}
                    {historyIndicator.denominatorName && (
                      <div className="kpiHistoryQuestionRow">
                        <span className="kpiHistoryQuestionTag den">คำถามตัวหาร</span>
                        <span>{historyIndicator.denominatorName}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress Summary Banner */}
                {(() => {
                  const periods = getPeriodsForFrequency(historyIndicator.frequency)
                  const totalRounds = periods.length
                  const answeredCount = periods.filter(p => isIndicatorAnsweredForPeriod(historyIndicator, p.key)).length
                  let passCount = 0
                  let failCount = 0

                  periods.forEach(p => {
                    const match = historyIndicator.entries?.find(e => matchesPeriodKey(e.periodKey, p.key)) ||
                      (historyIndicator.currentEntry && matchesPeriodKey(historyIndicator.currentEntry.periodKey, p.key) ? historyIndicator.currentEntry : null)
                    if (match?.status === 'PASS') passCount++
                    else if (match?.status === 'FAIL') failCount++
                  })

                  const pct = totalRounds > 0 ? ((answeredCount / totalRounds) * 100).toFixed(0) : '0'

                  return (
                    <div className="kpiHistorySummaryBanner">
                      <div className="kpiHistorySummaryPill">
                        <span>บันทึกผลแล้ว:</span>
                        <strong>{answeredCount} จาก {totalRounds} รอบ ({pct}%)</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: 'var(--pass-ink)', fontWeight: 600 }}>ผ่านเกณฑ์ {passCount} รอบ</span>
                        <span style={{ color: 'var(--divider)' }}>|</span>
                        <span style={{ color: 'var(--fail-ink)', fontWeight: 600 }}>ไม่ผ่าน {failCount} รอบ</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Rounds List */}
                <div className="kpiHistoryRoundsList">
                  {getPeriodsForFrequency(historyIndicator.frequency).map((p, pIdx) => {
                    const entry = historyIndicator.entries?.find(e => matchesPeriodKey(e.periodKey, p.key)) ||
                      (historyIndicator.currentEntry && matchesPeriodKey(historyIndicator.currentEntry.periodKey, p.key) ? historyIndicator.currentEntry : null)
                    const isAnswered = isIndicatorAnsweredForPeriod(historyIndicator, p.key)
                    const hasNumDen = Boolean(historyIndicator.numeratorName || historyIndicator.denominatorName)
                    const periodStatus = checkPeriodStatus(historyIndicator.frequency, p.key, selectedYear)
                    const dueStatus = checkIndicatorDueStatus(historyIndicator.frequency, selectedYear)
                    const isCurrentPeriod = matchesPeriodKey(p.key, dueStatus.relevantPeriod.key)
                    const canEdit = canAnswerIndicator(historyIndicator)

                    return (
                      <div
                        key={p.key}
                        className={`kpiHistoryRoundCard ${isCurrentPeriod ? 'currentRound' : ''} ${!isAnswered ? 'unanswered' : ''}`}
                      >
                        <div className="kpiHistoryRoundHeader">
                          <div className="kpiHistoryRoundTitleWrap">
                            <span className="kpiColSeq">#{pIdx + 1}</span>
                            <span className="kpiHistoryRoundTitle">{p.label}</span>
                            {isCurrentPeriod && (
                              <span className="kpiHistoryRoundCurrentBadge">รอบปัจจุบัน</span>
                            )}
                            <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>({p.description})</span>
                          </div>

                          <div>
                            {isAnswered && entry ? (
                              entry.status === 'PASS' ? (
                                <span className="kpiStatusPill pass">
                                  <CheckCircle2 size={13} /> ผ่านเกณฑ์
                                </span>
                              ) : entry.status === 'FAIL' ? (
                                <span className="kpiStatusPill fail">
                                  <XCircle size={13} /> ไม่ผ่านเกณฑ์
                                </span>
                              ) : entry.status === 'WAITING_TARGET' ? (
                                <span className="kpiStatusPill unspecified">
                                  <AlertCircle size={13} /> รอผลประเมิน
                                </span>
                              ) : (
                                <span className="kpiStatusPill pass">
                                  <CheckCircle2 size={13} /> บันทึกแล้ว
                                </span>
                              )
                            ) : periodStatus.isOpen ? (
                              <span className="kpiStatusPill noReport">
                                <Clock size={13} /> ยังไม่บันทึกผล
                              </span>
                            ) : (
                              <span className="kpiStatusPill locked" title={periodStatus.message}>
                                <Lock size={13} /> ยังไม่ถึงรอบ
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Answers Grid */}
                        <div className="kpiHistoryAnswersGrid">
                          {hasNumDen ? (
                            <>
                              <div className="kpiHistoryAnswerBox">
                                <span className="kpiHistoryAnswerLabel">คำตอบตัวตั้ง (Numerator):</span>
                                <span className="kpiHistoryAnswerVal">
                                  {entry?.numeratorValue !== null && entry?.numeratorValue !== undefined ? formatKpiNumber(entry.numeratorValue) : '-'}
                                </span>
                              </div>
                              <div className="kpiHistoryAnswerBox">
                                <span className="kpiHistoryAnswerLabel">คำตอบตัวหาร (Denominator):</span>
                                <span className="kpiHistoryAnswerVal">
                                  {entry?.denominatorValue !== null && entry?.denominatorValue !== undefined ? formatKpiNumber(entry.denominatorValue) : '-'}
                                </span>
                              </div>
                              <div className="kpiHistoryAnswerBox">
                                <span className="kpiHistoryAnswerLabel">
                                  {isPercentageIndicator(historyIndicator)
                                    ? 'ผลงานคำนวณ (%):'
                                    : (isRateIndicator(historyIndicator) ? 'ผลงานคำนวณ (อัตรา):' : 'ผลงานคำนวณ:')}
                                </span>
                                <span className="kpiHistoryAnswerVal highlight">
                                  {(() => {
                                    const histDisplay = formatAnswerDisplay(entry, historyIndicator.targetUnit, historyIndicator)
                                    return histDisplay?.main || entry?.resultText || '-'
                                  })()}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="kpiHistoryAnswerBox" style={{ gridColumn: '1 / -1' }}>
                              <span className="kpiHistoryAnswerLabel">คำตอบผลการดำเนินงาน:</span>
                              <span className="kpiHistoryAnswerVal highlight">
                                {entry?.resultValue !== null && entry?.resultValue !== undefined
                                  ? formatKpiResultValue(entry.resultValue, historyIndicator, entry?.resultText)
                                  : (entry?.resultText || '-')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="kpiHistoryRoundFooter">
                          <div className="kpiHistoryRoundMeta">
                            {entry?.recordedByName && (
                              <span>ผู้รายงาน: <strong>{entry.recordedByName}</strong></span>
                            )}
                            {(entry?.updatedAt || entry?.recordedAt) && (
                              <span>บันทึกเมื่อ: {formatThaiDateTime(entry.updatedAt || entry.recordedAt)}</span>
                            )}
                            {entry?.note && (
                              <span>หมายเหตุ: {entry.note}</span>
                            )}
                            {!entry && (
                              <span>ยังไม่มีการบันทึกข้อมูลในรอบนี้</span>
                            )}
                          </div>

                          {canEdit && (
                            <button
                              type="button"
                              className="kpiHistoryRoundEditBtn"
                              onClick={() => handleEditRoundFromHistory(historyIndicator, p.key, p.label)}
                            >
                              <Edit size={12} />
                              <span>{entry ? 'แก้ไขรอบนี้' : 'บันทึกรอบนี้'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="kpiModalFooter">
                <button
                  type="button"
                  className="kpiBtn kpiBtnSecondary"
                  onClick={() => setHistoryModalOpen(false)}
                >
                  <X size={16} />
                  <span>ปิดหน้าต่าง</span>
                </button>
                {canAnswerIndicator(historyIndicator) && (
                  <button
                    type="button"
                    className="kpiBtn kpiBtnPrimary"
                    onClick={() => {
                      setHistoryModalOpen(false)
                      handleOpenAnswer(historyIndicator)
                    }}
                  >
                    <Edit size={16} />
                    <span>ตอบผลการดำเนินงาน</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
    </>
  )
}
