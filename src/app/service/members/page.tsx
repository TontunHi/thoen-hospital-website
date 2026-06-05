'use client'

import { useState, useEffect } from 'react'
import { Search, UserPlus, Edit3, Trash2, Key, Mail, Shield, User, X, Check, Loader2, AlertCircle } from 'lucide-react'
import './page.css'

interface Member {
  id: number
  username: string
  email: string
  salary_user: string | null
  salary_pass: string | null
  role: 'member' | 'admin'
  created_at: string
  updated_at: string
}

export default function MembersAdminPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [currentUser, setCurrentUser] = useState<{ username: string; email: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'member' | 'admin'>('all')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  
  // Form Fields
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
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
    setSalaryUser('')
    setSalaryPass('')
    setRole('member')
    setModalError('')
    setIsModalOpen(true)
  }

  const handleEditClick = (member: Member) => {
    if (currentUser && member.username === currentUser.username) {
      alert('คุณไม่สามารถแก้ไขข้อมูลบัญชีของตัวเองผ่านส่วนนี้ได้')
      return
    }
    setIsCreateMode(false)
    setEditingMember(member)
    setUsername(member.username)
    setEmail(member.email)
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
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'all' || member.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div className="membersDashboardPage">
      <div className="container">
        
        {/* Header */}
        <header className="pageHeader">
          <div className="headerText">
            <h1>แดชบอร์ดสมาชิก</h1>
            <p>เรียกดู เพิ่มสมาชิกใหม่ แก้ไขสิทธิ์ และข้อมูลรหัสผ่านสำหรับเข้าตรวจสอบสลิปเงินเดือนของบุคลากร</p>
          </div>
          <button className="addMemberBtn" onClick={handleCreateClick}>
            <UserPlus size={18} style={{ marginRight: '6px' }} />
            เพิ่มสมาชิกใหม่
          </button>
        </header>

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
        ) : filteredMembers.length > 0 ? (
          <div className="tableCard card">
            <div className="tableResponsive">
              <table className="membersTable">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>ชื่อผู้ใช้</th>
                    <th>อีเมลติดต่อ</th>
                    <th>บัญชีเงินเดือน (User)</th>
                    <th>รหัสผ่านเงินเดือน (Pass)</th>
                    <th>สิทธิ์การเข้าถึง (Role)</th>
                    <th style={{ textAlign: 'center' }}>การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const isSelf = currentUser && member.username === currentUser.username;
                    return (
                      <tr key={member.id} className={isSelf ? 'rowSelf' : ''}>
                        <td className="memberId">#{member.id}</td>
                        <td className="memberUser">
                          <div className="userFlex">
                            <User size={16} className="userIcon" />
                            <span>{member.username}</span>
                          </div>
                        </td>
                        <td className="memberEmail">{member.email}</td>
                        <td className="memberSalary">
                          {member.salary_user ? (
                            <span className="salaryBadge">
                              <Key size={12} style={{ marginRight: '4px' }} />
                              {member.salary_user}
                            </span>
                          ) : (
                            <span className="noSalaryBadge">ไม่ได้ตั้งค่า</span>
                          )}
                        </td>
                        <td className="memberSalary">
                          {member.salary_pass ? (
                            <span className="salaryBadge" style={{ backgroundColor: 'rgba(2, 132, 199, 0.08)', color: '#0284c7' }}>
                              <Key size={12} style={{ marginRight: '4px' }} />
                              {member.salary_pass}
                            </span>
                          ) : (
                            <span className="noSalaryBadge">ไม่ได้ตั้งค่า</span>
                          )}
                        </td>
                        <td>
                          <span className={`roleBadge ${member.role}`}>
                            <Shield size={12} style={{ marginRight: '4px' }} />
                            {member.role === 'admin' ? 'แอดมิน' : 'ทั่วไป'}
                          </span>
                        </td>
                        <td className="memberActions">
                          <button
                            className="actionBtn editBtn"
                            title={isSelf ? "ไม่สามารถแก้ไขบัญชีตนเองผ่านหน้านี้ได้" : "แก้ไขข้อมูลสมาชิก"}
                            disabled={!!isSelf}
                            onClick={() => handleEditClick(member)}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            className="actionBtn deleteBtn"
                            title={isSelf ? "ไม่สามารถลบบัญชีตนเองได้" : "ลบสมาชิก"}
                            disabled={!!isSelf}
                            onClick={() => handleDelete(member.id, member.username)}
                          >
                            <Trash2 size={16} />
                          </button>
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
