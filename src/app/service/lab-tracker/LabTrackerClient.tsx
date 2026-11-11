'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  ArrowLeft,
  User,
  Stethoscope,
  FileText,
  FlaskConical,
  Users,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { formatThaiDate } from '@/lib/formatters'
import { usePolling } from '@/hooks/usePolling'
import './page.css'

interface DoctorItem {
  code: string
  name: string
  count: number
}

interface PatientReportItem {
  hn: string
  patientName: string
  formName?: string
  orderTime?: string
  receiveTime?: string
  reportTime?: string
  ovstost?: string
  doctorName?: string
}

interface LabDetail {
  hn: string
  patientName: string
  reported: {
    formName: string
    itemName: string
    result: string
    refValue: string
  }[]
  pending: {
    formName: string
    itemName: string
    isOutLab: string
  }[]
}

type TabFilter = 'all' | 'pending' | 'reported'

export default function LabTrackerClient() {
  // Navigation states
  const [activeDoctor, setActiveDoctor] = useState<{ code: string; name: string } | null>(null)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabFilter>('all')

  // Data states
  const [dashboardData, setDashboardData] = useState<{
    doctors: DoctorItem[]
    others: DoctorItem[]
    totalCount: number
  } | null>(null)
  const [reportData, setReportData] = useState<{
    pending: PatientReportItem[]
    reported: PatientReportItem[]
  } | null>(null)

  // Loading & Error states
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  // Modal detailed states
  const [selectedHn, setSelectedHn] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalData, setModalData] = useState<LabDetail | null>(null)

  // Fetch Dashboard data (doctors and nurses)
  const fetchDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/service/lab-tracker/doctors')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถดึงข้อมูลรายการผู้สั่งตรวจได้')
      }
      setDashboardData(data)
      setLastRefreshed(new Date())
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดแดชบอร์ด')
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  // Fetch report lists for selected doctor/staff
  const fetchDoctorReport = useCallback(async (code: string, isSilent = false) => {
    if (!isSilent) setReportLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/service/lab-tracker/report?id=${code}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถดึงประวัติรายงาน LAB ได้')
      }
      setReportData({
        pending: data.pending || [],
        reported: data.reported || [],
      })
      setLastRefreshed(new Date())
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดรายการความคืบหน้า')
    } finally {
      if (!isSilent) setReportLoading(false)
    }
  }, [])

  // Polling with Page Visibility API (S1)
  const pollFn = useCallback(async () => {
    if (activeDoctor) {
      await fetchDoctorReport(activeDoctor.code, true)
    } else {
      await fetchDashboard(true)
    }
  }, [activeDoctor, fetchDoctorReport, fetchDashboard])

  const { refresh: pollRefresh } = usePolling(pollFn, 30000, { immediate: false })

  // Initial load
  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleSelectDoctor = (code: string, name: string) => {
    setActiveDoctor({ code, name })
    setReportData(null)
    setSearchQuery('')
    setActiveTab('all')
    fetchDoctorReport(code)
  }

  const handleBackToDashboard = () => {
    setActiveDoctor(null)
    setReportData(null)
    setSearchQuery('')
    setActiveTab('all')
    fetchDashboard()
  }

  const handleOpenLabDetail = async (hn: string) => {
    setSelectedHn(hn)
    setModalLoading(true)
    setModalError(null)
    setModalData(null)

    try {
      const res = await fetch(`/api/service/lab-tracker/detail?hn=${hn}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถโหลดผลตรวจ LAB ได้')
      }
      setModalData(data)
    } catch (err: any) {
      setModalError(err.message || 'เกิดข้อผิดพลาดในการโหลดผลตรวจ')
    } finally {
      setModalLoading(false)
    }
  }

  const handleCloseModal = useCallback(() => {
    setSelectedHn(null)
    setModalData(null)
    setModalError(null)
  }, [])

  // Prevent background scroll and register window escape key listener
  useEffect(() => {
    if (!selectedHn) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedHn, handleCloseModal])

  // Filter lists based on searchQuery
  const filteredPending = useMemo(() => {
    if (!reportData?.pending) return []
    const query = searchQuery.toLowerCase().trim()
    if (!query) return reportData.pending
    return reportData.pending.filter(
      (p) =>
        p.hn.toLowerCase().includes(query) ||
        p.patientName.toLowerCase().includes(query) ||
        (p.formName || '').toLowerCase().includes(query) ||
        (p.doctorName || '').toLowerCase().includes(query)
    )
  }, [reportData?.pending, searchQuery])

  const filteredReported = useMemo(() => {
    if (!reportData?.reported) return []
    const query = searchQuery.toLowerCase().trim()
    if (!query) return reportData.reported
    return reportData.reported.filter(
      (r) =>
        r.hn.toLowerCase().includes(query) ||
        r.patientName.toLowerCase().includes(query) ||
        (r.formName || '').toLowerCase().includes(query) ||
        (r.doctorName || '').toLowerCase().includes(query)
    )
  }, [reportData?.reported, searchQuery])

  // Calculated metrics for active doctor
  const totalDoctorOrders = useMemo(() => {
    return (reportData?.pending?.length || 0) + (reportData?.reported?.length || 0)
  }, [reportData])

  const completedRate = useMemo(() => {
    if (totalDoctorOrders === 0) return 0
    return Math.round(((reportData?.reported?.length || 0) / totalDoctorOrders) * 100)
  }, [totalDoctorOrders, reportData?.reported?.length])

  // Sum of counts for dashboard stats
  const totalDoctorsSum = useMemo(() => {
    return dashboardData?.doctors.reduce((sum, d) => sum + d.count, 0) || 0
  }, [dashboardData?.doctors])

  const totalOthersSum = useMemo(() => {
    return dashboardData?.others.reduce((sum, o) => sum + o.count, 0) || 0
  }, [dashboardData?.others])

  const isRefreshing = loading || reportLoading

  return (
    <div className="lab-tracker-page">
      <div className="lab-tracker-container">
        {/* Breadcrumb Navigation */}
        <div className="lab-tracker-breadcrumb-wrap">
          <Breadcrumb
            items={
              activeDoctor
                ? [
                    { label: 'งานบริการทางการแพทย์', href: '/service' },
                    { label: 'ติดตามผลแลป รพ.สต.', href: '#' },
                    { label: activeDoctor.name },
                  ]
                : [
                    { label: 'งานบริการทางการแพทย์', href: '/service' },
                    { label: 'ติดตามผลแลป รพ.สต.' },
                  ]
            }
          />
        </div>

        {/* Page Header & Live Status Ribbon */}
        <header className="lab-tracker-header">
          <div className="lab-tracker-title-group">
            <h1 className="lab-tracker-title">ระบบติดตามผลตรวจทางห้องปฏิบัติการ (LAB Tracker)</h1>
            <p className="lab-tracker-subtitle">
              ตรวจสอบสถานะการสั่งตรวจและการรายงานผลแลปประจำวัน เครือข่ายบริการสุขภาพโรงพยาบาลเถินและ รพ.สต.
            </p>
          </div>

          <div className="lab-tracker-sync-bar">
            <div className="sync-status-indicator">
              <span className="live-dot" aria-hidden="true" />
              <span className="sync-time">
                อัปเดตล่าสุด:{' '}
                <strong suppressHydrationWarning>
                  {lastRefreshed.toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}{' '}
                  น.
                </strong>
              </span>
              <span className="sync-interval">(รีเฟรชอัตโนมัติทุก 30 วินาที)</span>
            </div>

            <button
              onClick={() => (activeDoctor ? fetchDoctorReport(activeDoctor.code) : fetchDashboard())}
              className={`btn-sync-refresh ${isRefreshing ? 'is-spinning' : ''}`}
              title="รีเฟรชข้อมูลล่าสุด"
              aria-label="รีเฟรชข้อมูลล่าสุด"
              disabled={isRefreshing}
            >
              <RefreshCw size={15} className={`refresh-icon ${isRefreshing ? 'spin-anim' : ''}`} />
              <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรชทันที'}</span>
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div className="lab-tracker-error-banner" role="alert">
            <AlertCircle size={20} className="error-icon" />
            <div className="error-content">
              <strong>พบข้อผิดพลาดในการโหลดข้อมูล</strong>
              <p>{error}</p>
            </div>
            <button
              onClick={() => (activeDoctor ? fetchDoctorReport(activeDoctor.code) : fetchDashboard())}
              className="error-retry-btn"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {/* VIEW 1: Main Dashboard (Doctor & Staff Groups) */}
        {!activeDoctor && (
          <div className="tracker-dashboard-view">
            {/* Tiered Summary KPI Strip */}
            {dashboardData && (
              <section className="dashboard-summary-strip" aria-label="สรุปภาพรวมการส่งตรวจแลปวันนี้">
                <div
                  className="summary-stat-card card-interactive highlight"
                  onClick={() => handleSelectDoctor('all', 'สั่งตรวจทั้งหมดในวันนี้')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelectDoctor('all', 'สั่งตรวจทั้งหมดในวันนี้')
                    }
                  }}
                  title="คลิกเพื่อดูรายการสั่งตรวจแลปทั้งหมดในวันนี้"
                >
                  <div className="stat-card-icon-wrap bg-primary-light">
                    <FlaskConical size={22} className="text-primary" />
                  </div>
                  <div className="stat-card-info">
                    <span className="stat-label">ยอดผู้ป่วยสั่งตรวจทั้งหมดวันนี้</span>
                    <div className="stat-value-group">
                      <span className="stat-number tabular">{dashboardData.totalCount}</span>
                      <span className="stat-unit">ราย</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="stat-arrow-icon" />
                </div>

                <div className="summary-stat-card">
                  <div className="stat-card-icon-wrap bg-info-light">
                    <Stethoscope size={22} className="text-info" />
                  </div>
                  <div className="stat-card-info">
                    <span className="stat-label">แพทย์ผู้สั่งตรวจวันนี้</span>
                    <div className="stat-value-group">
                      <span className="stat-number tabular">{dashboardData.doctors.length}</span>
                      <span className="stat-unit">ท่าน</span>
                      <span className="stat-subtext">({totalDoctorsSum} ราย)</span>
                    </div>
                  </div>
                </div>

                <div className="summary-stat-card">
                  <div className="stat-card-icon-wrap bg-gold-light">
                    <Users size={22} className="text-gold" />
                  </div>
                  <div className="stat-card-info">
                    <span className="stat-label">พยาบาล / เจ้าหน้าที่ผู้สั่ง</span>
                    <div className="stat-value-group">
                      <span className="stat-number tabular">{dashboardData.others.length}</span>
                      <span className="stat-unit">ท่าน</span>
                      <span className="stat-subtext">({totalOthersSum} ราย)</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Loading state for Dashboard */}
            {loading && !dashboardData && (
              <div className="lab-tracker-loading-box">
                <div className="modern-spinner" />
                <p>กำลังเชื่อมต่อข้อมูลรายงานความคืบหน้า LAB วันนี้...</p>
              </div>
            )}

            {/* Doctors and Staff Two-Column Grid */}
            {dashboardData && (
              <div className="dashboard-groups-grid">
                {/* Doctor Group Card */}
                <div className="group-panel-card">
                  <div className="group-panel-header">
                    <div className="panel-title-wrap">
                      <Stethoscope size={18} className="panel-title-icon text-primary" />
                      <h2>กลุ่มแพทย์ผู้สั่งตรวจ</h2>
                    </div>
                    <span className="panel-badge-pill primary-pill">
                      มีใบสั่งแลป {dashboardData.doctors.length} ท่าน
                    </span>
                  </div>

                  <div className="group-panel-body">
                    {dashboardData.doctors.length > 0 ? (
                      <table className="modern-panel-table">
                        <thead>
                          <tr>
                            <th className="col-left">ชื่อผู้สั่งตรวจ</th>
                            <th className="col-center" style={{ width: '130px' }}>
                              ส่งตรวจ (คน)
                            </th>
                            <th className="col-center" style={{ width: '48px' }}>
                              เลือก
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.doctors.map((doc) => (
                            <tr
                              key={doc.code}
                              onClick={() => handleSelectDoctor(doc.code, doc.name)}
                              className="panel-clickable-row"
                              tabIndex={0}
                              role="button"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleSelectDoctor(doc.code, doc.name)
                                }
                              }}
                            >
                              <td className="col-left">
                                <span className="entity-name">{doc.name}</span>
                              </td>
                              <td className="col-center tabular">
                                <span className="entity-count-badge">{doc.count}</span>
                              </td>
                              <td className="col-center">
                                <ChevronRight size={16} className="row-action-icon" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="empty-panel-notice">
                        <Stethoscope size={28} className="empty-notice-icon" />
                        <p>ไม่มีประวัติการส่งตรวจแลปจากกลุ่มแพทย์ในวันนี้</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nurse & Staff Group Card */}
                <div className="group-panel-card">
                  <div className="group-panel-header">
                    <div className="panel-title-wrap">
                      <Users size={18} className="panel-title-icon text-gold" />
                      <h2>กลุ่มพยาบาลและเจ้าหน้าที่อื่นๆ</h2>
                    </div>
                    <span className="panel-badge-pill gold-pill">
                      มีใบสั่งแลป {dashboardData.others.length} ท่าน
                    </span>
                  </div>

                  <div className="group-panel-body">
                    {dashboardData.others.length > 0 ? (
                      <table className="modern-panel-table">
                        <thead>
                          <tr>
                            <th className="col-left">ชื่อผู้สั่งตรวจ</th>
                            <th className="col-center" style={{ width: '130px' }}>
                              ส่งตรวจ (คน)
                            </th>
                            <th className="col-center" style={{ width: '48px' }}>
                              เลือก
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.others.map((staff) => (
                            <tr
                              key={staff.code}
                              onClick={() => handleSelectDoctor(staff.code, staff.name)}
                              className="panel-clickable-row"
                              tabIndex={0}
                              role="button"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleSelectDoctor(staff.code, staff.name)
                                }
                              }}
                            >
                              <td className="col-left">
                                <span className="entity-name">{staff.name}</span>
                              </td>
                              <td className="col-center tabular">
                                <span className="entity-count-badge gold-count">{staff.count}</span>
                              </td>
                              <td className="col-center">
                                <ChevronRight size={16} className="row-action-icon" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="empty-panel-notice">
                        <Users size={28} className="empty-notice-icon" />
                        <p>ไม่มีประวัติการส่งตรวจแลปจากกลุ่มพยาบาล/เจ้าหน้าที่ในวันนี้</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Doctor/Staff Progress Report View */}
        {activeDoctor && (
          <div className="doctor-report-view">
            {/* Context Navigation & Practitioner Details Ribbon */}
            <div className="report-header-banner">
              <div className="report-header-left">
                <button onClick={handleBackToDashboard} className="btn-back-dashboard" aria-label="ย้อนกลับ">
                  <ArrowLeft size={16} />
                  <span>ย้อนกลับ</span>
                </button>

                <div className="doctor-profile-box">
                  <div className="doctor-profile-icon">
                    {activeDoctor.code === 'all' ? (
                      <Layers size={20} />
                    ) : (
                      <Stethoscope size={20} />
                    )}
                  </div>
                  <div>
                    <h2 className="doctor-profile-name">
                      ติดตามผล LAB:{' '}
                      <span className="name-highlight">{activeDoctor.name}</span>
                    </h2>
                    <p className="doctor-order-date">
                      ประจำวันที่สั่งตรวจ:{' '}
                      <strong>{formatThaiDate(new Date())}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Search input with integrated icons */}
              <div className="report-search-container">
                <div className="report-search-input-wrap">
                  <Search size={16} className="report-search-icon" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="ค้นหา (HN, ชื่อ-สกุล, ฟอร์มแลป, ผู้สั่ง)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="report-search-input"
                    aria-label="ค้นหารายการผู้ป่วย"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="report-search-clear-btn"
                      title="ล้างคำค้นหา"
                      aria-label="ล้างคำค้นหา"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Doctor Report Metrics KPI Strip */}
            {reportData && (
              <section className="report-metrics-strip" aria-label="สรุปสถานะการรายงานผล">
                <button
                  type="button"
                  className={`report-metric-card ${activeTab === 'all' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  <div className="metric-icon-wrap neutral">
                    <FileText size={18} />
                  </div>
                  <div className="metric-body">
                    <span className="metric-label">สั่งตรวจทั้งหมด</span>
                    <span className="metric-num tabular">{totalDoctorOrders}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`report-metric-card ${activeTab === 'pending' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('pending')}
                >
                  <div className="metric-icon-wrap warning">
                    <Clock size={18} />
                  </div>
                  <div className="metric-body">
                    <span className="metric-label">รอรายงานผลตรวจ</span>
                    <span className="metric-num tabular text-warning">{filteredPending.length}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`report-metric-card ${activeTab === 'reported' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('reported')}
                >
                  <div className="metric-icon-wrap success">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="metric-body">
                    <span className="metric-label">รายงานผลเสร็จสิ้น</span>
                    <span className="metric-num tabular text-success">{filteredReported.length}</span>
                  </div>
                </button>

                <div className="report-metric-card progress-card">
                  <div className="metric-body w-full">
                    <div className="metric-progress-header">
                      <span className="metric-label">ความคืบหน้ารวม</span>
                      <span className="metric-progress-pct tabular">{completedRate}%</span>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${completedRate}%` }}
                        aria-valuenow={completedRate}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        role="progressbar"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Loading state for report */}
            {reportLoading && !reportData && (
              <div className="lab-tracker-loading-box">
                <div className="modern-spinner" />
                <p>กำลังดึงข้อมูลความคืบหน้าการรายงานผลแลป...</p>
              </div>
            )}

            {/* Filter Tabs for Mobile / Segmented Control */}
            {reportData && (
              <div className="report-tabs-bar" role="tablist" aria-label="ตัวกรองตารางรายงาน">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'all'}
                  className={`report-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  แสดงทั้งหมด ({totalDoctorOrders})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'pending'}
                  className={`report-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pending')}
                >
                  รอรายงานผล ({reportData.pending.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'reported'}
                  className={`report-tab-btn ${activeTab === 'reported' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reported')}
                >
                  ออกผลแล้ว ({reportData.reported.length})
                </button>
              </div>
            )}

            {/* Tables Grid Layout */}
            {reportData && (
              <div
                className={`report-tables-grid ${
                  activeTab === 'pending' || activeTab === 'reported' ? 'single-table-mode' : ''
                }`}
              >
                {/* Table 1: Pending (รอรายงานผล) */}
                {(activeTab === 'all' || activeTab === 'pending') && (
                  <div className="progress-table-card pending-card">
                    <div className="modern-table-header pending-header">
                      <div className="table-header-title-group">
                        <Clock size={18} className="text-warning-dark" />
                        <h3>อยู่ระหว่างรอรายงานผลตรวจ</h3>
                      </div>
                      <span className="table-count-badge warning-count-badge">
                        {filteredPending.length} รายการ
                      </span>
                    </div>

                    <div className="table-content-area">
                      {filteredPending.length > 0 ? (
                        <div className="table-responsive-wrapper">
                          <table className="modern-progress-table">
                            <thead>
                              <tr>
                                <th className="col-center" style={{ width: '90px' }}>
                                  HN
                                </th>
                                <th className="col-left">ชื่อ - สกุล</th>
                                <th className="col-left">LAB Form</th>
                                <th className="col-center" style={{ width: '85px' }}>
                                  เวลาสั่ง
                                </th>
                                <th className="col-center" style={{ width: '90px' }}>
                                  รับออร์เดอร์
                                </th>
                                {activeDoctor.code === 'all' && (
                                  <th className="col-left" style={{ width: '130px' }}>
                                    ผู้สั่งตรวจ
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredPending.map((p, index) => (
                                <tr key={`pending-${p.hn}-${index}`}>
                                  <td className="col-center">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenLabDetail(p.hn)}
                                      className="hn-tactile-btn pending"
                                      title={`คลิกเพื่อดูรายละเอียดผลแลป HN ${p.hn}`}
                                    >
                                      {p.hn}
                                    </button>
                                  </td>
                                  <td className="col-left">
                                    <span className="patient-name-text">{p.patientName}</span>
                                  </td>
                                  <td className="col-left">
                                    <span className="lab-form-text">{p.formName || '-'}</span>
                                  </td>
                                  <td className="col-center tabular">
                                    <span className="time-badge">{p.orderTime || '-'}</span>
                                  </td>
                                  <td className="col-center tabular">
                                    <span className="time-badge">{p.receiveTime || '-'}</span>
                                  </td>
                                  {activeDoctor.code === 'all' && (
                                    <td className="col-left nowrap">
                                      <span className="doctor-tag">{p.doctorName || '-'}</span>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="table-empty-notice">
                          {searchQuery ? (
                            <>
                              <Search size={28} className="empty-notice-icon" />
                              <p>ไม่พบรายการที่ตรงกับคำค้นหา "{searchQuery}"</p>
                              <button onClick={() => setSearchQuery('')} className="btn-clear-empty-filter">
                                ล้างคำค้นหา
                              </button>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={28} className="empty-notice-icon text-success" />
                              <p>ไม่มีข้อมูลผู้ป่วยที่อยู่ระหว่างรอรายงานผลตรวจในเวลานี้</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Table 2: Completed / Reported (รายงานผลแลปเรียบร้อยแล้ว) */}
                {(activeTab === 'all' || activeTab === 'reported') && (
                  <div className="progress-table-card reported-card">
                    <div className="modern-table-header reported-header">
                      <div className="table-header-title-group">
                        <CheckCircle2 size={18} className="text-success-dark" />
                        <h3>รายงานผลแลปเรียบร้อยแล้ว</h3>
                      </div>
                      <span className="table-count-badge success-count-badge">
                        {filteredReported.length} รายการ
                      </span>
                    </div>

                    <div className="table-content-area">
                      {filteredReported.length > 0 ? (
                        <div className="table-responsive-wrapper">
                          <table className="modern-progress-table">
                            <thead>
                              <tr>
                                <th className="col-center" style={{ width: '90px' }}>
                                  HN
                                </th>
                                <th className="col-left">ชื่อ - สกุล</th>
                                <th className="col-center" style={{ width: '105px' }}>
                                  เวลารายงานผล
                                </th>
                                <th className="col-center" style={{ width: '95px' }}>
                                  สถานะ
                                </th>
                                {activeDoctor.code === 'all' && (
                                  <th className="col-left" style={{ width: '130px' }}>
                                    ผู้สั่งตรวจ
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredReported.map((r, index) => {
                                const isDischarged = r.ovstost === '99'
                                return (
                                  <tr
                                    key={`reported-${r.hn}-${index}`}
                                    className={isDischarged ? 'row-state-discharged' : ''}
                                  >
                                    <td className="col-center">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenLabDetail(r.hn)}
                                        className="hn-tactile-btn completed"
                                        title={`คลิกเพื่อดูรายละเอียดผลแลป HN ${r.hn}`}
                                      >
                                        {r.hn}
                                      </button>
                                    </td>
                                    <td className="col-left">
                                      <span className="patient-name-text">{r.patientName}</span>
                                    </td>
                                    <td className="col-center tabular">
                                      <span className="time-badge success">{r.reportTime || '-'}</span>
                                    </td>
                                    <td className="col-center">
                                      {isDischarged ? (
                                        <span className="status-pill discharged" title="จำหน่าย/จบกระบวนการแล้ว">
                                          ตรวจเสร็จสิ้น
                                        </span>
                                      ) : (
                                        <span className="status-pill reported">ออกผลแล้ว</span>
                                      )}
                                    </td>
                                    {activeDoctor.code === 'all' && (
                                      <td className="col-left nowrap">
                                        <span className="doctor-tag">{r.doctorName || '-'}</span>
                                      </td>
                                    )}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="table-empty-notice">
                          {searchQuery ? (
                            <>
                              <Search size={28} className="empty-notice-icon" />
                              <p>ไม่พบรายการที่ตรงกับคำค้นหา "{searchQuery}"</p>
                              <button onClick={() => setSearchQuery('')} className="btn-clear-empty-filter">
                                ล้างคำค้นหา
                              </button>
                            </>
                          ) : (
                            <>
                              <Clock size={28} className="empty-notice-icon" />
                              <p>ไม่มีข้อมูลผู้ป่วยที่ตรวจวิเคราะห์และรายงานผลเสร็จสิ้นในวันนี้</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Clinical Lab Detail Drill-down */}
      {selectedHn && (
        <div
          className="modal-backdrop-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal()
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="lab-detail-modal-title"
        >
          <div className="lab-detail-modal-card">
            {/* Modal Header */}
            <header className="lab-detail-modal-header">
              <div className="modal-header-titles">
                <div className="modal-header-icon-wrap">
                  <FlaskConical size={20} className="text-primary" />
                </div>
                <h2 id="lab-detail-modal-title">รายงานผลการตรวจทางห้องปฏิบัติการ (LAB)</h2>
              </div>
              <button
                type="button"
                className="modal-icon-close-btn"
                onClick={handleCloseModal}
                title="ปิดหน้าต่าง (Escape)"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </header>

            {/* Patient Metadata Ribbon */}
            {modalData && (
              <div className="modal-patient-strip">
                <div className="patient-meta-item">
                  <User size={16} className="meta-icon" />
                  <span className="meta-label">ชื่อผู้ป่วย:</span>
                  <strong className="meta-value">{modalData.patientName}</strong>
                </div>
                <div className="patient-meta-divider" aria-hidden="true">
                  |
                </div>
                <div className="patient-meta-item">
                  <span className="meta-label">HN:</span>
                  <strong className="meta-value tabular font-mono">{modalData.hn}</strong>
                </div>
                <div className="patient-meta-divider" aria-hidden="true">
                  |
                </div>
                <div className="patient-meta-item">
                  <span className="meta-label">วันที่ตรวจ:</span>
                  <span className="meta-value">{formatThaiDate(new Date())}</span>
                </div>
              </div>
            )}

            {/* Modal Scrollable Body */}
            <div className="lab-detail-modal-body">
              {modalLoading && (
                <div className="modal-loading-state">
                  <div className="modern-spinner" />
                  <p>กำลังดึงผลแลปวันนี้...</p>
                </div>
              )}

              {modalError && (
                <div className="modal-error-box" role="alert">
                  <AlertCircle size={20} className="error-icon" />
                  <div>
                    <strong>เกิดข้อผิดพลาดในการโหลดผลแลป</strong>
                    <p>{modalError}</p>
                  </div>
                </div>
              )}

              {modalData && (
                <div className="modal-results-container">
                  {/* Section 1: Reported LABs Table */}
                  {modalData.reported.length > 0 && (
                    <section className="detail-table-section">
                      <div className="detail-section-header reported">
                        <CheckCircle2 size={16} className="text-success" />
                        <h3>รายการผล LAB ที่ออกรายงานแล้ว ({modalData.reported.length} รายการ)</h3>
                      </div>
                      <div className="modal-table-wrapper">
                        <table className="modal-data-table">
                          <thead>
                            <tr>
                              <th className="col-left" style={{ width: '22%' }}>
                                LAB Form
                              </th>
                              <th className="col-left" style={{ width: '38%' }}>
                                รายการตรวจ
                              </th>
                              <th className="col-center" style={{ width: '20%' }}>
                                ผล LAB
                              </th>
                              <th className="col-center" style={{ width: '20%' }}>
                                ค่าอ้างอิงปกติ
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.reported.map((r, index) => (
                              <tr key={`rep-${r.formName}-${r.itemName}-${index}`}>
                                <td className="col-left">
                                  <span className="form-name-badge">{r.formName}</span>
                                </td>
                                <td className="col-left font-medium">
                                  {r.itemName}
                                </td>
                                <td className="col-center tabular">
                                  <span className="lab-result-highlight">{r.result}</span>
                                </td>
                                <td className="col-center tabular text-muted">
                                  {r.refValue || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {/* Section 2: Pending LABs Table */}
                  {modalData.pending.length > 0 && (
                    <section className="detail-table-section">
                      <div className="detail-section-header pending">
                        <Clock size={16} className="text-warning-dark" />
                        <h3>รายการ LAB ที่อยู่ระหว่างตรวจวิเคราะห์ ({modalData.pending.length} รายการ)</h3>
                      </div>
                      <div className="modal-table-wrapper">
                        <table className="modal-data-table">
                          <thead>
                            <tr>
                              <th className="col-left" style={{ width: '28%' }}>
                                LAB Form
                              </th>
                              <th className="col-left" style={{ width: '44%' }}>
                                รายการตรวจ
                              </th>
                              <th className="col-center" style={{ width: '28%' }}>
                                สถานะการส่งตรวจ
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.pending.map((p, index) => (
                              <tr key={`pen-${p.formName}-${p.itemName}-${index}`}>
                                <td className="col-left">
                                  <span className="form-name-badge">{p.formName}</span>
                                </td>
                                <td className="col-left font-medium">
                                  {p.itemName}
                                </td>
                                <td className="col-center nowrap">
                                  {p.isOutLab === 'Y' ? (
                                    <span className="analysis-tag outlab">
                                      ส่งตรวจแลปภายนอก (Outlab)
                                    </span>
                                  ) : (
                                    <span className="analysis-tag inhouse">
                                      ตรวจวิเคราะห์ภายใน รพ.
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {modalData.reported.length === 0 && modalData.pending.length === 0 && (
                    <div className="modal-empty-notice">
                      <FileText size={32} className="empty-icon" />
                      <p>ไม่พบรายการสั่งตรวจแลปในวันนี้ของผู้ป่วยรายนี้</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Sticky Footer */}
            <footer className="lab-detail-modal-footer">
              <button
                type="button"
                className="btn-modal-close"
                onClick={handleCloseModal}
              >
                ปิดหน้าต่าง
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
