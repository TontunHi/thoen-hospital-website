'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Download,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Users,
  FileText,
  Building2,
  Layers,
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
  // Active Tab
  const [activeTab, setActiveTab] = useState<'funds' | 'reps'>('funds')

  // Quick Lookup States (HN / Date / Name)
  const [lookupHn, setLookupHn] = useState<string>('')
  const [lookupDate, setLookupDate] = useState<string>('')
  const [lookupResults, setLookupResults] = useState<PatientClaimRecord[]>([])
  const [isSearchingLookup, setIsSearchingLookup] = useState<boolean>(false)
  const [hasSearched, setHasSearched] = useState<boolean>(false)

  // Report Filters
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('2570')
  const [selectedDept, setSelectedDept] = useState<'ALL' | 'OP' | 'IP'>('ALL')
  const [selectedFund, setSelectedFund] = useState<string>('ALL')
  const [selectedSubFund, setSelectedSubFund] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Data States
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
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
  const [repList, setRepList] = useState<RepStatementSummary[]>([])
  const [availableYears, setAvailableYears] = useState<string[]>(['2570', '2569', '2568', '2567'])
  const [availableFunds, setAvailableFunds] = useState<Array<{ key: string; label: string; count: number }>>([])

  // Modal State for viewing cases in a fund group or specific Rep
  const [activeModalTarget, setActiveModalTarget] = useState<
    | { type: 'fund'; title: string; subtitle: string; group: FundSummaryGroup }
    | { type: 'rep'; title: string; subtitle: string; statement: RepStatementSummary }
    | null
  >(null)
  const [modalCases, setModalCases] = useState<PatientClaimRecord[]>([])
  const [isModalLoading, setIsModalLoading] = useState<boolean>(false)
  const [modalSearchTerm, setModalSearchTerm] = useState<string>('')

  // 1. Fetch Summary Data
  const fetchSummaryData = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)

    try {
      const q = new URLSearchParams()
      if (selectedFiscalYear) q.set('fiscalYear', selectedFiscalYear)
      if (selectedDept && selectedDept !== 'ALL') q.set('department', selectedDept)
      if (selectedFund && selectedFund !== 'ALL') q.set('fund', selectedFund)
      if (selectedSubFund && selectedSubFund !== 'ALL') q.set('subFund', selectedSubFund)
      if (searchTerm.trim()) q.set('search', searchTerm.trim())

      const res = await fetch(`/api/service/dashboard-rcm/rep-funds?${q.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }

      setMetrics(json.metrics || {
        totalCases: 0,
        totalReps: 0,
        totalIncome: 0,
        totalCompensated: 0,
        rate: '0.0',
        totalDiff: 0,
        pendingAppeals: 0,
        errorCount: 0,
      })
      setFundGroups(json.fundGroups || [])
      setRepList(json.repList || [])
      if (json.availableYears?.length > 0) {
        setAvailableYears(json.availableYears)
      }
      if (json.availableFunds?.length > 0) {
        setAvailableFunds(json.availableFunds)
      }
    } catch (err: any) {
      setFetchError(err.message || 'ไม่สามารถโหลดข้อมูลสรุป Rep ได้')
    } finally {
      setIsLoading(false)
    }
  }, [selectedFiscalYear, selectedDept, selectedFund, selectedSubFund, searchTerm])

  useEffect(() => {
    fetchSummaryData()
  }, [fetchSummaryData])

  // 2. Quick Patient Claim Lookup
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

  // 3. Drill-down into cases (Fund or Rep)
  const openFundCasesModal = async (group: FundSummaryGroup) => {
    setActiveModalTarget({
      type: 'fund',
      title: `รายชื่อคนไข้: ${group.fundLabel} > ${group.subFundLabel}`,
      subtitle: `แผนก ${group.department === 'IP' ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD)'} • ทั้งหมด ${group.caseCount} เคส • ได้รับชดเชยรวม ${group.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`,
      group,
    })
    setModalSearchTerm('')
    setIsModalLoading(true)

    try {
      const q = new URLSearchParams()
      q.set('fund', group.fundKey)
      if (group.subFundKey && group.subFundKey !== '-') q.set('subFund', group.subFundKey)
      q.set('department', group.department)
      q.set('fiscalYear', selectedFiscalYear)

      const res = await fetch(`/api/service/dashboard-rcm/rep-funds/cases?${q.toString()}`)
      const json = await res.json()
      if (res.ok && json.success) {
        setModalCases(json.cases || [])
      } else {
        setModalCases([])
      }
    } catch {
      setModalCases([])
    } finally {
      setIsModalLoading(false)
    }
  }

  const openRepCasesModal = async (statement: RepStatementSummary) => {
    setActiveModalTarget({
      type: 'rep',
      title: `รายละเอียดคนไข้ในใบแจ้งผล REP: ${statement.rep}`,
      subtitle: `กองทุน ${statement.fundLabel} • แผนก ${statement.department === 'IP' ? 'ผู้ป่วยใน (IPD)' : 'ผู้ป่วยนอก (OPD)'} • คนไข้ ${statement.caseCount} ราย • ได้รับชดเชย ${statement.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท (${statement.reimbursementRate}%)`,
      statement,
    })
    setModalSearchTerm('')
    setIsModalLoading(true)

    try {
      const q = new URLSearchParams()
      q.set('rep', statement.rep)
      const res = await fetch(`/api/service/dashboard-rcm/rep-funds/cases?${q.toString()}`)
      const json = await res.json()
      if (res.ok && json.success) {
        setModalCases(json.cases || [])
      } else {
        setModalCases([])
      }
    } catch {
      setModalCases([])
    } finally {
      setIsModalLoading(false)
    }
  }

  // Filtered modal cases for live in-modal search
  const filteredModalCases = useMemo(() => {
    if (!modalSearchTerm.trim()) return modalCases
    const term = modalSearchTerm.toLowerCase().trim()
    return modalCases.filter(
      (c) =>
        c.hn.toLowerCase().includes(term) ||
        c.ptName.toLowerCase().includes(term) ||
        c.rep.toLowerCase().includes(term) ||
        (c.errorCode && c.errorCode.toLowerCase().includes(term))
    )
  }, [modalCases, modalSearchTerm])

  // Export CSV functions
  const handleExportSummaryCsv = () => {
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
      const header = 'เลขที่ใบ REP,ปีงบประมาณ,แผนก,กองทุน,จำนวนคนไข้,ค่ารักษาจริง (บาท),เงินชดเชยที่ได้ (บาท),อัตราชดเชย (%),ส่วนต่าง (บาท),เคสอุทธรณ์\n'
      const rows = repList
        .map(
          (r) =>
            `"${r.rep}","${r.yearBudget}","${r.department === 'IP' ? 'IPD' : 'OPD'}","${r.fundLabel}",${r.caseCount},${r.totalIncome},${r.totalCompensated},${r.reimbursementRate},${r.netDiff},${r.appealCount}`
        )
        .join('\n')
      const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rep-statement-list-${selectedFiscalYear}.csv`
      a.click()
    }
  }

  const handleExportModalCasesCsv = () => {
    const BOM = '\uFEFF'
    const header = 'เลขประจำตัว (HN),ชื่อ-นามสกุลคนไข้,วันที่รับบริการ,เลขที่ใบ REP,แผนก,กองทุน,ค่ารักษาจริง (บาท),เงินชดเชย (บาท),ส่วนต่าง (บาท),อัตราชดเชย (%),สถานะ,รหัส Error\n'
    const rows = modalCases
      .map(
        (c) =>
          `"${c.hn}","${c.ptName}","${c.serviceDateThai}","${c.rep}","${c.departmentLabel}","${c.fundLabel}",${c.income},${c.compensated},${c.diff},${c.percentPay}%,"${c.status}","${c.errorCode || ''}"`
      )
      .join('\n')
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rep-patient-cases-${activeModalTarget?.type === 'rep' ? activeModalTarget.statement.rep : 'export'}.csv`
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
              ตรวจสอบการชดเชยค่าบริการทางการแพทย์จาก สปสช. และกองทุนต่างๆ (REP) เชื่อมต่อฐานข้อมูลจริง จำแนกตามกองทุน รายการ REP และเจาะลึกดูรายชื่อคนไข้พร้อมยอดเงินชดเชยรายบุคคล
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
                setSelectedDept('ALL')
                setSelectedFund('ALL')
                setSelectedSubFund('ALL')
                setSearchTerm('')
                fetchSummaryData()
              }}
            >
              <RefreshCw size={16} />
              รีเฟรชข้อมูล
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleExportSummaryCsv}
            >
              <Download size={16} />
              ส่งออก CSV ({activeTab === 'funds' ? 'ตามกองทุน' : 'ตามใบ REP'})
            </button>
          </div>
        </div>
      </header>

      {/* 2. Quick Patient Claim Lookup (ตรวจสอบรายบุคคล: HN / วันที่ -> Rep -> คนไข้ -> ยอดชดเชย) */}
      <section className="card-surface lookup-section" aria-labelledby="lookup-heading">
        <div className="lookup-header">
          <div>
            <h2 id="lookup-heading">ตรวจสอบข้อมูลการชดเชยรายบุคคล (Patient Claim Lookup)</h2>
            <span className="lookup-guide">
              กรอก HN หรือวันที่รับบริการ เพื่อดูยันว่า Rep นี้เป็นของใคร ได้รับเงินชดเชยกี่บาท
            </span>
          </div>
        </div>

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-900)' }}>
                  พบข้อมูลการชดเชยทั้งหมด {lookupResults.length} รายการ สำหรับคนไข้: {lookupResults[0].ptName} (HN: {lookupResults[0].hn})
                </div>

                {lookupResults.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      background: 'var(--white)',
                      border: '1px solid var(--gray-200)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '1rem',
                    }}
                  >
                    <div className="lookup-result-header">
                      <div>
                        <span className="result-label">คนไข้ / วันที่รับบริการ</span>
                        <div style={{ fontWeight: 700, fontSize: '1.0625rem', marginTop: '0.125rem' }}>
                          {rec.ptName} (HN: {rec.hn}) • {rec.serviceDateThai}
                        </div>
                      </div>
                      <div>
                        {rec.status === 'paid' && (
                          <span className="status-badge success">
                            <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                            ชดเชยครบ ({rec.percentPay}%)
                          </span>
                        )}
                        {rec.status === 'appeal' && (
                          <span className="status-badge warning">
                            <AlertCircle size={13} style={{ marginRight: 4 }} />
                            ติดอุทธรณ์ / จ่ายบางส่วน ({rec.percentPay}%)
                          </span>
                        )}
                        {rec.status === 'denied' && (
                          <span className="status-badge danger">
                            <AlertCircle size={13} style={{ marginRight: 4 }} />
                            ปฏิเสธการจ่าย (0%)
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
                        <div className="result-item" style={{ gridColumn: '1 / -1' }}>
                          <span className="result-label">สาเหตุข้อผิดพลาด (Error Code)</span>
                          <span className="result-value text-danger" style={{ fontSize: '0.875rem' }}>
                            {rec.errorCode}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--gray-600)' }}>
                ไม่พบข้อมูลใบ REP หรือยอดเงินชดเชยสำหรับเงื่อนไขที่ระบุ กรุณาตรวจสอบเลข HN หรือวันที่รับบริการอีกครั้ง
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Summary KPI Cards */}
      <section className="summary-bar" aria-label="แถบสรุปยอดรวมประจำปีงบประมาณ">
        <div className="card-surface metric-card">
          <span className="metric-label">ค่ารักษาพยาบาลจริงรวม</span>
          <span className="metric-value">
            {metrics.totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">ยอดบันทึกจริงในระบบ HOSxP (บาท)</span>
        </div>

        <div className="card-surface metric-card">
          <span className="metric-label">ยอดเงินชดเชย สปสช. รวม</span>
          <span className="metric-value" style={{ color: 'var(--primary-dark)' }}>
            {metrics.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">ยอดเงินที่ได้รับโอนชดเชยจริง (บาท)</span>
        </div>

        <div className="card-surface metric-card">
          <span className="metric-label">อัตราการชดเชยเฉลี่ย</span>
          <span className="metric-value" style={{ color: 'var(--success)' }}>
            {metrics.rate}%
          </span>
          <span className="metric-sub">สัดส่วนเงินชดเชยเทียบกับค่ารักษาจริง</span>
        </div>

        <div className="card-surface metric-card">
          <span className="metric-label">ส่วนต่างรายรับสุทธิ</span>
          <span
            className="metric-value"
            style={{ color: metrics.totalDiff < 0 ? 'var(--danger)' : 'var(--success)' }}
          >
            {metrics.totalDiff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">
            {metrics.totalDiff < 0 ? 'ส่วนขาดทุน / ยังไม่ได้รับการชดเชย' : 'ส่วนเกินรายรับ (บาท)'}
          </span>
        </div>

        <div className="card-surface metric-card">
          <span className="metric-label">เคสรออุทธรณ์ / ติด Error</span>
          <span
            className="metric-value"
            style={{ color: metrics.pendingAppeals > 0 || metrics.errorCount > 0 ? 'var(--warning)' : 'var(--gray-900)' }}
          >
            {metrics.pendingAppeals} เคส
          </span>
          <span className="metric-sub">Error {metrics.errorCount} เคส • รอส่งหลักฐานเพิ่ม</span>
        </div>
      </section>

      {/* 4. Filter Toolbar & Main Data Table */}
      <section className="card-surface" aria-labelledby="table-heading">
        <div className="toolbar-section">
          <div className="filter-group">
            <h2 id="table-heading" style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--gray-900)', marginRight: '0.5rem' }}>
              ข้อมูล Rep สรุปรายกองทุน
            </h2>

            {/* Fiscal Year Filter */}
            <select
              className="filter-select"
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              aria-label="เลือกปีงบประมาณ"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  ปีงบประมาณ {yr}
                </option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              className="filter-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value as 'ALL' | 'OP' | 'IP')}
              aria-label="เลือกประเภทผู้ป่วย"
            >
              <option value="ALL">แผนกบริการ: ทั้งหมด</option>
              <option value="OP">ผู้ป่วยนอก (OPD)</option>
              <option value="IP">ผู้ป่วยใน (IPD)</option>
            </select>

            {/* Fund Filter */}
            <select
              className="filter-select"
              value={selectedFund}
              onChange={(e) => setSelectedFund(e.target.value)}
              aria-label="เลือกกองทุนหลัก"
            >
              <option value="ALL">กองทุน: ทั้งหมด</option>
              <option value="UCS">บัตรทอง (UCS รวมทั้งหมด)</option>
              <option value="OFC">ข้าราชการ (OFC/CS รวมทั้งหมด)</option>
              <option value="SSS">ประกันสังคม (SSS รวมทั้งหมด)</option>
              <option value="LGO">อปท. (LGO รวมทั้งหมด)</option>
              <option value="STP">สถานะและสิทธิ (STP)</option>
              {availableFunds.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="ค้นหาเลข Rep, กองทุน, คนไข้..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ padding: '0 1.25rem' }}>
          <div className="view-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'funds'}
              className={`view-tab-btn ${activeTab === 'funds' ? 'active' : ''}`}
              onClick={() => setActiveTab('funds')}
            >
              <Layers size={16} />
              มุมมองตามกองทุน (Fund Matrix)
              <span className="tab-badge">{fundGroups.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'reps'}
              className={`view-tab-btn ${activeTab === 'reps' ? 'active' : ''}`}
              onClick={() => setActiveTab('reps')}
            >
              <FileText size={16} />
              มุมมองตามใบแจ้งผล REP (Rep Statements)
              <span className="tab-badge">{repList.length}</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {isLoading ? (
          <div className="loading-box">
            <div className="spinner" />
            <span>กำลังดึงข้อมูลจากฐานข้อมูล rcmdb...</span>
          </div>
        ) : fetchError ? (
          <div className="empty-state">
            <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
            <span className="empty-state-title" style={{ color: 'var(--danger)' }}>
              เกิดข้อผิดพลาดในการโหลดข้อมูล
            </span>
            <span>{fetchError}</span>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '0.75rem' }}
              onClick={fetchSummaryData}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : activeTab === 'funds' ? (
          /* TAB 1: Fund Groups Matrix */
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
                  <th style={{ textAlign: 'center' }}>ดูคนไข้ / เคส</th>
                </tr>
              </thead>
              <tbody>
                {fundGroups.length > 0 ? (
                  fundGroups.map((group, idx) => (
                    <tr key={`${group.fundKey}_${group.subFundKey}_${group.department}_${idx}`}>
                      <td style={{ fontWeight: 600 }}>{group.fundLabel}</td>
                      <td>{group.subFundLabel}</td>
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
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="link-action"
                          onClick={() => openFundCasesModal(group)}
                        >
                          ดูเคส ({group.caseCount.toLocaleString('th-TH')})
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10}>
                      <div className="empty-state">
                        <FileSpreadsheet size={32} />
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
                    <td colSpan={3}>รวมทั้งสิ้น ({fundGroups.length} รายการกองทุน)</td>
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
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          /* TAB 2: Statement Rep View (เจาะลึกตามใบแจ้งผล REP) */
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>เลขที่ใบ REP</th>
                  <th>ปีงบประมาณ</th>
                  <th>แผนก</th>
                  <th>กองทุน</th>
                  <th className="num-col">จำนวนคนไข้</th>
                  <th className="num-col">ค่ารักษาจริง (บาท)</th>
                  <th className="num-col">เงินชดเชยที่ได้ (บาท)</th>
                  <th className="num-col">อัตราชดเชย</th>
                  <th className="num-col">ส่วนต่าง (บาท)</th>
                  <th style={{ textAlign: 'center' }}>ดูคนไข้ใน Rep นี้</th>
                </tr>
              </thead>
              <tbody>
                {repList.length > 0 ? (
                  repList.map((statement, idx) => (
                    <tr key={`${statement.rep}_${idx}`}>
                      <td style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{statement.rep}</td>
                      <td>ปี {statement.yearBudget}</td>
                      <td>
                        <span className="status-badge neutral">{statement.department === 'OP' ? 'OPD' : 'IPD'}</span>
                      </td>
                      <td>{statement.fundLabel}</td>
                      <td className="num-col" style={{ fontWeight: 600 }}>
                        {statement.caseCount.toLocaleString('th-TH')} ราย
                      </td>
                      <td className="num-col">{statement.totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                      <td className="num-col" style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {statement.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="num-col" style={{ fontWeight: 600 }}>
                        {statement.reimbursementRate}%
                      </td>
                      <td
                        className="num-col"
                        style={{
                          color: statement.netDiff < 0 ? 'var(--danger)' : 'var(--success)',
                          fontWeight: 600,
                        }}
                      >
                        {statement.netDiff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{
                            padding: '0.25rem 0.75rem',
                            fontSize: '0.8125rem',
                            minHeight: '36px',
                          }}
                          onClick={() => openRepCasesModal(statement)}
                        >
                          <Users size={14} />
                          ดูคนไข้ ({statement.caseCount.toLocaleString('th-TH')})
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10}>
                      <div className="empty-state">
                        <FileSpreadsheet size={32} />
                        <span className="empty-state-title">ไม่พบข้อมูลใบแจ้งผล REP ตามเงื่อนไข</span>
                        <span>กรุณาปรับเปลี่ยนตัวกรองเพื่อดูข้อมูลใบ REP รายการอื่น</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. Detail Modal for Cases (Patient-level drilldown answering "Rep นี้เป็นของใคร ได้เท่าไหร่") */}
      {activeModalTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-dialog" style={{ maxWidth: '1100px' }}>
            <div className="modal-header">
              <div>
                <h3 id="modal-title">{activeModalTarget.title}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                  {activeModalTarget.subtitle}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModalTarget(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Modal toolbar: Search + Export */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ค้นหาชื่อคนไข้, HN, เลข Rep ในรายการนี้..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleExportModalCasesCsv}
                    disabled={modalCases.length === 0}
                  >
                    <Download size={15} />
                    ส่งออกรายชื่อคนไข้ (CSV)
                  </button>
                </div>
              </div>

              {isModalLoading ? (
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
                      {filteredModalCases.length > 0 ? (
                        filteredModalCases.map((item) => (
                          <tr key={item.id}>
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
                              {item.status === 'paid' && <span className="status-badge success">ชดเชยครบ 100%</span>}
                              {item.status === 'appeal' && (
                                <span className="status-badge warning" title={item.errorCode}>
                                  ติดอุทธรณ์ ({item.errorCode || 'รอส่งหลักฐาน'})
                                </span>
                              )}
                              {item.status === 'denied' && (
                                <span className="status-badge danger" title={item.errorCode}>
                                  {item.errorCode || 'ปฏิเสธจ่าย 0%'}
                                </span>
                              )}
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
              <span style={{ marginRight: 'auto', fontSize: '0.875rem', color: 'var(--gray-600)', alignSelf: 'center' }}>
                แสดงทั้งหมด {filteredModalCases.length} จาก {modalCases.length} เคส
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveModalTarget(null)}
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
