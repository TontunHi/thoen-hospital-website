'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Stethoscope } from 'lucide-react'
import { DentalDoctorSummaryItem, SssDentalResult } from '@/lib/clinical/rcmDashboardService'
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

export interface SssDentalClientProps {
  initialData?: SssDentalResult | null
  initialRange?: { startDate: string; endDate: string }
}

const DEFAULT_GRAND_TOTAL: SssDentalResult['grandTotal'] = {
  visits: 0,
  income: 0,
  uc_money: 0,
  rcpt_money: 0,
  discount: 0,
  debit: 0,
}

/**
 * 2.1.1.1 SSS Dental Dashboard Client.
 * Follows dashboard-design Monitor hierarchy & rcm-data-flow 5 pillars.
 */
export default function SssDentalClient({ initialData, initialRange }: SssDentalClientProps = {}) {
  const today = useMemo(() => new Date(), [])
  const currentCalYear = today.getFullYear()
  const defaultFiscalYear = useMemo(() => getCurrentFiscalYearCe(today), [today])

  // Atomic query bounds
  const [dateMode, setDateMode] = useState<'custom' | 'month' | 'year'>('year')
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(defaultFiscalYear)
  const [ds1, setDs1] = useState<string>(
    initialRange?.startDate || getFiscalYearDateBounds(defaultFiscalYear).startDate
  )
  const [ds2, setDs2] = useState<string>(
    initialRange?.endDate || getFiscalYearDateBounds(defaultFiscalYear).endDate
  )

  // Data States
  const [loading, setLoading] = useState<boolean>(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(Boolean(initialData))
  const [error, setError] = useState<string | null>(null)
  const [doctors, setDoctors] = useState<DentalDoctorSummaryItem[]>(initialData?.doctors || [])
  const [months, setMonths] = useState<string[]>(initialData?.months || [])
  const [grandTotal, setGrandTotal] = useState<SssDentalResult['grandTotal']>(
    initialData?.grandTotal || DEFAULT_GRAND_TOTAL
  )
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, { income: number; visits: number }>>(
    initialData?.monthlyTotals || {}
  )

  const availableYears = useMemo(
    () => getAvailableFiscalYears(defaultFiscalYear),
    [defaultFiscalYear]
  )

  const abortDentalRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef(true)

  const fetchData = useCallback(
    async (start = ds1, end = ds2) => {
      abortDentalRef.current?.abort()
      const controller = new AbortController()
      abortDentalRef.current = controller

      setLoading(true)
      setError(null)
      try {
        const url = `/api/service/dashboard-rcm/sss-dental?ds1=${encodeURIComponent(start)}&ds2=${encodeURIComponent(end)}&visits=false`
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
        const json = await res.json()
        if (json.success) {
          setDoctors(json.doctors || [])
          setMonths(json.months || [])
          setMonthlyTotals(json.monthlyTotals || {})
          setGrandTotal(json.grandTotal || DEFAULT_GRAND_TOTAL)
          setHasLoadedOnce(true)
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
    [ds1, ds2]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData(ds1, ds2)
    return () => {
      abortDentalRef.current?.abort()
    }
  }, [ds1, ds2, fetchData, initialData])

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

  const exportExcel = async () => {
    const isYearMode = dateMode === 'year'
    const fiscalCols = isYearMode ? buildFiscalQuarters(selectedYear).flatMap((q) => q.months) : []
    const headers = [
      'รหัสแพทย์',
      'ชื่อทันตแพทย์',
      'จำนวนครั้งตรวจ',
      'ค่ารักษาพยาบาลรวม (บาท)',
      'สิทธิเบิกชดเชย UC (บาท)',
      'ชำระเอง/ใบเสร็จ (บาท)',
      'ส่วนลด (บาท)',
      'ลูกหนี้คงค้าง (บาท)',
      ...(isYearMode ? fiscalCols.map((m) => `ยอด ${m.label}`) : months.map((m) => `ยอด ${m}`)),
    ]

    const rows = [...doctors]
      .sort((a, b) => (b.total_income ?? 0) - (a.total_income ?? 0))
      .map((doc) => {
        const monthValues = isYearMode
          ? fiscalCols.map((m) => doc.monthly_income[m.key] || 0)
          : months.map((m) => doc.monthly_income[m] || 0)

        return [
          doc.doctor_code,
          doc.doctor_name,
          doc.total_visits,
          doc.total_income,
          doc.total_uc_money,
          doc.total_rcpt_money,
          doc.total_discount,
          doc.total_debit,
          ...monthValues,
        ]
      })

    await exportRcmExcel({
      filename: `sss_dental_report_${ds1}_to_${ds2}.xlsx`,
      title: 'รายงานการให้บริการทันตกรรม สิทธิ์ประกันสังคม จำแนกตามทันตแพทย์',
      subtitle: `ช่วงวันที่ ${formatThaiDate(ds1)} ถึง ${formatThaiDate(ds2)} | โรงพยาบาลเถิน`,
      headers,
      rows,
    })
  }

  return (
    <div className="dd-page">
      <RcmCommandHeader
        code="2.1.1.1"
        title="รายงานการให้บริการทันตกรรม สิทธิ์ประกันสังคม"
        icon={<Stethoscope size={17} strokeWidth={1.5} />}
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
        onRefresh={() => fetchData(ds1, ds2)}
        onExport={exportExcel}
      />

      <RcmErrorBanner error={error} onRetry={() => fetchData(ds1, ds2)} />

      <RcmDoctorFinanceBody
        doctors={doctors}
        months={months}
        monthlyTotals={monthlyTotals}
        grandTotal={grandTotal}
        dateMode={dateMode}
        selectedYear={selectedYear}
        loading={loading}
        hasLoadedOnce={hasLoadedOnce}
        entityLabel="ทันตแพทย์"
        visitLabel="จำนวนครั้งรับบริการ"
        searchPlaceholder="ค้นหาชื่อทันตแพทย์..."
        emptyTitle="ไม่พบข้อมูลการให้บริการทันตกรรมประกันสังคม"
        emptyDesc="ลองปรับช่วงเวลาหรือล้างตัวกรองเพื่อดูข้อมูล"
        showDynamicMonthsOutsideYear
      />
    </div>
  )
}
