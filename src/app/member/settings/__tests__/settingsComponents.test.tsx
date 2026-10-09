import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TASK_DEFINITIONS } from '@/lib/permissions/taskDefinitions'
import {
  MemberItem,
  PositionMappingItem,
  getAvatarColor,
  maskIdentifier,
  hasMemberPermissionEffective,
} from '../types'
import TaskWorkspaceView from '../components/TaskWorkspaceView'
import MemberInspectorView from '../components/MemberInspectorView'
import MemberPermissionModal from '../components/MemberPermissionModal'
import SystemModulesView from '../components/SystemModulesView'

const mockMembers: MemberItem[] = [
  {
    id: 1,
    username: '1234567890123',
    name: 'นายสมชาย ใจดี',
    department: 'กลุ่มงานเวชศาสตร์ฉุกเฉิน',
    position: 'นายแพทย์ชำนาญการ',
    role: 'admin',
    permissions: ['view_media_requests', 'manage_media'],
  },
  {
    id: 2,
    username: '9876543210987',
    name: 'นางสาวสมหญิง รักเรียน',
    department: 'กลุ่มงานการพยาบาล',
    position: 'พยาบาลวิชาชีพชำนาญการ',
    role: 'member',
    permissions: ['produce_media'],
  },
]

const mockPositionMappings: PositionMappingItem[] = [
  {
    id: 1,
    permissionKey: 'approve_media',
    positionName: 'ผู้อำนวยการโรงพยาบาล',
  },
]

describe('Settings Types & Helper Utilities', () => {
  it('getAvatarColor returns a deterministic color object', () => {
    const col1 = getAvatarColor(1)
    const col2 = getAvatarColor(1)
    expect(col1).toEqual(col2)
    expect(col1).toHaveProperty('bg')
    expect(col1).toHaveProperty('text')
  })

  it('maskIdentifier correctly masks 13-digit citizen IDs and generic usernames', () => {
    expect(maskIdentifier('1234567890123')).toBe('x-xxxx-xxxx0-12-3')
    expect(maskIdentifier('user12345')).toBe('x-xxxx-xxxxx-2345')
    expect(maskIdentifier('1234')).toBe('****')
    expect(maskIdentifier('')).toBe('')
    expect(maskIdentifier(null)).toBe('')
  })

  it('hasMemberPermissionEffective handles admin, direct permission, and position mapping', () => {
    // 1. Admin gets all perms
    const adminCheck = hasMemberPermissionEffective(mockMembers[0], 'ANY_RANDOM_PERM', mockPositionMappings)
    expect(adminCheck).toEqual({ hasPerm: true, origin: 'admin' })

    // 2. Direct permission
    const directCheck = hasMemberPermissionEffective(mockMembers[1], 'produce_media', mockPositionMappings)
    expect(directCheck).toEqual({ hasPerm: true, origin: 'member' })

    // 3. Position mapping
    const posMember: MemberItem = {
      ...mockMembers[1],
      position: 'ผู้อำนวยการโรงพยาบาล',
      permissions: [],
    }
    const posCheck = hasMemberPermissionEffective(posMember, 'approve_media', mockPositionMappings)
    expect(posCheck).toEqual({ hasPerm: true, origin: 'position' })

    // 4. No permission
    const noneCheck = hasMemberPermissionEffective(mockMembers[1], 'manage_media', mockPositionMappings)
    expect(noneCheck).toEqual({ hasPerm: false, origin: null })
  })
})

