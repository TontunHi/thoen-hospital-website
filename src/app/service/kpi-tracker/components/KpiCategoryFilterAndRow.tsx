'use client'

import React from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Edit,
  History,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import type { KpiIndicatorItem } from '@/lib/kpi/kpiService'
import {
  checkIndicatorDueStatus,
  formatKpiDecimal,
  getPeriodsForFrequency,
  isIndicatorAnsweredForPeriod,
  isPercentageIndicator,
  isRateIndicator,
  type IndicatorDueStatus,
} from '@/lib/kpi/kpiTimeUtils'
import {
  formatAiAuditNumbers,
  formatAnswerDisplay,
  formatThaiDateTime,
  getAiAuditStatusLabel,
} from '../kpiTrackerHelpers'

export interface KpiCategoryFilterProps {
  categoryMultiSelectRef: React.RefObject<HTMLDivElement | null>
  selectedCategories: string[]
  categoryMultiSelectOpen: boolean
  setCategoryMultiSelectOpen: React.Dispatch<React.SetStateAction<boolean>>
  categorySearchQuery: string
  setCategorySearchQuery: React.Dispatch<React.SetStateAction<string>>
  categoryGroups: { strategy: string[]; ha: string[]; other: string[]; all: string[] }
  filteredCategoryGroups: { strategy: string[]; ha: string[]; other: string[]; all: string[] }
  categoryCounts: Map<string, number>
  toggleCategory: (cat: string) => void
  selectAllCategories: () => void
  clearAllCategories: () => void
  toggleGroupCategories: (groupItems: string[]) => void
}

