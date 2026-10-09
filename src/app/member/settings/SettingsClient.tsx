'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Sparkles, UserCheck, Sliders } from 'lucide-react'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import {
  TASK_DEFINITIONS,
  TaskDefinition,
  TaskRoleConfig,
} from '@/lib/permissions/taskDefinitions'
import { MemberItem, PositionMappingItem } from './types'
import TaskWorkspaceView from './components/TaskWorkspaceView'
import MemberInspectorView from './components/MemberInspectorView'
import MemberPermissionModal from './components/MemberPermissionModal'
import SystemModulesView from './components/SystemModulesView'

export type { MemberItem, PositionMappingItem }

interface SettingsClientProps {
  initialSettings: Record<string, string>
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  // Top Tabs State: 'tasks' | 'inspector' | 'features'
  const [activeTab, setActiveTab] = useState<'tasks' | 'inspector' | 'features'>('tasks')

  // Task-Centric Data & State
  const [tasks, setTasks] = useState<TaskDefinition[]>(TASK_DEFINITIONS)
  const [members, setMembers] = useState<MemberItem[]>([])
  const [positionMappings, setPositionMappings] = useState<PositionMappingItem[]>([])
  const [availablePositions, setAvailablePositions] = useState<string[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Selected Task in Left Sidebar
  const [selectedTaskId, setSelectedTaskId] = useState<string>('MEDIA_REQUEST')
  const [isActionPending, setIsActionPending] = useState(false)

  // Fine-grained Edit Member Modal
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null)
  const [isSavingMemberPerms, setIsSavingMemberPerms] = useState(false)

