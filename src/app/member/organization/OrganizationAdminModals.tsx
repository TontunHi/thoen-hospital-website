'use client'

import React from 'react'
import {
  X,
  Search,
  Loader2,
  Upload,
  Crop,
  Trash2,
  Shield,
  Users,
  Crown,
  Plus,
  Check,
  ArrowUp,
  ArrowDown,
  Edit2,
} from 'lucide-react'
import { getInitials } from '@/lib/formatters'
import {
  type DepartmentGroupNode,
  type DepartmentRoleItem,
  type SystemMemberSearchResult,
  findGroupName,
} from './organizationHelpers'

export function OrganizationAdminModals(props: {
  isGroupModalOpen: boolean
  setIsGroupModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  groupModalMode: 'create' | 'edit'
  groupFormData: { id?: number; name: string; parentId: number | null }
  setGroupFormData: React.Dispatch<
    React.SetStateAction<{ id?: number; name: string; parentId: number | null }>
  >
  groups: DepartmentGroupNode[]
  handleSaveGroup: (e: React.FormEvent) => Promise<void>
  isMemberModalOpen: boolean
  setIsMemberModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  memberModalMode: 'create' | 'edit'
  selectedGroup: DepartmentGroupNode | null
  handleSaveMember: (e: React.FormEvent) => Promise<void>
  autocompleteContainerRef: React.RefObject<HTMLDivElement | null>
  searchMemberQuery: string
  setSearchMemberQuery: React.Dispatch<React.SetStateAction<string>>
  isSelectingMemberRef: React.MutableRefObject<boolean>
  searchMemberResults: SystemMemberSearchResult[]
  setSearchMemberResults: React.Dispatch<
    React.SetStateAction<SystemMemberSearchResult[]>
  >
  searchingMembers: boolean
  memberFormData: {
    id?: number
    name: string
    position: string
    role: string
    phone: string
    imagePath: string
    memberId: number | null
  }
  setMemberFormData: React.Dispatch<
    React.SetStateAction<{
      id?: number
      name: string
      position: string
      role: string
      phone: string
      imagePath: string
      memberId: number | null
    }>
  >
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void
  imgPreviewFailed: boolean
  setImgPreviewFailed: React.Dispatch<React.SetStateAction<boolean>>
  isUploadingPhoto: boolean
  handlePhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleEditCurrentPhoto: () => void
  setIsRoleModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  roles: DepartmentRoleItem[]
  isRoleModalOpen: boolean
  handleCreateRole: (e: React.FormEvent) => Promise<void>
  newRoleName: string
  setNewRoleName: React.Dispatch<React.SetStateAction<string>>
  creatingRole: boolean
  loadingRoles: boolean
  editingRoleId: number | null
  setEditingRoleId: React.Dispatch<React.SetStateAction<number | null>>
  editingRoleName: string
  setEditingRoleName: React.Dispatch<React.SetStateAction<string>>
  handleUpdateRole: (id: number) => Promise<void>
  savingRoleEdit: boolean
  handleMoveRole: (index: number, direction: 'up' | 'down') => Promise<void>
  handleDeleteRole: (roleItem: DepartmentRoleItem) => void
}) {
  const {
    isGroupModalOpen,
    setIsGroupModalOpen,
    groupModalMode,
    groupFormData,
    setGroupFormData,
    groups,
    handleSaveGroup,
    isMemberModalOpen,
    setIsMemberModalOpen,
    memberModalMode,
    selectedGroup,
    handleSaveMember,
    autocompleteContainerRef,
    searchMemberQuery,
    setSearchMemberQuery,
    isSelectingMemberRef,
    searchMemberResults,
    setSearchMemberResults,
    searchingMembers,
    memberFormData,
    setMemberFormData,
    addToast,
    imgPreviewFailed,
    setImgPreviewFailed,
    isUploadingPhoto,
    handlePhotoSelect,
    handleEditCurrentPhoto,
    setIsRoleModalOpen,
    roles,
    isRoleModalOpen,
    handleCreateRole,
    newRoleName,
    setNewRoleName,
    creatingRole,
    loadingRoles,
    editingRoleId,
    setEditingRoleId,
    editingRoleName,
    setEditingRoleName,
    handleUpdateRole,
    savingRoleEdit,
    handleMoveRole,
    handleDeleteRole,
  } = props

  return (
    <>
        {/* Group Add/Edit Modal */}
        {isGroupModalOpen && (
          <div className="modalOverlay" onClick={() => setIsGroupModalOpen(false)}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <h3 className="modalHeaderTitle">
                    {groupModalMode === 'create'
                      ? groupFormData.parentId
                        ? 'เพิ่มงานย่อย'
                        : 'เพิ่มกลุ่มงานหลัก'
                      : 'แก้ไขชื่อกลุ่มงาน'}
                  </h3>
                  {groupFormData.parentId && (
                    <p className="modalHeaderSub">
                      ภายใต้กลุ่มงาน:{' '}
                      <strong>{findGroupName(groups, groupFormData.parentId) || 'กลุ่มงานหลัก'}</strong>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => setIsGroupModalOpen(false)}
                  aria-label="ปิด"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveGroup}>
                <div className="modalBody">
                  <div className="formGroup">
                    <label className="formLabel">ชื่อกลุ่มงาน / หน่วยงาน *</label>
                    <input
                      type="text"
                      className="formInput"
                      placeholder="เช่น กลุ่มงานการพยาบาล, งานอุบัติเหตุและฉุกเฉิน"
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                      required
                      autoFocus
                    />
                    <small className="formHelpText">
                      ชื่อนี้จะปรากฏในผังโครงสร้างองค์กรและเว็บไซต์ทางการของโรงพยาบาลเถิน
                    </small>
                  </div>
                </div>
                <div className="modalFooter">
                  <button
                    type="button"
                    className="btn btnSecondary"
                    onClick={() => setIsGroupModalOpen(false)}
                  >
                    ยกเลิก
                  </button>
                  <button type="submit" className="btn btnPrimary">
                    บันทึก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Member Add/Edit Modal */}
        {isMemberModalOpen && (
          <div className="modalOverlay" onClick={() => setIsMemberModalOpen(false)}>
            <div className="modalContent modalWide" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <h3 className="modalHeaderTitle">
                    {memberModalMode === 'create' ? 'เพิ่มสมาชิกในกลุ่มงาน' : 'แก้ไขข้อมูลสมาชิก'}
                  </h3>
                  <p className="modalHeaderSub">
                    กลุ่มงาน: <strong>{selectedGroup?.name}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => setIsMemberModalOpen(false)}
                  aria-label="ปิด"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveMember}>
                <div className="modalBody">
                  <div className="modalFormGrid">
                    {/* Left Column: Member Search (if create) + Photo Upload */}
                    <div className="modalSectionCol">
                      {memberModalMode === 'create' && (
                        <div className="formGroup autocompleteContainer" ref={autocompleteContainerRef}>
                          <label className="formLabel">
                            ดึงข้อมูลจากบัญชีบุคลากร (ทางเลือก)
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              className="formInput"
                              style={{
                                width: '100%',
                                paddingLeft: '34px',
                                paddingRight: searchMemberQuery ? '34px' : '10px',
                                fontSize: '0.85rem'
                              }}
                              placeholder="ค้นชื่อ หรือ แผนก..."
                              value={searchMemberQuery}
                              onChange={(e) => {
                                isSelectingMemberRef.current = false
                                setSearchMemberQuery(e.target.value)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setSearchMemberResults([])
                                }
                              }}
                            />
                            <Search
                              size={15}
                              className="text-slate-400"
                              style={{ position: 'absolute', left: '10px', top: '12px' }}
                            />
                            {searchingMembers ? (
                              <Loader2
                                size={15}
                                className="animate-spin text-emerald-700"
                                style={{ position: 'absolute', right: '10px', top: '12px' }}
                              />
                            ) : searchMemberQuery ? (
                              <button
                                type="button"
                                onClick={() => {
                                  isSelectingMemberRef.current = false
                                  setSearchMemberQuery('')
                                  setSearchMemberResults([])
                                }}
                                aria-label="ล้างคำค้นหา"
                                style={{
                                  position: 'absolute',
                                  right: '10px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--admin-slate-muted)'
                                }}
                              >
                                <X size={14} />
                              </button>
                            ) : null}
                          </div>

                          {searchMemberResults.length > 0 && (
                            <div className="autocompleteList">
                              {searchMemberResults.map((s) => (
                                <div
                                  key={s.id}
                                  className="autocompleteItem"
                                  onClick={() => {
                                    isSelectingMemberRef.current = true
                                    setMemberFormData({
                                      ...memberFormData,
                                      name: s.name,
                                      position: s.position,
                                      imagePath: s.profilePath || '',
                                      memberId: s.id
                                    })
                                    setSearchMemberResults([])
                                    setSearchMemberQuery(s.name)
                                    addToast(`ดึงข้อมูลคุณ ${s.name} เรียบร้อย`, 'info')
                                  }}
                                >
                                  {s.profilePath ? (
                                    <img
                                      src={s.profilePath}
                                      alt={s.name}
                                      className="autocompleteAvatar"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                  ) : (
                                    <div className="autocompleteAvatarFallback">
                                      {getInitials(s.name)}
                                    </div>
                                  )}
                                  <div className="autocompleteText">
                                    <span className="autocompleteItemName">{s.name}</span>
                                    <span className="autocompleteItemSub">
                                      {s.position} • {s.department}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Photo Upload Area */}
                      <div className="formGroup">
                        <label className="formLabel">รูปถ่ายบุคลากร</label>
                        <div className="photoUploadArea">
                          {memberFormData.imagePath && !imgPreviewFailed ? (
                            <img
                              src={memberFormData.imagePath}
                              alt="Preview"
                              className="photoPreview"
                              onError={() => setImgPreviewFailed(true)}
                            />
                          ) : (
                            <div className="avatarFallback photoPreviewFallback">
                              {getInitials(memberFormData.name)}
                            </div>
                          )}

                          <div className="photoUploadActions">
                            <label className="btn btnSecondary btnSmall uploadBtnLabel">
                              <Upload size={14} />
                              <span>{isUploadingPhoto ? 'กำลังอัปโหลด...' : memberFormData.imagePath ? 'เปลี่ยนรูปถ่าย (ตัดครอบ/Crop)' : 'เลือกรูปถ่าย (ตัดครอบ/Crop)'}</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/jfif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.jfif,.heic,.heif"
                                onChange={handlePhotoSelect}
                                disabled={isUploadingPhoto}
                                style={{ display: 'none' }}
                              />
                            </label>
                            {memberFormData.imagePath && (
                              <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                                <button
                                  type="button"
                                  className="btn btnSecondary btnSmall"
                                  onClick={handleEditCurrentPhoto}
                                  style={{
                                    flex: 1,
                                    fontSize: '0.75rem',
                                    padding: '5px 8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Crop size={12} color="#2563EB" />
                                  <span>Crop / ตัดครอบรูป</span>
                                </button>
                                <button
                                  type="button"
                                  className="iconBtnCompact danger"
                                  onClick={() => {
                                    setMemberFormData({ ...memberFormData, imagePath: '' })
                                    setImgPreviewFailed(false)
                                  }}
                                  title="ลบรูปภาพ"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Name, Position, Phone */}
                    <div className="modalSectionCol">
                      <div className="formGroup">
                        <label className="formLabel">คำนำหน้า-ชื่อ-นามสกุล *</label>
                        <input
                          type="text"
                          className="formInput"
                          placeholder="เช่น พญ.นฤนาท จอมภาปิน, นายแพทย์สาธิต ปทุมมัง"
                          value={memberFormData.name}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, name: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="formGroup">
                        <label className="formLabel">ตำแหน่งงาน *</label>
                        <input
                          type="text"
                          className="formInput"
                          placeholder="เช่น ผู้อำนวยการโรงพยาบาล, พยาบาลวิชาชีพชำนาญการ"
                          value={memberFormData.position}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, position: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="formGroup">
                        <label className="formLabel">
                          เบอร์โทรศัพท์ภายใน (สำหรับดูเฉพาะภายใน รพ.)
                        </label>
                        <input
                          type="text"
                          className="formInput"
                          placeholder="เช่น 101, 102 หรือ เบอร์ต่อห้องตรวจ"
                          value={memberFormData.phone}
                          onChange={(e) =>
                            setMemberFormData({ ...memberFormData, phone: e.target.value })
                          }
                        />
                        <small className="formHelpText">
                          * เบอร์ภายในจะแสดงเฉพาะเจ้าหน้าที่ในระบบ จะไม่แสดงบนเว็บสาธารณะ
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Role in Group (Full Width) */}
                  <div className="formGroup" style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="formLabel">ระดับบทบาทในกลุ่มงาน *</label>
                      <button
                        type="button"
                        onClick={() => setIsRoleModalOpen(true)}
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--admin-primary)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Shield size={12} />
                        <span>จัดการระดับบทบาท</span>
                      </button>
                    </div>
                    <div className="roleSelectorGrid">
                      {roles.length === 0 ? (
                        <>
                          <div
                            className={`roleOptionCard ${memberFormData.role === 'member' ? 'active' : ''}`}
                            onClick={() => setMemberFormData({ ...memberFormData, role: 'member' })}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="roleOptionCardHeader">
                              <Users size={16} className={memberFormData.role === 'member' ? 'text-emerald-700' : 'text-slate-400'} />
                              <div className="roleOptionCardTitle">เจ้าหน้าที่ผู้ปฏิบัติงาน</div>
                            </div>
                          </div>
                          <div
                            className={`roleOptionCard ${memberFormData.role === 'leader' ? 'active' : ''}`}
                            onClick={() => setMemberFormData({ ...memberFormData, role: 'leader' })}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="roleOptionCardHeader">
                              <Crown size={16} className={memberFormData.role === 'leader' ? 'text-amber-600' : 'text-slate-400'} />
                              <div className="roleOptionCardTitle">หัวหน้ากลุ่มงาน / ผู้บริหาร</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        roles.map((r, rIdx) => {
                          const isSelected =
                            memberFormData.role === r.name ||
                            (rIdx === 0 && memberFormData.role === 'leader') ||
                            (r.isDefault && memberFormData.role === 'member')
                          const isLeader = rIdx === 0 || (r.name.toLowerCase().includes('หัวหน้า') && !r.name.toLowerCase().includes('รอง') && !r.name.toLowerCase().includes('ผู้ช่วย'))

                          return (
                            <div
                              key={r.id}
                              className={`roleOptionCard ${isSelected ? 'active' : ''}`}
                              onClick={() => setMemberFormData({ ...memberFormData, role: r.name })}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setMemberFormData({ ...memberFormData, role: r.name })
                                }
                              }}
                            >
                              <div className="roleOptionCardHeader">
                                {isLeader ? (
                                  <Crown size={16} className={isSelected ? 'text-amber-600' : 'text-slate-400'} />
                                ) : (
                                  <Users size={16} className={isSelected ? 'text-emerald-700' : 'text-slate-400'} />
                                )}
                                <div className="roleOptionCardTitle">{r.name}</div>
                              </div>
                              <div className="roleOptionCardDesc">
                                ระดับลำดับที่ {rIdx + 1} {r.isDefault ? '• ค่าเริ่มต้น' : ''}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
                <div className="modalFooter">
                  <button
                    type="button"
                    className="btn btnSecondary"
                    onClick={() => setIsMemberModalOpen(false)}
                  >
                    ยกเลิก
                  </button>
                  <button type="submit" className="btn btnPrimary" disabled={isUploadingPhoto}>
                    {isUploadingPhoto ? 'กำลังดำเนินการ...' : 'บันทึกข้อมูล'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Role Levels Management Modal */}
        {isRoleModalOpen && (
          <div className="modalOverlay" onClick={() => setIsRoleModalOpen(false)}>
            <div className="modalContent modalWide" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <h3 className="modalHeaderTitle">
                    จัดการระดับบทบาทบุคลากร (Role Levels)
                  </h3>
                  <p className="modalHeaderSub">
                    กำหนดและจัดลำดับความสำคัญของบทบาทบุคลากรภายในกลุ่มงาน (เช่น หัวหน้า, รองหัวหน้า, เจ้าหน้าที่)
                  </p>
                </div>
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => setIsRoleModalOpen(false)}
                  aria-label="ปิด"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modalBody">
                {/* Add Role Form */}
                <form onSubmit={handleCreateRole} className="roleCreateForm">
                  <input
                    type="text"
                    className="formInput"
                    placeholder="ระบุชื่อบทบาทใหม่ เช่น รองหัวหน้ากลุ่มงาน, ผู้ช่วยหัวหน้างาน, พยาบาลประสานงาน..."
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    disabled={creatingRole}
                  />
                  <button
                    type="submit"
                    className="btn btnPrimary"
                    disabled={creatingRole || !newRoleName.trim()}
                  >
                    {creatingRole ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    <span>เพิ่มบทบาท</span>
                  </button>
                </form>

                {/* Roles List */}
                <div className="roleListContainer">
                  {loadingRoles ? (
                    <div className="emptyState" style={{ padding: '24px 0' }}>
                      <Loader2 className="animate-spin text-emerald-700" size={24} />
                      <span>กำลังโหลดระดับบทบาท...</span>
                    </div>
                  ) : roles.length === 0 ? (
                    <div className="emptyState" style={{ padding: '24px 0' }}>
                      <span>ยังไม่มีบทบาทที่กำหนด</span>
                    </div>
                  ) : (
                    <div className="rolesList">
                      {roles.map((r, index) => {
                        const isEditing = editingRoleId === r.id
                        const isFirst = index === 0
                        const isLast = index === roles.length - 1

                        return (
                          <div key={r.id} className="roleListItem">
                            <div className="roleItemLeft">
                              <div className="roleRankBadge" title={`ลำดับความสำคัญที่ ${index + 1}`}>
                                #{index + 1}
                              </div>

                              {isEditing ? (
                                <div className="roleEditInputWrap">
                                  <input
                                    type="text"
                                    className="formInput"
                                    value={editingRoleName}
                                    onChange={(e) => setEditingRoleName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleUpdateRole(r.id)
                                      if (e.key === 'Escape') setEditingRoleId(null)
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btnPrimary btnSmall"
                                    onClick={() => handleUpdateRole(r.id)}
                                    disabled={savingRoleEdit || !editingRoleName.trim()}
                                  >
                                    <Check size={13} /> บันทึก
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btnSecondary btnSmall"
                                    onClick={() => setEditingRoleId(null)}
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              ) : (
                                <div className="roleItemNameWrap">
                                  <span className="roleItemName">{r.name}</span>
                                  {r.isDefault && (
                                    <span className="roleDefaultTag">ค่าเริ่มต้น</span>
                                  )}
                                  {isFirst && (
                                    <span className="roleTopRankTag">ระดับสูงสุด</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {!isEditing && (
                              <div className="roleItemActions">
                                <div className="orderButtonsRow">
                                  <button
                                    type="button"
                                    className="orderBtnCompact"
                                    title="เลื่อนระดับขึ้น (ความสำคัญสูงขึ้น)"
                                    disabled={isFirst}
                                    onClick={() => handleMoveRole(index, 'up')}
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="orderBtnCompact"
                                    title="เลื่อนระดับลง"
                                    disabled={isLast}
                                    onClick={() => handleMoveRole(index, 'down')}
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  className="iconBtnCompact"
                                  title="แก้ไขชื่อบทบาท"
                                  onClick={() => {
                                    setEditingRoleId(r.id)
                                    setEditingRoleName(r.name)
                                  }}
                                >
                                  <Edit2 size={13} />
                                </button>

                                <button
                                  type="button"
                                  className="iconBtnCompact danger"
                                  title="ลบบทบาทนี้"
                                  disabled={roles.length <= 1}
                                  onClick={() => handleDeleteRole(r)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={() => setIsRoleModalOpen(false)}
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  )
}
