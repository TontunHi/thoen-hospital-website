'use client'

import React from 'react'
import {
  Edit3,
  UserCheck,
  Building2,
  KeyRound,
  Home,
  Car,
  Plus,
  Trash2,
  X,
  Save,
  RefreshCw,
} from 'lucide-react'
import {
  WORK_DEPARTMENTS,
  POSITIONS,
  JOB_LEVELS,
  PERSONNEL_GROUPS,
  TITLES,
  HOUSING_LOCATIONS,
  THAI_PROVINCES,
} from '@/lib/registration/registrationConstants'
import type { RegistrationRecord } from '@/lib/registration/RegistrationService'
import type { VehicleItem } from '@/lib/registration/registrationSchema'

interface RegistrationEditModalProps {
  isOpen: boolean
  selectedItem: RegistrationRecord | null
  formData: Partial<RegistrationRecord>
  setFormData: React.Dispatch<React.SetStateAction<Partial<RegistrationRecord>>>
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
  onAddVehicle: () => void
  onUpdateVehicle: (index: number, field: keyof VehicleItem, value: string) => void
  onRemoveVehicle: (index: number) => void
}

export function RegistrationEditModal({
  isOpen,
  selectedItem,
  formData,
  setFormData,
  onClose,
  onSubmit,
  isPending,
  onAddVehicle,
  onUpdateVehicle,
  onRemoveVehicle,
}: RegistrationEditModalProps) {
  if (!isOpen || !selectedItem) return null

  return (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modalCard modalWide" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={onSubmit}>
          <div className="modalHeader">
            <div className="modalHeaderLeft">
              <div className="modalHeaderIcon">
                <Edit3 size={20} className="text-emerald-700" />
              </div>
              <div className="modalHeaderTitleBox">
                <div className="modalHeaderTitleRow">
                  <span className="reqIdPill">#{selectedItem.id}</span>
                  <h3 className="modalTitle">แก้ไขข้อมูลคำขอลงทะเบียน</h3>
                </div>
                <p className="modalSubtitle">
                  {selectedItem.title}
                  {selectedItem.firstNameTh} {selectedItem.lastNameTh} &bull; {selectedItem.department}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="modalCloseBtn"
              onClick={onClose}
              aria-label="ปิด"
            >
              ✕
            </button>
          </div>

          <div className="modalBody">
            {/* 1. ข้อมูลส่วนบุคคล */}
            <div className="editGroupCard">
              <h4 className="editGroupTitle">
                <UserCheck size={16} className="text-emerald-700" />
                <span>1. ข้อมูลส่วนบุคคล</span>
              </h4>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel">เลขบัตรประชาชน (13 หลัก) *</label>
                  <input
                    type="text"
                    className="textInput font-mono"
                    value={formData.citizenId || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, citizenId: e.target.value.replace(/\D/g, '') }))
                    }
                    maxLength={13}
                    required
                  />
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel">คำนำหน้า *</label>
                  <select
                    className="selectInput"
                    value={formData.title || 'นาย'}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                  >
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel">ชื่อ (ภาษาไทย) *</label>
                  <input
                    type="text"
                    className="textInput"
                    value={formData.firstNameTh || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, firstNameTh: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel">นามสกุล (ภาษาไทย) *</label>
                  <input
                    type="text"
                    className="textInput"
                    value={formData.lastNameTh || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, lastNameTh: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel">First Name (English)</label>
                  <input
                    type="text"
                    className="textInput"
                    value={formData.firstNameEn || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, firstNameEn: e.target.value }))
                    }
                  />
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel">Last Name (English)</label>
                  <input
                    type="text"
                    className="textInput"
                    value={formData.lastNameEn || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, lastNameEn: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel">ชื่อเล่น</label>
                  <input
                    type="text"
                    className="textInput"
                    value={formData.nickname || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, nickname: e.target.value }))
                    }
                  />
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel">เลขที่ใบประกอบวิชาชีพ</label>
                  <input
                    type="text"
                    className="textInput"
                    value={formData.licenseNo || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, licenseNo: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="fieldGroup">
                <label className="inputLabel">วันเดือนปีเกิด (พ.ศ.) *</label>
                <input
                  type="text"
                  className="textInput"
                  placeholder="เช่น 15/05/2538"
                  value={formData.birthDate || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, birthDate: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            {/* 2. ตำแหน่งและกลุ่มงาน */}
            <div className="editGroupCard">
              <h4 className="editGroupTitle">
                <Building2 size={16} className="text-emerald-700" />
                <span>2. ตำแหน่งและกลุ่มงาน</span>
              </h4>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel">กลุ่มงาน / แผนก *</label>
                  <select
                    className="selectInput"
                    value={formData.department || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, department: e.target.value }))
                    }
                  >
                    {WORK_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel">ตำแหน่ง *</label>
                  <select
                    className="selectInput"
                    value={formData.position || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, position: e.target.value }))
                    }
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel">ระดับงาน *</label>
                  <select
                    className="selectInput"
                    value={formData.level || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, level: e.target.value }))
                    }
                  >
                    {JOB_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel">กลุ่มบุคคล *</label>
                  <select
                    className="selectInput"
                    value={formData.personnelGroup || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, personnelGroup: e.target.value }))
                    }
                  >
                    {PERSONNEL_GROUPS.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel">วันที่เริ่มปฏิบัติงาน (พ.ศ.) *</label>
                  <input
                    type="text"
                    className="textInput"
                    placeholder="เช่น 01/10/2566"
                    value={formData.startDate || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel">วันที่บรรจุ (พ.ศ.)</label>
                  <input
                    type="text"
                    className="textInput"
                    placeholder="เช่น 01/10/2567"
                    value={formData.containDate || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, containDate: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* 3. ข้อมูลติดต่อ & HOSxP */}
            <div className="editGroupCard">
              <h4 className="editGroupTitle">
                <KeyRound size={16} className="text-emerald-700" />
                <span>3. ข้อมูลติดต่อ & HOSxP</span>
              </h4>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel">อีเมล *</label>
                  <input
                    type="email"
                    className="textInput"
                    value={formData.email || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel">เบอร์โทรศัพท์ *</label>
                  <input
                    type="tel"
                    className="textInput"
                    value={formData.phone || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="fieldGroup">
                <label className="inputLabel">Line ID</label>
                <input
                  type="text"
                  className="textInput"
                  value={formData.lineId || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lineId: e.target.value }))
                  }
                />
              </div>

              {/* HOSxP toggle */}
              <div className={`toggleSwitchCard ${formData.hasHosxp ? 'active' : ''}`}>
                <div className="toggleSwitchCardHeader">
                  <div className="toggleSwitchCardInfo">
                    <span className="toggleSwitchCardTitle">ขอใช้งานระบบสารสนเทศ HOSxP</span>
                    <span className="toggleSwitchCardDesc">
                      เปิดเพื่อกำหนดชื่อผู้ใช้และรหัสผ่านสำหรับเข้าใช้งานระบบสารสนเทศ
                    </span>
                  </div>
                  <label className="toggleSwitch" aria-label="ขอใช้งาน HOSxP">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.hasHosxp)}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, hasHosxp: e.target.checked }))
                      }
                    />
                    <span className="slider" />
                  </label>
                </div>

                {formData.hasHosxp && (
                  <div className="toggleSwitchCardContent animateFadeIn">
                    <div className="grid2Col">
                      <div className="fieldGroup mb-0">
                        <label className="inputLabel">HOSxP Username</label>
                        <input
                          type="text"
                          className="textInput"
                          placeholder="ชื่อผู้ใช้งาน HOSxP"
                          value={formData.hosxpUser || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, hosxpUser: e.target.value }))
                          }
                        />
                      </div>

                      <div className="fieldGroup mb-0">
                        <label className="inputLabel">HOSxP Password</label>
                        <input
                          type="text"
                          className="textInput"
                          placeholder="รหัสผ่านเข้า HOSxP"
                          value={formData.hosxpPass || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, hosxpPass: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. สวัสดิการที่พัก & ยานพาหนะ */}
            <div className="editGroupCard">
              <h4 className="editGroupTitle">
                <Home size={16} className="text-emerald-700" />
                <span>4. สวัสดิการที่พักอาศัย & ยานพาหนะ</span>
              </h4>

              {/* Housing */}
              <div className={`toggleSwitchCard ${formData.inHospitalHousing ? 'active' : ''}`}>
                <div className="toggleSwitchCardHeader">
                  <div className="toggleSwitchCardInfo">
                    <span className="toggleSwitchCardTitle">พักอาศัยอยู่ในโรงพยาบาล</span>
                    <span className="toggleSwitchCardDesc">
                      เปิดหากพักอยู่ในโซนบ้านพักหรือแฟลตเจ้าหน้าที่ของโรงพยาบาล
                    </span>
                  </div>
                  <label className="toggleSwitch" aria-label="พักอาศัยในโรงพยาบาล">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.inHospitalHousing)}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, inHospitalHousing: e.target.checked }))
                      }
                    />
                    <span className="slider" />
                  </label>
                </div>

                {formData.inHospitalHousing && (
                  <div className="toggleSwitchCardContent animateFadeIn">
                    <div className="fieldGroup mb-0">
                      <label className="inputLabel">สถานที่พักอาศัย</label>
                      <select
                        className="selectInput"
                        value={formData.housingLocation || HOUSING_LOCATIONS[0]}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, housingLocation: e.target.value }))
                        }
                      >
                        {HOUSING_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicle Management */}
              <div className={`toggleSwitchCard ${formData.hasVehicle ? 'active' : ''} mt-3`}>
                <div className="toggleSwitchCardHeader">
                  <div className="toggleSwitchCardInfo">
                    <span className="toggleSwitchCardTitle">มีรถยนต์เข้าโซนบ้านพัก</span>
                    <span className="toggleSwitchCardDesc">
                      ลงทะเบียนข้อมูลยานพาหนะเข้าออก (สูงสุด 2 คัน)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {formData.hasVehicle && (!formData.vehicles || formData.vehicles.length < 2) && (
                      <button
                        type="button"
                        className="btnAddVehicle"
                        onClick={onAddVehicle}
                      >
                        <Plus size={14} />
                        <span>เพิ่มรถยนต์ ({formData.vehicles?.length || 0}/2)</span>
                      </button>
                    )}

                    <label className="toggleSwitch" aria-label="มีรถยนต์เข้าโซนบ้านพัก">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.hasVehicle)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setFormData((prev) => ({
                            ...prev,
                            hasVehicle: checked,
                            vehicles:
                              checked && (!prev.vehicles || prev.vehicles.length === 0)
                                ? [{ platePrefix: '', plateNumber: '', province: 'ลำปาง' }]
                                : prev.vehicles,
                          }))
                        }}
                      />
                      <span className="slider" />
                    </label>
                  </div>
                </div>

                {formData.hasVehicle && (
                  <div className="toggleSwitchCardContent animateFadeIn">
                    {!formData.vehicles || formData.vehicles.length === 0 ? (
                      <div className="text-center py-4 text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                        ยังไม่มีรายการรถยนต์ กด &quot;เพิ่มรถยนต์&quot; ด้านบนเพื่อเพิ่มข้อมูล (สูงสุด 2 คัน)
                      </div>
                    ) : (
                      <div className="vehicleEditList">
                        {formData.vehicles.map((v, vIdx) => (
                          <div key={vIdx} className="vehicleEditCard">
                            <div className="vehicleEditHeader">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <Car size={14} className="text-emerald-700" />
                                <span>รถยนต์คันที่ {vIdx + 1}</span>
                              </div>
                              <button
                                type="button"
                                className="btnRemoveVehicle"
                                onClick={() => onRemoveVehicle(vIdx)}
                                title="ลบรถคันนี้"
                              >
                                <Trash2 size={13} />
                                <span>ลบรถคันนี้</span>
                              </button>
                            </div>

                            <div className="grid3Col">
                              <div className="fieldGroup mb-0">
                                <label className="inputLabel text-xs">หมวดอักษร</label>
                                <input
                                  type="text"
                                  className="textInput text-xs h-9"
                                  placeholder="เช่น กข"
                                  maxLength={4}
                                  value={v.platePrefix || ''}
                                  onChange={(e) => onUpdateVehicle(vIdx, 'platePrefix', e.target.value)}
                                />
                              </div>

                              <div className="fieldGroup mb-0">
                                <label className="inputLabel text-xs">เลขทะเบียน</label>
                                <input
                                  type="text"
                                  className="textInput text-xs h-9 tabularNums"
                                  placeholder="เช่น 1234"
                                  maxLength={6}
                                  value={v.plateNumber || ''}
                                  onChange={(e) => onUpdateVehicle(vIdx, 'plateNumber', e.target.value)}
                                />
                              </div>

                              <div className="fieldGroup mb-0">
                                <label className="inputLabel text-xs">จังหวัด</label>
                                <select
                                  className="selectInput text-xs h-9"
                                  value={v.province || 'ลำปาง'}
                                  onChange={(e) => onUpdateVehicle(vIdx, 'province', e.target.value)}
                                >
                                  {THAI_PROVINCES.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modalFooter">
            <div className="modalFooterActions">
              <button
                type="button"
                className="btnModalCancel"
                onClick={onClose}
                disabled={isPending}
              >
                <X size={16} />
                <span>ยกเลิก</span>
              </button>
              <button
                type="submit"
                className="btnModalSave"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>กำลังบันทึกข้อมูล…</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>บันทึกการแก้ไข</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