  // System Modules Dirty state (for badge)
  const [isFeaturesDirty, setIsFeaturesDirty] = useState(false)

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Load Task-Centric Data
  const loadTaskData = async () => {
    setLoadingData(true)
    try {
      const res = await fetch('/api/member/permissions/tasks')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          if (data.data.tasks) setTasks(data.data.tasks)
          if (data.data.members) setMembers(data.data.members)
          if (data.data.availablePositions) setAvailablePositions(data.data.availablePositions)
          if (data.data.positionMappings) setPositionMappings(data.data.positionMappings)
        }
      } else {
        addToast('ไม่สามารถโหลดข้อมูลสิทธิ์ตามงานได้', 'error')
      }
    } catch (error) {
      console.error('Failed to load task data:', error)
      addToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadTaskData()
  }, [])

  // Unique departments
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>()
    members.forEach((m) => {
      if (m.department && m.department.trim()) {
        set.add(m.department.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [members])

  // Count of staff per position
  const positionMemberCounts = useMemo(() => {
    const map: Record<string, number> = {}
    members.forEach((m) => {
      if (m.position && m.position.trim()) {
        const pos = m.position.trim()
        map[pos] = (map[pos] || 0) + 1
      }
    })
    return map
  }, [members])

  // Grant permission to member (Instant Save)
  const handleGrantMember = async (member: MemberItem, role: TaskRoleConfig) => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const res = await fetch('/api/member/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'member',
          memberId: member.id,
          permissionKey: role.permissionKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการมอบสิทธิ์')
      }

      // Update local state instantly
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, permissions: Array.from(new Set([...m.permissions, role.permissionKey])) }
            : m
        )
      )
      addToast(data.message || `เพิ่มสิทธิ์ให้ ${member.name} สำเร็จ`, 'success')
    } catch (err: any) {
      console.error('Grant member error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการมอบสิทธิ์', 'error')
    } finally {
      setIsActionPending(false)
    }
  }

  // Revoke permission from member (Instant Save)
  const handleRevokeMember = async (member: MemberItem, role: TaskRoleConfig) => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const res = await fetch('/api/member/permissions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'member',
          memberId: member.id,
          permissionKey: role.permissionKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการปลดสิทธิ์')
      }

      // Update local state instantly
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, permissions: m.permissions.filter((k) => k !== role.permissionKey) }
            : m
        )
      )
      addToast(data.message || `ปลดสิทธิ์ของ ${member.name} เรียบร้อยแล้ว`, 'info')
    } catch (err: any) {
      console.error('Revoke member error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการปลดสิทธิ์', 'error')
    } finally {
      setIsActionPending(false)
    }
  }

  // Grant permission to position (Instant Save)
  const handleGrantPosition = async (positionName: string, role: TaskRoleConfig) => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const res = await fetch('/api/member/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'position',
          positionName,
          permissionKey: role.permissionKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการมอบสิทธิ์ตำแหน่ง')
      }

      // Update local state instantly
      setPositionMappings((prev) => [
        ...prev,
        { id: Date.now(), permissionKey: role.permissionKey, positionName },
      ])
      addToast(data.message || `เพิ่มสิทธิ์สำหรับตำแหน่ง "${positionName}" สำเร็จ`, 'success')
    } catch (err: any) {
      console.error('Grant position error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการมอบสิทธิ์ตำแหน่ง', 'error')
    } finally {
      setIsActionPending(false)
    }
  }

  // Revoke permission from position (Instant Save)
  const handleRevokePosition = async (positionName: string, role: TaskRoleConfig) => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const res = await fetch('/api/member/permissions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'position',
          positionName,
          permissionKey: role.permissionKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการปลดสิทธิ์ตำแหน่ง')
      }

      // Update local state instantly
      setPositionMappings((prev) =>
        prev.filter(
          (p) => !(p.permissionKey === role.permissionKey && p.positionName === positionName)
        )
      )
      addToast(data.message || `ปลดสิทธิ์สำหรับตำแหน่ง "${positionName}" เรียบร้อยแล้ว`, 'info')
    } catch (err: any) {
      console.error('Revoke position error:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการปลดสิทธิ์ตำแหน่ง', 'error')
    } finally {
      setIsActionPending(false)
    }
  }

  // Handler for saving all permissions for single member from Modal
  const handleSaveMemberAllPerms = async (memberId: number, permissions: string[]) => {
    setIsSavingMemberPerms(true)
    try {
      const res = await fetch('/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          permissions,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์')
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, permissions } : m))
      )
      if (editingMember) {
        addToast(`บันทึกสิทธิ์ของคุณ ${editingMember.name} เรียบร้อยแล้ว`, 'success')
      }
      setEditingMember(null)
    } catch (err: any) {
      console.error('Save member all perms failed:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setIsSavingMemberPerms(false)
    }
  }

  return (
    <div className="settingsClientModern">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Main Top Navigation Tabs */}
      <div className="settingsMainTabs">
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`settingsMainTabBtn ${activeTab === 'tasks' ? 'active' : ''}`}
        >
          <div className="tabIconBox">
            <Sparkles size={18} />
          </div>
          <div className="tabTextBox">
            <span className="tabTitle">กำหนดสิทธิ์ตามภารกิจงาน</span>
            <span className="tabSub">Task-Centric Permissions (แนะนำ)</span>
          </div>
          <span className="tabBadge">{tasks.length} งาน</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inspector')}
          className={`settingsMainTabBtn ${activeTab === 'inspector' ? 'active' : ''}`}
        >
          <div className="tabIconBox">
            <UserCheck size={18} />
          </div>
          <div className="tabTextBox">
            <span className="tabTitle">ตรวจสอบสิทธิ์รายบุคคล</span>
            <span className="tabSub">Member Permission Inspector</span>
          </div>
          <span className="tabBadge secondary">{members.length} บุคลากร</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('features')}
          className={`settingsMainTabBtn ${activeTab === 'features' ? 'active' : ''}`}
        >
          <div className="tabIconBox">
            <Sliders size={18} />
          </div>
          <div className="tabTextBox">
            <span className="tabTitle">เปิด/ปิดโมดูลระบบบริการ</span>
            <span className="tabSub">Feature Toggles & Modules</span>
          </div>
          {isFeaturesDirty && <span className="tabBadge dirty">มีแก้ไข</span>}
        </button>
      </div>

      {/* TAB 1: TASK-CENTRIC PERMISSIONS (MAIN VIEW) */}
      {activeTab === 'tasks' && (
        <TaskWorkspaceView
          tasks={tasks}
          members={members}
          positionMappings={positionMappings}
          availablePositions={availablePositions}
          uniqueDepartments={uniqueDepartments}
          positionMemberCounts={positionMemberCounts}
          selectedTaskId={selectedTaskId}
          onSelectTaskId={setSelectedTaskId}
          onGrantMember={handleGrantMember}
          onRevokeMember={handleRevokeMember}
          onGrantPosition={handleGrantPosition}
          onRevokePosition={handleRevokePosition}
          isActionPending={isActionPending}
        />
      )}

      {/* TAB 2: MEMBER PERMISSION INSPECTOR */}
      {activeTab === 'inspector' && (
        <MemberInspectorView
          members={members}
          tasks={tasks}
          positionMappings={positionMappings}
          uniqueDepartments={uniqueDepartments}
          onEditMember={(m) => setEditingMember(m)}
        />
      )}

      {/* TAB 3: FEATURE TOGGLES & SYSTEM MODULES */}
      {activeTab === 'features' && (
        <SystemModulesView
          initialSettings={initialSettings}
          addToast={addToast}
          onDirtyChange={setIsFeaturesDirty}
        />
      )}

      {/* MODAL: FINE-GRAINED MEMBER PERMISSIONS EDITOR */}
      <MemberPermissionModal
        member={editingMember}
        tasks={tasks}
        onClose={() => setEditingMember(null)}
        onSave={handleSaveMemberAllPerms}
        isSaving={isSavingMemberPerms}
      />
    </div>
  )
}
