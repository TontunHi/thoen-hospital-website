'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Users, Filter, ChevronDown, Check, X } from 'lucide-react'
import {
  DoctorSummaryItem,
  PttypeOption,
  OpdDoctorSummaryResult,
} from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import {
  RcmCommandHeader,
  RcmErrorBanner,
} from '../_components/RcmDashboardPrimitives'
import { RcmDoctorFinanceBody } from '../_components/RcmDoctorFinanceBody'
import {
  buildFiscalQuarters,
  getAvailableFiscalYears,
  getCurrentFiscalYearCe,
  getFiscalYearDateBounds,
  getMonthDateBounds,
} from '../_components/rcmDateRangeUtils'
import '../_components/dashboard-design.css'

export interface OpdDoctorClientProps {
  initialData?: OpdDoctorSummaryResult | null
  initialRange?: { startDate: string; endDate: string }
}

const DEFAULT_GRAND_TOTAL: OpdDoctorSummaryResult['grandTotal'] = {
  visits: 0,
  income: 0,
  uc_money: 0,
  rcpt_money: 0,
  discount: 0,
  debit: 0,
}

/**
 * 2.1.1.2 OPD Doctor & 37 e-Claim Pttype Dashboard Client.
 * Follows dashboard-design Monitor hierarchy & rcm-data-flow 5 pillars.
 */
