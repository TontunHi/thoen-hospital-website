'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  RefreshCw, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  AlertCircle, 
  ArrowLeft, 
  Download, 
  Copy, 
  Check, 
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { parseUserAgent } from '@/lib/userAgentParser'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import { getInitials as formatInitials } from '@/lib/formatters'

interface AuditLog {
  id: number
  timestamp: string
  username: string | null
  email: string | null
  action_type: string
  target_table: string | null
  action_details: string | null
  ip_address: string | null
  user_agent: string | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface AuditStats {
  totalLogs: number
  sizeMb: number
  oldestLog: string | null
  newestLog: string | null
  retainedDays: number
  policyRetentionDays: number
  loginsToday: number
  readsToday: number
  changesToday: number
}

function getInitials(name: string): string {
  return formatInitials(name, true)
}

export default function AuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [search, setSearch] = useState('')
  const [actionType, setActionType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeDatePreset, setActiveDatePreset] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  })

  // Selected Log for details modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // PDPA Cleanup Modal State
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupChecking, setCleanupChecking] = useState(false)
  const [expiredCount, setExpiredCount] = useState<number | null>(null)

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const copyToClipboard = async (text: string, fieldName: string, successMsg?: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      addToast(successMsg || `คัดลอก ${fieldName} เรียบร้อยแล้ว`, 'success')
      setTimeout(() => {
        setCopiedField((prev) => (prev === fieldName ? null : prev))
      }, 2000)
    } catch {
      addToast('ไม่สามารถคัดลอกข้อความได้', 'error')
    }
  }

  const fetchStats = async () => {
    try {
      setStatsLoading(true)
      const res = await fetch('/api/admin/audit-logs/stats')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.stats) {
          setStats(data.stats)
        }
      }
    } catch (err) {
      console.error('Fetch audit stats error:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchLogs = useCallback(async (
    targetPage = page,
    customFilters?: { search?: string; actionType?: string; startDate?: string; endDate?: string }
  ) => {
    try {
      setLoading(true)
      setError(null)

      const s = customFilters?.search !== undefined ? customFilters.search : search
      const a = customFilters?.actionType !== undefined ? customFilters.actionType : actionType
      const sd = customFilters?.startDate !== undefined ? customFilters.startDate : startDate
      const ed = customFilters?.endDate !== undefined ? customFilters.endDate : endDate

      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: '25'
      })

      if (s) params.append('search', s)
      if (a) params.append('actionType', a)
      if (sd) params.append('startDate', sd)
      if (ed) params.append('endDate', ed)

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถโหลดประวัติการใช้งานได้')
      }

      setLogs(data.logs || [])
      setPagination(data.pagination || {
        page: targetPage,
        limit: 25,
        total: 0,
        totalPages: 1
      })
    } catch (err: any) {
      console.error('Fetch logs error:', err)
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [page, search, actionType, startDate, endDate])

  const handleExportCsv = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (actionType) params.append('actionType', actionType)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`/api/admin/audit-logs/export?${params.toString()}`)
      if (!res.ok) {
        throw new Error('การดาวน์โหลดรายงานล้มเหลว')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      addToast('ส่งออกไฟล์รายงาน CSV สำเร็จแล้ว', 'success')
    } catch (err) {
      console.error('Export error:', err)
      addToast('ไม่สามารถส่งออกไฟล์รายงานได้ กรุณาลองใหม่อีกครั้ง', 'error')
    } finally {
      setExporting(false)
    }
  }

  // Open Cleanup Confirmation Modal & Check Expired Count
  const handleOpenCleanupModal = async () => {
    setCleanupModalOpen(true)
    setCleanupChecking(true)
    try {
      const res = await fetch('/api/admin/audit-logs/cleanup?days=90')
      const data = await res.json()
      if (data.success) {
        setExpiredCount(data.expiredCount)
      } else {
        setExpiredCount(0)
      }
    } catch {
      setExpiredCount(0)
    } finally {
      setCleanupChecking(false)
    }
  }

  const handleExecuteCleanup = async () => {
    try {
      setCleanupLoading(true)
      const res = await fetch('/api/admin/audit-logs/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionDays: 90 })
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'การล้างข้อมูลประวัติล้มเหลว')
      }

      addToast(data.message || 'ล้างประวัติเก่าเกิน 90 วันสำเร็จแล้ว', 'success')
      setCleanupModalOpen(false)
      fetchStats()
      fetchLogs(1)
    } catch (err: any) {
      console.error('Execute cleanup error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการล้างประวัติ', 'error')
    } finally {
      setCleanupLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(page)
  }, [page, actionType, fetchLogs])

  useEffect(() => {
    fetchStats()
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchLogs(1)
  }

  const handleDatePresetChange = (preset: 'all' | 'today' | '7days' | '30days') => {
    setActiveDatePreset(preset)
    const now = new Date()
    let s = ''
    let e = ''

    if (preset === 'today') {
      const todayStr = now.toISOString().slice(0, 10)
      s = todayStr
      e = todayStr
    } else if (preset === '7days') {
      const past = new Date()
      past.setDate(now.getDate() - 7)
      s = past.toISOString().slice(0, 10)
      e = now.toISOString().slice(0, 10)
    } else if (preset === '30days') {
      const past = new Date()
      past.setDate(now.getDate() - 30)
      s = past.toISOString().slice(0, 10)
      e = now.toISOString().slice(0, 10)
    }

    setStartDate(s)
    setEndDate(e)
    setPage(1)
    fetchLogs(1, { startDate: s, endDate: e })
  }

  const handleResetFilters = () => {
    setSearch('')
    setActionType('')
    setStartDate('')
    setEndDate('')
    setActiveDatePreset('all')
    setPage(1)
    fetchLogs(1, { search: '', actionType: '', startDate: '', endDate: '' })
  }

  const handleRefreshAll = () => {
    fetchStats()
    fetchLogs(page)
    addToast('อัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว', 'info')
  }

  // 1 color = 1 meaning, NO decorative icons inside badges
  const getActionBadge = (type: string) => {
    const t = type.toUpperCase()
    switch (t) {
      case 'LOGIN':
        return <span className="logBadge badgeLogin">LOGIN</span>
      case 'CREATE':
        return <span className="logBadge badgeCreate">CREATE</span>
      case 'READ':
        return <span className="logBadge badgeRead">READ</span>
      case 'REQUEST':
        return <span className="logBadge badgeRequest">REQUEST</span>
      case 'UPDATE':
        return <span className="logBadge badgeUpdate">UPDATE</span>
      case 'DELETE':
        return <span className="logBadge badgeDelete">DELETE</span>
      case 'LOGOUT':
        return <span className="logBadge badgeLogout">LOGOUT</span>
      case 'SYSTEM':
        return <span className="logBadge badgeSystem">SYSTEM</span>
      default:
        return <span className="logBadge badgeDefault">{type}</span>
    }
  }

  const getTargetTableName = (table: string | null) => {
    if (!table) return '-'
    switch (table.toLowerCase()) {
      case 'members': return 'ข้อมูลบุคลากร (members)'
      case 'pr_requests': return 'คำขอผลิตสื่อ PR (pr_requests)'
      case 'approval_tickets': return 'งานรออนุมัติ (approval_tickets)'
      case 'work_requests': return 'ใบงานช่าง (work_requests)'
      case 'ita_blogs': return 'บทความ ITA (ita_blogs)'
      case 'member_system_settings': return 'ตั้งค่าระบบ (settings)'
      case 'position_permissions': return 'ตั้งค่าสิทธิ์ (permissions)'
      case 'salary_slips': return 'สลิปเงินเดือน (salary_slips)'
      case 'inbox_tasks': return 'งานในกล่องข้อความ (inbox_tasks)'
      case 'audit_logs': return 'บันทึกความปลอดภัย (audit_logs)'
      default: return table
    }
  }

  const getDeviceBadge = (uaString: string | null) => {
    const parsed = parseUserAgent(uaString)
    const deviceName = parsed.deviceModel || parsed.os
    const tooltipText = `${parsed.os} • ${parsed.browser}\n${uaString || 'ไม่ระบุ User-Agent'}`

    return (
      <div className={`deviceBadge deviceBadge-${parsed.deviceType}`} title={tooltipText}>
        <span className="deviceTextTruncate">
          <span className="deviceName">{deviceName}</span>
          <span className="deviceSeparator">•</span>
          <span className="browserName">{parsed.browser}</span>
        </span>
      </div>
    )
  }

  const parseAuditDate = (dateStr: string): Date => {
    if (!dateStr) return new Date()
    let clean = dateStr.trim()
    if (clean.endsWith('Z')) {
      clean = clean.replace(/Z$/, '+07:00')
    } else if (!clean.includes('+') && !clean.includes('Z')) {
      clean = clean.replace(' ', 'T') + '+07:00'
    }
    return new Date(clean)
  }

  // Thai Buddhist Year (พ.ศ.) format: e.g. "04 พ.ย. 2569 22:20:00"
  const formatDate = (dateStr: string) => {
    try {
      const date = parseAuditDate(dateStr)
      const d = date.getDate().toString().padStart(2, '0')
      const mNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
      const m = mNames[date.getMonth()]
      let y = date.getFullYear()
      if (y < 2400) y += 543
      const hh = date.getHours().toString().padStart(2, '0')
      const mm = date.getMinutes().toString().padStart(2, '0')
      const ss = date.getSeconds().toString().padStart(2, '0')
      return `${d} ${m} ${y} ${hh}:${mm}:${ss}`
    } catch {
      return dateStr
    }
  }

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = parseAuditDate(dateStr)
      const now = new Date()
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

      if (diffSec < 60) return 'เมื่อสักครู่'
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีที่แล้ว`
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชม. ที่แล้ว`
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} วันที่แล้ว`
      return ''
    } catch {
      return ''
    }
  }

  const isLocalIp = (ip: string | null) => {
    if (!ip) return false
    return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')
  }

  const hasActiveFilters = Boolean(search || actionType || startDate || endDate)

  return (
    <>
      {/* Header Bar */}
      <header className="auditHeader">
        <div className="auditHeaderTop">
          <Link href="/member" className="backBtn">
            <ArrowLeft size={16} />
            <span>กลับไปศูนย์ควบคุมสมาชิก</span>
          </Link>
          
          <div className="headerStatusBadges">
            <div className="livePulseBadge" title="ระบบบันทึก Audit Logs ทำงานตลอด 24 ชั่วโมง">
              <span className="pulseDot" aria-hidden="true"></span>
              <span className="pulseText">บันทึกเรียลไทม์ Tier-1 Audit</span>
            </div>

            <button 
              type="button" 
              className="btnCleanUpTrigger" 
              onClick={handleOpenCleanupModal}
              title="ล้างประวัติการใช้งานที่เก่ากว่า 90 วันตามเกณฑ์ PDPA"
            >
              <Trash2 size={14} />
              <span>ล้างประวัติเก่าเกิน 90 วัน</span>
            </button>

            <button 
              type="button" 
              className="refreshHeaderBtn" 
              onClick={handleRefreshAll}
              disabled={loading || statsLoading}
              title="รีเฟรชข้อมูลทั้งหมด"
            >
              <RefreshCw size={14} className={loading || statsLoading ? 'animate-spin' : ''} />
              <span>อัปเดตข้อมูล</span>
            </button>
          </div>
        </div>

        <div className="titleWrapper">
          <div className="titleText">
            <div className="titleRow">
              <h1>ระบบประวัติความปลอดภัยและ Audit Logs</h1>
              <span className="complianceBadge">PDPA & Hospital Security Standard</span>
            </div>
            <p className="subtitle">
              ตรวจสอบและบันทึกประวัติการเข้าใช้งาน การสืบค้นข้อมูลสำคัญ (PHI/Salary) การเปลี่ยนแปลงสิทธิ์ และการดำเนินงาน CRUD ทั้งหมดของโรงพยาบาลเถิน
            </p>
          </div>
        </div>
      </header>

      {/* Stats Dashboard Cards - Clean, No Decorative Icons, Tabular Numbers */}
      <section className="auditStatsGrid" aria-label="สถิติความปลอดภัย">
        <div className="statCard statCardTotal">
          <div className="statCardHeader">
            <span className="statLabel">บันทึกทั้งหมด (Total Logs)</span>
            <span className="statBadge">ระบบทั้งหมด</span>
          </div>
          <div className="statInfo">
            <span className="statValue tabular-nums">
              {statsLoading ? <span className="statSkeleton"></span> : (stats?.totalLogs ?? 0).toLocaleString()}
            </span>
            <span className="statSubtext tabular-nums">
              ขนาดข้อมูลสะสม ~{stats?.sizeMb ?? 0} MB
            </span>
          </div>
        </div>

        <div className="statCard statCardLogin">
          <div className="statCardHeader">
            <span className="statLabel">เข้าสู่ระบบวันนี้ (Logins Today)</span>
            <span className="statBadge statBadgeSuccess">วันนี้</span>
          </div>
          <div className="statInfo">
            <span className="statValue tabular-nums">
              {statsLoading ? <span className="statSkeleton"></span> : `${(stats?.loginsToday ?? 0).toLocaleString()} ครั้ง`}
            </span>
            <span className="statSubtext">
              ตรวจสอบกิจกรรมการยืนยันตัวตน
            </span>
          </div>
        </div>

        <div className="statCard statCardRead">
          <div className="statCardHeader">
            <span className="statLabel">เข้าดูข้อมูลสำคัญ (Reads Today)</span>
            <span className="statBadge statBadgeInfo">Sensitive Access</span>
          </div>
          <div className="statInfo">
            <span className="statValue tabular-nums">
              {statsLoading ? <span className="statSkeleton"></span> : `${(stats?.readsToday ?? 0).toLocaleString()} ครั้ง`}
            </span>
            <span className="statSubtext">
              เข้าถึงข้อมูลเงินเดือนและเวชระเบียน
            </span>
          </div>
        </div>

        <div className="statCard statCardRetention">
          <div className="statCardHeader">
            <span className="statLabel">อายุจัดเก็บข้อมูล (Retention)</span>
            <span className="statBadge statBadgeWarning">เกณฑ์ 90 วัน</span>
          </div>
          <div className="statInfo">
            <span className="statValue tabular-nums">
              {statsLoading ? <span className="statSkeleton"></span> : `${stats?.retainedDays ?? 0} วัน`}
            </span>
            <span className="statSubtext">
              จัดเก็บตามเกณฑ์ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล
            </span>
          </div>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section className="filterCard" aria-label="ตัวกรองและค้นหา">
        <form onSubmit={handleSearchSubmit} className="filterForm">
          {/* Action Types Filter Chips */}
          <div className="actionChipsRow">
            <span className="chipsLabel">
              ประเภทกิจกรรม:
            </span>
            <div className="chipsList" role="tablist" aria-label="กรองประเภทกิจกรรม">
              {[
                { id: '', label: 'ทั้งหมด (All)' },
                { id: 'LOGIN', label: 'LOGIN (เข้าสู่ระบบ)' },
                { id: 'LOGOUT', label: 'LOGOUT (ออกจากระบบ)' },
                { id: 'READ', label: 'READ (ดูข้อมูลสำคัญ)' },
                { id: 'CREATE', label: 'CREATE (เพิ่มข้อมูล)' },
                { id: 'UPDATE', label: 'UPDATE (แก้ไข)' },
                { id: 'DELETE', label: 'DELETE (ลบ)' },
                { id: 'REQUEST', label: 'REQUEST (API)' },
                { id: 'SYSTEM', label: 'SYSTEM (ตั้งค่า)' }
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={actionType === chip.id}
                  className={`actionChip ${actionType === chip.id ? 'active' : ''}`}
                  onClick={() => {
                    setActionType(chip.id)
                    setPage(1)
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filterGrid">
            {/* Search Input */}
            <div className="filterField flex-2">
              <label htmlFor="audit-search">คำค้นหา (Keyword)</label>
              <div className="inputWrapper">
                <Search size={18} className="searchIcon" />
                <input
                  id="audit-search"
                  type="text"
                  placeholder="ค้นหาชื่อผู้ใช้, อีเมล, หมายเลข IP, ชื่อตาราง หรือรายละเอียด..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button 
                    type="button" 
                    className="clearInputBtn" 
                    onClick={() => {
                      setSearch('')
                      setPage(1)
                      fetchLogs(1, { search: '' })
                    }}
                    title="ล้างคำค้นหา"
                    aria-label="ล้างคำค้นหา"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Date Range Presets */}
            <div className="filterField">
              <label>ช่วงวันด่วน</label>
              <div className="datePresetsRow" role="group" aria-label="เลือกช่วงวันด่วน">
                <button
                  type="button"
                  className={`presetBtn ${activeDatePreset === 'all' ? 'active' : ''}`}
                  onClick={() => handleDatePresetChange('all')}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  className={`presetBtn ${activeDatePreset === 'today' ? 'active' : ''}`}
                  onClick={() => handleDatePresetChange('today')}
                >
                  วันนี้
                </button>
                <button
                  type="button"
                  className={`presetBtn ${activeDatePreset === '7days' ? 'active' : ''}`}
                  onClick={() => handleDatePresetChange('7days')}
                >
                  7 วัน
                </button>
                <button
                  type="button"
                  className={`presetBtn ${activeDatePreset === '30days' ? 'active' : ''}`}
                  onClick={() => handleDatePresetChange('30days')}
                >
                  30 วัน
                </button>
              </div>
            </div>

            {/* Start Date */}
            <div className="filterField">
              <label htmlFor="start-date">จากวันที่</label>
              <div className="inputWrapper">
                <Calendar size={18} className="dateIcon" />
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setActiveDatePreset('custom')
                  }}
                />
              </div>
            </div>

            {/* End Date */}
            <div className="filterField">
              <label htmlFor="end-date">ถึงวันที่</label>
              <div className="inputWrapper">
                <Calendar size={18} className="dateIcon" />
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setActiveDatePreset('custom')
                  }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons & Filter Summary */}
          <div className="filterActions">
            <div className="filterActiveStatus">
              {hasActiveFilters ? (
                <div className="activeFilterTags">
                  <span className="activeFilterNote">
                    ตัวกรองที่ใช้งาน:
                  </span>
                  {search && (
                    <span className="filterTag">
                      คำค้นหา: &ldquo;{search}&rdquo;
                      <button type="button" onClick={() => { setSearch(''); fetchLogs(1, { search: '' }) }} aria-label="ลบตัวกรองคำค้นหา"><X size={12} /></button>
                    </span>
                  )}
                  {actionType && (
                    <span className="filterTag">
                      ประเภท: {actionType}
                      <button type="button" onClick={() => { setActionType(''); fetchLogs(1, { actionType: '' }) }} aria-label="ลบตัวกรองประเภท"><X size={12} /></button>
                    </span>
                  )}
                  {(startDate || endDate) && (
                    <span className="filterTag">
                      วันที่: {startDate || '...'} ถึง {endDate || '...'}
                      <button type="button" onClick={() => { setStartDate(''); setEndDate(''); setActiveDatePreset('all'); fetchLogs(1, { startDate: '', endDate: '' }) }} aria-label="ลบตัวกรองวันที่"><X size={12} /></button>
                    </span>
                  )}
                </div>
              ) : (
                <span className="inactiveFilterNote">แสดงข้อมูลประวัติการใช้งานทั้งหมดตามลำดับล่าสุด</span>
              )}
            </div>

            <div className="filterButtonCluster">
              {hasActiveFilters && (
                <button type="button" className="btnSecondary" onClick={handleResetFilters} disabled={loading}>
                  <RefreshCw size={15} />
                  <span>ล้างตัวกรองทั้งหมด</span>
                </button>
              )}
              
              <button type="submit" className="btnPrimary" disabled={loading}>
                <Search size={16} />
                <span>ค้นหารายการ</span>
              </button>

              <button 
                type="button" 
                className="btnExport" 
                onClick={handleExportCsv} 
                disabled={loading || exporting}
                title="ส่งออกรายการที่กรองเป็นไฟล์ CSV (รองรับ Excel UTF-8 BOM)"
              >
                {exporting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                <span>{exporting ? 'กำลังส่งออก...' : 'ส่งออกรายงาน CSV'}</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Main Logs Table View */}
      <section className="logsContainer" aria-label="ตารางประวัติการใช้งาน">
        <div className="tableControlBar">
          <div className="tableTitle">
            <h3>รายการประวัติความปลอดภัย ({pagination.total.toLocaleString()} รายการ)</h3>
            <span className="tableSubtitle">แสดงผลหน้าละ 25 รายการ • จัดเก็บตามเกณฑ์มาตรฐาน PDPA ขั้นต่ำ 90 วัน</span>
          </div>
        </div>

        {loading ? (
          <div className="skeletonTableWrapper">
            <div className="skeletonHeader"></div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeletonRow">
                <div className="skeletonCell skeletonTime"></div>
                <div className="skeletonCell skeletonUser"></div>
                <div className="skeletonCell skeletonBadge"></div>
                <div className="skeletonCell skeletonTarget"></div>
                <div className="skeletonCell skeletonIp"></div>
                <div className="skeletonCell skeletonDevice"></div>
                <div className="skeletonCell skeletonBtn"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="errorState" role="alert">
            <div className="stateIconWrapper stateIconError">
              <AlertCircle size={32} />
            </div>
            <h4>เกิดข้อผิดพลาดในการโหลดข้อมูล</h4>
            <p>{error}</p>
            <button onClick={() => fetchLogs()} className="btnRetry" type="button">
              <RefreshCw size={16} />
              <span>ลองใหม่อีกครั้ง</span>
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="emptyState">
            <h4>ไม่พบบันทึกประวัติการใช้งาน</h4>
            <p>ไม่มีรายการที่ตรงกับเงื่อนไขการค้นหา หรือยังไม่มีกิจกรรมในช่วงเวลาที่เลือก</p>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} className="btnSecondary" type="button">
                <RefreshCw size={15} />
                <span>ล้างตัวกรองเพื่อดูทั้งหมด</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="desktopTableContainer">
              <div className="tableWrapper">
                <table className="logsTable">
                  <thead>
                    <tr>
                      <th scope="col" className="col-time">วัน-เวลา (Timestamp)</th>
                      <th scope="col" className="col-user">ผู้ใช้งาน (Account)</th>
                      <th scope="col" className="col-action">ประเภท (Action)</th>
                      <th scope="col" className="col-target">เป้าหมาย (Target)</th>
                      <th scope="col" className="col-ip">IP Address</th>
                      <th scope="col" className="col-device">อุปกรณ์ / เบราว์เซอร์</th>
                      <th scope="col" className="col-actions">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const relative = formatRelativeTime(log.timestamp)
                      const isLocal = isLocalIp(log.ip_address)

                      return (
                        <tr key={log.id} className="logRow">
                          <td className="timeCell">
                            <div className="timeCellWrapper">
                              <span className="timePrimary tabular-nums">{formatDate(log.timestamp)}</span>
                              {relative && <span className="timeRelative">{relative}</span>}
                            </div>
                          </td>

                          <td className="userCell">
                            {log.username ? (
                              <div className="userDetails">
                                <div className="userAvatarCircle" aria-hidden="true">
                                  <span>{getInitials(log.username)}</span>
                                </div>
                                <div className="userTextWrapper">
                                  <span className="usernameText" title={log.username}>{log.username}</span>
                                  {log.email && <span className="emailText" title={log.email}>{log.email}</span>}
                                </div>
                              </div>
                            ) : (
                              <div className="guestUserDetails">
                                <span className="guestText">Guest / System</span>
                              </div>
                            )}
                          </td>

                          <td className="badgeCell">
                            {getActionBadge(log.action_type)}
                          </td>

                          <td className="targetCell">
                            <span className="targetBadge" title={log.target_table || ''}>
                              {getTargetTableName(log.target_table)}
                            </span>
                          </td>

                          <td className="ipCell">
                            {log.ip_address ? (
                              <div className="ipBadgeWrapper">
                                <span className="ipText tabular-nums">{log.ip_address}</span>
                                {isLocal && <span className="lanBadge">LAN</span>}
                                <button
                                  type="button"
                                  className="copyIpBtn"
                                  onClick={() => copyToClipboard(log.ip_address!, `IP Address ${log.ip_address}`)}
                                  title="คัดลอก IP Address"
                                  aria-label="คัดลอก IP Address"
                                >
                                  {copiedField === `IP Address ${log.ip_address}` ? (
                                    <Check size={12} className="copySuccessIcon" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="emptyText">-</span>
                            )}
                          </td>

                          <td className="deviceCell">
                            {getDeviceBadge(log.user_agent)}
                          </td>

                          <td className="actionCell">
                            <button 
                              type="button"
                              className="viewDetailBtn"
                              onClick={() => setSelectedLog(log)}
                              title="ดูข้อมูลเจาะลึกความปลอดภัย"
                              aria-label={`ดูบันทึก #${log.id}`}
                            >
                              <span>ดูบันทึก</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile / Tablet Responsive Cards View */}
            <div className="mobileCardsContainer">
              {logs.map((log) => {
                const relative = formatRelativeTime(log.timestamp)
                const isLocal = isLocalIp(log.ip_address)

                return (
                  <div key={log.id} className="mobileLogCard">
                    <div className="mobileLogCardTop">
                      <div className="mobileActionWrap">
                        {getActionBadge(log.action_type)}
                        <span className="mobileLogId tabular-nums">#{log.id}</span>
                      </div>
                      <div className="mobileTimeWrap">
                        <span className="mobileTimePrimary tabular-nums">{formatDate(log.timestamp)}</span>
                        {relative && <span className="mobileTimeRelative">{relative}</span>}
                      </div>
                    </div>

                    <div className="mobileLogCardBody">
                      <div className="mobileUserRow">
                        {log.username ? (
                          <div className="userDetails">
                            <div className="userAvatarCircle" aria-hidden="true">
                              <span>{getInitials(log.username)}</span>
                            </div>
                            <div className="userTextWrapper">
                              <span className="usernameText">{log.username}</span>
                              {log.email && <span className="emailText">{log.email}</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="guestUserDetails">
                            <span className="guestText">Guest / System</span>
                          </div>
                        )}
                      </div>

                      <div className="mobileMetaGrid">
                        <div className="mobileMetaItem">
                          <span className="mobileMetaLabel">เป้าหมาย:</span>
                          <span className="targetBadge mobileTarget">{getTargetTableName(log.target_table)}</span>
                        </div>
                        <div className="mobileMetaItem">
                          <span className="mobileMetaLabel">IP:</span>
                          <span className="ipBadgeWrapper">
                            <span className="ipText tabular-nums">{log.ip_address || '-'}</span>
                            {isLocal && <span className="lanBadge">LAN</span>}
                            {log.ip_address && (
                              <button
                                type="button"
                                className="copyIpBtn"
                                onClick={() => copyToClipboard(log.ip_address!, `IP Address ${log.ip_address}`)}
                                title="คัดลอก IP"
                              >
                                {copiedField === `IP Address ${log.ip_address}` ? (
                                  <Check size={12} className="copySuccessIcon" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            )}
                          </span>
                        </div>
                        <div className="mobileMetaItem fullWidth">
                          <span className="mobileMetaLabel">อุปกรณ์:</span>
                          {getDeviceBadge(log.user_agent)}
                        </div>
                      </div>
                    </div>

                    <div className="mobileLogCardFooter">
                      <button
                        type="button"
                        className="mobileViewDetailBtn"
                        onClick={() => setSelectedLog(log)}
                      >
                        <span>ดูบันทึกเจาะลึก</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
            <div className="pagination">
              <div className="paginationInfo tabular-nums">
                แสดงผล <span>{logs.length}</span> จากทั้งหมด <span>{pagination.total.toLocaleString()}</span> รายการ
              </div>
              
              <div className="paginationBtns">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(1)}
                  className="pageBtn pageBtnSquare"
                  title="หน้าแรก"
                  type="button"
                  aria-label="หน้าแรก"
                >
                  «
                </button>
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="pageBtn"
                  type="button"
                >
                  <ChevronLeft size={16} />
                  <span>ก่อนหน้า</span>
                </button>
                
                <div className="pageIndicator tabular-nums">
                  หน้า <strong>{page}</strong> จาก <strong>{pagination.totalPages || 1}</strong>
                </div>

                <button
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  className="pageBtn"
                  type="button"
                >
                  <span>ถัดไป</span>
                  <ChevronRight size={16} />
                </button>
                <button
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage(pagination.totalPages)}
                  className="pageBtn pageBtnSquare"
                  title="หน้าสุดท้าย"
                  type="button"
                  aria-label="หน้าสุดท้าย"
                >
                  »
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Details Modal */}
      {selectedLog && (
        <div className="modalOverlay" onClick={() => setSelectedLog(null)} role="dialog" aria-modal="true">
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <h3>รายละเอียดบันทึกความปลอดภัย</h3>
                <span className="modalHeaderSub tabular-nums">Audit Log Entry ID #{selectedLog.id}</span>
              </div>
              <button 
                type="button"
                className="closeBtn" 
                onClick={() => setSelectedLog(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="modalBody">
              {/* Quick Info Banner */}
              <div className="modalSummaryBanner">
                <div className="modalSummaryItem">
                  <span className="summaryLabel">ประเภทการดำเนินการ</span>
                  <span className="summaryValue">{getActionBadge(selectedLog.action_type)}</span>
                </div>
                <div className="modalSummaryItem">
                  <span className="summaryLabel">วัน-เวลาบันทึก (Timestamp)</span>
                  <span className="summaryValue tabular-nums">{formatDate(selectedLog.timestamp)}</span>
                </div>
                <div className="modalSummaryItem">
                  <span className="summaryLabel">สถานะเครือข่าย</span>
                  <span className="summaryValue ipModalTag tabular-nums">
                    {selectedLog.ip_address || '-'} 
                    {isLocalIp(selectedLog.ip_address) && <span className="lanBadge">Internal LAN</span>}
                  </span>
                </div>
              </div>

              {/* 2-Column Info Grid */}
              <div className="detailGrid">
                <div className="detailItem">
                  <span className="detailLabel">ผู้ใช้งาน (Account)</span>
                  <div className="detailValueWithCopy">
                    <span className="detailValue">
                      {selectedLog.username ? `${selectedLog.username} (${selectedLog.email || 'ไม่มีอีเมล'})` : 'ไม่ได้เข้าสู่ระบบ (Guest / System)'}
                    </span>
                    {selectedLog.username && (
                      <button 
                        type="button" 
                        className="modalCopyBtn"
                        onClick={() => copyToClipboard(selectedLog.username!, 'ชื่อผู้ใช้')}
                        title="คัดลอกชื่อผู้ใช้"
                        aria-label="คัดลอกชื่อผู้ใช้"
                      >
                        <Copy size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="detailItem">
                  <span className="detailLabel">เป้าหมายที่เข้าถึง (Target Resource)</span>
                  <div className="detailValue">
                    <span className="targetBadge">{getTargetTableName(selectedLog.target_table)}</span>
                  </div>
                </div>

                <div className="detailItem">
                  <span className="detailLabel">ประเภทอุปกรณ์ (Device Type)</span>
                  <span className="detailValue">
                    {(() => {
                      const p = parseUserAgent(selectedLog.user_agent)
                      return p.deviceType === 'desktop' 
                        ? 'เครื่องคอมพิวเตอร์ (Desktop PC / Mac)' 
                        : p.deviceType === 'mobile' 
                        ? `โทรศัพท์มือถือ (${p.deviceModel || 'Smartphone'})` 
                        : p.deviceType === 'tablet' 
                        ? `แท็บเล็ต (${p.deviceModel || 'Tablet'})` 
                        : p.deviceType === 'bot' 
                        ? 'สคริปต์อัตโนมัติ / บอท (Bot Crawler)' 
                        : 'ไม่สามารถระบุอุปกรณ์ได้'
                    })()}
                  </span>
                </div>

                <div className="detailItem">
                  <span className="detailLabel">ระบบปฏิบัติการและเบราว์เซอร์</span>
                  <span className="detailValue">
                    {parseUserAgent(selectedLog.user_agent).os} • {parseUserAgent(selectedLog.user_agent).browser}
                  </span>
                </div>

                <div className="detailItem fullWidth">
                  <div className="detailHeaderWithAction">
                    <span className="detailLabel">User-Agent Header แบบเต็ม</span>
                    {selectedLog.user_agent && (
                      <button 
                        type="button"
                        className="textActionBtn"
                        onClick={() => copyToClipboard(selectedLog.user_agent!, 'User-Agent Header')}
                      >
                        <Copy size={12} />
                        <span>คัดลอก</span>
                      </button>
                    )}
                  </div>
                  <pre className="codeBlock">{selectedLog.user_agent || 'ไม่มีข้อมูล User-Agent'}</pre>
                </div>

                <div className="detailItem fullWidth">
                  <div className="detailHeaderWithAction">
                    <span className="detailLabel">รายละเอียดการปฏิบัติงาน (Action Details)</span>
                    {selectedLog.action_details && (
                      <button 
                        type="button"
                        className="textActionBtn"
                        onClick={() => copyToClipboard(selectedLog.action_details!, 'รายละเอียดการปฏิบัติงาน')}
                      >
                        <Copy size={12} />
                        <span>คัดลอก</span>
                      </button>
                    )}
                  </div>
                  <pre className="codeBlock actionDetailsPre">
                    {selectedLog.action_details || 'ไม่มีรายละเอียดเพิ่มเติม'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="modalFooter">
              <button 
                type="button" 
                className="btnSecondary" 
                onClick={() => setSelectedLog(null)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDPA Retention Cleanup Confirmation Modal */}
      {cleanupModalOpen && (
        <div className="modalOverlay" onClick={() => !cleanupLoading && setCleanupModalOpen(false)} role="dialog" aria-modal="true">
          <div className="modalContent cleanupModalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <h3>ล้างประวัติการใช้งานระบบ (PDPA Retention)</h3>
                <span className="modalHeaderSub">เกณฑ์การจัดเก็บข้อมูลขั้นต่ำ 90 วันตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล</span>
              </div>
              <button 
                type="button"
                className="closeBtn" 
                onClick={() => !cleanupLoading && setCleanupModalOpen(false)}
                disabled={cleanupLoading}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modalBody">
              <div className="cleanupInfoBox">
                <p className="cleanupWarningText">
                  ระบบจะลบข้อมูลประวัติในตาราง <code>audit_logs</code> ที่มีอายุเก่ากว่า <strong>90 วัน</strong> ทั้งหมดออกจากฐานข้อมูล
                </p>
                <div className="cleanupCountSummary">
                  <span className="cleanupCountLabel">จำนวนรายการที่เข้าเกณฑ์ล้างประวัติ:</span>
                  <span className="cleanupCountValue tabular-nums">
                    {cleanupChecking ? (
                      <span className="statSkeleton"></span>
                    ) : expiredCount !== null ? (
                      `${expiredCount.toLocaleString()} รายการ`
                    ) : (
                      'พร้อมตรวจสอบ'
                    )}
                  </span>
                </div>
                <p className="cleanupNotice">
                  หมายเหตุ: การดำเนินการนี้เป็นการลบถาวรเพื่อลดขนาดฐานข้อมูลตามมาตรฐานความปลอดภัย และระบบจะบันทึก Audit Log การล้างข้อมูลนี้ไว้เป็นหลักฐานโดยอัตโนมัติ
                </p>
              </div>
            </div>

            <div className="modalFooter">
              <button 
                type="button" 
                className="btnSecondary" 
                onClick={() => setCleanupModalOpen(false)}
                disabled={cleanupLoading}
              >
                ยกเลิก
              </button>
              <button 
                type="button" 
                className="btnDanger"
                onClick={handleExecuteCleanup}
                disabled={cleanupLoading || cleanupChecking || expiredCount === 0}
              >
                {cleanupLoading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>กำลังดำเนินการ...</span>
                  </>
                ) : (
                  <span>ยืนยันการล้างข้อมูล</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </>
  )
}
