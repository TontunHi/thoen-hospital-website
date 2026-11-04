'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  RefreshCw,
  Download,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import './page.css'

export interface PatientClaimRecord {
  id: string
  rep: string
  hn: string
  maskedHn: string
  ptName: string
  serviceDate: string // YYYY-MM-DD
  serviceDateThai: string
  department: 'OP' | 'IP'
  departmentLabel: string
  mainInscl: string // UCS, OFC, SSS, LGO, STP
  fundLabel: string
  subFund: string
  subFundLabel: string
  projectCode?: string
  income: number // ค่ารักษาจริงของ รพ.
  compensated: number // เงินชดเชยที่ สปสช. จ่าย
  diff: number // compensated - income
  percentPay: number
  errorCode?: string
  appeal?: 'Y' | 'N'
  status: 'paid' | 'appeal' | 'denied'
}

export interface FundSummaryGroup {
  fundKey: string
  fundLabel: string
  subFundKey: string
  subFundLabel: string
  department: 'OP' | 'IP'
  caseCount: number
  totalIncome: number
  totalCompensated: number
  reimbursementRate: number // %
  netDiff: number
  appealCount: number
  errorCount: number
}

export interface FundOption {
  key: string
  label: string
}

export interface SubFundOption {
  key: string
  label: string
  fundKey: string
}

export const MAIN_FUNDS: FundOption[] = [
  { key: 'ALL', label: 'กองทุนหลัก: ทั้งหมด' },
  { key: 'UCS', label: 'บัตรทอง (UCS)' },
  { key: 'OFC', label: 'ข้าราชการ (OFC)' },
  { key: 'SSS', label: 'ประกันสังคม (SSS)' },
  { key: 'LGO', label: 'อปท. (LGO)' },
  { key: 'STP', label: 'สถานะและสิทธิ (STP)' },
]

export const SUB_FUNDS_CATALOG: SubFundOption[] = [
  // UCS
  { key: 'PalliativeCare', label: 'การดูแลประคับประคอง (Palliative Care)', fundKey: 'UCS' },
  { key: 'DMISHD', label: 'ฟอกเลือดล้างไต (Hemodialysis)', fundKey: 'UCS' },
  { key: 'STEMI', label: 'โรคหลอดเลือดหัวใจวิกฤต (STEMI)', fundKey: 'UCS' },
  { key: 'GeneralIPD', label: 'ผู้ป่วยในทั่วไป (DRGs/AdjRW)', fundKey: 'UCS' },
  { key: 'GeneralOPD', label: 'ผู้ป่วยนอกทั่วไป (OP Services)', fundKey: 'UCS' },
  { key: 'CATARACT', label: 'ผ่าตัดต้อกระจกและเลนส์ตา (Cataract)', fundKey: 'UCS' },
  { key: 'PP', label: 'สร้างเสริมสุขภาพและป้องกันโรค (PP)', fundKey: 'UCS' },
  { key: 'FeeSchedule', label: 'รายการบริการตามเกณฑ์ (Fee Schedule)', fundKey: 'UCS' },
  // OFC
  { key: 'CATARACT', label: 'ผ่าตัดต้อกระจกและเลนส์ตา (Cataract)', fundKey: 'OFC' },
  { key: 'GeneralIPD', label: 'ผู้ป่วยในทั่วไป (IP Services)', fundKey: 'OFC' },
  { key: 'GeneralOPD', label: 'ผู้ป่วยนอกทั่วไป (OP Services)', fundKey: 'OFC' },
  { key: 'FeeSchedule', label: 'รายการบริการตามเกณฑ์ (Fee Schedule)', fundKey: 'OFC' },
  // SSS
  { key: 'Dental', label: 'ทันตกรรมประกันสังคม (Dental)', fundKey: 'SSS' },
  { key: 'GeneralOPD', label: 'ผู้ป่วยนอกทั่วไป (OP Services)', fundKey: 'SSS' },
  { key: 'GeneralIPD', label: 'ผู้ป่วยในทั่วไป (IP Services)', fundKey: 'SSS' },
  // LGO
  { key: 'FeeSchedule', label: 'รายการบริการตามเกณฑ์ (Fee Schedule)', fundKey: 'LGO' },
  { key: 'GeneralOPD', label: 'ผู้ป่วยนอกทั่วไป (OP Services)', fundKey: 'LGO' },
  { key: 'GeneralIPD', label: 'ผู้ป่วยในทั่วไป (IP Services)', fundKey: 'LGO' },
  // STP
  { key: 'GeneralOPD', label: 'ผู้ป่วยนอกทั่วไป (OP Services)', fundKey: 'STP' },
  { key: 'GeneralIPD', label: 'ผู้ป่วยในทั่วไป (IP Services)', fundKey: 'STP' },
]

