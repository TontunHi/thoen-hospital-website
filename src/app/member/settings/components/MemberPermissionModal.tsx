'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  UserCog,
  Trash2,
  Save,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { TaskDefinition } from '@/lib/permissions/taskDefinitions'
import {
  MemberItem,
  ICON_MAP,
  getAvatarColor,
} from '../types'

export interface MemberPermissionModalProps {
  member: MemberItem | null
  tasks: TaskDefinition[]
  onClose: () => void
  onSave: (memberId: number, permissions: string[]) => Promise<void>
  isSaving: boolean
}

export default function MemberPermissionModal({
  member,
  tasks,
  onClose,
  onSave,
  isSaving,
}: MemberPermissionModalProps) {
  const [editingMemberPerms, setEditingMemberPerms] = useState<string[]>([])

  useEffect(() => {
    if (member) {
      setEditingMemberPerms([...member.permissions])
    }
  }, [member])

  if (!member) return null

  const handleTogglePerm = (permKey: string) => {
    setEditingMemberPerms((prev) =>
      prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
    )
  }

  const handleClearAll = () => {
    setEditingMemberPerms([])
  }

  const handleSave = async () => {
    await onSave(member.id, editingMemberPerms)
  }

  const avatarColor = getAvatarColor(member.id)

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalDialog modalLarge" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalHeaderTitleRow">
            <div
              className="modalIconBox"
              style={{
                backgroundColor: avatarColor.bg,
                color: avatarColor.text,
              }}
            >
              <UserCog size={20} />
            </div>
            <div className="modalTitleMeta">
              <div className="modalTitleRow">
                <h3>ปรับปรุงสิทธิ์รายบุคคลโดยละเอียด</h3>
                <span
                  className={`modalPermCountBadge ${
                    editingMemberPerms.length === 0 ? 'empty' : ''
                  }`}
                >
                  {editingMemberPerms.length === 0
                    ? 'ไม่มีสิทธิ์ที่เลือก'
                    : `เลือก ${editingMemberPerms.length} สิทธิ์`}
                </span>
              </div>
              <p>
                {member.name} • {member.position || 'เจ้าหน้าที่'} (
                {member.department || 'รพ.เถิน'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modalCloseBtn"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modalBodyContent" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div className="memberPermEditGrid">
            {tasks.map((task) => {
              const Icon = ICON_MAP[task.iconName] || Layers
              return (
                <div key={task.id} className="memberEditTaskGroup">
                  <div className="taskGroupHeader">
                    <div
                      className="groupIconBox"
                      style={{
                        backgroundColor: `${task.badgeColor}15`,
                        color: task.badgeColor,
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <span className="groupTitle">{task.name}</span>
                  </div>

                  <div className="groupPermCheckboxes">
                    {task.roles.map((role) => {
                      const isChecked = editingMemberPerms.includes(role.permissionKey)
                      return (
                        <label key={role.permissionKey} className="checkboxLabelItem">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePerm(role.permissionKey)}
                          />
                          <div className="checkboxText">
                            <span className="title">{role.label}</span>
                            <span className="desc">{role.description}</span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="modalFooter spaceBetween">
          <div className="modalFooterLeft">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={isSaving || editingMemberPerms.length === 0}
              className="modalClearAllBtn"
              title="ล้างสิทธิ์ที่เลือกทั้งหมดสำหรับบุคคลนี้"
            >
              <Trash2 size={15} />
              <span>ล้างสิทธิ์ทั้งหมด</span>
              {editingMemberPerms.length > 0 && (
                <span className="clearAllCountBadge">{editingMemberPerms.length}</span>
              )}
            </button>
          </div>
          <div className="modalFooterRight">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="modalCancelBtn"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="modalSaveBtn"
            >
              {isSaving ? (
                <RefreshCw size={15} className="spinIcon" />
              ) : (
                <Save size={15} />
              )}
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์บุคคลนี้'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
