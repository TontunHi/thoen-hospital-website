'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Shield, UserCheck, Edit3 } from 'lucide-react'

interface SettingsClientProps {
  initialSettings: Record<string, string>
}

interface PermissionMapping {
  id: number
  permission_key: string
  position_name: string
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [featureSignature, setFeatureSignature] = useState(initialSettings['feature_signature'] !== '0')
  const [featureSalary, setFeatureSalary] = useState(initialSettings['feature_salary'] !== '0')
  const [featurePrRequests, setFeaturePrRequests] = useState(initialSettings['feature_pr_requests'] !== '0')
  const [featureApprovals, setFeatureApprovals] = useState(initialSettings['feature_approvals'] !== '0')
  const [featureIta, setFeatureIta] = useState(initialSettings['feature_ita'] !== '0')

  // Permissions States
  const [permissions, setPermissions] = useState<PermissionMapping[]>([])
  const [availablePositions, setAvailablePositions] = useState<string[]>([])
  const [newPosition, setNewPosition] = useState('')
  const [newPermKey, setNewPermKey] = useState('create_work')
  const [customPosition, setCustomPosition] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [loadingPerms, setLoadingPerms] = useState(false)

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  const fetchPermissions = async () => {
    setLoadingPerms(true)
    try {
      const res = await fetch('/api/member/permissions')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setPermissions(data.mappings)
          setAvailablePositions(data.availablePositions)
          if (data.availablePositions.length > 0) {
            setNewPosition(data.availablePositions[0])
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
    } finally {
      setLoadingPerms(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        feature_signature: featureSignature ? '1' : '0',
        feature_salary: featureSalary ? '1' : '0',
        feature_pr_requests: featurePrRequests ? '1' : '0',
        feature_approvals: featureApprovals ? '1' : '0',
        feature_ita: featureIta ? '1' : '0'
      }
      const res = await fetch('/api/member/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึก')
      notify('บันทึกการตั้งค่าสิทธิ์เข้าใช้งานเรียบร้อยแล้ว')
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault()
    const position = isCustomMode ? customPosition.trim() : newPosition
    if (!position) {
      notify('กรุณาระบุหรือเลือกตำแหน่งงาน', 'error')
      return
    }

    try {
      const res = await fetch('/api/member/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission_key: newPermKey,
          position_name: position
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      notify(`เพิ่มตำแหน่งงาน "${position}" สำหรับสิทธิ์นี้แล้ว`)
      if (isCustomMode) setCustomPosition('')
      fetchPermissions()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleDeletePermission = async (permKey: string, positionName: string) => {
    if (!confirm(`คุณต้องการลบสิทธิ์ของตำแหน่ง "${positionName}" หรือไม่?`)) return
    try {
      const res = await fetch(`/api/member/permissions?permission_key=${encodeURIComponent(permKey)}&position_name=${encodeURIComponent(positionName)}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      notify('ลบสิทธิ์ของตำแหน่งงานนี้ออกเรียบร้อยแล้ว')
      fetchPermissions()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const getPermName = (key: string) => {
    switch (key) {
      case 'create_work': return 'สิทธิ์เข้าใช้งาน/เปิดคำขอซ่อมงานช่างฯ (create_work)'
      case 'view_all_work': return 'สิทธิ์ดูรายการงานและอัปเดตงานทั้งหมด (view_all_work)'
      case 'upload_salary': return 'สิทธิ์อัปโหลดเอกสารการเงินและเงินเดือน (upload_salary)'
      case 'manage_ita': return 'สิทธิ์เข้าถึงและจัดการระบบบทความ ITA (manage_ita)'
      default: return key
    }
  }

  return (
    <div className="settingsClient">
      {message && (
        <div className={`notificationAlert ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="card settingsCard">
        <h3 className="settingsSectionHeading">
          สิทธิ์การเข้าใช้งานบริการของสมาชิกทั่วไป (Member Access Controls)
        </h3>
        
        <form onSubmit={handleSaveSettings}>
          <div className="settingsSection">
            {/* Toggle: Digital Signature */}
            <div className="toggleRow">
              <div className="toggleLabelInfo">
                <span className="toggleLabelText">จัดการลายเซ็นดิจิทัล</span>
                <span className="toggleDescriptionText">อนุญาตให้สมาชิกทั่วไปลงทะเบียนและจัดการลายเซ็นดิจิทัล</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={featureSignature} 
                  onChange={(e) => setFeatureSignature(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Toggle: Salary Slip */}
            <div className="toggleRow">
              <div className="toggleLabelInfo">
                <span className="toggleLabelText">ระบบสลิปเงินเดือนออนไลน์</span>
                <span className="toggleDescriptionText">อนุญาตให้สมาชิกทั่วไปเรียกดูสลิปเงินเดือนออนไลน์</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={featureSalary} 
                  onChange={(e) => setFeatureSalary(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Toggle: PR Media Request */}
            <div className="toggleRow">
              <div className="toggleLabelInfo">
                <span className="toggleLabelText">ร้องขอผลิตสื่อประชาสัมพันธ์</span>
                <span className="toggleDescriptionText">อนุญาตให้สมาชิกทั่วไปยื่นคำขอผลิตสื่อประชาสัมพันธ์</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={featurePrRequests} 
                  onChange={(e) => setFeaturePrRequests(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Toggle: Approvals Inbox */}
            <div className="toggleRow">
              <div className="toggleLabelInfo">
                <span className="toggleLabelText">กล่องงานรอการอนุมัติ</span>
                <span className="toggleDescriptionText">อนุญาตให้สมาชิกทั่วไปเข้าใช้งานกล่องงานรออนุมัติ</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={featureApprovals} 
                  onChange={(e) => setFeatureApprovals(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Toggle: ITA Blog System */}
            <div className="toggleRow">
              <div className="toggleLabelInfo">
                <span className="toggleLabelText">ระบบจัดการบทความ ITA</span>
                <span className="toggleDescriptionText">อนุญาตให้สมาชิกทั่วไปอ่านบทความ และผู้เขียนบทความที่มีสิทธิ์เข้าจัดการระบบหลังบ้าน</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={featureIta} 
                  onChange={(e) => setFeatureIta(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <div className="formActions" style={{ marginTop: '28px' }}>
            <button type="submit" className="btn btn-primary">บันทึกการตั้งค่าระบบ</button>
          </div>
        </form>
      </div>

      {/* Permissions Section */}
      <div className="card settingsCard permissionsManagerCard">
        <h3 className="settingsSectionHeading">
          <Shield size={20} className="headingIcon" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          จัดการสิทธิ์ตามตำแหน่งงาน (Position Permissions Manager)
        </h3>
        <p className="permissionsIntroText">
          กำหนดว่าบุคลากรตำแหน่งใดบ้างที่จะได้รับสิทธิ์พิเศษ เช่น เปิดตั๋วใบงานคอมพิวเตอร์ หรือดูแลระบบงานช่างฯ ทั้งหมด
        </p>

        {/* Add Permission Form */}
        <form onSubmit={handleAddPermission} className="addPermissionForm">
          <div className="formFieldsGrid">
            <div className="fieldGroup">
              <label>เลือกสิทธิ์ใช้งาน (Permission)</label>
              <select value={newPermKey} onChange={(e) => setNewPermKey(e.target.value)} className="permSelect">
                <option value="create_work">เปิดคำขอใบงานช่าง (create_work)</option>
                <option value="view_all_work">ดูแลระบบ/ดูงานทั้งหมด (view_all_work)</option>
                <option value="upload_salary">อัปโหลดเงินเดือน/ค่าตอบแทน (upload_salary)</option>
                <option value="manage_ita">จัดการข้อมูลและบทความ ITA (manage_ita)</option>
              </select>
            </div>

            <div className="fieldGroup">
              <div className="fieldLabelWithToggle">
                <label>ตำแหน่งงาน (Position)</label>
                <button 
                  type="button" 
                  onClick={() => setIsCustomMode(!isCustomMode)} 
                  className="toggleInputModeBtn"
                >
                  {isCustomMode ? 'เลือกจากรายชื่อตำแหน่ง' : 'ป้อนตำแหน่งเอง'}
                </button>
              </div>

              {isCustomMode ? (
                <input 
                  type="text" 
                  value={customPosition} 
                  onChange={(e) => setCustomPosition(e.target.value)} 
                  placeholder="เช่น นักวิชาการสาธารณสุข"
                  className="customPositionInput"
                  required
                />
              ) : (
                <select 
                  value={newPosition} 
                  onChange={(e) => setNewPosition(e.target.value)}
                  className="positionSelect"
                >
                  {availablePositions.length === 0 ? (
                    <option value="">-- ไม่พบตำแหน่งในฐานข้อมูล สลับเป็นแบบป้อนเอง --</option>
                  ) : (
                    availablePositions.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))
                  )}
                </select>
              )}
            </div>
          </div>

          <button type="submit" className="btnAddPermission btn">
            <Plus size={16} />
            <span>เพิ่มสิทธิ์</span>
          </button>
        </form>

        {/* Current Permissions List */}
        <div className="currentPermissionsSection">
          <h4 className="subSectionHeading">รายการสิทธิ์ใช้งานปัจจุบัน</h4>
          
          {loadingPerms ? (
            <div className="loadingText">กำลังโหลดข้อมูลสิทธิ์การใช้งาน...</div>
          ) : (
            <div className="permissionsGroupContainer">
              {['create_work', 'view_all_work', 'upload_salary', 'manage_ita'].map((key) => {
                const groupMappings = permissions.filter((p) => p.permission_key === key)
                return (
                  <div key={key} className="permGroupCard">
                    <div className="permGroupHeader">
                      <h5>{getPermName(key)}</h5>
                    </div>
                    <div className="permGroupBody">
                      {groupMappings.length === 0 ? (
                        <div className="emptyStateText">ยังไม่มีการกำหนดสิทธิ์ตำแหน่งใดๆ ในสิทธิ์นี้</div>
                      ) : (
                        <div className="positionsTagGrid">
                          {groupMappings.map((mapping) => (
                            <div key={mapping.id} className="positionTag">
                              <span className="positionTagName">{mapping.position_name}</span>
                              <button 
                                type="button" 
                                onClick={() => handleDeletePermission(mapping.permission_key, mapping.position_name)}
                                className="btnDeleteTag"
                                title="ลบสิทธิ์ตำแหน่งนี้"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