// Mock dataset mirroring actual rcmdb.repdata schema
const SAMPLE_RECORDS: PatientClaimRecord[] = [
  {
    id: 'REP6901:0012345',
    rep: 'REP6901-UCS-0042',
    hn: '0012345',
    maskedHn: 'xx-xxx45',
    ptName: 'สมชาย ม*** (จำลอง)',
    serviceDate: '2026-10-15',
    serviceDateThai: '15 ต.ค. 2569',
    department: 'OP',
    departmentLabel: 'ผู้ป่วยนอก (OPD)',
    mainInscl: 'UCS',
    fundLabel: 'บัตรทอง (UCS)',
    subFund: 'PalliativeCare',
    subFundLabel: 'การดูแลประคับประคอง (Palliative Care)',
    income: 3450,
    compensated: 3450,
    diff: 0,
    percentPay: 100,
    status: 'paid',
  },
  {
    id: 'REP6901:0023456',
    rep: 'REP6901-UCS-0042',
    hn: '0023456',
    maskedHn: 'xx-xxx56',
    ptName: 'วันดี ส*** (จำลอง)',
    serviceDate: '2026-10-15',
    serviceDateThai: '15 ต.ค. 2569',
    department: 'OP',
    departmentLabel: 'ผู้ป่วยนอก (OPD)',
    mainInscl: 'UCS',
    fundLabel: 'บัตรทอง (UCS)',
    subFund: 'DMISHD',
    subFundLabel: 'ฟอกเลือดล้างไต (Hemodialysis)',
    income: 4500,
    compensated: 4500,
    diff: 0,
    percentPay: 100,
    status: 'paid',
  },
  {
    id: 'REP6901:0034567',
    rep: 'REP6901-OFC-0018',
    hn: '0034567',
    maskedHn: 'xx-xxx67',
    ptName: 'ประสิทธิ์ ร*** (จำลอง)',
    serviceDate: '2026-10-18',
    serviceDateThai: '18 ต.ค. 2569',
    department: 'IP',
    departmentLabel: 'ผู้ป่วยใน (IPD)',
    mainInscl: 'OFC',
    fundLabel: 'ข้าราชการ (OFC)',
    subFund: 'CATARACT',
    subFundLabel: 'ผ่าตัดต้อกระจกและเลนส์ตา (Cataract)',
    income: 18500,
    compensated: 17575,
    diff: -925,
    percentPay: 95,
    status: 'paid',
  },
  {
    id: 'REP6901:0045678',
    rep: 'REP6901-UCS-0043',
    hn: '0045678',
    maskedHn: 'xx-xxx78',
    ptName: 'กมลพร จ*** (จำลอง)',
    serviceDate: '2026-10-20',
    serviceDateThai: '20 ต.ค. 2569',
    department: 'IP',
    departmentLabel: 'ผู้ป่วยใน (IPD)',
    mainInscl: 'UCS',
    fundLabel: 'บัตรทอง (UCS)',
    subFund: 'STEMI',
    subFundLabel: 'โรคหลอดเลือดหัวใจวิกฤต (STEMI)',
    income: 42000,
    compensated: 35700,
    diff: -6300,
    percentPay: 85,
    errorCode: 'ERR-304 ขาดเอกสารแนบ',
    appeal: 'Y',
    status: 'appeal',
  },
  {
    id: 'REP6901:0056789',
    rep: 'REP6901-SSS-0009',
    hn: '0056789',
    maskedHn: 'xx-xxx89',
    ptName: 'วิเชียร พ*** (จำลอง)',
    serviceDate: '2026-10-22',
    serviceDateThai: '22 ต.ค. 2569',
    department: 'OP',
    departmentLabel: 'ผู้ป่วยนอก (OPD)',
    mainInscl: 'SSS',
    fundLabel: 'ประกันสังคม (SSS)',
    subFund: 'Dental',
    subFundLabel: 'ทันตกรรมประกันสังคม (Dental)',
    income: 900,
    compensated: 900,
    diff: 0,
    percentPay: 100,
    status: 'paid',
  },
  {
    id: 'REP6901:0067890',
    rep: 'REP6901-LGO-0004',
    hn: '0067890',
    maskedHn: 'xx-xxx90',
    ptName: 'บุญเลิศ ม*** (จำลอง)',
    serviceDate: '2026-10-25',
    serviceDateThai: '25 ต.ค. 2569',
    department: 'OP',
    departmentLabel: 'ผู้ป่วยนอก (OPD)',
    mainInscl: 'LGO',
    fundLabel: 'อปท. (LGO)',
    subFund: 'FeeSchedule',
    subFundLabel: 'รายการบริการตามเกณฑ์ (Fee Schedule)',
    income: 1450,
    compensated: 1363,
    diff: -87,
    percentPay: 94,
    status: 'paid',
  },
  {
    id: 'REP6901:0078901',
    rep: 'REP6901-UCS-0044',
    hn: '0078901',
    maskedHn: 'xx-xxx01',
    ptName: 'สำราญ ก*** (จำลอง)',
    serviceDate: '2026-10-28',
    serviceDateThai: '28 ต.ค. 2569',
    department: 'IP',
    departmentLabel: 'ผู้ป่วยใน (IPD)',
    mainInscl: 'UCS',
    fundLabel: 'บัตรทอง (UCS)',
    subFund: 'GeneralIPD',
    subFundLabel: 'ผู้ป่วยในทั่วไป (DRGs/AdjRW)',
    income: 12500,
    compensated: 0,
    diff: -12500,
    percentPay: 0,
    errorCode: 'C-01 รหัสโรคไม่สัมพันธ์กับหัตถการ',
    appeal: 'Y',
    status: 'denied',
  },
  {
    id: 'REP6901:0089012',
    rep: 'REP6901-STP-0002',
    hn: '0089012',
    maskedHn: 'xx-xxx12',
    ptName: 'ไซ ซอง (จำลอง)',
    serviceDate: '2026-10-29',
    serviceDateThai: '29 ต.ค. 2569',
    department: 'OP',
    departmentLabel: 'ผู้ป่วยนอก (OPD)',
    mainInscl: 'STP',
    fundLabel: 'สถานะและสิทธิ (STP)',
    subFund: 'GeneralOPD',
    subFundLabel: 'ผู้ป่วยนอกทั่วไป (OP Services)',
    income: 820,
    compensated: 820,
    diff: 0,
    percentPay: 100,
    status: 'paid',
  },
]

