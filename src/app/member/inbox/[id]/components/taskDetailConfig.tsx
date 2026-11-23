'use client'

import React, { useState } from 'react'
import {
  FileImage,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCheck,
} from 'lucide-react'

// Predefined Work Types with quick assist tags for Media Request
export const WORK_TYPES_CONFIG = [
  { key: 'tri_fold', label: 'แผ่นพับ 3 พับ', hasCustomInput: false },
  { key: 'website_aw', label: 'AW ขึ้นเว็บไซต์', hasCustomInput: false },
  {
    key: 'poster',
    label: 'โปสเตอร์',
    hasCustomInput: true,
    placeholder: 'ระบุขนาด เช่น A3, A2, 60x90 ซม.…',
    quickTags: ['A4', 'A3', 'A2', '60x90 ซม.'],
  },
  { key: 'staff_card', label: 'บัตรพนักงาน', hasCustomInput: false },
  { key: 'announcement_board', label: 'ป้ายประกาศ', hasCustomInput: false },
  { key: 'sticker', label: 'สติ๊กเกอร์', hasCustomInput: false },
  { key: 'video_editing', label: 'ตัดต่อวิดีโอ', hasCustomInput: false },
  { key: 'powerpoint', label: 'PowerPoint / Canva', hasCustomInput: false },
  {
    key: 'other',
    label: 'อื่น ๆ',
    hasCustomInput: true,
    placeholder: 'ระบุลักษณะงาน เช่น ไวนิล, Standee, Roll-up…',
    quickTags: ['ไวนิล', 'Standee', 'Roll-up', 'ป้ายโฟมบอร์ด', 'ของที่ระลึก'],
  },
]

// Predefined Channels with quick assist tags for Media Request
export const CHANNELS_CONFIG = [
  { key: 'hospital_social', label: 'สื่อโซเชียลของรพ.', hasCustomInput: false },
  { key: 'facebook_page', label: 'Page Facebook', hasCustomInput: false },
  {
    key: 'indoor',
    label: 'ในอาคารโรงพยาบาล',
    hasCustomInput: true,
    placeholder: 'ระบุบริเวณ เช่น หน้าห้องตรวจ OPD, โถงประชาสัมพันธ์ชั้น 1…',
    quickTags: ['หน้าห้องตรวจ OPD', 'โถงประชาสัมพันธ์ ชั้น 1', 'แผนกฉุกเฉิน (ER)', 'ตึกผู้ป่วยใน (IPD)'],
  },
  {
    key: 'community',
    label: 'ในชุมชน',
    hasCustomInput: true,
    placeholder: 'ระบุจุด/ชุมชน เช่น รพ.สต. ในเครือข่าย, ชุมชนเทศบาลเถิน…',
    quickTags: ['รพ.สต. ในเครือข่าย', 'ชุมชนเทศบาลเถิน', 'ออกหน่วยบริการ'],
  },
  {
    key: 'other',
    label: 'อื่น ๆ',
    hasCustomInput: true,
    placeholder: 'ระบุช่องทางเผยแพร่เพิ่มเติม…',
  },
]

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    return <FileImage aria-hidden="true" className="w-4 h-4 text-emerald-600 shrink-0" />
  }
  if (['pdf', 'doc', 'docx'].includes(ext)) {
    return <FileText aria-hidden="true" className="w-4 h-4 text-blue-600 shrink-0" />
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet aria-hidden="true" className="w-4 h-4 text-teal-600 shrink-0" />
  }
  if (['zip', 'rar', '7z'].includes(ext)) {
    return <FileArchive aria-hidden="true" className="w-4 h-4 text-amber-600 shrink-0" />
  }
  return <FileCheck aria-hidden="true" className="w-4 h-4 text-teal-600 shrink-0" />
}

export function RepairPhotoItem({ photo, index }: { photo: string; index: number }) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <a
        href={photo}
        target="_blank"
        rel="noopener noreferrer"
        className="photoThumbItem photoThumbError"
        title="รูปภาพโหลดไม่สำเร็จ คลิกเพื่อเปิดลิงก์โดยตรง"
      >
        <div className="photoThumbFallback">
          <FileImage size={24} className="text-slate-400" />
          <span style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'center' }}>
            รูปแนบ {index + 1}
          </span>
        </div>
      </a>
    )
  }

  return (
    <a
      href={photo}
      target="_blank"
      rel="noopener noreferrer"
      className="photoThumbItem"
      title={`คลิกเพื่อดูรูปแนบที่ ${index + 1} ขนาดเต็ม`}
    >
      <img
        src={photo}
        alt={`รูปแนบ ${index + 1}`}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </a>
  )
}

export interface TaskStep {
  id: string
  step_no: number
  step_name: string
  assignee_type: string
  assigned_to_id: number | null
  assigned_role: string | null
  assigned_to_name: string | null
  assigned_to_position: string | null
  status: string
  action_taken: string | null
  action_by_name: string | null
  action_at: string | null
  comment: string | null
  signature_path: string | null
  signature_hash: string | null
}

export interface TaskAudit {
  id: string
  action: string
  performed_by: number
  performer_name: string
  details: any
  created_at: string
}