describe('TaskWorkspaceView Component', () => {
  it('renders task list navigation and workspace roles', () => {
    const onSelectTaskId = vi.fn()
    const onGrantMember = vi.fn()
    const onRevokeMember = vi.fn()
    const onGrantPosition = vi.fn()
    const onRevokePosition = vi.fn()

    render(
      <TaskWorkspaceView
        tasks={TASK_DEFINITIONS}
        members={mockMembers}
        positionMappings={mockPositionMappings}
        availablePositions={['นายแพทย์ชำนาญการ', 'พยาบาลวิชาชีพชำนาญการ']}
        uniqueDepartments={['กลุ่มงานเวชศาสตร์ฉุกเฉิน', 'กลุ่มงานการพยาบาล']}
        positionMemberCounts={{ 'นายแพทย์ชำนาญการ': 1, 'พยาบาลวิชาชีพชำนาญการ': 1 }}
        selectedTaskId="MEDIA_REQUEST"
        onSelectTaskId={onSelectTaskId}
        onGrantMember={onGrantMember}
        onRevokeMember={onRevokeMember}
        onGrantPosition={onGrantPosition}
        onRevokePosition={onRevokePosition}
        isActionPending={false}
      />
    )

    // Check header info
    expect(screen.getAllByText('งานขอสื่อประชาสัมพันธ์').length).toBeGreaterThan(0)
    expect(screen.getByText(/MEDIA_REQUEST/)).toBeDefined()

    // Check search filter in tasks
    const searchInput = screen.getByPlaceholderText('ค้นหาภารกิจงาน...')
    fireEvent.change(searchInput, { target: { value: 'แจ้งซ่อม' } })
    expect(screen.getByText('งานแจ้งซ่อมคอมพิวเตอร์และสารสนเทศ')).toBeDefined()
  })
})

describe('MemberInspectorView Component', () => {
  it('renders member search, department filter, and profile view', () => {
    const onEditMember = vi.fn()

    render(
      <MemberInspectorView
        members={mockMembers}
        tasks={TASK_DEFINITIONS}
        positionMappings={mockPositionMappings}
        uniqueDepartments={['กลุ่มงานเวชศาสตร์ฉุกเฉิน', 'กลุ่มงานการพยาบาล']}
        onEditMember={onEditMember}
      />
    )

    expect(screen.getAllByText('นายสมชาย ใจดี').length).toBeGreaterThan(0)
    expect(screen.getByText('นางสาวสมหญิง รักเรียน')).toBeDefined()

    const editBtn = screen.getByRole('button', { name: /ปรับสิทธิ์ละเอียด/i })
    fireEvent.click(editBtn)
    expect(onEditMember).toHaveBeenCalledWith(mockMembers[0])
  })
})

describe('MemberPermissionModal Component', () => {
  it('renders permission checkboxes, Clear All button, and triggers save', async () => {
    const onClose = vi.fn()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <MemberPermissionModal
        member={mockMembers[1]}
        tasks={TASK_DEFINITIONS}
        onClose={onClose}
        onSave={onSave}
        isSaving={false}
      />
    )

    expect(screen.getByText(/นางสาวสมหญิง รักเรียน/)).toBeDefined()
    expect(screen.getByText('เลือก 1 สิทธิ์')).toBeDefined()

    // Click Clear All
    const clearAllBtn = screen.getByRole('button', { name: /ล้างสิทธิ์ทั้งหมด/i })
    fireEvent.click(clearAllBtn)

    expect(screen.getByText('ไม่มีสิทธิ์ที่เลือก')).toBeDefined()

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /บันทึกสิทธิ์บุคคลนี้/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(2, [])
    })
  })
})

describe('SystemModulesView Component', () => {
  it('toggles feature switches and reports dirty state', () => {
    const addToast = vi.fn()
    const onDirtyChange = vi.fn()

    render(
      <SystemModulesView
        initialSettings={{
          feature_inbox: '1',
          feature_signature: '1',
          feature_salary: '1',
          feature_ita: '0',
          feature_rdu: '0',
          feature_repair: '1',
          feature_media_request: '1',
        }}
        addToast={addToast}
        onDirtyChange={onDirtyChange}
      />
    )

    expect(screen.getByText('สวิตช์ควบคุมการเปิด/ปิดโมดูลระบบบริการ')).toBeDefined()
    expect(screen.getByText('กล่องงานและระบบสายการอนุมัติ (Task Inbox)')).toBeDefined()
  })
})