export function KpiCategoryFilter({
  categoryMultiSelectRef,
  selectedCategories,
  categoryMultiSelectOpen,
  setCategoryMultiSelectOpen,
  categorySearchQuery,
  setCategorySearchQuery,
  categoryGroups,
  filteredCategoryGroups,
  categoryCounts,
  toggleCategory,
  selectAllCategories,
  clearAllCategories,
  toggleGroupCategories,
}: KpiCategoryFilterProps) {
  return (
    <div className="kpiCategoryDropdownField" ref={categoryMultiSelectRef}>
      <label id="kpi-category-label" className="kpiCategoryLabel">
        หมวดหมู่ / ยุทธศาสตร์:
      </label>
      <div className="kpiMultiSelectWrapper">
        <div
          role="combobox"
          tabIndex={0}
          id="kpi-category-multi-select"
          aria-labelledby="kpi-category-label"
          aria-expanded={categoryMultiSelectOpen}
          aria-haspopup="dialog"
          className={`kpiMultiSelectTrigger ${selectedCategories.length > 0 ? 'kpiMultiSelectTrigger--active' : ''} ${categoryMultiSelectOpen ? 'kpiMultiSelectTrigger--open' : ''}`}
          onClick={() => setCategoryMultiSelectOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setCategoryMultiSelectOpen((prev) => !prev)
            }
          }}
        >
          <div className="kpiMultiSelectValueWrap">
            <span
              className="kpiMultiSelectText"
              title={
                selectedCategories.length === 0
                  ? 'ทั้งหมด (ทุกหมวดและทุกยุทธศาสตร์)'
                  : selectedCategories.length === 1
                  ? selectedCategories[0]
                  : `เลือก ${selectedCategories.length} หมวดหมู่ / ยุทธศาสตร์`
              }
            >
              {selectedCategories.length === 0
                ? 'ทั้งหมด (ทุกหมวดและทุกยุทธศาสตร์)'
                : selectedCategories.length === 1
                ? selectedCategories[0]
                : `เลือก ${selectedCategories.length} หมวดหมู่ / ยุทธศาสตร์`}
            </span>
            {selectedCategories.length > 1 && (
              <span className="kpiMultiSelectBadge">{selectedCategories.length}</span>
            )}
          </div>

          <div className="kpiMultiSelectActionsWrap">
            {selectedCategories.length > 0 && (
              <button
                type="button"
                className="kpiMultiSelectClearTrigger"
                onClick={(e) => {
                  e.stopPropagation()
                  clearAllCategories()
                }}
                title="ล้างการเลือกทั้งหมด"
                aria-label="ล้างการเลือกทั้งหมด"
              >
                <X size={14} />
              </button>
            )}
            <ChevronDown
              size={16}
              className={`kpiSelectArrow ${categoryMultiSelectOpen ? 'is-rotated' : ''}`}
            />
          </div>
        </div>

        {categoryMultiSelectOpen && (
          <div className="kpiMultiSelectPopover" role="dialog" aria-label="เลือกหมวดหมู่และยุทธศาสตร์">
            <div className="kpiMultiSelectHeader">
              <div className="kpiMultiSelectSearchWrap">
                <Search size={14} className="kpiMultiSelectSearchIcon" />
                <input
                  type="text"
                  className="kpiMultiSelectSearchInput"
                  placeholder="พิมพ์ค้นหาหมวดหมู่ / ยุทธศาสตร์..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  autoFocus
                />
                {categorySearchQuery && (
                  <button
                    type="button"
                    className="kpiMultiSelectSearchClear"
                    onClick={() => setCategorySearchQuery('')}
                    aria-label="ล้างคำค้นหา"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="kpiMultiSelectQuickActions">
                <span className="kpiMultiSelectCountSummary">
                  {selectedCategories.length === 0 ? (
                    'กำลังแสดงทั้งหมด'
                  ) : (
                    <>เลือกแล้ว <strong>{selectedCategories.length}</strong> จาก {categoryGroups.all.length}</>
                  )}
                </span>
                <div className="kpiMultiSelectQuickBtns">
                  <button type="button" className="kpiQuickActionBtn" onClick={selectAllCategories}>
                    เลือกทั้งหมด
                  </button>
                  <span className="kpiQuickActionDivider">|</span>
                  <button type="button" className="kpiQuickActionBtn" onClick={clearAllCategories}>
                    ล้างค่า
                  </button>
                </div>
              </div>
            </div>

            <div className="kpiMultiSelectList">
              {[
                { key: 'strategy', title: 'กลุ่มยุทธศาสตร์', list: filteredCategoryGroups.strategy },
                { key: 'ha', title: 'หมวดหมู่คุณภาพ HA', list: filteredCategoryGroups.ha },
                { key: 'other', title: 'หมวดหมู่อื่นๆ', list: filteredCategoryGroups.other },
              ].map(
                (group) =>
                  group.list.length > 0 && (
                    <div key={group.key} className="kpiMultiSelectGroup">
                      <div className="kpiMultiSelectGroupHeader">
                        <span className="kpiMultiSelectGroupTitle">{group.title}</span>
                        <button
                          type="button"
                          className="kpiMultiSelectGroupToggle"
                          onClick={() => toggleGroupCategories(group.list)}
                        >
                          {group.list.every((s) => selectedCategories.includes(s))
                            ? 'ยกเลิกทั้งกลุ่ม'
                            : 'เลือกทั้งกลุ่ม'}
                        </button>
                      </div>
                      {group.list.map((cat) => {
                        const isChecked = selectedCategories.includes(cat)
                        const count = categoryCounts.get(cat) || 0
                        return (
                          <label
                            key={cat}
                            className={`kpiMultiSelectItem ${isChecked ? 'kpiMultiSelectItem--checked' : ''}`}
                          >
                            <span className={`kpiMultiSelectCheckbox ${isChecked ? 'is-checked' : ''}`}>
                              {isChecked && <Check size={12} strokeWidth={3} />}
                            </span>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={isChecked}
                              onChange={() => toggleCategory(cat)}
                            />
                            <span className="kpiMultiSelectItemLabel">{cat}</span>
                            <span className="kpiMultiSelectItemCount" title={`${count} ตัวชี้วัด`}>
                              {count}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )
              )}

              {filteredCategoryGroups.all.length === 0 && (
                <div className="kpiMultiSelectEmpty">
                  ไม่พบหมวดหมู่หรือยุทธศาสตร์ที่ตรงกับ &ldquo;{categorySearchQuery}&rdquo;
                </div>
              )}
            </div>

            <div className="kpiMultiSelectFooter">
              <span className="kpiMultiSelectFooterHint">
                {selectedCategories.length === 0
                  ? 'ยังไม่ได้เลือกหมวด (แสดงตัวชี้วัดทั้งหมด)'
                  : `กรองเฉพาะ ${selectedCategories.length} หมวดที่เลือก`}
              </span>
              <button
                type="button"
                className="kpiMultiSelectDoneBtn"
                onClick={() => setCategoryMultiSelectOpen(false)}
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export interface KpiIndicatorRowProps {
  ind: KpiIndicatorItem
  idx: number
  selectedYear: string
  isKpiManager: boolean
  getActivePeriodEntry: (ind: KpiIndicatorItem) => any
  canAnswerIndicator: (ind: KpiIndicatorItem) => boolean
  canEditIndicator: (ind: KpiIndicatorItem) => boolean
  canDeleteIndicator: (ind: KpiIndicatorItem) => boolean
  renderStatusBadge: (
    ind: KpiIndicatorItem,
    entry: any,
    isLocked: boolean,
    dueStatus: IndicatorDueStatus
  ) => React.ReactNode
  handleOpenHistoryModal: (ind: KpiIndicatorItem) => void
  handleOpenAnswer: (ind: KpiIndicatorItem) => void
  handleOpenEditIndicator: (ind: KpiIndicatorItem) => void
  handleDeleteIndicator: (ind: KpiIndicatorItem) => void
}

export function KpiIndicatorRow({
  ind,
  idx,
  selectedYear,
  isKpiManager,
  getActivePeriodEntry,
  canAnswerIndicator,
  canEditIndicator,
  canDeleteIndicator,
  renderStatusBadge,
  handleOpenHistoryModal,
  handleOpenAnswer,
  handleOpenEditIndicator,
  handleDeleteIndicator,
}: KpiIndicatorRowProps) {
  const entry = getActivePeriodEntry(ind)
  const periods = getPeriodsForFrequency(ind.frequency)
  const totalRounds = periods.length
  const answeredRounds = periods.filter((p) => isIndicatorAnsweredForPeriod(ind, p.key)).length
  const answerDisplay = formatAnswerDisplay(entry, ind.targetUnit, ind)
  const dueStatus = checkIndicatorDueStatus(ind.frequency, selectedYear)
  const isLocked = !dueStatus.isDueNow && !isKpiManager
  const userCanAnswer = canAnswerIndicator(ind)
  const userCanEdit = canEditIndicator(ind)
  const userCanDelete = canDeleteIndicator(ind)

  const isPctInd = isPercentageIndicator(ind)
  const isRateInd = isRateIndicator(ind)
  const defaultTargetUnit = isPctInd ? '%' : ''
  const formattedTargetVal =
    ind.targetValue !== null && ind.targetValue !== undefined
      ? formatKpiDecimal(Number(ind.targetValue), {
          minDecimals: isRateInd ? 2 : 0,
          maxDecimals: 6,
          normalDecimals: 4,
        })
      : null
  const targetText =
    formattedTargetVal !== null
      ? `${ind.targetOperator || '>='} ${formattedTargetVal}${ind.targetUnit || defaultTargetUnit}`
      : ind.targetRaw || '-'

  return (
    <div className="kpiGridRow" role="row">
      <div className="kpiMobileCardHeader mobileOnly">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="kpiColSeq">#{ind.sequence || idx + 1}</span>
          <span className="kpiTypeBadge">{ind.indicatorType || 'HA'}</span>
        </div>
        <div>{renderStatusBadge(ind, entry, isLocked, dueStatus)}</div>
      </div>

      <div className="kpiColSeq desktopOnly" role="cell">
        {ind.sequence || idx + 1}
      </div>

      <div className="kpiColTitle" role="cell">
        <div className="kpiIndicatorTitle">{ind.title}</div>
        <div className="kpiIndicatorMeta">
          <span>{ind.category}</span>
          {ind.subcategory && <span>› {ind.subcategory}</span>}
          {ind.code && <span style={{ opacity: 0.75 }}>({ind.code})</span>}
        </div>
        {(ind.numeratorName || ind.denominatorName) && (
          <div className="kpiSubquestionsBox">
            {ind.numeratorName && <div><strong>ตัวตั้ง:</strong> {ind.numeratorName}</div>}
            {ind.denominatorName && <div><strong>ตัวหาร:</strong> {ind.denominatorName}</div>}
          </div>
        )}
      </div>

      <div className="kpiMobileMetaGrid mobileOnly">
        <div className="kpiMobileMetaItem">
          <label>ความถี่</label>
          <span>{ind.frequency}</span>
        </div>
        <div className="kpiMobileMetaItem">
          <label>เป้าหมาย</label>
          <span>{targetText}</span>
        </div>
        <div className="kpiMobileMetaItem">
          <label>ผลงาน</label>
          <span className={answerDisplay ? 'kpiResultValue' : ''}>
            {answerDisplay ? `${answerDisplay.main} ${answerDisplay.sub || ''}`.trim() : '-'}
          </span>
          {ind.aiAudit && (
            <button
              type="button"
              className={`kpiAiAuditBadge ${ind.aiAudit.status.toLowerCase()}`}
              onClick={() => handleOpenHistoryModal(ind)}
              title={ind.aiAudit.explanationTh || getAiAuditStatusLabel(ind.aiAudit.status)}
            >
              {ind.aiAudit.status === 'MATCH' && <ShieldCheck size={11} />}
              {ind.aiAudit.status === 'MISMATCH' && <AlertTriangle size={11} />}
              {(ind.aiAudit.status === 'NO_HUMAN_ENTRY' || ind.aiAudit.status === 'MANUAL_OR_HYBRID') && <Clock size={11} />}
              <span>
                {ind.aiAudit.status === 'MATCH'
                  ? 'AI ตรงกัน'
                  : ind.aiAudit.status === 'MISMATCH'
                    ? `AI: ${formatAiAuditNumbers(ind.aiAudit, ind)}`
                    : ind.aiAudit.status === 'NO_HUMAN_ENTRY'
                      ? `HOSxP: ${formatAiAuditNumbers(ind.aiAudit, ind)}`
                      : getAiAuditStatusLabel(ind.aiAudit.status)}
              </span>
            </button>
          )}
          <button
            type="button"
            className="kpiHistoryBtn"
            style={{ marginTop: '4px', height: '28px', fontSize: '11.5px', padding: '0 8px' }}
            onClick={() => handleOpenHistoryModal(ind)}
            title="ดูข้อมูลย้อนหลังแต่ละรอบ"
          >
            <History size={12} />
            <span>ดูประวัติ ({answeredRounds}/{totalRounds})</span>
          </button>
        </div>
        <div className="kpiMobileMetaItem">
          <label>ผู้รับผิดชอบ</label>
          <span>{ind.responsibleName || '-'}</span>
        </div>
      </div>

      <div className="kpiColFreq desktopOnly" role="cell">{ind.frequency}</div>
      <div className="kpiColTarget desktopOnly" role="cell">{targetText}</div>

      <div className="kpiColResult desktopOnly" role="cell">
        {answerDisplay ? (
          <div
            className="kpiResultBlock"
            title={answerDisplay.fullSub ? `${answerDisplay.main} (${answerDisplay.fullSub})` : answerDisplay.main}
          >
            <span className="kpiResultValue">{answerDisplay.main}</span>
            {answerDisplay.sub && (
              <span className="kpiResultSub" title={answerDisplay.fullSub || answerDisplay.sub}>
                {answerDisplay.sub}
              </span>
            )}
          </div>
        ) : (
          <span className="kpiResultEmpty">-</span>
        )}
        {totalRounds > 1 && (
          <span
            className="kpiResultRoundsBadge"
            onClick={() => handleOpenHistoryModal(ind)}
            title={`คลิกเพื่อดูข้อมูลย้อนหลังทุกรอบ (ตอบแล้ว ${answeredRounds}/${totalRounds} รอบ)`}
          >
            ตอบแล้ว {answeredRounds}/{totalRounds} รอบ
          </span>
        )}
        {ind.aiAudit && (
          <button
            type="button"
            className={`kpiAiAuditBadge ${ind.aiAudit.status.toLowerCase()}`}
            onClick={() => handleOpenHistoryModal(ind)}
            title={ind.aiAudit.explanationTh || getAiAuditStatusLabel(ind.aiAudit.status)}
          >
            {ind.aiAudit.status === 'MATCH' && <ShieldCheck size={11} />}
            {ind.aiAudit.status === 'MISMATCH' && <AlertTriangle size={11} />}
            {(ind.aiAudit.status === 'NO_HUMAN_ENTRY' || ind.aiAudit.status === 'MANUAL_OR_HYBRID') && <Clock size={11} />}
            <span>
              {ind.aiAudit.status === 'MATCH'
                ? 'AI ตรงกัน'
                : ind.aiAudit.status === 'MISMATCH'
                  ? `AI: ${formatAiAuditNumbers(ind.aiAudit, ind)}`
                  : ind.aiAudit.status === 'NO_HUMAN_ENTRY'
                    ? `HOSxP: ${formatAiAuditNumbers(ind.aiAudit, ind)}`
                    : getAiAuditStatusLabel(ind.aiAudit.status)}
            </span>
          </button>
        )}
      </div>

      <div className="kpiColResp desktopOnly" role="cell" title={ind.responsibleName || undefined}>
        {ind.responsibleName || '-'}
      </div>

      <div className="kpiColStatus desktopOnly" role="cell">
        {renderStatusBadge(ind, entry, isLocked, dueStatus)}
      </div>

      <div className="kpiColType desktopOnly" role="cell">
        <span className="kpiTypeBadge">{ind.indicatorType || 'HA'}</span>
      </div>

      <div className="kpiColAction" role="cell">
        <button
          type="button"
          className="kpiHistoryBtn"
          onClick={() => handleOpenHistoryModal(ind)}
          title={`ดูข้อมูลย้อนหลังในแต่ละรอบ (ตอบแล้ว ${answeredRounds}/${totalRounds} รอบ)`}
        >
          <History size={13} />
          <span>ประวัติ</span>
        </button>

        {userCanAnswer ? (
          <button
            type="button"
            className="kpiRowBtn"
            onClick={() => handleOpenAnswer(ind)}
            title={entry ? 'แก้ไขผลการดำเนินงาน' : 'บันทึกผลการดำเนินงาน'}
          >
            <span>บันทึก</span>
          </button>
        ) : (
          <button
            type="button"
            className="kpiRowBtn"
            onClick={() => handleOpenAnswer(ind)}
            style={{ opacity: 0.65 }}
            title="ดูรายละเอียดการประเมิน"
          >
            <span>ดูผล</span>
          </button>
        )}

        {userCanEdit && (
          <button
            type="button"
            className="kpiIconBtn"
            title="แก้ไขตัวชี้วัด"
            onClick={() => handleOpenEditIndicator(ind)}
          >
            <Edit size={14} />
          </button>
        )}
        {userCanDelete && (
          <button
            type="button"
            className="kpiIconBtn danger"
            title="ลบตัวชี้วัด"
            onClick={() => handleDeleteIndicator(ind)}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {answerDisplay && (entry?.updatedAt || entry?.recordedAt) && (
        <div className="kpiRowTimestamp">
          ตอบเมื่อ {formatThaiDateTime(entry.updatedAt || entry.recordedAt)}
        </div>
      )}
    </div>
  )
}