export default function RepFundsClient() {
  // Quick Lookup States
  const [lookupHn, setLookupHn] = useState<string>('')
  const [lookupDate, setLookupDate] = useState<string>('')
  const [lookupResult, setLookupResult] = useState<PatientClaimRecord | null>(null)
  const [hasSearched, setHasSearched] = useState<boolean>(false)

  // Report Filters
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('2569')
  const [selectedDept, setSelectedDept] = useState<'ALL' | 'OP' | 'IP'>('ALL')
  const [selectedFund, setSelectedFund] = useState<string>('ALL')
  const [selectedSubFund, setSelectedSubFund] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Modal State for viewing cases in a fund group
  const [activeModalGroup, setActiveModalGroup] = useState<FundSummaryGroup | null>(null)

  // Cascading SubFunds based on selectedFund
  const availableSubFunds = useMemo<SubFundOption[]>(() => {
    if (selectedFund === 'ALL') {
      // Return distinct subfunds across all funds
      const seen = new Set<string>()
      const list: SubFundOption[] = []
      for (const item of SUB_FUNDS_CATALOG) {
        if (!seen.has(item.key)) {
          seen.add(item.key)
          list.push(item)
        }
      }
      return list
    }
    return SUB_FUNDS_CATALOG.filter((item) => item.fundKey === selectedFund)
  }, [selectedFund])

  // Quick Patient Claim Lookup Action
  const handleQuickLookup = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setHasSearched(true)

    const cleanedHn = lookupHn.trim()
    const cleanedDate = lookupDate.trim()

    if (!cleanedHn) {
      setLookupResult(null)
      return
    }

    const found = SAMPLE_RECORDS.find((r) => {
      const matchHn = r.hn === cleanedHn || r.hn.endsWith(cleanedHn)
      const matchDate = !cleanedDate || r.serviceDate === cleanedDate
      return matchHn && matchDate
    })

    setLookupResult(found || null)
  }

  // Filtered Records for Matrix Table
  const filteredRecords = useMemo(() => {
    return SAMPLE_RECORDS.filter((r) => {
      const matchDept = selectedDept === 'ALL' || r.department === selectedDept
      const matchFund = selectedFund === 'ALL' || r.mainInscl === selectedFund
      const matchSubFund = selectedSubFund === 'ALL' || r.subFund === selectedSubFund
      const matchSearch =
        !searchTerm ||
        r.fundLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.subFundLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.rep.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.hn.includes(searchTerm)
      return matchDept && matchFund && matchSubFund && matchSearch
    })
  }, [selectedDept, selectedFund, selectedSubFund, searchTerm])

  // Aggregate into Fund & SubFund Groups
  const fundGroups = useMemo<FundSummaryGroup[]>(() => {
    const map = new Map<string, FundSummaryGroup>()

    for (const rec of filteredRecords) {
      const key = `${rec.mainInscl}_${rec.subFund}_${rec.department}`
      const existing = map.get(key)

      if (existing) {
        existing.caseCount += 1
        existing.totalIncome += rec.income
        existing.totalCompensated += rec.compensated
        existing.netDiff += rec.diff
        if (rec.appeal === 'Y') existing.appealCount += 1
        if (rec.errorCode) existing.errorCount += 1
      } else {
        map.set(key, {
          fundKey: rec.mainInscl,
          fundLabel: rec.fundLabel,
          subFundKey: rec.subFund,
          subFundLabel: rec.subFundLabel,
          department: rec.department,
          caseCount: 1,
          totalIncome: rec.income,
          totalCompensated: rec.compensated,
          reimbursementRate: 0,
          netDiff: rec.diff,
          appealCount: rec.appeal === 'Y' ? 1 : 0,
          errorCount: rec.errorCode ? 1 : 0,
        })
      }
    }

    // Calculate rates
    const list = Array.from(map.values())
    list.forEach((g) => {
      g.reimbursementRate =
        g.totalIncome > 0
          ? Math.round((g.totalCompensated / g.totalIncome) * 1000) / 10
          : 0
    })

    return list.sort((a, b) => b.totalCompensated - a.totalCompensated)
  }, [filteredRecords])

  // Overall Metrics
  const summaryMetrics = useMemo(() => {
    const totalCases = filteredRecords.length
    const totalIncome = filteredRecords.reduce((acc, r) => acc + r.income, 0)
    const totalCompensated = filteredRecords.reduce((acc, r) => acc + r.compensated, 0)
    const totalDiff = totalCompensated - totalIncome
    const rate = totalIncome > 0 ? (totalCompensated / totalIncome) * 100 : 0
    const pendingAppeals = filteredRecords.filter((r) => r.appeal === 'Y').length

    return {
      totalCases,
      totalIncome,
      totalCompensated,
      rate: rate.toFixed(1),
      totalDiff,
      pendingAppeals,
    }
  }, [filteredRecords])

  // Detail Modal Records
  const modalRecords = useMemo(() => {
    if (!activeModalGroup) return []
    return SAMPLE_RECORDS.filter(
      (r) =>
        r.mainInscl === activeModalGroup.fundKey &&
        r.subFund === activeModalGroup.subFundKey &&
        r.department === activeModalGroup.department
    )
  }, [activeModalGroup])

  return (
    <div className="rep-funds-container">
      {/* 1. Header */}
      <header className="rep-header">
        <div className="rep-header-top">
          <div className="rep-title-group">
            <h1>3.1.1 ข้อมูล Rep แต่ละกองทุน</h1>
            <p className="rep-subtitle">
              ตรวจสอบการชดเชยค่าบริการทางการแพทย์จาก สปสช. (REP) จำแนกตามกองทุนหลัก กองทุนย่อย และระบบตรวจสอบรายบุคคล
            </p>
          </div>
          <div className="rep-header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setLookupHn('')
                setLookupDate('')
                setLookupResult(null)
                setHasSearched(false)
                setSelectedDept('ALL')
                setSelectedFund('ALL')
                setSelectedSubFund('ALL')
                setSearchTerm('')
              }}
            >
              <RefreshCw size={16} />
              ล้างตัวกรอง
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const header = 'กองทุนหลัก,กองทุนย่อย,แผนก,จำนวนเคส,ค่ารักษาจริง,เงินชดเชย,ส่วนต่าง\n'
                const rows = fundGroups
                  .map(
                    (g) =>
                      `"${g.fundLabel}","${g.subFundLabel}","${g.department}",${g.caseCount},${g.totalIncome},${g.totalCompensated},${g.netDiff}`
                  )
                  .join('\n')
                const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `rep-funds-report-${selectedFiscalYear}.csv`
                a.click()
              }}
            >
              <Download size={16} />
              ส่งออก CSV
            </button>
          </div>
        </div>
      </header>

      {/* 2. Section 1: Quick Patient Claim Lookup (HN + วันที่ -> Rep -> กองทุน -> ค่าเงิน) */}
      <section className="card-surface lookup-section" aria-labelledby="lookup-heading">
        <div className="lookup-header">
          <h2 id="lookup-heading">ตรวจสอบข้อมูลการชดเชยรายบุคคล (Patient Claim Lookup)</h2>
          <span className="lookup-guide">กรอก HN และวันที่รับบริการเพื่อดึงเลข Rep, สิทธิกองทุน และยอดชดเชย</span>
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
              placeholder="ระบุเลข HN เช่น 0012345"
              value={lookupHn}
              onChange={(e) => setLookupHn(e.target.value)}
              required
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

          <button type="submit" className="btn-primary">
            <Search size={16} />
            ค้นหาข้อมูล Rep
          </button>

          {lookupResult && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setLookupResult(null)
                setHasSearched(false)
              }}
            >
              <X size={16} />
              ปิดผลค้นหา
            </button>
          )}
        </form>

        {/* Result Container */}
        {hasSearched && (
          <div className="lookup-result-box" role="region" aria-label="ผลการค้นหาข้อมูลผู้ป่วย">
            {lookupResult ? (
              <>
                <div className="lookup-result-header">
                  <div>
                    <span className="result-label">ผู้ป่วย / สิทธิการรักษา</span>
                    <div style={{ fontWeight: 700, fontSize: '1.0625rem', marginTop: '0.125rem' }}>
                      {lookupResult.maskedHn} : {lookupResult.ptName} ({lookupResult.serviceDateThai})
                    </div>
                  </div>
                  <div>
                    {lookupResult.status === 'paid' && (
                      <span className="status-badge success">
                        <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                        ชดเชยครบถ้วน ({lookupResult.percentPay}%)
                      </span>
                    )}
                    {lookupResult.status === 'appeal' && (
                      <span className="status-badge warning">
                        <AlertCircle size={13} style={{ marginRight: 4 }} />
                        ติดอุทธรณ์ (จ่าย {lookupResult.percentPay}%)
                      </span>
                    )}
                    {lookupResult.status === 'denied' && (
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
                    <span className="result-value accent-primary">{lookupResult.rep}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">กองทุนหลัก</span>
                    <span className="result-value">{lookupResult.fundLabel}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">กองทุนย่อย / โครงการ</span>
                    <span className="result-value">{lookupResult.subFundLabel}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">แผนกบริการ</span>
                    <span className="result-value">{lookupResult.departmentLabel}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">ค่ารักษาจริง รพ.</span>
                    <span className="result-value">{lookupResult.income.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">สปสช. ชดเชยให้</span>
                    <span className="result-value text-success">
                      {lookupResult.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">ส่วนต่าง (ผลต่างรายรับ)</span>
                    <span className={`result-value ${lookupResult.diff < 0 ? 'text-danger' : 'text-success'}`}>
                      {lookupResult.diff.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>
                  {lookupResult.errorCode && (
                    <div className="result-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="result-label">สาเหตุข้อผิดพลาด (Error Code)</span>
                      <span className="result-value text-danger" style={{ fontSize: '0.875rem' }}>
                        {lookupResult.errorCode}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--gray-600)' }}>
                ไม่พบข้อมูลเลขที่ Rep หรือยอดชดเชยสำหรับ HN {lookupHn} ในวันที่ระบุ
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Section 2: Summary KPI Cards */}
      <section className="summary-bar" aria-label="แถบสรุปยอดรวมประจำปีงบประมาณ">
        <div className="card-surface metric-card">
          <span className="metric-label">ค่ารักษาพยาบาลจริงรวม</span>
          <span className="metric-value">
            {summaryMetrics.totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">ยอดบันทึกจริงในระบบ HOSxP (บาท)</span>
        </div>

        <div className="card-surface metric-card">
          <span className="metric-label">ยอดเงินชดเชย สปสช. รวม</span>
          <span className="metric-value" style={{ color: 'var(--primary-dark)' }}>
            {summaryMetrics.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">ยอดเงินที่ได้รับโอนชดเชยจริง (บาท)</span>
        </div>

        <div className="card-surface metric-card">
          <span className="metric-label">อัตราการชดเชยเฉลี่ย</span>
          <span className="metric-value" style={{ color: 'var(--success)' }}>
            {summaryMetrics.rate}%
          </span>
          <span className="metric-sub">สัดส่วนเงินชดเชยเทียบกับค่ารักษาจริง</span>
        </div>

        <div className="card-surface metric-card">
          <span className="metric-label">ส่วนต่างรายรับสุทธิ</span>
          <span
            className="metric-value"
            style={{ color: summaryMetrics.totalDiff < 0 ? 'var(--danger)' : 'var(--success)' }}
          >
            {summaryMetrics.totalDiff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">
            {summaryMetrics.totalDiff < 0 ? 'ส่วนขาดทุน / ยังไม่ได้รับการชดเชย' : 'ส่วนเกินรายรับ (บาท)'}
          </span>
        </div>

        <div className="card-surface metric-card">
          <span className="metric-label">เคสรอดำเนินการอุทธรณ์</span>
          <span
            className="metric-value"
            style={{ color: summaryMetrics.pendingAppeals > 0 ? 'var(--warning)' : 'var(--gray-900)' }}
          >
            {summaryMetrics.pendingAppeals}
          </span>
          <span className="metric-sub">รายการที่ต้องส่งเอกสารทวงหนี้เพิ่ม (เคส)</span>
        </div>
      </section>

      {/* 4. Section 3: Toolbar & Fund Matrix Table with Cascading Dropdowns */}
      <section className="card-surface" aria-labelledby="table-heading">
        <div className="toolbar-section">
          <div className="filter-group">
            <h2 id="table-heading" style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--gray-900)', marginRight: '0.5rem' }}>
              สรุปข้อมูล Rep จำแนกตามกองทุน
            </h2>

            {/* Fiscal Year Filter */}
            <select
              className="filter-select"
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              aria-label="เลือกปีงบประมาณ"
            >
              <option value="2569">ปีงบประมาณ 2569</option>
              <option value="2568">ปีงบประมาณ 2568</option>
              <option value="2567">ปีงบประมาณ 2567</option>
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

            {/* Main Fund Filter (เลือกกองทุนหลัก) */}
            <select
              className="filter-select"
              value={selectedFund}
              onChange={(e) => {
                const newFund = e.target.value
                setSelectedFund(newFund)
                setSelectedSubFund('ALL') // Reset cascading sub-fund when main fund changes
              }}
              aria-label="เลือกกองทุนหลัก"
            >
              {MAIN_FUNDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Cascading Sub Fund Filter (เลือกกองทุนย่อยเฉพาะของกองทุนหลักที่เลือก) */}
            <select
              className="filter-select"
              value={selectedSubFund}
              onChange={(e) => setSelectedSubFund(e.target.value)}
              aria-label="เลือกกองทุนย่อย"
            >
              <option value="ALL">
                {selectedFund === 'ALL' ? 'กองทุนย่อย: ทั้งหมด' : `กองทุนย่อยของ ${selectedFund}: ทั้งหมด`}
              </option>
              {availableSubFunds.map((s, idx) => (
                <option key={`${s.fundKey}_${s.key}_${idx}`} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="ค้นหาชื่อกองทุน หรือโครงการ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Matrix Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>กองทุนหลัก</th>
                <th>กองทุนย่อย / โครงการ</th>
                <th>แผนก</th>
                <th className="num-col">จำนวนเคส</th>
                <th className="num-col">ค่ารักษาจริง (บาท)</th>
                <th className="num-col">เงินชดเชย สปสช. (บาท)</th>
                <th className="num-col">อัตราชดเชย</th>
                <th className="num-col">ส่วนต่าง (บาท)</th>
                <th className="num-col">เคสอุทธรณ์</th>
                <th style={{ textAlign: 'center' }}>การจัดการ</th>
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
                    <td className="num-col">{group.caseCount}</td>
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
                        onClick={() => setActiveModalGroup(group)}
                      >
                        ดูเคส ({group.caseCount})
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
                      <span>กรุณาปรับเปลี่ยนตัวกรองกองทุนหลัก หรือกองทุนย่อยเพื่อดูข้อมูลใหม่</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {fundGroups.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>รวมทั้งสิ้น ({fundGroups.length} กลุ่มกองทุน)</td>
                  <td className="num-col">{summaryMetrics.totalCases}</td>
                  <td className="num-col">{summaryMetrics.totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                  <td className="num-col">{summaryMetrics.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                  <td className="num-col">{summaryMetrics.rate}%</td>
                  <td
                    className="num-col"
                    style={{ color: summaryMetrics.totalDiff < 0 ? 'var(--danger)' : 'var(--success)' }}
                  >
                    {summaryMetrics.totalDiff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="num-col">{summaryMetrics.pendingAppeals} เคส</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* 5. Detail Modal for Cases in Selected Fund Group */}
      {activeModalGroup && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="modal-title">
                รายการเคสผู้ป่วย: {activeModalGroup.fundLabel} &gt; {activeModalGroup.subFundLabel} ({activeModalGroup.department === 'OP' ? 'ผู้ป่วยนอก' : 'ผู้ป่วยใน'})
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveModalGroup(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>เลขประจำตัว (HN)</th>
                      <th>ชื่อ-สกุล (จำลอง)</th>
                      <th>วันที่รับบริการ</th>
                      <th>เลขที่ใบ REP</th>
                      <th className="num-col">ค่ารักษา (บาท)</th>
                      <th className="num-col">เงินชดเชย (บาท)</th>
                      <th>สถานะ / ข้อผิดพลาด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRecords.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.maskedHn}</td>
                        <td>{item.ptName}</td>
                        <td>{item.serviceDateThai}</td>
                        <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{item.rep}</td>
                        <td className="num-col">{item.income.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                        <td className="num-col" style={{ color: 'var(--success)', fontWeight: 600 }}>
                          {item.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveModalGroup(null)}
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
