'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Download,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type {
  PatientClaimRecord,
  FundSummaryGroup,
  RepStatementSummary,
  RepFundsSummaryMetrics,
} from '@/lib/clinical/rcmRepFundsService'
import './page.css'

export type { PatientClaimRecord, FundSummaryGroup, RepStatementSummary, RepFundsSummaryMetrics }

export default function RepFundsClient() {
  // Active Tab: default to 'reps' for direct multi-Rep multi-HN viewing
  const [activeTab, setActiveTab] = useState<'reps' | 'funds'>('reps')

  // Quick Lookup States (HN / Date) - Collapsed by default until activated
  const [isLookupOpen, setIsLookupOpen] = useState<boolean>(false)
  const [lookupHn, setLookupHn] = useState<string>('')
  const [lookupDate, setLookupDate] = useState<string>('')
  const [lookupResults, setLookupResults] = useState<PatientClaimRecord[]>([])
  const [isSearchingLookup, setIsSearchingLookup] = useState<boolean>(false)
  const [hasSearched, setHasSearched] = useState<boolean>(false)

  // Report Filters - Ordered logically from Broad (Macro) -> Specific (Micro):
  // 1. ปีงบประมาณ (Fiscal Year)
  // 2. กองทุนหลัก (Fund)
  // 3. กองทุนย่อย (SubFund)
  // 4. แผนกบริการ (Department: OPD / IPD)
  // 5. สถานะการชดเชย (Status)
  // 6. คำค้นหา (Search: Rep, HN, Patient Name, Error Code)
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('2570')
  const [selectedFund, setSelectedFund] = useState<string>('ALL')
  const [selectedSubFund, setSelectedSubFund] = useState<string>('ALL')
  const [selectedDept, setSelectedDept] = useState<'ALL' | 'OP' | 'IP'>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [recordLimit, setRecordLimit] = useState<number>(250)

  // Summary Data States
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<RepFundsSummaryMetrics>({
    totalCases: 0,
    totalReps: 0,
    totalIncome: 0,
    totalCompensated: 0,
    rate: '0.0',
    totalDiff: 0,
    pendingAppeals: 0,
    errorCount: 0,
  })
  const [fundGroups, setFundGroups] = useState<FundSummaryGroup[]>([])
  const [availableYears, setAvailableYears] = useState<string[]>(['2570', '2569', '2568', '2567'])
  const [availableFunds, setAvailableFunds] = useState<Array<{ key: string; label: string; count: number }>>([])

  // Multi-Rep, Multi-HN Statement Cases Data States
  const [statementCases, setStatementCases] = useState<PatientClaimRecord[]>([])
  const [isCasesLoading, setIsCasesLoading] = useState<boolean>(true)
  const [casesError, setCasesError] = useState<string | null>(null)

  // Modal States:
  // 1. Single Case Detail (when clicking a row in the combined Rep view)
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<PatientClaimRecord | null>(null)

  // 2. Fund Group Cases Modal (when clicking a row in the Fund view)
  const [activeFundModalTarget, setActiveFundModalTarget] = useState<{
    group: FundSummaryGroup
    title: string
    subtitle: string
  } | null>(null)
  const [fundModalCases, setFundModalCases] = useState<PatientClaimRecord[]>([])
  const [isFundModalLoading, setIsFundModalLoading] = useState<boolean>(false)
  const [fundModalSearchTerm, setFundModalSearchTerm] = useState<string>('')

  // 1. Fetch Summary Data (KPI Metrics & Fund Matrix)
  const fetchSummaryData = useCallback(async () => {
    setIsLoadingSummary(true)
    setSummaryError(null)

    try {
      const q = new URLSearchParams()
      if (selectedFiscalYear) q.set('fiscalYear', selectedFiscalYear)
      if (selectedDept && selectedDept !== 'ALL') q.set('department', selectedDept)
      if (selectedFund && selectedFund !== 'ALL') q.set('fund', selectedFund)
      if (selectedSubFund && selectedSubFund !== 'ALL') q.set('subFund', selectedSubFund)
      if (selectedStatus && selectedStatus !== 'ALL') q.set('status', selectedStatus)
      if (searchTerm.trim()) q.set('search', searchTerm.trim())

      const res = await fetch(`/api/service/dashboard-rcm/rep-funds?${q.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }

      setMetrics(
        json.metrics || {
          totalCases: 0,
          totalReps: 0,
          totalIncome: 0,
          totalCompensated: 0,
          rate: '0.0',
          totalDiff: 0,
          pendingAppeals: 0,
          errorCount: 0,
        }
      )
      setFundGroups(json.fundGroups || [])
      if (json.availableYears?.length > 0) {
        setAvailableYears(json.availableYears)
      }
      if (json.availableFunds?.length > 0) {
        setAvailableFunds(json.availableFunds)
      }
    } catch (err: any) {
      setSummaryError(err.message || 'ไม่สามารถโหลดข้อมูลสรุป Rep ได้')
    } finally {
      setIsLoadingSummary(false)
    }
  }, [
    selectedFiscalYear,
    selectedDept,
    selectedFund,
    selectedSubFund,
    selectedStatus,
    searchTerm,
  ])

  // 2. Fetch Multi-Rep, Multi-HN Statement Cases
  const fetchStatementCases = useCallback(async () => {
    setIsCasesLoading(true)
    setCasesError(null)

    try {
      const q = new URLSearchParams()
      if (selectedFiscalYear) q.set('fiscalYear', selectedFiscalYear)
      if (selectedDept && selectedDept !== 'ALL') q.set('department', selectedDept)
      if (selectedFund && selectedFund !== 'ALL') q.set('fund', selectedFund)
      if (selectedSubFund && selectedSubFund !== 'ALL') q.set('subFund', selectedSubFund)
      if (selectedStatus && selectedStatus !== 'ALL') q.set('status', selectedStatus)
      if (searchTerm.trim()) q.set('search', searchTerm.trim())
      q.set('limit', String(recordLimit))

      const res = await fetch(`/api/service/dashboard-rcm/rep-funds/cases?${q.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }

      setStatementCases(json.cases || [])
    } catch (err: any) {
      setCasesError(err.message || 'ไม่สามารถโหลดรายการข้อมูลเคสใน Rep ได้')
    } finally {
      setIsCasesLoading(false)
    }
  }, [
    selectedFiscalYear,
    selectedDept,
    selectedFund,
    selectedSubFund,
    selectedStatus,
    searchTerm,
    recordLimit,
  ])

  useEffect(() => {
    fetchSummaryData()
  }, [fetchSummaryData])

  useEffect(() => {
    fetchStatementCases()
  }, [fetchStatementCases])

  // Extract distinct subFunds from fundGroups when a specific fund is selected
  const availableSubFunds = useMemo(() => {
    if (selectedFund === 'ALL') return []
    const set = new Set<string>()
    fundGroups.forEach((g) => {
      if (g.subFundKey && g.subFundKey !== '-' && g.subFundKey !== 'null') {
        set.add(g.subFundKey)
      }
    })
    return Array.from(set).sort()
  }, [fundGroups, selectedFund])

  // Determine whether the lookup section form is visible
  const isFormVisible = isLookupOpen || hasSearched || Boolean(lookupHn.trim()) || Boolean(lookupDate.trim())

  // 3. Quick Patient Claim Lookup
  const handleQuickLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanedHn = lookupHn.trim()
    const cleanedDate = lookupDate.trim()

    if (!cleanedHn && !cleanedDate) {
      setLookupResults([])
      setHasSearched(false)
      return
    }

    setIsSearchingLookup(true)
    setHasSearched(true)
    setIsLookupOpen(true)

    try {
      const q = new URLSearchParams()
      if (cleanedHn) q.set('hn', cleanedHn)
      if (cleanedDate) q.set('serviceDate', cleanedDate)

      const res = await fetch(`/api/service/dashboard-rcm/rep-funds/lookup?${q.toString()}`)
      const json = await res.json()

      if (res.ok && json.success) {
        setLookupResults(json.claims || [])
      } else {
        setLookupResults([])
      }
    } catch {
      setLookupResults([])
    } finally {
      setIsSearchingLookup(false)
    }
  }

  // 4. Drill-down into Fund Cases Modal (from Fund Matrix tab)
  const openFundCasesModal = async (group: FundSummaryGroup) => {
    setActiveFundModalTarget({
      group,
      title: `รายชื่อคนไข้: ${group.fundLabel} > ${group.subFundLabel}`,
      subtitle: `แผนก ${group.department === 'IP' ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD)'} • ทั้งหมด ${group.caseCount.toLocaleString('th-TH')} เคส • ได้รับชดเชยรวม ${group.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`,
    })
    setFundModalSearchTerm('')
    setIsFundModalLoading(true)

    try {
      const q = new URLSearchParams()
      q.set('fund', group.fundKey)
      if (group.subFundKey && group.subFundKey !== '-') q.set('subFund', group.subFundKey)
      q.set('department', group.department)
      q.set('fiscalYear', selectedFiscalYear)

      const res = await fetch(`/api/service/dashboard-rcm/rep-funds/cases?${q.toString()}`)
      const json = await res.json()
      if (res.ok && json.success) {
        setFundModalCases(json.cases || [])
      } else {
        setFundModalCases([])
      }
    } catch {
      setFundModalCases([])
    } finally {
      setIsFundModalLoading(false)
    }
  }

  // Filtered fund modal cases for live in-modal search
  const filteredFundModalCases = useMemo(() => {
    if (!fundModalSearchTerm.trim()) return fundModalCases
    const term = fundModalSearchTerm.toLowerCase().trim()
    return fundModalCases.filter(
      (c) =>
        c.hn.toLowerCase().includes(term) ||
        c.ptName.toLowerCase().includes(term) ||
        c.rep.toLowerCase().includes(term) ||
        (c.errorCode && c.errorCode.toLowerCase().includes(term))
    )
  }, [fundModalCases, fundModalSearchTerm])

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedFund('ALL')
    setSelectedSubFund('ALL')
    setSelectedDept('ALL')
    setSelectedStatus('ALL')
    setSearchTerm('')
  }

  // Export CSV functions
  const handleExportCsv = () => {
    const BOM = '\uFEFF'
    if (activeTab === 'funds') {
      const header = 'กองทุนหลัก,กองทุนย่อย/รายการ,แผนก,จำนวนเคส,ค่ารักษาจริง (บาท),เงินชดเชยที่ได้ (บาท),อัตราชดเชย (%),ส่วนต่าง (บาท),เคสอุทธรณ์\n'
      const rows = fundGroups
        .map(
          (g) =>
            `"${g.fundLabel}","${g.subFundLabel}","${g.department === 'IP' ? 'IPD' : 'OPD'}",${g.caseCount},${g.totalIncome},${g.totalCompensated},${g.reimbursementRate},${g.netDiff},${g.appealCount}`
        )
        .join('\n')
      const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rep-funds-matrix-${selectedFiscalYear}.csv`
      a.click()
    } else {
      const header = 'เลขที่ใบ REP,เลขประจำตัว (HN),ชื่อ-สกุลคนไข้,วันที่รับบริการ,แผนก,กองทุน,ค่ารักษาจริง (บาท),เงินชดเชย (บาท),ส่วนต่าง (บาท),อัตราชดเชย (%),สถานะ,รหัส Error\n'
      const rows = statementCases
        .map(
          (c) =>
            `"${c.rep}","${c.hn}","${c.ptName}","${c.serviceDateThai}","${c.departmentLabel}","${c.fundLabel}",${c.income},${c.compensated},${c.diff},${c.percentPay}%,"${c.compensated > 0 ? 'ได้รับชดเชย' : 'ไม่ได้รับชดเชย'}","${c.errorCode || ''}"`
        )
        .join('\n')
      const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rep-statement-cases-${selectedFiscalYear}.csv`
      a.click()
    }
  }

  const handleExportFundModalCsv = () => {
    const BOM = '\uFEFF'
    const header = 'เลขประจำตัว (HN),ชื่อ-สกุลคนไข้,วันที่รับบริการ,เลขที่ใบ REP,แผนก,กองทุน,ค่ารักษาจริง (บาท),เงินชดเชย (บาท),ส่วนต่าง (บาท),อัตราชดเชย (%),สถานะ,รหัส Error\n'
    const rows = fundModalCases
      .map(
        (c) =>
          `"${c.hn}","${c.ptName}","${c.serviceDateThai}","${c.rep}","${c.departmentLabel}","${c.fundLabel}",${c.income},${c.compensated},${c.diff},${c.percentPay}%,"${c.compensated > 0 ? 'ได้รับชดเชย' : 'ไม่ได้รับชดเชย'}","${c.errorCode || ''}"`
      )
      .join('\n')
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fund-cases-export.csv`
    a.click()
  }

  return (
    <div className="rep-funds-container">
      {/* 1. Header */}
      <header className="rep-header">
        <div className="rep-header-top">
          <div className="rep-title-group">
            <h1>3.1.1 ข้อมูล Rep แต่ละกองทุน</h1>
            <p className="rep-subtitle">
              ตรวจสอบการชดเชยค่าบริการทางการแพทย์จาก สปสช. (REP) รวมหลาย Rep และหลาย HN ในที่เดียว สามารถคลิกที่แถวเพื่อดูรายละเอียดเคสได้ทันที
            </p>
          </div>
          <div className="rep-header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setLookupHn('')
                setLookupDate('')
                setLookupResults([])
                setHasSearched(false)
                setIsLookupOpen(false)
                handleResetFilters()
                fetchSummaryData()
                fetchStatementCases()
              }}
            >
              <RefreshCw size={16} />
              รีเฟรชข้อมูล
            </button>
            <button type="button" className="btn-primary" onClick={handleExportCsv}>
              <Download size={16} />
              ส่งออก CSV ({activeTab === 'reps' ? 'รายการเคส Rep' : 'ตารางกองทุน'})
            </button>
          </div>
        </div>
      </header>

      {/* 2. Summary KPI Cards (Primary Financial Health First) */}
      <section className="summary-bar" aria-label="แถบสรุปยอดรวมประจำปีงบประมาณ">
        <div className="card-surface metric-card">
          <span className="metric-label">ค่ารักษาพยาบาลจริงรวม</span>
          <span className="metric-value">
            {metrics.totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">ยอดบันทึกจริงในระบบ HOSxP (บาท)</span>
        </div>

        <div className="card-surface metric-card accent-primary">
          <span className="metric-label">ยอดเงินชดเชย สปสช. รวม</span>
          <span className="metric-value metric-value-primary">
            {metrics.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">ยอดเงินที่ได้รับโอนชดเชยจริง (บาท)</span>
        </div>

        <div className="card-surface metric-card accent-success">
          <span className="metric-label">อัตราการชดเชยเฉลี่ย</span>
          <span className="metric-value metric-value-success">{metrics.rate}%</span>
          <span className="metric-sub">สัดส่วนเงินชดเชยเทียบกับค่ารักษาจริง</span>
        </div>

        <div className={`card-surface metric-card ${metrics.totalDiff < 0 ? 'accent-danger' : 'accent-success'}`}>
          <span className="metric-label">ส่วนต่างรายรับสุทธิ</span>
          <span className={`metric-value ${metrics.totalDiff < 0 ? 'metric-value-danger' : 'metric-value-success'}`}>
            {metrics.totalDiff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">
            {metrics.totalDiff < 0 ? 'ส่วนขาดทุน / ยังไม่ได้รับการชดเชย' : 'ส่วนเกินรายรับ (บาท)'}
          </span>
        </div>

        <div className={`card-surface metric-card ${metrics.pendingAppeals > 0 || metrics.errorCount > 0 ? 'accent-warning' : ''}`}>
          <span className="metric-label">เคสรออุทธรณ์ / ติด Error</span>
          <span className={`metric-value ${metrics.pendingAppeals > 0 || metrics.errorCount > 0 ? 'metric-value-warning' : ''}`}>
            {metrics.pendingAppeals} เคส
          </span>
          <span className="metric-sub">Error {metrics.errorCount} เคส • รอส่งหลักฐานเพิ่ม</span>
        </div>
      </section>

      {/* 3. Quick Patient Claim Lookup (Collapsible) */}
      <section className="card-surface lookup-section" aria-labelledby="lookup-heading">
        <div className="lookup-header">
          <div className="lookup-header-left">
            <h2 id="lookup-heading">ตรวจสอบข้อมูลการชดเชยรายบุคคล (Patient Claim Lookup)</h2>
            <span className="lookup-guide">
              {isFormVisible
                ? 'กรอก HN หรือวันที่รับบริการ เพื่อดูยันว่า Rep นี้เป็นของใคร ได้รับเงินชดเชยกี่บาท'
                : 'คลิกเพื่อเปิดเครื่องมือตรวจสอบสิทธิ์ ยอดชดเชย และใบแจ้งผล REP รายคนไข้'}
            </span>
          </div>

          <button
            type="button"
            className="btn-secondary lookup-toggle-btn"
            onClick={() => setIsLookupOpen((prev) => !prev)}
            aria-expanded={isFormVisible}
            title={isFormVisible ? 'ซ่อนแบบฟอร์มค้นหา' : 'เปิดแบบฟอร์มค้นหา'}
          >
            <Search size={15} />
            <span>{isFormVisible ? 'ซ่อนการค้นหา' : 'ค้นหารายคนไข้'}</span>
            {isFormVisible ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        <div className={`lookup-collapsible ${isFormVisible ? 'is-open' : 'is-collapsed'}`}>
          <form className="lookup-form" onSubmit={handleQuickLookup}>
            <div className="form-group">
              <label htmlFor="input-lookup-hn" className="form-label">
                เลขประจำตัวผู้ป่วย (HN)
              </label>
              <input
                id="input-lookup-hn"
                type="text"
                className="form-input"
                placeholder="ระบุเลข HN เช่น 0142232"
                value={lookupHn}
                onChange={(e) => setLookupHn(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="input-lookup-date" className="form-label">
                วันที่รับบริการ (Service Date)
              </label>
              <input
                id="input-lookup-date"
                type="date"
                className="form-input"
                value={lookupDate}
                onChange={(e) => setLookupDate(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isSearchingLookup}>
              <Search size={16} />
              {isSearchingLookup ? 'กำลังค้นหา...' : 'ค้นหาข้อมูล Rep'}
            </button>

            {hasSearched && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setLookupHn('')
                  setLookupDate('')
                  setLookupResults([])
                  setHasSearched(false)
                }}
              >
                <X size={16} />
                ปิดผลค้นหา
              </button>
            )}
          </form>

          {/* Lookup Results */}
          {hasSearched && (
            <div className="lookup-result-box" role="region" aria-label="ผลการค้นหาข้อมูลผู้ป่วย">
              {lookupResults.length > 0 ? (
                <div>
                  <div className="lookup-result-summary-text">
                    พบข้อมูลการชดเชยทั้งหมด {lookupResults.length} รายการ สำหรับคนไข้: {lookupResults[0].ptName} (HN: {lookupResults[0].hn})
                  </div>

                  {lookupResults.map((rec) => (
                    <div key={rec.id} className="lookup-item-card">
                      <div className="lookup-result-header">
                        <div>
                          <span className="result-label">คนไข้ / วันที่รับบริการ</span>
                          <div className="lookup-patient-title">
                            {rec.ptName} (HN: {rec.hn}) • {rec.serviceDateThai}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {rec.compensated > 0 ? (
                            <span className="status-badge success">ได้รับชดเชย</span>
                          ) : (
                            <span className="status-badge danger">ไม่ได้รับชดเชย (0 บาท)</span>
                          )}
                          {rec.errorCode && (
                            <span className="status-badge warning" title={rec.errorCode}>
                              Error {rec.errorCode}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="lookup-result-grid">
                        <div className="result-item">
                          <span className="result-label">เลขที่ใบแจ้งผล (REP)</span>
                          <span className="result-value accent-primary">{rec.rep}</span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">กองทุน / สิทธิ</span>
                          <span className="result-value">{rec.fundLabel}</span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">แผนกบริการ</span>
                          <span className="result-value">{rec.departmentLabel}</span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">ค่ารักษาจริง รพ.</span>
                          <span className="result-value">
                            {rec.income.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                          </span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">สปสช./กองทุน ชดเชยให้</span>
                          <span className="result-value text-success">
                            {rec.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                          </span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">ส่วนต่าง (ผลต่างรายรับ)</span>
                          <span className={`result-value ${rec.diff < 0 ? 'text-danger' : 'text-success'}`}>
                            {rec.diff.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                          </span>
                        </div>
                        {rec.errorCode && (
                          <div className="result-item">
                            <span className="result-label">สาเหตุข้อผิดพลาด (Error Code)</span>
                            <span className="result-value text-danger">{rec.errorCode}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-title">ไม่พบข้อมูลใบ REP หรือยอดเงินชดเชยสำหรับเงื่อนไขที่ระบุ</span>
                  <span>กรุณาตรวจสอบเลข HN หรือวันที่รับบริการอีกครั้ง</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 4. Filter Toolbar & Main Data Table */}
      <section className="card-surface main-dashboard-card" aria-labelledby="table-heading">
        {/* View Switcher Tabs at top of Card */}
        <div className="card-tabs-header">
          <div className="view-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'reps'}
              className={`view-tab-btn ${activeTab === 'reps' ? 'active' : ''}`}
              onClick={() => setActiveTab('reps')}
            >
              มุมมองตามใบแจ้งผล REP (Rep Statements)
              <span className="tab-badge">{statementCases.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'funds'}
              className={`view-tab-btn ${activeTab === 'funds' ? 'active' : ''}`}
              onClick={() => setActiveTab('funds')}
            >
              มุมมองตามกองทุน (Fund Matrix)
              <span className="tab-badge">{fundGroups.length}</span>
            </button>
          </div>
        </div>

        {/* Toolbar Controls - Strict Order: ใหญ่ไปเล็ก (Macro -> Micro) */}
        <div className="toolbar-section">
          <div className="filter-group">
            <h2 id="table-heading" className="sr-only">
              ตัวกรองข้อมูล Rep และกองทุน เรียงจากระดับใหญ่ไปเล็ก
            </h2>

            {/* 1. ปีงบประมาณ (Fiscal Year - Macro Timeframe) */}
            <select
              className="filter-select"
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              aria-label="1. เลือกปีงบประมาณ"
              title="1. ปีงบประมาณ พ.ศ."
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  ปีงบประมาณ {yr}
                </option>
              ))}
            </select>

            {/* 2. กองทุนหลัก (Main Fund - Payer) */}
            <select
              className="filter-select"
              value={selectedFund}
              onChange={(e) => {
                setSelectedFund(e.target.value)
                setSelectedSubFund('ALL')
              }}
              aria-label="2. เลือกกองทุนหลัก"
              title="2. กองทุนหลัก"
            >
              <option value="ALL">กองทุนหลัก: ทั้งหมด</option>
              <option value="UCS">บัตรทอง (UCS รวม)</option>
              <option value="OFC">ข้าราชการ (OFC/CS รวม)</option>
              <option value="SSS">ประกันสังคม (SSS รวม)</option>
              <option value="LGO">อปท. (LGO รวม)</option>
              <option value="STP">สถานะและสิทธิ (STP)</option>
              {availableFunds.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* 3. กองทุนย่อย (SubFund - Sub-category) */}
            {availableSubFunds.length > 0 && (
              <select
                className="filter-select"
                value={selectedSubFund}
                onChange={(e) => setSelectedSubFund(e.target.value)}
                aria-label="3. เลือกกองทุนย่อย"
                title="3. กองทุนย่อย / หมวดโครงการ"
              >
                <option value="ALL">กองทุนย่อย: ทั้งหมด</option>
                {availableSubFunds.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            )}

            {/* 4. แผนกบริการ (Department - Service Venue) */}
            <select
              className="filter-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value as 'ALL' | 'OP' | 'IP')}
              aria-label="4. เลือกแผนกบริการ"
              title="4. แผนกบริการ"
            >
              <option value="ALL">แผนก: ทั้งหมด</option>
              <option value="OP">ผู้ป่วยนอก (OPD)</option>
              <option value="IP">ผู้ป่วยใน (IPD)</option>
            </select>

            {/* 5. สถานะการชดเชย (Reimbursement Status) */}
            <select
              className="filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="5. เลือกสถานะการชดเชย"
              title="5. สถานะการชดเชย"
            >
              <option value="ALL">สถานะการชดเชย: ทั้งหมด</option>
              <option value="paid">ได้รับเงินชดเชย (Compensated &gt; 0)</option>
              <option value="denied">ไม่ได้รับชดเชย (0 บาท)</option>
              <option value="has_error">มีรหัส Error Code</option>
            </select>

            {/* Limit selector for statement cases */}
            {activeTab === 'reps' && (
              <select
                className="filter-select"
                value={recordLimit}
                onChange={(e) => setRecordLimit(Number(e.target.value))}
                aria-label="เลือกจำนวนรายการที่แสดง"
                title="จำนวนรายการที่แสดง"
              >
                <option value={100}>แสดง 100 รายการ</option>
                <option value={250}>แสดง 250 รายการ</option>
                <option value={500}>แสดง 500 รายการ</option>
                <option value={1000}>แสดง 1,000 รายการ</option>
              </select>
            )}
          </div>

          {/* 6. ช่องค้นหาเฉพาะเจาะจง (Search: Rep, HN, Name, Error) */}
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="ค้นหาเลข Rep, HN, ชื่อคนไข้, Error..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="6. ค้นหาเลข Rep, HN, ชื่อคนไข้, หรือรหัส Error"
            />
          </div>
        </div>

        {/* TAB 1: Rep Statements View - Multiple Reps and Multiple HNs combined in one flat table */}
        {activeTab === 'reps' && (
          <div>
            {isCasesLoading ? (
              <div className="loading-box">
                <div className="spinner" />
                <span>กำลังดึงข้อมูลหลาย Rep หลาย HN จากฐานข้อมูล rcmdb...</span>
              </div>
            ) : casesError ? (
              <div className="empty-state">
                <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
                <span className="empty-state-title" style={{ color: 'var(--danger)' }}>
                  เกิดข้อผิดพลาดในการโหลดข้อมูลเคส Rep
                </span>
                <span>{casesError}</span>
                <button type="button" className="btn-primary" onClick={fetchStatementCases}>
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>เลขที่ใบ REP</th>
                      <th>เลขประจำตัว (HN)</th>
                      <th>ชื่อ-สกุลคนไข้</th>
                      <th>วันที่รับบริการ</th>
                      <th>แผนก</th>
                      <th>กองทุน</th>
                      <th className="num-col">ค่ารักษาจริง (บาท)</th>
                      <th className="num-col">เงินชดเชยที่ได้ (บาท)</th>
                      <th className="num-col">ส่วนต่าง (บาท)</th>
                      <th className="num-col">อัตราชดเชย</th>
                      <th>สถานะ / Error Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementCases.length > 0 ? (
                      statementCases.map((record) => (
                        <tr
                          key={record.id}
                          className="clickable-row"
                          tabIndex={0}
                          aria-label={`คลิกเพื่อดูรายละเอียดเคส HN ${record.hn} ในใบ REP ${record.rep}`}
                          title="คลิกที่แถวเพื่อดูรายละเอียดเคสนี้"
                          onClick={() => setSelectedCaseDetail(record)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedCaseDetail(record)
                            }
                          }}
                        >
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{record.rep}</td>
                          <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{record.hn}</td>
                          <td style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{record.ptName}</td>
                          <td>{record.serviceDateThai}</td>
                          <td>
                            <span className="status-badge neutral">{record.department === 'IP' ? 'IPD' : 'OPD'}</span>
                          </td>
                          <td>{record.fundLabel}</td>
                          <td className="num-col">{record.income.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                          <td className="num-col" style={{ color: 'var(--success)', fontWeight: 600 }}>
                            {record.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td
                            className="num-col"
                            style={{
                              color: record.diff < 0 ? 'var(--danger)' : 'var(--success)',
                              fontWeight: 600,
                            }}
                          >
                            {record.diff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="num-col" style={{ fontWeight: 600 }}>
                            {record.percentPay}%
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                              {record.compensated > 0 ? (
                                <span className="status-badge success">ได้รับชดเชย</span>
                              ) : (
                                <span className="status-badge danger">ไม่ได้รับชดเชย (0 บาท)</span>
                              )}
                              {record.errorCode && (
                                <span className="status-badge warning" title={record.errorCode}>
                                  Error {record.errorCode}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={11}>
                          <div className="empty-state">
                            <span className="empty-state-title">ไม่พบข้อมูลเคสในใบ REP ตามเงื่อนไขที่เลือก</span>
                            <span>กรุณาปรับเปลี่ยนตัวกรองกองทุน หรือแผนก เพื่อดูข้อมูล</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {statementCases.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={6}>
                          แสดงทั้งหมด {statementCases.length.toLocaleString('th-TH')} รายการ (หลาย Rep หลาย HN รวมกัน • คลิกที่แถวเพื่อดูรายละเอียด)
                        </td>
                        <td className="num-col">
                          {statementCases.reduce((s, c) => s + c.income, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="num-col" style={{ color: 'var(--success)' }}>
                          {statementCases.reduce((s, c) => s + c.compensated, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="num-col">
                          {statementCases.reduce((s, c) => s + c.diff, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Fund Groups Matrix */}
        {activeTab === 'funds' && (
          <div>
            {isLoadingSummary ? (
              <div className="loading-box">
                <div className="spinner" />
                <span>กำลังดึงข้อมูลสรุปตามกองทุนจากฐานข้อมูล rcmdb...</span>
              </div>
            ) : summaryError ? (
              <div className="empty-state">
                <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
                <span className="empty-state-title" style={{ color: 'var(--danger)' }}>
                  เกิดข้อผิดพลาดในการโหลดข้อมูลสรุปกองทุน
                </span>
                <span>{summaryError}</span>
                <button type="button" className="btn-primary" onClick={fetchSummaryData}>
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>กองทุนหลัก</th>
                      <th>กองทุนย่อย / รายการ</th>
                      <th>แผนก</th>
                      <th className="num-col">จำนวนเคส</th>
                      <th className="num-col">ค่ารักษาจริง (บาท)</th>
                      <th className="num-col">เงินชดเชยที่ได้ (บาท)</th>
                      <th className="num-col">อัตราชดเชย</th>
                      <th className="num-col">ส่วนต่าง (บาท)</th>
                      <th className="num-col">เคสอุทธรณ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundGroups.length > 0 ? (
                      fundGroups.map((group, idx) => (
                        <tr
                          key={`${group.fundKey}_${group.subFundKey}_${group.department}_${idx}`}
                          className="clickable-row"
                          tabIndex={0}
                          aria-label={`คลิกเพื่อดูเคสทั้งหมดในกองทุน ${group.fundLabel}`}
                          title="คลิกที่แถวเพื่อดูรายชื่อคนไข้ในกองทุนนี้"
                          onClick={() => openFundCasesModal(group)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openFundCasesModal(group)
                            }
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>{group.fundLabel}</td>
                          <td>
                            {group.subFundLabel !== '-' ? (
                              group.subFundLabel
                            ) : (
                              <span style={{ color: 'var(--gray-400)' }}>-</span>
                            )}
                          </td>
                          <td>
                            <span className="status-badge neutral">{group.department === 'OP' ? 'OPD' : 'IPD'}</span>
                          </td>
                          <td className="num-col">{group.caseCount.toLocaleString('th-TH')}</td>
                          <td className="num-col">{group.totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                          <td className="num-col" style={{ color: 'var(--success)', fontWeight: 600 }}>
                            {group.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="num-col" style={{ fontWeight: 600 }}>
                            {group.reimbursementRate}%
                          </td>
                          <td
                            className="num-col"
                            style={{
                              color: group.netDiff < 0 ? 'var(--danger)' : 'var(--success)',
                              fontWeight: 600,
                            }}
                          >
                            {group.netDiff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="num-col">
                            {group.appealCount > 0 ? (
                              <span className="status-badge warning">{group.appealCount} เคส</span>
                            ) : (
                              <span style={{ color: 'var(--gray-400)' }}>-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9}>
                          <div className="empty-state">
                            <span className="empty-state-title">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</span>
                            <span>กรุณาปรับเปลี่ยนตัวกรองกองทุน หรือปีงบประมาณเพื่อดูข้อมูล</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {fundGroups.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3}>รวมทั้งสิ้น ({fundGroups.length} รายการกองทุน • คลิกที่แถวเพื่อดูรายชื่อคนไข้)</td>
                        <td className="num-col">{metrics.totalCases.toLocaleString('th-TH')}</td>
                        <td className="num-col">{metrics.totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                        <td className="num-col">{metrics.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                        <td className="num-col">{metrics.rate}%</td>
                        <td
                          className="num-col"
                          style={{ color: metrics.totalDiff < 0 ? 'var(--danger)' : 'var(--success)' }}
                        >
                          {metrics.totalDiff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="num-col">{metrics.pendingAppeals} เคส</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 5. Single Case Detail Modal (Triggered by clicking a row in the combined Rep view) */}
      {selectedCaseDetail && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="case-detail-title">
          <div className="modal-dialog" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div>
                <h3 id="case-detail-title">
                  รายละเอียดเคส: {selectedCaseDetail.ptName} (HN: {selectedCaseDetail.hn})
                </h3>
                <p className="modal-subtitle">
                  ใบแจ้งผล REP: {selectedCaseDetail.rep} • {selectedCaseDetail.departmentLabel} • {selectedCaseDetail.serviceDateThai}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedCaseDetail(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="case-detail-card">
                <div className="case-detail-section">
                  <span className="case-detail-section-title">ข้อมูลผู้ป่วยและบริการ</span>
                  <div className="case-detail-grid">
                    <div className="result-item">
                      <span className="result-label">ชื่อ-สกุลคนไข้</span>
                      <span className="result-value">{selectedCaseDetail.ptName}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">เลขประจำตัวผู้ป่วย (HN)</span>
                      <span className="result-value accent-primary">{selectedCaseDetail.hn}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">วันที่รับบริการ</span>
                      <span className="result-value">{selectedCaseDetail.serviceDateThai}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">แผนกบริการ</span>
                      <span className="result-value">{selectedCaseDetail.departmentLabel}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">เลขที่ใบแจ้งผล (REP)</span>
                      <span className="result-value accent-primary">{selectedCaseDetail.rep}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">กองทุน / สิทธิ</span>
                      <span className="result-value">{selectedCaseDetail.fundLabel}</span>
                    </div>
                    {selectedCaseDetail.subFund && selectedCaseDetail.subFund !== '-' && (
                      <div className="result-item">
                        <span className="result-label">กองทุนย่อย / รายการ</span>
                        <span className="result-value">{selectedCaseDetail.subFundLabel}</span>
                      </div>
                    )}
                    {selectedCaseDetail.projectCode && (
                      <div className="result-item">
                        <span className="result-label">รหัสโครงการ (Project Code)</span>
                        <span className="result-value">{selectedCaseDetail.projectCode}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="case-detail-section">
                  <span className="case-detail-section-title">ข้อมูลการเงินและผลการชดเชย</span>
                  <div className="case-detail-grid">
                    <div className="result-item">
                      <span className="result-label">ค่ารักษาจริง รพ.</span>
                      <span className="result-value">
                        {selectedCaseDetail.income.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">เงินที่ได้รับการชดเชย</span>
                      <span className="result-value text-success">
                        {selectedCaseDetail.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">ส่วนต่างรายรับสุทธิ</span>
                      <span className={`result-value ${selectedCaseDetail.diff < 0 ? 'text-danger' : 'text-success'}`}>
                        {selectedCaseDetail.diff.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">อัตราชดเชย (%)</span>
                      <span className="result-value">{selectedCaseDetail.percentPay}%</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">สถานะการชดเชย</span>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        {selectedCaseDetail.compensated > 0 ? (
                          <span className="status-badge success">ได้รับเงินชดเชย</span>
                        ) : (
                          <span className="status-badge danger">ไม่ได้รับชดเชย (0 บาท)</span>
                        )}
                        {selectedCaseDetail.errorCode && (
                          <span className="status-badge warning">
                            Error {selectedCaseDetail.errorCode}
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedCaseDetail.errorCode && (
                      <div className="result-item">
                        <span className="result-label">รหัส Error Code</span>
                        <span className="result-value text-danger">{selectedCaseDetail.errorCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedCaseDetail(null)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Fund Group Cases Modal (Triggered by clicking a row in the Fund Matrix view) */}
      {activeFundModalTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <div>
                <h3 id="modal-title">{activeFundModalTarget.title}</h3>
                <p className="modal-subtitle">{activeFundModalTarget.subtitle}</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveFundModalTarget(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-toolbar">
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ค้นหาชื่อคนไข้, HN, เลข Rep ในรายการนี้..."
                    value={fundModalSearchTerm}
                    onChange={(e) => setFundModalSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleExportFundModalCsv}
                    disabled={fundModalCases.length === 0}
                  >
                    <Download size={15} />
                    ส่งออกรายชื่อคนไข้ (CSV)
                  </button>
                </div>
              </div>

              {isFundModalLoading ? (
                <div className="loading-box">
                  <div className="spinner" />
                  <span>กำลังดึงข้อมูลรายชื่อคนไข้และยอดเงินชดเชยจากฐานข้อมูล...</span>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>เลขประจำตัว (HN)</th>
                        <th>ชื่อ-สกุลคนไข้</th>
                        <th>วันที่รับบริการ</th>
                        <th>เลขที่ใบ REP</th>
                        <th>แผนก</th>
                        <th className="num-col">ค่ารักษาจริง (บาท)</th>
                        <th className="num-col">เงินชดเชยที่ได้ (บาท)</th>
                        <th className="num-col">ส่วนต่าง (บาท)</th>
                        <th>สถานะ / Error Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFundModalCases.length > 0 ? (
                        filteredFundModalCases.map((item) => (
                          <tr
                            key={item.id}
                            className="clickable-row"
                            title="คลิกเพื่อดูรายละเอียดเชิงลึกของเคสนี้"
                            onClick={() => setSelectedCaseDetail(item)}
                          >
                            <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{item.hn}</td>
                            <td style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{item.ptName}</td>
                            <td>{item.serviceDateThai}</td>
                            <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{item.rep}</td>
                            <td>
                              <span className="status-badge neutral">{item.department === 'IP' ? 'IPD' : 'OPD'}</span>
                            </td>
                            <td className="num-col">{item.income.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                            <td className="num-col" style={{ color: 'var(--success)', fontWeight: 600 }}>
                              {item.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td
                              className="num-col"
                              style={{
                                color: item.diff < 0 ? 'var(--danger)' : 'var(--success)',
                                fontWeight: 600,
                              }}
                            >
                              {item.diff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td>
                              <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                                {item.compensated > 0 ? (
                                  <span className="status-badge success">ได้รับชดเชย</span>
                                ) : (
                                  <span className="status-badge danger">ไม่ได้รับชดเชย (0 บาท)</span>
                                )}
                                {item.errorCode && (
                                  <span className="status-badge warning" title={item.errorCode}>
                                    Error {item.errorCode}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9}>
                            <div className="empty-state">
                              <span className="empty-state-title">ไม่พบข้อมูลคนไข้ตามเงื่อนไข</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <span className="modal-count-text">
                แสดงทั้งหมด {filteredFundModalCases.length} จาก {fundModalCases.length} เคส
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveFundModalTarget(null)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
