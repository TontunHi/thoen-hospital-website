'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  RefreshCw, 
  Calendar, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  Database, 
  LogIn, 
  LogOut, 
  Settings, 
  FileCode, 
  Globe, 
  X, 
  AlertCircle,
  ArrowLeft,
  Download,
  Shield,
  ShieldCheck,
  HardDrive,
  Laptop,
  Smartphone,
  Tablet,
  Bot,
  Copy,
  Check,
  Clock,
  User,
  PlusCircle,
  Edit3,
  Trash2,
  Filter,
  Activity,
  Server
} from 'lucide-react'
import Link from 'next/link'
import { parseUserAgent } from '@/lib/userAgentParser'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'

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

  const fetchLogs = useCallback(async (currentPage = page, customFilters?: { search?: string; actionType?: string; startDate?: string; endDate?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('page', currentPage.toString())
      params.append('limit', '25')
      
      const s = customFilters?.search !== undefined ? customFilters.search : search
      const a = customFilters?.actionType !== undefined ? customFilters.actionType : actionType
      const sd = customFilters?.startDate !== undefined ? customFilters.startDate : startDate
      const ed = customFilters?.endDate !== undefined ? customFilters.endDate : endDate

      if (s) params.append('search', s)
      if (a) params.append('actionType', a)
      if (sd) params.append('startDate', sd)
      if (ed) params.append('endDate', ed)

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setLogs(data.logs || [])
        setPagination(data.pagination || { page: currentPage, limit: 25, total: 0, totalPages: 1 })
      } else {
        setError(data.error || 'ไม่สามารถดึงข้อมูลประวัติการใช้งานได้')
      }
    } catch (err) {
      console.error(err)
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }, [page, search, actionType, startDate, endDate])

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin/audit-logs/stats')
      const data = await res.json()
      if (res.ok && data.success) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (actionType) params.append('actionType', actionType)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`/api/admin/audit-logs/export?${params.toString()}`)
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      addToast('ส่งออกไฟล์รายงาน Audit Logs (UTF-8 BOM) เรียบร้อยแล้ว', 'success')
    } catch (err) {
      console.error('Export error:', err)
      addToast('ไม่สามารถส่งออกไฟล์รายงานได้ กรุณาลองใหม่อีกครั้ง', 'error')
    } finally {
      setExporting(false)
    }
  }

  // Trigger fetch on page or actionType change
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

  const getActionBadge = (type: string) => {
    switch (type.toUpperCase()) {
      case 'LOGIN':
        return (
          <span className="logBadge badgeLogin">
            <LogIn size={13} className="badgeIcon" />
            <span>LOGIN</span>
          </span>
        )
      case 'LOGOUT':
        return (
          <span className="logBadge badgeLogout">
            <LogOut size={13} className="badgeIcon" />
            <span>LOGOUT</span>
          </span>
        )
      case 'CREATE':
        return (
          <span className="logBadge badgeCreate">
            <PlusCircle size={13} className="badgeIcon" />
            <span>CREATE</span>
          </span>
        )
      case 'UPDATE':
        return (
          <span className="logBadge badgeUpdate">
            <Edit3 size={13} className="badgeIcon" />
            <span>UPDATE</span>
          </span>
        )
      case 'READ':
        return (
          <span className="logBadge badgeRead">
            <Eye size={13} className="badgeIcon" />
            <span>READ</span>
          </span>
        )
      case 'DELETE':
        return (
          <span className="logBadge badgeDelete">
            <Trash2 size={13} className="badgeIcon" />
            <span>DELETE</span>
          </span>
        )
      case 'REQUEST':
        return (
          <span className="logBadge badgeRequest">
            <Globe size={13} className="badgeIcon" />
            <span>REQUEST</span>
          </span>
        )
      case 'SYSTEM':
        return (
          <span className="logBadge badgeSystem">
            <Settings size={13} className="badgeIcon" />
            <span>SYSTEM</span>
          </span>
        )
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
      default: return table
    }
  }

  const getDeviceBadge = (uaString: string | null) => {
    const parsed = parseUserAgent(uaString)
    const icon = parsed.deviceType === 'mobile' 
      ? <Smartphone size={13} className="deviceIcon" />
      : parsed.deviceType === 'tablet'
      ? <Tablet size={13} className="deviceIcon" />
      : parsed.deviceType === 'bot'
      ? <Bot size={13} className="deviceIcon" />
      : <Laptop size={13} className="deviceIcon" />

    const deviceName = parsed.deviceModel || parsed.os
    const tooltipText = `${parsed.os} • ${parsed.browser}\n${uaString || 'ไม่ระบุ User-Agent'}`

    return (
      <div className={`deviceBadge deviceBadge-${parsed.deviceType}`} title={tooltipText}>
        {icon}
        <span className="deviceTextTruncate">
          <span className="deviceName">{deviceName}</span>
          <span className="deviceSeparator">•</span>
          <span className="browserName">{parsed.browser}</span>
        </span>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
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
              <span className="pulseDot"></span>
              <span className="pulseText">บันทึกเรียลไทม์ Tier-1 Audit</span>
            </div>
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
          <div className="titleIcon">
            <ShieldCheck size={32} />
          </div>
          <div className="titleText">
            <div className="titleRow">
              <h1>ระบบประวัติความปลอดภัยและ Audit Logs</h1>
              <span className="complianceBadge">PDPA & Hospital Security Standard</span>
            </div>
            <p className="subtitle">
              ตรวจสอบและบันทึกประวัติการเข้าใช้งาน, การสืบค้นข้อมูลสำคัญ (PHI/Salary), การเปลี่ยนแปลงสิทธิ และการดำเนินงาน CRUD ทั้งหมดของโรงพยาบาลเถิน
            </p>
          </div>
        </div>
      </header>

      {/* Stats Dashboard Cards */}
      <section className="auditStatsGrid" aria-label="สถิติความปลอดภัย">
        <div className="statCard statCardTotal">
          <div className="statCardHeader">
            <div className="statIconWrapper statIconTotal">
              <Database size={22} />
            </div>
            <span className="statBadge">ระบบทั้งหมด</span>
          </div>
          <div className="statInfo">
            <span className="statLabel">บันทึกทั้งหมด (Total Logs)</span>
            <span className="statValue">
              {statsLoading ? <span className="statSkeleton"></span> : (stats?.totalLogs ?? 0).toLocaleString()}
            </span>
            <span className="statSubtext">
              <Server size={12} /> ขนาดข้อมูลสะสม ~{stats?.sizeMb ?? 0} MB
            </span>
          </div>
        </div>

        <div className="statCard statCardLogin">
          <div className="statCardHeader">
            <div className="statIconWrapper statIconLogin">
              <LogIn size={22} />
            </div>
            <span className="statBadge statBadgeSuccess">วันนี้</span>
          </div>
          <div className="statInfo">
            <span className="statLabel">เข้าสู่ระบบวันนี้ (Logins Today)</span>
            <span className="statValue">
              {statsLoading ? <span className="statSkeleton"></span> : `${(stats?.loginsToday ?? 0).toLocaleString()} ครั้ง`}
            </span>
            <span className="statSubtext">
              <Activity size={12} /> ตรวจสอบกิจกรรมการยืนยันตัวตน
            </span>
          </div>
        </div>

        <div className="statCard statCardRead">
          <div className="statCardHeader">
            <div className="statIconWrapper statIconRead">
              <Shield size={22} />
            </div>
            <span className="statBadge statBadgePurple">Sensitive Access</span>
          </div>
          <div className="statInfo">
            <span className="statLabel">เข้าดูข้อมูลสำคัญ (Reads Today)</span>
            <span className="statValue">
              {statsLoading ? <span className="statSkeleton"></span> : `${(stats?.readsToday ?? 0).toLocaleString()} ครั้ง`}
            </span>
            <span className="statSubtext">
              <Eye size={12} /> เข้าถึงข้อมูลเงินเดือนและเวชระเบียน
            </span>
          </div>
        </div>

        <div className="statCard statCardRetention">
          <div className="statCardHeader">
            <div className="statIconWrapper statIconRetention">
              <HardDrive size={22} />
            </div>
            <span className="statBadge statBadgeAmber">มาตรฐาน 90 วัน</span>
          </div>
          <div className="statInfo">
            <span className="statLabel">อายุจัดเก็บข้อมูล (Retention)</span>
            <span className="statValue">
              {statsLoading ? <span className="statSkeleton"></span> : `${stats?.retainedDays ?? 0} วัน`}
            </span>
            <span className="statSubtext">
              <Clock size={12} /> จัดเก็บตามเกณฑ์ พ.ร.บ.ฯ คุ้มครองข้อมูล
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
              <Filter size={14} /> ประเภทกิจกรรม:
            </span>
            <div className="chipsList">
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
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Date Range Presets & Date Pickers */}
            <div className="filterField">
              <label>ช่วงวันที่ (Date Range)</label>
              <div className="datePresetsRow">
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
                      <button type="button" onClick={() => { setSearch(''); fetchLogs(1, { search: '' }) }}><X size={12} /></button>
                    </span>
                  )}
                  {actionType && (
                    <span className="filterTag">
                      ประเภท: {actionType}
                      <button type="button" onClick={() => { setActionType(''); fetchLogs(1, { actionType: '' }) }}><X size={12} /></button>
                    </span>
                  )}
                  {(startDate || endDate) && (
                    <span className="filterTag">
                      วันที่: {startDate || '...'} ถึง {endDate || '...'}
                      <button type="button" onClick={() => { setStartDate(''); setEndDate(''); setActiveDatePreset('all'); fetchLogs(1, { startDate: '', endDate: '' }) }}><X size={12} /></button>
                    </span>
                  )}
                </div>
              ) : (
                <span className="inactiveFilterNote">แสดงข้อมูลประวัติการใช้งานทั้งหมด</span>
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
            <span className="tableSubtitle">แสดงผลหน้าละ 25 รายการ</span>
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
          <div className="errorState">
            <div className="stateIconWrapper stateIconError">
              <AlertCircle size={36} />
            </div>
            <h4>เกิดข้อผิดพลาดในการโหลดข้อมูล</h4>
            <p>{error}</p>
            <button onClick={() => fetchLogs()} className="btnRetry">
              <RefreshCw size={16} />
              <span>ลองใหม่อีกครั้ง</span>
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="emptyState">
            <div className="stateIconWrapper stateIconEmpty">
              <Search size={36} />
            </div>
            <h4>ไม่พบบันทึกประวัติการใช้งาน</h4>
            <p>ไม่มีรายการที่ตรงกับเงื่อนไขการค้นหา หรือยังไม่มีกิจกรรมในช่วงเวลาที่เลือก</p>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} className="btnSecondary">
                <RefreshCw size={15} />
                <span>ล้างตัวกรองเพื่อดูทั้งหมด</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="tableWrapper">
              <table className="logsTable">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '175px' }}>วัน-เวลา (Timestamp)</th>
                    <th scope="col" style={{ width: '220px' }}>ผู้ใช้งาน (Account)</th>
                    <th scope="col" style={{ width: '130px' }}>ประเภท (Action)</th>
                    <th scope="col" style={{ minWidth: '180px' }}>เป้าหมาย (Target)</th>
                    <th scope="col" style={{ width: '150px' }}>IP Address</th>
                    <th scope="col" style={{ width: '180px' }}>อุปกรณ์ / เบราว์เซอร์</th>
                    <th scope="col" style={{ width: '110px', textAlign: 'center' }}>จัดการ</th>
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
                            <span className="timePrimary">{formatDate(log.timestamp)}</span>
                            {relative && <span className="timeRelative">{relative}</span>}
                          </div>
                        </td>

                        <td className="userCell">
                          {log.username ? (
                            <div className="userDetails">
                              <div className="userAvatarCircle">
                                <User size={14} />
                              </div>
                              <div className="userTextWrapper">
                                <span className="usernameText">{log.username}</span>
                                {log.email && <span className="emailText">{log.email}</span>}
                              </div>
                            </div>
                          ) : (
                            <div className="guestUserDetails">
                              <div className="guestAvatarCircle">
                                <Globe size={13} />
                              </div>
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
                              <span className="ipText">{log.ip_address}</span>
                              {isLocal && <span className="lanBadge">LAN</span>}
                              <button
                                type="button"
                                className="copyIpBtn"
                                onClick={() => copyToClipboard(log.ip_address!, `IP Address ${log.ip_address}`)}
                                title="คัดลอก IP Address"
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
                            className="viewDetailBtn"
                            onClick={() => setSelectedLog(log)}
                            title="ดูข้อมูลเจาะลึกความปลอดภัย"
                          >
                            <Eye size={14} />
                            <span>ดูบันทึก</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination">
              <div className="paginationInfo">
                แสดงผล <span>{logs.length}</span> จากทั้งหมด <span>{pagination.total.toLocaleString()}</span> รายการ
              </div>
              
              <div className="paginationBtns">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(1)}
                  className="pageBtn pageBtnSquare"
                  title="หน้าแรก"
                >
                  «
                </button>
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="pageBtn"
                >
                  <ChevronLeft size={16} />
                  <span>ก่อนหน้า</span>
                </button>
                
                <div className="pageIndicator">
                  หน้า <strong>{page}</strong> จาก <strong>{pagination.totalPages || 1}</strong>
                </div>

                <button
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  className="pageBtn"
                >
                  <span>ถัดไป</span>
                  <ChevronRight size={16} />
                </button>
                <button
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage(pagination.totalPages)}
                  className="pageBtn pageBtnSquare"
                  title="หน้าสุดท้าย"
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
              <div className="modalHeaderTitle">
                <div className="modalHeaderIcon">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3>รายละเอียดบันทึกความปลอดภัย</h3>
                  <span className="modalHeaderSub">Audit Log Entry ID #{selectedLog.id}</span>
                </div>
              </div>
              <button 
                className="closeBtn" 
                onClick={() => setSelectedLog(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
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
                  <span className="summaryValue">{formatDate(selectedLog.timestamp)}</span>
                </div>
                <div className="modalSummaryItem">
                  <span className="summaryLabel">สถานะเครือข่าย</span>
                  <span className="summaryValue ipModalTag">
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
                        ? '💻 เครื่องคอมพิวเตอร์ (Desktop PC / Mac)' 
                        : p.deviceType === 'mobile' 
                        ? `📱 โทรศัพท์มือถือ (${p.deviceModel || 'Smartphone'})` 
                        : p.deviceType === 'tablet' 
                        ? `📟 แท็บเล็ต (${p.deviceModel || 'Tablet'})` 
                        : p.deviceType === 'bot' 
                        ? '🤖 สคริปต์อัตโนมัติ / บอท (Bot Crawler)' 
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
                        className="modalTextActionBtn"
                        onClick={() => copyToClipboard(selectedLog.user_agent!, 'User-Agent')}
                      >
                        <Copy size={12} />
                        <span>คัดลอก User-Agent</span>
                      </button>
                    )}
                  </div>
                  <span className="detailValue userAgentText code">{selectedLog.user_agent || '-'}</span>
                </div>
              </div>

              {/* Raw Action Details Viewer */}
              <div className="detailDetails">
                <div className="detailDetailsHeader">
                  <div className="detailsHeaderTitle">
                    <FileCode size={16} />
                    <span>ข้อมูลเชิงเทคนิค / พารามิเตอร์ (Action Payload Details)</span>
                  </div>
                  {selectedLog.action_details && (
                    <button 
                      type="button" 
                      className="modalCopyCodeBtn"
                      onClick={() => copyToClipboard(selectedLog.action_details!, 'Action Details JSON')}
                    >
                      <Copy size={13} />
                      <span>คัดลอก JSON</span>
                    </button>
                  )}
                </div>
                <pre className="detailDetailsContent">
                  <code>{selectedLog.action_details || 'ไม่มีข้อมูลเชิงเทคนิคเพิ่มเติม (No payload details)'}</code>
                </pre>
              </div>
            </div>
            
            <div className="modalFooter">
              <button type="button" className="btnSecondary" onClick={() => setSelectedLog(null)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </>
  )
}
