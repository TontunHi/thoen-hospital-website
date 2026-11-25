'use client'

import React from 'react'
import { RefreshCw, Download, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { THAI_MONTHS, type RcmDateMode } from '@/hooks/useRcmDateRange'

export interface TelemedToolbarProps {
  isRefreshing: boolean
  loading: boolean
  isExporting: boolean
  hasItems: boolean
  exportMessage: string | null
  showClaimAlert: boolean
  withoutAuthenCount: number
  authenRate: number
  dateMode: RcmDateMode
  ds1: string
  ds2: string
  selectedMonth: number
  selectedBeYear: number
  selectedFiscalYear: number
  yearOptions: number[]
  onModeChange: (mode: RcmDateMode) => void
  onDs1Change: (val: string) => void
  onDs2Change: (val: string) => void
  onMonthChange: (month: number) => void
  onBeYearChange: (year: number) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onFiscalYearChange: (year: number) => void
  onRefresh: () => void
  onExportExcel: () => void
  onFilterNoAuthen: () => void
}

export function TelemedToolbar({
  isRefreshing,
  loading,
  isExporting,
  hasItems,
  exportMessage,
  showClaimAlert,
  withoutAuthenCount,
  authenRate,
  dateMode,
  ds1,
  ds2,
  selectedMonth,
  selectedBeYear,
  selectedFiscalYear,
  yearOptions,
  onModeChange,
  onDs1Change,
  onDs2Change,
  onMonthChange,
  onBeYearChange,
  onPrevMonth,
  onNextMonth,
  onFiscalYearChange,
  onRefresh,
  onExportExcel,
  onFilterNoAuthen,
}: TelemedToolbarProps) {
  return (
    <>
      <div className="telemed-toolbar">
        {isRefreshing && <div className="telemed-loading-line" />}
        <div className="telemed-toolbar-left">
          <div className="telemed-segmented-group" role="tablist" aria-label="โหมดช่วงเวลา">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`telemed-segment-btn ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => onModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`telemed-segment-btn ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => onModeChange('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`telemed-segment-btn ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => onModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="telemed-date-inputs">
            {dateMode === 'custom' && (
              <>
                <ThaiDatePicker
                  value={ds1}
                  onChange={onDs1Change}
                  placeholder="ตั้งแต่วันที่"
                  aria-label="ตั้งแต่วันที่"
                />
                <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>ถึง</span>
                <ThaiDatePicker
                  value={ds2}
                  onChange={onDs2Change}
                  placeholder="ถึงวันที่"
                  aria-label="ถึงวันที่"
                />
              </>
            )}

            {dateMode === 'monthly' && (
              <div className="telemed-month-stepper">
                <button
                  type="button"
                  className="telemed-stepper-btn"
                  onClick={onPrevMonth}
                  title="เดือนก่อนหน้า"
                  aria-label="เดือนก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>
                <select
                  className="telemed-select"
                  value={selectedMonth}
                  onChange={(e) => onMonthChange(Number(e.target.value))}
                  aria-label="เลือกเดือน"
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="telemed-select"
                  value={selectedBeYear}
                  onChange={(e) => onBeYearChange(Number(e.target.value))}
                  aria-label="เลือกปี พ.ศ."
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="telemed-stepper-btn"
                  onClick={onNextMonth}
                  title="เดือนถัดไป"
                  aria-label="เดือนถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {dateMode === 'fiscal' && (
              <select
                className="telemed-select"
                value={selectedFiscalYear}
                onChange={(e) => onFiscalYearChange(Number(e.target.value))}
                aria-label="เลือกปีงบประมาณ"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    ปีงบ {y}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="telemed-toolbar-right">
          <button
            type="button"
            className="telemed-btn"
            onClick={onRefresh}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุดด้วยตัวกรองเดิม"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            className="telemed-btn telemed-btn-primary"
            onClick={onExportExcel}
            disabled={isExporting || !hasItems}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={15} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {exportMessage && (
        <div
          className="telemed-alert-banner"
          style={{ backgroundColor: 'var(--brand-tint)', color: 'var(--brand)', borderColor: '#CDE5D8' }}
        >
          <span>{exportMessage}</span>
        </div>
      )}

      {showClaimAlert && (
        <div className="telemed-alert-banner" role="alert">
          <div className="telemed-alert-message">
            <AlertTriangle size={18} />
            <span>
              {withoutAuthenCount.toLocaleString('th-TH')} รายการ (
              {(100 - (authenRate || 0)).toFixed(1)}%) ยังไม่มี ClaimCode และอาจเบิกชดเชยไม่ได้
            </span>
          </div>
          <button
            type="button"
            className="telemed-alert-action-btn"
            onClick={onFilterNoAuthen}
          >
            ดูเฉพาะรายการนี้
          </button>
        </div>
      )}
    </>
  )
}