export default function OpdDoctorClient({ initialData, initialRange }: OpdDoctorClientProps = {}) {
  const today = useMemo(() => new Date(), [])
  const currentCalYear = today.getFullYear()
  const defaultFiscalYear = useMemo(() => getCurrentFiscalYearCe(today), [today])

  // Date controls
  const [dateMode, setDateMode] = useState<'custom' | 'month' | 'year'>('year')
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(defaultFiscalYear)
  const [ds1, setDs1] = useState<string>(
    initialRange?.startDate || getFiscalYearDateBounds(defaultFiscalYear).startDate
  )
  const [ds2, setDs2] = useState<string>(
    initialRange?.endDate || getFiscalYearDateBounds(defaultFiscalYear).endDate
  )

  // 37 Pttype Multi-select
  const [allPttypes, setAllPttypes] = useState<PttypeOption[]>(initialData?.allPttypeOptions || [])
  const [selectedPttypes, setSelectedPttypes] = useState<string[]>([])
  const [pttypeDropdownOpen, setPttypeDropdownOpen] = useState<boolean>(false)
  const [pttypeSearch, setPttypeSearch] = useState<string>('')
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // Data States
  const [loading, setLoading] = useState<boolean>(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(Boolean(initialData))
  const [error, setError] = useState<string | null>(null)
  const [doctors, setDoctors] = useState<DoctorSummaryItem[]>(initialData?.doctors || [])
  const [months, setMonths] = useState<string[]>(initialData?.months || [])
  const [grandTotal, setGrandTotal] = useState<OpdDoctorSummaryResult['grandTotal']>(
    initialData?.grandTotal || DEFAULT_GRAND_TOTAL
  )
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, { income: number; visits: number }>>(
    initialData?.monthlyTotals || {}
  )

  const availableYears = useMemo(
    () => getAvailableFiscalYears(defaultFiscalYear),
    [defaultFiscalYear]
  )

  const abortDoctorRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  const fetchData = useCallback(
    async (start = ds1, end = ds2, pttypes = selectedPttypes) => {
      abortDoctorRef.current?.abort()
      const controller = new AbortController()
      abortDoctorRef.current = controller

      setLoading(true)
      setError(null)
      try {
        let url = `/api/service/dashboard-rcm/opd-doctor-summary?ds1=${encodeURIComponent(start)}&ds2=${encodeURIComponent(end)}`
        if (pttypes.length > 0) {
          url += `&eclaims=${encodeURIComponent(pttypes.join(','))}`
        }
        const res = await fetch(url, { signal: controller.signal })
        const json = await res.json()
        if (json.success) {
          setDoctors(json.doctors || [])
          setMonths(json.months || [])
          setMonthlyTotals(json.monthlyTotals || {})
          setGrandTotal(json.grandTotal || DEFAULT_GRAND_TOTAL)
          setHasLoadedOnce(true)
          if (json.allPttypeOptions && allPttypes.length === 0) {
            setAllPttypes(json.allPttypeOptions)
          }
        } else {
          setError(json.error?.message || json.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ API ได้')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    [ds1, ds2, selectedPttypes, allPttypes.length]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData(ds1, ds2, selectedPttypes)
    return () => {
      abortDoctorRef.current?.abort()
    }
  }, [ds1, ds2, selectedPttypes, fetchData, initialData])

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!pttypeDropdownOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPttypeDropdownOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPttypeDropdownOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pttypeDropdownOpen])

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month)
    const bounds = getMonthDateBounds(currentCalYear, month)
    setDs1(bounds.startDate)
    setDs2(bounds.endDate)
  }

  const handleSelectFiscalYear = (fiscalYear: number) => {
    setSelectedYear(fiscalYear)
    const bounds = getFiscalYearDateBounds(fiscalYear)
    setDs1(bounds.startDate)
    setDs2(bounds.endDate)
  }

  const handleDateModeChange = (mode: 'custom' | 'month' | 'year') => {
    setDateMode(mode)
    if (mode === 'month') handleSelectMonth(selectedMonth)
    else if (mode === 'year') handleSelectFiscalYear(selectedYear)
  }

  const togglePttype = (code: string) => {
    setSelectedPttypes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const filteredPttypeOptions = useMemo(() => {
    if (!pttypeSearch.trim()) return allPttypes
    const q = pttypeSearch.toLowerCase()
    return allPttypes.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    )
  }, [allPttypes, pttypeSearch])

  const exportExcel = async () => {
    const isYearMode = dateMode === 'year'
    const fiscalCols = isYearMode ? buildFiscalQuarters(selectedYear).flatMap((q) => q.months) : []
    const headers = [
      'ลำดับ',
      'รหัสแพทย์',
      'ชื่อ-สกุล แพทย์',
      'ตรวจ (ครั้ง)',
      'สิทธิเบิก (บาท)',
      'ชำระเอง (บาท)',
      'ส่วนลด (บาท)',
      'ลูกหนี้คงค้าง (บาท)',
      'ค่ารักษาทั้งหมด (บาท)',
      ...(isYearMode ? fiscalCols.map((m) => `ยอด ${m.label}`) : []),
    ]

    const rows = [...doctors]
      .sort((a, b) => (b.total_income ?? 0) - (a.total_income ?? 0))
      .map((doc, idx) => {
        const monthValues = isYearMode
          ? fiscalCols.map((m) => doc.monthly_income[m.key] || 0)
          : []

        return [
          idx + 1,
          doc.doctor_code,
          doc.doctor_name,
          doc.total_visits,
          doc.total_uc_money,
          doc.total_rcpt_money,
          doc.total_discount,
          doc.total_debit,
          doc.total_income,
          ...monthValues,
        ]
      })

    await exportRcmExcel({
      filename: `opd_doctor_summary_${ds1}_to_${ds2}.xlsx`,
      title: 'สรุปค่าบริการผู้ป่วยนอก OPD ตามสิทธิ์การรักษา จำแนกรายแพทย์',
      subtitle: `ช่วงวันที่ ${formatThaiDate(ds1)} ถึง ${formatThaiDate(ds2)} | โรงพยาบาลเถิน`,
      headers,
      rows,
    })
  }

  const pttypeFilterTrigger = (
    <div className="dd-popover-wrap" ref={popoverRef}>
      <button
        type="button"
        aria-expanded={pttypeDropdownOpen}
        onClick={() => setPttypeDropdownOpen((prev) => !prev)}
        className="dd-btn"
        style={{
          borderColor: selectedPttypes.length > 0 ? 'var(--dd-money)' : undefined,
        }}
        title="กรองกลุ่มสิทธิ e-Claim (37 กลุ่มสิทธิ)"
      >
        <Filter size={13} />
        <span>
          {selectedPttypes.length === 0
            ? 'ทุกสิทธิ (37)'
            : `เลือก ${selectedPttypes.length} สิทธิ`}
        </span>
        <ChevronDown size={13} />
      </button>

      {pttypeDropdownOpen && (
        <div className="dd-popover-panel" role="dialog" aria-label="ตัวกรองสิทธิ e-Claim">
          <div className="dd-popover-head">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>กลุ่มสิทธิ e-Claim (37 สิทธิ)</span>
              {selectedPttypes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPttypes([])}
                  className="dd-chip-clear"
                >
                  เลือกทุกสิทธิ
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="ค้นหารหัสหรือชื่อสิทธิ..."
              value={pttypeSearch}
              onChange={(e) => setPttypeSearch(e.target.value)}
              className="dd-input"
              style={{ width: '100%' }}
            />
          </div>

          <div className="dd-popover-list">
            {filteredPttypeOptions.map((opt) => {
              const isSelected = selectedPttypes.includes(opt.code)
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => togglePttype(opt.code)}
                  className={`dd-popover-item ${isSelected ? 'is-selected' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `1px solid ${isSelected ? 'var(--dd-money)' : 'var(--dd-line-strong)'}`,
                      background: isSelected ? 'var(--dd-money)' : 'transparent',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <Check size={11} />}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <b>{opt.code}</b> · {opt.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="dd-page">
      <RcmCommandHeader
        code="2.1.1.2"
        title="สรุปค่าบริการผู้ป่วยนอก OPD ตามสิทธิ์การรักษา"
        icon={<Users size={17} strokeWidth={1.5} />}
        dateMode={dateMode}
        onDateModeChange={handleDateModeChange}
        ds1={ds1}
        ds2={ds2}
        onDs1Change={setDs1}
        onDs2Change={setDs2}
        selectedMonth={selectedMonth}
        onSelectMonth={handleSelectMonth}
        monthYearBe={currentCalYear + 543}
        selectedYear={selectedYear}
        availableYears={availableYears}
        onSelectFiscalYear={handleSelectFiscalYear}
        loading={loading}
        exportDisabled={doctors.length === 0}
        onRefresh={() => fetchData(ds1, ds2, selectedPttypes)}
        onExport={exportExcel}
        extraToolbarSlot={pttypeFilterTrigger}
      />

      {selectedPttypes.length > 0 && (
        <div className="dd-filter-chips" aria-label="ตัวกรองสิทธิที่ใช้งาน">
          {selectedPttypes.map((code) => {
            const opt = allPttypes.find((p) => p.code === code)
            return (
              <span key={code} className="dd-chip">
                <span>
                  {code}: {opt?.name || code}
                </span>
                <button
                  type="button"
                  onClick={() => togglePttype(code)}
                  className="dd-chip-remove"
                  aria-label={`ลบสิทธิ ${code}`}
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
          <button
            type="button"
            onClick={() => setSelectedPttypes([])}
            className="dd-chip-clear"
          >
            ล้างตัวกรอง
          </button>
        </div>
      )}

      <RcmErrorBanner error={error} onRetry={() => fetchData(ds1, ds2, selectedPttypes)} />

      <RcmDoctorFinanceBody
        doctors={doctors}
        months={months}
        monthlyTotals={monthlyTotals}
        grandTotal={grandTotal}
        dateMode={dateMode}
        selectedYear={selectedYear}
        loading={loading}
        hasLoadedOnce={hasLoadedOnce}
        entityLabel="แพทย์"
        visitLabel="ผู้ป่วยนอกทั้งหมด"
        searchPlaceholder="ค้นหาชื่อแพทย์..."
        emptyTitle="ไม่พบข้อมูลการตรวจรักษาตามเงื่อนไขที่เลือก"
        emptyDesc="ลองปรับช่วงเวลาหรือกลุ่มสิทธิ e-Claim อีกครั้ง"
        showDynamicMonthsOutsideYear
      />
    </div>
  )
}
