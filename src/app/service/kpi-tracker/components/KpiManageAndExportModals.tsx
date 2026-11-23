'use client'

import React from 'react'
import {
  X,
  Hash,
  Layers,
  ChevronDown,
  FileText,
  Target,
  Check,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
  AlertCircle,
} from 'lucide-react'
import type { ParsedKpiRow } from '@/lib/kpi/kpiExcelParser'
import type { KpiIndicatorItem, KpiTopicItem } from '@/lib/kpi/kpiService'

export function KpiManageAndExportModals(props: {
  editIndicatorModalOpen: boolean
  setEditIndicatorModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  isCreatingNew: boolean
  indFormSequence: string
  setIndFormSequence: React.Dispatch<React.SetStateAction<string>>
  indFormCode: string
  setIndFormCode: React.Dispatch<React.SetStateAction<string>>
  indFormOldCode: string
  setIndFormOldCode: React.Dispatch<React.SetStateAction<string>>
  indFormCategory: string
  setIndFormCategory: React.Dispatch<React.SetStateAction<string>>
  indFormSubcategory: string
  setIndFormSubcategory: React.Dispatch<React.SetStateAction<string>>
  indFormFrequency: string
  setIndFormFrequency: React.Dispatch<React.SetStateAction<string>>
  indFormType: string
  setIndFormType: React.Dispatch<React.SetStateAction<string>>
  indFormResponsible: string
  setIndFormResponsible: React.Dispatch<React.SetStateAction<string>>
  indFormTitle: string
  setIndFormTitle: React.Dispatch<React.SetStateAction<string>>
  indFormNumeratorName: string
  setIndFormNumeratorName: React.Dispatch<React.SetStateAction<string>>
  indFormDenominatorName: string
  setIndFormDenominatorName: React.Dispatch<React.SetStateAction<string>>
  indFormTargetOp: string
  setIndFormTargetOp: React.Dispatch<React.SetStateAction<string>>
  indFormTargetVal: string
  setIndFormTargetVal: React.Dispatch<React.SetStateAction<string>>
  indFormTargetUnit: string
  setIndFormTargetUnit: React.Dispatch<React.SetStateAction<string>>
  indFormTargetRaw: string
  setIndFormTargetRaw: React.Dispatch<React.SetStateAction<string>>
  setIndFormTargetRawDirty: React.Dispatch<React.SetStateAction<boolean>>
  syncTargetRawIfClean: (nextOp: string, nextVal: string, nextUnit: string) => void
  handleSaveIndicator: () => Promise<void>
  saving: boolean
  exportModalOpen: boolean
  setExportModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  exporting: boolean
  selectedYear: string
  exportTopicId: number | null
  setExportTopicId: React.Dispatch<React.SetStateAction<number | null>>
  selectedTopicId: number | null
  topics: KpiTopicItem[]
  exportCategory: string
  setExportCategory: React.Dispatch<React.SetStateAction<string>>
  categories: string[]
  exportPeriodKey: string
  setExportPeriodKey: React.Dispatch<React.SetStateAction<string>>
  exportScope: 'ALL' | 'DUE'
  setExportScope: React.Dispatch<React.SetStateAction<'ALL' | 'DUE'>>
  indicators: KpiIndicatorItem[]
  dueIndicatorsCount: number
  handleExportExcel: (scope?: 'ALL' | 'DUE') => Promise<void>
  importModalOpen: boolean
  setImportModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  importYear: string
  setImportYear: React.Dispatch<React.SetStateAction<string>>
  defaultFiscalYear: string
  importCode: string
  setImportCode: React.Dispatch<React.SetStateAction<string>>
  importTitle: string
  setImportTitle: React.Dispatch<React.SetStateAction<string>>
  importIndicators: ParsedKpiRow[]
  setImportIndicators: React.Dispatch<React.SetStateAction<ParsedKpiRow[]>>
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  dragActive: boolean
  setDragActive: React.Dispatch<React.SetStateAction<boolean>>
  importParsing: boolean
  handleFileDrop: (e: React.DragEvent) => void
  importError: string | null
  setImportError: React.Dispatch<React.SetStateAction<string | null>>
  importFileName: string | null
  setImportFileName: React.Dispatch<React.SetStateAction<string | null>>
  handleExecuteImport: () => Promise<void>
}) {
  const {
    editIndicatorModalOpen,
    setEditIndicatorModalOpen,
    isCreatingNew,
    indFormSequence,
    setIndFormSequence,
    indFormCode,
    setIndFormCode,
    indFormOldCode,
    setIndFormOldCode,
    indFormCategory,
    setIndFormCategory,
    indFormSubcategory,
    setIndFormSubcategory,
    indFormFrequency,
    setIndFormFrequency,
    indFormType,
    setIndFormType,
    indFormResponsible,
    setIndFormResponsible,
    indFormTitle,
    setIndFormTitle,
    indFormNumeratorName,
    setIndFormNumeratorName,
    indFormDenominatorName,
    setIndFormDenominatorName,
    indFormTargetOp,
    setIndFormTargetOp,
    indFormTargetVal,
    setIndFormTargetVal,
    indFormTargetUnit,
    setIndFormTargetUnit,
    indFormTargetRaw,
    setIndFormTargetRaw,
    setIndFormTargetRawDirty,
    syncTargetRawIfClean,
    handleSaveIndicator,
    saving,
    exportModalOpen,
    setExportModalOpen,
    exporting,
    selectedYear,
    exportTopicId,
    setExportTopicId,
    selectedTopicId,
    topics,
    exportCategory,
    setExportCategory,
    categories,
    exportPeriodKey,
    setExportPeriodKey,
    exportScope,
    setExportScope,
    indicators,
    dueIndicatorsCount,
    handleExportExcel,
    importModalOpen,
    setImportModalOpen,
    importYear,
    setImportYear,
    defaultFiscalYear,
    importCode,
    setImportCode,
    importTitle,
    setImportTitle,
    importIndicators,
    setImportIndicators,
    handleFileInputChange,
    dragActive,
    setDragActive,
    importParsing,
    handleFileDrop,
    importError,
    setImportError,
    importFileName,
    setImportFileName,
    handleExecuteImport,
  } = props

  return (
    <>
        {/* ── MODAL 2: EDIT / CREATE INDICATOR (Columns A - N) ── */}
        {editIndicatorModalOpen && (
          <div className="kpiModalOverlay" onClick={() => setEditIndicatorModalOpen(false)}>
            <div className="kpiModalCard kpiModalCardWide" onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <div className="kpiModalSubBadge">
                    {isCreatingNew ? 'สร้างตัวชี้วัดใหม่' : 'แก้ไขโครงสร้างตัวชี้วัด (Columns A — N)'}
                  </div>
                  <h2>{isCreatingNew ? 'เพิ่มตัวชี้วัดลงในชุดข้อมูล' : 'แก้ไขข้อมูลตัวชี้วัด'}</h2>
                </div>
                <button className="kpiModalClose" onClick={() => setEditIndicatorModalOpen(false)} aria-label="ปิดหน้าต่าง">
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody">
                {/* Section 1: ข้อมูลลำดับและรหัสอ้างอิง */}
                <div className="kpiFormSection">
                  <div className="kpiSectionHeader">
                    <Hash size={16} />
                    <span>ข้อมูลลำดับและรหัสอ้างอิง</span>
                  </div>
                  <div className="kpiFormGridCustom1">
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ลำดับ</span>
                        <span className="kpiColBadge">A</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น 1, 32"
                        className="kpiTextInput"
                        value={indFormSequence}
                        onChange={(e) => setIndFormSequence(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>รหัสตัวชี้วัด</span>
                        <span className="kpiColBadge">D</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น HR-GID-0201"
                        className="kpiTextInput"
                        value={indFormCode}
                        onChange={(e) => setIndFormCode(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>รหัสเดิม</span>
                        <span className="kpiColBadge">E</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น DG0201 (ถ้ามี)"
                        className="kpiTextInput"
                        value={indFormOldCode}
                        onChange={(e) => setIndFormOldCode(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: หมวดหมู่และการจัดกลุ่มข้อมูล */}
                <div className="kpiFormSection">
                  <div className="kpiSectionHeader">
                    <Layers size={16} />
                    <span>หมวดหมู่และการจัดกลุ่มข้อมูล</span>
                  </div>
                  <div className="kpiFormGrid2">
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>หมวดตัวชี้วัด</span>
                        <span className="kpiColBadge">B</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ หรือ ยุทธศาสตร์ที่1"
                        className="kpiTextInput"
                        value={indFormCategory}
                        onChange={(e) => setIndFormCategory(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ประเด็น / กลุ่มโรค</span>
                        <span className="kpiColBadge">C</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น โรคเรื้อรัง, Fast Track..."
                        className="kpiTextInput"
                        value={indFormSubcategory}
                        onChange={(e) => setIndFormSubcategory(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="kpiFormGridCustom2">
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ความถี่การรายงาน</span>
                        <span className="kpiColBadge">F</span>
                      </label>
                      <div className="kpiSelectWrapper">
                        <select 
                          className="kpiSelectInput"
                          value={indFormFrequency}
                          onChange={(e) => setIndFormFrequency(e.target.value)}
                        >
                          <option value="ราย 6 เดือน">ราย 6 เดือน</option>
                          <option value="รายไตรมาส">รายไตรมาส</option>
                          <option value="รายเดือน">รายเดือน</option>
                          <option value="รายปี">รายปี</option>
                        </select>
                        <ChevronDown size={16} className="kpiSelectArrow" />
                      </div>
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ประเภท</span>
                        <span className="kpiColBadge">N</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น HA, Zone"
                        className="kpiTextInput"
                        value={indFormType}
                        onChange={(e) => setIndFormType(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ผู้รับผิดชอบ</span>
                        <span className="kpiColBadge">K</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="ระบุชื่อบุคลากรหรือทีมงาน..."
                        className="kpiTextInput"
                        value={indFormResponsible}
                        onChange={(e) => setIndFormResponsible(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: นิยามและคำถามตัวชี้วัด */}
                <div className="kpiFormSection">
                  <div className="kpiSectionHeader">
                    <FileText size={16} />
                    <span>นิยามและคำถามตัวชี้วัด</span>
                  </div>

                  <div className="kpiFormGroup">
                    <label className="kpiFormLabel">
                      <span>ตัวชี้วัด / คำถามหลัก <span className="kpiRequired">*</span></span>
                      <span className="kpiColBadge primary">G</span>
                    </label>
                    <textarea 
                      placeholder="กรอกชื่อตัวชี้วัดหรือคำถามหลักที่ต้องการจัดเก็บผลการดำเนินงาน..."
                      className="kpiTextarea"
                      rows={3}
                      value={indFormTitle}
                      onChange={(e) => setIndFormTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="kpiFormGrid2">
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ตัวตั้ง / คำถามรอง 1</span>
                        <span className="kpiColBadge">H</span>
                      </label>
                      <textarea 
                        placeholder="คำอธิบายตัวตั้ง (ถ้ามี)..."
                        className="kpiTextarea"
                        rows={2}
                        value={indFormNumeratorName}
                        onChange={(e) => setIndFormNumeratorName(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ตัวหาร / คำถามรอง 2</span>
                        <span className="kpiColBadge">I</span>
                      </label>
                      <textarea 
                        placeholder="คำอธิบายตัวหาร (ถ้ามี)..."
                        className="kpiTextarea"
                        rows={2}
                        value={indFormDenominatorName}
                        onChange={(e) => setIndFormDenominatorName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="kpiFormHint">
                    💡 หากระบุทั้งตัวตั้ง (H) และตัวหาร (I) ระบบจะเปิดโหมดคำนวณร้อยละอัตโนมัติ (ตัวตั้ง ÷ ตัวหาร × 100)
                  </div>
                </div>

                {/* Section 4: เกณฑ์เป้าหมาย (J) */}
                <div className="kpiTargetBox">
                  <div className="kpiSectionHeader">
                    <Target size={16} />
                    <span>เกณฑ์เป้าหมายและการประเมิน (J)</span>
                  </div>

                  <div className="kpiTargetGrid">
                    <div className="kpiTargetField">
                      <label className="kpiMiniLabel">เครื่องหมาย</label>
                      <div className="kpiSelectWrapper">
                        <select 
                          className="kpiSelectInput"
                          value={indFormTargetOp}
                          onChange={(e) => {
                            const nextOp = e.target.value
                            setIndFormTargetOp(nextOp)
                            syncTargetRawIfClean(nextOp, indFormTargetVal, indFormTargetUnit)
                          }}
                        >
                          <option value=">=">&gt;= (มากกว่าเท่ากับ)</option>
                          <option value="<=">&lt;= (น้อยกว่าเท่ากับ)</option>
                          <option value=">">&gt; (มากกว่า)</option>
                          <option value="<">&lt; (น้อยกว่า)</option>
                          <option value="=">= (เท่ากับ)</option>
                          <option value="MIN">น้อยที่สุด (MIN)</option>
                        </select>
                        <ChevronDown size={16} className="kpiSelectArrow" />
                      </div>
                    </div>
                    <div className="kpiTargetField">
                      <label className="kpiMiniLabel">ค่าเป้าหมาย (ตัวเลข)</label>
                      <input 
                        type="number"
                        step="any"
                        placeholder="เช่น 40, 0"
                        className="kpiTextInput"
                        value={indFormTargetVal}
                        onChange={(e) => {
                          const nextVal = e.target.value
                          setIndFormTargetVal(nextVal)
                          syncTargetRawIfClean(indFormTargetOp, nextVal, indFormTargetUnit)
                        }}
                      />
                    </div>
                    <div className="kpiTargetField">
                      <label className="kpiMiniLabel">หน่วย</label>
                      <input 
                        type="text"
                        placeholder="เช่น % หรือเว้นว่าง"
                        className="kpiTextInput"
                        value={indFormTargetUnit}
                        onChange={(e) => {
                          const nextUnit = e.target.value
                          setIndFormTargetUnit(nextUnit)
                          syncTargetRawIfClean(indFormTargetOp, indFormTargetVal, nextUnit)
                        }}
                      />
                    </div>
                    <div className="kpiTargetField">
                      <label className="kpiMiniLabel">ข้อความกำกับเต็ม (Raw)</label>
                      <input 
                        type="text"
                        placeholder="ข้อความ เช่น ≥ 40%"
                        className="kpiTextInput"
                        value={indFormTargetRaw}
                        onChange={(e) => {
                          setIndFormTargetRaw(e.target.value)
                          setIndFormTargetRawDirty(true)
                        }}
                      />
                    </div>
                  </div>

                  {/* Target Live Preview */}
                  <div className="kpiTargetPreview">
                    <span>ตัวอย่างผลลัพธ์เกณฑ์เป้าหมาย:</span>
                    <span className="kpiTargetPreviewBadge">
                      {indFormTargetVal.trim() !== ''
                        ? `${indFormTargetOp} ${indFormTargetVal.trim()}${indFormTargetUnit.trim()}`
                        : (indFormTargetOp === 'MIN' ? 'MIN' : (indFormTargetRaw.trim() || 'รอระบุเป้าหมาย'))}
                      {indFormTargetVal.trim() !== '' && indFormTargetRaw.trim() && indFormTargetRaw.trim() !== `${indFormTargetOp} ${indFormTargetVal.trim()}${indFormTargetUnit.trim()}`
                        ? ` (${indFormTargetRaw.trim()})`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="kpiModalFooter">
                <button 
                  className="kpiBtn kpiBtnSecondary" 
                  onClick={() => setEditIndicatorModalOpen(false)}
                >
                  <X size={16} />
                  ยกเลิก
                </button>
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={handleSaveIndicator}
                  disabled={saving}
                >
                  <Check size={16} />
                  {saving ? 'กำลังบันทึก...' : (isCreatingNew ? 'เพิ่มตัวชี้วัด' : 'บันทึกการแก้ไข')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 4: EXPORT EXCEL SELECTION MODAL ── */}
        {exportModalOpen && (
          <div className="kpiModalOverlay" onClick={() => !exporting && setExportModalOpen(false)}>
            <div className="kpiModalCard" style={{ maxWidth: '520px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <div className="kpiModalPreTitle">ดาวน์โหลดข้อมูลตัวชี้วัด</div>
                  <h2>ส่งออกรายงานตัวชี้วัด Excel (.xlsx)</h2>
                </div>
                <button 
                  type="button"
                  className="kpiModalClose" 
                  onClick={() => !exporting && setExportModalOpen(false)} 
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
                  เลือกเงื่อนไขส่งออกข้อมูลตัวชี้วัดสำหรับปีงบประมาณ <strong>{selectedYear}</strong>:
                </p>

                {/* 1. เลือกหัวข้อ / ชุดตัวชี้วัด (Topic) */}
                <div className="kpiFormGroup" style={{ marginBottom: 0 }}>
                  <label className="kpiFormLabel">
                    <span>หัวข้อ / ชุดตัวชี้วัด:</span>
                  </label>
                  <div className="kpiSelectWrapper">
                    <select
                      className="kpiSelectInput"
                      value={exportTopicId || selectedTopicId || ''}
                      onChange={(e) => setExportTopicId(Number(e.target.value))}
                    >
                      {topics
                        .filter(t => !selectedYear || t.fiscalYear === selectedYear)
                        .map(t => (
                          <option key={t.id} value={t.id}>{t.title} ({t.code})</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="kpiSelectArrow" />
                  </div>
                </div>

                {/* 2. เลือกหมวดหมู่ / ยุทธศาสตร์ (Category) */}
                <div className="kpiFormGroup" style={{ marginBottom: 0 }}>
                  <label className="kpiFormLabel">
                    <span>หมวดหมู่ / ยุทธศาสตร์:</span>
                  </label>
                  <div className="kpiSelectWrapper">
                    <select
                      className="kpiSelectInput"
                      value={exportCategory}
                      onChange={(e) => setExportCategory(e.target.value)}
                    >
                      <option value="ALL">ทุกหมวดหมู่ (ตัวชี้วัดทั้งหมดในหัวข้อนี้)</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="kpiSelectArrow" />
                  </div>
                </div>

                {/* 3. เลือกรอบการประเมิน (Period) */}
                <div className="kpiFormGroup" style={{ marginBottom: 0 }}>
                  <label className="kpiFormLabel">
                    <span>รอบการประเมิน:</span>
                  </label>
                  <div className="kpiSelectWrapper">
                    <select
                      className="kpiSelectInput"
                      value={exportPeriodKey}
                      onChange={(e) => setExportPeriodKey(e.target.value)}
                    >
                      <option value="ALL">ทุกรอบ (ดึงคำตอบล่าสุด และแนบประวัติทุกรอบ)</option>
                      <option value="H1">รอบ 6 เดือนแรก (H1)</option>
                      <option value="H2">รอบ 6 เดือนหลัง (H2)</option>
                      <option value="Q1">ไตรมาสที่ 1 (Q1)</option>
                      <option value="Q2">ไตรมาสที่ 2 (Q2)</option>
                      <option value="Q3">ไตรมาสที่ 3 (Q3)</option>
                      <option value="Q4">ไตรมาสที่ 4 (Q4)</option>
                      <option value="YEAR">รอบสิ้นปีงบประมาณ (รายปี)</option>
                    </select>
                    <ChevronDown size={16} className="kpiSelectArrow" />
                  </div>
                </div>

                {/* 4. ขอบเขตตัวชี้วัด */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="kpiFormLabel" style={{ marginBottom: 0 }}>
                    <span>ขอบเขตรายการ:</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: exportScope === 'ALL' ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: exportScope === 'ALL' ? 'var(--row-hover)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      value="ALL"
                      checked={exportScope === 'ALL'}
                      onChange={() => setExportScope('ALL')}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600, color: 'var(--ink)' }}>
                        <span>ตัวชี้วัดทั้งหมด</span>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'var(--waiting-bg)', color: 'var(--ink-muted)' }}>
                          {indicators.length} รายการ
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
                        ส่งออกตัวชี้วัดทั้งหมดในหัวข้อนี้ พร้อมคำตอบที่บันทึกแล้ว
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: exportScope === 'DUE' ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: exportScope === 'DUE' ? 'var(--row-hover)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      value="DUE"
                      checked={exportScope === 'DUE'}
                      onChange={() => setExportScope('DUE')}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600, color: 'var(--ink)' }}>
                        <span>ตัวที่ถึงเวลา</span>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'var(--status-bg)', color: 'var(--status-ink)', fontWeight: 600 }}>
                          {dueIndicatorsCount} รายการ
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
                        ส่งออกเฉพาะตัวชี้วัดที่ถึงรอบตอบแล้ว ณ ปัจจุบัน หรือจะถึงรอบใน 5 วัน
                      </div>
                    </div>
                  </label>
                </div>

                {/* Reassurance note */}
                <div style={{ background: 'var(--head-bg)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--ink)', lineHeight: 1.45, borderLeft: '3px solid var(--accent)' }}>
                  ระบบจะดึงคำตอบของแต่ละคำถาม (ตัวตั้ง ตัวหาร ผลงาน และสถานะประเมิน) ติดมาด้วยในไฟล์ Excel พร้อมสรุปประวัติคำตอบในแต่ละรอบ
                </div>
              </div>

              <div className="kpiModalFooter">
                <button
                  type="button"
                  className="kpiBtn kpiBtnSecondary"
                  onClick={() => setExportModalOpen(false)}
                  disabled={exporting}
                >
                  <X size={16} />
                  <span>ยกเลิก</span>
                </button>
                <button
                  type="button"
                  className="kpiBtn kpiBtnPrimary"
                  onClick={() => handleExportExcel(exportScope)}
                  disabled={exporting}
                >
                  <FileSpreadsheet size={16} />
                  <span>{exporting ? 'กำลังส่งออก Excel...' : 'ส่งออกไฟล์ Excel'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 3: IMPORT EXCEL / CSV (ADMIN ONLY) ── */}
        {importModalOpen && (
          <div className="kpiModalOverlay" onClick={() => setImportModalOpen(false)}>
            <div className="kpiModalCard" style={{ maxWidth: '840px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <div className="kpiModalSubBadge">
                    ผู้ดูแลระบบ (Admin)
                  </div>
                  <h2>นำเข้าชุดตัวชี้วัด (Excel .xlsx / CSV)</h2>
                </div>
                <button className="kpiModalClose" onClick={() => setImportModalOpen(false)} aria-label="ปิดหน้าต่าง">
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody">
                <div className="kpiFormGridCustom2" style={{ marginBottom: '0.5rem' }}>
                  <div className="kpiFormGroup">
                    <label className="kpiFormLabel"><span>ปีงบประมาณ</span></label>
                    <input 
                      type="text"
                      className="kpiTextInput"
                      value={importYear}
                      onChange={(e) => setImportYear(e.target.value)}
                      placeholder={`เช่น ${defaultFiscalYear}`}
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label className="kpiFormLabel"><span>รหัสชุดตัวชี้วัด</span></label>
                    <input 
                      type="text"
                      className="kpiTextInput"
                      value={importCode}
                      onChange={(e) => setImportCode(e.target.value)}
                      placeholder="เช่น THIP70final หรือ HA_2570"
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label className="kpiFormLabel"><span>ชื่อชุดตัวชี้วัด</span></label>
                    <input 
                      type="text"
                      className="kpiTextInput"
                      value={importTitle}
                      onChange={(e) => setImportTitle(e.target.value)}
                      placeholder="เช่น THIP70final หรือ ตัวชี้วัดยุทธศาสตร์"
                    />
                  </div>
                </div>

                {/* Upload or Preview */}
                {importIndicators.length === 0 ? (
                  <div>
                    <input 
                      type="file"
                      id="kpi-file-upload-input"
                      accept=".xlsx, .xls, .csv"
                      style={{ display: 'none' }}
                      onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
                      onChange={handleFileInputChange}
                    />
                    <div 
                      className={`kpiDropzone ${dragActive ? 'kpiDropzoneActive' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!importParsing) setDragActive(true); }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                      onDrop={(e) => { if (!importParsing) handleFileDrop(e); }}
                      onClick={() => { if (!importParsing) document.getElementById('kpi-file-upload-input')?.click(); }}
                      style={{ opacity: importParsing ? 0.7 : 1, cursor: importParsing ? 'wait' : 'pointer' }}
                    >
                      {importParsing ? (
                        <RefreshCw size={44} className="kpiDropzoneIcon animate-spin" />
                      ) : (
                        <UploadCloud size={44} className="kpiDropzoneIcon" />
                      )}
                      <div className="kpiDropzoneTitle">
                        {importParsing ? 'กำลังอ่านและแปลงข้อมูลไฟล์...' : 'ลากไฟล์ Excel (.xlsx) มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
                      </div>
                      <div className="kpiDropzoneSub">
                        {importParsing 
                          ? 'ระบบกำลังแยกและตรวจสอบคอลัมน์ตัวชี้วัด กรุณารอสักครู่...' 
                          : 'รองรับไฟล์ Microsoft Excel (.xlsx, .xls) หรือ CSV (คอลัมน์ A ถึง N)'}
                      </div>
                      {!importParsing && (
                        <button 
                          type="button" 
                          className="kpiBtn kpiBtnSecondary" 
                          style={{ marginTop: '0.75rem', pointerEvents: 'none' }}
                        >
                          <FileSpreadsheet size={16} />
                          เลือกไฟล์จากคอมพิวเตอร์
                        </button>
                      )}
                    </div>

                    {importError && (
                      <div style={{
                        marginTop: '0.875rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '0.5rem',
                        color: '#991b1b',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <AlertCircle size={18} />
                        <span>{importError}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="kpiImportPreviewContainer">
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'var(--kpi-teal-50)',
                      border: '1px solid var(--kpi-teal-200)',
                      borderRadius: '0.625rem',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <FileSpreadsheet size={22} style={{ color: 'var(--kpi-teal-700)' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--kpi-neutral-900)' }}>
                            {importFileName || 'ไฟล์ข้อมูลที่เลือก'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--kpi-teal-800)' }}>
                            ตรวจพบข้อมูลตัวชี้วัดทั้งหมด <strong>{importIndicators.length}</strong> รายการ
                          </div>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="kpiBtn kpiBtnSecondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => {
                          setImportIndicators([])
                          setImportFileName(null)
                          setImportError(null)
                        }}
                      >
                        เปลี่ยนไฟล์
                      </button>
                    </div>

                    <div className="kpiImportTableWrap">
                      <table className="kpiImportTable">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th style={{ width: '70px' }}>รหัส</th>
                            <th style={{ width: '130px' }}>หมวด</th>
                            <th>ตัวชี้วัด / คำถาม</th>
                            <th style={{ width: '90px' }}>รูปแบบ</th>
                            <th style={{ width: '80px' }}>เป้าหมาย</th>
                            <th style={{ width: '90px' }}>ความถี่</th>
                            <th style={{ width: '110px' }}>ผู้รับผิดชอบ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importIndicators.slice(0, 6).map((ind, idx) => {
                            const hasFormula = Boolean(ind.numeratorName && ind.denominatorName)
                            return (
                              <tr key={idx}>
                                <td>{ind.sequence || idx + 1}</td>
                                <td><strong style={{ color: 'var(--kpi-teal-800)' }}>{ind.code}</strong></td>
                                <td style={{ fontSize: '0.75rem', color: 'var(--kpi-neutral-600)' }}>{ind.category || '-'}</td>
                                <td>
                                  <div style={{ fontWeight: 500, color: 'var(--kpi-neutral-900)' }}>{ind.title}</div>
                                  {hasFormula && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--kpi-teal-700)', marginTop: '2px' }}>
                                      ตัวตั้ง: {ind.numeratorName?.slice(0, 30)}... / ตัวหาร: {ind.denominatorName?.slice(0, 30)}...
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {hasFormula ? (
                                    <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>
                                      ตัวตั้ง/ตัวหาร
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.72rem', background: '#f3f4f6', color: '#4b5563', padding: '2px 6px', borderRadius: '4px' }}>
                                      ตอบโดยตรง
                                    </span>
                                  )}
                                </td>
                                <td style={{ fontSize: '0.8rem' }}>{ind.targetRaw || '-'}</td>
                                <td style={{ fontSize: '0.75rem' }}>{ind.frequency}</td>
                                <td style={{ fontSize: '0.75rem', color: 'var(--kpi-neutral-700)' }}>{ind.responsibleName || '-'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {importIndicators.length > 6 && (
                        <div style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--kpi-neutral-600)',
                          background: 'var(--kpi-neutral-50)',
                          borderTop: '1px solid var(--kpi-neutral-200)'
                        }}>
                          ... และอีก {importIndicators.length - 6} รายการพร้อมบันทึกเข้าสู่ระบบ
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="kpiModalFooter">
                <button 
                  className="kpiBtn kpiBtnSecondary" 
                  onClick={() => {
                    setImportModalOpen(false)
                    setImportIndicators([])
                    setImportFileName(null)
                    setImportError(null)
                  }}
                >
                  <X size={16} />
                  ยกเลิก
                </button>
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={handleExecuteImport}
                  disabled={saving || importIndicators.length === 0}
                >
                  <UploadCloud size={16} />
                  {saving 
                    ? 'กำลังนำเข้าสู่ระบบ...' 
                    : importIndicators.length > 0 
                      ? `ยืนยันนำเข้าข้อมูล (${importIndicators.length} ข้อ)` 
                      : 'กรุณาเลือกไฟล์เพื่อนำเข้า'}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  )
}
