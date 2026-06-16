'use client'

import { useState, useEffect } from 'react'
import { Search, UserPlus, Edit3, Trash2, Key, Mail, Shield, User, X, Check, Loader2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
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
  role: 'member' | 'admin'
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
  const [roleFilter, setRoleFilter] = useState<'all' | 'member' | 'admin'>('all')

  // Sort State
  const [sortField, setSortField] = useState<'id' | 'username' | 'email' | 'name' | 'department' | 'role'>('id')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  
  // Form Fields
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [position, setPosition] = useState('')
  const [salaryUser, setSalaryUser] = useState('')
  const [salaryPass, setSalaryPass] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)

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
    checkCurrentUser()
    fetchMembers()
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

  const handleDelete = async (id: number, memberUsername: string) => {
    if (currentUser && memberUsername === currentUser.username) {
      alert('คุณไม่สามารถลบบัญชีของตัวเองได้')
      return
    }

    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสมาชิก "${memberUsername}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`)) return

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
          <button className="addMemberBtn" onClick={handleCreateClick}>
            <UserPlus size={18} style={{ marginRight: '6px' }} />
            เพิ่มสมาชิกใหม่
          </button>
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
              ทั้งหมด ({members.length})
            </button>
            <button
              className={`filterTab ${roleFilter === 'member' ? 'active' : ''}`}
              onClick={() => setRoleFilter('member')}
            >
              ทั่วไป ({members.filter(m => m.role === 'member').length})
            </button>
            <button
              className={`filterTab ${roleFilter === 'admin' ? 'active' : ''}`}
              onClick={() => setRoleFilter('admin')}
            >
              แอดมิน ({members.filter(m => m.role === 'admin').length})
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
            <div className="tableResponsive">
              <table className="membersTable">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('id')} className="sortableHeader col-id">
                      <div className="headerFlex">ID {renderSortIcon('id')}</div>
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
                    <th style={{ textAlign: 'center' }} className="col-actions">การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => {
                    const isSelf = currentUser && member.username === currentUser.username;
                    return (
                      <tr key={member.id} className={isSelf ? 'rowSelf' : ''}>
                        <td className="memberId col-id" title={`#${member.id}`}>#{member.id}</td>
                        <td className="memberUser col-user" title={member.username}>
                          <div className="userFlex">
                            <User size={14} className="userIcon" style={{ flexShrink: 0 }} />
                            <span className="truncate">{member.username}</span>
                          </div>
                        </td>
                        <td className="memberEmail col-email" title={member.email}>{member.email}</td>
                        <td className="col-name" title={member.name || '-'}>
                          <div>{member.name || '-'}</div>
                          {member.position && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {member.position}
                            </div>
                          )}
                        </td>
                        <td className="col-dept" title={member.department || '-'}>{member.department || '-'}</td>
                        <td className="col-role">
                          <span className={`roleBadge ${member.role}`}>
                            <Shield size={10} style={{ marginRight: '3px', flexShrink: 0 }} />
                            {member.role === 'admin' ? 'แอดมิน' : 'ทั่วไป'}
                          </span>
                        </td>
                        <td className="col-actions">
                          <div className="memberActions">
                            <button
                              className="actionBtn editBtn"
                              title="แก้ไขข้อมูลสมาชิก"
                              onClick={() => handleEditClick(member)}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className="actionBtn deleteBtn"
                              title={isSelf ? "ไม่สามารถลบบัญชีตนเองได้" : "ลบสมาชิก"}
                              disabled={!!isSelf}
                              onClick={() => handleDelete(member.id, member.username)}
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
              <div className="modalBody">
                
                <div className="sectionTitleGroup">
                  <span className="sectionBadge">1</span>
                  <h3>ข้อมูลบัญชีระบบสมาชิกทั่วไป</h3>
                </div>

                <div className="formGroup">
                  <label>ชื่อผู้ใช้งาน (Username) *</label>
                  <div className="inputWrapper">
                    <User size={16} className="inputIcon" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="เช่น รหัสบัตรประชาชน หรือ ชื่อล็อกอิน"
                      required
                    />
                  </div>
                </div>

                <div className="formGroup">
                  <label>ชื่อ-นามสกุล *</label>
                  <div className="inputWrapper">
                    <User size={16} className="inputIcon" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="เช่น นาย พิสุทธิ์ ยิ้มกุศล"
                      required
                    />
                  </div>
                </div>

                <div className="formGroup">
                  <label>กลุ่มงาน / แผนก *</label>
                  <div className="inputWrapper">
                    <User size={16} className="inputIcon" />
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
                    <User size={16} className="inputIcon" />
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="เช่น หัวหน้ากลุ่มงาน, นักวิชาการคอมพิวเตอร์"
                    />
                  </div>
                </div>

                <div className="formGroup">
                  <label>อีเมลติดต่อ (Email) *</label>
                  <div className="inputWrapper">
                    <Mail size={16} className="inputIcon" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="เช่น employee@thoenhospital.go.th"
                      required
                    />
                  </div>
                </div>

                <div className="sectionTitleGroup spacingTop">
                  <span className="sectionBadge">2</span>
                  <h3>สิทธิ์และข้อมูลล็อกอินบัญชีเงินเดือน (Salary)</h3>
                </div>

                <div className="formRow">
                  <div className="formGroup col-6">
                    <label>รหัสบุคลากรเงินเดือน (Username)</label>
                    <div className="inputWrapper">
                      <Key size={16} className="inputIcon" />
                      <input
                        type="text"
                        value={salaryUser}
                        onChange={(e) => setSalaryUser(e.target.value)}
                        placeholder="หากไม่มีให้เว้นว่าง"
                      />
                    </div>
                  </div>

                  <div className="formGroup col-6">
                    <label>รหัสผ่านระบบเงินเดือน (Password)</label>
                    <div className="inputWrapper">
                      <Key size={16} className="inputIcon" />
                      <input
                        type="text"
                        value={salaryPass}
                        onChange={(e) => setSalaryPass(e.target.value)}
                        placeholder="หากไม่มีให้เว้นว่าง"
                      />
                    </div>
                  </div>
                </div>

                <div className="sectionTitleGroup spacingTop">
                  <span className="sectionBadge">3</span>
                  <h3>บทบาทการเข้าถึง (Role Permission)</h3>
                </div>

                <div className="formGroup">
                  <label>สิทธิ์การเข้าใช้งานระบบสมาชิก</label>
                  <div className="selectWrapper">
                    <Shield size={16} className="inputIcon" />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
                      disabled={!isCreateMode && editingMember?.username === currentUser?.username}
                    >
                      <option value="member">สมาชิกทั่วไป (Member) - สามารถดูสลิปเงินเดือนตนเองได้</option>
                      <option value="admin">ผู้ดูแลระบบสมาชิก (Admin) - จัดการสมาชิกและระบบหลังบ้านได้</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modalFooter">
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
    </div>
  )
}
