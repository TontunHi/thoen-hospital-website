'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  ArrowLeft,
  Download,
  Copy,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import { parseUserAgent } from '@/lib/userAgentParser'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import { formatThaiDate, THAI_MONTH_NAMES_SHORT } from '@/lib/formatters'

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

const ACTION_TABS = [
  { id: '', label: 'ทั้งหมด', hint: 'แสดงกิจกรรมทุกประเภท' },
  { id: 'LOGIN', label: 'LOGIN', hint: 'การเข้าสู่ระบบและยืนยันตัวตน' },
  { id: 'READ', label: 'READ', hint: 'การเข้าดูข้อมูลสำคัญ (PHI / เงินเดือน)' },
  { id: 'CREATE', label: 'CREATE', hint: 'การสร้างรายการข้อมูลใหม่' },
  { id: 'UPDATE', label: 'UPDATE', hint: 'การแก้ไขข้อมูลหรือปรับสถานะ' },
  { id: 'DELETE', label: 'DELETE', hint: 'การลบหรือยกเลิกข้อมูล' },
  { id: 'LOGOUT', label: 'LOGOUT', hint: 'การออกจากระบบ' },
  { id: 'REQUEST', label: 'REQUEST', hint: 'คำขอใช้งาน API และบริการ' },
  { id: 'SYSTEM', label: 'SYSTEM', hint: 'การทำงานอัตโนมัติและการตั้งค่าระบบ' },
] as const

const TARGET_RESOURCE_MAP: Record<string, string> = {
  members: 'ข้อมูลบุคลากร',
  pr_requests: 'คำขอผลิตสื่อประชาสัมพันธ์',
  approval_tickets: 'งานรออนุมัติ',
  work_requests: 'ใบงานแจ้งซ่อม',
  ita_blogs: 'เอกสารเผยแพร่ ITA',
  ethics_documents: 'เอกสารชมรมจริยธรรม',
  member_system_settings: 'ตั้งค่าระบบสมาชิก',
  position_permissions: 'สิทธิ์ตามตำแหน่ง',
  salary_slips: 'สลิปเงินเดือน',
  salary_batches: 'งวดข้อมูลเงินเดือน',
  inbox_tasks: 'กล่องงานและคำขอ',
  audit_logs: 'บันทึกความปลอดภัย',
  departments: 'โครงสร้างหน่วยงาน',
  organization: 'ผังองค์กร',
  equipment_borrow: 'ระบบยืม-คืนครุภัณฑ์',
  equipment_items: 'ทะเบียนครุภัณฑ์',
  equipment_requests: 'คำขอยืมครุภัณฑ์',
  hospital_events: 'ปฏิทินกิจกรรมโรงพยาบาล',
  kpi: 'ตัวชี้วัดองค์กร (KPI)',
  kpi_records: 'ข้อมูลผลงาน KPI',
  palliative_registry: 'ทะเบียนผู้ป่วยประคับประคอง',
  screening: 'ข้อมูลคัดกรองสุขภาพ',
  loratadine_dispense_log: 'ประวัติจ่ายยา Loratadine',
  signatures: 'ลายเซ็นอิเล็กทรอนิกส์',
  uploads: 'คลังไฟล์เอกสาร',
  slides: 'แบนเนอร์หน้าแรก',
  news: 'ข่าวประชาสัมพันธ์',
  telegram: 'การแจ้งเตือน Telegram',
}

function getTargetInfo(table: string | null, actionType?: string): { label: string; raw: string | null } {
  if (!table) {
    if (actionType === 'LOGIN' || actionType === 'LOGOUT') {
      return { label: 'ระบบยืนยันตัวตน', raw: null }
    }
    return { label: 'ระบบส่วนกลาง', raw: null }
  }
  const normalized = table.trim().toLowerCase()
  const mapped = TARGET_RESOURCE_MAP[normalized]
  if (mapped) {
    return { label: mapped, raw: normalized }
  }
  return { label: table, raw: null }
}

function parseDetailsPayload(details: string | null): {
  entries: Array<{ key: string; value: string }> | null
  prettyJson: string | null
  summary: string
} {
  if (!details || !details.trim()) {
    return { entries: null, prettyJson: null, summary: 'ไม่มีรายละเอียดเพิ่มเติม' }
  }

  const trimmed = details.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed).map(([key, val]) => ({
          key,
          value:
            val === null || val === undefined
              ? '—'
              : typeof val === 'object'
              ? JSON.stringify(val)
              : String(val),
        }))
        const summaryParts = entries.slice(0, 3).map((e) => `${e.key}: ${e.value}`)
        return {
          entries,
          prettyJson: JSON.stringify(parsed, null, 2),
          summary: summaryParts.join(' · ') || trimmed,
        }
      }
      return {
        entries: null,
        prettyJson: JSON.stringify(parsed, null, 2),
        summary: trimmed,
      }
    } catch {
      // Plain string starting with bracket; fall through
    }
  }

  return { entries: null, prettyJson: null, summary: trimmed }
}

function parseAuditDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  let clean = dateStr.trim()
  if (clean.endsWith('Z')) {
    clean = clean.replace(/Z$/, '+07:00')
  } else if (!clean.includes('+') && !clean.includes('Z')) {
    clean = clean.replace(' ', 'T') + '+07:00'
  }
  return new Date(clean)
}

function formatSplitTimestamp(dateStr: string): { datePart: string; timePart: string; full: string } {
  try {
    const date = parseAuditDate(dateStr)
    if (isNaN(date.getTime())) {
      return { datePart: dateStr, timePart: '', full: dateStr }
    }
    const d = date.getDate().toString().padStart(2, '0')
    const m = THAI_MONTH_NAMES_SHORT[date.getMonth()]
    let y = date.getFullYear()
    if (y < 2400) y += 543
    const hh = date.getHours().toString().padStart(2, '0')
    const mm = date.getMinutes().toString().padStart(2, '0')
    const ss = date.getSeconds().toString().padStart(2, '0')
    const datePart = `${d} ${m} ${y}`
    const timePart = `${hh}:${mm}:${ss}`
    return { datePart, timePart, full: `${datePart} ${timePart}` }
  } catch {
    return { datePart: dateStr, timePart: '', full: dateStr }
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = parseAuditDate(dateStr)
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diffSec < 0) return ''
    if (diffSec < 60) return 'เมื่อสักครู่'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีที่แล้ว`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชม. ที่แล้ว`
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} วันที่แล้ว`
    return ''
  } catch {
    return ''
  }
}

function isLocalIp(ip: string | null): boolean {
  if (!ip) return false
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  )
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
  const [appliedSearch, setAppliedSearch] = useState('')
  const [actionType, setActionType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeDatePreset, setActiveDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  })

  // Inspector Drawer & Cleanup Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const [cleanupModalOpen, setCleanupModalOpen] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupChecking, setCleanupChecking] = useState(false)
  const [expiredCount, setExpiredCount] = useState<number | null>(null)

  const isFirstSearchEffect = useRef(true)

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6)
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const copyToClipboard = async (text: string, fieldKey: string, labelForToast: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldKey)
      addToast(`คัดลอก${labelForToast}เรียบร้อยแล้ว`, 'success')
      setTimeout(() => {
        setCopiedField((prev) => (prev === fieldKey ? null : prev))
      }, 2000)
    } catch {
      addToast('ไม่สามารถคัดลอกข้อความได้', 'error')
    }
  }

  const fetchStats = useCallback(async () => {
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
  }, [])

  const fetchLogs = useCallback(
    async (
      targetPage: number,
      filters: { search: string; actionType: string; startDate: string; endDate: string }
    ) => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          page: targetPage.toString(),
          limit: '25',
        })

        if (filters.search) params.append('search', filters.search)
        if (filters.actionType) params.append('actionType', filters.actionType)
        if (filters.startDate) params.append('startDate', filters.startDate)
        if (filters.endDate) params.append('endDate', filters.endDate)

        const res = await fetch(`/api/admin/audit-logs?${params.toString()}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'ไม่สามารถโหลดประวัติการใช้งานได้')
        }

        setLogs(data.logs || [])
        setPagination(
          data.pagination || {
            page: targetPage,
            limit: 25,
            total: 0,
            totalPages: 1,
          }
        )
      } catch (err: any) {
        console.error('Fetch logs error:', err)
        setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการใช้งาน')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Debounce live search typing into appliedSearch
  useEffect(() => {
    if (isFirstSearchEffect.current) {
      isFirstSearchEffect.current = false
      return
    }
    const timer = setTimeout(() => {
      setPage(1)
      setAppliedSearch(search.trim())
    }, 320)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch logs whenever query state changes
  useEffect(() => {
    fetchLogs(page, {
      search: appliedSearch,
      actionType,
      startDate,
      endDate,
    })
  }, [page, appliedSearch, actionType, startDate, endDate, fetchLogs])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Keyboard navigation for Inspector Drawer & Cleanup Modal
  useEffect(() => {
    if (!selectedLog && !cleanupModalOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cleanupModalOpen && !cleanupLoading) {
          setCleanupModalOpen(false)
        } else if (selectedLog) {
          setSelectedLog(null)
        }
        return
      }

      if (selectedLog && !cleanupModalOpen) {
        const currentIdx = logs.findIndex((item) => item.id === selectedLog.id)
        if (e.key === 'ArrowDown' && currentIdx >= 0 && currentIdx < logs.length - 1) {
          e.preventDefault()
          setSelectedLog(logs[currentIdx + 1])
        } else if (e.key === 'ArrowUp' && currentIdx > 0) {
          e.preventDefault()
          setSelectedLog(logs[currentIdx - 1])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLog, cleanupModalOpen, cleanupLoading, logs])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = search.trim()
    setPage(1)
    if (trimmed === appliedSearch) {
      fetchLogs(1, { search: trimmed, actionType, startDate, endDate })
    } else {
      setAppliedSearch(trimmed)
    }
  }

  const handleDatePresetChange = (preset: 'all' | 'today' | '7days' | '30days' | 'custom') => {
    setActiveDatePreset(preset)
    if (preset === 'custom') return

    const now = new Date()
    let s = ''
    let e = ''

    const toLocalYmd = (d: Date) => {
      const yr = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const da = String(d.getDate()).padStart(2, '0')
      return `${yr}-${mo}-${da}`
    }

    if (preset === 'today') {
      s = toLocalYmd(now)
      e = s
    } else if (preset === '7days') {
      const past = new Date(now)
      past.setDate(now.getDate() - 7)
      s = toLocalYmd(past)
      e = toLocalYmd(now)
    } else if (preset === '30days') {
      const past = new Date(now)
      past.setDate(now.getDate() - 30)
      s = toLocalYmd(past)
      e = toLocalYmd(now)
    }

    setStartDate(s)
    setEndDate(e)
    setPage(1)
  }

  const handleResetFilters = () => {
    setSearch('')
    setAppliedSearch('')
    setActionType('')
    setStartDate('')
    setEndDate('')
    setActiveDatePreset('all')
    setPage(1)
  }

  const handleRefreshAll = () => {
    fetchStats()
    fetchLogs(page, { search: appliedSearch, actionType, startDate, endDate })
    addToast('อัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว', 'info')
  }

  const handleExportCsv = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams()
      if (appliedSearch) params.append('search', appliedSearch)
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

  const handleOpenCleanupModal = async () => {
    setCleanupModalOpen(true)
    setCleanupChecking(true)
    try {
      const res = await fetch('/api/admin/audit-logs/cleanup?days=90')
      const data = await res.json()
      setExpiredCount(data.success ? data.expiredCount : 0)
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
        body: JSON.stringify({ retentionDays: 90 }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'การล้างข้อมูลประวัติล้มเหลว')
      }

      addToast(data.message || 'ล้างประวัติเก่าเกิน 90 วันสำเร็จแล้ว', 'success')
      setCleanupModalOpen(false)
      fetchStats()
      setPage(1)
      fetchLogs(1, { search: appliedSearch, actionType, startDate, endDate })
    } catch (err: any) {
      console.error('Execute cleanup error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการล้างประวัติ', 'error')
    } finally {
      setCleanupLoading(false)
    }
  }

  // 1 color = 1 meaning, zero decorative icons
  const getActionBadge = (type: string) => {
    const t = (type || '').toUpperCase()
    if (t === 'LOGIN' || t === 'CREATE') {
      return <span className="logBadge badgeSuccess">{t}</span>
    }
    if (t === 'READ' || t === 'REQUEST') {
      return <span className="logBadge badgeInfo">{t}</span>
    }
    if (t === 'UPDATE' || t.startsWith('UPDATE_') || t.startsWith('BATCH_UPDATE_')) {
      return <span className="logBadge badgeWarning">{t}</span>
    }
    if (t === 'DELETE') {
      return <span className="logBadge badgeDanger">{t}</span>
    }
    return <span className="logBadge badgeNeutral">{t || 'SYSTEM'}</span>
  }

  const hasActiveFilters = Boolean(appliedSearch || search || actionType || startDate || endDate)
  const selectedIndex = selectedLog ? logs.findIndex((l) => l.id === selectedLog.id) : -1
  const selectedDetails = selectedLog ? parseDetailsPayload(selectedLog.action_details) : null

  return (
    <div className="auditPageFlow">
      {/* 1. Standalone Back Navigation */}
      <nav className="topBreadcrumb" aria-label="การนำทางย้อนกลับ">
        <Link href="/member" className="backLink">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>กลับสู่ศูนย์ควบคุมสมาชิก</span>
        </Link>
      </nav>

      {/* 2. Clean Focused Header Bar (1 Primary Action) */}
      <header className="pageHeaderBar">
        <div className="headerTitleBlock">
          <h1>ระบบประวัติความปลอดภัยและ Audit Logs</h1>
          <p className="headerSubtitle">
            ตรวจสอบการยืนยันตัวตน การเข้าถึงข้อมูลสำคัญ (PHI / เงินเดือน) และการเปลี่ยนแปลงสิทธิ์ตามมาตรฐาน PDPA
          </p>
        </div>

        <div className="headerActions">
          <button
            type="button"
            className="btnSecondary"
            onClick={handleRefreshAll}
            disabled={loading || statsLoading}
            title="อัปเดตข้อมูลล่าสุด"
          >
            <RefreshCw size={15} className={loading || statsLoading ? 'spinIcon' : ''} aria-hidden="true" />
            <span>รีเฟรชข้อมูล</span>
          </button>

          <button
            type="button"
            className="btnPrimary"
            onClick={handleExportCsv}
            disabled={loading || exporting}
            title="ส่งออกรายการตามเงื่อนไขที่กรองเป็นไฟล์ CSV (รองรับ Excel ภาษาไทย)"
          >
            {exporting ? (
              <RefreshCw size={16} className="spinIcon" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            <span>{exporting ? 'กำลังส่งออก...' : 'ส่งออกรายงาน CSV'}</span>
          </button>
        </div>
      </header>

      {/* 3. Unified Telemetry Summary Bar (Replaces 4 scattered cards) */}
      <section className="summaryLedgerBar" aria-label="สรุปสถิติบันทึกความปลอดภัย">
        <div className="summaryMetric">
          <span className="metricLabel">บันทึกสะสมทั้งหมด</span>
          <div className="metricValueRow">
            {statsLoading ? (
              <span className="metricSkeleton" />
            ) : (
              <>
                <strong className="metricNumber tabular-nums">
                  {(stats?.totalLogs ?? 0).toLocaleString()}
                </strong>
                <span className="metricUnit tabular-nums">รายการ (~{stats?.sizeMb ?? 0} MB)</span>
              </>
            )}
          </div>
        </div>

        <div className="summaryMetric">
          <span className="metricLabel">เข้าสู่ระบบวันนี้</span>
          <div className="metricValueRow">
            {statsLoading ? (
              <span className="metricSkeleton" />
            ) : (
              <strong className="metricNumber tabular-nums">
                {(stats?.loginsToday ?? 0).toLocaleString()} ครั้ง
              </strong>
            )}
          </div>
        </div>

        <div className="summaryMetric">
          <span className="metricLabel">เข้าดูข้อมูลสำคัญวันนี้</span>
          <div className="metricValueRow">
            {statsLoading ? (
              <span className="metricSkeleton" />
            ) : (
              <strong className="metricNumber tabular-nums">
                {(stats?.readsToday ?? 0).toLocaleString()} ครั้ง
              </strong>
            )}
          </div>
        </div>

        <div className="summaryMetric">
          <span className="metricLabel">แก้ไขข้อมูลวันนี้</span>
          <div className="metricValueRow">
            {statsLoading ? (
              <span className="metricSkeleton" />
            ) : (
              <strong className="metricNumber tabular-nums">
                {(stats?.changesToday ?? 0).toLocaleString()} ครั้ง
              </strong>
            )}
          </div>
        </div>

        <div className="summaryMetric summaryMetricRetention">
          <div className="retentionHeaderRow">
            <span className="metricLabel">อายุจัดเก็บข้อมูล (เกณฑ์ {stats?.policyRetentionDays ?? 90} วัน)</span>
          </div>
          <div className="retentionBottomRow">
            {statsLoading ? (
              <span className="metricSkeleton" />
            ) : (
              <strong className="metricNumber tabular-nums">{stats?.retainedDays ?? 0} วัน</strong>
            )}
            <button
              type="button"
              className="retentionCleanupLink"
              onClick={handleOpenCleanupModal}
              title="จัดการล้างประวัติเก่าเกินเกณฑ์ 90 วันตามมาตรฐาน PDPA"
            >
              ล้างประวัติเกิน 90 วัน
            </button>
          </div>
        </div>
      </section>

      {/* 4. Unified Ledger Surface: Toolbar + Table */}
      <section className="ledgerSurface" aria-label="ตารางประวัติความปลอดภัย">
        {/* Toolbar */}
        <div className="ledgerToolbar">
          {/* Row 1: Action Type Tabs + Total Count */}
          <div className="toolbarTopRow">
            <div className="actionTabsScroll" role="tablist" aria-label="กรองประเภทกิจกรรม">
              {ACTION_TABS.map((tab) => {
                const isActive = actionType === tab.id
                return (
                  <button
                    key={tab.id || 'ALL'}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    title={tab.hint}
                    className={`actionTabBtn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActionType(tab.id)
                      setPage(1)
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div className="toolbarResultCount tabular-nums" aria-live="polite">
              พบข้อมูล <strong>{pagination.total.toLocaleString()}</strong> รายการ
            </div>
          </div>

          {/* Row 2: Live Search + Date Segmented Filter */}
          <form onSubmit={handleSearchSubmit} className="toolbarControlsRow">
            <div className="searchBoxWrapper">
              <label htmlFor="audit-search" className="srOnly">
                ค้นหาประวัติการใช้งาน
              </label>
              <Search size={17} className="searchInputIcon" aria-hidden="true" />
              <input
                id="audit-search"
                type="search"
                placeholder="ค้นหาชื่อผู้ใช้, อีเมล, หมายเลข IP, ตารางเป้าหมาย หรือรายละเอียด..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="searchClearBtn"
                  onClick={() => {
                    setSearch('')
                    setAppliedSearch('')
                    setPage(1)
                  }}
                  aria-label="ล้างคำค้นหา"
                  title="ล้างคำค้นหา"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
              <button type="submit" className="searchSubmitBtn">
                ค้นหารายการ
              </button>
            </div>

            <div className="dateControlGroup">
              <div className="dateSegmented" role="group" aria-label="กรองตามช่วงเวลา">
                {(
                  [
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'today', label: 'วันนี้' },
                    { id: '7days', label: '7 วัน' },
                    { id: '30days', label: '30 วัน' },
                    { id: 'custom', label: 'ระบุวันที่' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`segmentBtn ${activeDatePreset === preset.id ? 'active' : ''}`}
                    onClick={() => handleDatePresetChange(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Expandable Custom Date Picker Row */}
          {activeDatePreset === 'custom' && (
            <div className="customDateRow">
              <div className="dateFieldInline">
                <label htmlFor="start-date">ตั้งแต่วันที่</label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <div className="dateFieldInline">
                <label htmlFor="end-date">ถึงวันที่</label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>
          )}

          {/* Active Filter Bar (only visible when filtering) */}
          {hasActiveFilters && (
            <div className="activeFiltersBar">
              <div className="activePillsWrap">
                <span className="activeFiltersPrefix">ตัวกรองที่เลือก:</span>
                {appliedSearch && (
                  <span className="activeFilterPill">
                    คำค้น: &ldquo;{appliedSearch}&rdquo;
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setAppliedSearch('')
                        setPage(1)
                      }}
                      aria-label="ลบตัวกรองคำค้นหา"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </span>
                )}
                {actionType && (
                  <span className="activeFilterPill">
                    ประเภท: {actionType}
                    <button
                      type="button"
                      onClick={() => {
                        setActionType('')
                        setPage(1)
                      }}
                      aria-label="ลบตัวกรองประเภท"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </span>
                )}
                {(startDate || endDate) && (
                  <span className="activeFilterPill">
                    ช่วงวันที่: {startDate ? formatThaiDate(startDate) : 'เริ่มต้น'} –{' '}
                    {endDate ? formatThaiDate(endDate) : 'ปัจจุบัน'}
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate('')
                        setEndDate('')
                        setActiveDatePreset('all')
                        setPage(1)
                      }}
                      aria-label="ลบตัวกรองช่วงวันที่"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </span>
                )}
              </div>

              <button type="button" className="resetAllFiltersBtn" onClick={handleResetFilters}>
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          )}
        </div>

        {/* Table Content / States */}
        {loading ? (
          <div className="skeletonLedger" aria-busy="true" aria-label="กำลังโหลดรายการ">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="skeletonLedgerRow">
                <div className="skelBlock skelTime" />
                <div className="skelBlock skelUser" />
                <div className="skelBlock skelAction" />
                <div className="skelBlock skelDetail" />
                <div className="skelBlock skelNet" />
                <div className="skelBlock skelBtn" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="ledgerStateBox errorBox" role="alert">
            <h3>ไม่สามารถโหลดข้อมูลบันทึกความปลอดภัยได้</h3>
            <p>{error}</p>
            <button
              type="button"
              className="btnSecondary"
              onClick={() => fetchLogs(page, { search: appliedSearch, actionType, startDate, endDate })}
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>ลองใหม่อีกครั้ง</span>
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="ledgerStateBox emptyBox">
            {hasActiveFilters ? (
              <>
                <h3>
                  {appliedSearch
                    ? `ไม่พบข้อมูลที่ตรงกับคำว่า "${appliedSearch}"`
                    : 'ไม่พบบันทึกที่ตรงกับตัวกรองที่เลือก'}
                </h3>
                <p>ลองเปลี่ยนคำค้นหา ขยายช่วงเวลา หรือล้างตัวกรองเพื่อดูประวัติทั้งหมด</p>
                <button type="button" className="btnSecondary" onClick={handleResetFilters}>
                  ล้างตัวกรองทั้งหมด
                </button>
              </>
            ) : (
              <>
                <h3>ยังไม่มีบันทึกประวัติความปลอดภัยในระบบ</h3>
                <p>เมื่อมีการเข้าสู่ระบบหรือดำเนินงานเกี่ยวกับข้อมูลสำคัญ รายการจะปรากฏที่นี่โดยอัตโนมัติ</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Scannable Ledger Table */}
            <div className="desktopLedgerWrap">
              <table className="ledgerTable">
                <thead>
                  <tr>
                    <th scope="col" className="colTime">วัน-เวลา (พ.ศ.)</th>
                    <th scope="col" className="colActor">ผู้ใช้งาน</th>
                    <th scope="col" className="colType">ประเภท</th>
                    <th scope="col" className="colTarget">เป้าหมายและรายละเอียด</th>
                    <th scope="col" className="colNetwork">เครือข่าย / อุปกรณ์</th>
                    <th scope="col" className="colInspect">การตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const ts = formatSplitTimestamp(log.timestamp)
                    const relative = formatRelativeTime(log.timestamp)
                    const target = getTargetInfo(log.target_table, log.action_type)
                    const detailPreview = parseDetailsPayload(log.action_details).summary
                    const ua = parseUserAgent(log.user_agent)
                    const isLocal = isLocalIp(log.ip_address)
                    const isSelected = selectedLog?.id === log.id

                    return (
                      <tr
                        key={log.id}
                        className={`ledgerRow ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="cellTime">
                          <span className="datePrimary tabular-nums">{ts.datePart}</span>
                          <span className="timeSecondary tabular-nums">
                            {ts.timePart}
                            {relative ? ` · ${relative}` : ''}
                          </span>
                        </td>

                        <td className="cellActor">
                          {log.username ? (
                            <div className="actorStack">
                              <span className="actorName" title={log.username}>
                                {log.username}
                              </span>
                              {log.email && (
                                <span className="actorEmail" title={log.email}>
                                  {log.email}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="actorSystem">ระบบอัตโนมัติ / ไม่ระบุตัวตน</span>
                          )}
                        </td>

                        <td className="cellType">{getActionBadge(log.action_type)}</td>

                        <td className="cellTarget">
                          <div className="targetTitleLine">
                            <span className="targetLabelText">{target.label}</span>
                            {target.raw && <code className="targetCodeKey">{target.raw}</code>}
                          </div>
                          <p className="detailPreviewLine" title={detailPreview}>
                            {detailPreview}
                          </p>
                        </td>

                        <td className="cellNetwork">
                          <div className="ipLine">
                            <span className="ipAddressText tabular-nums">{log.ip_address || '—'}</span>
                            {isLocal && <span className="lanTag">LAN</span>}
                          </div>
                          <span
                            className="deviceSubLine"
                            title={`${ua.os} · ${ua.browser}`}
                          >
                            {ua.deviceModel || ua.os} · {ua.browser}
                          </span>
                        </td>

                        <td className="cellInspect" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="inspectRowBtn"
                            onClick={() => setSelectedLog(log)}
                            title="ดูข้อมูลเจาะลึกความปลอดภัย"
                            aria-label={`ดูบันทึก #${log.id}`}
                          >
                            ดูบันทึก
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Cards (< 860px) */}
            <div className="mobileLedgerList">
              {logs.map((log) => {
                const ts = formatSplitTimestamp(log.timestamp)
                const relative = formatRelativeTime(log.timestamp)
                const target = getTargetInfo(log.target_table, log.action_type)
                const detailPreview = parseDetailsPayload(log.action_details).summary
                const ua = parseUserAgent(log.user_agent)
                const isLocal = isLocalIp(log.ip_address)

                return (
                  <article key={log.id} className="mobileLedgerCard">
                    <div className="mobileCardHeader">
                      <div className="mobileBadgeId">
                        {getActionBadge(log.action_type)}
                        <span className="mobileEntryId tabular-nums">#{log.id}</span>
                      </div>
                      <div className="mobileTimestamp tabular-nums">
                        <span>{ts.datePart} {ts.timePart}</span>
                        {relative && <span className="mobileRelative">{relative}</span>}
                      </div>
                    </div>

                    <div className="mobileCardBody">
                      <div className="mobilePrimaryInfo">
                        <strong className="mobileTargetName">{target.label}</strong>
                        <p className="mobileDetailSnippet">{detailPreview}</p>
                      </div>

                      <dl className="mobileMetaList">
                        <div className="mobileMetaPair">
                          <dt>ผู้ใช้งาน</dt>
                          <dd>{log.username || 'ระบบอัตโนมัติ / ไม่ระบุตัวตน'}</dd>
                        </div>
                        <div className="mobileMetaPair">
                          <dt>เครือข่าย</dt>
                          <dd className="tabular-nums">
                            {log.ip_address || '—'} {isLocal ? '(LAN)' : ''}
                          </dd>
                        </div>
                        <div className="mobileMetaPair fullSpan">
                          <dt>อุปกรณ์</dt>
                          <dd>{ua.deviceModel || ua.os} · {ua.browser}</dd>
                        </div>
                      </dl>
                    </div>

                    <button
                      type="button"
                      className="mobileInspectBtn"
                      onClick={() => setSelectedLog(log)}
                    >
                      ดูรายละเอียดบันทึก
                    </button>
                  </article>
                )
              })}
            </div>

            {/* Pagination Footer */}
            <footer className="ledgerPagination">
              <div className="paginationSummary tabular-nums">
                แสดง <strong>{logs.length}</strong> รายการ (หน้า {page} จาก {pagination.totalPages || 1}) · ทั้งหมด{' '}
                <strong>{pagination.total.toLocaleString()}</strong> รายการ
              </div>

              <div className="paginationControls">
                <button
                  type="button"
                  className="pageNavBtn pageNavIconOnly"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(1)}
                  aria-label="หน้าแรก"
                  title="หน้าแรก"
                >
                  «
                </button>
                <button
                  type="button"
                  className="pageNavBtn"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  <span>ก่อนหน้า</span>
                </button>

                <span className="pageCurrentPill tabular-nums">
                  {page} / {pagination.totalPages || 1}
                </span>

                <button
                  type="button"
                  className="pageNavBtn"
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  <span>ถัดไป</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="pageNavBtn pageNavIconOnly"
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage(pagination.totalPages)}
                  aria-label="หน้าสุดท้าย"
                  title="หน้าสุดท้าย"
                >
                  »
                </button>
              </div>
            </footer>
          </>
        )}
      </section>

      {/* 5. Slide-Over Inspector Drawer */}
      {selectedLog && (
        <div
          className="drawerBackdrop"
          onClick={() => setSelectedLog(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspector-drawer-title"
        >
          <aside className="inspectorDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawerHeader">
              <div>
                <h2 id="inspector-drawer-title">รายละเอียดบันทึกความปลอดภัย</h2>
                <span className="drawerEntryMeta tabular-nums">
                  Audit Log Entry ID #{selectedLog.id}
                </span>
              </div>

              <div className="drawerHeaderTools">
                <div className="drawerStepGroup" role="group" aria-label="เลื่อนดูรายการก่อนหน้าและถัดไป">
                  <button
                    type="button"
                    className="drawerIconBtn"
                    disabled={selectedIndex <= 0}
                    onClick={() => selectedIndex > 0 && setSelectedLog(logs[selectedIndex - 1])}
                    title="รายการก่อนหน้า (ลูกศรขึ้น)"
                    aria-label="รายการก่อนหน้า"
                  >
                    <ChevronUp size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="drawerIconBtn"
                    disabled={selectedIndex < 0 || selectedIndex >= logs.length - 1}
                    onClick={() =>
                      selectedIndex >= 0 &&
                      selectedIndex < logs.length - 1 &&
                      setSelectedLog(logs[selectedIndex + 1])
                    }
                    title="รายการถัดไป (ลูกศรลง)"
                    aria-label="รายการถัดไป"
                  >
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  className="drawerCloseBtn"
                  onClick={() => setSelectedLog(null)}
                  aria-label="ปิดหน้าต่าง"
                  title="ปิดหน้าต่าง (Esc)"
                >
                  <X size={19} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="drawerBody">
              {/* Primary Telemetry Strip */}
              <div className="drawerTelemetryStrip">
                <div className="telemetryCell">
                  <span className="telemetryLabel">ประเภทกิจกรรม</span>
                  <div>{getActionBadge(selectedLog.action_type)}</div>
                </div>
                <div className="telemetryCell">
                  <span className="telemetryLabel">วัน-เวลาบันทึก (พ.ศ.)</span>
                  <strong className="telemetryValue tabular-nums">
                    {formatSplitTimestamp(selectedLog.timestamp).full}
                  </strong>
                </div>
              </div>

              {/* Metadata Specification Table */}
              <section className="drawerSection">
                <h3 className="drawerSectionTitle">ข้อมูลผู้กระทำและเป้าหมาย</h3>
                <dl className="specList">
                  <div className="specRow">
                    <dt>บัญชีผู้ใช้งาน</dt>
                    <dd className="specValueWithAction">
                      <span>
                        {selectedLog.username
                          ? `${selectedLog.username}${selectedLog.email ? ` (${selectedLog.email})` : ''}`
                          : 'ระบบอัตโนมัติ / ไม่ได้เข้าสู่ระบบ'}
                      </span>
                      {selectedLog.username && (
                        <button
                          type="button"
                          className="inlineCopyBtn"
                          onClick={() => copyToClipboard(selectedLog.username!, 'actor', 'ชื่อผู้ใช้')}
                        >
                          {copiedField === 'actor' ? <Check size={13} /> : <Copy size={13} />}
                          <span>คัดลอก</span>
                        </button>
                      )}
                    </dd>
                  </div>

                  <div className="specRow">
                    <dt>เป้าหมายที่เข้าถึง</dt>
                    <dd>
                      <span className="specStrong">
                        {getTargetInfo(selectedLog.target_table, selectedLog.action_type).label}
                      </span>
                      {selectedLog.target_table && (
                        <code className="targetCodeKey">{selectedLog.target_table}</code>
                      )}
                    </dd>
                  </div>

                  <div className="specRow">
                    <dt>หมายเลข IP</dt>
                    <dd className="specValueWithAction">
                      <span className="tabular-nums">
                        {selectedLog.ip_address || 'ไม่ระบุ'}
                        {isLocalIp(selectedLog.ip_address) && (
                          <span className="lanTag inlineLan">เครือข่ายภายใน รพ. (LAN)</span>
                        )}
                      </span>
                      {selectedLog.ip_address && (
                        <button
                          type="button"
                          className="inlineCopyBtn"
                          onClick={() => copyToClipboard(selectedLog.ip_address!, 'ip', 'หมายเลข IP')}
                        >
                          {copiedField === 'ip' ? <Check size={13} /> : <Copy size={13} />}
                          <span>คัดลอก</span>
                        </button>
                      )}
                    </dd>
                  </div>

                  <div className="specRow">
                    <dt>อุปกรณ์และเบราว์เซอร์</dt>
                    <dd>
                      {(() => {
                        const p = parseUserAgent(selectedLog.user_agent)
                        const typeLabel =
                          p.deviceType === 'desktop'
                            ? 'คอมพิวเตอร์'
                            : p.deviceType === 'mobile'
                            ? `มือถือ (${p.deviceModel || 'Smartphone'})`
                            : p.deviceType === 'tablet'
                            ? `แท็บเล็ต (${p.deviceModel || 'Tablet'})`
                            : p.deviceType === 'bot'
                            ? 'สคริปต์อัตโนมัติ'
                            : 'ไม่ทราบประเภท'
                        return `${typeLabel} · ${p.os} · ${p.browser}`
                      })()}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Structured Action Details */}
              <section className="drawerSection">
                <div className="drawerSectionHeader">
                  <h3 className="drawerSectionTitle">รายละเอียดการปฏิบัติงาน (Action Details)</h3>
                  {selectedLog.action_details && (
                    <button
                      type="button"
                      className="inlineCopyBtn"
                      onClick={() =>
                        copyToClipboard(
                          selectedDetails?.prettyJson || selectedLog.action_details!,
                          'details',
                          'รายละเอียดการปฏิบัติงาน'
                        )
                      }
                    >
                      {copiedField === 'details' ? <Check size={13} /> : <Copy size={13} />}
                      <span>คัดลอกข้อมูล</span>
                    </button>
                  )}
                </div>

                {selectedDetails?.entries && selectedDetails.entries.length > 0 && (
                  <div className="structuredPayloadBox">
                    {selectedDetails.entries.map((entry) => (
                      <div key={entry.key} className="payloadEntryRow">
                        <span className="payloadKey">{entry.key}</span>
                        <span className="payloadVal">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <pre className="rawPayloadPre">
                  {selectedDetails?.prettyJson || selectedLog.action_details || 'ไม่มีรายละเอียดเพิ่มเติม'}
                </pre>
              </section>

              {/* User-Agent String */}
              <section className="drawerSection">
                <div className="drawerSectionHeader">
                  <h3 className="drawerSectionTitle">ข้อมูล User-Agent แบบเต็ม</h3>
                  {selectedLog.user_agent && (
                    <button
                      type="button"
                      className="inlineCopyBtn"
                      onClick={() => copyToClipboard(selectedLog.user_agent!, 'ua', 'ข้อมูล User-Agent')}
                    >
                      {copiedField === 'ua' ? <Check size={13} /> : <Copy size={13} />}
                      <span>คัดลอก</span>
                    </button>
                  )}
                </div>
                <pre className="rawPayloadPre uaPre">
                  {selectedLog.user_agent || 'ไม่มีข้อมูล User-Agent'}
                </pre>
              </section>
            </div>

            <div className="drawerFooter">
              <button type="button" className="btnSecondary fullWidthMobile" onClick={() => setSelectedLog(null)}>
                ปิดหน้าต่างรายละเอียด
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 6. PDPA Retention Cleanup Confirmation Modal */}
      {cleanupModalOpen && (
        <div
          className="modalBackdrop"
          onClick={() => !cleanupLoading && setCleanupModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cleanup-modal-title"
        >
          <div className="confirmModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="confirmModalHeader">
              <div>
                <h2 id="cleanup-modal-title">ยืนยันการล้างประวัติเก่าเกิน 90 วัน</h2>
                <span className="confirmModalSub">
                  ตามเกณฑ์การจัดเก็บข้อมูล พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
                </span>
              </div>
              <button
                type="button"
                className="drawerCloseBtn"
                onClick={() => !cleanupLoading && setCleanupModalOpen(false)}
                disabled={cleanupLoading}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="confirmModalBody">
              <p className="confirmLeadText">
                ระบบจะลบรายการในตาราง <code>audit_logs</code> ที่มีอายุเกินกว่า <strong>90 วัน</strong>{' '}
                ออกจากฐานข้อมูลอย่างถาวร
              </p>

              <div className="expiredSummaryBox">
                <span className="expiredLabel">รายการที่เข้าเกณฑ์ถูกลบ</span>
                <strong className="expiredValue tabular-nums">
                  {cleanupChecking ? (
                    <span className="metricSkeleton" />
                  ) : expiredCount !== null ? (
                    `${expiredCount.toLocaleString()} รายการ`
                  ) : (
                    'กำลังตรวจสอบ...'
                  )}
                </strong>
              </div>

              <p className="confirmFootnote">
                การดำเนินการนี้ไม่สามารถย้อนกลับได้ และระบบจะบันทึกเหตุการณ์การล้างข้อมูลนี้ลงใน Audit Log โดยอัตโนมัติ
              </p>
            </div>

            <div className="confirmModalFooter">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => setCleanupModalOpen(false)}
                disabled={cleanupLoading}
              >
                ยกเลิกคำขอ
              </button>
              <button
                type="button"
                className="btnDanger"
                onClick={handleExecuteCleanup}
                disabled={cleanupLoading || cleanupChecking || expiredCount === 0}
              >
                {cleanupLoading ? (
                  <>
                    <RefreshCw size={15} className="spinIcon" aria-hidden="true" />
                    <span>กำลังล้างข้อมูล...</span>
                  </>
                ) : (
                  <span>ยืนยันการล้างข้อมูล</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
