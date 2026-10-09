import React from 'react'
import {
  Eye,
  Wrench,
  CheckCircle2,
  Shield,
  Layers,
  Palette,
  Monitor,
  HeartPulse,
  Inbox,
  Coins,
  Package,
  FileSpreadsheet,
  Scale,
  Pill,
  Newspaper,
} from 'lucide-react'
import { PermRoleType, TaskRoleConfig, TaskDefinition } from '@/lib/permissions/taskDefinitions'

export interface MemberItem {
  id: number
  username: string
  name: string
  department: string
  position: string
  role: string
  permissions: string[]
}

export interface PositionMappingItem {
  id: number
  permissionKey: string
  positionName: string
}

export const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Palette,
  Monitor,
  Wrench,
  HeartPulse,
  Inbox,
  Coins,
  Package,
  FileSpreadsheet,
  Scale,
  BookOpen: Layers,
  Pill,
  Newspaper,
}

export const ROLE_TYPE_CONFIG: Record<
  PermRoleType,
  {
    label: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    color: string
    bg: string
    border: string
  }
> = {
  view: {
    label: 'View (ดูข้อมูล)',
    icon: Eye,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  edit: {
    label: 'Edit / Do (ปฏิบัติงาน)',
    icon: Wrench,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  approve: {
    label: 'Approve (อนุมัติ/ตรวจรับ)',
    icon: CheckCircle2,
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3',
  },
  manage: {
    label: 'Manage (ผู้ดูแลงาน)',
    icon: Shield,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
}

export const AVATAR_COLORS = [
  { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
  { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' },
  { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd' },
]

export function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

export function maskIdentifier(val?: string | null): string {
  if (!val) return ''
  const clean = val.trim()
  if (clean.length <= 4) return '****'
  if (/^\d{13}$/.test(clean)) {
    return `x-xxxx-xxxx${clean[9]}-${clean.slice(10, 12)}-${clean[12]}`
  }
  return `x-xxxx-xxxxx-${clean.slice(-4)}`
}

export function hasMemberPermissionEffective(
  member: MemberItem,
  permKey: string,
  positionMappings: PositionMappingItem[]
): { hasPerm: boolean; origin: 'member' | 'position' | 'admin' | null } {
  if (member.role === 'admin') return { hasPerm: true, origin: 'admin' }
  if (member.permissions.includes(permKey)) return { hasPerm: true, origin: 'member' }
  const pos = (member.position || '').trim()
  if (pos && positionMappings.some((p) => p.permissionKey === permKey && p.positionName === pos)) {
    return { hasPerm: true, origin: 'position' }
  }
  return { hasPerm: false, origin: null }
}
