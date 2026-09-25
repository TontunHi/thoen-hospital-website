'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Plus, 
  Trash2, 
  Shield, 
  Settings, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  PenTool,
  Wallet,
  BookOpen,
  Wrench,
  Eye,
  FileUp,
  Coins,
  Newspaper,
  Save,
  RefreshCw,
  UserCheck,
  Sliders,
  Users,
  Pill
} from 'lucide-react'

interface SettingsClientProps {
  initialSettings: Record<string, string>
}

interface PermissionMapping {
  id: number
  permission_key: string
  position_name: string
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  // Feature Toggles
  const [featureSignature, setFeatureSignature] = useState(initialSettings['feature_signature'] !== '0')
  const [featureSalary, setFeatureSalary] = useState(initialSettings['feature_salary'] !== '0')
  const [featureIta, setFeatureIta] = useState(initialSettings['feature_ita'] !== '0')
  const [featureRdu, setFeatureRdu] = useState(initialSettings['feature_rdu'] !== '0')
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'features' | 'positions'>('features')

  // Permissions States
  const [permissions, setPermissions] = useState<PermissionMapping[]>([])
  const [availablePositions, setAvailablePositions] = useState<string[]>([])
  const [newPosition, setNewPosition] = useState('')
  const [newPermKey, setNewPermKey] = useState('create_work')
  const [customPosition, setCustomPosition] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [isAddingPerm, setIsAddingPerm] = useState(false)

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [loadingPerms, setLoadingPerms] = useState(false)

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
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
    setIsSavingSettings(true)
    try {
      const payload = {
        feature_signature: featureSignature ? '1' : '0',
        feature_salary: featureSalary ? '1' : '0',
        feature_ita: featureIta ? '1' : '0',
        feature_rdu: featureRdu ? '1' : '0'
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
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault()
    const position = isCustomMode ? customPosition.trim() : newPosition
    if (!position) {
      notify('กรุณาระบุหรือเลือกตำแหน่งงาน', 'error')
      return
    }

    setIsAddingPerm(true)
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
      notify(`เพิ่มตำแหน่งงาน "${position}" สำหรับสิทธิ์นี้เรียบร้อยแล้ว`)
      if (isCustomMode) setCustomPosition('')
      fetchPermissions()
    } catch (err: any) {
      notify(err.message, 'error')
    } finally {
      setIsAddingPerm(false)
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

  const permMetadata: Record<string, { label: string; desc: string; icon: any; color: string; bg: string }> = {
    create_work: {
      label: 'เปิดคำขอใบงานช่าง (create_work)',
      desc: 'สามารถเปิดใบแจ้งซ่อมหรือขอความช่วยเหลือจากหน่วยงานช่าง',
      icon: Wrench,
      color: '#0284c7',
      bg: '#e0f2fe'
    },
    view_all_work: {
      label: 'ดูแลระบบ/ดูงานช่างทั้งหมด (view_all_work)',
      desc: 'เจ้าหน้าที่ช่างสามารถตรวจสอบ อัปเดตสถานะ และปิดงานซ่อมทั้งหมด',
      icon: Eye,
      color: '#0d9488',
      bg: '#ccfbf1'
    },
    upload_salary: {
      label: 'อัปโหลดเงินเดือน/ค่าตอบแทน (upload_salary)',
      desc: 'ฝ่ายการเงินสามารถอัปโหลดไฟล์สลิปเงินเดือนและข้อมูลค่าตอบแทนเข้าระบบ',
      icon: FileUp,
      color: '#059669',
      bg: '#d1fae5'
    },
    view_all_salary: {
      label: 'ดูสลิปเงินเดือนบุคลากรทุกคน (view_all_salary)',
      desc: 'เจ้าหน้าที่ฝ่ายบุคคลหรือผู้บริหารที่ได้รับอนุญาตตรวจสอบข้อมูลเงินเดือนรวม',
      icon: Coins,
      color: '#d97706',
      bg: '#fef3c7'
    },
    manage_ita: {
      label: 'จัดการบทความและข้อมูล ITA (manage_ita)',
      desc: 'ผู้รับผิดชอบประเมินคุณธรรมและความโปร่งใส (ITA) ในการเขียนและเผยแพร่ข้อมูล',
      icon: BookOpen,
      color: '#7c3aed',
      bg: '#ede9fe'
    },
    manage_news: {
      label: 'จัดการและลงข่าวประชาสัมพันธ์ (manage_news)',
      desc: 'ทีมประชาสัมพันธ์สามารถเขียน แก้ไข และเผยแพร่ข่าวสารหน้าเว็บไซต์',
      icon: Newspaper,
      color: '#e11d48',
      bg: '#ffe4e6'
    },
    manage_rdu: {
      label: 'จัดการข้อมูลและเอกสาร RDU (manage_rdu)',
      desc: 'ผู้รับผิดชอบงานใช้ยาอย่างสมเหตุผล (RDU) จัดการโฟลเดอร์ปีและอัปโหลดไฟล์ PDF',
      icon: Pill,
      color: '#0d9488',
      bg: '#ccfbf1'
    }
  }

  return (
    <div className="settingsClient">
      {/* Back to Member Dashboard */}
      <div className="settingsTopNav">
        <Link href="/member" className="backBtnLink">
          <ArrowLeft size={16} />
          <span>กลับสู่หน้าหลักสมาชิก</span>
        </Link>
        <span className="adminBadge">
          <Shield size={14} />
          เฉพาะผู้ดูแลระบบ (Admin)
        </span>
      </div>

      {/* Floating Notifications */}
      {message && (
        <div className={`notificationAlert ${message.type}`}>
          {message.type === 'success' ? (
            <CheckCircle2 size={18} className="alertIcon" />
          ) : (
            <AlertCircle size={18} className="alertIcon" />
          )}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="alertCloseBtn">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modern Tab Bar Switcher */}
      <div className="settingsTabs">
        <button
          type="button"
          className={`tabItem ${activeTab === 'features' ? 'active' : ''}`}
          onClick={() => setActiveTab('features')}
        >
          <Sliders size={18} />
          <span>สิทธิ์เข้าใช้งานระบบทั่วไป</span>
        </button>
        <button
          type="button"
          className={`tabItem ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          <Users size={18} />
          <span>สิทธิ์ตามตำแหน่งงาน ({permissions.length})</span>
        </button>
      </div>

      {/* TAB 1: Feature Toggles */}
      {activeTab === 'features' && (
        <div className="card settingsCard animate-fadeIn">
          <div className="settingsCardHeader">
            <div>
              <h3 className="settingsSectionHeading">
                สิทธิ์การเข้าใช้งานบริการของสมาชิกทั่วไป (Member Access Controls)
              </h3>
              <p className="sectionSubText">
                เปิดหรือปิดการเข้าถึงโมดูลต่าง ๆ สำหรับบุคลากรทั่วไป หากปิดการใช้งาน เมนูดังกล่าวจะถูกซ่อนและปฏิเสธการเข้าถึง
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="featuresGrid">
              {/* Feature: Digital Signature */}
              <div className={`featureCard ${featureSignature ? 'isActive' : 'isInactive'}`}>
                <div className="featureCardLeft">
                  <div className="featureIconWrapper" style={{ background: '#ecfdf5', color: '#059669' }}>
                    <PenTool size={22} />
                  </div>
                  <div className="featureMeta">
                    <div className="featureTitleRow">
                      <span className="featureTitle">จัดการลายเซ็นดิจิทัล</span>
                      <span className={`statusPill ${featureSignature ? 'pillActive' : 'pillInactive'}`}>
                        {featureSignature ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p className="featureDesc">อนุญาตให้สมาชิกทั่วไปลงทะเบียน อัปโหลด และจัดการลายเซ็นดิจิทัลของตนเอง</p>
                  </div>
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

              {/* Feature: Salary Pay Slips */}
              <div className={`featureCard ${featureSalary ? 'isActive' : 'isInactive'}`}>
                <div className="featureCardLeft">
                  <div className="featureIconWrapper" style={{ background: '#fef3c7', color: '#d97706' }}>
                    <Wallet size={22} />
                  </div>
                  <div className="featureMeta">
                    <div className="featureTitleRow">
                      <span className="featureTitle">ตรวจสอบสลิปเงินเดือน</span>
                      <span className={`statusPill ${featureSalary ? 'pillActive' : 'pillInactive'}`}>
                        {featureSalary ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p className="featureDesc">อนุญาตให้สมาชิกทั่วไปยืนยันตัวตนเพื่อเปิดดูและพิมพ์ใบแจ้งยอดเงินเดือน</p>
                  </div>
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


              {/* Feature: ITA Management */}
              <div className={`featureCard ${featureIta ? 'isActive' : 'isInactive'}`}>
                <div className="featureCardLeft">
                  <div className="featureIconWrapper" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                    <BookOpen size={22} />
                  </div>
                  <div className="featureMeta">
                    <div className="featureTitleRow">
                      <span className="featureTitle">ระบบจัดการบทความ ITA</span>
                      <span className={`statusPill ${featureIta ? 'pillActive' : 'pillInactive'}`}>
                        {featureIta ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p className="featureDesc">อนุญาตให้อ่านบทความ และเปิดสิทธิ์ให้ผู้เขียนเข้าจัดการเอกสาร ITA</p>
                  </div>
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

              {/* Feature: RDU Management */}
              <div className={`featureCard ${featureRdu ? 'isActive' : 'isInactive'}`}>
                <div className="featureCardLeft">
                  <div className="featureIconWrapper" style={{ background: '#ccfbf1', color: '#0d9488' }}>
                    <Pill size={22} />
                  </div>
                  <div className="featureMeta">
                    <div className="featureTitleRow">
                      <span className="featureTitle">ระบบจัดการเอกสาร RDU (การใช้ยาอย่างสมเหตุผล)</span>
                      <span className={`statusPill ${featureRdu ? 'pillActive' : 'pillInactive'}`}>
                        {featureRdu ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p className="featureDesc">อนุญาตให้เข้าใช้งานระบบจัดทำโฟลเดอร์ปีและอัปโหลดเอกสาร RDU เพื่อเผยแพร่</p>
                  </div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={featureRdu}
                    onChange={(e) => setFeatureRdu(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="formActions">
              <button 
                type="submit" 
                className="btn btn-save"
                disabled={isSavingSettings}
              >
                {isSavingSettings ? (
                  <>
                    <RefreshCw size={18} className="spinner" />
                    <span>กำลังบันทึกการตั้งค่า...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>บันทึกการตั้งค่าระบบ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Position Permissions Manager */}
      {activeTab === 'positions' && (
        <div className="card settingsCard animate-fadeIn">
          <div className="settingsCardHeader">
            <div>
              <h3 className="settingsSectionHeading">
                จัดการสิทธิ์ตามตำแหน่งงาน (Position Permissions Manager)
              </h3>
              <p className="sectionSubText">
                กำหนดว่าบุคลากรตำแหน่งใดบ้างที่จะได้รับสิทธิ์พิเศษในแต่ละระบบ โดยระบบจะตรวจจับตำแหน่งงานของสมาชิกโดยอัตโนมัติ
              </p>
            </div>
          </div>

          {/* Add Permission Form */}
          <form onSubmit={handleAddPermission} className="addPermissionCard">
            <div className="addPermissionHeader">
              <UserCheck size={18} className="addIcon" />
              <span>เพิ่มสิทธิ์การเข้าถึงให้ตำแหน่งงาน</span>
            </div>

            <div className="formFieldsGrid">
              <div className="fieldGroup">
                <label htmlFor="permSelect">สิทธิ์การใช้งานที่ต้องการมอบหมาย</label>
                <select
                  id="permSelect"
                  value={newPermKey}
                  onChange={(e) => setNewPermKey(e.target.value)}
                  className="permSelect"
                >
                  <option value="create_work">เปิดคำขอใบงานช่าง (create_work)</option>
                  <option value="view_all_work">ดูแลระบบ/ดูงานช่างทั้งหมด (view_all_work)</option>
                  <option value="upload_salary">อัปโหลดเงินเดือน/ค่าตอบแทน (upload_salary)</option>
                  <option value="view_all_salary">ดูสลิปเงินเดือนบุคลากรทุกคน (view_all_salary)</option>
                  <option value="manage_ita">จัดการข้อมูลและบทความ ITA (manage_ita)</option>
                  <option value="manage_news">จัดการและลงข่าวประชาสัมพันธ์ (manage_news)</option>
                  <option value="manage_rdu">จัดการข้อมูลและเอกสาร RDU (manage_rdu)</option>
                </select>
              </div>

              <div className="fieldGroup">
                <div className="fieldLabelWithToggle">
                  <label htmlFor="positionInput">ตำแหน่งงานบุคลากร</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="toggleInputModeBtn"
                  >
                    {isCustomMode ? '← เลือกจากตำแหน่งที่มีในระบบ' : '✍️ ป้อนตำแหน่งเอง'}
                  </button>
                </div>

                {isCustomMode ? (
                  <input
                    id="positionInput"
                    type="text"
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                    placeholder="เช่น นักวิชาการคอมพิวเตอร์, หัวหน้ากลุ่มงาน"
                    className="customPositionInput"
                    required
                  />
                ) : (
                  <select
                    id="positionInput"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="positionSelect"
                  >
                    {availablePositions.length === 0 ? (
                      <option value="">-- ไม่พบตำแหน่งในฐานข้อมูล ให้เลือกแบบป้อนเอง --</option>
                    ) : (
                      availablePositions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))
                    )}
                  </select>
                )}
              </div>
            </div>

            <div className="addBtnWrapper">
              <button 
                type="submit" 
                className="btnAddPermission"
                disabled={isAddingPerm}
              >
                {isAddingPerm ? (
                  <RefreshCw size={16} className="spinner" />
                ) : (
                  <Plus size={16} />
                )}
                <span>เพิ่มสิทธิ์ให้ตำแหน่งนี้</span>
              </button>
            </div>
          </form>

          {/* Current Permissions Cards Grid */}
          <div className="currentPermissionsSection">
            <div className="currentPermHeader">
              <h4 className="subSectionHeading">รายการสิทธิ์ใช้งานปัจจุบันแบ่งตามหมวดหมู่</h4>
              <span className="permCountBadge">
                ครอบคลุม {Object.keys(permMetadata).length} สิทธิ์หลัก
              </span>
            </div>

            {loadingPerms ? (
              <div className="loadingContainer">
                <RefreshCw size={24} className="spinner" />
                <p>กำลังดึงข้อมูลสิทธิ์การใช้งาน...</p>
              </div>
            ) : (
              <div className="permissionsGrid">
                {Object.keys(permMetadata).map((key) => {
                  const meta = permMetadata[key]
                  const Icon = meta.icon
                  const groupMappings = permissions.filter((p) => p.permission_key === key)

                  return (
                    <div key={key} className="permGroupCard">
                      <div className="permGroupHeader">
                        <div className="permGroupHeaderLeft">
                          <div className="permBadgeIcon" style={{ color: meta.color, background: meta.bg }}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <h5 className="permTitle">{meta.label}</h5>
                            <p className="permDesc">{meta.desc}</p>
                          </div>
                        </div>
                        <span className="countChip">
                          {groupMappings.length} ตำแหน่ง
                        </span>
                      </div>

                      <div className="permGroupBody">
                        {groupMappings.length === 0 ? (
                          <div className="emptyStateText">
                            ยังไม่มีการมอบหมายตำแหน่งงานใดๆ ในสิทธิ์นี้
                          </div>
                        ) : (
                          <div className="positionsTagGrid">
                            {groupMappings.map((mapping) => (
                              <div key={mapping.id} className="positionTag">
                                <span className="positionTagName">{mapping.position_name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePermission(mapping.permission_key, mapping.position_name)}
                                  className="btnDeleteTag"
                                  title="ลบสิทธิ์ของตำแหน่งนี้"
                                  aria-label={`ลบสิทธิ์ ${mapping.position_name}`}
                                >
                                  <Trash2 size={13} />
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
      )}
    </div>
  )
}
