'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  UserPlus, 
  Edit3, 
  Trash2, 
  Mail, 
  Shield, 
  User, 
  X, 
  Check, 
  Loader2, 
  AlertCircle, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  RefreshCw,
  ArrowLeft,
  Building2,
  KeyRound
} from 'lucide-react'
import Link from 'next/link'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import './page.css'

interface Member {
  id: number
  username: string
  email: string
  name: string | null
  department: string | null
  position: string | null
  salary_user: string | null
  salary_pass: string | null
  role: 'member' | 'admin' | 'subdistrict'
  created_at: string
  updated_at: string
}

export default function MembersAdminClient() {
  const [members, setMembers] = useState<Member[]>([])
  const [currentUser, setCurrentUser] = useState<{ username: string; email: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'member' | 'admin' | 'subdistrict'>('all')

  // Sort State
  const [sortField, setSortField] = useState<'id' | 'username' | 'email' | 'name' | 'department' | 'role'>('id')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  
  // Confirmation states
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; username: string; name: string | null } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form Fields
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [position, setPosition] = useState('')
  const [salaryUser, setSalaryUser] = useState('')
  const [salaryPass, setSalaryPass] = useState('')
  const [role, setRole] = useState<'member' | 'admin' | 'subdistrict'>('member')
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const handleSyncSalary = async () => {
    setSyncing(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/member/sync-salary', {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const msg = `ซิงค์ข้อมูลเรียบร้อย: อัปเดตสำเร็จ ${data.stats?.matchedCount || 0} รายการ`
        setSuccess(msg)
        addToast(msg, 'success')
        fetchMembers()
      } else {
        const err = data.error || 'การซิงค์ข้อมูลล้มเหลว'
        setError(err)
        addToast(err, 'error')
      }
    } catch {
      const err = 'เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อซิงค์ข้อมูล'
      setError(err)
      addToast(err, 'error')
    } finally {
      setSyncing(false)
      setConfirmSyncOpen(false)
    }
  }

  const checkCurrentUser = async () => {
    try {
      const res = await fetch('/api/member/me')
      const data = await res.json()
      if (res.ok && data.authenticated) {
        setCurrentUser(data.member)
      }
    } catch (err) {
      console.error('Failed to load current logged-in member:', err)
    }
  }

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/member')
      const data = await res.json()
      if (res.ok) {
        setMembers(data.members || [])
      } else {
        setError(data.error || 'ไม่สามารถดึงข้อมูลสมาชิกได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      checkCurrentUser()
      fetchMembers()
    })
  }, [])

  const handleCreateClick = () => {
    setIsCreateMode(true)
    setEditingMember(null)
    setUsername('')
    setEmail('')
    setName('')
    setDepartment('')
    setPosition('')
    setSalaryUser('')
    setSalaryPass('')
    setRole('member')
    setModalError('')
    setIsModalOpen(true)
  }

  const handleEditClick = (member: Member) => {
    setIsCreateMode(false)
    setEditingMember(member)
    setUsername(member.username)
    setEmail(member.email)
    setName(member.name || '')
    setDepartment(member.department || '')
    setPosition(member.position || '')
    setSalaryUser(member.salary_user || '')
    setSalaryPass(member.salary_pass || '')
    setRole(member.role)
    setModalError('')
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setModalError('')
    setSuccess('')

    const payload = {
      username: username.trim(),
      email: email.trim(),
      name: name.trim() || null,
      department: department.trim() || null,
      position: position.trim() || null,
      salary_user: salaryUser.trim() || null,
      salary_pass: salaryPass ? salaryPass.trim() : null,
      role,
    }

    try {
      let res
      if (isCreateMode) {
        res = await fetch('/api/member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        if (!editingMember) return
        res = await fetch('/api/member', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingMember.id, ...payload }),
        })
      }

      const data = await res.json()

      if (res.ok) {
        const msg = isCreateMode ? 'เพิ่มสมาชิกใหม่เรียบร้อยแล้ว' : 'อัปเดตข้อมูลสมาชิกสำเร็จ'
        setSuccess(msg)
        addToast(msg, 'success')
        setIsModalOpen(false)
        fetchMembers()
      } else {
        setModalError(data.error || 'ดำเนินการไม่สำเร็จ')
      }
    } catch {
      setModalError('เกิดข้อผิดพลาดทางเทคนิคในการส่งข้อมูล')
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (member: Member) => {
    if (currentUser && member.username === currentUser.username) {
      setError('คุณไม่สามารถลบบัญชีของตัวเองได้')
      addToast('คุณไม่สามารถลบบัญชีของตัวเองได้', 'warning')
      return
    }
    setDeleteTarget({ id: member.id, username: member.username, name: member.name })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const { id, username } = deleteTarget
    setDeleting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/member?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        const msg = `ลบสมาชิก "${username}" ออกจากระบบเรียบร้อยแล้ว`
        setSuccess(msg)
        addToast(msg, 'success')
        setMembers((prev) => prev.filter((m) => m.id !== id))
      } else {
        const err = data.error || 'ลบไม่สำเร็จ'
        setError(err)
        addToast(err, 'error')
      }
    } catch {
      const err = 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ'
      setError(err)
      addToast(err, 'error')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // Filtered members list
  const filteredMembers = members.filter((member) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      member.username.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q) ||
      (member.name && member.name.toLowerCase().includes(q)) ||
      (member.department && member.department.toLowerCase().includes(q)) ||
      (member.position && member.position.toLowerCase().includes(q))
    const matchesRole = roleFilter === 'all' || member.role === roleFilter
    return matchesSearch && matchesRole
  })

  // Sort function
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sorted members list
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]

    if (aVal === null || aVal === undefined) aVal = ''
    if (bVal === null || bVal === undefined) bVal = ''

    if (typeof aVal === 'string') aVal = aVal.toLowerCase()
    if (typeof bVal === 'string') bVal = bVal.toLowerCase()

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const renderSortIcon = (field: typeof sortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} className="sortIcon sortIconInactive" />
    }
    return sortDirection === 'asc' ? 
      <ArrowUp size={13} className="sortIcon sortIconActive" /> : 
      <ArrowDown size={13} className="sortIcon sortIconActive" />
  }

  return (
    <div className="membersDashboardPage">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="glowOrb glowOrb3"></div>

      <div className="container">
        {/* Header Bar */}
        <header className="pageHeader">
          <div className="pageHeaderTop">
            <Link href="/member" className="backLinkBtn">
              <ArrowLeft size={16} />
              <span>กลับสู่แดชบอร์ด</span>
            </Link>

            <div className="headerActions">
              <button 
                className="syncSalaryBtn" 
                onClick={() => setConfirmSyncOpen(true)} 
                disabled={syncing} 
                type="button"
                title="ซิงค์ข้อมูลสลิปเงินเดือนอัตโนมัติจากฐานข้อมูลเงินเดือน"
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลเงินเดือน'}</span>
              </button>

              <button 
                className="addMemberBtn" 
                onClick={handleCreateClick} 
                type="button"
              >
                <UserPlus size={16} />
                <span>เพิ่มสมาชิกใหม่</span>
              </button>
            </div>
          </div>

          <div className="headerText">
            <div className="titleWithBadge">
              <h1>ระบบจัดการสมาชิกและบุคลากร</h1>
              <span className="totalBadge">{members.length} บัญชี</span>
            </div>
            <p>
              จัดการรายชื่อบุคลากร สิทธิ์การใช้งานระบบ และบัญชีเชื่อมต่อสลิปเงินเดือนโรงพยาบาลเถิน
            </p>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="statsGrid" aria-label="สรุปจำนวนสมาชิก">
          <div className="statCard total">
            <div className="statCardInfo">
              <span className="statLabel">บุคลากรทั้งหมด</span>
              <span className="statValue">{members.length} คน</span>
            </div>
            <div className="statCardIcon total">
              <User size={22} />
            </div>
          </div>

          <div className="statCard admins">
            <div className="statCardInfo">
              <span className="statLabel">ผู้ดูแลระบบ (Admin)</span>
              <span className="statValue">{members.filter(m => m.role === 'admin').length} คน</span>
            </div>
            <div className="statCardIcon admins">
              <Shield size={22} />
            </div>
          </div>

          <div className="statCard general">
            <div className="statCardInfo">
              <span className="statLabel">สมาชิกทั่วไป (Member)</span>
              <span className="statValue">{members.filter(m => m.role === 'member').length} คน</span>
            </div>
            <div className="statCardIcon general">
              <User size={22} />
            </div>
          </div>

          <div className="statCard subdistrict">
            <div className="statCardInfo">
              <span className="statLabel">รพ.สต. ในเครือข่าย</span>
              <span className="statValue">{members.filter(m => m.role === 'subdistrict').length} คน</span>
            </div>
            <div className="statCardIcon subdistrict">
              <Building2 size={22} />
            </div>
          </div>
        </section>

        {error && (
          <div className="dashboardAlert alertDanger">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button type="button" className="alertCloseBtn" onClick={() => setError('')}><X size={14} /></button>
          </div>
        )}
        {success && (
          <div className="dashboardAlert alertSuccess">
            <Check size={18} />
            <span>{success}</span>
            <button type="button" className="alertCloseBtn" onClick={() => setSuccess('')}><X size={14} /></button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <section className="actionPanel" aria-label="ค้นหาและกรองข้อมูล">
          <div className="searchWrapper">
            <Search size={18} className="searchIcon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ-นามสกุล, ชื่อผู้ใช้, อีเมล, แผนก หรือตำแหน่ง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                className="clearSearchBtn" 
                onClick={() => setSearchQuery('')}
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filterGroup">
            <button
              type="button"
              className={`filterTab ${roleFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRoleFilter('all')}
            >
              ทั้งหมด <span className="filterCount">{members.length}</span>
            </button>
            <button
              type="button"
              className={`filterTab ${roleFilter === 'member' ? 'active' : ''}`}
              onClick={() => setRoleFilter('member')}
            >
              ทั่วไป <span className="filterCount">{members.filter(m => m.role === 'member').length}</span>
            </button>
            <button
              type="button"
              className={`filterTab ${roleFilter === 'subdistrict' ? 'active' : ''}`}
              onClick={() => setRoleFilter('subdistrict')}
            >
              รพ.สต. <span className="filterCount">{members.filter(m => m.role === 'subdistrict').length}</span>
            </button>
            <button
              type="button"
              className={`filterTab ${roleFilter === 'admin' ? 'active' : ''}`}
              onClick={() => setRoleFilter('admin')}
            >
              แอดมิน <span className="filterCount">{members.filter(m => m.role === 'admin').length}</span>
            </button>
          </div>
        </section>

        {/* Main Content Area - Locked Layout (No Horizontal Scroll) */}
        {loading ? (
          <div className="loadingContainer card">
            <Loader2 size={36} className="spinner" />
            <p>กำลังโหลดรายชื่อสมาชิก...</p>
          </div>
        ) : sortedMembers.length > 0 ? (
          <div className="tableCard">
            {/* Desktop Table View - Exactly fitted to 100% width, no horizontal scroll */}
            <div className="desktopTableContainer">
              <table className="membersTable">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('id')} className="sortableHeader col-id">
                      <div className="headerFlex"># {renderSortIcon('id')}</div>
                    </th>
                    <th onClick={() => handleSort('name')} className="sortableHeader col-member">
                      <div className="headerFlex">บุคลากร {renderSortIcon('name')}</div>
                    </th>
                    <th onClick={() => handleSort('username')} className="sortableHeader col-account">
                      <div className="headerFlex">บัญชี / อีเมล {renderSortIcon('username')}</div>
                    </th>
                    <th onClick={() => handleSort('department')} className="sortableHeader col-dept">
                      <div className="headerFlex">กลุ่มงาน / แผนก {renderSortIcon('department')}</div>
                    </th>
                    <th onClick={() => handleSort('role')} className="sortableHeader col-role">
                      <div className="headerFlex">สิทธิ์ {renderSortIcon('role')}</div>
                    </th>
                    <th className="col-actions">การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member, index) => {
                    const isSelf = currentUser && member.username === currentUser.username;

                    return (
                      <tr key={member.id} className={isSelf ? 'rowSelf' : ''}>
                        {/* 1. Index Number */}
                        <td className="col-id">
                          <span className="indexBadge">{index + 1}</span>
                        </td>

                        {/* 2. Staff Name & Position (Text-only display) */}
                        <td className="col-member">
                          <div className="memberDetails">
                            <div className="memberNameRow">
                              <span className="memberName">{member.name || member.username}</span>
                              {isSelf && <span className="selfTag">คุณ</span>}
                            </div>
                            <span className="memberPosition">
                              {member.position || 'บุคลากรทั่วไป'}
                            </span>
                          </div>
                        </td>

                        {/* 3. Username & Email */}
                        <td className="col-account">
                          <div className="accountCell">
                            <div className="accountUsername">
                              <User size={13} className="accountIcon" />
                              <span className="truncate">{member.username}</span>
                            </div>
                            <div className="accountEmail">
                              <Mail size={13} className="accountIcon" />
                              <span className="truncate">{member.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* 4. Department */}
                        <td className="col-dept">
                          <span className="deptText truncate" title={member.department || '-'}>
                            {member.department || '-'}
                          </span>
                        </td>

                        {/* 5. Role Badge */}
                        <td className="col-role">
                          <span className={`roleBadge ${member.role}`}>
                            {member.role === 'admin' ? 'แอดมิน' : member.role === 'subdistrict' ? 'รพ.สต.' : 'ทั่วไป'}
                          </span>
                        </td>

                        {/* 6. Edit & Delete Action Buttons */}
                        <td className="col-actions">
                          <div className="memberActions">
                            <button
                              className="actionBtn editBtn"
                              title="แก้ไขข้อมูลสมาชิก"
                              onClick={() => handleEditClick(member)}
                              type="button"
                            >
                              <Edit3 size={14} />
                              <span className="btnText">แก้ไข</span>
                            </button>
                            <button
                              className="actionBtn deleteBtn"
                              title={isSelf ? "ไม่สามารถลบบัญชีตนเองได้" : "ลบสมาชิก"}
                              disabled={!!isSelf}
                              onClick={() => requestDelete(member)}
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Card View - Zero Horizontal Scroll */}
            <div className="mobileCardsContainer">
              {sortedMembers.map((member) => {
                const isSelf = currentUser && member.username === currentUser.username;

                return (
                  <div key={member.id} className={`memberCardItem ${isSelf ? 'cardSelf' : ''}`}>
                    <div className="cardTopRow">
                      <div className="cardProfileInfo">
                        <div className="cardNameRow">
                          <span className="cardMemberName">{member.name || member.username}</span>
                          {isSelf && <span className="selfTag">คุณ</span>}
                        </div>
                        <span className="cardPositionText">{member.position || 'บุคลากรทั่วไป'}</span>
                      </div>

                      <span className={`roleBadge ${member.role}`}>
                        {member.role === 'admin' ? 'แอดมิน' : member.role === 'subdistrict' ? 'รพ.สต.' : 'ทั่วไป'}
                      </span>
                    </div>

                    <div className="cardDetailsGrid">
                      <div className="cardDetailRow">
                        <span className="cardDetailLabel">ชื่อผู้ใช้:</span>
                        <span className="cardDetailValue">{member.username}</span>
                      </div>
                      <div className="cardDetailRow">
                        <span className="cardDetailLabel">อีเมล:</span>
                        <span className="cardDetailValue truncate">{member.email}</span>
                      </div>
                      {member.department && (
                        <div className="cardDetailRow">
                          <span className="cardDetailLabel">กลุ่มงาน:</span>
                          <span className="cardDetailValue truncate">{member.department}</span>
                        </div>
                      )}
                    </div>

                    <div className="cardActionRow">
                      <button
                        className="mobileEditBtn"
                        onClick={() => handleEditClick(member)}
                        type="button"
                      >
                        <Edit3 size={15} />
                        <span>แก้ไขข้อมูล</span>
                      </button>

                      <button
                        className="mobileDeleteBtn"
                        disabled={!!isSelf}
                        onClick={() => requestDelete(member)}
                        type="button"
                        title={isSelf ? "ไม่สามารถลบบัญชีตนเองได้" : "ลบสมาชิก"}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="emptyState card">
            <User size={48} className="emptyIcon" />
            <h3>ไม่พบข้อมูลสมาชิก</h3>
            <p>ไม่พบรายชื่อผู้ใช้ที่ตรงกับคำค้นหา &ldquo;{searchQuery}&rdquo;</p>
            {searchQuery && (
              <button 
                type="button" 
                className="clearFilterBtn"
                onClick={() => { setSearchQuery(''); setRoleFilter('all'); }}
              >
                <RefreshCw size={14} />
                <span>ล้างคำค้นหาทั้งหมด</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit/Create Modal Dialog */}
      {isModalOpen && (
        <div className="modalOverlay" onClick={() => setIsModalOpen(false)}>
          <div className="modalCard premiumModal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="headerIconContainer">
                {isCreateMode ? <UserPlus size={20} /> : <Edit3 size={20} />}
              </div>
              <div className="modalHeaderTitles">
                <h2>{isCreateMode ? 'เพิ่มสมาชิกใหม่เข้าระบบ' : `แก้ไขข้อมูลสมาชิก: ${editingMember?.name || editingMember?.username}`}</h2>
                <p className="headerSubtitle">
                  {isCreateMode ? 'กรอกรายละเอียดเพื่อลงทะเบียนบุคลากรใหม่' : `รหัสสมาชิก #${editingMember?.id} • ปรับปรุงข้อมูลบัญชีและสิทธิ์`}
                </p>
              </div>
              <button 
                className="closeBtn" 
                onClick={() => setIsModalOpen(false)}
                type="button"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="modalAlert alertDanger flexItems">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="modalForm">
              <div className="modalBody compactModalBody">
                <div className="modalFormGrid">
                  {/* Personal & Hospital Info */}
                  <div className="modalSubSectionHeader col-span-2">
                    <User size={14} />
                    <span>ข้อมูลส่วนบุคคลและสังกัดงาน</span>
                  </div>

                  <div className="formGroup">
                    <label>ชื่อ-นามสกุล *</label>
                    <div className="inputWrapper">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="เช่น นาย สมชาย ใจดี"
                        required
                      />
                    </div>
                  </div>

                  <div className="formGroup">
                    <label>ตำแหน่งการทำงาน</label>
                    <div className="inputWrapper">
                      <input
                        type="text"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="เช่น พยาบาลวิชาชีพ, นักวิชาการคอมพิวเตอร์"
                      />
                    </div>
                  </div>

                  <div className="formGroup col-span-2">
                    <label>กลุ่มงาน / แผนก *</label>
                    <div className="inputWrapper">
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="เช่น กลุ่มงานดิจิทัลทางการแพทย์, งานผู้ป่วยนอก (OPD)"
                        required
                      />
                    </div>
                  </div>

                  {/* Account & Role Credentials */}
                  <div className="modalSubSectionHeader col-span-2">
                    <KeyRound size={14} />
                    <span>ข้อมูลบัญชีผู้ใช้และระดับสิทธิ์</span>
                  </div>

                  <div className="formGroup">
                    <label>ชื่อผู้ใช้งาน (Username) *</label>
                    <div className="inputWrapper">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="รหัสบัตรประชาชน หรือ ชื่อล็อกอิน"
                        required
                      />
                    </div>
                  </div>

                  <div className="formGroup">
                    <label>อีเมลติดต่อ (Email) *</label>
                    <div className="inputWrapper">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@thoenhospital.go.th"
                        required
                      />
                    </div>
                  </div>

                  <div className="formGroup col-span-2">
                    <label>สิทธิ์การเข้าใช้งานระบบ (Role)</label>
                    <div className="selectWrapper">
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'member' | 'admin' | 'subdistrict')}
                        disabled={!isCreateMode && editingMember?.username === currentUser?.username}
                      >
                        <option value="member">สมาชิกทั่วไป (Member) - เข้าใช้งานบริการและสลิปเงินเดือน</option>
                        <option value="subdistrict">รพ.สต. (Sub-district) - หน่วยบริการปฐมภูมิในเครือข่าย</option>
                        <option value="admin">ผู้ดูแลระบบ (Admin) - จัดการสมาชิกและระบบทั้งหมด</option>
                      </select>
                    </div>
                    {!isCreateMode && editingMember?.username === currentUser?.username && (
                      <span className="inputHint">ไม่สามารถเปลี่ยนสิทธิ์ของบัญชีตัวเองได้</span>
                    )}
                  </div>

                  {/* Salary Credentials Section */}
                  <div className="modalSubSectionHeader col-span-2">
                    <Shield size={14} />
                    <span>ข้อมูลเข้าสู่ระบบสลิปเงินเดือน (Salary Credentials)</span>
                  </div>

                  <div className="formGroup">
                    <label>รหัสบุคลากรเงินเดือน (Salary User)</label>
                    <div className="inputWrapper">
                      <input
                        type="text"
                        value={salaryUser}
                        onChange={(e) => setSalaryUser(e.target.value)}
                        placeholder="เว้นว่างได้หากไม่มี"
                      />
                    </div>
                  </div>

                  <div className="formGroup">
                    <label>รหัสผ่านเงินเดือน (Salary Password)</label>
                    <div className="inputWrapper">
                      <input
                        type="password"
                        value={salaryPass}
                        onChange={(e) => setSalaryPass(e.target.value)}
                        placeholder={isCreateMode ? "เว้นว่างได้หากไม่มี" : "คงเดิม (พิมพ์ใหม่เพื่อเปลี่ยน)"}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modalFooter compactModalFooter">
                <button
                  type="button"
                  className="cancelBtn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="saveBtn" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{isCreateMode ? 'สร้างสมาชิกใหม่' : 'บันทึกการเปลี่ยนแปลง'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Sync Salary Dialog */}
      <ConfirmDialog
        isOpen={confirmSyncOpen}
        title="ยืนยันการซ敬ค์ข้อมูลสลิปเงินเดือน"
        description="คุณต้องการซิงค์ข้อมูลสลิปเงินเดือนจากฐานข้อมูลภายนอกใช่หรือไม่? ระบบจะทำการจับคู่และอัปเดตข้อมูลบัญชีสลิปเงินเดือนของบุคลากรโรงพยาบาลเถินที่มีชื่อผู้ใช้ตรงกัน"
        confirmText="ซิงค์ข้อมูลทันที"
        cancelText="ยกเลิก"
        type="info"
        loading={syncing}
        onConfirm={handleSyncSalary}
        onCancel={() => setConfirmSyncOpen(false)}
      />

      {/* Confirm Delete Member Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="ยืนยันการลบสมาชิก"
        description={`คุณแน่ใจหรือไม่ว่าต้องการลบสมาชิก "${deleteTarget?.name || deleteTarget?.username}" (${deleteTarget?.username})? การดำเนินการนี้จะลบบัญชีและสิทธิ์การเข้าใช้งานทั้งหมด`}
        confirmText="ยืนยันลบสมาชิก"
        cancelText="ยกเลิก"
        type="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
