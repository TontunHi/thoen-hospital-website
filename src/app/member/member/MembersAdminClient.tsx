'use client'

import { useState, useEffect } from 'react'
import { Search, UserPlus, Edit3, Trash2, Mail, Shield, User, X, Check, Loader2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; username: string } | null>(null)
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
        setSuccess(`ซิงค์ข้อมูลเรียบร้อยแล้ว: อัปเดตข้อมูลสำเร็จ ${data.stats.matchedCount} รายการ`)
        fetchMembers()
      } else {
        setError(data.error || 'การซิงค์ข้อมูลล้มเหลว')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อซิงค์ข้อมูล')
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
      username,
      email,
      name: name || null,
      department: department || null,
      position: position || null,
      salary_user: salaryUser || null,
      salary_pass: salaryPass || null,
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
        setSuccess(isCreateMode ? 'เพิ่มสมาชิกใหม่เรียบร้อยแล้ว' : 'อัปเดตข้อมูลสมาชิกสำเร็จ')
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

  const requestDelete = (id: number, memberUsername: string) => {
    if (currentUser && memberUsername === currentUser.username) {
      setError('คุณไม่สามารถลบบัญชีของตัวเองได้')
      return
    }
    setDeleteTarget({ id, username: memberUsername })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/member?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (res.ok) {
        setSuccess('ลบสมาชิกออกจากระบบเรียบร้อยแล้ว')
        setMembers(members.filter((m) => m.id !== id))
      } else {
        setError(data.error || 'ลบไม่สำเร็จ')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // Filtered members list
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.name && member.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (member.department && member.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (member.position && member.position.toLowerCase().includes(searchQuery.toLowerCase()))
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
        
        {/* Header */}
        <header className="pageHeader">
          <div className="headerText">
            <h1>แดชบอร์ดจัดการสมาชิก</h1>
            <p>เรียกดู เพิ่มสมาชิกใหม่ แก้ไขสิทธิ์การใช้งาน และข้อมูลรหัสผ่านบัญชีเงินเดือนของบุคลากรโรงพยาบาลเถิน</p>
          </div>
          <div className="headerActions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="syncSalaryBtn" onClick={() => setConfirmSyncOpen(true)} disabled={syncing} type="button">
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
              {syncing ? 'กำลังซิงค์ข้อมูล...' : 'ซิงค์ข้อมูลเงินเดือน'}
            </button>
            <button className="addMemberBtn" onClick={handleCreateClick} type="button">
              <UserPlus size={18} style={{ marginRight: '6px' }} />
              เพิ่มสมาชิกใหม่
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="statsGrid">
          <div className="statCard total">
            <div className="statCardInfo">
              <span className="statLabel">บุคลากรทั้งหมด</span>
              <span className="statValue">{members.length} คน</span>
            </div>
            <div className="statCardIcon total">
              <User size={24} />
            </div>
          </div>
          <div className="statCard admins">
            <div className="statCardInfo">
              <span className="statLabel">ผู้ดูแลระบบ (Admin)</span>
              <span className="statValue">{members.filter(m => m.role === 'admin').length} คน</span>
            </div>
            <div className="statCardIcon admins">
              <Shield size={24} />
            </div>
          </div>
          <div className="statCard general">
            <div className="statCardInfo">
              <span className="statLabel">สมาชิกทั่วไป (Member)</span>
              <span className="statValue">{members.filter(m => m.role === 'member').length} คน</span>
            </div>
            <div className="statCardIcon general">
              <Mail size={24} />
            </div>
          </div>
          <div className="statCard subdistrict">
            <div className="statCardInfo">
              <span className="statLabel">รพ.สต.</span>
              <span className="statValue">{members.filter(m => m.role === 'subdistrict').length} คน</span>
            </div>
            <div className="statCardIcon subdistrict">
              <User size={24} />
            </div>
          </div>
        </div>

        {error && <div className="dashboardAlert alertDanger">{error}</div>}
        {success && <div className="dashboardAlert alertSuccess">{success}</div>}

        {/* Action Panel */}
        <div className="actionPanel card">
          <div className="searchWrapper">
            <Search size={18} className="searchIcon" />
            <input
              type="text"
              placeholder="ค้นหาตามชื่อผู้ใช้ หรือ อีเมล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filterGroup">
            <button
              className={`filterTab ${roleFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRoleFilter('all')}
            >
              ทั้งหมด <span className="filterCount">({members.length})</span>
            </button>
            <button
              className={`filterTab ${roleFilter === 'member' ? 'active' : ''}`}
              onClick={() => setRoleFilter('member')}
            >
              ทั่วไป <span className="filterCount">({members.filter(m => m.role === 'member').length})</span>
            </button>
            <button
              className={`filterTab ${roleFilter === 'subdistrict' ? 'active' : ''}`}
              onClick={() => setRoleFilter('subdistrict')}
            >
              รพ.สต. <span className="filterCount">({members.filter(m => m.role === 'subdistrict').length})</span>
            </button>
            <button
              className={`filterTab ${roleFilter === 'admin' ? 'active' : ''}`}
              onClick={() => setRoleFilter('admin')}
            >
              แอดมิน <span className="filterCount">({members.filter(m => m.role === 'admin').length})</span>
            </button>
          </div>
        </div>

        {/* Members Table */}
        {loading ? (
          <div className="loadingContainer">
            <Loader2 size={36} className="spinner" />
            <p>กำลังโหลดรายชื่อสมาชิก...</p>
          </div>
        ) : sortedMembers.length > 0 ? (
          <div className="tableCard card">
            {/* Desktop Locked Table (No Horizontal Scroll) */}
            <div className="tableResponsive desktopTableOnly">
              <table className="membersTable">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('id')} className="sortableHeader col-id">
                      <div className="headerFlex">ลำดับ {renderSortIcon('id')}</div>
                    </th>
                    <th onClick={() => handleSort('username')} className="sortableHeader col-user">
                      <div className="headerFlex">ชื่อผู้ใช้ {renderSortIcon('username')}</div>
                    </th>
                    <th onClick={() => handleSort('email')} className="sortableHeader col-email">
                      <div className="headerFlex">อีเมล {renderSortIcon('email')}</div>
                    </th>
                    <th onClick={() => handleSort('name')} className="sortableHeader col-name">
                      <div className="headerFlex">ชื่อ-นามสกุล {renderSortIcon('name')}</div>
                    </th>
                    <th onClick={() => handleSort('department')} className="sortableHeader col-dept">
                      <div className="headerFlex">กลุ่มงาน/แผนก {renderSortIcon('department')}</div>
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
                        <td className="memberId col-id" title={`ลำดับที่ ${index + 1}`}>{index + 1}</td>
                        <td className="memberUser col-user" title={member.username}>
                          <div className="userFlex">
                            <span className="truncate">{member.username}</span>
                          </div>
                        </td>
                        <td className="memberEmail col-email" title={member.email}>
                          <span className="truncate" title={member.email}>{member.email}</span>
                        </td>
                        <td className="col-name" title={member.name || '-'}>
                          <div className="memberNameText">{member.name || '-'}</div>
                          {member.position && (
                            <div className="memberPositionText">
                              {member.position}
                            </div>
                          )}
                        </td>
                        <td className="col-dept" title={member.department || '-'}>
                          <span className="truncate">{member.department || '-'}</span>
                        </td>
                        <td className="col-role">
                          <span className={`roleBadge ${member.role}`}>
                            {member.role === 'admin' ? 'แอดมิน' : member.role === 'subdistrict' ? 'รพ.สต.' : 'ทั่วไป'}
                          </span>
                        </td>
                        <td className="col-actions">
                          <div className="memberActions">
                            <button
                              className="actionBtn editBtn touch-target"
                              title="แก้ไขข้อมูลสมาชิก"
                              onClick={() => handleEditClick(member)}
                              type="button"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className="actionBtn deleteBtn touch-target"
                              title={isSelf ? "ไม่สามารถลบบัญชีตนเองได้" : "ลบสมาชิก"}
                              disabled={!!isSelf}
                              onClick={() => requestDelete(member.id, member.username)}
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
          </div>
        ) : (
          <div className="emptyState card">
            <User size={48} className="emptyIcon" />
            <h3>ไม่พบข้อมูลสมาชิก</h3>
            <p>ไม่พบรายชื่อผู้ใช้ที่ตรงกับการค้นหาของคุณในขณะนี้</p>
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="modalOverlay">
          <div className="modalCard premiumModal">
            <div className="modalHeader">
              <div className="headerIconContainer">
                {isCreateMode ? <UserPlus size={22} /> : <Edit3 size={22} />}
              </div>
              <div>
                <h2>{isCreateMode ? 'เพิ่มสมาชิกใหม่เข้าระบบ' : `แก้ไขข้อมูลสมาชิก #${editingMember?.id}`}</h2>
                <p className="headerSubtitle">{isCreateMode ? 'กรอกรายละเอียดเพื่อลงทะเบียนบุคลากรใหม่' : 'แก้ไขข้อมูลบัญชีผู้ใช้และจัดการสิทธิ์เงินเดือน'}</p>
              </div>
              <button className="closeBtn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div className="modalAlert alertDanger flexItems">
                <AlertCircle size={16} style={{ marginRight: '6px', flexShrink: 0 }} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="modalBody compactModalBody">
                <div className="modalFormGrid">
                  {/* Row 1 */}
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

                  {/* Row 2 */}
                  <div className="formGroup">
                    <label>กลุ่มงาน / แผนก *</label>
                    <div className="inputWrapper">
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="เช่น กลุ่มงานดิจิทัลทางการแพทย์"
                        required
                      />
                    </div>
                  </div>

                  <div className="formGroup">
                    <label>ตำแหน่ง</label>
                    <div className="inputWrapper">
                      <input
                        type="text"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="เช่น พยาบาลวิชาชีพ, นักวิชาการ"
                      />
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="formGroup">
                    <label>อีเมลติดต่อ (Email) *</label>
                    <div className="inputWrapper">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="employee@thoenhospital.go.th"
                        required
                      />
                    </div>
                  </div>

                  <div className="formGroup">
                    <label>สิทธิ์การเข้าใช้งาน (Role)</label>
                    <div className="selectWrapper">
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'member' | 'admin' | 'subdistrict')}
                        disabled={!isCreateMode && editingMember?.username === currentUser?.username}
                      >
                        <option value="member">สมาชิกทั่วไป (Member)</option>
                        <option value="subdistrict">รพ.สต. (Sub-district)</option>
                        <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                      </select>
                    </div>
                  </div>

                  {/* Salary section divider inside grid (Span 2) */}
                  <div className="modalSubSectionHeader col-span-2">
                    <Shield size={14} />
                    <span>ข้อมูลเข้าสู่ระบบสลิปเงินเดือน (Salary Credentials)</span>
                  </div>

                  {/* Row 4 (Salary) */}
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
                        type="text"
                        value={salaryPass}
                        onChange={(e) => setSalaryPass(e.target.value)}
                        placeholder="เว้นว่างได้หากไม่มี"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modalFooter compactModalFooter">
                <button
                  type="button"
                  className="cancelBtn touch-target"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="saveBtn touch-target" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" style={{ marginRight: '6px' }} />
                      กำลังดำเนินการ...
                    </>
                  ) : (
                    <>
                      <Check size={16} style={{ marginRight: '6px' }} />
                      {isCreateMode ? 'สร้างสมาชิกใหม่' : 'บันทึกการเปลี่ยนแปลง'}
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
        title="ยืนยันการซิงค์ข้อมูลสลิปเงินเดือน"
        description="คุณต้องการซิงค์ข้อมูลสลิปเงินเดือนจากฐานข้อมูลภายนอกใช่หรือไม่? การดำเนินการนี้จะทำการอัปเดตข้อมูลบัญชีสลิปเงินเดือนของสมาชิกทุกคนที่มีชื่อผู้ใช้ตรงกับระบบเงินเดือน"
        confirmText="ซิงค์ข้อมูล"
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
        description={`คุณแน่ใจหรือไม่ว่าต้องการลบสมาชิก "${deleteTarget?.username}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
        confirmText="ลบสมาชิก"
        cancelText="ยกเลิก"
        type="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
