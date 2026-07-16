'use client'

import { useState, useEffect } from 'react'
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
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

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

export default function AuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [search, setSearch] = useState('')
  const [actionType, setActionType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  })

  // Selected Log for details modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const fetchLogs = async (currentPage = page) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('page', currentPage.toString())
      params.append('limit', '25')
      if (search) params.append('search', search)
      if (actionType) params.append('actionType', actionType)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setLogs(data.logs || [])
        setPagination(data.pagination)
      } else {
        setError(data.error || 'ไม่สามารถดึงข้อมูลประวัติการใช้งานได้')
      }
    } catch (err) {
      console.error(err)
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  // Trigger fetch on filters or page change
  useEffect(() => {
    fetchLogs(page)
  }, [page, actionType])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchLogs(1)
  }

  const handleResetFilters = () => {
    setSearch('')
    setActionType('')
    setStartDate('')
    setEndDate('')
    setPage(1)
    // Fetch directly after resetting states
    setTimeout(() => {
      fetchLogs(1)
    }, 0)
  }

  const getActionBadge = (type: string) => {
    switch (type.toUpperCase()) {
      case 'LOGIN':
        return (
          <span className="logBadge badgeLogin">
            <LogIn size={12} style={{ marginRight: '4px' }} />
            LOGIN
          </span>
        )
      case 'LOGOUT':
        return (
          <span className="logBadge badgeLogout">
            <LogOut size={12} style={{ marginRight: '4px' }} />
            LOGOUT
          </span>
        )
      case 'CREATE':
        return (
          <span className="logBadge badgeCreate">
            <Database size={12} style={{ marginRight: '4px' }} />
            CREATE
          </span>
        )
      case 'UPDATE':
        return (
          <span className="logBadge badgeUpdate">
            <Database size={12} style={{ marginRight: '4px' }} />
            UPDATE
          </span>
        )
      case 'DELETE':
        return (
          <span className="logBadge badgeDelete">
            <Database size={12} style={{ marginRight: '4px' }} />
            DELETE
          </span>
        )
      case 'REQUEST':
        return (
          <span className="logBadge badgeRequest">
            <Globe size={12} style={{ marginRight: '4px' }} />
            REQUEST
          </span>
        )
      case 'SYSTEM':
        return (
          <span className="logBadge badgeSystem">
            <Settings size={12} style={{ marginRight: '4px' }} />
            SYSTEM
          </span>
        )
      default:
        return <span className="logBadge badgeDefault">{type}</span>
    }
  }

  const getTargetTableName = (table: string | null) => {
    if (!table) return '-'
    switch (table.toLowerCase()) {
      case 'members': return 'ข้อมูลสมาชิก (members)'
      case 'pr_requests': return 'คำขอผลิตสื่อ PR (pr_requests)'
      case 'approval_tickets': return 'งานรออนุมัติ (approval_tickets)'
      case 'work_requests': return 'ใบงานช่าง (work_requests)'
      case 'ita_blogs': return 'บทความ ITA (ita_blogs)'
      case 'member_system_settings': return 'ตั้งค่าระบบ (settings)'
      case 'position_permissions': return 'ตั้งค่าสิทธิ์ (permissions)'
      default: return table
    }
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

  return (
    <>
      {/* Header */}
      <div className="auditHeader">
        <div className="backBtnWrapper">
          <Link href="/member" className="backBtn">
            <ArrowLeft size={16} />
            <span>กลับไปแดชบอร์ด</span>
          </Link>
        </div>
        <div className="titleWrapper">
          <div className="titleIcon">
            <Settings size={28} />
          </div>
          <div>
            <h1>ระบบประวัติการใช้งาน (Audit Logs)</h1>
            <p className="subtitle">ประวัติบันทึกการเข้าสู่ระบบ, การดำเนินการฐานข้อมูล (CRUD) และการเข้าถึง API ทั้งหมดเพื่อความปลอดภัย</p>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="filterCard">
        <form onSubmit={handleSearchSubmit} className="filterForm">
          <div className="filterGrid">
            {/* Search Input */}
            <div className="filterField flex-2">
              <label>ค้นหาข้อความ</label>
              <div className="inputWrapper">
                <Search size={18} className="searchIcon" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อผู้ใช้, อีเมล, คำสั่ง SQL, IP..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Action Type Dropdown */}
            <div className="filterField">
              <label>ประเภทรายการ</label>
              <select
                value={actionType}
                onChange={(e) => {
                  setActionType(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">ทั้งหมด (All)</option>
                <option value="LOGIN">LOGIN (เข้าสู่ระบบ)</option>
                <option value="LOGOUT">LOGOUT (ออกจากระบบ)</option>
                <option value="CREATE">CREATE (เพิ่มข้อมูล)</option>
                <option value="UPDATE">UPDATE (แก้ไขข้อมูล)</option>
                <option value="DELETE">DELETE (ลบข้อมูล)</option>
                <option value="REQUEST">REQUEST (เข้าชมหน้า/API)</option>
                <option value="SYSTEM">SYSTEM (ตั้งค่าระบบ)</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="filterField">
              <label>วันที่เริ่มต้น</label>
              <div className="inputWrapper">
                <Calendar size={18} className="dateIcon" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            {/* End Date */}
            <div className="filterField">
              <label>วันที่สิ้นสุด</label>
              <div className="inputWrapper">
                <Calendar size={18} className="dateIcon" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="filterActions">
            <button type="submit" className="btnPrimary" disabled={loading}>
              <Search size={16} />
              <span>ค้นหา</span>
            </button>
            <button type="button" className="btnSecondary" onClick={handleResetFilters} disabled={loading}>
              <RefreshCw size={16} />
              <span>ล้างตัวกรอง</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main logs view */}
      <div className="logsContainer">
        {loading ? (
          <div className="loadingState">
            <RefreshCw className="animate-spin" size={32} />
            <p>กำลังโหลดประวัติการใช้งาน...</p>
          </div>
        ) : error ? (
          <div className="errorState">
            <AlertCircle size={32} />
            <p>{error}</p>
            <button onClick={() => fetchLogs()} className="btnRetry">ลองใหม่อีกครั้ง</button>
          </div>
        ) : logs.length === 0 ? (
          <div className="emptyState">
            <AlertCircle size={32} />
            <p>ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหาของคุณ</p>
          </div>
        ) : (
          <>
            <div className="tableWrapper">
              <table className="logsTable">
                <thead>
                  <tr>
                    <th>วัน-เวลา</th>
                    <th>ผู้ใช้งาน (User)</th>
                    <th>ประเภท</th>
                    <th>ตาราง/หน้า (Target)</th>
                    <th>IP Address</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="logRow">
                      <td className="timeCell">{formatDate(log.timestamp)}</td>
                      <td className="userCell">
                        {log.username ? (
                          <div className="userDetails">
                            <span className="usernameText">{log.username}</span>
                            {log.email && <span className="emailText">{log.email}</span>}
                          </div>
                        ) : (
                          <span className="guestText">Guest/System</span>
                        )}
                      </td>
                      <td>{getActionBadge(log.action_type)}</td>
                      <td className="targetCell">
                        <span className="targetBadge" title={log.target_table || ''}>
                          {getTargetTableName(log.target_table)}
                        </span>
                      </td>
                      <td className="ipCell">{log.ip_address || '-'}</td>
                      <td>
                        <button 
                          className="viewDetailBtn"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye size={14} />
                          <span>รายละเอียด</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <div className="paginationInfo">
                แสดงผล <span>{logs.length}</span> รายการ จากทั้งหมด <span>{pagination.total}</span> รายการ
              </div>
              <div className="paginationBtns">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => prev - 1)}
                  className="pageBtn"
                >
                  <ChevronLeft size={16} />
                  <span>ก่อนหน้า</span>
                </button>
                <div className="pageIndicator">
                  หน้า {page} จาก {pagination.totalPages || 1}
                </div>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="pageBtn"
                >
                  <span>ถัดไป</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="modalOverlay" onClick={() => setSelectedLog(null)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>รายละเอียดประวัติความปลอดภัย</h3>
              <button className="closeBtn" onClick={() => setSelectedLog(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modalBody">
              <div className="detailGrid">
                <div className="detailItem">
                  <span className="detailLabel">วัน-เวลา (Timestamp)</span>
                  <span className="detailValue">{formatDate(selectedLog.timestamp)}</span>
                </div>
                <div className="detailItem">
                  <span className="detailLabel">ผู้ใช้ระบบ (Account)</span>
                  <span className="detailValue">
                    {selectedLog.username ? `${selectedLog.username} (${selectedLog.email})` : 'ไม่ได้เข้าสู่ระบบ (Guest / System)'}
                  </span>
                </div>
                <div className="detailItem">
                  <span className="detailLabel">ประเภทการทำงาน</span>
                  <span className="detailValue">{getActionBadge(selectedLog.action_type)}</span>
                </div>
                <div className="detailItem">
                  <span className="detailLabel">เป้าหมาย (Target/Table)</span>
                  <span className="detailValue code">{selectedLog.target_table || '-'}</span>
                </div>
                <div className="detailItem">
                  <span className="detailLabel">หมายเลข IP Address</span>
                  <span className="detailValue code">{selectedLog.ip_address || '-'}</span>
                </div>
                <div className="detailItem">
                  <span className="detailLabel">อุปกรณ์/เบราว์เซอร์ (User-Agent)</span>
                  <span className="detailValue userAgentText">{selectedLog.user_agent || '-'}</span>
                </div>
              </div>

              <div className="detailDetails">
                <div className="detailDetailsHeader">
                  <FileCode size={16} />
                  <span>ข้อมูลดิบ / คำสั่งเชิงเทคนิค (Details)</span>
                </div>
                <pre className="detailDetailsContent">
                  <code>{selectedLog.action_details || 'ไม่มีข้อมูลเพิ่มเติม'}</code>
                </pre>
              </div>
            </div>
            
            <div className="modalFooter">
              <button className="btnSecondary" onClick={() => setSelectedLog(null)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
